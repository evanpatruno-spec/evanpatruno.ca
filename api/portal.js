/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V4.0 - PRODUCTION WITH FULL MAPPING)
 * Mapping complet des dates, professionnels et statuts.
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

        const tokenResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });
        const tokenData = await tokenResp.json();
        const accessToken = tokenData.access_token;
        const apiDomain = tokenData.api_domain || "https://www.zohoapis.com";

        if (!accessToken) return res.status(401).json({ error: 'Erreur Auth Zoho' });

        // 2. RECHERCHE DU DOSSIER
        let deal = null;

        // Vraie recherche globale
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
        } 
        // Fallback pour EP-1 (Si l'indexation globale tarde)
        else if (cleanCode === "EP-1") {
            const rResp = await fetch(`${apiDomain}/crm/v2/Potentials/6466486000011930049`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        }

        if (!deal) return res.status(404).json({ 
            error: 'Dossier introuvable', 
            details: `Le code ${cleanCode} n'est pas synchronisé. Veuillez réessayer dans quelques minutes.` 
        });

        // 3. MAPPING DÉFINITIF
        // Formatage des dates 
        const formatDate = (dateString) => {
            if (!dateString) return null;
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('fr-CA', options);
        };

        // Extraction sécurisée des noms des lookups
        const getLookupName = (field) => field && typeof field === 'object' ? field.name : field;

        // Construction de l'équipe (Professionnels)
        const team = [
            { role: "Votre Courtier", name: getLookupName(deal.Owner) || "Evan Patruno", icon: "👨‍💼", contact: "mailto:info@evanpatruno.ca" }
        ];
        if (deal.Nom_Courtier_Hypoth_caire) team.push({ role: "Courtier Hypothécaire", name: getLookupName(deal.Nom_Courtier_Hypoth_caire), icon: "🏦" });
        if (deal.Nom_Inspecteur) team.push({ role: "Inspecteur en Bâtiment", name: getLookupName(deal.Nom_Inspecteur), icon: "🔍" });
        if (deal.Nom_Notaire) team.push({ role: "Notaire", name: getLookupName(deal.Nom_Notaire), icon: "✒️" });

        // Construction des dates importantes
        const dates = [];
        if (deal.Date_de_financement) dates.push({ label: "Date limite financement", val: formatDate(deal.Date_de_financement) });
        if (deal.Date_d_inspection) dates.push({ label: "Date limite inspection", val: formatDate(deal.Date_d_inspection) });
        if (deal.Closing_Date) dates.push({ label: "Date chez le notaire", val: formatDate(deal.Closing_Date) });
        if (deal.Date_d_occupation) dates.push({ label: "Date d'occupation", val: formatDate(deal.Date_d_occupation) });

        // Évaluation de l'état d'avancement pour la Timeline
        let stage = deal.Stage || "";
        let isFinancementDone = deal.Financement_approuv === true || deal.Financement_approuv === "Oui";
        let isInspectionDone = document?.Inspection_satisfaisante === true || deal.Inspection_satisfaisante === "Oui";
        let isConditionsDone = deal.Autres_conditions_lev_es === true || deal.Autres_conditions_lev_es === "Oui";
        let isOfferAccepted = stage.includes("Offre") || isFinancementDone || isInspectionDone || isConditionsDone;
        let isNotaryDone = stage.includes("Notaire") || stage.includes("Clôturé");

        const portalData = {
            firstName: getLookupName(deal.Contact_Name)?.split(' ')[0] || "Cher client",
            code: cleanCode,
            property: deal.Deal_Name || "Votre Propriété",
            city: deal.Ville || deal.Localisation || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "Prix sur demande",
            stage: stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            
            // Timeline de progression
            timeline: [
                { label: "Préqualification", icon: "💎", status: isFinancementDone ? "completed" : "active" },
                { label: "Visites & Offre", icon: "🔍", status: isOfferAccepted ? "completed" : (isFinancementDone ? "active" : "pending") },
                { label: "Conditions Financières", icon: "📝", status: isConditionsDone ? "completed" : (isOfferAccepted ? "active" : "pending") },
                { label: "Signature chez le Notaire", icon: "✒️", status: isNotaryDone ? "completed" : (isConditionsDone ? "active" : "pending") }
            ],
            
            // Checklist des conditions
            checklist: [
                { name: "Financement pré-approuvé", done: isFinancementDone },
                { name: "Inspection complétée", done: isInspectionDone },
                { name: "Conditions de l'offre levées", done: isConditionsDone }
            ],
            
            team: team,
            dates: dates
        };

        return res.status(200).json(portalData);

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Serveur', details: error.message });
    }
}
