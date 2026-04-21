const fs = require('fs');

/**
 * HIGH-FIDELITY RESTORATION BUILDER
 * 1. Reads the user-approved "Good Version" (v8).
 * 2. Systematically converts all non-ASCII characters to stable Hex/Entities.
 * 3. Restores the full dashboard logic and styling.
 */

const PATH_GOOD = 'c:/Users/evanp/.gemini/antigravity/brain/bddd28b9-350c-495d-87a2-d6c1525b7a46/good_version_utf8.html';
const PATH_SNIPPET = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const PATH_ROOT = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

let content = fs.readFileSync(PATH_GOOD, 'utf8');

// Step 1: Pre-cleanup of any persistent Mojibake in the V8 source itself
const garpMap = {
    'ÃƒÂ©': 'é', 'Ã©': 'é', 'ÃƒÂ¨': 'è', 'Ã¨': 'è', 'ÃƒÂ ': 'à', 'Ã ': 'à',
    'ÃƒÂ«': 'ë', 'Ã«': 'ë', 'Ãƒâ€°': 'É', 'Ãâ€°': 'É', 'Ã¹': 'ù',
    'ÃƒÂ´': 'ô', 'Ã´': 'ô', 'ÃƒÂ§': 'ç', 'Ã§': 'ç', 'ÃƒÂ®': 'î', 'Ã®': 'î',
    'Ã¢â‚¬â€': '—', 'Ã¢â‚¬Â¦': '…', 'Ã¢â€“Â¼': '▼',
    'Ã°Å¸â€œÂ²': '📲', 'Ã°Å¸â€˜Â¨Ã¢â‚¬Â Ã°Å¸â€™Â¼': '👨‍💼', 'Ã°Å¸Â¤Â': '🤝',
    'Ã°Å¸Â¥â€š': '🥂', 'Ã°Å¸â€œÂ ': '📍', 'Ã°Å¸â€ Â ': '🔍', 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â ': '🛡️',
    'Ã¢Å“â€™Ã¯Â¸Â ': '✒️', 'Ã°Å¸Â Â ': '🏠', 'Ã°Å¸â€œÅ¾': '📞', 'Ã¢Å“â€°Ã¯Â¸Â ': '✉️',
    'Ã¢Å“â€œ': '✓', 'Ã¢Ëœâ€¦': '★', 'Ã¢Â­Â ': '⭐'
};
for (const [garp, real] of Object.entries(garpMap)) {
    content = content.split(garp).join(real);
}

// Step 2: Conversion logic
function stabilize(str) {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 127) {
            // Handle surrogates (emojis)
            if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
                const next = str.charCodeAt(i + 1);
                if (next >= 0xDC00 && next <= 0xDFFF) {
                    const fullCode = ((code - 0xD800) << 10) + (next - 0xDC00) + 0x10000;
                    result += `&#${fullCode};`;
                    i++;
                    continue;
                }
            }
            // For JS code blocks, we might want \uXXXX, but for HTML/CSS Entities are safer.
            // Actually, innerHTML handles Entities perfectly even in JS strings.
            result += `&#${code};`;
        } else {
            result += str[i];
        }
    }
    return result;
}

// Separate JS and HTML to apply different escaping if needed?
// No, the safest is to convert everything to entities. InnerHTML will render them,
// and the Browser's JS parser handles characters in strings fine if they are ASCII entities.
// WAIT: if I put an entity in a JS string like: const s = "&#233;"; 
// if I then do element.innerHTML = s; -> It RENDERS 'é'. PERFECT.
// So total entity conversion is the WINNING strategy.

const finalContent = stabilize(content);

// Final sanity check: ensure title colors are white
// Search for .section-header h3 and ensure color: #fff
let refined = finalContent;
if (!refined.includes('color: #fff') && !refined.includes('color:#fff')) {
    refined = refined.replace('.section-header h3 {', '.section-header h3 {\n        color: #fff !important;');
}

fs.writeFileSync(PATH_SNIPPET, refined, 'utf8');

// For mon-dossier, we wrap it in a proper DOCTYPE if it's not already there
let rootContent = refined;
if (!rootContent.includes('<!DOCTYPE')) {
    rootContent = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Portail Client | Evan Patruno</title></head><body>${refined}</body></html>`;
}
fs.writeFileSync(PATH_ROOT, rootContent, 'utf8');

console.log('High-Fidelity Restoration Complete. Entity Isolation Applied.');
