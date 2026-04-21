const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function convert() {
    console.log("Démarrage de la conversion PDF...");
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const filename = `${year}-${month}`;
    
    const htmlPath = path.join(__dirname, 'rapports', `${filename}.html`);
    const pdfPath = path.join(__dirname, 'rapports', `${filename}.pdf`);

    if (!fs.existsSync(htmlPath)) {
        console.error(`Erreur: Le fichier HTML ${htmlPath} n'existe pas.`);
        process.exit(1);
    }

    try {
        const browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        
        // Charger le fichier localement
        const contentHtml = fs.readFileSync(htmlPath, 'utf8');
        await page.setContent(contentHtml, { waitUntil: 'networkidle0' });

        // Générer le PDF
        await page.pdf({
            path: pdfPath,
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            }
        });

        await browser.close();
        console.log(`Succès: PDF généré dans ${pdfPath}`);
    } catch (error) {
        console.error("Erreur lors de la conversion PDF:", error);
        process.exit(1);
    }
}

convert();
