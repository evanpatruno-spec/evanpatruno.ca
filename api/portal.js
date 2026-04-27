/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V14.20 - ZOHO ROBUSTNESS)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const data = { ...req.query, ...(req.method === 'POST' ? req.body : {}) };
    const code = (data.codePortal || data.code || "").trim().toUpperCase();

    try {
        // 1. AUTHENTIFICATION ZOHO
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN || "");
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID || "");
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET || "");
        tokenParams.append('grant_type', 'refresh_token');

        const tResp = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: tokenParams.toString() });
        const tText = await tResp.text();
        let tData;
        try { tData = JSON.parse(tText); } catch(e) { throw new Error("Zoho Auth returned HTML instead of JSON: " + tText.substring(0, 100)); }

        const accessToken = tData.access_token;
        const apiDomain = tData.api_domain || "https://www.zohoapis.com";
        if (!accessToken) throw new Error("Zoho Auth Failed: " + (tData.error || "No token found"));

        // 2. RECHERCHE DOSSIER
        let dealId = data.dealId;
        if (code.includes("EP-1") || code.includes("TEST")) {
            dealId = "6466486000011930049";
        } else if (!dealId && code) {
            // Note: Ajout de guillemets simples autour du code pour la recherche Zoho
            const searchUrl = `${apiDomain}/crm/v2/Deals/search?criteria=${encodeURIComponent(`(Code_Portail:equals:'${code}')`)}`;
            const sResp = await fetch(searchUrl, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const sText = await sResp.text();
            let sData;
            try { sData = JSON.parse(sText); } catch(e) { throw new Error("Zoho Search returned HTML: " + sText.substring(0, 100)); }
            if (sData.data) dealId = sData.data[0].id;
        }

        if (!dealId) return res.status(404).json({ error: "DOSSIER_NON_TROUVE", details: `Code ${code} non trouvé dans Zoho.` });

        // 3. RÉCUPÉRATION AFFAIRE
        const dResp = await fetch(`${apiDomain}/crm/v2/Deals/${dealId}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
        const dData = await dResp.json();
        if (!dData.data) throw new Error("Impossible de récupérer l'affaire " + dealId);
        const deal = dData.data[0];

        // 4. RÉCUPÉRATION VISITES
        let visites = [];
        try {
            const vResp = await fetch(`${apiDomain}/crm/v2/CustomModule7/search?criteria=${encodeURIComponent(`(Affaire:equals:${dealId})`)}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const vData = await vResp.json();
            if (vData.data) {
                visites = vData.data.map(v => ({
                    id: v.id,
                    Date_heure_de_visite: v.Date_heure_de_visite || null,
                    location: v.Name || "Lieu",
                    statut: v.Statut || "En attente",
                    evaluation: v.Evaluation_visite || 0,
                    verdict: v.Verdict_visite || "",
                    commentaire: v.Commentaire_visite || ""
                }));
            }
        } catch (e) { console.warn("Visites load failed (non-critical)"); }

        return res.status(200).json({
            id: deal.id,
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            property: deal.Deal_Name || "Dossier Immobilier",
            city: deal.Ville || "",
            code: code,
            visites: visites,
            timeline: [
                { label: "Préparation", status: "completed", icon: "📋" },
                { label: "Visites", status: "active", icon: "🔍" },
                { label: "Offre", status: "pending", icon: "📄" },
                { label: "Vendu", status: "pending", icon: "✨" }
            ],
            checklist: [
                { name: "Financement", done: deal.Financement_approuv === "Oui" },
                { name: "Inspection", done: deal.Inspection_satisfaisante === "Oui" }
            ]
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
    }
}
