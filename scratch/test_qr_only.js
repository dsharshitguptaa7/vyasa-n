const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testQrImage(pngName) {
  const pngPath = path.resolve('scratch', pngName);
  const base64Data = fs.readFileSync(pngPath).toString('base64');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
      </head>
      <body>
        <img id="img" src="data:image/png;base64,${base64Data}" />
        <canvas id="c"></canvas>
        <script>
          const img = document.getElementById('img');
          img.onload = () => {
            const canvas = document.getElementById('c');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, img.width, img.height);
            const code = jsQR(data.data, data.width, data.height);
            if (code) {
              window.res = { success: true, data: code.data };
            } else {
              window.res = { success: false, error: 'Cannot decode' };
            }
          };
        </script>
      </body>
    </html>
  `;

  await page.setContent(html);
  await page.waitForFunction(() => window.res !== undefined, { timeout: 15000 });
  const result = await page.evaluate(() => window.res);
  await browser.close();
  console.log(`Image: ${pngName} ->`, result);
}

(async () => {
  await testQrImage('reconstructed_0cef_qr.png');
  await testQrImage('reconstructed_88bd_qr.png');
})();
