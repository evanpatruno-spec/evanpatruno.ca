/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V4.2 - SECURED 2FA & CONTACT DETAILS)
 * Implémentation du 2FA par téléphone et récupération des détails des partenaires.
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { codePortal, phoneLast4 } = req.body;
    const cleanCode = codePortal?.trim().toUpperCase();

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

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho' });

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

        // --- ÉTAPE CLÔTURE (Cycle de vie) ---
        let stage = deal.Stage || "";
        if (stage === "Closed Won" || stage.includes("Gagné") || stage.includes("Clôturé")) {
            return res.status(403).json({ 
                errorType: "WON", 
                message: `Félicitations pour votre transaction ! Ce dossier est maintenant archivé car l'acte est signé. Merci de votre confiance !` 
            });
        }
        if (stage === "Closed Lost" || stage.includes("Perdu")) {
            return res.status(403).json({ 
                errorType: "LOST", 
                message: "Ce dossier n'est plus actif car la transaction a été annulée ou l'affaire est classée." 
            });
        }

        // --- ÉTAPE SÉCURITÉ : VÉRIFICATION 2FA ---
        const mainContactId = deal.Contact_Name?.id;
        if (!mainContactId) return res.status(403).json({ error: "Sécurité : Aucun contact associé au dossier." });

        const contactResp = await fetch(`${apiDomain}/crm/v2/Contacts/${mainContactId}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const contactData = await contactResp.json();
        const clientContact = contactData.data ? contactData.data[0] : null;

        if (!clientContact) return res.status(403).json({ error: "Sécurité : Fiche client introuvable." });

        // On nettoie le téléphone pour ne garder que les chiffres
        const cleanPhone = (clientContact.Mobile || clientContact.Phone || "").replace(/\D/g, "");
        const actualLast4 = cleanPhone.slice(-4);

        if (actualLast4 !== phoneLast4) {
            return res.status(401).json({ 
                error: "Détails de sécurité incorrects", 
                details: "Les 4 chiffres du téléphone ne correspondent pas à ceux enregistrés au dossier." 
            });
        }

        // --- ÉTAPE RÉCUPÉRATION DÉTAILS PARTENAIRES ---
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

        const [notaire, inspecteur, courtier] = await Promise.all([
            fetchPartner(deal.Nom_Notaire),
            fetchPartner(deal.Nom_Inspecteur),
            fetchPartner(deal.Nom_Courtier_Hypoth_caire)
        ]);

        const team = [
            { role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "👨‍💼", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }
        ];

        const addPartnerToTeam = (p, role, icon) => {
            if (!p) return;
            const pPhone = p.Mobile || p.Phone || "À venir";
            const pEmail = p.Email || "À venir";
            team.push({
                role: role,
                name: p.Full_Name || p.last_name || p.Name,
                icon: icon,
                phone: pPhone,
                email: pEmail,
                contact: pEmail !== "À venir" ? `mailto:${pEmail}` : "#"
            });
        };

        addPartnerToTeam(courtier, "Courtier Hypothécaire", "🏦");
        addPartnerToTeam(inspecteur, "Inspecteur en Bâtiment", "🔍");
        addPartnerToTeam(notaire, "Notaire", "✒️");

        // --- RESTE DU MAPPING ---
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const dates = [];
        if (deal.Date_de_financement) dates.push({ label: "Date limite financement", val: formatDate(deal.Date_de_financement) });
        if (deal.Date_d_inspection) dates.push({ label: "Date limite inspection", val: formatDate(deal.Date_d_inspection) });
        if (deal.Closing_Date) dates.push({ label: "Date chez le notaire", val: formatDate(deal.Closing_Date) });
        if (deal.Date_d_occupation) dates.push({ label: "Date d'occupation", val: formatDate(deal.Date_d_occupation) });

        stage = deal.Stage || "";
        let isFinancementDone = deal.Financement_approuv === true || deal.Financement_approuv === "Oui";
        let isInspectionDone = deal.Inspection_satisfaisante === true || deal.Inspection_satisfaisante === "Oui";
        let isConditionsDone = deal.Autres_conditions_lev_es === true || deal.Autres_conditions_lev_es === "Oui";
        const transactionType = deal.Type === "Vente" ? "Vendeur" : "Acheteur";

        // Détermination des échéances (Multi-Milestones)
        const getDays = (dateStr) => {
            if (!dateStr) return null;
            const target = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Comparaison sur le jour même
            const diff = target - today;
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        };

        const daysFinancing = getDays(deal.Date_de_financement);
        const daysInspection = getDays(deal.Date_d_inspection);
        const daysClosing = getDays(deal.Closing_Date);
        const daysOccupation = getDays(deal.Date_d_occupation);

        const portalData = {
            firstName: clientContact.First_Name || "Cher client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            transactionType: transactionType,
        // --- LOGIQUE TIMELINE DYNAMIQUE (V4.3) ---
        const getTimeline = (curStage, type) => {
            const normalized = curStage.toLowerCase();
            if (type === "Vendeur") {
                // Étapes Vendeur (Regroupement pour le client)
                const steps = [
                    { label: "Mise en marché", icon: "📝", match: ["analyse", "contrat", "préparation"] },
                    { label: "Visites / Négo", icon: "🔍", match: ["marché", "visites", "reçue", "négociation"] },
                    { label: "Conditions", icon: "🛡️", match: ["acceptée", "conditionnelle"] },
                    { label: "Notaire", icon: "✒️", match: ["réalisées", "ferme", "notaire"] },
                    { label: "Vendu", icon: "🏠", match: ["vendu", "acheté", "louer"] }
                ];
                let currentIdx = steps.findIndex(s => s.match.some(m => normalized.includes(m)));
                if (currentIdx === -1 && normalized.includes("expiré")) currentIdx = 4; // Cas d'échec affiché comme fin
                
                return steps.map((s, i) => ({
                    label: s.label,
                    icon: s.icon,
                    status: i < currentIdx ? "completed" : (i === currentIdx ? "active" : "pending")
                }));
            } else {
                // Étapes Acheteur (Regroupement pour le client)
                const steps = [
                    { label: "Préparation", icon: "📝", match: ["analyse", "contrat"] },
                    { label: "Offre déposée", icon: "🔍", match: ["redigee", "deposee"] },
                    { label: "Conditions", icon: "🛡️", match: ["acceptée", "conditionnelle"] },
                    { label: "Notaire", icon: "✒️", match: ["réalisées", "ferme", "notaire"] },
                    { label: "Succès", icon: "🏠", match: ["vendu", "acheté", "louer"] }
                ];
                let currentIdx = steps.findIndex(s => s.match.some(m => normalized.includes(m)));
                return steps.map((s, i) => ({
                    label: s.label,
                    icon: s.icon,
                    status: i < currentIdx ? "completed" : (i === currentIdx ? "active" : "pending")
                }));
            }
        };

        const portalData = {
            firstName: clientContact.First_Name || "Cher client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            transactionType: transactionType,
            milestones: {
                financing: { days: daysFinancing, date: formatDate(deal.Date_de_financement) },
                inspection: { days: daysInspection, date: formatDate(deal.Date_d_inspection) },
                signature: { days: daysClosing, date: formatDate(deal.Closing_Date) },
                occupation: { days: daysOccupation, date: formatDate(deal.Date_d_occupation) }
            },
            daysRemaining: daysClosing, // Reste pour compatibilité
            timeline: getTimeline(stage, transactionType),
            checklist: [
                { name: "Financement Approuvé", done: isFinancementDone },
                { name: "Inspection complétée", done: isInspectionDone },
                { name: "Conditions de l'offre levées", done: isConditionsDone }
            ],
            movingChecklist: [
                { name: "Changement d'adresse (Postes Canada)", done: false },
                { name: "Branchement Hydro-Québec", done: false },
                { name: "Assurance Habitation", done: false },
                { name: "Internet & TV", done: false }
            ],
            partners: [
                { category: "Peinture", name: "Peinture Excellence", icon: "🎨", benefit: "10% de rabais", code: "EVANVIP" },
                { category: "Plomberie", name: "Plombier Pro", icon: "🚰", benefit: "Estimation gratuite", code: "EVANVIP" },
                { category: "Électricité", name: "Électricien Élite", icon: "⚡", benefit: "-15% main d'œuvre", code: "EVANVIP" },
                { category: "Design Intérieur", name: "Designer d'Espaces", icon: "🛋️", benefit: "1h consultation offerte", code: "EVANVIP" },
                { category: "Excavation/Drains", name: "Drains Express", icon: "🌀", benefit: "Caméra incluse", code: "EVANVIP" },
                { category: "Couvreur", name: "Toiture Premium", icon: "🏠", benefit: "Inspection annuelle", code: "EVANVIP" },
                { category: "Aménagement", name: "Paysage Urbain", icon: "🌿", benefit: "-10% sur les plants", code: "EVANVIP" },
                { category: "Ménage", name: "Nettoyage Éclat", icon: "🧹", benefit: "-50$ Forfait Global", code: "EVANVIP" },
                { category: "Arpenteur", name: "Précision Géo", icon: "📏", benefit: "Service Prioritaire", code: "EVANVIP" },
                { category: "Assurances", name: "Tranquillité Plus", icon: "🛡️", benefit: "50$ en carte cadeau", code: "EVANVIP" }
            ],
            sellerData: transactionType === "Vendeur" ? {
                visits: 12, feedback: [
                    { date: "2026-04-15", comment: "Très belle cuisine, mais jardin un peu petit.", rating: 4 },
                    { date: "2026-04-18", comment: "Coup de coeur pour la luminosité !", rating: 5 }
                ]
            } : null,
            team: team,
            dates: dates
        };

        return res.status(200).json(portalData);
    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
