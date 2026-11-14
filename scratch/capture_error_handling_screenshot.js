const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/4c4006aa-1a26-44b8-8860-e640b61e39fc';
const BASE_URL = 'http://localhost:5173';

const mockSuperAdmin = {
  id: 'e6a849e9-a0ac-4811-aa1a-d86dd7d9079b',
  email: 'sadmin@csjmu.ac.in',
  role: 'super_admin',
  roles: ['super_admin'],
  permissions: ['sama:read', 'sama:certificate:manage'],
  is_active: true,
};

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlNmE4NDllOS1hMGFjLTQ4MTEtYWExYS1kODZkZDdkOTA3OWIiLCJleHAiOjE3OTQ1OTgxNDcsImlhdCI6MTc5NDU5NDU0NywiaXNzIjoidnlhc2EtY29yZS1iYWNrZW5kIn0.aGu5RAlDcp5-EtnXbCRG-c58kxV4I5rtkI4PMvA4rpQ';
  await page.addInitScript(({ token, user }) => {
    window.localStorage.setItem('vyasa_access_token', token);
    window.localStorage.setItem('vyasa_user', JSON.stringify(user));
  }, { token, user: mockSuperAdmin });

  // Intercept certificates API call to simulate an unexpected HTML 503 error from reverse proxy
  await page.route('**/admin/sama/certificates?**', (route) => {
    route.fulfill({
      status: 503,
      contentType: 'text/html',
      body: '<!DOCTYPE html><html><head><title>503 Service Unavailable</title></head><body><h1>503 Service Unavailable</h1><p>Database migration in progress</p></body></html>',
    });
  });

  await page.goto(`${BASE_URL}/admin/sama/certificates`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  const shot = path.join(ARTIFACT_DIR, '00_safe_error_handling_banner.png');
  await page.screenshot({ path: shot, fullPage: false });
  console.log(`Saved screenshot error handling: ${shot}`);

  await browser.close();
}

main().catch(console.error);
