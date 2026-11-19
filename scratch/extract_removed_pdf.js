const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function extractRemoved() {
  const pdfPath = 'C:/Users/harsh/Downloads/SAMIKSHA_INCENTIVE_CERT_71_removed.pdf';
  const pdfBytes = fs.readFileSync(pdfPath);
  const base64Data = pdfBytes.toString('base64');

  console.log('Scanning SAMIKSHA_INCENTIVE_CERT_71_removed.pdf for numbers 19, 36, 45, 73, 74...');
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
          window.results = [];
          window.isFinished = false;

          async function processTargetPages() {
            try {
              const pdfData = atob("${base64Data}");
              const loadingTask = pdfjsLib.getDocument({ data: pdfData });
              const pdf = await loadingTask.promise;
              const numPages = pdf.numPages;

              const canvas = document.getElementById('pdf-canvas');
              const context = canvas.getContext('2d');
              const cropCanvas = document.createElement('canvas');
              const cropCtx = cropCanvas.getContext('2d');

              for (let pageNo = 1; pageNo <= numPages; pageNo++) {
                const pdfPage = await pdf.getPage(pageNo);
                const textContent = await pdfPage.getTextContent();
                const textItems = textContent.items.map(it => it.str).join(' ');

                // Check if this page has 19, 36, 45, 73, 74 or scan all
                const scale = 2.0;
                const viewport = pdfPage.getViewport({ scale: scale });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

                const cropX = Math.floor(canvas.width * 0.70);
                const cropY = Math.floor(canvas.height * 0.70);
                const cropW = canvas.width - cropX;
                const cropH = canvas.height - cropY;
                cropCanvas.width = cropW;
                cropCanvas.height = cropH;
                cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

                const cropData = cropCtx.getImageData(0, 0, cropW, cropH);
                let code = jsQR(cropData.data, cropData.width, cropData.height);
                let qrData = null;
                if (code) qrData = code.data;

                window.results.push({
                  page: pageNo,
                  qr_url: qrData,
                  text: textItems
                });
              }
              window.isFinished = true;
            } catch (err) {
              window.results.push({ error: err.toString() });
              window.isFinished = true;
            }
          }
          processTargetPages();
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.isFinished === true, { timeout: 180000 });
  const results = await page.evaluate(() => window.results);
  await browser.close();

  fs.writeFileSync('scratch/removed_extracted.json', JSON.stringify(results, null, 2));
  console.log(`Saved removed extracted to scratch/removed_extracted.json`);
}

extractRemoved().catch(console.error);
