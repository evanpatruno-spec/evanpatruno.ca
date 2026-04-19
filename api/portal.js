/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V4.1 - PREMIUM EXPANSION)
 * Ajout du compte à rebours, de la checklist déménagement et du mode vendeur.
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

        const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
        const getLookupName = (f) => f && typeof f === 'object' ? f.name : f;

        // Calcul du compte à rebours
        let daysRemaining = null;
        if (deal.Closing_Date) {
            const closing = new Date(deal.Closing_Date);
            const today = new Date();
            const diff = closing - today;
            daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        }

        const team = [
            { role: "Votre Courtier", name: getLookupName(deal.Owner) || "Evan Patruno", icon: "👨‍💼", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }
        ];
        if (deal.Nom_Courtier_Hypoth_caire) team.push({ role: "Courtier Hypothécaire", name: getLookupName(deal.Nom_Courtier_Hypoth_caire), icon: "🏦", phone: deal.Tel_Courtier || "À venir", email: deal.Email_Courtier || "À venir", contact: deal.Email_Courtier ? `mailto:${deal.Email_Courtier}` : "#" });
        if (deal.Nom_Inspecteur) team.push({ role: "Inspecteur en Bâtiment", name: getLookupName(deal.Nom_Inspecteur), icon: "🔍", phone: deal.Tel_Inspecteur || "À venir", email: deal.Email_Inspecteur || "À venir", contact: deal.Email_Inspecteur ? `mailto:${deal.Email_Inspecteur}` : "#" });
        if (deal.Nom_Notaire) team.push({ role: "Notaire", name: getLookupName(deal.Nom_Notaire), icon: "✒️", phone: deal.Tel_Notaire || "À venir", email: deal.Email_Notaire || "À venir", contact: deal.Email_Notaire ? `mailto:${deal.Email_Notaire}` : "#" });

        const dates = [];
        if (deal.Date_de_financement) dates.push({ label: "Date limite financement", val: formatDate(deal.Date_de_financement) });
        if (deal.Date_d_inspection) dates.push({ label: "Date limite inspection", val: formatDate(deal.Date_d_inspection) });
        if (deal.Closing_Date) dates.push({ label: "Date chez le notaire", val: formatDate(deal.Closing_Date) });
        if (deal.Date_d_occupation) dates.push({ label: "Date d'occupation", val: formatDate(deal.Date_d_occupation) });

        let stage = deal.Stage || "";
        let isFinancementDone = deal.Financement_approuv === true || deal.Financement_approuv === "Oui";
        let isInspectionDone = deal.Inspection_satisfaisante === true || deal.Inspection_satisfaisante === "Oui";
        let isConditionsDone = deal.Autres_conditions_lev_es === true || deal.Autres_conditions_lev_es === "Oui";

        // Détection Acheteur vs Vendeur
        const transactionType = deal.Type === "Vente" ? "Vendeur" : "Acheteur";

        const portalData = {
            firstName: getLookupName(deal.Contact_Name)?.split(' ')[0] || "Cher client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            transactionType: transactionType,
            daysRemaining: daysRemaining,
            timeline: [
                { label: "Préqual.", icon: "💎", status: isFinancementDone ? "completed" : "active" },
                { label: "Offre", icon: "📝", status: (stage.includes("Offre") || isConditionsDone) ? "completed" : "active" },
                { label: "Conditions", icon: "⚙️", status: isConditionsDone ? "completed" : "active" },
                { label: "Signature", icon: "✒️", status: (stage.includes("Notaire") || stage.includes("Clôturé")) ? "completed" : "pending" }
            ],
            checklist: [
                { name: "Financement pré-approuvé", done: isFinancementDone },
                { name: "Inspection complétée", done: isInspectionDone },
                { name: "Conditions de l'offre levées", done: isConditionsDone }
            ],
            movingChecklist: [
                { name: "Changement d'adresse (Postes Canada)", done: false },
                { name: "Branchement Hydro-Québec", done: false },
                { name: "Assurance Habitation", done: false },
                { name: "Internet & TV", done: false }
            ],
            sellerData: transactionType === "Vendeur" ? {
                visits: 12, // Placeholder
                feedback: [
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
