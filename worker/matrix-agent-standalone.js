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
        // --- 1. CONNEXION ---
        console.log("[GitHub Worker] Accès à Centris.ca...");
        await page.goto('https://www.centris.ca/fr', { waitUntil: 'networkidle' });
        
        // On cherche le bouton connexion (Souvent en haut à droite)
        console.log("[GitHub Worker] Clic sur Connexion...");
        await page.click('text="Connexion"');
        await page.waitForTimeout(2000);

        // Attendre que le champ Username soit visible (page de login)
        await page.waitForSelector('#Username', { timeout: 30000 });
        await page.fill('#Username', process.env.MATRIX_USER);
        await page.fill('#Password', process.env.MATRIX_PASS);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('button[type="submit"]')
        ]);

        console.log("[GitHub Worker] Authentifié, direction Matrix...");
        // --- 2. MATRIX ---
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });
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
