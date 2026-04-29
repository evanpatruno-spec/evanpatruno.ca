const fs = require('fs');
const path = require('path');

console.log('🔄 Construction de mon-dossier.html à partir des snippets...');

try {
    const markup = fs.readFileSync(path.join(__dirname, 'snippets', 'portal', 'portal_markup.html'), 'utf8');
    const styles = fs.readFileSync(path.join(__dirname, 'snippets', 'portal', 'portal_styles.html'), 'utf8');
    const scripts = fs.readFileSync(path.join(__dirname, 'snippets', 'portal', 'portal_scripts.html'), 'utf8');

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Portail Client Privé | Evan Patruno</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;800;900&family=Outfit:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
    <link rel="manifest" href="/manifest.json">
    ${styles}
</head>
<body>
    ${markup}
    ${scripts}
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(reg => {
                    console.log('Service Worker registered', reg);
                }).catch(err => {
                    console.error('Service Worker registration failed', err);
                });
            });
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(__dirname, 'mon-dossier.html'), html);
    console.log('✅ mon-dossier.html a été généré avec succès !');
} catch (error) {
    console.error('❌ Erreur lors de la construction :', error.message);
    process.exit(1);
}
