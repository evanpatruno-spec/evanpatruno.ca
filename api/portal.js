/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.3 - GLOBAL SEARCH)
 * Utilise l'API de recherche globale pour trouver 'EP-1' n'importe où dans le CRM
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

    const { codePortal } = req.body;
    const cleanCode = codePortal?.trim().toUpperCase();

    try {
        // 1. Authentification
        const tokenParams = new URLSearchParams();
        tokenParams.append('refresh_token', process.env.ZOHO_REFRESH_TOKEN?.trim());
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID?.trim());
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET?.trim());
        tokenParams.append('grant_type', 'refresh_token');

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho' });

        // 2. RECHERCHE GLOBALE (The ultimate search)
        // Cette API cherche le mot 'EP-1' partout dans le CRM
        const searchResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const searchData = await searchResp.json();

        if (!searchData.data || searchData.data.length === 0) {
            return res.status(404).json({ 
                error: 'Dossier introuvable',
                details: `La recherche globale pour "${cleanCode}" n'a rien donné. Vérifiez que ce code existe bien dans une fiche Zoho.`
            });
        }

        // On prend le premier résultat qui ressemble à une Affaire/Potentiel
        const found = searchData.data[0];
        const recordId = found.id;
        const moduleName = found.$module; 

        // 3. RECUPERATION COMPLETE DU DOSSIER TROUVÉ
        const recordResp = await fetch(`${apiDomain}/crm/v2/${moduleName}/${recordId}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const dealData = await recordResp.json();
        const deal = dealData.data[0];

        // 4. MAPPING FINAL
        const portalData = {
            firstName: deal.Contact_Name?.name?.split(' ')[0] || deal.Nom_du_Contact?.name?.split(' ')[0] || "Client",
            code: cleanCode,
            property: deal.Deal_Name || deal.Potential_Name || deal.Nom_de_l_Affaire || "Votre Propriété",
            city: deal.Localisation || deal.Ville || "Adresse en cours",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : (deal.Prix_affich_ || "--- $"),
            stage: deal.Stage || "Analyse",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            timeline: [
                { label: "Préqual.", icon: "💎", status: deal.Financement_approuv ? "completed" : "active" },
                { label: "Recherche", icon: "🔍", status: deal.Stage === "Qualifié" ? "active" : (deal.Stage?.includes("Offre") ? "completed" : "pending") },
                { label: "Offre", icon: "📝", status: deal.Stage?.includes("Offre") ? "active" : (deal.Closing_Date ? "completed" : "pending") },
                { label: "Inspection", icon: "⚙️", status: deal.Date_d_inspection ? "completed" : "pending" },
                { label: "Notaire", icon: "✒️", status: deal.Closing_Date ? "active" : "pending" }
            ],
            team: [
                { role: "Votre Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "👨‍💼", contact: `mailto:${deal.Owner?.email || 'evan@evanpatruno.ca'}` },
                { role: "Collaborateur", name: deal.Nom_Courtier_Immobilier || "À venir", icon: "🤝", contact: "#" },
                { role: "Courtier Hyp.", name: deal.Nom_Courtier_Hypoth_caire || "À venir", icon: "💰", contact: "#" },
                { role: "Inspecteur", name: deal.Nom_Inspecteur || "À venir", icon: "🔍", contact: "#" },
                { role: "Notaire", name: deal.Nom_Notaire || "À venir", icon: "🖋️", contact: "#" }
            ],
            dates: [
                { label: "Signature du contrat", val: deal.Date_de_la_Signature_du_Contrat || "À venir" },
                { label: "Rendez-vous Inspection", val: deal.Date_d_inspection || "À venir" },
                { label: "Date de clôture (Notaire)", val: deal.Closing_Date || "À venir" },
                { label: "Date d'occupation", val: deal.Date_d_occupation || "À venir" }
            ],
            checklist: [
                { name: "Préqualification reçue", done: deal.Financement_approuv || false },
                { name: "Inspection satisfaisante", done: deal.Inspection_satisfaisante || false },
                { name: "Conditions levées", done: deal.Autres_conditions_lev_es || false }
            ]
        };

        return res.status(200).json(portalData);

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
