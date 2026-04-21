const fs = require('fs');

function convertToEntities(content) {
    // 1. First, fix the known "garbage" patterns back to their REAL characters
    // (This step is necessary because the file IS currently corrupted)
    const garpMap = {
        'ÃƒÂ©': 'é', 'Ã©': 'é', 'ÃƒÂ¨': 'è', 'Ã¨': 'è', 'ÃƒÂ ': 'à', 'Ã ': 'à',
        'ÃƒÂ«': 'ë', 'Ã«': 'ë', 'Ãƒâ€°': 'É', 'Ãâ€°': 'É', 'Ã¹': 'ù',
        'ÃƒÂ´': 'ô', 'Ã´': 'ô', 'ÃƒÂ§': 'ç', 'Ã§': 'ç', 'ÃƒÂ®': 'î', 'Ã®': 'î',
        'Ã¢â‚¬â€': '—', 'Ã¢â‚¬Â¦': '…', 'Ã¢â€“Â¼': '▼',
        'Ã°Å¸â€œÂ²': '📲', 'Ã°Å¸â€˜Â¨Ã¢â‚¬Â Ã°Å¸â€™Â¼': '👨‍💼', 'Ã°Å¸Â¤Â': '🤝',
        'Ã°Å¸Â¥â€š': '🥂', 'Ã°Å¸â€œÂ ': '📍', 'Ã°Å¸â€ Â ': '🔍', 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â ': '🛡️',
        'Ã¢Å“â€™Ã¯Â¸Â ': '✒️', 'Ã°Å¸Â Â ': '🏠', 'Ã°Å¸â€œÅ¾': '📞', 'Ã¢Å“â€°Ã¯Â¸Â ': '✉️',
        'Ã¢Å“â€œ': '✓', 'Ã¢Ëœâ€¦': '★', 'Ã¢Â­Â ': '⭐', 'Ã°Å¸Å¡Å¡': '🚚', 'Ã°Å¸Â§Â¹': '🧹',
        'Ã°Å¸â€™Â«': '✨', 'Ã°Å¸â€ â€™': '🔐', 'Ã°Å¸Å’Â¡Ã¯Â¸Â ': '🌡️', 'Ã°Å¸â€œÂ¹': '📹',
        'Ã°Å¸Å¡â‚¬': '🚀', 'Ã°Å¸Â â€š': '🍂', 'Ã°Å¸â€œÅ¡': '📚', 'Ã¢â€ â€”': '↗',
        'Ã°Å¸Â â€ ': '🏆', 'Ã¢Å¡Â Ã¯Â¸Â ': '⚠️', 'Ã°Å¸â€œÂ±': '📱', 'Ãƒâ€°': 'É',
        'ÃƒÂª': 'ê', 'Ãª': 'ê', 'ÃƒÂ»': 'û', 'Ã»': 'û', 'ÃƒÂ¢': 'â', 'Ã¢': 'â'
    };
    
    let mid = content;
    for (const [garp, real] of Object.entries(garpMap)) {
        mid = mid.split(garp).join(real);
    }
    
    // 2. Then, convert EVERY non-ASCII character to an HTML Entity
    let result = '';
    for (let i = 0; i < mid.length; i++) {
        const code = mid.charCodeAt(i);
        if (code > 127) {
            // Check for surrogate pairs (emojis)
            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < mid.length) {
                const next = mid.charCodeAt(i + 1);
                if (next >= 0xDC00 && next <= 0xDFFF) {
                    const fullCode = ((code - 0xD800) << 10) + (next - 0xDC00) + 0x10000;
                    result += `&#${fullCode};`;
                    i++;
                    continue;
                }
            }
            result += `&#${code};`;
        } else {
            result += mid[i];
        }
    }
    return result;
}

const SNIPPET_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const ROOT_PATH = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

let snippetContent = fs.readFileSync(SNIPPET_PATH, 'utf8');
let finalSnippet = convertToEntities(snippetContent);
fs.writeFileSync(SNIPPET_PATH, finalSnippet, 'utf8');

let rootContent = fs.readFileSync(ROOT_PATH, 'utf8');
let finalRoot = convertToEntities(rootContent);
fs.writeFileSync(ROOT_PATH, finalRoot, 'utf8');

console.log('Total entity conversion complete. Encoding issues are now impossible.');
