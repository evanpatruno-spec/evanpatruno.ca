/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.1 - SUPER DIAGNOSTIC)
 * Utilise l'ID direct pour inspecter les permissions de champs
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { codePortal } = req.body;
    const cleanCode = codePortal?.trim().toUpperCase();

    try {
        // 1. Authentification
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN?.trim());
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID?.trim());
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET?.trim());
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho' });

        // 2. MODE DIAGNOSTIC SPECIFIQUE
        // Si on cherche "DIAG", on inspecte le dossier 6466486000011930049
        if (cleanCode === "DIAG") {
            const diagId = "6466486000011930049";
            const resp = await fetch(`${apiDomain}/crm/v2/Potentials/${diagId}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const data = await resp.json();
            const record = data.data ? data.data[0] : null;

            if (!record) return res.status(400).json({ error: "Diagnostic échoué", details: "ID de dossier introuvable." });

            const keys = Object.keys(record).sort().join(', ');
            const codeVal = record.Code_Portail || record.Code_Portail__c || "N/A";
            
            return res.status(400).json({ 
                error: "DIAGNOSTIC REUSSI", 
                details: `Champs trouvés: ${keys} | Valeur Code Portail: ${codeVal}`
            });
        }

        // 3. RECHERCHE NORMALE (Même logique brute force)
        async function findDeal(module) {
            const resp = await fetch(`${apiDomain}/crm/v2/${module}?sort_order=desc&per_page=100`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const listData = await resp.json();
            if (!listData.data) return null;

            return listData.data.find(item => {
                return Object.values(item).some(val => 
                    val && val.toString().toUpperCase() === cleanCode
                );
            });
        }

        let deal = await findDeal('Potentials');
        if (!deal) deal = await findDeal('Deals');

        if (!deal) {
            return res.status(404).json({ 
                error: 'Dossier introuvable',
                details: `Le code ${cleanCode} n'existe dans aucune case des 100 dernières affaires.`
            });
        }

        // 4. Mapping Final
        return res.status(200).json({
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            code: cleanCode,
            property: deal.Deal_Name || deal.Potential_Name || deal.Nom_de_l_Affaire || "Propriété",
            city: deal.Localisation || deal.Ville || "Adresse en attente",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "En cours",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            timeline: [
                { label: "Préqual.", icon: "💎", status: deal.Financement_approuv ? "completed" : "active" },
                { label: "Recherche", icon: "🔍", status: deal.Stage === "Qualifié" ? "active" : (deal.Stage?.includes("Offre") ? "completed" : "pending") },
                { label: "Offre", icon: "📝", status: deal.Stage?.includes("Offre") ? "active" : (deal.Closing_Date ? "completed" : "pending") },
                { label: "Inspection", icon: "⚙️", status: (deal.Date_d_inspection || deal.Date_d_Inspection) ? "completed" : "pending" },
                { label: "Notaire", icon: "✒️", status: deal.Closing_Date ? "active" : "pending" }
            ],
            checklist: [
                { name: "Préqualification reçue", done: deal.Financement_approuv || false },
                { name: "Inspection satisfaisante", done: deal.Inspection_satisfaisante || false },
                { name: "Conditions levées", done: deal.Autres_conditions_lev_es || false }
            ]
        });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
