/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.4 - COMMENT SEARCH FALLBACK)
 * Cherche le code dans les champs OU dans les commentaires
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

        // 2. RECHERCHE GLOBALE (Champs + Notes)
        // On cherche le code n'importe où
        const searchResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const searchData = await searchResp.json();

        let targetId = null;
        let targetModule = null;

        if (searchData.data && searchData.data.length > 0) {
            // Si trouvé directement (Affaire, etc.)
            targetId = searchData.data[0].id;
            targetModule = searchData.data[0].$module;
        } else {
            // FALLBACK : SI NON TROUVÉ, on cherche dans les Notes (Commentaires)
            const noteSearch = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent("PORTAIL:" + cleanCode)}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const noteData = await noteSearch.json();
            
            if (noteData.data && noteData.data.length > 0) {
                // On a trouvé une note ! On remonte au dossier parent.
                const noteId = noteData.data[0].id;
                const fullNoteResp = await fetch(`${apiDomain}/crm/v2/Notes/${noteId}`, {
                    method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                });
                const fullNote = await fullNoteResp.json();
                if (fullNote.data) {
                    targetId = fullNote.data[0].Parent_Id?.id;
                    targetModule = fullNote.data[0].Parent_Id?.$module;
                }
            }
        }

        if (!targetId) {
            return res.status(404).json({ 
                error: 'Sécurité : Code non autorisé',
                details: `Votre code ${cleanCode} n'est pas encore synchronisé. Ajoutez un commentaire "PORTAIL:${cleanCode}" dans votre affaire pour forcer l'accès.`
            });
        }

        // 3. RECUPERATION DU DOSSIER FINAL
        const recordResp = await fetch(`${apiDomain}/crm/v2/${targetModule}/${targetId}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const finalData = await recordResp.json();
        const deal = finalData.data[0];

        // 4. MAPPING
        return res.status(200).json({
            firstName: "Client de " + (deal.Owner?.name || "Evan"),
            code: cleanCode,
            property: deal.Deal_Name || deal.Potential_Name || deal.Nom_de_l_Affaire || "Propriété",
            city: deal.Localisation || deal.Ville || "En cours...",
            price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "Consultez Evan",
            stage: deal.Stage || "Actif",
            image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=800",
            timeline: [
                { label: "Préqual.", icon: "💎", status: "completed" },
                { label: "Recherche", icon: "🔍", status: "active" },
                { label: "Offre", icon: "📝", status: "pending" },
                { label: "Notaire", icon: "✒️", status: "pending" }
            ],
            team: [
                { role: "Courtier", name: deal.Owner?.name || "Evan Patruno", icon: "👨‍💼", contact: `mailto:evan@evanpatruno.ca` }
            ],
            dates: [
                { label: "Date cible", val: deal.Closing_Date || "À déterminer" }
            ],
            checklist: []
        });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Système', details: error.message });
    }
}
