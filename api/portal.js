/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT
 * Ce script s'exécute côté serveur (Vercel/Node.js) pour protéger vos clés API.
 */

const axios = require('axios');

export default async function handler(req, res) {
    // 1. Autoriser uniquement les requêtes POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée' });
    }

    const { codePortal } = req.body;

    if (!codePortal) {
        return res.status(400).json({ error: 'Code Portail manquant' });
    }

    try {
        // 2. Obtenir un nouveau Access Token via le Refresh Token
        const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
            params: {
                refresh_token: process.env.ZOHO_REFRESH_TOKEN,
                client_id: process.env.ZOHO_CLIENT_ID,
                client_secret: process.env.ZOHO_CLIENT_SECRET,
                grant_type: 'refresh_token'
            }
        });

        const accessToken = tokenResponse.data.access_token;
        const apiDomain = tokenResponse.data.api_domain || "https://www.zohoapis.com";

        // 3. Rechercher l'Affaire (Deal) par le Code Portail
        // API Name: Code_Portail (confirmé précédemment)
        const searchResponse = await axios.get(`${apiDomain}/crm/v2/Deals/search`, {
            params: {
                criteria: `(Code_Portail:equals:${codePortal})`
            },
            headers: {
                'Authorization': `Zoho-oauthtoken ${accessToken}`
            }
        });

        if (!searchResponse.data || !searchResponse.data.data || searchResponse.data.data.length === 0) {
            return res.status(404).json({ error: 'Dossier introuvable' });
        }

        const deal = searchResponse.data.data[0];

        // 4. Formater les données pour le Frontend
        // On utilise les noms d'API identifiés dans zoho_mapping.md
        const portalData = {
            firstName: deal.Contact_Name ? deal.Contact_Name.name.split(' ')[0] : "Client",
            code: deal.Code_Portail,
            property: deal.Deal_Name,
            city: deal.Localisation || "En attente d'adresse",
            price: deal.Amount || "---",
            stage: deal.Stage || "Analyse",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            
            // Timeline basée sur les étapes standard ou champs personnalisés
            timeline: [
                { label: "Préqual.", icon: "💎", status: deal.Financement_approuv ? "completed" : "active" },
                { label: "Recherche", icon: "🔍", status: deal.Stage === "Qualifié" ? "active" : (deal.Stage.includes("Offre") ? "completed" : "pending") },
                { label: "Offre", icon: "📝", status: deal.Stage.includes("Offre") ? "active" : (deal.Closing_Date ? "completed" : "pending") },
                { label: "Inspection", icon: "⚙️", status: deal.Date_d_inspection ? (new Date(deal.Date_d_inspection) < new Date() ? "completed" : "active") : "pending" },
                { label: "Notaire", icon: "✒️", status: deal.Closing_Date ? "active" : "pending" }
            ],

            // Intervenants
            team: [
                { role: "Votre Courtier", name: deal.Owner.name, icon: "👨‍💼", contact: `mailto:${deal.Owner.email}` },
                { role: "Collaborateur", name: deal.Nom_Courtier_Immobilier || "À venir", icon: "🤝", contact: "#" },
                { role: "Courtier Hyp.", name: deal.Nom_Courtier_Hypoth_caire || "À venir", icon: "💰", contact: "#" },
                { role: "Inspecteur", name: deal.Nom_Inspecteur || "À venir", icon: "🔍", contact: "#" },
                { role: "Notaire", name: deal.Nom_Notaire || "À venir", icon: "🖋️", contact: "#" }
            ],

            // Dates Clés
            dates: [
                { label: "Signature du contrat", val: deal.Date_de_la_Signature_du_Contrat || "À venir" },
                { label: "Date limite financement", val: deal.Date_de_financement || "À venir" },
                { label: "Rendez-vous Inspection", val: deal.Date_d_inspection || "À venir" },
                { label: "Date de clôture (Notaire)", val: deal.Closing_Date || "À venir" },
                { label: "Date d'occupation", val: deal.Date_d_occupation || "À venir" }
            ],

            // Checklist
            checklist: [
                { name: "Préqualification reçue", done: deal.Financement_approuv || false },
                { name: "Inspection satisfaisante", done: deal.Inspection_satisfaisante || false },
                { name: "Conditions levées", done: deal.Autres_conditions_lev_es || false }
            ]
        };

        return res.status(200).json(portalData);

    } catch (error) {
        console.error('Erreur Pont Zoho:', error.response ? error.response.data : error.message);
        return res.status(500).json({ error: 'Erreur lors de la récupération des données Zoho' });
    }
}
