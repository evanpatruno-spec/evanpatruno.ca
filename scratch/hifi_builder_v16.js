const fs = require('fs');

/**
 * HIFI BUILDER V16 - THE FINAL FIX
 * - Based on the full V8 design.
 * - Hybrid encoding: Hex for JS, Entities for HTML.
 * - Purely ASCII output.
 */

const PATH_GOOD = 'c:/Users/evanp/.gemini/antigravity/brain/bddd28b9-350c-495d-87a2-d6c1525b7a46/good_version_utf8.html';
const PATH_SNIPPET = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const PATH_ROOT = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

let content = fs.readFileSync(PATH_GOOD, 'utf8');

// Mojibake Pre-Cleanup (Standardize to Real Chars first)
const cleanupMap = {
    'ÃƒÂ©': 'é', 'Ã©': 'é', 'ÃƒÂ¨': 'è', 'Ã¨': 'è', 'ÃƒÂ ': 'à', 'Ã ': 'à',
    'ÃƒÂ«': 'ë', 'Ã«': 'ë', 'Ãƒâ€°': 'É', 'Ãâ€°': 'É', 'Ã¹': 'ù',
    'ÃƒÂ´': 'ô', 'Ã´': 'ô', 'ÃƒÂ§': 'ç', 'Ã§': 'ç', 'ÃƒÂ®': 'î', 'Ã®': 'î',
    'Ã¢â‚¬â€': '—', 'Ã¢â‚¬Â¦': '…', 'Ã¢â€“Â¼': '▼',
    'Ã°Å¸â€œÂ²': '📲', 'Ã°Å¸â€˜Â¨Ã¢â‚¬Â Ã°Å¸â€™Â¼': '👨‍💼', 'Ã°Å¸Â¤Â': '🤝',
    'Ã°Å¸Â¥â€š': '🥂', 'Ã°Å¸â€œÂ ': '📍', 'Ã°Å¸â€ Â ': '🔍', 'Ã°Å¸â€ºÂ¡Ã¯Â¸Â ': '🛡️',
    'Ã¢Å“â€™Ã¯Â¸Â ': '✒️', 'Ã°Å¸Â Â ': '🏠', 'Ã°Å¸â€œÅ¾': '📞', 'Ã¢Å“â€°Ã¯Â¸Â ': '✉️',
    'Ã¢Å“â€œ': '✓', 'Ã¢Ëœâ€¦': '★', 'Ã¢Â­Â ': '⭐'
};
for (const [garp, real] of Object.entries(cleanupMap)) {
    content = content.split(garp).join(real);
}

// Ensure Title Colors are white
if (!content.includes('color: #fff') && !content.includes('color:#fff')) {
    content = content.replace('.section-header h3 {', '.section-header h3 {\n        color: #fff !important;');
}

/**
 * Hybrid Processor
 * Identifies parts of the file and applies different escaping.
 */
function toHex(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c > 127) {
            if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
                const next = str.charCodeAt(i+1);
                if (next >= 0xDC00 && next <= 0xDFFF) {
                    out += `\\u${c.toString(16).padStart(4, '0')}\\u${next.toString(16).padStart(4, '0')}`;
                    i++; continue;
                }
            }
            out += `\\u${c.toString(16).padStart(4, '0')}`;
        } else {
            out += str[i];
        }
    }
    return out;
}

function toEntities(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        if (c > 127) {
            if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
                const next = str.charCodeAt(i+1);
                if (next >= 0xDC00 && next <= 0xDFFF) {
                    const full = ((c - 0xD800) << 10) + (next - 0xDC00) + 0x10000;
                    out += `&#${full};`;
                    i++; continue;
                }
            }
            out += `&#${c};`;
        } else {
            out += str[i];
        }
    }
    return out;
}

// Split by <script> tags
const parts = content.split(/<script>|<\/script>/);
let final = '';
for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
        // HTML/CSS part
        final += toEntities(parts[i]);
    } else {
        // JS part
        final += '<script>' + toHex(parts[i]) + '</script>';
    }
}

fs.writeFileSync(PATH_SNIPPET, final, 'utf8');

let root = final;
if (!root.includes('<!DOCTYPE')) {
    root = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Portail Client | Evan Patruno</title></head><body>${final}</body></html>`;
}
fs.writeFileSync(PATH_ROOT, root, 'utf8');

console.log('Hybrid Hifi Restoration v16 Successful.');
