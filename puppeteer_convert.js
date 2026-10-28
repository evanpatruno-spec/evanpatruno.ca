const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function convert() {
    console.log("Démarrage de la conversion PDF...");
    const args = process.argv.slice(2);
    let htmlPath, pdfPath;

    if (args.length === 2 && (args[0].endsWith('.html') || args[1].endsWith('.pdf'))) {
        htmlPath = path.resolve(args[0]);
        pdfPath = path.resolve(args[1]);
    } else {
        let reportMonth, reportYear;
        if (args.length === 2) {
            reportYear = parseInt(args[0], 10);
            reportMonth = parseInt(args[1], 10);
        } else if (args.length === 1 && args[0].includes('-')) {
            const parts = args[0].split('-');
            reportYear = parseInt(parts[0], 10);
            reportMonth = parseInt(parts[1], 10);
        } else {
            const now = new Date();
            reportMonth = now.getMonth(); // Mois précédent (0-indexed -> 1-indexed M-1)
            reportYear = now.getFullYear();
            if (reportMonth === 0) {
                reportMonth = 12;
                reportYear -= 1;
            }
        }

        const monthStr = String(reportMonth).padStart(2, '0');
        const filename = `${reportYear}-${monthStr}`;
        htmlPath = path.join(__dirname, 'rapports', `${filename}.html`);
        pdfPath = path.join(__dirname, 'rapports', `${filename}.pdf`);
    }

    if (!fs.existsSync(htmlPath)) {
        console.error(`Erreur: Le fichier HTML ${htmlPath} n'existe pas.`);
        process.exit(1);
    }

    try {
        const browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();

        const contentHtml = fs.readFileSync(htmlPath, 'utf8');
        await page.setContent(contentHtml, { waitUntil: 'networkidle0' });

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
