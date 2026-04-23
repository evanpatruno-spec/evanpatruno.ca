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
            const messages = await client.search({ from: 'noreply@centris.ca' });
            if (messages.length === 0) return null;
            const lastId = messages[messages.length - 1];
            let message = await client.fetchOne(lastId, { source: true });
            let parsed = await simpleParser(message.source);
            const codeMatch = parsed.text.match(/\b\d{6}\b/);
            return codeMatch ? codeMatch[0] : null;
        } finally { lock.release(); }
    } catch (err) { return null; } finally { await client.logout(); }
}

async function debugState(page, stepName) {
    console.log(`\n--- DEBUG: ${stepName} ---`);
    console.log(`URL: ${page.url()}`);
    console.log(`Titre: ${await page.title()}`);
    // Lister les éléments visibles pour comprendre le blocage
    const inputs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => `${i.name || i.id} (${i.type})`));
    console.log(`Inputs trouvés: ${inputs.join(', ') || 'Aucun'}`);
    const buttons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText).filter(t => t.length > 0));
    console.log(`Boutons trouvés: ${buttons.join(', ') || 'Aucun'}`);
    console.log('---------------------------\n');
}

(async () => {
    const mlsNumber = process.env.MLS_NUMBER;
    const clientEmail = process.env.CLIENT_EMAIL;
    console.log(`[GitHub Worker] 🚀 DÉMARRAGE: MLS ${mlsNumber}`);

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
        await debugState(page, "Après chargement initial");

        if (await page.isVisible('input[name*="ser"], #Username')) {
            console.log("[GitHub Worker] 🔑 Login...");
            await page.fill('input[name*="ser"], #Username', process.env.MATRIX_USER);
            await page.fill('input[type="password"]', process.env.MATRIX_PASS);
            await page.click('button[type="submit"]');
            await page.waitForTimeout(10000);
            await debugState(page, "Après clic Login");

            if (page.url().includes('challenge') || await page.isVisible('input[name*="Code"]')) {
                console.log("[GitHub Worker] 🛡️ MFA détecté...");
                const code = await getMfaCode();
                if (code) {
                    await page.fill('input[name*="Code"]', code);
                    await page.click('button[type="submit"]');
                    await page.waitForTimeout(10000);
                }
            }
        }

        console.log("[GitHub Worker] ✅ Connecté !");
        await debugState(page, "État connecté");
        
        // RECHERCHE
        console.log("[GitHub Worker] 🔍 Recherche MLS...");
        await page.waitForTimeout(8000);
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');
        await page.mouse.click(10, 10);
        
        await debugState(page, "Avant saisie MLS");
        
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
        await page.click('#chkSelectAll, .select-all');
        await page.click('button:has-text("Partager"), #btnShare');
        
        await page.waitForSelector('#txtEmailTo, input[name*="Email"]');
        await page.fill('#txtEmailTo, input[name*="Email"]', clientEmail);
        await page.fill('#txtSubject', `Documentation - MLS ${mlsNumber}`);
        await page.click('button:has-text("Partager"), .btn-send');
        
        console.log("[GitHub Worker] ✨ MISSION RÉUSSIE !");

    } catch (e) {
        console.error("[GitHub Worker] ❌ ÉCHEC");
        await debugState(page, "CRASH");
        process.exit(1);
    } finally { await browser.close(); }
})();
