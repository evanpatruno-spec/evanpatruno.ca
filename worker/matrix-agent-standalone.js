const { chromium } = require('playwright');

(async () => {
    const mlsNumber = process.env.MLS_NUMBER;
    const clientEmail = process.env.CLIENT_EMAIL;

    console.log(`[GitHub Worker] Démarrage: MLS ${mlsNumber} pour ${clientEmail}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // --- 1. CONNEXION DIRECTE VIA MATRIX ---
        console.log("[GitHub Worker] Accès direct à Matrix (redirection automatique)...");
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });
        
        // Attendre que le champ Username apparaisse (après redirection)
        console.log("[GitHub Worker] Saisie des identifiants...");
        await page.waitForSelector('#Username', { timeout: 30000 });
        await page.fill('#Username', process.env.MATRIX_USER);
        await page.fill('#Password', process.env.MATRIX_PASS);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[type="submit"]')
        ]);

        console.log("[GitHub Worker] Authentifié sur Matrix !");
        
        // --- 2. RECHERCHE MLS ---
        const searchInput = await page.waitForSelector('input[name="m_pSearch_m_txtSpeedBarInput"]');
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');
        
        // --- 3. ENVOI ---
        // Attendre que les résultats chargent
        await loginPage.waitForTimeout(5000); 
        await loginPage.click('a[title="Documents"]');
        await loginPage.waitForTimeout(3000);
        
        await loginPage.click('#chkSelectAll');
        await loginPage.click('button:has-text("Partager")');
        
        await loginPage.waitForSelector('#txtEmailTo');
        await loginPage.fill('#txtEmailTo', clientEmail);
        await loginPage.fill('#txtSubject', `Documentation - Inscription MLS ${mlsNumber}`);
        await loginPage.click('button:has-text("Partager")');
        
        console.log("[GitHub Worker] Succès !");
    } catch (e) {
        console.error("[GitHub Worker] Erreur:", e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
