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
  permissions: [
    'anudaan:read',
    'anudaan:finance:manage',
    'anudaan:gallery:edit',
    'anudaan:config:manage',
    'system:admin',
  ],
  is_active: true,
  is_verified: true,
};

const mockAdminStats = {
  total_users: 1420,
  total_roles: 12,
  total_permissions: 24,
  total_modules: 4,
  admin_user: 'sadmin@csjmu.ac.in',
};

const mockImpactStats = {
  reporting_academic_year: '2025-2026',
  total_claims_received: 42,
  claims_approved: 28,
  claims_under_review: 10,
  claims_rejected: 4,
  researchers_benefited: 25,
  total_incentive_disbursed_inr: 850000.0,
  disbursement_status: 'VERIFIED',
  academic_years_available: ['2025-2026', '2026-2027'],
  last_updated_at: '2026-02-11T12:00:00Z',
};

const mockDisbursements = {
  total: 2,
  total_amount_inr: 150000.0,
  items: [
    {
      id: 'disb-1',
      application_id: 'app-1',
      application_number: 'ANU-2026-N1E2W',
      applicant_name: 'Dr. Ramesh Sharma',
      author_id: 'author-1',
      author_name: 'Dr. Ramesh Sharma',
      disbursement_reference: 'NEFT-2026-CSJMU-00912',
      amount: 50000.0,
      disbursement_date: '2026-02-10',
      academic_year: '2025-2026',
      payment_method: 'NEFT',
      verification_status: 'VERIFIED',
      reversal_reason: null,
      notes: 'Sanction order VC/RES/2026/042 reconciled with SBI Treasury Passbook',
      recorded_by_email: 'finance.officer@csjmu.ac.in',
      verified_by_email: 'sadmin@csjmu.ac.in',
      verified_at: '2026-02-11T11:00:00Z',
      created_at: '2026-02-10T10:00:00Z',
    },
    {
      id: 'disb-2',
      application_id: 'app-2',
      application_number: 'ANU-2026-88XZ',
      applicant_name: 'Prof. Ananya Sen',
      author_id: 'author-2',
      author_name: 'Prof. Ananya Sen',
      disbursement_reference: 'RTGS-2026-CSJMU-00431',
      amount: 100000.0,
      disbursement_date: '2026-02-08',
      academic_year: '2025-2026',
      payment_method: 'RTGS',
      verification_status: 'RECORDED',
      reversal_reason: null,
      notes: 'Pending bank reconciliation',
      recorded_by_email: 'finance.officer@csjmu.ac.in',
      verified_by_email: null,
      verified_at: null,
      created_at: '2026-02-08T09:30:00Z',
    },
  ],
};

const mockGalleryItems = {
  total: 2,
  items: [
    {
      id: 'gal-1',
      title: 'Annual Research Felicitation 2026',
      event_name: 'CSJMU Research Excellence Awards',
      event_date: '2026-01-20',
      academic_year: '2025-2026',
      description: 'Honoring top university scholars published in Q1 high-impact Scopus & Web of Science journals.',
      researcher_name: 'Dr. Ramesh Sharma',
      researcher_designation: 'Associate Professor',
      department_name: 'Department of Physical Sciences',
      has_consent: true,
      is_featured: true,
      is_published: true,
      display_order: 1,
      images: [
        {
          id: 'img-1',
          gallery_item_id: 'gal-1',
          image_storage_key: 'uploads/gallery/felicitation_2026_01.jpg',
          public_url: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
          caption: 'Hon’ble Vice Chancellor conferring incentive certificate to Dr. Ramesh Sharma',
          is_cover: true,
          display_order: 1,
        },
      ],
      created_at: '2026-01-21T10:00:00Z',
      updated_at: '2026-01-21T10:00:00Z',
    },
    {
      id: 'gal-2',
      title: 'Distinguished Women in STEM Research Payouts',
      event_name: 'STEM Scholar Grants 2026',
      event_date: '2026-02-04',
      academic_year: '2025-2026',
      description: 'Special felicitation ceremony for doctoral and faculty scholars with Nature/Springer publications.',
      researcher_name: 'Prof. Ananya Sen',
      researcher_designation: 'Professor & Dean',
      department_name: 'School of Biotechnology',
      has_consent: true,
      is_featured: false,
      is_published: true,
      display_order: 2,
      images: [
        {
          id: 'img-2',
          gallery_item_id: 'gal-2',
          image_storage_key: 'uploads/gallery/stem_felicitation.jpg',
          public_url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1200&q=80',
          caption: 'Presentation of statutory research grant citations',
          is_cover: true,
          display_order: 1,
        },
      ],
      created_at: '2026-02-05T14:30:00Z',
      updated_at: '2026-02-05T14:30:00Z',
    },
  ],
};

const mockConfig = {
  id: 'cfg-1',
  config_key: 'global_showcase',
  impact_section_enabled: true,
  gallery_section_enabled: true,
  active_academic_year: '2025-2026',
  custom_banner_note: 'Official Research Publication Incentive Scheme governed by Academic Council Resolution 2026/04. Claims processed via verifiable PFMS/NEFT bank records.',
  updated_at: '2026-02-11T12:00:00Z',
};

async function setupRoutes(page) {
  // Auth user endpoint - direct object match for getCurrentUser()
  await page.route('**/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSuperAdmin),
    });
  });

  // Admin platform status
  await page.route('**/admin/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockAdminStats }),
    });
  });

  // Atharva summary
  await page.route('**/admin/atharva/summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    });
  });

  // Notifications summary
  await page.route('**/notifications/summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { unread_count: 0 } }),
    });
  });

  // Admin impact stats
  await page.route('**/api/**/admin/anudaan/impact/stats*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockImpactStats }),
    });
  });

  // Admin disbursements
  await page.route('**/api/**/admin/anudaan/disbursements*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockDisbursements }),
    });
  });

  // Admin gallery items
  await page.route('**/api/**/admin/anudaan/gallery*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockGalleryItems }),
    });
  });

  // Admin config
  await page.route('**/api/**/admin/anudaan/config*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockConfig }),
    });
  });
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Sadmin Dashboard Overview (/admin)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const dest = path.join(ARTIFACT_DIR, 'sadmin-dashboard-overview-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 2. Admin Impact Dashboard & Disbursements (/admin/anudaan)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    try {
      await page.locator('text=ANUDAAN MANAGEMENT').scrollIntoViewIfNeeded({ timeout: 2000 });
    } catch (e) {}
    await page.waitForTimeout(500);
    const dest = path.join(ARTIFACT_DIR, 'sadmin-anudaan-impact-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 3. Admin Researcher Gallery CMS (/admin/anudaan/gallery)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin/anudaan/gallery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    try {
      await page.locator('text=ANUDAAN MANAGEMENT').scrollIntoViewIfNeeded({ timeout: 2000 });
    } catch (e) {}
    await page.waitForTimeout(500);
    const dest = path.join(ARTIFACT_DIR, 'sadmin-anudaan-gallery-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 4. Admin Showcase Configuration (/admin/anudaan/config)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin/anudaan/config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    try {
      await page.locator('text=ANUDAAN MANAGEMENT').scrollIntoViewIfNeeded({ timeout: 2000 });
    } catch (e) {}
    await page.waitForTimeout(500);
    const dest = path.join(ARTIFACT_DIR, 'sadmin-anudaan-config-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
