import { JWT } from 'google-auth-library';

/**
 * API : ENVOI DE NOTIFICATIONS PUSH FCM (v1.0 - HTTP v1 API)
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, title, body, icon, url } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing parameters (token, title, body)' });
    }

    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    const privateKey = process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        return res.status(500).json({ error: 'FCM Credentials not fully configured on Vercel' });
    }

    try {
        // 1. Authentification avec JWT pour FCM v1
        const client = new JWT({
            email: clientEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });

        const tokenResponse = await client.authorize();
        const accessToken = tokenResponse.access_token;

        // 2. Envoi de la notification via l'API v1
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        
        const response = await fetch(fcmUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                message: {
                    token: token,
                    notification: {
                        title: title,
                        body: body,
                        icon: icon || "https://dossier.evanpatruno.ca/pwa-icon-192.png",
                        tag: "ep-portal-notif"
                    },
                    webpush: {
                        notification: {
                            icon: icon || "https://dossier.evanpatruno.ca/pwa-icon-192.png",
                            tag: "ep-portal-notif",
                            actions: [
                                {
                                    action: "open_url",
                                    title: "Voir le dossier"
                                }
                            ]
                        },
                        fcm_options: {
                            link: url || "https://dossier.evanpatruno.ca/mon-dossier.html"
                        }
                    }
                }
            })
        });

        const result = await response.json();
        return res.status(200).json({ success: true, result });
    } catch (error) {
        console.error("FCM v1 Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
