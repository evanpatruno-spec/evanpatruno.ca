/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V5.3 - DEBUG BYPASS)
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    
    try {
        const { action, mlsNumber, codePortal } = req.body || {};

        // --- TEST COURT-CIRCUIT ---
        if (action === 'requestMLS') {
            console.log("Action MLS reçue pour:", mlsNumber);
            return res.status(200).json({ 
                success: true, 
                message: "DEBUG: Connexion établie, demande reçue." 
            });
        }

        // --- CHARGEMENT NORMAL DU DASHBOARD ---
        // (On garde le code minimal pour ne pas briser le reste)
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

        if (!accessToken) return res.status(401).json({ error: 'Auth Zoho failed' });

        const cleanCode = (codePortal || "").trim().toUpperCase();
        let deal = null;
        const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const sData = await sResp.json();
        if (sData.data) {
            const rResp = await fetch(`${apiDomain}/crm/v2/${sData.data[0].$module}/${sData.data[0].id}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            deal = dData.data ? dData.data[0] : null;
        }

        if (!deal) return res.status(404).json({ error: 'Dossier non trouvé' });

        // Mapping simplifié pour le dashboard
        return res.status(200).json({
            firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
            code: cleanCode,
            property: deal.Deal_Name,
            city: deal.Ville || "",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
            stage: deal.Stage,
            image: deal.Record_Image || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            milestones: {
                financing: { date: deal.Date_de_financement },
                inspection: { date: deal.Date_d_inspection },
                signature: { date: deal.Closing_Date },
                occupation: { date: deal.Date_d_occupation }
            },
            timeline: [{ label: "En cours", status: "active", icon: "🔍" }],
            team: [{ role: "Votre Courtier", name: "Evan Patruno", icon: "👨‍💼", phone: "514-567-3249", email: "info@evanpatruno.ca", contact: "tel:5145673249" }],
            partners: [{ category: "Peinture", name: "Excellence", icon: "🎨", benefit: "10% off", code: "PROMO" }]
        });

    } catch (e) {
        return res.status(500).json({ error: "Bug Serveur", details: e.message });
    }
}
