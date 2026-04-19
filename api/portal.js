/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V2.7 - COMPATIBILITÉ TOTALE)
 * Tente toutes les combinaisons de modules (Deals/Potentials) et de champs (Code_Portail/__c)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { codePortal } = req.body;
    const cleanCode = codePortal?.trim();

    try {
        // 1. Authentification
        const tokenParams = new URLSearchParams({
            refresh_token: process.env.ZOHO_REFRESH_TOKEN?.trim(),
            client_id: process.env.ZOHO_CLIENT_ID?.trim(),
            client_secret: process.env.ZOHO_CLIENT_SECRET?.trim(),
            grant_type: 'refresh_token'
        });

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', body: tokenParams
        });
        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.status(401).json({ error: 'Erreur Auth Zoho' });

        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        // 2. FONCTION DE RECHERCHE MULTI-MODULE
        async function findDeal(moduleName, fieldName) {
            const criteria = encodeURIComponent(`(${fieldName}:equals:${cleanCode})`);
            const resp = await fetch(`${apiDomain}/crm/v2/${moduleName}/search?criteria=${criteria}`, {
                method: 'GET',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const data = await resp.json();
            return (data.data && data.data.length > 0) ? data.data[0] : null;
        }

        // TENTATIVES DANS L'ORDRE
        let deal = await findDeal('Potentials', 'Code_Portail');
        if (!deal) deal = await findDeal('Deals', 'Code_Portail');
        if (!deal) deal = await findDeal('Potentials', 'Code_Portail__c');
        if (!deal) deal = await findDeal('Deals', 'Code_Portail__c');

        // 3. SCAN MANUEL DE DERNIER RECOURS (SUR LES DEUX MODULES)
        if (!deal) {
            console.log("Tentative de scan manuel...");
            const listResp = await fetch(`${apiDomain}/crm/v2/Potentials?sort_order=desc&per_page=200`, {
                method: 'GET',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const listData = await listResp.json();
            if (listData.data) {
                deal = listData.data.find(d => 
                    (d.Code_Portail && d.Code_Portail.toString() === cleanCode) ||
                    (d.Code_Portail__c && d.Code_Portail__c.toString() === cleanCode) ||
                    (d.Deal_Name && d.Deal_Name.includes(cleanCode))
                );
            }
        }

        if (!deal) {
            return res.status(404).json({ error: 'Dossier introuvable', debug: `Code: ${cleanCode}` });
        }

        // 4. Mapping Final
        const portalData = {
            firstName: deal.Contact_Name ? deal.Contact_Name.name.split(' ')[0] : "Client",
            code: deal.Code_Portail || deal.Code_Portail__c || deal.id,
            property: deal.Deal_Name || deal.Potential_Name || "Propriété",
            city: deal.Localisation || "En attente d'adresse",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "Analyse",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            timeline: [
                { label: "Préqual.", icon: "💎", status: deal.Financement_approuv ? "completed" : "active" },
                { label: "Recherche", icon: "🔍", status: deal.Stage === "Qualifié" ? "active" : (deal.Stage?.includes("Offre") ? "completed" : "pending") },
                { label: "Offre", icon: "📝", status: deal.Stage?.includes("Offre") ? "active" : (deal.Closing_Date ? "completed" : "pending") },
                { label: "Inspection", icon: "⚙️", status: deal.Date_d_inspection ? (new Date(deal.Date_d_inspection) < new Date() ? "completed" : "active") : "pending" },
                { label: "Notaire", icon: "✒️", status: deal.Closing_Date ? "active" : "pending" }
            ],
            team: [
                { role: "Votre Courtier", name: deal.Owner.name, icon: "👨‍💼", contact: `mailto:${deal.Owner.email}` },
                { role: "Collaborateur", name: deal.Nom_Courtier_Immobilier || "À venir", icon: "🤝", contact: "#" },
                { role: "Courtier Hyp.", name: deal.Nom_Courtier_Hypoth_caire || "À venir", icon: "💰", contact: "#" },
                { role: "Inspecteur", name: deal.Nom_Inspecteur || "À venir", icon: "🔍", contact: "#" },
                { role: "Notaire", name: deal.Nom_Notaire || "À venir", icon: "🖋️", contact: "#" }
            ],
            dates: [
                { label: "Signature du contrat", val: deal.Date_de_la_Signature_du_Contrat || "À venir" },
                { label: "Date limite financement", val: deal.Date_de_financement || "À venir" },
                { label: "Rendez-vous Inspection", val: deal.Date_d_inspection || "À venir" },
                { label: "Date de clôture (Notaire)", val: deal.Closing_Date || "À venir" },
                { label: "Date d'occupation", val: deal.Date_d_occupation || "À venir" }
            ],
            checklist: [
                { name: "Préqualification reçue", done: deal.Financement_approuv || false },
                { name: "Inspection satisfaisante", done: deal.Inspection_satisfaisante || false },
                { name: "Conditions levées", done: deal.Autres_conditions_lev_es || false }
            ]
        };

        return res.status(200).json(portalData);

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
