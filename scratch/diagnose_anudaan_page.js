const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  page.on('request', req => console.log('REQUEST:', req.method(), req.url()));

  await page.goto('http://localhost:5173/research/anudaan', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const html = await page.content();
  console.log('Includes section-b:', html.includes('section-b'));
  console.log('Includes Institutional Incentive Sanction Register:', html.includes('Institutional Incentive Sanction Register'));
  console.log('Includes anudaan-impact-section:', html.includes('anudaan-impact-section'));

  await browser.close();
}

test().catch(console.error);
