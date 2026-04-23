const { chromium } = require('playwright-core');
const chromiumPath = require('chrome-aws-lambda');

/**
 * MATRIX AGENT v1.0 - Robot d'automatisation Centris/Matrix
 */
async function runMatrixAgent(mlsNumber, clientEmail) {
    let browser = null;
    try {
        console.log(`[Matrix Agent] Initialisation pour MLS: ${mlsNumber} -> ${clientEmail}`);

        browser = await chromium.launch({
            args: chromiumPath.args,
            executablePath: await chromiumPath.executablePath,
            headless: chromiumPath.headless,
        });

        const context = await browser.newContext();
        const page = await context.newPage();

        // --- 1. CONNEXION CENTRIS ---
        await page.goto('https://accounts.centris.ca/account/login', { waitUntil: 'networkidle0' });
        await page.fill('#Username', process.env.MATRIX_USER);
        await page.fill('#Password', process.env.MATRIX_PASS);
        await page.click('button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });

        // --- 2. ACCÈS MATRIX ---
        // On attend que le tableau de bord charge puis on clique sur le lien Matrix
        await page.goto('https://zone.centris.ca/Dashboard?mi=1', { waitUntil: 'networkidle0' });
        // Simulation de la redirection vers Matrix
        await page.goto('https://matrix.centris.ca/Matrix/Default.aspx', { waitUntil: 'networkidle0' });

        // --- 3. RECHERCHE RAPIDE ---
        const searchInput = await page.waitForSelector('input[name="m_pSearch_m_txtSpeedBarInput"]', { timeout: 15000 });
        await searchInput.fill(mlsNumber);
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');

        // --- 4. ACCÈS AUX DOCUMENTS ---
        // On clique sur l'icône de document (observée à 0:13 dans la vidéo)
        await page.click('a[title="Documents"]');
        await page.waitForLoadState('networkidle');

        // --- 5. SÉLECTION ET PARTAGE ---
        // Sélection de tous les documents
        await page.click('#chkSelectAll');
        await page.click('button:has-text("Partager")');

        // --- 6. ENVOI COURRIEL ---
        await page.waitForSelector('#txtEmailTo');
        await page.fill('#txtEmailTo', clientEmail);
        await page.fill('#txtSubject', `Documents confidentiels - Inscription MLS ${mlsNumber}`);
        await page.fill('#txtMessage', "Bonjour,\n\nVoici les documents demandés concernant la propriété.\n\nCordialement,\nMatrix Agent");
        
        await page.click('button:has-text("Partager")');
        await page.waitForSelector('text=Le partage de documents (0) est complété', { timeout: 10000 });

        console.log(`[Matrix Agent] Succès total pour MLS ${mlsNumber}`);
        return { success: true };

    } catch (error) {
        console.error("[Matrix Agent] ÉCHEC:", error);
        return { success: false, error: error.message };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { runMatrixAgent };
