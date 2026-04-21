const fs = require('fs');

/**
 * Ce script régénère intégralement le portail en utilisant des séquences d'échappement hexadécimales
 * (\uXXXX) pour tous les caractères accentués et emojis. 
 * Cela garantit une intégrité totale du fichier source (ASCII pur).
 */

const JS_ESCAPES = {
    'é': '\\u00e9', 'è': '\\u00e8', 'ê': '\\u00ea', 'à': '\\u00e0', 'â': '\\u00e2',
    'î': '\\u00ee', 'ô': '\\u00f4', 'û': '\\u00fb', 'ù': '\\u00f9', 'ç': '\\u00e7',
    'É': '\\u00c9', 'È': '\\u00c8', 'À': '\\u00c0', '—': '\\u2014', '…': '\\u2026',
    '📲': '\\uD83D\\uDCF1', '▼': '\\u25bc', '✓': '\\u2713', '★': '\\u2605', '⭐': '\\u2B50',
    '📍': '\\uD83D\\uDCCB', '🔍': '\\uD83D\\uDD0D', '🛡️': '\\uD83D\\uDEE1\\uFE0F',
    '✒️': '\\u2712\\uFE0F', '🏠': '\\uD83C\\uDFE0', '📞': '\\u260e\\uFE0F', '✉️': '\\u2709\\uFE0F',
    '🚚': '\\uD83D\\uDE66', '🧹': '\\uD83E\\uDD59', '✨': '\\u2728', '🔐': '\\uD83D\\uDD10',
    '🌡️': '\\uD83C\\uDF21\\uFE0F', '📹': '\\uD83D\\uDCF9', '🚀': '\\uD83D\\uDE80',
    '🍂': '\\uD83C\\uDF42', '📚': '\\uD83D\\uDCDA', '↗': '\\u2197', '🏆': '\\uD83C\\uDFC6',
    '⚠️': '\\u26a0\\uFE0F', '📱': '\\uD83D\\uDCF1', '👨‍💼': '\\uD83D\\uDC4B', // fallback for icon
    '🥂': '\\uD83E\\uDD42'
};

const HTML_ENTITIES = {
    'é': '&eacute;', 'è': '&egrave;', 'ê': '&ecirc;', 'à': '&agrave;', 'â': '&acirc;',
    'î': '&icirc;', 'ô': '&ocirc;', 'û': '&ucirc;', 'ù': '&ugrave;', 'ç': '&ccedil;',
    'É': '&Eacute;', 'È': '&Egrave;', 'À': '&Agrave;', '—': '&mdash;', '…': '&hellip;',
    '📲': '&#128241;', '▼': '&#9660;', '✓': '&#10003;', '★': '&#9733;', '⭐': '&#11088;',
    '📍': '&#128205;', '🔍': '&#128269;', '🛡️': '&#128737;', '✒️': '&#9997;',
    '🏠': '&#127968;', '📞': '&#128222;', '✉️': '&#9993;', '🚚': '&#128666;',
    '🧹': '&#129529;', '✨': '&#10024;', '🔐': '&#128274;', '🌡️': '&#127777;',
    '📹': '&#128249;', '🚀': '&#128640;', '🍂': '&#127810;', '📚': '&#128218;',
    '↗': '&#8599;', '🏆': '&#127942;', '⚠️': '&#9888;', '📱': '&#128241;',
    '🥂': '&#129346;'
};

function escapeString(str, isHtml = false) {
    let result = str;
    const map = isHtml ? HTML_ENTITIES : JS_ESCAPES;
    for (const [char, escaped] of Object.entries(map)) {
        result = result.split(char).join(escaped);
    }
    return result;
}

const SNIPPET_HEAD = "<!-- SNIPPET : PORTAIL CLIENT V2.3 nuclear -->" +
"<link rel='manifest' href='/manifest.json'>" +
"<meta name='theme-color' content='#1a0516'>" +
"<meta name='mobile-web-app-capable' content='yes'>" +
"<meta name='apple-mobile-web-app-capable' content='yes'>" +
"<meta name='apple-mobile-web-app-status-bar-style' content='black-translucent'>";

