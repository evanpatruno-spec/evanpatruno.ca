/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V14.24 - FIX VISITS SEARCH)
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
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN || "");
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID || "");
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET || "");
        tokenParams.append('grant_type', 'refresh_token');

        const tResp = await fetch('https://accounts.zoho.com/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: tokenParams.toString() });
        const tData = await tResp.json();
        const accessToken = tData.access_token;
        const apiDomain = tData.api_domain || "https://www.zohoapis.com";
        if (!accessToken) throw new Error("AUTH_FAILED: " + JSON.stringify(tData).substring(0, 150));

        let dealId = data.dealId;
        if (code.includes("EP-1") || code.includes("TEST")) {
            dealId = "6466486000011930049";
        } else if (!dealId && code) {
            const sResp = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=(Code_Portail:equals:'${encodeURIComponent(code)}')`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const sData = await sResp.json();
            if (sData.data) dealId = sData.data[0].id;
        }
        if (!dealId) return res.status(404).json({ error: "DOSSIER_NON_TROUVE" });

        // --- ACTIONS LÉGÈRES (sans chargement complet de l'affaire) ---
        if (action === 'pushAvisV13') {
            const { visitId, evaluation, verdict, commentaire } = data;
            const updateBody = { data: [{ 
                id: visitId, 
                Evaluation_visite: parseInt(evaluation) || 0, 
                Verdict_visite: verdict || "", 
                Commentaire_visite: commentaire || "" 
            }] };
            const upResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail`, { 
                method: 'PUT', 
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(updateBody) 
            });
            // Zoho retourne TOUJOURS 200 - il faut lire le corps JSON pour savoir si c'est un succès
            const upData = await upResp.json();
            const status = upData?.data?.[0]?.status;
            const zohoCode = upData?.data?.[0]?.code;
            if (status === 'success') {
                return res.status(200).json({ s: true });
            } else {
                // Renvoyer le code d'erreur Zoho exact pour diagnostic
                return res.status(500).json({ 
                    error: "ZOHO_UPDATE_FAILED", 
                    zohoCode: zohoCode,
                    details: JSON.stringify(upData?.data?.[0] || upData).substring(0, 300)
                });
            }
        }

        if (action === 'requestVisit') {
            const { location, dateTime } = data;
            const newVisit = { data: [{ 
                Name: location || "Visite à planifier",
                Date_heure_de_visite: dateTime ? new Date(dateTime).toISOString().replace('T', ' ').substring(0, 19) : null,
                Affaire: { id: dealId },
                Statut: "En attente"
            }] };
            const createResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail`, { 
                method: 'POST', 
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(newVisit) 
            });
            if (createResp.ok) return res.status(200).json({ s: true });
            const cErr = await createResp.text();
            return res.status(500).json({ error: "VISIT_CREATE_FAILED", details: cErr.substring(0, 200) });
        }

        if (action === 'requestMLS') {
            const { mlsNumber } = data;
            const body = { data: [{ 
                Name: `Demande doc MLS ${mlsNumber || ""}`,
                Type_interaction: "Demande de document",
                Num_ro_MLS: mlsNumber || "",
                Affaire: { id: dealId },
                Statut: "Nouveau"
            }] };
            const r = await fetch(`${apiDomain}/crm/v2/Interactions_Portail`, { 
                method: 'POST', 
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (r.ok) return res.status(200).json({ s: true });
            const e = await r.text();
            return res.status(500).json({ error: "MLS_FAILED", details: e.substring(0, 200) });
        }

        // --- CHARGEMENT COMPLET DE L'AFFAIRE (pour renderPortal) ---
        const dResp = await fetch(`${apiDomain}/crm/v2/Deals/${dealId}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
        const dData = await dResp.json();
        const deal = dData.data[0];

        // --- DEBUG: LISTE DES MODULES ---
        if (action === 'listModules') {
            const mResp = await fetch(`${apiDomain}/crm/v2/settings/modules`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const mData = await mResp.json();
            const modules = (mData.modules || []).map(m => ({ api_name: m.api_name, singular_label: m.singular_label, plural_label: m.plural_label }));
            return res.status(200).json({ modules });
        }

        // --- DEBUG: INSPECTER UN ENREGISTREMENT RÉEL ---
        if (action === 'getRecord') {
            const { visitId } = data;
            if (!visitId) {
                // Retourner la première visite trouvée
                const vResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail?per_page=1`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
                const vData = await vResp.json();
                return res.status(200).json({ record: vData.data ? vData.data[0] : null });
            }
            const rResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail/${visitId}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const rData = await rResp.json();
            return res.status(200).json({ record: rData.data ? rData.data[0] : null });
        }

        let visites = [];
        const trySearch = async (module, crit) => {
            try {
                const r = await fetch(`${apiDomain}/crm/v2/${module}/search?criteria=${encodeURIComponent(crit)}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
                const d = await r.json(); return d.data || null;
            } catch(e) { return null; }
        };

        // Stratégie 1 & 2 & 3: Recherche directe
        let vData = await trySearch("Visites_Portail", `(Affaire:equals:${dealId})`);
        if (!vData) vData = await trySearch("Visites_Portail", `(Affaire:equals:'${dealId}')`);
        if (!vData) vData = await trySearch("Visites_Portail", `(Affaire:equals:${dealId})`);

        // Stratégie 4: Fallback large - On prend les 200 dernières et on filtre en JS
        if (!vData) {
            try {
                const r = await fetch(`${apiDomain}/crm/v2/Visites_Portail?sort_by=Created_Time&sort_order=desc`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
                const d = await r.json();
                if (d.data) {
                    vData = d.data.filter(v => v.Affaire && (v.Affaire.id === dealId || v.Affaire.name === deal.Deal_Name));
                }
            } catch(e) {}
        }

        if (vData) {
            visites = vData.map(v => ({
                id: v.id,
                Date_heure_de_visite: v.Date_heure_de_visite || null,
                location: v.Name || "Lieu",
                statut: v.Statut || "En attente",
                evaluation: v.Evaluation_visite || 0,
                verdict: v.Verdict_visite || "",
                commentaire: v.Commentaire_visite || ""
            }));
        }

        const fetchP = async (f) => {
            if (!f || !f.id) return null;
            try {
                const r = await fetch(`${apiDomain}/crm/v2/Contacts/${f.id}`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
                const d = await r.json(); return d.data ? d.data[0] : null;
            } catch(e) { return null; }
        };

        const [notaire, inspecteur, courtier] = await Promise.all([
            fetchP(deal.Nom_Notaire), fetchP(deal.Nom_Inspecteur), fetchP(deal.Nom_Courtier_Hypoth_caire)
        ]);

        const team = [{ role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "👨‍💼", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }];
        const addP = (p, role, icon) => { if(p) team.push({ role, name: p.Full_Name || p.Name, icon, phone: p.Mobile || p.Phone || "À venir", email: p.Email || "À venir", contact: p.Email ? `mailto:${p.Email}` : "#" }); };
        addP(courtier, "Courtier Hypothécaire", "🏦"); addP(inspecteur, "Inspecteur", "🔍"); addP(notaire, "Notaire", "✒️");

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
                { name: "Inspection", done: deal.Inspection_satisfaisante === "Oui" },
                { name: "Conditions levées", done: deal.Autres_conditions_lev_es === "Oui" }
            ],
            team: team,
            partners: [
                { category: "Peinture", name: "Peinture Excellence", icon: "🎨", benefit: "10% de rabais", code: "EP-PROMO" },
                { category: "Plomberie", name: "Plombier Pro", icon: "🚿", benefit: "Estimation gratuite", code: "EP-PROMO" },
                { category: "Électricité", name: "Électricien Élite", icon: "⚡", benefit: "-15% main d'œuvre", code: "EP-PROMO" }
            ],
            concierge: { resources: [{ title: "Tout sur le CELIAPP →", url: "#" }, { title: "Régime d'Accès à la Propriété (RAP) →", url: "#" }] }
        });

    } catch (err) {
        return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
    }
}
