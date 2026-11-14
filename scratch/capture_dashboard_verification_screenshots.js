const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/4c4006aa-1a26-44b8-8860-e640b61e39fc';
const BASE_URL = 'http://localhost:5173';

const mockSuperAdmin = {
  id: 'e6a849e9-a0ac-4811-aa1a-d86dd7d9079b',
  email: 'sadmin@csjmu.ac.in',
  first_name: 'Dr. Research',
  last_name: 'Director',
  full_name: 'Dr. Research Director',
  role: 'super_admin',
  roles: ['super_admin'],
  permissions: ['sama:read', 'sama:certificate:manage', 'sama:certificate:revoke', 'system:admin'],
  is_active: true,
  is_verified: true,
};

async function main() {
  console.log('Starting Playwright browser for Certificate Management tabs verification...');
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  } catch {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
  });

  const page = await context.newPage();

  // Seed localStorage with real super_admin JWT token
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlNmE4NDllOS1hMGFjLTQ4MTEtYWExYS1kODZkZDdkOTA3OWIiLCJleHAiOjE3OTQ1OTgxNDcsImlhdCI6MTc5NDU5NDU0NywiaXNzIjoidnlhc2EtY29yZS1iYWNrZW5kIn0.aGu5RAlDcp5-EtnXbCRG-c58kxV4I5rtkI4PMvA4rpQ';
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('vyasa_access_token', token);
    window.localStorage.setItem('vyasa_user', JSON.stringify(user));
  }, { token, user: mockSuperAdmin });

  // Navigate to Certificate Management page
  console.log(`Navigating to ${BASE_URL}/admin/sama/certificates...`);
  try {
    await page.goto(`${BASE_URL}/admin/sama/certificates`, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (err) {
    console.log('Direct navigation warning, waiting for selector...', err.message);
  }

  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());
  const title = await page.title();
  console.log('Page title:', title);

  // 1. Capture Dashboard & Issued Ledger
  const shot1 = path.join(ARTIFACT_DIR, '01_restored_dashboard_and_ledger.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`Saved screenshot 1: ${shot1}`);

  // Find all buttons on the page
  const buttons = await page.locator('button').allInnerTexts();
  console.log('Found buttons:', buttons.slice(0, 15));

  // 2. Capture Approval Queue Tab
  const approvalsTab = page.locator('button').filter({ hasText: 'Approval Queue' });
  if (await approvalsTab.count() > 0) {
    await approvalsTab.first().click();
    await page.waitForTimeout(1000);
    const shot2 = path.join(ARTIFACT_DIR, '02_restored_approval_queue.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log(`Saved screenshot 2: ${shot2}`);
  }

  // 3. Capture Online Certificate Designer Tab
  const designerTab = page.locator('button').filter({ hasText: 'Online Certificate Designer' });
  if (await designerTab.count() > 0) {
    await designerTab.first().click();
    await page.waitForTimeout(1000);
    const shot3 = path.join(ARTIFACT_DIR, '03_restored_certificate_designer.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log(`Saved screenshot 3: ${shot3}`);
  }

  // 4. Capture Templates Tab
  const templatesTab = page.locator('button').filter({ hasText: 'Templates' });
  if (await templatesTab.count() > 0) {
    await templatesTab.first().click();
    await page.waitForTimeout(1000);
    const shot4 = path.join(ARTIFACT_DIR, '04_restored_templates_tab.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log(`Saved screenshot 4: ${shot4}`);
  }

  // 5. Capture Signing Authorities Tab
  const signatoriesTab = page.locator('button').filter({ hasText: 'Signing Authorities' });
  if (await signatoriesTab.count() > 0) {
    await signatoriesTab.first().click();
    await page.waitForTimeout(1000);
    const shot5 = path.join(ARTIFACT_DIR, '05_restored_signing_authorities_tab.png');
    await page.screenshot({ path: shot5, fullPage: false });
    console.log(`Saved screenshot 5: ${shot5}`);
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
