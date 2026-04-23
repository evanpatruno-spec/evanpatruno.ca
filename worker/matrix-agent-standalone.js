const { chromium } = require('playwright');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

async function getMfaCode() {
    console.log("[GitHub Worker] 📧 Connexion à Gmail pour récupérer le code...");
    const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASS
        },
        logger: false
    });

    try {
        await client.connect();
        let lock = await client.getMailboxLock('INBOX');
        try {
            const messages = await client.search({ from: 'noreply@centris.ca' });
            if (messages.length === 0) throw new Error("Aucun email Centris trouvé.");
            const lastId = messages[messages.length - 1];
            let message = await client.fetchOne(lastId, { source: true });
            let parsed = await simpleParser(message.source);
            const codeMatch = parsed.text.match(/\b\d{6}\b/);
            if (codeMatch) {
                console.log("[GitHub Worker] 🔑 Code trouvé dans l'email !");
                return codeMatch[0];
            }
            throw new Error("Code non trouvé.");
        } finally {
            lock.release();
        }
    } catch (err) {
        console.error("[GitHub Worker] ❌ Erreur Gmail:", err.message);
        return null;
    } finally {
        await client.logout();
    }
}

(async () => {
    const mlsNumber = process.env.MLS_NUMBER;
    const clientEmail = process.env.CLIENT_EMAIL;

    console.log(`[GitHub Worker] 🚀 DÉMARRAGE: MLS ${mlsNumber} pour ${clientEmail}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });

    // --- INJECTION DE SESSION ---
    if (process.env.MATRIX_COOKIES) {
        console.log("[GitHub Worker] 🍪 Injection de la session existante...");
        const cookies = process.env.MATRIX_COOKIES.split(';').map(pair => {
            const parts = pair.trim().split('=');
            return {
                name: parts[0],
                value: parts.slice(1).join('='),
                domain: '.centris.ca',
                path: '/'
            };
        });
        await context.addCookies(cookies);
    }

    const page = await context.newPage();

    try {
        console.log("[GitHub Worker] 🌐 Accès à Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });
        
        // Si on voit encore le login
        if (await page.isVisible('#Username, #username')) {
            console.log("[GitHub Worker] 🔑 Login requis...");
            await page.fill('input[type="text"], #Username', process.env.MATRIX_USER);
            await page.fill('input[type="password"], #Password', process.env.MATRIX_PASS);
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle' }),
                page.click('button[type="submit"], #login-button')
            ]);

            // Gestion MFA
            await page.waitForTimeout(5000);
            if (page.url().includes('challenge') || await page.isVisible('input[name*="Code"]')) {
                console.log("[GitHub Worker] 🛡️ MFA détecté !");
                const code = await getMfaCode();
                if (code) {
                    await page.fill('input[name*="Code"]', code);
                    await page.click('button[type="submit"]');
                    await page.waitForNavigation({ waitUntil: 'networkidle' });
                }
            }
        }

        console.log("[GitHub Worker] ✅ Connecté !");
        
        // RECHERCHE
        console.log("[GitHub Worker] 🔍 Chargement de l'interface Matrix...");
        await page.waitForTimeout(10000); // On donne 10s pour que tout s'affiche
        await page.keyboard.press('Escape');
        
        console.log("[GitHub Worker] 🔍 Recherche MLS...");
        const searchInput = await page.waitForSelector('#m_txtSpeedBarInput, input[name*="SpeedBar"]', { timeout: 30000 });
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');
        
        // ENVOI
        console.log("[GitHub Worker] 📄 Envoi documents...");
        await page.waitForTimeout(5000); 
        await page.click('a[title*="Document"], text="Documents"');
        await page.waitForTimeout(3000);
        await page.click('#chkSelectAll');
        await page.click('button:has-text("Partager")');
        await page.waitForSelector('#txtEmailTo');
        await page.fill('#txtEmailTo', clientEmail);
        await page.fill('#txtSubject', `Documentation - Inscription MLS ${mlsNumber}`);
        await page.click('button:has-text("Partager")');
        console.log("[GitHub Worker] ✨ MISSION RÉUSSIE !");

    } catch (e) {
        console.error("[GitHub Worker] ❌ ÉCHEC:", e.message);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
