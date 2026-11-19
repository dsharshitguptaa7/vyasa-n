const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function debugScan(fileName) {
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
            const scale = 3.0; // 3x scale for higher fidelity
            const viewport = pdfPage.getViewport({ scale: scale });
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

            const fullData = context.getImageData(0, 0, canvas.width, canvas.height);
            let code = jsQR(fullData.data, fullData.width, fullData.height);
            if (code) {
              window.qrResult = { success: true, data: code.data, location: code.location };
              return;
            }

            // Try sliding window or multiple regions
            // Check quadrants
            const regions = [
              { name: 'bottom-right', x: 0.6, y: 0.6, w: 0.4, h: 0.4 },
              { name: 'bottom-left', x: 0.0, y: 0.6, w: 0.4, h: 0.4 },
              { name: 'bottom-center', x: 0.3, y: 0.6, w: 0.4, h: 0.4 },
              { name: 'top-right', x: 0.6, y: 0.0, w: 0.4, h: 0.4 },
            ];

            for (const r of regions) {
              const rx = Math.floor(canvas.width * r.x);
              const ry = Math.floor(canvas.height * r.y);
              const rw = Math.floor(canvas.width * r.w);
              const rh = Math.floor(canvas.height * r.h);
              const cCanv = document.createElement('canvas');
              cCanv.width = rw;
              cCanv.height = rh;
              const cCtx = cCanv.getContext('2d');
              cCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, rw, rh);
              const imgData = cCtx.getImageData(0, 0, rw, rh);
              const cCode = jsQR(imgData.data, imgData.width, imgData.height);
              if (cCode) {
                window.qrResult = { success: true, data: cCode.data, region: r.name };
                return;
              }
            }

            window.qrResult = { success: false, error: 'QR not found anywhere' };
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
  
  // Also save screenshot to scratch
  const canvasElement = await page.$('#pdf-canvas');
  const outPng = path.resolve('scratch', `${fileName}.png`);
  await canvasElement.screenshot({ path: outPng });
  console.log(`Saved screenshot to ${outPng}`);

  await browser.close();
  return result;
}

(async () => {
  for (const f of ['0cef9838bfa6_CSJMU_SAMIKSHA_2026_000002.pdf', '88bd3085cd32_CSJMU_SAMIKSHA_2026_000001.pdf']) {
    const res = await debugScan(f);
    console.log(`FILE: ${f}`);
    console.log(`RESULT:`, JSON.stringify(res));
  }
})();
