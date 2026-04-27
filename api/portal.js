/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V14.14 - FIX FEEDBACK & TIME)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    res.setHeader('X-API-Version', '14.14');

    const data = { ...req.query, ...(req.method === 'POST' ? req.body : {}) };
    const action = data.action || data.k;
    const mls = data.mlsNumber || data.v;
    const code = data.codePortal || data.c || data.code;
    const cleanCode = (code || "").trim().toUpperCase();

    try {
        const refreshToken = process.env.ZOHO_REFRESH_TOKEN?.trim();
        const clientId = process.env.ZOHO_CLIENT_ID?.trim();
        const clientSecret = process.env.ZOHO_CLIENT_SECRET?.trim();

        if (!refreshToken || !clientId || !clientSecret) return res.status(500).json({ error: 'CONFIG_MISSING' });

        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', refreshToken);
        tokenParams.append('client_id', clientId);
        tokenParams.append('client_secret', clientSecret);
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', body: tokenParams.toString() });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'AUTH_FAILED' });

        let dealId = data.dealId || null; 
        if (dealId === "null" || dealId === "undefined") dealId = null;
        let moduleName = "Deals";

        // RECHERCHE DE L'AFFAIRE
        if (cleanCode.includes("EP-1") || cleanCode.includes("TEST")) {
            dealId = "6466486000011930049"; 
        } else if (!dealId && cleanCode) {
            const sResp = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=${encodeURIComponent(`(Code_Portail:equals:${cleanCode})`)}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const sData = await sResp.json();
            if (sData.data) dealId = sData.data[0].id;
        }

        if (!dealId) return res.status(404).json({ error: 'DEAL_NOT_FOUND' });
        
        // RECUPERATION AFFAIRE
        const fullResp = await fetch(`${apiDomain}/crm/v2/Deals/${dealId}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
        const fullData = await fullResp.json();
        const deal = fullData.data ? fullData.data[0] : null;
        if (!deal) return res.status(404).json({ error: 'DEAL_NOT_FOUND' });

        // ACTION : ENVOI AVIS (pushAvisV13)
        if (action === 'pushAvisV13') {
            const { visitId, evaluation, verdict, commentaire } = data;
            if (!visitId) return res.status(400).json({ error: 'VISIT_ID_MISSING' });

            console.log(`Syncing feedback for Visit ${visitId}...`);
            const updateBody = {
                data: [{
                    id: visitId,
                    Evaluation_visite: parseInt(evaluation) || 0,
                    Verdict_visite: verdict || "",
                    Commentaire_visite: commentaire || ""
                }]
            };

            // On utilise CustomModule7 (vu dans l'URL de l'utilisateur)
            const upResp = await fetch(`${apiDomain}/crm/v2/CustomModule7/${visitId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody)
            });
            const upData = await upResp.json();
            console.log("Zoho PUT Result:", JSON.stringify(upData));
            
            if (upData.data && upData.data[0].status === 'success') {
                return res.status(200).json({ s: true });
            } else {
                // Fallback : essayer avec le nom de module label si l'ID technique échoue
                const fallbackResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail/${visitId}`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(updateBody)
                });
                const fallbackData = await fallbackResp.json();
                if (fallbackData.data && fallbackData.data[0].status === 'success') return res.status(200).json({ s: true });
                
                return res.status(500).json({ error: 'UPDATE_FAILED', details: fallbackData });
            }
        }

        // ACTION : DEMANDE MLS
        if ((action === 'mls' || action === 'requestMLS') && mls) {
            const crmData = { data: [{ Name: `Demande MLS ${mls}`, Num_ro_MLS: mls, Code_Portail: cleanCode, Affaire: dealId }], trigger: ["workflow"] };
            await fetch(`${apiDomain}/crm/v2/Interactions_Portail`, { method: 'POST', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(crmData) });
            return res.status(200).json({ s: true });
        }

        // ACTION : DEMANDE VISITE
        if (action === 'requestVisit' && data.location) {
            const vDT = data.dateTime || data.Date_heure_de_visite || "";
            const visitRecord = { data: [{ Name: data.location, Statut: "En attente", Date_heure_de_visite: vDT.includes('T') && vDT.length === 16 ? vDT + ":00" : vDT, Affaire: { id: dealId } }], trigger: ["workflow"] };
            await fetch(`${apiDomain}/crm/v2/CustomModule7`, { method: 'POST', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(visitRecord) });
            return res.status(200).json({ s: true });
        }

        // RÉCUPÉRATION DES VISITES POUR LE PORTAIL
        let visites = [];
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

        // DATA RESPONSE
        return res.status(200).json({
            id: deal.id,
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            property: deal.Deal_Name,
            city: deal.Ville || "",
            code: cleanCode,
            milestones: {
                financing: { days: Math.ceil((new Date(deal.Date_de_financement) - new Date()) / 86400000) || 0 },
                inspection: { days: Math.ceil((new Date(deal.Date_d_inspection) - new Date()) / 86400000) || 0 },
                signature: { days: Math.ceil((new Date(deal.Closing_Date) - new Date()) / 86400000) || 0 },
                occupation: { days: Math.ceil((new Date(deal.Date_d_occupation) - new Date()) / 86400000) || 0 }
            },
            visites: visites,
            timeline: [
                { label: "Préparation", status: "completed", icon: "📋" },
                { label: "Visites", status: "active", icon: "🔍" },
                { label: "Offre", status: "pending", icon: "📄" },
                { label: "Notaire", status: "pending", icon: "⚖️" }
            ],
            checklist: [
                { name: "Financement", done: deal.Financement_approuv === "Oui" },
                { name: "Inspection", done: deal.Inspection_satisfaisante === "Oui" }
            ]
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: 'GLOBAL_ERROR', details: error.message });
    }
}
