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
  await page.route('**/api/admin/sama/authors*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: mockAuthors, total: 2 }) }));
  await page.route('**/api/admin/sama/bulletins*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));
  await page.route('**/api/admin/sama/publications*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));

  await page.goto(`${BASE_URL}/admin/sama/certificates`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Open Wizard
  await page.getByRole('button', { name: /New Joint Certificate/i }).click();
  await page.waitForTimeout(600);

  // Go to Step 2
  await page.getByRole('button', { name: /Next Step/i }).click();
  await page.waitForTimeout(600);

  const modal = page.locator('.vyasa-modal--lg');
  await modal.screenshot({ path: path.join(ARTIFACT_DIR, 'refined_wizard_step2_empty.png') });
  console.log('Saved refined_wizard_step2_empty.png');

  // Search in directory
  const searchInput = page.getByPlaceholder(/Search by researcher name/i);
  await searchInput.fill('Ramesh');
  await page.waitForTimeout(500);

  // Add the directory author
  await page.locator('button', { hasText: '+ Add' }).first().click();
  await page.waitForTimeout(400);

  // Add manual external collaborator
  await page.getByPlaceholder('e.g. Ramesh Chandra Verma').fill('Dr. Aakash Srivastava');
  await page.getByPlaceholder('e.g. Physics & Materials').fill('Nanotechnology');
  await page.getByPlaceholder('e.g. IIT Kanpur / BHU / External Univ').fill('IIT Kanpur');
  await page.getByPlaceholder('e.g. 57201234567').fill('57299887766');
  await page.locator('button', { hasText: '+ Add Author' }).click();
  await page.waitForTimeout(400);

  await modal.screenshot({ path: path.join(ARTIFACT_DIR, 'refined_wizard_step2_with_authors.png') });
  console.log('Saved refined_wizard_step2_with_authors.png');

  await browser.close();
  server.kill();
  process.exit(0);
})();
