/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V14.16 - DEBUG MODE)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    const data = { ...req.query, ...(req.method === 'POST' ? req.body : {}) };
    const action = data.action || data.k;
    const code = data.codePortal || data.c || data.code;
    const cleanCode = (code || "").trim().toUpperCase();

    try {
        const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();
        const clientId = process.env.ZOHO_CLIENT_ID?.trim();
        const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();

        if (!refreshToken || !clientId || !clientSecret) throw new Error("Missing Zoho Config (Env Vars)");

        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', refreshToken);
        tokenParams.append('client_id', clientId);
        tokenParams.append('client_secret', clientSecret);
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: tokenParams.toString() });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) throw new Error("Zoho Auth Failed: " + (tokenData.error || "No Token"));

        let dealId = data.dealId || null; 
        if (dealId === "null" || dealId === "undefined") dealId = null;

        // RECHERCHE DE L'AFFAIRE
        if (cleanCode.includes("EP-1") || cleanCode.includes("TEST")) {
            dealId = "6466486000011930049"; 
        } else if (!dealId && cleanCode) {
            const sResp = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=${encodeURIComponent(`(Code_Portail:equals:${cleanCode})`)}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const sData = await sResp.json();
            if (sData.data && sData.data.length > 0) dealId = sData.data[0].id;
        }

        if (!dealId) {
            return res.status(404).json({ error: `Dossier introuvable pour le code ${cleanCode}` });
        }
        
        // RECUPERATION AFFAIRE
        const fullResp = await fetch(`${apiDomain}/crm/v2/Deals/${dealId}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
        const fullData = await fullResp.json();
        if (!fullData.data) throw new Error("Deal not found in Zoho for ID " + dealId);
        const deal = fullData.data[0];

        // --- ACTIONS SPÉCIFIQUES ---
        if (action === 'pushAvisV13') {
            const { visitId, evaluation, verdict, commentaire } = data;
            const updateBody = { data: [{ id: visitId, Evaluation_visite: parseInt(evaluation) || 0, Verdict_visite: verdict || "", Commentaire_visite: commentaire || "" }] };
            const upResp = await fetch(`${apiDomain}/crm/v2/CustomModule7/${visitId}`, { method: 'PUT', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }, body: JSON.stringify(updateBody) });
            return res.status(200).json({ s: true });
        }

        // RÉCUPÉRATION DES VISITES (SECURISÉE)
        let visites = [];
        try {
            const vResp = await fetch(`${apiDomain}/crm/v2/CustomModule7/search?criteria=${encodeURIComponent(`(Affaire:equals:${dealId})`)}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
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
        } catch (e) { console.warn("Visites Error:", e.message); }

        // CONSTRUCTION RÉPONSE FINALE
        const payload = {
            id: deal.id,
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            property: deal.Deal_Name || "Propriété",
            city: deal.Ville || "",
            code: cleanCode,
            milestones: {
                financing: { days: 0 }, inspection: { days: 0 }, signature: { days: 0 }, occupation: { days: 0 }
            },
            visites: visites,
            timeline: deal.Timeline_Data || [
                { label: "Préparation", status: "completed", icon: "📋" },
                { label: "Visites", status: "active", icon: "🔍" },
                { label: "Conditions", status: "pending", icon: "📄" },
                { label: "Vendu", status: "pending", icon: "✨" }
            ],
            checklist: [
                { name: "Financement", done: deal.Financement_approuv === "Oui" },
                { name: "Inspection", done: deal.Inspection_satisfaisante === "Oui" }
            ]
        };

        return res.status(200).json(payload);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
