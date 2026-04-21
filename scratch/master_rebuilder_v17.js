const fs = require('fs');

/**
 * MASTER REBUILDER v17 - THE DEFINITIVE PORTAL RESTORATION
 * - No file reading (bypass corrupted sources).
 * - Full Design V8 (High-Fidelity).
 * - 100% ASCII-safe (Hex escapes for every accent/icon).
 */

const PATH_SNIPPET = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/snippets/pages/page_portal.html';
const PATH_ROOT = 'c:/Users/evanp/OneDrive/Desktop/PROGRAMME AI/evanpatruno.ca/mon-dossier.html';

// 1. Helper to escape strings for JS (\uXXXX) and HTML (&XXXX;)
function hJs(str) {
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

function hHtml(str) {
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

// 2. CSS - Full v8 design (White titles, Magenta bar, etc.)
const css = hHtml(`
    :root {
        --dash-primary: #873276;
        --dash-accent: #d4af37;
        --dash-bg: #1a0516;
        --dash-card-bg: rgba(255, 255, 255, 0.04);
        --dash-border: rgba(135, 50, 118, 0.6);
        --dash-glow: 0 0 25px rgba(135, 50, 118, 0.4);
        --dash-success: #2ecc71;
    }
    .portal-main-wrapper { 
        font-family: 'Inter', sans-serif; color: #fff; background: var(--dash-bg); 
        min-height: 900px; position: relative; overflow: hidden; border-radius: 60px; 
        border: 1px solid rgba(135, 50, 118, 0.5); box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6); 
        margin: 20px 0; isolation: isolate; 
    }
    .portal-aura { position: absolute; width: 100%; height: 100%; background: radial-gradient(circle at center, #000000 0%, var(--dash-bg) 80%); z-index: 1; pointer-events: none; }
    .portal-container { max-width: 1100px; margin: 0 auto; padding: 60px 20px; position: relative; z-index: 5; opacity: 0; transform: translateY(30px); transition: 1.2s cubic-bezier(0.2, 1, 0.3, 1); display: none; }
    .portal-container.visible { opacity: 1; transform: translateY(0); display: block; }
    .portal-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; min-height: 100vh; background: rgba(15, 5, 13, 0.92); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
    .portal-overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; transform: scale(1.1); }
    .section-wrapper { margin-bottom: 25px; border: 1px solid var(--dash-border); border-radius: 40px; overflow: hidden; background: rgba(0, 0, 0, 0.2); box-shadow: var(--dash-glow); }
    .section-header { padding: 25px 40px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; background: rgba(255, 255, 255, 0.03); }
    .section-header h3 { margin: 0; font-family: 'Outfit'; font-size: 1.5rem; color: #fff !important; }
    .section-chevron { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); border-radius: 50%; transition: 0.4s; color: var(--dash-primary); font-size: 10px; }
    .section-wrapper.collapsed .section-content { max-height: 0; padding-top: 0; padding-bottom: 0; opacity: 0; }
    .section-wrapper.collapsed .section-chevron { transform: rotate(-90deg); }
    .section-content { padding: 40px; transition: 0.6s cubic-bezier(0.4, 0, 0.2, 1); max-height: 4000px; opacity: 1; overflow: hidden; }
    .login-card { background: rgba(15, 5, 13, 0.95); padding: 50px; border-radius: 40px; border: 2px solid var(--dash-border); text-align: center; width: 100%; max-width: 420px; box-shadow: var(--dash-glow); }
    .login-input { width: 100%; padding: 20px; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; color: #fff; font-size: 1.1rem; margin-bottom: 15px; outline: none; text-align: center; }
    .login-btn { width: 100%; padding: 20px; background: linear-gradient(135deg, var(--dash-primary), #6d235c); color: #fff; border: none; border-radius: 50px; font-weight: 900; text-transform: uppercase; cursor: pointer; transition: 0.3s; letter-spacing: 1px; }
    .pwa-login-btn { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; margin-top: 16px; padding: 14px 20px; background: transparent; border: 1px solid rgba(135, 50, 118, 0.5); border-radius: 50px; color: rgba(255,255,255,0.7); font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: 0.3s; }
    
    /* Timeline Desktop */
    .timeline-steps { display: flex; justify-content: space-between; position: relative; padding: 0 40px; }
    .timeline-steps::before { content: ''; position: absolute; top: 27px; left: 10%; width: 80%; height: 2px; background: rgba(255, 255, 255, 0.08); z-index: 1; }
    .timeline-progress-bar { position: absolute; top: 27px; left: 10%; width: 0%; height: 2px; background: var(--dash-primary); box-shadow: 0 0 20px var(--dash-primary); transition: width 1.8s ease; z-index: 1; }
    .step-node { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; width: 100px; flex-shrink: 0; }
    .node-dot { width: 54px; height: 54px; background: var(--dash-bg); border: 2px solid rgba(255, 255, 255, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; transition: 0.6s; z-index: 3; }
    .step-node.completed .node-dot { border-color: var(--dash-success); box-shadow: 0 0 15px var(--dash-success); }
    .step-node.active .node-dot { border-color: var(--dash-primary); box-shadow: 0 0 20px var(--dash-primary); transform: scale(1.1); }
    .step-label { font-size: 0.8rem; font-weight: 700; margin-top: 12px; text-align: center; color: rgba(255, 255, 255, 0.5); }
    .step-node.active .step-label { color: var(--dash-primary); opacity: 1; }
    .step-node.completed .step-label { color: var(--dash-success); opacity: 1; }

    /* Cockpit Ring */
    .cockpit-ring-wrap { position: relative; width: 160px; height: 160px; margin: 0; flex-shrink: 0; }
    .cockpit-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .ring-bg { fill: none; stroke: rgba(255, 255, 255, 0.05); stroke-width: 7; }
    .ring-progress { fill: none; stroke: url(#ringGrad); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 314.16; stroke-dashoffset: 314.16; transition: stroke-dashoffset 1.8s ease; filter: drop-shadow(0 0 8px #873276); }
    .cockpit-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
    .cockpit-center span { display: block; font-size: 2rem; font-weight: 900; color: #fff; }
    .cockpit-center small { display: block; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--dash-primary); letter-spacing: 1px; }

    /* Grids */
    .milestone-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .milestone-card { background: var(--dash-card-bg); border: 1px solid var(--dash-border); border-radius: 30px; padding: 25px; text-align: center; }
    .milestone-val { font-family: 'Outfit'; font-size: 2.2rem; font-weight: 900; color: #fff; line-height: 1; margin-bottom: 5px; }
    .milestone-label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: var(--dash-accent); }
    
    .team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; }
    .team-card { background: var(--dash-card-bg); border: 1px solid var(--dash-border); border-radius: 25px; padding: 25px; text-align: center; }
    .team-icon { font-size: 2rem; margin-bottom: 15px; }
    .team-role { font-size: 0.7rem; font-weight: 900; text-transform: uppercase; color: var(--dash-accent); }
    .team-name { font-size: 1.2rem; font-weight: 800; color: #fff; margin-bottom: 5px; }

    .partner-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
    .partner-card { background: var(--dash-card-bg); border: 1px solid var(--dash-border); border-radius: 25px; padding: 25px; position: relative; overflow: hidden; }
    .partner-promo-badge { position: absolute; top: 15px; right: 15px; background: var(--dash-accent); color: #000; font-size: 0.6rem; font-weight: 900; padding: 4px 10px; border-radius: 50px; }
    .copy-btn { width: 100%; margin-top: 15px; padding: 10px; background: rgba(135, 50, 118, 0.1); border: 1px dashed var(--dash-primary); color: var(--dash-primary); border-radius: 10px; font-size: 0.7rem; font-weight: 800; cursor: pointer; }

    /* Moving Checklist */
    .moving-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 15px; }
    .moving-item { padding: 20px; border-radius: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; gap: 15px; cursor: pointer; transition: 0.3s; }
    .moving-item.done { border-color: var(--dash-success); background: rgba(46, 204, 113, 0.05); }
    .check-box { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
    .moving-item.done .check-box { background: var(--dash-success); border-color: var(--dash-success); color: #fff; }

    @media (max-width: 768px) {
        .portal-main-wrapper { border-radius: 30px; margin: 10px; }
        .property-card-premium { flex-direction: column; padding: 30px; }
        .timeline-steps { flex-direction: column; padding: 20px; }
        .timeline-steps::before { left: 51px; top: 30px; width: 2px; height: 80%; }
        .timeline-progress-bar { left: 51px; top: 30px; width: 2px; height: 0%; }
        .step-node { flex-direction: row; width: 100%; gap: 20px; height: 70px; }
        .step-label { margin-top: 0; text-align: left; }
    }
`);

// 3. HTML - Restoration of all blocks
const html = hHtml(`
<div class="portal-main-wrapper">
    <div class="portal-aura"></div>
    <div class="portal-overlay" id="portalOverlay">
        <div class="login-card">
            <h2 style="font-family:'Outfit'; font-size:2.2rem; font-weight:900; margin-bottom:8px; color:#fff;">Accès au Dossier</h2>
            <p style="color:rgba(255,255,255,0.6); margin-bottom:35px;">Connectez-vous pour voir l'avancement.</p>
            <form onsubmit="handlePortalLogin(event)">
                <input type="text" placeholder="CODE DOSSIER" class="login-input" id="inpPortalCode" required>
                <input type="password" maxlength="4" placeholder="CODE TÉLÉPHONE" class="login-input" id="inpPortalPhone" required>
                <button type="submit" class="login-btn" id="btnPortalLogin">Ouvrir mon dossier</button>
                <button type="button" class="pwa-login-btn" onclick="installPortalApp()" id="btnPwaLogin">
                    <span>📲</span> <span>Installer l'app PWA</span>
                </button>
            </form>
        </div>
    </div>
    <div class="portal-container" id="portalDash">
        <header style="margin-bottom:50px;">
            <h1 id="txtWelcome" style="font-family:'Outfit'; font-size:3.5rem; font-weight:900; margin:0; color:#fff;">Bienvenue.</h1>
            <p id="txtCodeRef" style="opacity:0.6; font-weight:700;">Dossier #--</p>
        </header>

        <!-- Cockpit Section -->
        <div style="background:rgba(255,255,255,0.03); padding:40px; border-radius:45px; border:1px solid var(--dash-border); display:flex; align-items:center; gap:50px; margin-bottom:40px; flex-wrap:wrap;">
            <div style="flex:1; min-width:300px;">
                <div id="badgeStage" style="background:rgba(46,204,113,0.1); color:#2ecc71; padding:6px 16px; border-radius:50px; display:inline-block; font-size:0.75rem; font-weight:900; margin-bottom:15px; border:1px solid rgba(46,204,113,0.3);">ANALYSE</div>
                <h2 id="txtPropName" style="font-size:2.5rem; margin:0; font-family:'Outfit'; color:#fff;">Propriété Privée</h2>
                <p id="txtPropCity" style="opacity:0.5; font-size:1.2rem; margin-top:5px;">Montréal</p>
            </div>
            <div class="cockpit-ring-wrap">
                <svg class="cockpit-svg" viewBox="0 0 120 120">
                    <defs><linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#873276"/><stop offset="100%" stop-color="#ff4db8"/></linearGradient></defs>
                    <circle class="ring-bg" cx="60" cy="60" r="50"/>
                    <circle class="ring-progress" id="ringProgress" cx="60" cy="60" r="50"/>
                </svg>
                <div class="cockpit-center"><span id="ringPct">0%</span><small>Avancement</small></div>
            </div>
        </div>

        <div class="milestone-grid" id="wrapMilestones"></div>

        <div class="section-wrapper" id="secTimeline">
            <div class="section-header" onclick="toggleSection('secTimeline')"><h3>Timeline de Transaction</h3><div class="section-chevron">▼</div></div>
            <div class="section-content">
                <div class="timeline-steps" id="wrapTimeline">
                    <div class="timeline-progress-bar" id="barProgress"></div>
                    <!-- Filled by JS -->
                </div>
            </div>
        </div>

        <div class="section-wrapper" id="secTeam">
            <div class="section-header" onclick="toggleSection('secTeam')"><h3>Votre Équipe</h3><div class="section-chevron">▼</div></div>
            <div class="section-content"><div class="team-grid" id="wrapTeam"></div></div>
        </div>

        <div class="section-wrapper collapsed" id="secMoving">
            <div class="section-header" onclick="toggleSection('secMoving')"><h3>Checklist de Déménagement</h3><div class="section-chevron">▼</div></div>
            <div class="section-content"><div class="moving-grid" id="wrapMoving"></div></div>
        </div>

        <div class="section-wrapper collapsed" id="secPartners">
            <div class="section-header" onclick="toggleSection('secPartners')"><h3>Partenaires Experts</h3><div class="section-chevron">▼</div></div>
            <div class="section-content"><div class="partner-grid" id="wrapPartners"></div></div>
        </div>
    </div>
</div>
`);

// 4. JS Logic - Full Prod + Demonstration strings
const logic = hJs(`
    const MOCK_DATA = {
        firstName: "Evan", code: "EP-1001", property: "Avenue Patruno", city: "Montr\\u00e9al", stage: "Analyse des offres",
        timeline: [
            { label: "Pr\\u00e9paration", icon: "\\uD83D\\uDCCB", status: "completed" },
            { label: "Offre d\\u00e9pos\\u00e9e", icon: "\\uD83D\\uDD0D", status: "active" },
            { label: "Conditions", icon: "\\uD83D\\uDEE1\\uFE0F", status: "pending" },
            { label: "Notaire", icon: "\\u2712\\uFE0F", status: "pending" },
            { label: "Succ\\u00e8s", icon: "\\uD83C\\uDFE0", status: "pending" }
        ],
        team: [
            { role: "Votre Courtier", name: "Evan Patruno", icon: "\\uD83D\\uDCF1", phone: "514-567-3249", email: "evan@patruno.ca" },
            { role: "Notaire", name: "Me Jean Picard", icon: "\\u2712\\uFE0F", phone: "514-555-0101", email: "jean@notaire.ca" }
        ],
        milestones: {
            signature: { days: 25, date: "15 Mai 2026" },
            inspection: { days: 12, date: "2 Mai 2026" },
            signature: { days: 25, date: "15 Mai 2026" }
        },
        movingChecklist: [
            { name: "Aviser son propri\\u00e9taire", done: true },
            { name: "Réserver d\\u00e9m\\u00e9nageurs", done: false },
            { name: "Changer les serrures", done: false }
        ],
        partners: [{ name: "D\\u00e9m\\u00e9nagement Expert", icon: "\\uD83D\\uDE66", category: "Services", benefit: "10% Rabais", code: "EVAN10" }]
    };

    function renderPortal(data) {
        // Use innerHTML everywhere to ensure hex-escaped strings render correctly
        document.getElementById('txtWelcome').innerHTML = "Bienvenue, " + (data.firstName || 'Client') + ".";
        document.getElementById('txtCodeRef').innerHTML = "Dossier #" + data.code;
        document.getElementById('txtPropName').innerHTML = data.property;
        document.getElementById('txtPropCity').innerHTML = data.city;
        document.getElementById('badgeStage').innerHTML = data.stage;

        // Timeline
        const wrapT = document.getElementById('wrapTimeline');
        wrapT.querySelectorAll('.step-node').forEach(n => n.remove());
        let completed = 0;
        (data.timeline || []).forEach((s, i) => {
            const node = document.createElement('div');
            node.className = "step-node " + s.status;
            node.innerHTML = '<div class="node-dot">' + s.icon + '</div><span class="step-label">' + s.label + '</span>';
            wrapT.appendChild(node);
            if (s.status === 'completed') completed++;
            if (s.status === 'active') completed += 0.5;
        });

        setTimeout(() => {
            const bar = document.getElementById('barProgress') || document.querySelector('.timeline-progress-bar');
            if (bar) {
                const total = (data.timeline || []).length;
                const safePct = total > 1 ? Math.round(((completed - 1) / (total - 1)) * 100) : 0;
                bar.style.width = safePct + "%";
                document.getElementById('ringProgress').style.strokeDashoffset = 314.16 - (safePct / 100) * 314.16;
                document.getElementById('ringPct').innerHTML = safePct + "%";
            }
        }, 300);

        // Team
        document.getElementById('wrapTeam').innerHTML = (data.team || []).map(t => '<div class="team-card"><div class="team-icon">'+t.icon+'</div><div class="team-role">'+t.role+'</div><div class="team-name">'+t.name+'</div><div style="font-size:0.75rem;opacity:0.6;">'+t.phone+'</div></div>').join('');
        
        // Milestones
        const m = data.milestones || {};
        const milestones = [
            { label: 'Inspection', data: m.inspection },
            { label: 'Signature', data: m.signature }
        ];
        document.getElementById('wrapMilestones').innerHTML = milestones.map(ms => '<div class="milestone-card"><div class="milestone-val">'+(ms.data ? ms.data.days : '--')+'</div><div class="milestone-label">'+ms.label+'</div><div style="font-size:0.6rem;opacity:0.4;margin-top:8px;">'+(ms.data ? ms.data.date : '')+'</div></div>').join('');
        
        // Moving
        document.getElementById('wrapMoving').innerHTML = (data.movingChecklist || []).map((c, i) => '<div class="moving-item '+(c.done?'done':'')+'"><div class="check-box">'+(c.done?'\\u2713':'')+'</div><span>'+c.name+'</span></div>').join('');
        
        // Partners
        document.getElementById('wrapPartners').innerHTML = (data.partners || []).map(p => '<div class="partner-card"><div class="partner-promo-badge">'+p.benefit+'</div><div style="font-size:1.5rem;margin-bottom:10px;">'+p.icon+'</div><div class="team-role" style="font-size:0.5rem;">'+p.category+'</div><div class="team-name" style="font-size:1rem;">'+p.name+'</div><button class="copy-btn">Code: '+p.code+'</button></div>').join('');
    }

    async function handlePortalLogin(e) {
        e.preventDefault();
        const code = document.getElementById('inpPortalCode').value.trim();
        const phone = document.getElementById('inpPortalPhone').value.trim();
        const btn = document.getElementById('btnPortalLogin');
        btn.innerText = "Connexion...";
        btn.disabled = true;

        if (code === "EP-1001" || code === "EP-1") {
            setTimeout(() => {
                renderPortal(MOCK_DATA);
                document.getElementById('portalOverlay').classList.add('hidden');
                document.getElementById('portalDash').style.display = 'block';
                setTimeout(() => document.getElementById('portalDash').classList.add('visible'), 50);
            }, 800);
            return;
        }

        try {
            const resp = await fetch('https://dossier.evanpatruno.ca/api/portal', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codePortal: code, phoneLast4: phone })
            });
            if (!resp.ok) throw new Error("Dossier inexistant");
            const data = await resp.json();
            renderPortal(data);
            document.getElementById('portalOverlay').classList.add('hidden');
            document.getElementById('portalDash').style.display = 'block';
            setTimeout(() => document.getElementById('portalDash').classList.add('visible'), 50);
        } catch (err) { alert(err.message); } finally { btn.innerText = "Ouvrir mon dossier"; btn.disabled = false; }
    }

    function toggleSection(id) { document.getElementById(id).classList.toggle('collapsed'); }

    // PWA
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });
    async function installPortalApp() {
        if (!deferredPrompt) { window.location.href = "https://dossier.evanpatruno.ca/mon-dossier.html?code=" + (document.getElementById('inpPortalCode').value || 'EP-1001'); return; }
        deferredPrompt.prompt();
    }
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            const isS = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            if (isS) { const b = document.getElementById('btnPwaLogin'); if (b) b.style.display = 'none'; }
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
    }
`);

// 5. Final Assembly
const snippet = `<!-- SNIPPET v17 MASTER RECONSTRUCTION -->\n<style>\n${css}\n</style>\n${html}\n<script>\n${logic}\n</script>`;
const root = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&family=Outfit:wght@400;700;900&display=swap" rel="stylesheet"><title>Portail Client | Evan Patruno</title><style>body{margin:0;background:#1a0516;}\n${css}\n</style></head><body>\n${html}\n<script>\n${logic}\n</script></body></html>`;

fs.writeFileSync(PATH_SNIPPET, snippet, 'utf8');
fs.writeFileSync(PATH_ROOT, root, 'utf8');

console.log('Master v17 Reconstruction Successful.');
