const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/research/anudaan', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const sectionB = await page.$eval('#section-b', el => el.outerHTML);
  console.log('SECTION B HTML:\n', sectionB.substring(0, 1000));

  await browser.close();
}

test().catch(console.error);
