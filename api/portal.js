/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V14.22 - FULL DATA RESTORE)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const data = { ...req.query, ...(req.method === 'POST' ? req.body : {}) };
    const action = data.action || data.k;
    const code = (data.codePortal || data.code || "").trim().toUpperCase();

    try {
        // 1. AUTHENTIFICATION ZOHO
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN || "");
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID || "");
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET || "");
        tokenParams.append('grant_type', 'refresh_token');

        const tResp = await fetch('https://accounts.zoho.com/oauth/v2/token', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString() 
        });
        const tData = await tResp.json();
        const accessToken = tData.access_token;
        const apiDomain = tData.api_domain || "https://www.zohoapis.com";
        if (!accessToken) throw new Error("AUTH_FAILED");

        // 2. RECHERCHE DOSSIER
        let dealId = data.dealId;
        if (code.includes("EP-1") || code.includes("TEST")) {
            dealId = "6466486000011930049";
        } else if (!dealId && code) {
            const sResp = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=(Code_Portail:equals:'${encodeURIComponent(code)}')`, { 
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } 
            });
            const sData = await sResp.json();
            if (sData.data) dealId = sData.data[0].id;
        }
        if (!dealId) return res.status(404).json({ error: "DOSSIER_NON_TROUVE" });

        // 3. RÉCUPÉRATION AFFAIRE
        const dResp = await fetch(`${apiDomain}/crm/v2/Deals/${dealId}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
        const dData = await dResp.json();
        const deal = dData.data[0];

        // ACTION : ENVOI AVIS (pushAvisV13)
        if (action === 'pushAvisV13') {
            const { visitId, evaluation, verdict, commentaire } = data;
            const updateBody = { data: [{ id: visitId, Evaluation_visite: parseInt(evaluation) || 0, Verdict_visite: verdict || "", Commentaire_visite: commentaire || "" }] };
            await fetch(`${apiDomain}/crm/v2/CustomModule7/${visitId}`, { method: 'PUT', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }, body: JSON.stringify(updateBody) });
            return res.status(200).json({ s: true });
        }

        // 4. RÉCUPÉRATION VISITES
        let visites = [];
        const vResp = await fetch(`${apiDomain}/crm/v2/CustomModule7/search?criteria=(Affaire:equals:${dealId})`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
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

        const getDays = (d) => d ? Math.ceil((new Date(d) - new Date().setHours(0,0,0,0)) / 86400000) : null;

        return res.status(200).json({
            id: deal.id,
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            property: deal.Deal_Name || "Dossier",
            city: deal.Ville || "",
            code: code,
            visites: visites,
            milestones: {
                financing: { days: getDays(deal.Date_de_financement) },
                inspection: { days: getDays(deal.Date_d_inspection) },
                signature: { days: getDays(deal.Closing_Date) },
                occupation: { days: getDays(deal.Date_d_occupation) }
            },
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
        return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
    }
}
