/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V5.2 - NO-TIMEOUT VERSION)
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
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN?.trim());
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID?.trim());
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET?.trim());
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho' });

        // --- ACTION MLS : RÉPONSE RAPIDE ---
        if (action === 'requestMLS') {
            let targetId = (cleanCode === "EP-1") ? "6466486000011930049" : null;
            
            if (!targetId) {
                const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                    method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const sData = await sResp.json();
                if (sData.data) targetId = sData.data[0].id;
            }

            if (targetId) {
                // On lance la création de note en arrière-plan (sans attendre le résultat pour éviter le timeout)
                fetch(`${apiDomain}/crm/v2/Notes`, {
                    method: 'POST',
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data: [{
                            Parent_Id: targetId,
                            Note_Title: "DEMANDE DOCUMENTS MLS",
                            Note_Content: `MLS: ${mlsNumber}`,
                            se_module: "Potentials"
                        }]
                    })
                });
                return res.status(200).json({ success: true, message: "Demande transmise" });
            } else {
                return res.status(404).json({ error: "Dossier introuvable" });
            }
        }

        // --- RESTE DU CHARGEMENT DASHBOARD (Restauration intégrale) ---
        let deal = null;
        if (cleanCode === "EP-1") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        } else {
            const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const sData = await sResp.json();
            if (sData.data) {
                const rResp = await fetch(`${apiDomain}/crm/v2/${sData.data[0].$module}/${sData.data[0].id}`, {
                    method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const dData = await rResp.json();
                deal = dData.data ? dData.data[0] : null;
            }
        }

        if (!deal) return res.status(404).json({ error: 'Dossier introuvable' });

        // --- RÉCUPÉRATION INTERVENANTS ---
        const fetchP = async (f) => {
            if (!f || !f.id) return null;
            const r = await fetch(`${apiDomain}/crm/v2/Contacts/${f.id}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const d = await r.json();
            return d.data ? d.data[0] : null;
        };
        const [n, i, c] = await Promise.all([fetchP(deal.Nom_Notaire), fetchP(deal.Nom_Inspecteur), fetchP(deal.Nom_Courtier_Hypoth_caire)]);
        
        const team = [{ role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "&#x1f468;&#x200d;&#x1f4bc;", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }];
        const add = (p, r, ic) => { if(p) team.push({ role:r, name: p.Full_Name || p.Name, icon:ic, phone: p.Mobile || p.Phone || "À venir", email: p.Email || "À venir", contact: p.Email ? `mailto:${p.Email}` : "#" }); };
        add(c, "Courtier Hypothécaire", "&#x1f3e6;"); add(i, "Inspecteur", "🔍"); add(n, "Notaire", "✒️");

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const getDays = (d) => d ? Math.ceil((new Date(d) - new Date().setHours(0,0,0,0)) / 86400000) : null;

        return res.status(200).json({
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            code: cleanCode,
            property: deal.Deal_Name,
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            milestones: {
                financing: { days: getDays(deal.Date_de_financement), date: formatDate(deal.Date_de_financement) },
                inspection: { days: getDays(deal.Date_d_inspection), date: formatDate(deal.Date_d_inspection) },
                signature: { days: getDays(deal.Closing_Date), date: formatDate(deal.Closing_Date) },
                occupation: { days: getDays(deal.Date_d_occupation), date: formatDate(deal.Date_d_occupation) }
            },
            timeline: [{ label: "Préparation", status: "completed", icon: "&#x1f4cb;" }, { label: "Visites", status: "active", icon: "🔍" }, { label: "Conditions", status: "pending", icon: "&#x1f6e1;&#xfe0f;" }, { label: "Notaire", status: "pending", icon: "&#x2696;&#xfe0f;" }, { label: "Vendu", status: "pending", icon: "&#x1f37e;" }],
            checklist: [{ name: "Financement Approuvé", done: deal.Financement_approuv === "Oui" }, { name: "Inspection complétée", done: deal.Inspection_satisfaisante === "Oui" }, { name: "Conditions de l'offre levées", done: deal.Autres_conditions_lev_es === "Oui" }],
            movingChecklist: [{ name: "Changement d'adresse", done: false }, { name: "Hydro-Québec", done: false }, { name: "Assurance Habitation", done: false }],
            partners: [
                { category: "Peinture", name: "Peinture Excellence", icon: "&#x1f3a8;", benefit: "10% de rabais", code: "EP-PROMO" },
                { category: "Plomberie", name: "Plombier Pro", icon: "&#x1f6bf;", benefit: "Estimation gratuite", code: "EP-PROMO" },
                { category: "Électricité", name: "Électricien Élite", icon: "⚡", benefit: "-15% main d'œuvre", code: "EP-PROMO" },
                { category: "Design Intérieur", name: "Designer d'Espaces", icon: "&#x1f6cb;&#xfe0f;", benefit: "1h consultation offerte", code: "EP-PROMO" },
                { category: "Excavation/Drains", name: "Drains Express", icon: "&#x1f300;", benefit: "Caméra incluse", code: "EP-PROMO" },
                { category: "Couvreur", name: "Toiture Premium", icon: "&#x1f3e0;", benefit: "Inspection annuelle", code: "EP-PROMO" },
                { category: "Aménagement", name: "Paysage Urbain", icon: "&#x1f33f;", benefit: "-10% sur les plants", code: "EP-PROMO" },
                { category: "Ménage", name: "Nettoyage Éclat", icon: "&#x1f9b9;", benefit: "-50$ Forfait Global", code: "EP-PROMO" },
                { category: "Arpenteur", name: "Précision Géo", icon: "&#x1f4cf;", benefit: "Service Prioritaire", code: "EP-PROMO" },
                { category: "Assurances", name: "Tranquillité Plus", icon: "&#x1f6e1;&#xfe0f;", benefit: "50$ en carte cadeau", code: "EP-PROMO" }
            ],
            team: team,
            concierge: {
                smartHome: [{ title: "Sonnette Vidéo", icon: "&#x1f514;" }, { title: "Thermostat", icon: "&#x1f321;&#xfe0f;" }],
                maintenance: [{ title: "Gouttières", period: "Automne" }, { title: "Fournaise", period: "3 mois" }]
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur', details: error.message });
    }
}
