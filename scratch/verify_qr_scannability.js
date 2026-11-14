const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/e90803ef-432d-4cee-be21-9af6a6b6ad21';

async function testQrDecoding(pngFileName, expectedToken) {
  const pngPath = path.join(ARTIFACT_DIR, pngFileName);
  const imgBase64 = fs.readFileSync(pngPath).toString('base64');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
      </head>
      <body>
        <img id="cert-img" src="data:image/png;base64,${imgBase64}" />
        <canvas id="qr-crop"></canvas>
        <script>
          const img = document.getElementById('cert-img');
          img.onload = () => {
            const canvas = document.getElementById('qr-crop');
            const ctx = canvas.getContext('2d');
            
            // Full image or crop to lower-right where QR is located
            // In a landscape certificate (e.g. 2381 x 1684), QR is in the lower right quarter
            const cropX = Math.floor(img.naturalWidth * 0.75);
            const cropY = Math.floor(img.naturalHeight * 0.75);
            const cropW = img.naturalWidth - cropX;
            const cropH = img.naturalHeight - cropY;

            canvas.width = cropW;
            canvas.height = cropH;
            ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            const imageData = ctx.getImageData(0, 0, cropW, cropH);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code) {
              window.qrResult = { success: true, data: code.data };
            } else {
              // Try full image as fallback
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              ctx.drawImage(img, 0, 0);
              const fullData = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
              const fullCode = jsQR(fullData.data, fullData.width, fullData.height);
              if (fullCode) {
                window.qrResult = { success: true, data: fullCode.data };
              } else {
                window.qrResult = { success: false, error: 'QR Code could not be decoded by jsQR' };
              }
            }
          };
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.qrResult !== undefined, { timeout: 15000 });
  const result = await page.evaluate(() => window.qrResult);
  await browser.close();

  console.log(`\n========================================`);
  console.log(`Scanning: ${pngFileName}`);
  console.log(`Result:`, result);
  if (result.success) {
    console.log(`✓ DECODED URL: ${result.data}`);
    const matchesExpected = result.data.includes(expectedToken);
    console.log(`✓ Verification Token '${expectedToken}' Present: ${matchesExpected}`);
  } else {
    console.error(`✗ Failed to scan QR code in ${pngFileName}`);
  }
}

(async () => {
  try {
    await testQrDecoding('modern_research_work_certificate_rendered.png', 'tok-csjmu-res-2026-000002');
    await testQrDecoding('modern_incentive_award_certificate_rendered.png', 'tok-csjmu-inc-2026-000005');
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
})();
