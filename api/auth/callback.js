/**
 * ZOHO OAUTH CALLBACK
 * Receives the auth code and exchanges it for a Refresh Token.
 */

export default async function handler(req, res) {
    const { code, error } = req.query;

    if (error) {
        return res.status(400).send(`Erreur d'autorisation : ${error}`);
    }

    if (!code) {
        return res.status(400).send("Code d'autorisation manquant.");
    }

    try {
        const tokenParams = new URLSearchParams();
        tokenParams.append('code', code);
        tokenParams.append('client_id', process.env.ZOHO_CLIENT_ID || "");
        tokenParams.append('client_secret', process.env.ZOHO_CLIENT_SECRET || "");
        tokenParams.append('redirect_uri', `https://${req.headers.host}/api/auth/callback`);
        tokenParams.append('grant_type', 'authorization_code');

        const tResp = await fetch('https://accounts.zoho.com/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams.toString()
        });

        const tData = await tResp.json();

        if (tData.refresh_token) {
            return res.status(200).send(`
                <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                    <h1 style="color: #873276;">✅ Connexion Réussie !</h1>
                    <p>Votre Refresh Token a été généré avec succès.</p>
                    <div style="background: #f4f4f4; padding: 20px; border-radius: 10px; display: inline-block; margin-top: 20px;">
                        <code>${tData.refresh_token}</code>
                    </div>
                    <p style="margin-top: 30px; color: #666;">Copiez ce code et envoyez-le moi dans le chat pour que je puisse finaliser la configuration.</p>
                </div>
            `);
        } else {
            return res.status(500).json({ error: "Échange de token échoué", details: tData });
        }
    } catch (err) {
        return res.status(500).send(`Erreur serveur : ${err.message}`);
    }
}
