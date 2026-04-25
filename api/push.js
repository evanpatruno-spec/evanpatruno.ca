/**
 * API : ENVOI DE NOTIFICATIONS PUSH FCM (v1.0)
 */

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token, title, body, icon, url } = req.body;

    if (!token || !title || !body) {
        return res.status(400).json({ error: 'Missing parameters (token, title, body)' });
    }

    // NOTE : Nous utilisons l'API Legacy FCM pour la simplicité de configuration initiale.
    // L'utilisateur devra ajouter FBCM_SERVER_KEY dans les variables d'environnement Vercel.
    const SERVER_KEY = process.env.FBCM_SERVER_KEY;

    if (!SERVER_KEY) {
        return res.status(500).json({ error: 'FCM Server Key not configured on Vercel' });
    }

    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${SERVER_KEY}`
            },
            body: JSON.stringify({
                to: token,
                notification: {
                    title: title,
                    body: body,
                    icon: icon || "https://dossier.evanpatruno.ca/pwa-icon-192.png",
                    click_action: url || "https://dossier.evanpatruno.ca/mon-dossier.html"
                },
                data: {
                    url: url || "https://dossier.evanpatruno.ca/mon-dossier.html"
                }
            })
        });

        const result = await response.json();
        return res.status(200).json({ success: true, result });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
