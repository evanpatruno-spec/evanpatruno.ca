/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V4.6 - RESTAURATION & MLS FIXED)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { codePortal, phoneLast4, action, mlsNumber } = req.body;
    const cleanCode = codePortal?.trim().toUpperCase();

    try {
        // --- OAUTH ZOHO ---
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', (process.env.ZOHO_REFRESH_TOKEN || "").trim());
        tokenParams.append('client_id', (process.env.ZOHO_CLIENT_ID || "").trim());
        tokenParams.append('client_secret', (process.env.ZOHO_CLIENT_SECRET || "").trim());
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho', details: tokenData });

        // --- RECHERCHE DU DEAL ---
        let deal = null;
        const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const sData = await sResp.json();

        if (sData.data && sData.data.length > 0) {
            const found = sData.data[0];
            const rResp = await fetch(`${apiDomain}/crm/v2/${found.$module}/${found.id}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        } else if (cleanCode === "EP-1") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        }

        if (!deal) return res.status(404).json({ error: 'Dossier introuvable' });

        // --- ACTION : DEMANDE MLS ---
        if (action === 'requestMLS') {
            if (!mlsNumber) return res.status(400).json({ error: 'MLS manquant' });
            
            const nResp = await fetch(`${apiDomain}/crm/v2/Notes`, {
                method: 'POST',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [{
                        Parent_Id: deal.id,
                        Note_Title: "DEMANDE DOCUMENTS MLS",
                        Note_Content: `MLS: ${mlsNumber}`,
                        se_module: "Potentials"
                    }]
                })
            });
            const nData = await nResp.json();
            return res.status(200).json({ success: true, zoho: nData });
        }

        // --- RÉCUPÉRATION CONTACT POUR SÉCURITÉ ---
        const contactId = deal.Contact_Name?.id;
        const contactResp = await fetch(`${apiDomain}/crm/v2/Contacts/${contactId}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const contactData = await contactResp.json();
        const contact = contactData.data ? contactData.data[0] : null;

        if (contact) {
            const cleanPhone = (contact.Mobile || contact.Phone || "").replace(/\D/g, "");
            if (cleanPhone.slice(-4) !== phoneLast4) {
                return res.status(401).json({ error: "Sécurité : Téléphone incorrect" });
            }
        }

        // --- MAPPING FINAL (RESTAURATION DE LA STRUCTURE) ---
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const getDays = (dateStr) => {
            if (!dateStr) return null;
            const target = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
        };

        const portalData = {
            firstName: contact?.First_Name || "Client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "",
            isCelebration: (deal.Stage || "").toLowerCase().includes("vendu"),
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            milestones: {
                financing: { days: getDays(deal.Date_de_financement), date: formatDate(deal.Date_de_financement) },
                inspection: { days: getDays(deal.Date_d_inspection), date: formatDate(deal.Date_d_inspection) },
                signature: { days: getDays(deal.Closing_Date), date: formatDate(deal.Closing_Date) },
                occupation: { days: getDays(deal.Date_d_occupation), date: formatDate(deal.Date_d_occupation) }
            },
            timeline: [
                { label: "Préparation", status: "completed", icon: "📝" },
                { label: "Offre", status: "active", icon: "🤝" },
                { label: "Conditions", status: "pending", icon: "🛡️" },
                { label: "Notaire", status: "pending", icon: "✒️" },
                { label: "Vendu", status: "pending", icon: "🏠" }
            ],
            team: [
                { role: "Votre Courtier", name: "Evan Patruno", icon: "👨‍💼", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }
            ]
        };

        return res.status(200).json(portalData);

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
