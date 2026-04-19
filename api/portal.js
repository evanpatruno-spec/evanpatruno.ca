/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.6 - IDENTITY CHECK)
 * Vérifie l'organisation et l'utilisateur connectés
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
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho', details: tokenData });

        // 2. MODE DIAGNOSTIC IDENTITÉ
        if (cleanCode === "DIAG") {
            const orgResp = await fetch(`${apiDomain}/crm/v2/org`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const orgData = await orgResp.json();
            
            const userResp = await fetch(`${apiDomain}/crm/v2/users?type=CurrentUser`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const userData = await userResp.json();

            const orgId = orgData.org ? orgData.org[0].zorg_id : "Inconnu";
            const userEmail = userData.users ? userData.users[0].email : "Inconnu";

            return res.status(400).json({ 
                error: "IDENTITÉ DU PONT", 
                details: `Organisation connectée: ${orgId} | Utilisateur: ${userEmail} | Domaine: ${apiDomain}` 
            });
        }

        // 3. RECHERCHE (Standard Search fallback)
        const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const sData = await sResp.json();

        if (sData.data && sData.data.length > 0) {
            return res.status(200).json({ firstName: "Trouvé", code: cleanCode, property: "Dossier Validé", timeline: [], team: [], dates: [], checklist: [] });
        }

        return res.status(404).json({ error: 'Dossier introuvable' });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Fatale', details: error.message });
    }
}
