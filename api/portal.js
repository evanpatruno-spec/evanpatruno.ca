/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.10 - LOOKUP DISCOVERER)
 * Découvre les lookups (Notaire, Inspecteur) pour le mapping final
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

        // MODE DIAGNOSTIC DES LIENS (LOOKUPS)
        if (cleanCode === "DIAG") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            const deal = dData.data ? dData.data[0] : null;

            if (!deal) return res.status(404).json({ error: "Dossier invisible" });

            // On liste TOUTES les clés, y compris les objets (Lookups)
            const allKeys = Object.keys(deal);
            const lookups = allKeys.filter(k => typeof deal[k] === 'object' && deal[k] !== null);
            
            return res.status(400).json({ 
                error: "DÉCOUVERTE LOOKUPS", 
                details: `Lookups (Pro) trouvés: ${lookups.join(', ')}` 
            });
        }

        // AUTO-MAPPING TEMPORAIRE
        return res.status(404).json({ error: 'Faites DIAG pour voir les pros' });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur', details: error.message });
    }
}
