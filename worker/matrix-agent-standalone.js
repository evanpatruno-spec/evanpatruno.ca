const { chromium } = require('playwright');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function getMfaCode() {
    console.log("[GitHub Worker] 📧 Connexion Gmail...");
    const client = new ImapFlow({
        host: 'imap.gmail.com', port: 993, secure: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS },
        logger: false
    });
    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        try {
            const messages = await client.search({ all: true });
            if (messages.length === 0) return null;
            const lastIds = messages.slice(-3);
            for (let i = lastIds.length - 1; i >= 0; i--) {
                let message = await client.fetchOne(lastIds[i], { source: true });
                let parsed = await simpleParser(message.source);
                const codeMatch = parsed.text.match(/\b\d{6}\b/);
                if (codeMatch) {
                    console.log(`[GitHub Worker] 🔑 Code trouvé: ${codeMatch[0]} (Exp: ${parsed.from.text})`);
                    return codeMatch[0];
                }
            }
            return null;
        } finally { lock.release(); }
    } catch (err) {
        console.log(`[GitHub Worker] ❌ Erreur Gmail: ${err.message}`);
        return null;
    } finally { await client.logout(); }
}

/**
 * Nettoie les fenêtres surgissantes qui bloquent l'interface Matrix
 */
async function handlePopups(page) {
    console.log("[GitHub Worker] 🧹 Nettoyage des popups...");
    const popupSelectors = [
        'button:has-text("Je l\'ai lu")',
        'button:has-text("I have read")',
        'button:has-text("I Agree")',
        'button:has-text("J\'accepte")',
        'button:has-text("Close")',
        'button:has-text("Fermer")',
        '.ui-dialog-buttonset button',
        '.modal-footer button'
    ];

    let foundAny = false;
    // On tente jusqu'à 3 itérations pour les popups qui s'enchaînent
    for (let i = 0; i < 3; i++) {
        let foundInThisIteration = false;
        
        // Vérifier la page principale
        for (const selector of popupSelectors) {
            try {
                const buttons = await page.$$(selector);
                for (const btn of buttons) {
                    if (await btn.isVisible()) {
                        console.log(`[GitHub Worker] ✨ Fermeture popup: ${selector}`);
                        await btn.click();
                        await page.waitForTimeout(1500);
                        foundInThisIteration = true;
                        foundAny = true;
                    }
                }
            } catch (e) {}
        }

        // Vérifier tous les cadres (iframes)
        for (const frame of page.frames()) {
            for (const selector of popupSelectors) {
                try {
                    const buttons = await frame.$$(selector);
                    for (const btn of buttons) {
                        if (await btn.isVisible()) {
                            console.log(`[GitHub Worker] ✨ Fermeture popup (dans cadre): ${selector}`);
                            await btn.click();
                            await page.waitForTimeout(1500);
                            foundInThisIteration = true;
                            foundAny = true;
                        }
                    }
                } catch (e) {}
            }
        }
        
        if (!foundInThisIteration) break;
    }
    return foundAny;
}

