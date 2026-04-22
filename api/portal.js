/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V5.1 - TOTAL PROTECTION)
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

        // --- GESTION MLS (SÉCURISÉE) ---
        if (action === 'requestMLS') {
            const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const sData = await sResp.json();
            let dealId = (cleanCode === "EP-1") ? "6466486000011930049" : (sData.data ? sData.data[0].id : null);
            
            if (dealId) {
                await fetch(`${apiDomain}/crm/v2/Notes`, {
                    method: 'POST',
                    headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data: [{
                            Parent_Id: dealId,
                            Note_Title: "DEMANDE DOCUMENTS MLS",
                            Note_Content: `MLS: ${mlsNumber}`,
                            se_module: "Potentials"
                        }]
                    })
                });
                return res.status(200).json({ success: true });
            }
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

        // --- SÉCURITÉ 2FA ---
        const mainContactId = deal.Contact_Name?.id;
        if (mainContactId) {
            const contactResp = await fetch(`${apiDomain}/crm/v2/Contacts/${mainContactId}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const contactData = await contactResp.json();
            const clientContact = contactData.data ? contactData.data[0] : null;
            if (clientContact) {
                const cleanPhone = (clientContact.Mobile || clientContact.Phone || "").replace(/\D/g, "");
                if (cleanPhone.slice(-4) !== phoneLast4) return res.status(401).json({ error: "Code incorrect" });
            }
        }

        // --- RÉCUPÉRATION INTERVENANTS ---
        const fetchPartner = async (field) => {
            if (!field || !field.id) return null;
            const r = await fetch(`${apiDomain}/crm/v2/Contacts/${field.id}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const d = await r.json();
            return d.data ? d.data[0] : null;
        };

        const [notaire, inspecteur, courtier] = await Promise.all([
            fetchPartner(deal.Nom_Notaire),
            fetchPartner(deal.Nom_Inspecteur),
            fetchPartner(deal.Nom_Courtier_Hypoth_caire)
        ]);

        const team = [
            { role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "&#x1f468;&#x200d;&#x1f4bc;", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }
        ];
        const addP = (p, role, icon) => {
            if (!p) return;
            team.push({ role, name: p.Full_Name || p.Name, icon, phone: p.Mobile || p.Phone || "À venir", email: p.Email || "À venir", contact: p.Email ? `mailto:${p.Email}` : "#" });
        };
        addP(courtier, "Courtier Hypothécaire", "&#x1f3e6;");
        addP(inspecteur, "Inspecteur en Bâtiment", "🔍");
        addP(notaire, "Notaire", "✒️");

        // --- MAPPING COMPLET ---
        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const getDays = (d) => d ? Math.ceil((new Date(d) - new Date().setHours(0,0,0,0)) / 86400000) : null;

        const portalData = {
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Cher client",
            code: cleanCode,
            property: deal.Deal_Name || "Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            transactionType: deal.Type === "Vente" ? "Vendeur" : "Acheteur",
            milestones: {
                financing: { days: getDays(deal.Date_de_financement), date: formatDate(deal.Date_de_financement) },
                inspection: { days: getDays(deal.Date_d_inspection), date: formatDate(deal.Date_d_inspection) },
                signature: { days: getDays(deal.Closing_Date), date: formatDate(deal.Closing_Date) },
                occupation: { days: getDays(deal.Date_d_occupation), date: formatDate(deal.Date_d_occupation) }
            },
            timeline: [
                { label: "Préparation", icon: "&#x1f4cb;", status: "completed" },
                { label: "Visites", icon: "🔍", status: "active" },
                { label: "Conditions", icon: "&#x1f6e1;&#xfe0f;", status: "pending" },
                { label: "Notaire", icon: "&#x2696;&#xfe0f;", status: "pending" },
                { label: "Vendu", icon: "&#x1f37e;", status: "pending" }
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
                { category: "Électricité", name: "Électricien Élite", icon: "⚡", benefit: "-15% main d'œuvre", code: "EP-PROMO" },
                { category: "Design Intérieur", name: "Designer d'Espaces", icon: "&#x1f6cb;&#xfe0f;", benefit: "1h consultation offerte", code: "EP-PROMO" },
                { category: "Excavation/Drains", name: "Drains Express", icon: "&#x1f300;", benefit: "Caméra incluse", code: "EP-PROMO" },
                { category: "Couvreur", name: "Toiture Premium", icon: "&#x1f3e0;", benefit: "Inspection annuelle", code: "EP-PROMO" },
                { category: "Aménagement", name: "Paysage Urbain", icon: "&#x1f33f;", benefit: "-10% sur les plants", code: "EP-PROMO" },
                { category: "Ménage", name: "Nettoyage Éclat", icon: "&#x1f9b9;", benefit: "-50$ Forfait Global", code: "EP-PROMO" },
                { category: "Arpenteur", name: "Précision Géo", icon: "&#x1f4cf;", benefit: "Service Prioritaire", code: "EP-PROMO" },
                { category: "Assurances", name: "Tranquillité Plus", icon: "&#x1f6e1;&#xfe0f;", benefit: "50$ en carte cadeau", code: "EP-PROMO" }
            ],
            concierge: {
                smartHome: [
                    { category: "Sécurité", title: "Sonnette Vidéo", desc: "Voyez qui est à la porte.", icon: "&#x1f514;" },
                    { category: "Confort", title: "Thermostat", desc: "Optimisez votre chauffage.", icon: "&#x1f321;&#xfe0f;" },
                    { category: "Praticité", title: "Serrure Connectée", desc: "Ouvrez votre porte avec votre téléphone.", icon: "&#x1f512;" }
                ],
                maintenance: [
                    { title: "Gouttières", period: "Automne", desc: "Nettoyage avant les gels." },
                    { title: "Filtres Fournaise", period: "3 mois", desc: "Assurez la qualité de l'air." }
                ],
                resources: [
                    { title: "Tout sur le CELIAPP", url: "https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/sujets/compte-epargne-libre-impot-achat-premiere-propriete.html" },
                    { title: "Régime d'Accès à la Propriété (RAP)", url: "https://www.canada.ca/fr/agence-revenu/services/impot/particuliers/sujets/reer-regimes-enregistres-epargne-retraite/regime-accession-a-propriete.html" }
                ]
            },
            team: team
        };

        return res.status(200).json(portalData);
    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
