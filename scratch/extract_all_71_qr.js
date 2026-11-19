const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function extractAll71() {
  const pdfPath = 'C:/Users/harsh/Downloads/SAMIKSHA_INCENTIVE_CERT_71.pdf';
  const pdfBytes = fs.readFileSync(pdfPath);
  const base64Data = pdfBytes.toString('base64');

  console.log('Launching browser to scan all 71 pages of SAMIKSHA_INCENTIVE_CERT_71.pdf...');
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

          async function processAll() {
            try {
              const pdfData = atob("${base64Data}");
              const loadingTask = pdfjsLib.getDocument({ data: pdfData });
              const pdf = await loadingTask.promise;
              const numPages = pdf.numPages;
              console.log('Total pages:', numPages);

              const canvas = document.getElementById('pdf-canvas');
              const context = canvas.getContext('2d');
              const cropCanvas = document.createElement('canvas');
              const cropCtx = cropCanvas.getContext('2d');

              for (let pageNo = 1; pageNo <= numPages; pageNo++) {
                const pdfPage = await pdf.getPage(pageNo);
                const scale = 2.0;
                const viewport = pdfPage.getViewport({ scale: scale });
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await pdfPage.render({ canvasContext: context, viewport: viewport }).promise;

                // QR is in the lower right quarter
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
                if (code) {
                  qrData = code.data;
                } else {
                  // Fallback full page
                  const fullData = context.getImageData(0, 0, canvas.width, canvas.height);
                  code = jsQR(fullData.data, fullData.width, fullData.height);
                  if (code) qrData = code.data;
                }

                // Extract text from pdfPage
                const textContent = await pdfPage.getTextContent();
                const textItems = textContent.items.map(it => it.str).join(' ');

                window.results.push({
                  page: pageNo,
                  qr_url: qrData,
                  text_preview: textItems.substring(0, 300)
                });
              }
              window.isFinished = true;
            } catch (err) {
              window.results.push({ error: err.toString() });
              window.isFinished = true;
            }
          }
          processAll();
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.isFinished === true, { timeout: 180000 });
  const results = await page.evaluate(() => window.results);
  await browser.close();

  fs.writeFileSync('scratch/all_71_extracted.json', JSON.stringify(results, null, 2));
  console.log(`Successfully processed all ${results.length} pages! Saved to scratch/all_71_extracted.json`);
}

extractAll71().catch(console.error);