(async () => {
    const mlsNumber = process.env.MLS_NUMBER;
    const clientEmail = process.env.CLIENT_EMAIL;
    console.log(`[GitHub Worker] 🚀 MLS ${mlsNumber}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        console.log("[GitHub Worker] 🌐 Accès Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });

        if (await page.isVisible('input[name*="ser"], #Username')) {
            console.log("[GitHub Worker] 🔑 Login...");
            await page.fill('input[name*="ser"], #Username', process.env.MATRIX_USER);
            await page.fill('input[type="password"]', process.env.MATRIX_PASS);
            await page.click('button[type="submit"], button:has-text("Connect")');
            
        // --- DÉTECTION MFA ---
        console.log("[GitHub Worker] 🛡️ Recherche du challenge MFA...");
        let mfaPageFound = false;
        for (let i = 0; i < 15; i++) {
            const url = page.url();
            if (url.includes('challenge') || url.includes('auth0') || await page.isVisible('input[name*="Code"], #VerificationCode')) {
                mfaPageFound = true;
                console.log(`[GitHub Worker] 🛡️ Challenge détecté sur: ${url.split('/')[2]}`);
                break;
            }
            await page.waitForTimeout(2000);
        }

        if (mfaPageFound) {
            console.log("[GitHub Worker] 🛡️ MFA actif, attente de l'email...");
            await page.waitForTimeout(20000); // Attente réception
            const code = await getMfaCode();
            if (code) {
                console.log(`[GitHub Worker] 🔑 Injection du code: ${code}`);
                await page.fill('input[name*="Code"], #VerificationCode, input[type="text"]', code);
                await page.waitForTimeout(1000);
                await page.click('button:has-text("Continue"), button:has-text("Je l\'ai lu"), button[type="submit"], .btn-primary');
                console.log("[GitHub Worker] ➡️ Formulaire MFA soumis.");
                await page.waitForTimeout(10000);
            } else {
                console.log("[GitHub Worker] ❌ Échec MFA: Code non reçu.");
            }
        } else {
            console.log("[GitHub Worker] 🛡️ Aucun MFA détecté, suite du login...");
        }
        }

        // --- ATTENTE DE LA SORTIE DE LA PAGE DE TRANSITION ET MFA ---
        console.log("[GitHub Worker] ⏳ Attente de la redirection finale...");
        let attempts = 0;
        const loginDomains = ['auth0.com', 'accounts.centris.ca', 'LoginIntermediateMLD.aspx'];
        
        while (attempts < 20) {
            const currentUrl = page.url();
            const stillLoggingIn = loginDomains.some(domain => currentUrl.includes(domain));
            
            if (!stillLoggingIn && (currentUrl.includes('Matrix/Default.aspx') || currentUrl.includes('matrix.centris.ca/matrix'))) {
                console.log(`[GitHub Worker] 🎯 Destination atteinte: ${currentUrl}`);
                break;
            }

            console.log(`[GitHub Worker] ... Toujours bloqué sur: ${currentUrl.split('/')[2]} (${attempts+1}/20)`);
            
            // Log des boutons dispos pour debug
            try {
                const buttons = await page.$$eval('button', btns => btns.map(b => b.innerText).filter(t => t.length > 1));
                if (buttons.length > 0) console.log(`[GitHub Worker] 🔘 Boutons vus: ${buttons.join(', ')}`);
            } catch(e) {}

            // Si on est bloqué sur une page avec un bouton "Continue", on clique
            try {
                const continueBtn = await page.$('button:has-text("Continue"), button:has-text("Continuer"), button[type="submit"]');
                if (continueBtn && await continueBtn.isVisible()) {
                    console.log("[GitHub Worker] ➡️ Tentative de clic sur bouton de progression...");
                    await continueBtn.click();
                }
            } catch (e) {}

            await page.waitForTimeout(5000);
            attempts++;
        }

        if (!page.url().includes('Matrix')) {
            throw new Error(`Échec de connexion : Le robot est resté bloqué sur ${page.url()}`);
        }

        console.log("[GitHub Worker] ✅ Arrivé sur Matrix !");
        
        // RECHERCHE DIRECTE (Solution 3)
        console.log("[GitHub Worker] 🔍 Navigation vers la page d'accueil Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(5000);
        
        // NETTOYAGE INITIAL DES POPUPS
        await handlePopups(page);
        
        console.log("[GitHub Worker] 🔍 Recherche de la SpeedBar...");
        let searchInput = null;
        let attemptsSearch = 0;
        
        // Log debug
        try {
            const inputs = await page.$$eval('input', els => els.map(e => ({id: e.id, name: e.name, placeholder: e.placeholder})));
            console.log(`[GitHub Worker] 🔍 DEBUG: ${inputs.length} inputs trouvés. Ex: ${inputs.slice(0,3).map(i => i.id || i.name).join(', ')}`);
        } catch(e) {}
        
        while (!searchInput && attemptsSearch < 12) {
            attemptsSearch++;
            
            // Tentative de nettoyage si on ne trouve pas (ou dès le début si on veut être sûr)
            await handlePopups(page);
            await page.waitForTimeout(2000);

            for (const frame of page.frames()) {
                try {
                    // Liste de sélecteurs possibles pour la SpeedBar
                    const selectors = [
                        '#m_txtSpeedBarInput',
                        '#m_pSearch_m_txtSpeedBarInput',
                        'input[name*="SpeedBar"]',
                        'input[id*="SpeedBar"]',
                        'input[placeholder*="SpeedBar"]',
                        'input[placeholder*="Recherche"]',
                        '.m_txtSpeedBarInput',
                        '#m_pSearch_m_txtSpeedBarInput'
                    ];
                    
                    for (const selector of selectors) {
                        const el = await frame.$(selector);
                        if (el && await el.isVisible()) {
                            searchInput = el;
                            console.log(`[GitHub Worker] ✅ SpeedBar trouvée dans un cadre (${selector}) !`);
                            
                            // On s'assure qu'elle est cliquable (parfois cachée par un overlay transparent)
                            await el.click({ force: true }).catch(() => {});
                            await el.fill(mlsNumber);
                            await frame.keyboard.press('Enter');
                            break;
                        }
                    }
                } catch (e) {}
                if (searchInput) break;
            }
            
            if (!searchInput) {
                console.log(`[GitHub Worker] ... SpeedBar non trouvée, nouvelle tentative (${attemptsSearch}/12)`);
                await page.waitForTimeout(3000);
            }
        }

        if (!searchInput) throw new Error("Barre de recherche introuvable après 60s.");

        // DOCUMENTS
        console.log("[GitHub Worker] 📄 Accès documents...");
        await page.waitForTimeout(15000);
        const docsBtn = await page.waitForSelector('a[title*="Document"], text="Documents"', { timeout: 30000 });
        await docsBtn.click();
        
        // PARTAGE
        console.log("[GitHub Worker] 📧 Partage...");
        await page.waitForTimeout(8000);
        await page.click('#chkSelectAll');
        await page.click('button:has-text("Partager"), #btnShare');
        await page.waitForSelector('#txtEmailTo');
        await page.fill('#txtEmailTo', clientEmail);
        await page.fill('#txtSubject', `Documentation - MLS ${mlsNumber}`);
        await page.click('button:has-text("Partager"), .btn-send');
        
        console.log("[GitHub Worker] ✨ MISSION RÉUSSIE !");

    } catch (e) {
        console.error("[GitHub Worker] ❌ ÉCHEC:", e.message);
        process.exit(1);
    } finally { await browser.close(); }
})();
