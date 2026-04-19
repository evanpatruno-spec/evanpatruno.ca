/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V2.4 - DEBUG MODE)
 * Affiche plus de détails sur l'erreur d'authentification
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { codePortal } = req.body;

    try {
        // 1. Tenter d'obtenir l'Access Token avec des logs de debug
        const tokenParams = new URLSearchParams({
            refresh_token: process.env.ZOHO_REFRESH_TOKEN?.trim(),
            client_id: process.env.ZOHO_CLIENT_ID?.trim(),
            client_secret: process.env.ZOHO_CLIENT_SECRET?.trim(),
            grant_type: 'refresh_token'
        });

        const tokenResponse = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            body: tokenParams
        });
        const tokenData = await tokenResponse.json();

        if (!tokenData.access_token) {
            // RETOURNER L'ERREUR DÉTAILLÉE DE ZOHO
            return res.status(401).json({ 
                error: 'Erreur Auth Zoho', 
                details: tokenData.error || 'Erreur inconnue',
                hint: 'Vérifiez vos clés API et le Refresh Token dans Vercel.'
            });
        }

        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        // 2. Recherche du Dossier
        const searchCriteria = encodeURIComponent(`(Code_Portail:equals:${codePortal})`);
        const searchResponse = await fetch(`${apiDomain}/crm/v2/Deals/search?criteria=${searchCriteria}`, {
            method: 'GET',
            headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        
        const searchData = await searchResponse.json();

        if (!searchData || !searchData.data || searchData.data.length === 0) {
            return res.status(404).json({ 
                error: 'Dossier introuvable',
                debug: `Recherche effectuée pour: ${codePortal}`
            });
        }

        const deal = searchData.data[0];

        // 3. Mapping complet (on garde la même structure)
        const portalData = {
            firstName: deal.Contact_Name ? deal.Contact_Name.name.split(' ')[0] : "Client",
            code: deal.Code_Portail,
            property: deal.Deal_Name,
            city: deal.Localisation || "En attente d'adresse",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage || "Analyse",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            timeline: [
                { label: "Préqual.", icon: "💎", status: deal.Financement_approuv ? "completed" : "active" },
                { label: "Recherche", icon: "🔍", status: deal.Stage === "Qualifié" ? "active" : (deal.Stage.includes("Offre") ? "completed" : "pending") },
                { label: "Offre", icon: "📝", status: deal.Stage.includes("Offre") ? "active" : (deal.Closing_Date ? "completed" : "pending") },
                { label: "Inspection", icon: "⚙️", status: deal.Date_d_inspection ? (new Date(deal.Date_d_inspection) < new Date() ? "completed" : "active") : "pending" },
                { label: "Notaire", icon: "✒️", status: deal.Closing_Date ? "active" : "pending" }
            ],
            team: [
                { role: "Votre Courtier", name: deal.Owner.name, icon: "👨‍💼", contact: `mailto:${deal.Owner.email}` },
                { role: "Collaborateur", name: deal.Nom_Courtier_Immobilier || "À venir", icon: "🤝", contact: "#" },
                { role: "Courtier Hyp.", name: deal.Nom_Courtier_Hypoth_caire || "À venir", icon: "💰", contact: "#" },
                { role: "Inspecteur", name: deal.Nom_Inspecteur || "À venir", icon: "🔍", contact: "#" },
                { role: "Notaire", name: deal.Nom_Notaire || "À venir", icon: "🖋️", contact: "#" }
            ],
            dates: [
                { label: "Signature du contrat", val: deal.Date_de_la_Signature_du_Contrat || "À venir" },
                { label: "Date limite financement", val: deal.Date_de_financement || "À venir" },
                { label: "Rendez-vous Inspection", val: deal.Date_d_inspection || "À venir" },
                { label: "Date de clôture (Notaire)", val: deal.Closing_Date || "À venir" },
                { label: "Date d'occupation", val: deal.Date_d_occupation || "À venir" }
            ],
            checklist: [
                { name: "Préqualification reçue", done: deal.Financement_approuv || false },
                { name: "Inspection satisfaisante", done: deal.Inspection_satisfaisante || false },
                { name: "Conditions levées", done: deal.Autres_conditions_lev_es || false }
            ],
            prequalStatus: deal.Financement_approuv ? "Dossier Complet" : "En attente"
        };

        return res.status(200).json(portalData);

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Technique', details: error.message });
    }
}
