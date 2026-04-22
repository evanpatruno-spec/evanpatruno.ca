/**
 * API DÉDIÉE : DEMANDE DOCUMENTS MLS
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

    const { mlsNumber, codePortal } = req.body || {};
    const cleanCode = (codePortal || "").trim().toUpperCase();

    if (!mlsNumber) return res.status(400).json({ error: "Numéro MLS manquant" });

    try {
        // --- AUTH ZOHO ---
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

        if (!accessToken) return res.status(401).json({ error: 'Auth failed' });

        // --- TROUVER L'ID ---
        let targetId = (cleanCode === "EP-1") ? "6466486000011930049" : null;
        if (!targetId) {
            const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const sData = await sResp.json();
            if (sData.data) targetId = sData.data[0].id;
        }

        if (targetId) {
            // --- CRÉER LA NOTE ---
            const nResp = await fetch(`${apiDomain}/crm/v2/Notes`, {
                method: 'POST',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [{
                        Parent_Id: targetId,
                        Note_Title: "DEMANDE DOCUMENTS MLS (Portail)",
                        Note_Content: `Le client a demandé la documentation pour le numéro MLS : ${mlsNumber}.`,
                        se_module: "Potentials"
                    }]
                })
            });
            const nData = await nResp.json();
            return res.status(200).json({ success: true, zoho: nData });
        } else {
            return res.status(404).json({ error: "Dossier non trouvé" });
        }
    } catch (e) {
        return res.status(500).json({ error: "Erreur", details: e.message });
    }
}
