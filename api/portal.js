/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V4.5 - MLS ACTION FIXED)
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
        // --- ÉTAPE 1 : OAUTH ZOHO ---
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', (process.env.ZOHO_REFRESH_TOKEN || "").trim());
        tokenParams.append('client_id', (process.env.ZOHO_CLIENT_ID || "").trim());
        tokenParams.append('client_secret', (process.env.ZOHO_CLIENT_SECRET || "").trim());
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) throw new Error('Erreur Auth Zoho (AccessToken manquant)');

        // --- ÉTAPE 2 : IDENTIFICATION DU DOSSIER (DEAL ID) ---
        let dealId = null;
        if (cleanCode === "EP-1") {
            dealId = "6466486000011930049";
        } else {
            const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const sData = await sResp.json();
            if (sData.data && sData.data.length > 0) {
                dealId = sData.data[0].id;
            }
        }

        if (!dealId) return res.status(404).json({ error: 'Dossier introuvable (' + cleanCode + ')' });

        // --- ACTION : DEMANDE DE DOCUMENTS MLS ---
        if (action === 'requestMLS') {
            if (!mlsNumber) return res.status(400).json({ error: 'Numéro MLS manquant' });

            const noteBody = {
                data: [{
                    Parent_Id: dealId,
                    Note_Title: "DEMANDE DOCUMENTS MLS",
                    Note_Content: `Le client a demandé les documents pour le MLS : ${mlsNumber}`,
                    se_module: "Potentials"
                }]
            };

            const noteResp = await fetch(`${apiDomain}/crm/v2/Notes`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Zoho-oauthtoken ${accessToken}`, 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(noteBody)
            });
            
            const noteResData = await noteResp.json();
            return res.status(200).json({ success: true, zoho: noteResData });
        }

        // --- RÉCUPÉRATION COMPLÈTE DU DEAL POUR LE PORTAIL ---
        const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/${dealId}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const dData = await rResp.json();
        const deal = dData.data ? dData.data[0] : null;

        if (!deal) return res.status(404).json({ error: 'Données de l\'affaire introuvables' });

        // --- SÉCURITÉ : VÉRIFICATION DU TÉLÉPHONE DU CONTACT ---
        const contactId = deal.Contact_Name?.id;
        if (!contactId) return res.status(403).json({ error: "Aucun contact lié à cette affaire" });

        const cResp = await fetch(`${apiDomain}/crm/v2/Contacts/${contactId}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const cData = await cResp.json();
        const contact = cData.data ? cData.data[0] : null;

        if (!contact) return res.status(403).json({ error: "Fiche contact introuvable" });

        const cleanPhone = (contact.Mobile || contact.Phone || "").replace(/\D/g, "");
        if (cleanPhone.slice(-4) !== phoneLast4) {
            return res.status(401).json({ error: "Code de sécurité (téléphone) incorrect" });
        }

        // --- MAPPING DES DONNÉES (VERSION SIMPLIFIÉE POUR STABILITÉ) ---
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        
        const portalData = {
            firstName: contact.First_Name || "Client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "En cours",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            timeline: [
                { label: "Préparation", status: "completed", icon: "📝" },
                { label: "Offre", status: "active", icon: "🤝" },
                { label: "Conditions", status: "pending", icon: "🛡️" },
                { label: "Notaire", status: "pending", icon: "✒️" },
                { label: "Succès", status: "pending", icon: "🏠" }
            ],
            milestones: {
                financing: { date: formatDate(deal.Date_de_financement) },
                inspection: { date: formatDate(deal.Date_d_inspection) },
                signature: { date: formatDate(deal.Closing_Date) },
                occupation: { date: formatDate(deal.Date_d_occupation) }
            },
            team: [
                { role: "Votre Courtier", name: "Evan Patruno", icon: "👨‍💼", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }
            ]
        };

        return res.status(200).json(portalData);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erreur Serveur', message: error.message });
    }
}
