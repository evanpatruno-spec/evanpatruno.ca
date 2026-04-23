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
        
        // --- NOUVEAU : GESTION DES COOKIES (Didomi) ---
        try {
            console.log("[GitHub Worker] Fermeture popup Cookies...");
            await page.waitForSelector('#didomi-notice-agree-button', { timeout: 5000 });
            await page.click('#didomi-notice-agree-button');
            await page.waitForTimeout(1000);
        } catch (e) {
            console.log("[GitHub Worker] Pas de popup cookies détectée.");
        }
        
        // On cherche le bouton connexion et on capture le nouvel onglet
        console.log("[GitHub Worker] Clic sur Connexion (attente nouvel onglet)...");
        const [loginPage] = await Promise.all([
            context.waitForEvent('page'),
            page.click('text="Connexion"')
        ]);

        await loginPage.waitForLoadState('networkidle');

        // Attendre que le champ Username soit visible (page de login)
        console.log("[GitHub Worker] Saisie des identifiants...");
        await loginPage.waitForSelector('#Username', { timeout: 30000 });
        await loginPage.fill('#Username', process.env.MATRIX_USER);
        await loginPage.fill('#Password', process.env.MATRIX_PASS);
        
        await Promise.all([
            loginPage.waitForNavigation({ waitUntil: 'networkidle' }),
            loginPage.click('button[type="submit"]')
        ]);

        console.log("[GitHub Worker] Authentifié, direction Matrix...");
        // --- 2. MATRIX ---
        await loginPage.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle' });
        const searchInput = await loginPage.waitForSelector('input[name="m_pSearch_m_txtSpeedBarInput"]');
        await searchInput.fill(mlsNumber);
        await loginPage.keyboard.press('Enter');
        
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
