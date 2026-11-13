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

const mockSignatories = [
  {
    id: 'sig-dean-1',
    authority_type: 'DEAN_RD',
    signatory_name: 'Prof. (Dr.) Rajesh Kumar',
    designation: 'Dean – Research & Development',
    department: 'Research & Development Cell, CSJMU Kanpur',
    signature_image_path: 'sama_veda/signatures/dean_sig.png',
    signature_asset_version: 1,
    is_active: true,
    effective_date: '2025-08-01T00:00:00Z',
    created_at: '2025-08-01T00:00:00Z',
  },
  {
    id: 'sig-vc-1',
    authority_type: 'VICE_CHANCELLOR',
    signatory_name: 'Prof. Vinay Kumar Pathak',
    designation: 'Vice Chancellor',
    department: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    signature_image_path: null,
    signature_asset_version: 1,
    is_active: true,
    effective_date: '2025-07-01T00:00:00Z',
    created_at: '2025-07-01T00:00:00Z',
  },
];

(async () => {
  console.log('Starting preview server on port 5173...');
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

  const setupPage = async () => {
    const page = await context.newPage();
    await page.route('**/auth/me*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) }));
    await page.route('**/api/v1/auth/me*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) }));
    await page.route('**/api/v1/admin/stats*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total_users: 1420 }) }));
    await page.route('**/api/admin/sama/certificates/stats*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockStats }) }));
    await page.route('**/api/admin/sama/certificates?*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));
    await page.route('**/api/admin/sama/templates*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) }));
    await page.route('**/api/admin/sama/signatories*', (r) => {
      if (r.request().url().includes('/signature')) {
        const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAxK3XCAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAbtJREFUeNrs2sEJgEAQBEFz//03AQMRsAETMAMd2D6YgS+2B/3qV6U+2wEAAAAAAAAAAAAAAAAAgD/+p/cOAAAAAAAAAAAAAAAAAIC/sgAAAAAAAAB84t4BAAAAAAAA/sgCAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD+yAAAAAAAAAPzRAwAAAADAJ7sDAAAAAAAA8EcWAAAAAAAAgD9aBgAAAPhxAL87E/vM6l8vAAAAAElFTkSuQmCC', 'base64');
        return r.fulfill({ status: 200, contentType: 'image/png', body: pngBuffer });
      }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { total: 2, items: mockSignatories } }) });
    });

    await page.goto(`${BASE_URL}/admin/sama/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Signing Authorities/i }).click();
    await page.waitForTimeout(600);
    return page;
  };

  // 1. Overview Screenshot
  {
    const page = await setupPage();
    const overviewPath = path.join(ARTIFACT_DIR, 'signing_authorities_management_overview.png');
    await page.screenshot({ path: overviewPath, fullPage: false });
    console.log('Saved Screenshot 1 (Overview):', overviewPath);
    await page.close();
  }

  // 2. Add Authority Modal Screenshot
  {
    const page = await setupPage();
    await page.locator('button:has-text("Add Signing Authority")').first().click();
    await page.waitForTimeout(500);
    const addModalPath = path.join(ARTIFACT_DIR, 'add_signing_authority_modal.png');
    await page.screenshot({ path: addModalPath, fullPage: false });
    console.log('Saved Screenshot 2 (Add Authority Modal):', addModalPath);
    await page.close();
  }

  // 3. Upload Digital Signature Modal Screenshot
  {
    const page = await setupPage();
    const cardButtons = await page.locator('button').all();
    for (const b of cardButtons) {
      const txt = await b.innerText();
      if (txt.includes('Upload Signature')) {
        await b.click();
        break;
      }
    }
    await page.waitForTimeout(500);
    const uploadModalPath = path.join(ARTIFACT_DIR, 'upload_digital_signature_modal.png');
    await page.screenshot({ path: uploadModalPath, fullPage: false });
    console.log('Saved Screenshot 3 (Upload Signature Modal):', uploadModalPath);
    await page.close();
  }

  // 4. Digital Signature Preview Modal Screenshot
  {
    const page = await setupPage();
    const cardButtons = await page.locator('button').all();
    for (const b of cardButtons) {
      const txt = await b.innerText();
      if (txt.includes('Preview')) {
        await b.click();
        break;
      }
    }
    await page.waitForTimeout(500);
    const previewModalPath = path.join(ARTIFACT_DIR, 'signature_preview_modal.png');
    await page.screenshot({ path: previewModalPath, fullPage: false });
    console.log('Saved Screenshot 4 (Signature Preview Modal):', previewModalPath);
    await page.close();
  }

  // 5. Safe Deletion Dependency Check Modal Screenshot
  {
    const page = await setupPage();
    const cardButtons = await page.locator('button').all();
    for (const b of cardButtons) {
      const txt = await b.innerText();
      if (txt.includes('Delete')) {
        await b.click();
        break;
      }
    }
    await page.waitForTimeout(500);
    const deleteModalPath = path.join(ARTIFACT_DIR, 'safe_delete_dependency_modal.png');
    await page.screenshot({ path: deleteModalPath, fullPage: false });
    console.log('Saved Screenshot 5 (Safe Deletion Modal):', deleteModalPath);
    await page.close();
  }

  await browser.close();
  try {
    server.kill();
  } catch (e) {}
  console.log('All 5 screenshots successfully captured and saved to artifact directory!');
  process.exit(0);
})().catch((err) => {
  console.error('Error in screenshot script:', err);
  process.exit(1);
});
