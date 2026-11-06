/**
 * API DÉDIÉE : SUPPORT TECHNIQUE / MLS (SÉCURISÉE PAR CODE PORTAIL + 4 CHIFFRES TÉL.)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const data = { ...req.query, ...(req.method === 'POST' ? req.body : {}) };
    const m = String(data.m || data.mlsNumber || "").trim();
    const rawCode = String(data.c || data.codePortal || "").trim().toUpperCase();
    const cleanCode = rawCode.replace(/[^A-Z0-9_-]/g, '');
    const phoneLast4 = String(data.p || data.phoneLast4 || data.phone || "").replace(/\D/g, '').slice(-4);

    if (!m) return res.status(200).json({ status: "ready" });
    if (!cleanCode) return res.status(400).json({ error: "Code portail requis" });

    try {
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN?.trim() || "");
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID?.trim() || "");
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET?.trim() || "");
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Auth failed' });

        let dealId = (cleanCode === "EP-1" || cleanCode === "TEST") ? "6466486000011930049" : null;
        let dealRecord = null;
        if (!dealId) {
            const sResp = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=(Code_Portail:equals:${encodeURIComponent(cleanCode)})`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const sData = await sResp.json();
            if (sData.data && sData.data[0]) {
                dealRecord = sData.data[0];
                dealId = dealRecord.id;
            }
        }

        if (!dealId) return res.status(404).json({ error: "Not found" });

        // Vérification obligatoire des 4 derniers chiffres du téléphone (sauf démo EP-1/TEST)
        if (cleanCode !== "EP-1" && cleanCode !== "TEST") {
            const linkedContactId = dealRecord?.Contact_Name?.id;
            if (linkedContactId) {
                const cResp = await fetch(`${apiDomain}/crm/v2/Contacts/${linkedContactId}`, {
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const cData = await cResp.json();
                const contactObj = cData.data?.[0];
                const candidatePhones = [contactObj?.Mobile, contactObj?.Phone, contactObj?.Home_Phone, contactObj?.Other_Phone]
                    .filter(Boolean)
                    .map(p => String(p).replace(/\D/g, '').slice(-4))
                    .filter(p => p.length === 4);

                if (candidatePhones.length > 0 && (!phoneLast4 || !candidatePhones.includes(phoneLast4))) {
                    return res.status(403).json({ error: "Vérification téléphone échouée." });
                }
            } else if (!phoneLast4) {
                return res.status(403).json({ error: "Vérification téléphone requise." });
            }
        }

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
    } catch (e) {
        return res.status(500).json({ error: "Error", details: e.message });
    }
}
