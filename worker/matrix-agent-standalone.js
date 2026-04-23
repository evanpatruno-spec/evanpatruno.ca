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
                    console.log(`[GitHub Worker] 🔑 Code trouvé (Exp: ${parsed.from.text})`);
                    return codeMatch[0];
                }
            }
            return null;
        } finally { lock.release(); }
    } catch (err) { return null; } finally { await client.logout(); }
}

async function debugState(page, stepName) {
    console.log(`\n--- DEBUG: ${stepName} ---`);
    console.log(`URL: ${page.url()}`);
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => t.length > 0));
    console.log(`Boutons: ${buttons.join(', ')}`);
    console.log('---------------------------\n');
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

    if (process.env.MATRIX_COOKIES) {
        const cookies = process.env.MATRIX_COOKIES.split(';').map(pair => {
            const parts = pair.trim().split('=');
            return { name: parts[0], value: parts.slice(1).join('='), domain: '.centris.ca', path: '/' };
        });
        await context.addCookies(cookies);
    }

    const page = await context.newPage();

    try {
        console.log("[GitHub Worker] 🌐 Accès Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });

        if (await page.isVisible('input[name*="ser"], #Username')) {
            console.log("[GitHub Worker] 🔑 Login...");
            await page.fill('input[name*="ser"], #Username', process.env.MATRIX_USER);
            await page.fill('input[type="password"]', process.env.MATRIX_PASS);
            await page.click('button[type="submit"], button:has-text("Connect")');
            await page.waitForTimeout(10000);

            if (page.url().includes('challenge') || page.url().includes('prompt') || await page.isVisible('input[name*="Code"]')) {
                console.log("[GitHub Worker] 🛡️ MFA détecté...");
                await page.waitForTimeout(20000); // Attente transfert email
                const code = await getMfaCode();
                if (code) {
                    console.log(`[GitHub Worker] 🔑 Code injecté: ${code}`);
                    await page.fill('input[name*="Code"], #VerificationCode, input[type="text"]', code);
                    await page.click('button:has-text("Continue"), button[type="submit"]');
                    await page.waitForTimeout(10000);
                }
            }
        }

        console.log("[GitHub Worker] ✅ Connecté !");
        
        // --- NAVIGATION FORCÉE VERS LE TABLEAU DE BORD ---
        console.log("[GitHub Worker] 🌐 Chargement forcé de Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });
        await page.waitForTimeout(10000); // On laisse 10s pour passer la page intermédiaire
        
        // RECHERCHE
        console.log("[GitHub Worker] 🔍 Recherche MLS...");
        await page.keyboard.press('Escape');
        const searchInput = await page.waitForSelector('#m_txtSpeedBarInput, input[name*="SpeedBar"]', { timeout: 30000 });
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');
        
        // DOCUMENTS
        console.log("[GitHub Worker] 📄 Accès documents...");
        await page.waitForTimeout(10000);
        const docsBtn = await page.waitForSelector('a[title*="Document"], text="Documents"', { timeout: 30000 });
        await docsBtn.click();
        
        // PARTAGE
        console.log("[GitHub Worker] 📧 Partage...");
        await page.waitForTimeout(5000);
        await page.click('#chkSelectAll');
        await page.click('button:has-text("Partager"), #btnShare');
        
        await page.waitForSelector('#txtEmailTo');
        await page.fill('#txtEmailTo', clientEmail);
        await page.fill('#txtSubject', `Documentation - MLS ${mlsNumber}`);
        await page.click('button:has-text("Partager"), .btn-send');
        
        console.log("[GitHub Worker] ✨ MISSION RÉUSSIE !");

    } catch (e) {
        console.error("[GitHub Worker] ❌ ÉCHEC:", e.message);
        await debugState(page, "CRASH");
        process.exit(1);
    } finally { await browser.close(); }
})();
