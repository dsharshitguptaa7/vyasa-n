const { chromium } = require('playwright');
const path = require('path');
const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/01d12825-9dda-4775-aa02-ff6a07254c47';
const BASE_URL = 'http://localhost:5173';

const mockSuperAdmin = {
  id: 'usr-admin-1',
  email: 'sadmin@csjmu.ac.in',
  first_name: 'Dr. Research',
  last_name: 'Director',
  full_name: 'Dr. Research Director',
  roles: ['super_admin'],
  permissions: ['anudaan:finance:manage', 'anudaan:gallery:edit', 'anudaan:config:manage', 'system:admin'],
  is_active: true,
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  
  await context.addInitScript((adminData) => {
    sessionStorage.setItem('vyasa_invocation_completed', 'true');
    localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    localStorage.setItem('auth_token', 'mock-super-admin-jwt-token');
    localStorage.setItem('vyasa_auth_token', 'mock-super-admin-jwt-token');
    localStorage.setItem('vyasa_auth_user', JSON.stringify(adminData));
    localStorage.setItem('auth_user', JSON.stringify(adminData));
  }, mockSuperAdmin);

  const page = await context.newPage();

  await page.route('**/auth/me*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) })
  );
  await page.route('**/api/v1/admin/stats', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_users: 1420 }) })
  );
  await page.route('**/api/v1/admin/anudaan/stats*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reporting_academic_year: '2025-2026', total_researchers_recognised: 25, total_incentive_sanctioned_inr: 850000.0, total_sanction_entries: 42 }) })
  );
  await page.route('**/api/v1/admin/anudaan/sanctions*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 1, items: [{ id: 'sanc-1', researcher_name: 'Dr. Ramesh Sharma', publication_title: 'Room-temperature superconductivity', quartile: 'Q1', sanctioned_amount: 75000, academic_year: '2025-2026', sanction_date: '2026-02-10', volume_number: 2, issue_number: 2, is_published: true }] }) })
  );
  await page.route('**/api/v1/admin/anudaan/felicitations*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 2, items: [{ id: 'cycle-1', volume_number: 2, issue_number: 2, display_title: 'Annual Research Felicitation Ceremony 2026', status: 'COMPLETED' }, { id: 'cycle-2', volume_number: 2, issue_number: 3, display_title: 'Monsoon Research Assembly', status: 'UPCOMING' }] }) })
  );

  await page.goto(`${BASE_URL}/admin/anudaan`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const addBtn = page.getByRole('button', { name: /Add Sanction Entry/i });
  await addBtn.click();
  await page.waitForTimeout(800);

  const modalPath = path.join(ARTIFACT_DIR, 'sadmin-add-sanction-modal-1440.png');
  await page.screenshot({ path: modalPath, fullPage: false });
  console.log('Saved modal screenshot to:', modalPath);

  await browser.close();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
