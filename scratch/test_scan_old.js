const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testScan(fileName) {
  const pdfPath = path.resolve('backend/storage/sama_veda/certificates', fileName);
  const pdfBytes = fs.readFileSync(pdfPath);
  const base64Data = pdfBytes.toString('base64');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
        <script>
          const pdfData = atob("${base64Data}");
          const loadingTask = pdfjsLib.getDocument({ data: pdfData });
          loadingTask.promise.then(async function(pdf) {
            const pdfPage = await pdf.getPage(1);
            // Render at scale 2.0
            const viewport = pdfPage.getViewport({ scale: 2.0 });
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

            // In A4 landscape (841.89 x 595.28 pt):
            // footer_y = 48 pt.
            // qr_size = 44 pt.
            // qr_x = width - 45 - 44 = 841.89 - 89 = 752.89 pt.
            // qr_y = 48 - 14 = 34 pt from bottom.
            // In PDF canvas coordinates from top:
            // Y from top = (595.28 - (34 + 44)) * scale = (595.28 - 78) * 2 = 517.28 * 2 = 1034.56 px.
            // X from left = 752.89 * 2 = 1505.78 px.
            // Box size: 44 * 2 = 88 px.
            
            // Let's crop around [1450, 980, 200, 200]:
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = 250;
            cropCanvas.height = 250;
            const cCtx = cropCanvas.getContext('2d');
            cCtx.drawImage(canvas, 1450, 980, 250, 250, 0, 0, 250, 250);

            const imgData = cCtx.getImageData(0, 0, 250, 250);
            const code = jsQR(imgData.data, imgData.width, imgData.height);
            if (code) {
              window.qrResult = { success: true, data: code.data, source: 'cropped' };
              return;
            }

            // Also test scanning full canvas
            const fullImg = context.getImageData(0, 0, canvas.width, canvas.height);
            const fullCode = jsQR(fullImg.data, fullImg.width, fullImg.height);
            if (fullCode) {
              window.qrResult = { success: true, data: fullCode.data, source: 'full' };
              return;
            }

            window.qrResult = { success: false, error: 'QR not found' };
          }).catch(err => {
            window.qrResult = { success: false, error: err.toString() };
          });
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.qrResult !== undefined, { timeout: 30000 });
  const result = await page.evaluate(() => window.qrResult);
  await browser.close();
  return result;
}

(async () => {
  for (const f of ['0cef9838bfa6_CSJMU_SAMIKSHA_2026_000002.pdf', '88bd3085cd32_CSJMU_SAMIKSHA_2026_000001.pdf']) {
    const res = await testScan(f);
    console.log(`FILE: ${f}`);
    console.log(`RESULT:`, JSON.stringify(res));
  }
})();
