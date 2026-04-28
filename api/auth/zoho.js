/**
 * ZOHO OAUTH INITIATOR
 * Redirects the user to Zoho's authorization page.
 */

export default function handler(req, res) {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const redirectUri = `https://${req.headers.host}/api/auth/callback`;
    
    // Scopes needed for the portal
    const scopes = [
        'ZohoCRM.modules.ALL',
        'ZohoCRM.settings.ALL',
        'ZohoCRM.users.READ'
    ].join(',');

    const authUrl = `https://accounts.zoho.com/oauth/v2/auth?scope=${scopes}&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=${redirectUri}&prompt=consent`;

    res.redirect(authUrl);
}
