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
            const upResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail`, { 
                method: 'PUT', 
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trigger: ["workflow", "approval", "blueprint"],
                    data: [{ 
                        id: visitId, 
                        Statut: "Terminée",
                        Evaluation_visite: String(evaluation || "0"), 
                        Verdict_visite: verdict || "", 
                        Commentaire_visite: commentaire || "" 
                    }]
                }) 
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
                Date_heure_de_visite: dateTime ? dateTime + ':00+00:00' : null,
                Affaire: { id: dealId },
                Statut: "En attente"
            }] };
            const createResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail`, { 
                method: 'POST', 
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(newVisit) 
            });
            const createData = await createResp.json();
            const createStatus = createData?.data?.[0]?.status;
            if (createStatus === 'success') return res.status(200).json({ s: true });
            return res.status(500).json({ error: "VISIT_CREATE_FAILED", details: JSON.stringify(createData?.data?.[0] || createData).substring(0, 300) });
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

        // --- CHARGEMENT COMPLET DE L'AFFAIRE (pour renderPortal) ---

        // --- ACTIONS SUR LES VISITES ---
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

        // --- LOGIQUE DE TIMELINE DYNAMIQUE (Basée sur le champ TYPE) ---
        const type = (deal.Type || "").toLowerCase();
        const stage = deal.Stage || "";
        const isSeller = type.includes('vente');
        
        let timeline = [];
        if (isSeller) {
            timeline = [
                { label: "Préparation", status: "completed", icon: "📋" },
                { label: "Mise en marché", status: (stage === 'Mise en marché' ? 'active' : (['Visites', 'Offre', 'Condition', 'Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "📢" },
                { label: "Visites", status: (stage === 'Visites' ? 'active' : (['Offre', 'Condition', 'Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "🔍" },
                { label: "Offre", status: (stage.includes('Offre') && !stage.includes('Condition') ? 'active' : (['Condition', 'Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "📄" },
                { label: "Conditions", status: (stage.includes('Condition') ? 'active' : (['Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "⏳" },
                { label: "Notaire", status: (stage.includes('Notaire') ? 'active' : (stage === 'Vendu' ? 'completed' : 'pending')), icon: "🖋️" },
                { label: "Vendu", status: (stage === 'Vendu' ? 'completed' : 'pending'), icon: "✨" }
            ];
        } else {
            timeline = [
                { label: "Préparation", status: "completed", icon: "📋" },
                { label: "Recherche", status: (stage === 'Recherche' ? 'active' : (['Visites', 'Offre', 'Condition', 'Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "🏠" },
                { label: "Visites", status: (stage === 'Visites' ? 'active' : (['Offre', 'Condition', 'Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "🔍" },
                { label: "Offre", status: (stage.includes('Offre') && !stage.includes('Condition') ? 'active' : (['Condition', 'Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "📄" },
                { label: "Conditions", status: (stage.includes('Condition') ? 'active' : (['Notaire', 'Vendu'].some(s => stage.includes(s)) ? 'completed' : 'pending')), icon: "⏳" },
                { label: "Notaire", status: (stage.includes('Notaire') ? 'active' : (stage === 'Vendu' ? 'completed' : 'pending')), icon: "🖋️" },
                { label: "Vendu", status: (stage === 'Vendu' ? 'completed' : 'pending'), icon: "✨" }
            ];
        }

        // --- CHARGEMENT DES PARTENAIRES ---
        let partnersList = [];
        try {
            // On récupère tout (incluant contact, email, tel et site web)
            const pResp = await fetch(`${apiDomain}/crm/v2/Partenaires_Portail?fields=Name,Service,Icone,Avantage_Exclusif,Badge_Promo,Afficher_Portail,Ordre_Affichage,Email,Telephone,Contact_Lie,Site_Web`, { headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const pData = await pResp.json();
            if (pData.data) {
                partnersList = pData.data
                    .filter(p => p.Afficher_Portail === true)
                    .sort((a, b) => (Number(a.Ordre_Affichage) || 99) - (Number(b.Ordre_Affichage) || 99))
                    .map(p => {
                        const category = p.Service || "Partenaire";
                        const iconMap = {
                            "Peintre": "🎨",
                            "Inspecteur": "🔍",
                            "Électric": "⚡",
                            "Notaire": "🖋️",
                            "Banque": "🏦",
                            "Hypothécaire": "🏦",
                            "Plombier": "🔧",
                            "Nettoyage": "🧼"
                        };
                        const icon = (p.Icone && p.Icone !== "?" ? p.Icone : (iconMap[category] || iconMap[Object.keys(iconMap).find(k => category.includes(k))] || "🤝"));
                        return {
                            category: category,
                            name: p.Name || "Expert",
                            icon: icon,
                            benefit: p.Avantage_Exclusif || "",
                            isPromo: !!p.Badge_Promo,
                            contactName: p.Contact_Lie?.name || "",
                            email: p.Email || "",
                            phone: p.Telephone || "",
                            website: p.Site_Web || ""
                        };
                    });
            }
        } catch(e) { console.error("Error fetching partners:", e); }

        return res.status(200).json({
            id: deal.id,
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            property: deal.Deal_Name || "Dossier",
            city: deal.Ville || "",
            code: code,
            pipeline: deal.Pipeline || (isSeller ? "Vente" : "Achat"),
            type: deal.Type || "",
            visites: visites,
            milestones: {
                financing: { days: getDays(deal.Date_de_financement), done: !!deal.Financement_approuv },
                inspection: { days: getDays(deal.Date_d_inspection), done: !!deal.Inspection_satisfaisante },
                others: { days: getDays(deal.Date_autres_conditions), done: !!deal.Autres_conditions_lev_es },
                signature: { days: getDays(deal.Closing_Date), done: getDays(deal.Closing_Date) < 0 },
                occupation: { days: getDays(deal.Date_d_occupation), done: getDays(deal.Date_d_occupation) < 0 }
            },
            timeline: timeline,
            checklist: [
                { name: "Financement", done: !!deal.Financement_approuv },
                { name: "Inspection", done: !!deal.Inspection_satisfaisante },
                { name: "Conditions levées", done: !!deal.Autres_conditions_lev_es }
            ],
            team: team,
            partners: partnersList,
            concierge: { resources: [{ title: "Tout sur le CELIAPP →", url: "#" }, { title: "Régime d'Accès à la Propriété (RAP) →", url: "#" }] }
        });

    } catch (err) {
        return res.status(500).json({ error: "SERVER_ERROR", details: err.message });
    }
}
