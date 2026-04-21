const fs = require('fs');

function finalizeIcons(content) {
    // Extensive mapping of corrupted sequences or raw emojis to HTML entities
    // This makes the icons IMMUNE to encoding issues.
    const map = {
        'Ã°Å¸â€œÂ²': '&#128242;', '📲': '&#128242;',
        'Ã°Å¸â€˜Â¨Ã¢â‚¬Â Ã°Å¸â€™Â¼': '&#128188;', '👨‍💼': '&#128188;',
        'Ã°Å¸Â¤Â': '&#129309;', '🤝': '&#129309;',
        'Ã°Å¸Â¥â€š': '&#129346;', '🥂': '&#129346;',
        'Ã°Å¸â€œÂ': '&#128205;', '📍': '&#128205;',
        'Ã°Å¸â€ Â': '&#128269;', '🔍': '&#128269;',
        'Ã°Å¸â€ºÂ¡Ã¯Â¸Â ': '&#128737;', '🛡️': '&#128737;',
        'Ã¢Å“â€™Ã¯Â¸Â ': '&#10002;', '✒️': '&#10002;',
        'Ã°Å¸Â Â ': '&#127968;', '🏠': '&#127968;',
        'Ã°Å¸â€œÅ¾': '&#128222;', '📞': '&#128222;',
        'Ã¢Å“â€°Ã¯Â¸Â ': '&#9993;', '📧': '&#9993;', '✉️': '&#9993;',
        'Ã¢Å“â€œ': '&#10003;', '✓': '&#10003;',
        'Ã¢Ëœâ€¦': '&#9733;', '★': '&#9733;',
        'Ã¢Â­Â ': '&#11088;', '⭐': '&#11088;',
        'Ã°Å¸Å¡Å¡': '&#128666;', '🚚': '&#128666;',
        'Ã°Å¸Â§Â¹': '&#129529;', '🧹': '&#129529;',
        'Ã°Å¸â€™Â«': '&#10024;', '✨': '&#10024;',
        'Ã°Å¸â€ â€™': '&#128274;', '🔐': '&#128274;',
        'Ã°Å¸Å’Â¡Ã¯Â¸Â ': '&#127777;', '🌡️': '&#127777;',
        'Ã°Å¸â€œÂ¹': '&#128249;', '📹': '&#128249;',
        'Ã°Å¸Å¡â‚¬': '&#128640;', '🚀': '&#128640;',
        'Ã°Å¸Â â€š': '&#127810;', '🍂': '&#127810;',
        'Ã°Å¸â€œÅ¡': '&#128218;', '📚': '&#128218;',
        'Ã¢â€ â€”': '&#8599;', '↗': '&#8599;',
        'Ã°Å¸Â â€': '&#127942;', '🏆': '&#127942;',
        'Ã¢Å¡Â Ã¯Â¸Â ': '&#9888;', '⚠️': '&#9888;',
        'Ã°Å¸â€œÂ±': '&#128241;', '📱': '&#128241;',
        'Ã¢â€“Â¼': '&#9660;', '▼': '&#9660;'
    };

    let cleaned = content;
    for (const [corrupted, entity] of Object.entries(map)) {
        cleaned = cleaned.split(corrupted).join(entity);
    }
    return cleaned;
}

const SNIPPET_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const ROOT_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

let snippetContent = fs.readFileSync(SNIPPET_PATH, 'utf8');
let finalSnippet = finalizeIcons(snippetContent);

fs.writeFileSync(SNIPPET_PATH, finalSnippet, 'utf8');

let rootContent = fs.readFileSync(ROOT_PATH, 'utf8');
let finalRoot = finalizeIcons(rootContent);
fs.writeFileSync(ROOT_PATH, finalRoot, 'utf8');

console.log('Icons converted to HTML entities. Portal is now bulletproof.');
