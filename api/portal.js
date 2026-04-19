/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.9 - FIELD DISCOVERER)
 * Découvre tous les noms de champs réels pour finaliser le mapping
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

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth' });

        // 2. MODE DÉCOUVERTE
        if (cleanCode === "DIAG") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            const deal = dData.data ? dData.data[0] : null;

            if (!deal) return res.status(404).json({ error: "Dossier invisible" });

            // On liste tous les noms de champs qui contiennent une valeur
            const fieldNames = Object.keys(deal).filter(k => deal[k] !== null && typeof deal[k] !== 'object');
            
            return res.status(400).json({ 
                error: "DÉCOUVERTE DE CHAMPS", 
                details: `Champs trouvés: ${fieldNames.join(', ')}` 
            });
        }

        // 3. RECHERCHE ET AFFICHAGE (Version temporaire avant mapping final)
        const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const sData = await sResp.json();
        let deal = null;

        if (sData.data && sData.data.length > 0) {
            const found = sData.data[0];
            const rResp = await fetch(`${apiDomain}/crm/v2/${found.$module}/${found.id}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data[0];
        } else if (cleanCode === "EP-1") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        }

        if (!deal) return res.status(404).json({ error: 'Introuvable' });

        return res.status(200).json({
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            code: cleanCode,
            property: deal.Deal_Name || "Dossier Immobilier",
            city: deal.Ville || "Adresse en cours...",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "Actif",
            image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=400",
            timeline: [], team: [], dates: [], checklist: []
        });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur', details: error.message });
    }
}
