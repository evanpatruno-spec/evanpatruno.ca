/**
 * API BRIDGE : ZOHO CRM -> PORTAIL CLIENT (V3.5 - LIST SCANNER)
 * Affiche les 5 derniers dossiers pour identifier le module réel
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

        // 2. MODE DIAGNOSTIC LISTE
        if (cleanCode === "DIAG") {
            const mods = ['Potentials', 'Deals', 'Affaires'];
            let report = [];

            for (const mod of mods) {
                try {
                    const resp = await fetch(`${apiDomain}/crm/v2/${mod}?per_page=5`, {
                        method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
                    });
                    const d = await resp.json();
                    if (d.data) {
                        const names = d.data.map(item => item.Deal_Name || item.Potential_Name || item.Nom_de_l_Affaire || "Sans Nom");
                        report.push(`${mod}: [${names.join(', ')}]`);
                    } else {
                        report.push(`${mod}: Aucun dossier trouvé`);
                    }
                } catch (e) { report.push(`${mod}: Erreur`); }
            }

            return res.status(400).json({ 
                error: "ANALYSE DE STRUCTURE", 
                details: report.join(' | ') 
            });
        }

        // 3. RECHERCHE NORMALE (Global Word Search)
        const sResp = await fetch(`${apiDomain}/crm/v2/search?word=${encodeURIComponent(cleanCode)}`, {
            method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
        });
        const sData = await sResp.json();

        if (sData.data && sData.data.length > 0) {
            const found = sData.data[0];
            const rId = found.id;
            const mName = found.$module;

            const rResp = await fetch(`${apiDomain}/crm/v2/${mName}/${rId}`, {
                method: 'GET', headers: { 'Authorization': `Zoho-oauthtoken ${accessToken}` }
            });
            const dData = await rResp.json();
            const deal = dData.data[0];

            return res.status(200).json({
                firstName: deal.Contact_Name?.name?.split(' ')[0] || "Client",
                code: cleanCode,
                property: deal.Deal_Name || deal.Potential_Name || deal.Nom_de_l_Affaire || "Propriété",
                city: deal.Ville || deal.Localisation || "Adresse",
                price: deal.Amount ? `${deal.Amount.toLocaleString()} $` : "--- $",
                stage: deal.Stage || "Actif",
                image: deal.Record_Image || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=400",
                timeline: [], team: [], dates: [], checklist: []
            });
        }

        return res.status(404).json({ error: 'Code inconnu', details: "Vérifiez que le code EP-1 est bien écrit dans une case de Zoho." });

    } catch (error) {
        return res.status(500).json({ error: 'Erreur Fatale', details: error.message });
    }
}
