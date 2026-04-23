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

(async () => {
    const mlsNumber = process.env.MLS_NUMBER;
    const clientEmail = process.env.CLIENT_EMAIL;
    console.log(`[GitHub Worker] 🚀 MLS ${mlsNumber} pour ${clientEmail}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        console.log("[GitHub Worker] 🌐 Navigation vers Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });

        // --- LOGIN SI BESOIN ---
        if (await page.isVisible('input[name="Username"], #Username, #username')) {
            console.log("[GitHub Worker] 🔑 Saisie identifiants...");
            await page.fill('input[name="Username"], #Username, #username', process.env.MATRIX_USER);
            await page.fill('input[name="Password"], #Password, #password', process.env.MATRIX_PASS);
            await page.click('button[type="submit"], #login-button');
            await page.waitForTimeout(10000);

            // --- MFA ---
            if (page.url().includes('challenge') || page.url().includes('prompt') || await page.isVisible('input[name*="Code"]')) {
                console.log("[GitHub Worker] 🛡️ MFA détecté, attente du code email...");
                await page.waitForTimeout(15000); // Attendre l'email
                const code = await getMfaCode();
                if (code) {
                    console.log(`[GitHub Worker] 🔑 Code récupéré: ${code}`);
                    await page.fill('input[name*="Code"], #VerificationCode', code);
                    await page.click('button[type="submit"], .btn-primary');
                    await page.waitForTimeout(10000);
                }
            }
        }

        console.log("[GitHub Worker] ✅ Connecté !");
        
        // --- RECHERCHE ---
        console.log("[GitHub Worker] 🔍 Ouverture du menu Recherche...");
        await page.waitForTimeout(5000);
        await page.keyboard.press('Escape');
        
        // On clique sur l'onglet Recherche en haut
        try {
            await page.click('text="Recherche"', { timeout: 10000 });
            await page.waitForTimeout(2000);
        } catch (e) {
            console.log("[GitHub Worker] Onglet Recherche non trouvé, on tente direct...");
        }

        console.log("[GitHub Worker] 🔍 Saisie du numéro MLS...");
        const searchInput = await page.waitForSelector('#m_txtSpeedBarInput, input[name*="SpeedBar"]', { timeout: 30000 });
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');

        // --- ENVOI ---
        console.log("[GitHub Worker] 📄 Envoi documents...");
        await page.waitForTimeout(5000);
        await page.click('a[title*="Document"], text="Documents"');
        await page.waitForTimeout(5000);
        await page.click('#chkSelectAll');
        await page.click('button:has-text("Partager"), #btnShare');
        await page.waitForSelector('#txtEmailTo');
        await page.fill('#txtEmailTo', clientEmail);
        await page.fill('#txtSubject', `Documentation - Inscription MLS ${mlsNumber}`);
        await page.click('button:has-text("Partager"), .btn-send');
        console.log("[GitHub Worker] ✨ MISSION RÉUSSIE !");

    } catch (e) {
        console.error("[GitHub Worker] ❌ ÉCHEC:", e.message);
        process.exit(1);
    } finally { await browser.close(); }
})();