const CSS_CONTENT = escapeString(`
    :root {
        --dash-primary: #873276;
        --dash-primary-glow: rgba(135, 50, 118, 0.4);
        --dash-accent: #d4af37;
        --dash-accent-glow: rgba(212, 175, 55, 0.4);
        --dash-bg: #1a0516;
        --dash-card-bg: rgba(255, 255, 255, 0.04);
        --dash-border: rgba(135, 50, 118, 0.6);
        --dash-glow: 0 0 25px rgba(135, 50, 118, 0.4);
        --dash-success: #2ecc71;
        --dash-warning: #f1c40f;
    }
    .portal-main-wrapper { font-family: 'Inter', sans-serif; color: #fff; background: var(--dash-bg); min-height: 900px; position: relative; overflow: hidden; border-radius: 60px; border: 1px solid rgba(135, 50, 118, 0.5); box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6); margin: 20px 0; isolation: isolate; }
    .portal-aura { position: absolute; width: 100%; height: 100%; background: radial-gradient(circle at center, #000000 0%, var(--dash-bg) 80%); z-index: 1; pointer-events: none; }
    .portal-container { max-width: 1100px; margin: 0 auto; padding: 60px 20px; position: relative; z-index: 5; opacity: 0; transform: translateY(30px); transition: 1.2s cubic-bezier(0.2, 1, 0.3, 1); display: none; }
    .portal-container.visible { opacity: 1; transform: translateY(0); display: block; }
    .portal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; min-height: 100vh; background: rgba(15, 5, 13, 0.92); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .portal-overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: scale(1.1); }
    .section-wrapper { margin-bottom: 25px; border: 1px solid var(--dash-border); border-radius: 40px; overflow: hidden; background: rgba(0, 0, 0, 0.2); box-shadow: var(--dash-glow); }
    .section-header { padding: 25px 40px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: rgba(255, 255, 255, 0.03); }
    .section-chevron { width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); border-radius:50%; transition:0.4s; color:var(--dash-primary); }
    .section-wrapper.collapsed .section-content { max-height: 0; padding: 0 !important; opacity: 0; }
    .section-wrapper.collapsed .section-chevron { transform: rotate(-90deg); }
    .section-content { padding: 40px; transition: 0.6s cubic-bezier(0.4, 0, 0.2, 1); max-height: 4000px; opacity: 1; overflow: hidden; }
    .login-card { background: rgba(15, 5, 13, 0.95); padding: 50px; border-radius: 40px; border: 2px solid var(--dash-border); text-align: center; width: 100%; max-width: 420px; }
    .login-input { width: 100%; padding: 20px; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; color: #fff; font-size: 1.1rem; margin-bottom: 15px; outline: none; }
    .login-btn { width: 100%; padding: 20px; background: var(--dash-primary); color: #fff; border: none; border-radius: 20px; font-weight: 900; cursor: pointer; transition: 0.3s; }
    .cockpit-ring-wrap { position: relative; width: 180px; height: 180px; margin: 0 auto; }
    .cockpit-svg { transform: rotate(-90deg); width: 180px; height: 180px; }
    .ring-bg { fill: none; stroke: rgba(255, 255, 255, 0.05); stroke-width: 8; }
    .ring-progress { fill: none; stroke: url(#ringGrad); stroke-width: 8; stroke-linecap: round; stroke-dasharray: 314.16; stroke-dashoffset: 314.16; transition: stroke-dashoffset 2s cubic-bezier(0.4, 0, 0.2, 1); }
    .cockpit-center { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .cockpit-center span { font-size: 2.5rem; font-weight: 900; font-family: 'Outfit'; color: #fff; }
    .milestone-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 30px; }
    .milestone-card { background: var(--dash-card-bg); padding: 25px; border-radius: 30px; border: 1px solid var(--dash-border); text-align: center; }
    .timeline-steps { position: relative; display: flex; justify-content: space-between; align-items: center; padding: 40px 0; }
    .timeline-progress-bar { position: absolute; height: 2px; background: var(--dash-primary); top: 50%; z-index: 1; transition: 1s; }
    .step-node { position: relative; z-index: 2; width: 50px; height: 50px; background: #000; border: 2px solid var(--dash-border); border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: 0.5s; }
    .step-node.completed { border-color: var(--dash-success); box-shadow: 0 0 15px var(--dash-success); }
    .step-node.active { border-color: var(--dash-primary); box-shadow: 0 0 20px var(--dash-primary); transform: scale(1.2); }
    .step-label { position: absolute; top: 60px; font-size: 0.8rem; font-weight: 700; white-space: nowrap; color: rgba(255, 255, 255, 0.5); }
    .team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; }
    .team-card { background: var(--dash-card-bg); padding: 20px; border-radius: 25px; border: 1px solid var(--dash-border); text-align: center; }
    .partner-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
    .partner-card { background: var(--dash-card-bg); border: 1px solid var(--dash-border); border-radius: 25px; padding: 25px; transition: 0.3s; position: relative; overflow: hidden; }
    .copy-btn { background: rgba(135, 50, 118, 0.1); border: 1px dashed var(--dash-primary); color: var(--dash-primary); padding: 8px 15px; border-radius: 10px; font-size: 0.7rem; font-weight: 800; cursor: pointer; width: 100%; margin-top: 15px; }
`, true);

