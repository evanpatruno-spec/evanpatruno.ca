const { chromium } = require('playwright');

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
        // On cherche n'importe quel champ de texte pour le login
        const userField = await page.waitForSelector('input[type="text"], input[name*="ser"], #Username, #username', { timeout: 30000 });
        await userField.fill(process.env.MATRIX_USER);
        
        const passField = await page.waitForSelector('input[type="password"], #Password, #password', { timeout: 5000 });
        await passField.fill(process.env.MATRIX_PASS);
        
        console.log("[GitHub Worker] 📤 Envoi...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[type="submit"], input[type="submit"], .btn-primary')
        ]);

        console.log("[GitHub Worker] ✅ Authentifié !");
        
        // --- 2. RECHERCHE ---
        console.log("[GitHub Worker] 🔍 Recherche MLS...");
        const searchInput = await page.waitForSelector('input[name*="SpeedBar"]', { timeout: 10000 });
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
        console.error("[GitHub Worker] ❌ ÉCHEC DU ROBOT");
        console.error(`- Cause: ${e.message}`);
        console.error(`- URL finale: ${page.url()}`);
        try {
            const pageTitle = await page.title();
            console.error(`- Titre: ${pageTitle}`);
            const text = await page.innerText('body');
            console.error(`- Contenu: ${text.substring(0, 300)}...`);
        } catch (diagErr) {}
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
