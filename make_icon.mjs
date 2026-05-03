import { Jimp } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createSilhouette() {
    try {
        const sourcePath = path.join(__dirname, 'pwa-icon-192.png');
        const outputPath = path.join(__dirname, 'notification-icon.png');

        console.log(`Loading ${sourcePath}...`);
        const image = await Jimp.read(sourcePath);

        // Transformer en silhouette blanche
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
            const alpha = this.bitmap.data[idx + 3];
            if (alpha > 50) {
                this.bitmap.data[idx] = 255;     // R
                this.bitmap.data[idx + 1] = 255; // G
                this.bitmap.data[idx + 2] = 255; // B
            }
        });

        await image.write(outputPath);
        console.log(`Success! Silhouette saved to ${outputPath}`);
    } catch (err) {
        console.error('Error:', err);
    }
}

createSilhouette();