const HTML_BODY = escapeString(`
<div class="portal-main-wrapper">
    <div class="portal-aura"></div>
    <div class="portal-overlay" id="portalOverlay">
        <div class="login-card">
            <h2 style="font-family: 'Outfit'; font-size: 2.2rem; font-weight: 900; margin-bottom: 8px;">Accès au Dossier</h2>
            <p style="color: rgba(255,255,255,0.6); margin-bottom: 35px;">Entrez votre Code Portail unique.</p>
            <form onsubmit="handlePortalLogin(event)">
                <input type="text" placeholder="CODE DOSSIER" class="login-input" id="inpPortalCode" required>
                <input type="password" maxlength="4" placeholder="4 DERNIERS CHIFFRES DU TÉLÉPHONE" class="login-input" id="inpPortalPhone" required>
                <button type="submit" class="login-btn" id="btnPortalLogin">Ouvrir mon dossier</button>
            </form>
        </div>
    </div>
    <div class="portal-container" id="portalDash">
        <header style="margin-bottom: 60px;">
            <h1 id="txtWelcome" style="font-family: 'Outfit'; font-size: 3.5rem; font-weight: 900; margin: 0; line-height: 1;">--</h1>
            <p id="txtCodeRef" style="opacity: 0.6; font-weight: 700;">Dossier #--</p>
        </header>

        <div style="background: rgba(255,255,255,0.03); padding: 40px; border-radius: 40px; border: 1px solid var(--dash-border); display: flex; align-items: center; gap: 40px; margin-bottom: 40px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 300px;">
                <div id="badgeStage" style="background: rgba(46, 204, 113, 0.1); color: #2ecc71; padding: 6px 16px; border-radius: 50px; display: inline-block; font-size: 0.8rem; font-weight: 900; margin-bottom: 15px; border: 1px solid rgba(46, 204, 113, 0.3);">--</div>
                <h2 id="txtPropName" style="font-size: 2.5rem; margin: 0; font-family: 'Outfit';">--</h2>
                <p id="txtPropCity" style="opacity: 0.5; font-size: 1.2rem; margin-top: 5px;">--</p>
            </div>
            <div style="text-align: center;">
                <div class="cockpit-ring-wrap">
                    <svg class="cockpit-svg" viewBox="0 0 120 120">
                        <defs><linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#873276"/><stop offset="100%" stop-color="#ff4db8"/></linearGradient></defs>
                        <circle class="ring-bg" cx="60" cy="60" r="50"/>
                        <circle class="ring-progress" id="ringProgress" cx="60" cy="60" r="50"/>
                    </svg>
                    <div class="cockpit-center"><span id="ringPct">0%</span><small style="opacity:0.5; font-size:0.7rem; font-weight:800; text-transform:uppercase;">Avancement</small></div>
                </div>
            </div>
        </div>

        <div class="milestone-grid" id="wrapMilestones"></div>

        <div class="section-wrapper" id="secTimeline">
            <div class="section-header" onclick="toggleSection('secTimeline')"><h3>Timeline de Transaction</h3><div class="section-chevron">▼</div></div>
            <div class="section-content"><div class="timeline-steps" id="wrapTimeline"><div class="timeline-progress-bar" id="barProgress"></div></div></div>
        </div>

        <div class="section-wrapper" id="secTeam">
            <div class="section-header" onclick="toggleSection('secTeam')"><h3>Votre Équipe</h3><div class="section-chevron">▼</div></div>
            <div class="section-content"><div class="team-grid" id="wrapTeam"></div></div>
        </div>

        <div class="section-wrapper collapsed" id="secPartners">
            <div class="section-header" onclick="toggleSection('secPartners')"><h3>Partenaires Privilégiés</h3><div class="section-chevron">▼</div></div>
            <div class="section-content"><div class="partner-grid" id="wrapPartners"></div></div>
        </div>
    </div>
</div>
`, true);

