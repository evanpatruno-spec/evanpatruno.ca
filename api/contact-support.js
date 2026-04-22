/**
 * API DÉDIÉE : SUPPORT TECHNIQUE / MLS (BYPASS 405)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // On accepte les paramètres dans l'URL (GET) pour bypasser tout blocage
    const { m, c } = req.query; // m = mlsNumber, c = codePortal
    const cleanCode = (c || "").trim().toUpperCase();

    if (!m) return res.status(200).json({ status: "ready" });

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

        if (!accessToken) return res.status(401).json({ error: 'Auth failed' });

        let dealId = (cleanCode === "EP-1") ? "6466486000011930049" : null;
        if (!dealId) {
            const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const sData = await sResp.json();
            if (sData.data) dealId = sData.data[0].id;
        }

        if (dealId) {
            await fetch(`${apiDomain}/crm/v2/Notes`, {
                method: 'POST',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [{
                        Parent_Id: dealId,
                        Note_Title: "DEMANDE DOCUMENTS MLS (PORTAIL)",
                        Note_Content: `MLS: ${m}`,
                        se_module: "Potentials"
                    }]
                })
            });
            return res.status(200).json({ success: true });
        } else {
            return res.status(404).json({ error: "Not found" });
        }
    } catch (e) {
        return res.status(500).json({ error: "Error", details: e.message });
    }
}
