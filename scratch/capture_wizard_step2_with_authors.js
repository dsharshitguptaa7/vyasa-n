const { chromium } = require('playwright');
const path = require('path');
const { spawn } = require('child_process');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/e90803ef-432d-4cee-be21-9af6a6b6ad21';
const BASE_URL = 'http://localhost:5173';

const mockSuperAdmin = {
  id: 'usr-admin-1',
  email: 'sadmin@csjmu.ac.in',
  first_name: 'Dr. Research',
  last_name: 'Director',
  full_name: 'Dr. Research Director',
  role: 'super_admin',
  roles: ['super_admin'],
  permissions: ['sama:read', 'sama:certificate:manage', 'system:admin'],
  is_active: true,
  is_verified: true,
};

const mockStats = {
  total: 18,
  draft: 2,
  in_review: 4,
  approved: 3,
  issued: 8,
  revoked: 1,
  superseded: 0,
  verified_lookups: 142,
};

const mockTemplates = [
  {
    id: 'tpl-1',
    code: 'CSJMU-DEFAULT-A4',
    name: 'CSJMU Standard Institutional Template',
    certificate_type: 'RESEARCH_PUBLICATION',
    is_default: true,
    version: 1,
  },
];

const mockAuthors = [
  {
    id: 'auth-1',
    full_name: 'Prof. Ramesh Chandra Verma',
    department: 'Department of Physics',
    institutional_affiliation: 'CSJMU Kanpur',
    scopus_id: '57201234567',
  },
  {
    id: 'auth-2',
    full_name: 'Dr. Anita Sharma',
    department: 'Department of Chemistry',
    institutional_affiliation: 'CSJMU Kanpur',
    scopus_id: '57209876543',
  },
];

(async () => {
  const server = spawn('npm', ['--prefix', 'frontend', 'run', 'preview', '--', '--port', '5173'], {
    shell: true,
    stdio: 'pipe',
  });

  await new Promise((resolve) => setTimeout(resolve, 3500));

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });

  await context.addInitScript((adminData) => {
    sessionStorage.setItem('vyasa_invocation_completed', 'true');
    localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    localStorage.setItem('auth_token', 'mock-super-admin-jwt-token');
    localStorage.setItem('vyasa_auth_token', 'mock-super-admin-jwt-token');
    localStorage.setItem('vyasa_auth_user', JSON.stringify(adminData));
    localStorage.setItem('auth_user', JSON.stringify(adminData));
  }, mockSuperAdmin);

  const page = await context.newPage();
  await page.route('**/auth/me*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) }));
  await page.route('**/api/v1/auth/me*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) }));
  await page.route('**/api/v1/admin/stats*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_users: 1420 }) }));
  await page.route('**/api/admin/sama/certificates/stats*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockStats }) }));
  await page.route('**/api/admin/sama/certificates?*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));
  await page.route('**/api/admin/sama/templates*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: mockTemplates, total: 1 } }) }));
  await page.route('**/api/admin/sama/authors*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: mockAuthors, total: 2 } }) }));
  await page.route('**/api/admin/sama/bulletins*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));
  await page.route('**/api/admin/sama/publications*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));

  await page.goto(`${BASE_URL}/admin/sama/certificates`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Click "New Joint Certificate" button
  await page.getByRole('button', { name: /New Joint Certificate/i }).click();
  await page.waitForTimeout(600);

  // In modal, click "Next Step" to go to Step 2
  await page.getByRole('button', { name: /Next Step/i }).click();
  await page.waitForTimeout(600);

  // Search for author in directory
  const searchInput = page.getByPlaceholder(/Type researcher name/i);
  await searchInput.fill('Ramesh');
  await page.waitForTimeout(500);

  // Click + Add on the first result
  await page.locator('button', { hasText: '+ Add' }).first().click();
  await page.waitForTimeout(400);

  // Now add an external author manually
  await page.getByPlaceholder('e.g. Ramesh Chandra Verma').fill('Dr. Vikramaditya Rao');
  await page.locator('button', { hasText: '+ Add Author' }).click();
  await page.waitForTimeout(400);

  const modal = page.locator('.vyasa-modal--lg');
  await modal.screenshot({ path: path.join(ARTIFACT_DIR, 'current_wizard_step2_with_authors.png') });
  console.log('Saved current_wizard_step2_with_authors.png');

  await browser.close();
  server.kill();
  process.exit(0);
})();
