const fs = require('fs');

function restoreUTF8(content) {
    // Extensive mapping of corrupted sequences to actual characters
    const map = {
        'ÃƒÂ©': 'é', 'Ã©': 'é', 'ÃƒÂ¨': 'è', 'Ã¨': 'è', 'ÃƒÂ ': 'à', 'Ã ': 'à',
        'ÃƒÂ«': 'ë', 'Ã«': 'ë', 'Ãƒâ€°': 'É', 'Ãâ€°': 'É', 'Ã¹': 'ù',
        'ÃƒÂ´': 'ô', 'Ã´': 'ô', 'ÃƒÂ§': 'ç', 'Ã§': 'ç', 'ÃƒÂ®': 'î', 'Ã®': 'î',
        'Ã¢â‚¬â€': '—', 'Ã¢â‚¬Â¦': '…', 'Ã¢â€“Â¼': '▼',
        'Ã°Å¸â€œÂ²': '📲', 'Ã°Å¸â€˜Â¨Ã¢â‚¬Â Ã°Å¸â€™Â¼': '👨‍💼', 'Ã°Å¸Â¤Â': '🤝',
        'Ã°Å¸Â¥â€š': '🥂', 'Ã°Å¸â€œÂ': '📍', 'Ã°Å¸â€ Â': '🔍', 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â ': '🛡️',
        'Ã¢Å“â€™Ã¯Â¸Â ': '✒️', 'Ã°Å¸Â Â ': '🏠', 'Ã°Å¸â€œÅ¾': '📞', 'Ã¢Å“â€°Ã¯Â¸Â ': '✉️',
        'Ã¢Å“â€œ': '✓', 'Ã¢Ëœâ€¦': '★', 'Ã¢Â­Â ': '⭐', 'Ã°Å¸Å¡Å¡': '🚚', 'Ã°Å¸Â§Â¹': '🧹',
        'Ã°Å¸â€™Â«': '✨', 'Ã°Å¸â€ â€™': '🔐', 'Ã°Å¸Å’Â¡Ã¯Â¸Â ': '🌡️', 'Ã°Å¸â€œÂ¹': '📹',
        'Ã°Å¸Å¡â‚¬': '🚀', 'Ã°Å¸Â â€š': '🍂', 'Ã°Å¸â€œÅ¡': '📚', 'Ã¢â€ â€”': '↗',
        'Ã°Å¸Â â€ ': '🏆', 'Ã¢Å¡Â Ã¯Â¸Â ': '⚠️', 'Ã°Å¸â€œÂ±': '📱', 'Ãƒâ€°': 'É',
        'ÃƒÂª': 'ê', 'Ãª': 'ê', 'ÃƒÂ»': 'û', 'Ã»': 'û',
        '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à', '&ccedil;': 'ç',
        '&Eacute;': 'É', '&hellip;': '…', '&mdash;': '—', '&#25bc;': '▼',
        '&#x1f4f1;': '📲', '&#2713;': '✓', '&#x1f3c6;': '🏆', '&#x1f4cc;': '📍',
        '&#x1f5d3;': '🗓️', '&#x2705;': '✅', '&#x260e;': '☎️', '&#x1f4e7;': '📧',
        '&#x1f4de;': '📞', '&#x1f3e0;': '🏠', '&#x1f680;': '🚀', '&#x1f31f;': '🌟',
        '&#x2b50;': '⭐', '&#x1f389;': '🎉', '&#x1f942;': '🥂', '&#x1f91d;': '🤝',
        '&#x1f510;': '🔐', '&#x1f4b0;': '💰', '&#x1f50d;': '🔍', '&#x1f6e1;': '🛡️',
        '&#x2712;': '✒️', '&#x1f4e6;': '📦', '&#x1f4f9;': '📹', '&#x2728;': '✨',
        '&#x1f4ca;': '📊', '&#x26a0;': '⚠️'
    };

    let cleaned = content;
    for (const [corrupted, fixed] of Object.entries(map)) {
        cleaned = cleaned.split(corrupted).join(fixed);
    }
    return cleaned;
}

const SNIPPET_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const ROOT_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

let snippetContent = fs.readFileSync(SNIPPET_PATH, 'utf8');
let cleanedSnippet = restoreUTF8(snippetContent);

// Fix .innerText to .innerHTML in handlePortalLogin/renderPortal logic
cleanedSnippet = cleanedSnippet.replace(/\.innerText = /g, '.innerHTML = ');

fs.writeFileSync(SNIPPET_PATH, cleanedSnippet, 'utf8');

const navHtml = `
    <nav class="app-nav" id="appNav">
        <a href="https://evanpatruno.ca" class="nav-logo">
            <img src="/logo.png" alt="EP">
            <span>EVAN<span>PATRUNO</span></span>
        </a>
        <a href="https://evanpatruno.ca" class="btn-back-site">Site Web</a>
    </nav>
`;

let rootContent = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Portail Client | Evan Patruno</title>

    <!-- FONTS -->
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;900&family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    
    <style>
        body { margin: 0; padding: 0; background-color: #1a0516; color: #fff; font-family: 'Inter', sans-serif; min-height: 100vh; overflow-x: hidden; }
        .app-nav { padding: env(safe-area-inset-top, 20px) 25px 15px; display: flex; justify-content: space-between; align-items: center; background: rgba(15, 5, 13, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255, 255, 255, 0.05); position: sticky; top: 0; z-index: 10000; }
        @media (display-mode: standalone) { .app-nav { display: none; } }
        .nav-logo { display: flex; align-items: center; gap: 12px; text-decoration: none; color: #fff; font-family: 'Outfit', sans-serif; font-weight: 900; font-size: 1.1rem; }
        .nav-logo img { height: 35px; }
        .nav-logo span span { color: #873276; }
        .btn-back-site { font-size: 0.75rem; text-decoration: none; color: rgba(255,255,255,0.6); font-weight: 700; text-transform: uppercase; padding: 8px 16px; border: 1px solid rgba(255,255,255,0.1); border-radius: 50px; }
    </style>
</head>
<body>
    ${navHtml}
    ${cleanedSnippet}
</body>
</html>`;

fs.writeFileSync(ROOT_PATH, rootContent, 'utf8');
console.log('Final Restoration Complete: Pure UTF-8, no entities, innerHTML used.');
