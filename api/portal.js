/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V5.0 - FULL RESTORE & SECURED MLS)
 * Version stabilisée avec toutes les fonctionnalités originales + Smart Concierge
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { codePortal, phoneLast4, action, mlsNumber } = req.body;
    const cleanCode = codePortal?.trim().toUpperCase();

    try {
        // --- AUTH ZOHO ---
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', (process.env.ZOHO_REFRESH_TOKEN || "").trim());
        tokenParams.append('client_id', (process.env.ZOHO_CLIENT_ID || "").trim());
        tokenParams.append('client_secret', (process.env.ZOHO_CLIENT_SECRET || "").trim());
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho' });

        // --- ACTION SPÉCIFIQUE : DEMANDE DOCUMENTS MLS ---
        if (action === 'requestMLS') {
            if (!mlsNumber) return res.status(400).json({ error: 'MLS manquant' });
            
            // On cherche l'ID de l'affaire
            let targetId = null;
            if (cleanCode === "EP-1") {
                targetId = "6466486000011930049";
            } else {
                const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                    method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const sData = await sResp.json();
                if (sData.data && sData.data.length > 0) targetId = sData.data[0].id;
            }

            if (!targetId) return res.status(404).json({ error: 'Dossier introuvable' });

            // Création de la Note
            await fetch(`${apiDomain}/crm/v2/Notes`, {
                method: 'POST',
                headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: [{
                        Parent_Id: targetId,
                        Note_Title: "DEMANDE DOCUMENTS MLS (Portail)",
                        Note_Content: `Le client a demandé la documentation pour le numéro MLS : ${mlsNumber}.`,
                        se_module: "Potentials"
                    }]
                })
            });
            return res.status(200).json({ success: true });
        }

        // --- RÉCUPÉRATION DU DEAL ---
        let deal = null;
        const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const sData = await sResp.json();

        if (sData.data && sData.data.length > 0) {
            const found = sData.data[0];
            const rResp = await fetch(`${apiDomain}/crm/v2/${found.$module}/${found.id}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        } else if (cleanCode === "EP-1") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        }

        if (!deal) return res.status(404).json({ error: 'Dossier introuvable' });

        // --- ÉTAPE SÉCURITÉ : VÉRIFICATION 2FA ---
        const mainContactId = deal.Contact_Name?.id;
        if (mainContactId) {
            const contactResp = await fetch(`${apiDomain}/crm/v2/Contacts/${mainContactId}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const contactData = await contactResp.json();
            const clientContact = contactData.data ? contactData.data[0] : null;

            if (clientContact) {
                const cleanPhone = (clientContact.Mobile || clientContact.Phone || "").replace(/\D/g, "");
                if (cleanPhone.slice(-4) !== phoneLast4) {
                    return res.status(401).json({ error: "Sécurité : Code incorrect" });
                }
            }
        }

        // --- RÉCUPÉRATION DÉTAILS PARTENAIRES ---
        const fetchPartner = async (partnerField) => {
            if (!partnerField || !partnerField.id) return null;
            try {
                const resp = await fetch(`${apiDomain}/crm/v2/Contacts/${partnerField.id}`, {
                    method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const d = await resp.json();
                return d.data ? d.data[0] : null;
            } catch (e) { return null; }
        };

        const [notaire, inspecteur, courtier, clientContact] = await Promise.all([
            fetchPartner(deal.Nom_Notaire),
            fetchPartner(deal.Nom_Inspecteur),
            fetchPartner(deal.Nom_Courtier_Hypoth_caire),
            fetchPartner(deal.Contact_Name)
        ]);

        const team = [
            { role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "&#x1f468;&#x200d;&#x1f4bc;", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }
        ];

        const addPartnerToTeam = (p, role, icon) => {
            if (!p) return;
            team.push({
                role: role,
                name: p.Full_Name || p.last_name || p.Name,
                icon: icon,
                phone: p.Mobile || p.Phone || "À venir",
                email: p.Email || "À venir",
                contact: p.Email ? `mailto:${p.Email}` : "#"
            });
        };

        addPartnerToTeam(courtier, "Courtier Hypothécaire", "&#x1f3e6;");
        addPartnerToTeam(inspecteur, "Inspecteur en Bâtiment", "🔍");
        addPartnerToTeam(notaire, "Notaire", "✒️");

        // --- MAPPING DES DONNÉES ---
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const getDays = (dateStr) => {
            if (!dateStr) return null;
            const target = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
        };

        const transactionType = deal.Type === "Vente" ? "Vendeur" : "Acheteur";
        const stage = deal.Stage || "";
        const isCelebration = stage.toLowerCase().includes("vendu") || stage.toLowerCase().includes("acheté") || stage.toLowerCase().includes("gagné");

        const portalData = {
            firstName: clientContact?.First_Name || "Cher client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: stage,
            isCelebration: isCelebration,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            transactionType: transactionType,
            milestones: {
                financing: { days: getDays(deal.Date_de_financement), date: formatDate(deal.Date_de_financement) },
                inspection: { days: getDays(deal.Date_d_inspection), date: formatDate(deal.Date_d_inspection) },
                signature: { days: getDays(deal.Closing_Date), date: formatDate(deal.Closing_Date) },
                occupation: { days: getDays(deal.Date_d_occupation), date: formatDate(deal.Date_d_occupation) }
            },
            timeline: [
                { label: "Préparation", status: "completed", icon: "&#x1f4cb;" },
                { label: "Visites / Offre", status: "active", icon: "🔍" },
                { label: "Conditions", status: "pending", icon: "&#x1f6e1;&#xfe0f;" },
                { label: "Notaire", status: "pending", icon: "&#x2696;&#xfe0f;" },
                { label: "Vendu", status: "pending", icon: "&#x1f37e;" }
            ],
            checklist: [
                { name: "Financement Approuvé", done: deal.Financement_approuv === "Oui" || deal.Financement_approuv === true },
                { name: "Inspection complétée", done: deal.Inspection_satisfaisante === "Oui" || deal.Inspection_satisfaisante === true },
                { name: "Conditions de l'offre levées", done: deal.Autres_conditions_lev_es === "Oui" || deal.Autres_conditions_lev_es === true }
            ],
            movingChecklist: [
                { name: "Changement d'adresse (Postes Canada)", done: false },
                { name: "Branchement Hydro-Québec", done: false },
                { name: "Assurance Habitation", done: false },
                { name: "Internet & TV", done: false },
                { name: "Taxe de Bienvenue", done: false }
            ],
            partners: [
                { category: "Peinture", name: "Peinture Excellence", icon: "&#x1f3a8;", benefit: "10% de rabais", code: "EP-PROMO" },
                { category: "Plomberie", name: "Plombier Pro", icon: "&#x1f6bf;", benefit: "Estimation gratuite", code: "EP-PROMO" },
                { category: "Électricité", name: "Électricien Élite", icon: "⚡", benefit: "-15% main d'œuvre", code: "EP-PROMO" }
            ],
            concierge: {
                smartHome: [
                    { category: "Sécurité", title: "Sonnette Vidéo", desc: "Voyez qui est à la porte.", icon: "&#x1f514;" },
                    { category: "Confort", title: "Thermostat", desc: "Optimisez votre chauffage.", icon: "&#x1f321;&#xfe0f;" }
                ],
                maintenance: [
                    { title: "Gouttières", period: "Automne", desc: "Nettoyage avant les gels." },
                    { title: "Filtres Fournaise", period: "3 mois", desc: "Qualité de l'air." }
                ]
            }
        };

        return res.status(200).json(portalData);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
