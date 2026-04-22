/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V5.7 - ROYAL PATH)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ON CAPTE LES INFOS (POST OU GET)
    const data = (req.method === 'POST') ? req.body : req.query;
    const { codePortal, action, mlsNumber } = data || {};
    const cleanCode = (codePortal || "").trim().toUpperCase();

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

        // --- OPTION MLS (DÉCLENCHÉE PAR ACTION=requestMLS) ---
        if (action === 'requestMLS' || mlsNumber) {
            let targetId = (cleanCode === "EP-1") ? "6466486000011930049" : null;
            if (!targetId) {
                const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                    method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const sData = await sResp.json();
                if (sData.data) targetId = sData.data[0].id;
            }

            if (targetId && mlsNumber) {
                await fetch(`${apiDomain}/crm/v2/Notes`, {
                    method: 'POST',
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data: [{
                            Parent_Id: targetId,
                            Note_Title: "DEMANDE DOCUMENTS MLS",
                            Note_Content: `MLS: ${mlsNumber}`,
                            se_module: "Potentials"
                        }]
                    })
                });
                return res.status(200).json({ success: true, mode: "MLS_SAVED" });
            }
        }

        // --- CHARGEMENT DASHBOARD (NORMAL) ---
        let deal = null;
        if (cleanCode === "EP-1") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const dData = await rResp.json(); deal = dData.data ? dData.data[0] : null;
        } else {
            const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const sData = await sResp.json();
            if (sData.data) {
                const rResp = await fetch(`${apiDomain}/crm/v2/${sData.data[0].$module}/${sData.data[0].id}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
                const dData = await rResp.json(); deal = dData.data ? dData.data[0] : null;
            }
        }

        if (!deal) return res.status(404).json({ error: 'Dossier introuvable' });

        const fetchP = async (f) => {
            if (!f || !f.id) return null;
            const r = await fetch(`${apiDomain}/crm/v2/Contacts/${f.id}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const d = await r.json(); return d.data ? d.data[0] : null;
        };
        const [n, i, c, cl] = await Promise.all([fetchP(deal.Nom_Notaire), fetchP(deal.Nom_Inspecteur), fetchP(deal.Nom_Courtier_Hypoth_caire), fetchP(deal.Contact_Name)]);

        const team = [{ role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "&#x1f468;&#x200d;&#x1f4bc;", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }];
        const addP = (p, role, icon) => { if(p) team.push({ role, name: p.Full_Name || p.Name, icon, phone: p.Mobile || p.Phone || "À venir", email: p.Email || "À venir", contact: p.Email ? `mailto:${p.Email}` : "#" }); };
        addP(c, "Courtier Hypothécaire", "&#x1f3e6;"); addP(i, "Inspecteur", "🔍"); addP(n, "Notaire", "✒️");

        return res.status(200).json({
            firstName: cl?.First_Name || "Client",
            code: cleanCode,
            property: deal.Deal_Name,
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            milestones: {
                financing: { date: deal.Date_de_financement },
                inspection: { date: deal.Date_d_inspection },
                signature: { date: deal.Closing_Date },
                occupation: { date: deal.Date_d_occupation }
            },
            timeline: [{ label: "Préparation", status: "completed", icon: "&#x1f4cb;" }, { label: "Visites", status: "active", icon: "🔍" }, { label: "Conditions", status: "pending", icon: "&#x1f6e1;&#xfe0f;" }, { label: "Notaire", status: "pending", icon: "&#x2696;&#xfe0f;" }, { label: "Vendu", status: "pending", icon: "&#x1f37e;" }],
            checklist: [{ name: "Financement Approuvé", done: deal.Financement_approuv === "Oui" }, { name: "Inspection complétée", done: deal.Inspection_satisfaisante === "Oui" }, { name: "Conditions de l'offre levées", done: deal.Autres_conditions_lev_es === "Oui" }],
            movingChecklist: [{ name: "Postes Canada", done: false }, { name: "Hydro-Québec", done: false }, { name: "Assurance", done: false }],
            partners: [{ category: "Peinture", name: "Peinture Excellence", icon: "&#x1f3a8;", benefit: "10% off", code: "EP-PROMO" }, { category: "Plomberie", name: "Plombier Pro", icon: "&#x1f6bf;", benefit: "Gratuit", code: "EP-PROMO" }],
            team: team,
            concierge: { smartHome: [], maintenance: [] }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur', details: error.message });
    }
}
