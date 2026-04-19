/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.2 - MODULE & DOMAIN DIAGNOSTIC)
 * Identifie le domaine API et la liste des modules disponibles
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

        // 2. MODE DIAGNOSTIC STRUCTUREL
        if (cleanCode === "DIAG") {
            // On demande la liste des modules pour voir les noms réels
            const resp = await fetch(`${apiDomain}/crm/v2/settings/modules`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const data = await resp.json();
            
            if (!data.modules) {
                return res.status(400).json({ 
                    error: "Échec Diagnostic Modules", 
                    details: `Domaine: ${apiDomain} | Erreur: ${JSON.stringify(data)}` 
                });
            }

            const moduleNames = data.modules.map(m => m.api_name).sort().join(', ');
            
            return res.status(400).json({ 
                error: "Détails de la structure Zoho", 
                details: `Domaine API: ${apiDomain} | Modules trouvés: ${moduleNames}`
            });
        }

        // 3. RECHERCHE NORMALE (Même logique brute force value)
        async function findDeal(module) {
            try {
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
            } catch(e) { return null; }
        }

        let deal = await findDeal('Potentials');
        if (!deal) deal = await findDeal('Deals');

        if (!deal) {
            return res.status(404).json({ error: 'Dossier introuvable' });
        }

        // ... (Mapping normal simplifié pour le test)
        return res.status(200).json({
            firstName: "Client",
            code: cleanCode,
            property: deal.Deal_Name || deal.Potential_Name || "Propriété",
            city: deal.Ville || "Adresse",
            price: "---",
            stage: deal.Stage || "En cours",
            image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            timeline: [], team: [], dates: [], checklist: []
        });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
