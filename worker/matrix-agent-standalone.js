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
            // Chercher les emails de Centris reçus dans les 2 dernières minutes
            const messages = await client.search({ from: 'noreply@centris.ca' });
            if (messages.length === 0) throw new Error("Aucun email Centris trouvé.");

            // Prendre le plus récent
            const lastId = messages[messages.length - 1];
            let message = await client.fetchOne(lastId, { source: true });
            let parsed = await simpleParser(message.source);
            
            // Extraire le code (6 chiffres)
            const codeMatch = parsed.text.match(/\b\d{6}\b/);
            if (codeMatch) {
                console.log("[GitHub Worker] 🔑 Code trouvé dans l'email !");
                return codeMatch[0];
            }
            throw new Error("Code non trouvé dans le texte de l'email.");
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
    const page = await context.newPage();

    try {
        // --- 1. CONNEXION ---
        console.log("[GitHub Worker] 🌐 Accès à Matrix...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });
        
        console.log("[GitHub Worker] 🔑 Recherche du formulaire...");
        const userField = await page.waitForSelector('input[type="text"], #Username, #username', { timeout: 30000 });
        await userField.fill(process.env.MATRIX_USER);
        
        const passField = await page.waitForSelector('input[type="password"], #Password, #password', { timeout: 5000 });
        await passField.fill(process.env.MATRIX_PASS);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[type="submit"], #login-button')
        ]);

        // --- GESTION MFA (SI PRÉSENTE) ---
        await page.waitForTimeout(5000); // Attendre de voir si l'écran MFA arrive
        const isMfa = await page.isVisible('text="verification", text="code", #VerificationCode');
        if (isMfa || page.url().includes('challenge')) {
            console.log("[GitHub Worker] 🛡️ MFA détecté !");
            await page.waitForTimeout(10000); // Laisser 10s à l'email pour arriver
            const code = await getMfaCode();
            if (code) {
                await page.fill('input[name*="Code"], #VerificationCode', code);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle' }),
                    page.click('button[type="submit"], .btn-primary')
                ]);
            }
        }

        console.log("[GitHub Worker] ✅ Authentifié !");
        
        // --- 2. RECHERCHE ---
        console.log("[GitHub Worker] 🔍 Préparation de l'interface Matrix...");
        await page.waitForTimeout(5000); // Laisser Matrix finir de charger les outils
        await page.keyboard.press('Escape'); // Fermer une éventuelle popup de bienvenue
        
        console.log("[GitHub Worker] 🔍 Recherche MLS...");
        // On essaie plusieurs variantes pour la barre de recherche SpeedBar
        const searchInput = await page.waitForSelector('input[name*="SpeedBar"], input#m_txtSpeedBarInput, .SpeedBarInput', { timeout: 20000 });
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');
        
        // --- 3. ENVOI ---
        console.log("[GitHub Worker] 📄 Accès aux documents...");
        await page.waitForTimeout(5000); 
        await page.click('a[title*="Document"], text="Documents"');
        await page.waitForTimeout(3000);
        
        console.log("[GitHub Worker] 📧 Partage au client...");
        await page.click('#chkSelectAll, .select-all-checkbox');
        await page.click('button:has-text("Partager"), #btnShare');
        
        await page.waitForSelector('#txtEmailTo, input[name*="Email"]');
        await page.fill('#txtEmailTo, input[name*="Email"]', clientEmail);
        await page.fill('#txtSubject, input[name*="Subject"]', `Documentation - Inscription MLS ${mlsNumber}`);
        
        await page.click('button:has-text("Partager"), .btn-send');
        console.log("[GitHub Worker] ✨ MISSION RÉUSSIE !");

    } catch (e) {
        console.error("[GitHub Worker] ❌ ÉCHEC");
        console.error(`- Cause: ${e.message}`);
        console.error(`- URL finale: ${page.url()}`);
        try {
            const pageTitle = await page.title();
            console.error(`- Titre: ${pageTitle}`);
            const textContent = await page.innerText('body');
            console.error(`- Texte visible: ${textContent.substring(0, 800)}...`);
        } catch (diagErr) {
            console.error("- Impossible de récupérer les détails visuels.");
        }
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