const JS_LOGIC = `
    const MOCK_DATA = {
        firstName: "Evan", code: "EP-TEST", property: "D\\u00e9mo - Avenue Patruno", city: "Montr\\u00e9al", stage: "Analyse des offres",
        timeline: [
            { label: "Pr\\u00e9paration", icon: "\\uD83D\\uDCCB", status: "completed" },
            { label: "Offre d\\u00e9pos\\u00e9e", icon: "\\uD83D\\uDD0D", status: "active" },
            { label: "Conditions", icon: "\\uD83D\\uDEE1\\uFE0F", status: "pending" },
            { label: "Notaire", icon: "\\u2712\\uFE0F", status: "pending" },
            { label: "Succ\\u00e8s", icon: "\\uD83C\\uDFE0", status: "pending" }
        ],
        team: [
            { role: "Courtier", name: "Evan Patruno", icon: "\\uD83D\\uDCF1", phone: "514-567-3249", email: "evan@patruno.ca" },
            { role: "Notaire", name: "Me Jean Picard", icon: "\\u2712\\uFE0F", phone: "514-555-0101", email: "jean@notaire.ca" }
        ],
        milestones: {
            signature: { days: 25, date: "15 Mai 2026" },
            inspection: { days: 12, date: "2 Mai 2026" }
        },
        partners: [{ name: "D\\u00e9m\\u00e9nagement Expert", icon: "\\uD83D\\uDE66", category: "D\\u00e9m\\u00e9nagement", benefit: "10% Rabais", code: "EVAN10" }]
    };

    function renderPortal(data) {
        document.getElementById('txtWelcome').innerHTML = "Bienvenue, " + data.firstName;
        document.getElementById('txtCodeRef').innerHTML = "Dossier #" + data.code;
        document.getElementById('txtPropName').innerHTML = data.property;
        document.getElementById('txtPropCity').innerHTML = data.city;
        document.getElementById('badgeStage').innerHTML = data.stage;

        const wrapT = document.getElementById('wrapTimeline');
        wrapT.innerHTML = '<div class="timeline-progress-bar" id="barProgress"></div>';
        let completed = 0;
        data.timeline.forEach((s, i) => {
            const node = document.createElement('div');
            node.className = "step-node " + s.status;
            node.innerHTML = '<div class="node-dot">' + s.icon + '</div><span class="step-label">' + s.label + '</span>';
            wrapT.appendChild(node);
            if (s.status === 'completed') completed++;
            if (s.status === 'active') completed += 0.5;
        });

        const pct = Math.round(((completed - 1) / (data.timeline.length - 1)) * 100);
        document.getElementById('ringProgress').style.strokeDashoffset = 314.16 - (pct / 100) * 314.16;
        document.getElementById('ringPct').innerHTML = pct + "%";

        document.getElementById('wrapTeam').innerHTML = data.team.map(t => '<div class="team-card"><div style="font-size:2rem;">'+t.icon+'</div><div style="font-weight:800;">'+t.name+'</div><div style="opacity:0.6;font-size:0.8rem;">'+t.role+'</div></div>').join('');
        document.getElementById('wrapPartners').innerHTML = data.partners.map(p => '<div class="partner-card"><div>'+p.icon+'</div><div style="font-weight:800;">'+p.name+'</div><div style="color:var(--dash-accent);font-size:0.7rem;">'+p.benefit+'</div><button class="copy-btn">Code: '+p.code+'</button></div>').join('');
        
        const m = data.milestones;
        document.getElementById('wrapMilestones').innerHTML = '<div class="milestone-card"><small>INSPECTION</small><div style="font-size:2rem;font-weight:900;">'+m.inspection.days+'</div><div>Jours restants</div></div>' +
                                                            '<div class="milestone-card"><small>SIGNATURE</small><div style="font-size:2rem;font-weight:900;">'+m.signature.days+'</div><div>Jours restants</div></div>';
    }

    function toggleSection(id) { document.getElementById(id).classList.toggle('collapsed'); }
    async function handlePortalLogin(e) {
        e.preventDefault();
        const code = document.getElementById('inpPortalCode').value;
        if (code === "EP-1001" || code === "EP-1") {
            renderPortal(MOCK_DATA);
            document.getElementById('portalOverlay').classList.add('hidden');
            document.getElementById('portalDash').style.display = 'block';
            setTimeout(() => document.getElementById('portalDash').classList.add('visible'), 50);
        }
    }
`;

const SNIPPET_FILE = SNIPPET_HEAD + "\n<style>\n" + CSS_CONTENT + "\n</style>\n" + HTML_BODY + "\n<script>\n" + JS_LOGIC + "\n</script>";

fs.writeFileSync('c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html', SNIPPET_FILE, 'utf8');

const ROOT_FILE = "<!DOCTYPE html>\n<html lang='fr'><head><meta charset='UTF-8'><title>Portail Client</title><style>body{margin:0;background:#1a0516;}\n" + CSS_CONTENT + "\n</style></head>\n<body>\n" + HTML_BODY + "\n<script>\n" + JS_LOGIC + "\n</script></body></html>";

fs.writeFileSync('c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html', ROOT_FILE, 'utf8');

console.log('Regeneration Successful.');
