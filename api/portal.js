/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V7.0 - ULTRA-ROBUST SEARCH)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const data = (req.method === 'POST') ? req.body : req.query;
    const code = data.c || data.codePortal || data.code;
    const action = data.k || data.action;
    const mls = data.v || data.mlsNumber;
    const cleanCode = (code || "").trim().toUpperCase();

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

        // --- RECHERCHE DU DOSSIER (MULTI-MÉTHODE) ---
        let dealId = null;
        let moduleName = "Deals";

        if (cleanCode === "EP-1") {
            dealId = "6466486000011930049";
        } else if (cleanCode) {
            // Méthode 1 : Recherche globale (la plus souple)
            const gResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const gData = await gResp.json();
            
            if (gData.data) {
                dealId = gData.data[0].id;
                moduleName = gData.data[0].$module;
            } else {
                // Méthode 2 : Recherche par critère (si la globale échoue)
                const sResp = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=${encodeURIComponent(`(Code_Portail:equals:${cleanCode})`)}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
                const sData = await sResp.json();
                if (sData.data) dealId = sData.data[0].id;
            }
        }

        if (!dealId) return res.status(404).json({ error: 'Dossier introuvable' });
        
        // RÉCUPÉRATION DE LA FICHE COMPLÈTE (Avec demande explicite du contact)
        const fullResp = await fetch(`${apiDomain}/crm/v2/${moduleName}/${dealId}`, { 
            method: 'GET', 
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } 
        });
        const fullData = await fullResp.json();
        const deal = fullData.data ? fullData.data[0] : null;

        if (!deal) return res.status(404).json({ error: 'Erreur lors de la lecture du dossier' });

        // --- IDENTIFICATION DES CONTACTS (MULTI-CONTACT) ---
        const fetchP = async (f) => {
            if (!f || !f.id) return null;
            const r = await fetch(`${apiDomain}/crm/v2/Contacts/${f.id}`, { method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` } });
            const d = await r.json(); return d.data ? d.data[0] : null;
        };

        const [contact1, contact2] = await Promise.all([
            fetchP(deal.Contact_Name),
            fetchP(deal.Nom_du_Contact_2) // À confirmer : nom API de "Nom du Contact 2"
        ]);

        // Déterminer le contact principal pour l'affichage (priorité au 1)
        const clientC = contact1 || contact2;
        const contactId = clientC?.id;

        // --- MAPPING DASHBOARD ÉQUIPE ---
        const [notaire, inspecteur, courtier] = await Promise.all([
            fetchP(deal.Nom_Notaire), 
            fetchP(deal.Nom_Inspecteur), 
            fetchP(deal.Nom_Courtier_Hypoth_caire)
        ]);
        
        // --- RÉCUPÉRATION DES VISITES ---
        const vResp = await fetch(`${apiDomain}/crm/v2/Visites_Portail/search?criteria=${encodeURIComponent(`(Affaire:equals:${dealId})`)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const vData = await vResp.json();
        const rawVisites = vData.data || [];
        const visites = rawVisites.map(v => ({
            id: v.id,
            Date_heure_de_visite: v.Date_heure_de_visite || null,
            date: v.Date_de_visite ? new Date(v.Date_de_visite).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : "À confirmer",
            heure: v.Heure || "À confirmer",
            location: v.Name || "Adresse à venir",
            type: v.Type || "Visite",
            statut: v.Statut || "En attente"
        }));

        // --- ACTION MLS DIRECTE ---
        if ((action === 'mls' || action === 'requestMLS') && mls) {
            console.log("Demande MLS reçue pour:", mls);
            
            // 1. Enregistrement CRM (Module Interactions_Portail)
            const crmData = {
                data: [{ 
                    Name: `Demande MLS ${mls}`, 
                    Num_ro_MLS: mls, 
                    Code_Portail: cleanCode, 
                    Affaire: dealId,
                    Description: `Client ${clientC?.Full_Name || 'Inconnu'} (${clientC?.Email}) demande la documentation pour MLS ${mls}.`
                }],
                trigger: ["workflow"] // Important pour déclencher la notification Zoho
            };

            // 2. Appel GitHub (DÉSACTIVÉ - Workflow Manuel)
            /*
            const dispatch = async () => {
                try {
                    const clientEmail = clientC?.Email || "evan.patruno@gmail.com";
                    console.log(`Déclenchement robot Matrix pour ${clientEmail}...`);
                    const ghResp = await fetch(`https://api.github.com/repos/evanpatruno-spec/evanpatruno.ca/dispatches`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.GH_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'X-GitHub-Api-Version': '2022-11-28',
                            'User-Agent': 'Vercel-Server'
                        },
                        body: JSON.stringify({
                            event_type: 'run-matrix-agent',
                            client_payload: { mlsNumber: mls, clientEmail: clientEmail }
                        })
                    });
                } catch (e) { console.error("Agent Trigger Error:", e); }
            };
            await dispatch();
            */

            // Enregistrement dans Zoho
            await fetch(`${apiDomain}/crm/v2/Interactions_Portail`, {
                method: 'POST',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(crmData)
            });

            return res.status(200).json({ s: true, msg: "Demande enregistrée" });
        }

        // --- ACTION UPDATE PUSH TOKEN ---
        if (action === 'update_push_token' && data.token) {
            const portalPhone = (data.phone || "").replace(/\D/g, "");
            console.log("FCM: Syncing token for:", cleanCode, "Phone:", portalPhone);

            // Choix du contact basé sur le téléphone
            let targetContactId = contactId; // Par défaut le principal
            
            const matches = (c) => {
                if (!c || !portalPhone) return false;
                const cMob = (c.Mobile || "").replace(/\D/g, "");
                const cPh = (c.Phone || "").replace(/\D/g, "");
                // Match si l'un est inclus dans l'autre (plus souple)
                return (cMob.includes(portalPhone) || portalPhone.includes(cMob) || cPh.includes(portalPhone) || portalPhone.includes(cPh));
            };

            if (matches(contact1)) targetContactId = contact1.id;
            else if (matches(contact2)) targetContactId = contact2.id;

            if (!targetContactId) {
                console.error("FCM Error: No matching contact found for phone", portalPhone);
                return res.status(400).json({ error: 'Aucun contact correspondant au téléphone' });
            }

            const updateResp = await fetch(`${apiDomain}/crm/v2/Contacts/${targetContactId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [{
                        id: targetContactId,
                        FCM_Token: data.token 
                    }]
                })
            });
            const updateResult = await updateResp.json();
            console.log("Zoho Sync Result:", JSON.stringify(updateResult));

            return res.status(200).json({ s: true, msg: "Token synchronisé" });
        }

        // --- ACTION DEMANDE DE VISITE ---
        if (action === 'requestVisit' && data.location) {
            const location = data.location;
            console.log("Demande de visite reçue pour:", location);
            const vDateTime = data.Date_heure_de_visite || "";

            // 1. Création de la visite officielle (Module Visites_Portail)
            const visitRecord = {
                data: [{
                    Name: location,
                    Statut: "En attente",
                    Date_heure_de_visite: vDateTime.includes('T') && vDateTime.length === 16 ? vDateTime + ":00" : vDateTime,
                    Affaire: { id: dealId }
                }],
                trigger: ["workflow"]
            };

            await fetch(`${apiDomain}/crm/v2/Visites_Portail`, {
                method: 'POST',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(visitRecord)
            });

            return res.status(200).json({ s: true, msg: "Demande de visite enregistrée" });
        }

        const team = [{ role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "&#x1f468;&#x200d;&#x1f4bc;", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }];
        const addP = (p, role, icon) => { if(p) team.push({ role, name: p.Full_Name || p.Name, icon, phone: p.Mobile || p.Phone || "À venir", email: p.Email || "À venir", contact: p.Email ? `mailto:${p.Email}` : "#" }); };
        addP(courtier, "Courtier Hypothécaire", "&#x1f3e6;"); addP(inspecteur, "Inspecteur", "🔍"); addP(notaire, "Notaire", "✒️");

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const getDays = (d) => d ? Math.ceil((new Date(d) - new Date().setHours(0,0,0,0)) / 86400000) : null;

        return res.status(200).json({
            id: deal.id,
            firstName: clientC?.First_Name || "Client",
            code: cleanCode,
            property: deal.Deal_Name,
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            milestones: {
                financing: { days: getDays(deal.Date_de_financement), date: formatDate(deal.Date_de_financement) },
                inspection: { days: getDays(deal.Date_d_inspection), date: formatDate(deal.Date_d_inspection) },
                signature: { days: getDays(deal.Closing_Date), date: formatDate(deal.Closing_Date) },
                occupation: { days: getDays(deal.Date_d_occupation), date: formatDate(deal.Date_d_occupation) }
            },
            timeline: [{ label: "Préparation", status: "completed", icon: "&#x1f4cb;" }, { label: "Visites", status: "active", icon: "🔍" }, { label: "Conditions", status: "pending", icon: "&#x1f6e1;&#xfe0f;" }, { label: "Notaire", status: "pending", icon: "&#x2696;&#xfe0f;" }, { label: "Vendu", status: "pending", icon: "&#x1f37e;" }],
            checklist: [{ name: "Financement Approuvé", done: deal.Financement_approuv === "Oui" }, { name: "Inspection complétée", done: deal.Inspection_satisfaisante === "Oui" }, { name: "Conditions de l'offre levées", done: deal.Autres_conditions_lev_es === "Oui" }],
            movingChecklist: [{ name: "Postes Canada", done: false }, { name: "Hydro-Québec", done: false }, { name: "Assurance", done: false }],
            visites: visites,
            partners: [
                { category: "Peinture", name: "Peinture Excellence", icon: "&#x1f3a8;", benefit: "10% de rabais", code: "EP-PROMO" },
                { category: "Plomberie", name: "Plombier Pro", icon: "&#x1f6bf;", benefit: "Estimation gratuite", code: "EP-PROMO" },
                { category: "Électricité", name: "Électricien Élite", icon: "⚡", benefit: "-15% main d'œuvre", code: "EP-PROMO" },
                { category: "Design Intérieur", name: "Designer d'Espaces", icon: "&#x1f6cb;&#xfe0f;", benefit: "1h consultation offerte", code: "EP-PROMO" },
                { category: "Excavation/Drains", name: "Drains Express", icon: "&#x1f300;", benefit: "Caméra incluse", code: "EP-PROMO" },
                { category: "Couvreur", name: "Toiture Premium", icon: "&#x1f3e0;", benefit: "Inspection annuelle", code: "EP-PROMO" },
                { category: "Aménagement", name: "Paysage Urbain", icon: "&#x1f33f;", benefit: "-10% sur les plants", code: "EP-PROMO" },
                { category: "Ménage", name: "Nettoyage Éclat", icon: "&#x1f9b9;", benefit: "-50$ Forfait Global", code: "EP-PROMO" },
                { category: "Arpenteur", name: "Précision Géo", icon: "&#x1f4cf;", benefit: "Service Prioritaire", code: "EP-PROMO" },
                { category: "Assurances", name: "Tranquillité Plus", icon: "&#x1f6e1;&#xfe0f;", benefit: "50$ en carte cadeau", code: "EP-PROMO" }
            ],
            team: team,
            concierge: {
                smartHome: [{ category: "Sécurité", title: "Sonnette Vidéo", desc: "Voyez qui est à la porte.", icon: "&#x1f514;" }, { category: "Confort", title: "Thermostat", desc: "Optimisez votre chauffage.", icon: "&#x1f321;&#xfe0f;" }],
                maintenance: [{ title: "Gouttières", period: "Automne", desc: "Nettoyage avant les gels." }, { title: "Filtres Fournaise", period: "3 mois", desc: "Assurez la qualité de l'air." }],
                resources: [{ title: "Tout sur le CELIAPP \u2192", url: "#" }, { title: "Régime d'Accès à la Propriété (RAP) \u2192", url: "#" }]
            }
        });
    } catch (error) {
        return res.status(500).json({ error: 'Erreur', details: error.message });
    }
}
