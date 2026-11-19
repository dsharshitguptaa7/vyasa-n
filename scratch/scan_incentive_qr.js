const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function scanIncentivePdfPage(pageNo) {
  const pdfPath = 'C:/Users/harsh/Downloads/SAMIKSHA_INCENTIVE_CERT_71.pdf';
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
            const pdfPage = await pdf.getPage(${pageNo});
            const scale = 2.0;
            const viewport = pdfPage.getViewport({ scale: scale });
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

            const fullData = context.getImageData(0, 0, canvas.width, canvas.height);
            let code = jsQR(fullData.data, fullData.width, fullData.height);
            if (code) {
              window.qrResult = { success: true, data: code.data };
              return;
            }

            // Crop bottom right
            const cropX = Math.floor(canvas.width * 0.70);
            const cropY = Math.floor(canvas.height * 0.70);
            const cropW = canvas.width - cropX;
            const cropH = canvas.height - cropY;
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const cropData = cropCtx.getImageData(0, 0, cropW, cropH);
            code = jsQR(cropData.data, cropData.width, cropData.height);
            if (code) {
              window.qrResult = { success: true, data: code.data };
            } else {
              window.qrResult = { success: false, error: 'QR not found' };
            }
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
  for (const p of [1, 2, 3, 67, 68, 69, 70, 71]) {
    const res = await scanIncentivePdfPage(p);
    console.log(`Page ${p} ->`, res);
  }
})();
