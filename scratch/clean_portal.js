const fs = require('fs');
const path = require('path');

const ENTITIES = {
    'é': '&eacute;', 'è': '&egrave;', 'ê': '&ecirc;', 'ë': '&euml;',
    'à': '&agrave;', 'â': '&acirc;', 'ç': '&ccedil;', 'î': '&icirc;',
    'ï': '&iuml;', 'ô': '&ocirc;', 'û': '&ucirc;', 'ù': '&ugrave;',
    'É': '&Eacute;', 'È': '&Egrave;', 'À': '&Agrave;', 'ç': '&ccedil;',
    '📲': '&#x1f4f1;', '▼': '&#25bc;', '✔': '&#2713;', '—': '&mdash;',
    '…': '&hellip;', '🏆': '&#x1f3c6;', '📍': '&#x1f4cc;', '🗓': '&#x1f5d3;',
    '✅': '&#x2705;', '☎': '&#x260e;', '✉': '&#x1f4e7;', '📞': '&#x1f4de;',
    '🏠': '&#x1f3e0;', '🚀': '&#x1f680;', '🌟': '&#x1f31f;', '⭐': '&#x2b50;',
    '🎉': '&#x1f389;', '🥂': '&#x1f942;', '🤝': '&#x1f91d;', '🔐': '&#x1f510;',
    '💰': '&#x1f4b0;', '🔍': '&#x1f50d;', '🛡': '&#x1f6e1;', '✒': '&#x2712;',
    '📦': '&#x1f4e6;', '🧹': '&#x1f4f9;', '✨': '&#x2728;', '📊': '&#x1f4ca;',
    '⚠️': '&#x26a0;'
};

function cleanContent(content) {
    // First, fix previous double-encoding if any (common corruption patterns)
    content = content.replace(/ÃƒÂ©/g, 'é').replace(/Ã©/g, 'é');
    content = content.replace(/ÃƒÂ¨/g, 'è').replace(/Ã¨/g, 'è');
    content = content.replace(/ÃƒÂ /g, 'à').replace(/Ã /g, 'à');
    content = content.replace(/ÃƒÂ«/g, 'ë').replace(/Ã«/g, 'ë');
    content = content.replace(/Ãƒâ€°/g, 'É').replace(/Ãâ€°/g, 'É');
    content = content.replace(/Ã¹/g, 'ù');
    content = content.replace(/ÃƒÂ´/g, 'ô').replace(/Ã´/g, 'ô');
    content = content.replace(/ÃƒÂ§/g, 'ç').replace(/Ã§/g, 'ç');
    content = content.replace(/Ã¢â‚¬â€/g, '—').replace(/Ã¢â‚¬Â¦/g, '…');
    content = content.replace(/Ã°Å¸â€œÂ²/g, '📲');
    content = content.replace(/Ã°Å¸â€˜Â¨Ã¢â‚¬Â Ã°Å¸â€™Â¼/g, '👨‍💼');
    content = content.replace(/Ã°Å¸Â¤Â/g, '🤝');
    
    // Global replacement for all defined entities
    let cleaned = content;
    for (const [char, entity] of Object.entries(ENTITIES)) {
        cleaned = cleaned.split(char).join(entity);
    }
    return cleaned;
}

const SNIPPET_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const ROOT_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

let snippetContent = fs.readFileSync(SNIPPET_PATH, 'utf8');
let cleanedSnippet = cleanContent(snippetContent);

// Update version and SW ref
cleanedSnippet = cleanedSnippet.replace(/CACHE_VERSION = 'v[0-9]+'/g, "CACHE_VERSION = 'v8'");

fs.writeFileSync(SNIPPET_PATH, cleanedSnippet, 'utf8');
console.log('Snippet cleaned.');

// For mon-dossier.html, we use the snippet logic but ensure <html> structure is intact.
// Actually, it's easier to just copy the snippet into mon-dossier.html and wrap it.
// But mon-dossier.html has a Nav bar which isn't in the snippet.

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
        
        /* APP NAVBAR */
        .app-nav {
            padding: env(safe-area-inset-top, 20px) 25px 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(15, 5, 13, 0.85);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            position: sticky;
            top: 0;
            z-index: 10000;
        }
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
console.log('Root portal (mon-dossier.html) synchronized and cleaned.');
