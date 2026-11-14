const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/e90803ef-432d-4cee-be21-9af6a6b6ad21';

async function renderPdf(pdfPath, outPngPath) {
  const pdfBytes = fs.readFileSync(pdfPath);
  const base64Data = pdfBytes.toString('base64');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 2400, height: 1600 } });

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <style>
          body { margin: 0; padding: 40px; background: #334155; display: block; }
          #pdf-canvas { box-shadow: 0 10px 30px rgba(0,0,0,0.4); border-radius: 4px; display: block; margin: 0 auto; }
        </style>
      </head>
      <body>
        <canvas id="pdf-canvas"></canvas>
        <script>
          const pdfData = atob("${base64Data}");
          const loadingTask = pdfjsLib.getDocument({ data: pdfData });
          loadingTask.promise.then(async function(pdf) {
            const page = await pdf.getPage(1);
            const scale = 2.0; // High-resolution 2x render
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            await page.render(renderContext).promise;
            window.renderComplete = true;
          });
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.renderComplete === true, { timeout: 30000 });
  const canvasElement = await page.$('#pdf-canvas');
  await canvasElement.screenshot({ path: outPngPath });
  await browser.close();
  console.log(`Rendered PDF screenshot saved to: ${outPngPath}`);
}

(async () => {
  try {
    const modernResearchPdf = path.join(ARTIFACT_DIR, 'modern_research_work_certificate.pdf');
    const modernResearchPng = path.join(ARTIFACT_DIR, 'modern_research_work_certificate_rendered.png');
    if (fs.existsSync(modernResearchPdf)) {
      await renderPdf(modernResearchPdf, modernResearchPng);
    }

    const modernIncentivePdf = path.join(ARTIFACT_DIR, 'modern_incentive_award_certificate.pdf');
    const modernIncentivePng = path.join(ARTIFACT_DIR, 'modern_incentive_award_certificate_rendered.png');
    if (fs.existsSync(modernIncentivePdf)) {
      await renderPdf(modernIncentivePdf, modernIncentivePng);
    }

    console.log('All PDF visual renders completed successfully!');
  } catch (err) {
    console.error('Failed to render PDF to PNG:', err);
    process.exit(1);
  }
})();
