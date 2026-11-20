import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Starting preview server...');
  const previewProcess = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    cwd: path.resolve(__dirname, '../frontend'),
    shell: true,
  });

  previewProcess.stdout.on('data', (data) => {
    // console.log(`stdout: ${data}`);
  });
  previewProcess.stderr.on('data', (data) => {
    // console.log(`stderr: ${data}`);
  });

  // Wait for server to be ready
  await new Promise((resolve) => setTimeout(resolve, 2500));

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const viewports = [
    { name: '320px (iPhone 5/SE)', width: 320, height: 600 },
    { name: '360px (Galaxy S8)', width: 360, height: 740 },
    { name: '375px (iPhone SE/X)', width: 375, height: 667 },
    { name: '390px (iPhone 12/13/14)', width: 390, height: 844 },
    { name: '414px (iPhone Plus/XR)', width: 414, height: 896 },
    { name: '768px (Tablet Portrait)', width: 768, height: 1024 },
    { name: '1280px (Desktop)', width: 1280, height: 800 },
  ];

  let allPassed = true;

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });
    await page.waitForSelector('.csjmu-top-bar', { state: 'visible', timeout: 5000 });

    const checks = await page.evaluate((width) => {
      const docScrollWidth = document.documentElement.scrollWidth;
      const bodyScrollWidth = document.body.scrollWidth;
      const header = document.querySelector('.vyasa-public-header');
      const topBar = document.querySelector('.csjmu-top-bar');
      const masthead = document.querySelector('.vyasa-public-masthead');
      const nameEn = document.querySelector('.university-brand__name-en');
      const subtitle = document.querySelector('.university-brand__subtitle, .university-brand__accreditation');
      const nameHi = document.querySelector('.university-brand__name-hi');
      const location = document.querySelector('.csjmu-top-bar__location');
      const logo = document.querySelector('.csjmu-logo-container');

      const getBox = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };

      return {
        docScrollWidth,
        bodyScrollWidth,
        headerScrollWidth: header ? header.scrollWidth : null,
        topBarScrollWidth: topBar ? topBar.scrollWidth : null,
        mastheadScrollWidth: masthead ? masthead.scrollWidth : null,
        nameEnBox: getBox(nameEn),
        subtitleBox: getBox(subtitle),
        nameHiBox: getBox(nameHi),
        locationBox: getBox(location),
        logoBox: getBox(logo),
      };
    }, vp.width);

    const hasHorizontalOverflow = checks.docScrollWidth > vp.width || checks.topBarScrollWidth > vp.width;
    const nameEnOverflow = checks.nameEnBox && checks.nameEnBox.right > vp.width;
    const subtitleOverflow = checks.subtitleBox && checks.subtitleBox.right > vp.width;
    const nameHiOverflow = checks.nameHiBox && checks.nameHiBox.right > vp.width;
    const locationOverflow = checks.locationBox && checks.locationBox.right > vp.width;

    const vpPassed = !hasHorizontalOverflow && !nameEnOverflow && !subtitleOverflow && !nameHiOverflow && !locationOverflow;

    if (!vpPassed) {
      allPassed = false;
      console.error(`FAIL: ${vp.name}`);
      console.error(JSON.stringify(checks, null, 2));
    } else {
      console.log(`PASS: ${vp.name} - doc: ${checks.docScrollWidth}px/${vp.width}px, topBar: ${checks.topBarScrollWidth}px, logo: ${checks.logoBox?.width}x${checks.logoBox?.height}px, nameEn: w=${checks.nameEnBox?.width}px, h=${checks.nameEnBox?.height}px, subtitle: w=${checks.subtitleBox?.width}px, h=${checks.subtitleBox?.height}px`);
    }

    if (vp.width === 320 || vp.width === 375 || vp.width === 768 || vp.width === 1280) {
      await page.screenshot({ path: path.resolve(__dirname, `screenshot_${vp.width}px.png`), clip: { x: 0, y: 0, width: vp.width, height: 300 } });
    }

    await page.close();
  }

  await browser.close();
  previewProcess.kill();

  if (allPassed) {
    console.log('\nALL VIEWPORTS VALIDATED SUCCESSFULLY! No horizontal overflow, no clipping.');
    process.exit(0);
  } else {
    console.error('\nSOME VIEWPORTS FAILED!');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
