const { chromium } = require('playwright');

(async () => {
    const mlsNumber = process.env.MLS_NUMBER;
    const clientEmail = process.env.CLIENT_EMAIL;

    console.log(`[GitHub Worker] Démarrage: MLS ${mlsNumber} pour ${clientEmail}`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // --- 1. CONNEXION ---
        await page.goto('https://accounts.centris.ca/account/login');
        await page.fill('#Username', process.env.MATRIX_USER);
        await page.fill('#Password', process.env.MATRIX_PASS);
        await page.click('button[type="submit"]');
        await page.waitForNavigation();

        // --- 2. MATRIX ---
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx');
        const searchInput = await page.waitForSelector('input[name="m_pSearch_m_txtSpeedBarInput"]');
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');
        
        // --- 3. ENVOI ---
        // Attendre que les résultats chargent
        await page.waitForTimeout(5000); 
        await page.click('a[title="Documents"]');
        await page.waitForTimeout(3000);
        
        await page.click('#chkSelectAll');
        await page.click('button:has-text("Partager")');
        
        await page.waitForSelector('#txtEmailTo');
        await page.fill('#txtEmailTo', clientEmail);
        await page.fill('#txtSubject', `Documentation - Inscription MLS ${mlsNumber}`);
        await page.click('button:has-text("Partager")');
        
        console.log("[GitHub Worker] Succès !");
    } catch (e) {
        console.error("[GitHub Worker] Erreur:", e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
