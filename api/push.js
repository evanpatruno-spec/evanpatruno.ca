import { JWT } from 'google-auth-library';

/**
 * API : ENVOI DE NOTIFICATIONS PUSH FCM (v1.0 - HTTP v1 API)
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, title, body, icon, url, secret } = req.body;

    // Protection par clé secrète si PUSH_API_SECRET est défini dans Vercel
    const expectedSecret = process.env.PUSH_API_SECRET;
    const authHeader = req.headers.authorization || '';
    if (expectedSecret && secret !== expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
        return res.status(401).json({ error: 'Unauthorized push request' });
    }

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing parameters (token, title, body)' });
    }

    // Validation de l'URL de redirection pour éviter le phishing
    const safeUrl = (url && (url.startsWith('https://dossier.evanpatruno.ca') || url.startsWith('https://www.evanpatruno.ca') || url.startsWith('https://evanpatruno-ca.vercel.app') || url.startsWith('/')))
        ? url
        : "https://dossier.evanpatruno.ca/mon-dossier.html";

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
                        body: body
                    },
                    data: {
                        title: title,
                        body: body,
                        url: safeUrl
                    },
                    webpush: {
                        notification: {
                            icon: "https://dossier.evanpatruno.ca/pwa-icon-192.png",
                            tag: "ep-portal-notif",
                            renotify: true,
                            requireInteraction: true,
                            actions: [
                                {
                                    action: "open_url",
                                    title: "Voir le dossier"
                                }
                            ]
                        },
                        fcm_options: {
                            link: safeUrl
                        }
                    },
                    android: {
                        priority: "high"
                    },
                    apns: {
                        payload: {
                            aps: {
                                sound: "default",
                                "content-available": 1
                            }
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
