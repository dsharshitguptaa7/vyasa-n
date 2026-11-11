const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/01d12825-9dda-4775-aa02-ff6a07254c47';
const BASE_URL = 'http://localhost:4173';

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
};

const mockDisbursements = {
  total: 3,
  total_amount_inr: 850000.0,
  items: [
    {
      id: 'disb-1',
      application_id: 'app-1',
      application_number: 'ANU-2026-N1E2W',
      applicant_name: 'Dr. Ramesh Sharma',
      author_id: 'author-1',
      disbursement_reference: 'NEFT-2026-CSJMU-00912',
      amount: 50000.0,
      disbursement_date: '2026-02-10',
      academic_year: '2025-2026',
      payment_method: 'NEFT',
      verification_status: 'VERIFIED',
      reversal_reason: null,
      notes: 'Sanction order VC/RES/2026/042 reconciled with SBI Treasury Passbook',
      recorded_by_id: 'usr-admin-1',
      verified_by_id: 'usr-admin-1',
      created_at: '2026-02-10T10:00:00Z',
      updated_at: '2026-02-11T12:00:00Z',
    },
    {
      id: 'disb-2',
      application_id: 'app-2',
      application_number: 'ANU-2026-Q8X9P',
      applicant_name: 'Dr. Priya Verma',
      author_id: 'author-2',
      disbursement_reference: 'PFMS-2026-GOV-98711',
      amount: 30000.0,
      disbursement_date: '2026-02-18',
      academic_year: '2025-2026',
      payment_method: 'PFMS',
      verification_status: 'VERIFIED',
      reversal_reason: null,
      notes: 'State DBT release audit batch #14',
      recorded_by_id: 'usr-admin-1',
      verified_by_id: 'usr-admin-1',
      created_at: '2026-02-18T14:30:00Z',
      updated_at: '2026-02-19T09:15:00Z',
    },
    {
      id: 'disb-3',
      application_id: 'app-3',
      application_number: 'ANU-2026-M4K7L',
      applicant_name: 'Prof. Anil Gupta',
      author_id: 'author-3',
      disbursement_reference: 'RTGS-2026-BANK-00445',
      amount: 50000.0,
      disbursement_date: '2026-02-25',
      academic_year: '2025-2026',
      payment_method: 'RTGS',
      verification_status: 'RECORDED',
      reversal_reason: null,
      notes: 'Pending bank transaction confirmation statement',
      recorded_by_id: 'usr-admin-1',
      verified_by_id: null,
      created_at: '2026-02-25T16:00:00Z',
      updated_at: '2026-02-25T16:00:00Z',
    },
  ],
};

const mockGalleryItems = {
  total: 2,
  items: [
    {
      id: 'gal-1',
      title: 'Annual Research Felicitation Ceremony 2026',
      event_name: 'CSJMU Convocation Week Research Awards',
      event_date: '2026-02-15',
      academic_year: '2025-2026',
      description: 'Hon. Vice Chancellor felicitating top faculty researchers for Q1 high-impact publications.',
      researcher_name: 'Dr. Ramesh Sharma',
      researcher_designation: 'Associate Professor',
      department_name: 'Department of Biotechnology',
      has_consent: true,
      is_featured: true,
      is_published: true,
      display_order: 1,
      images: [
        {
          id: 'img-1',
          gallery_item_id: 'gal-1',
          storage_key: 'gallery/img-1.jpg',
          original_filename: 'vc_felicitation.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 450000,
          caption: 'Vice Chancellor presenting the research incentive citation token',
          is_cover: true,
          display_order: 0,
          created_at: '2026-02-15T12:00:00Z',
        },
      ],
      created_at: '2026-02-15T12:00:00Z',
      updated_at: '2026-02-15T12:00:00Z',
    },
    {
      id: 'gal-2',
      title: 'CSJMU Scholar Recognition Meet 2026',
      event_name: 'Campus Innovation Forum',
      event_date: '2026-01-28',
      academic_year: '2025-2026',
      description: 'Dean of Research presenting incentive grant sanctions to early-career scholars and postdocs.',
      researcher_name: 'Dr. Priya Verma',
      researcher_designation: 'Assistant Professor',
      department_name: 'School of Physical Sciences',
      has_consent: true,
      is_featured: false,
      is_published: true,
      display_order: 2,
      images: [
        {
          id: 'img-2',
          gallery_item_id: 'gal-2',
          storage_key: 'gallery/img-2.jpg',
          original_filename: 'scholar_meet.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 380000,
          caption: 'Presentation of publication reward certificate',
          is_cover: true,
          display_order: 0,
          created_at: '2026-01-28T14:00:00Z',
        },
      ],
      created_at: '2026-01-28T14:00:00Z',
      updated_at: '2026-01-28T14:00:00Z',
    },
  ],
};

const mockConfig = {
  id: 'cfg-global',
  config_key: 'global_showcase',
  impact_section_enabled: true,
  gallery_section_enabled: true,
  active_academic_year: '2025-2026',
  custom_banner_note: 'Verified against official institutional banking disbursements reconciled as of February 2026.',
  updated_at: '2026-02-28T10:00:00Z',
};

async function setupRoutes(page) {
  // Auth mock
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockSuperAdmin }),
    });
  });

  // Public impact
  await page.route('**/api/modules/yajur-veda/anudaan/public/impact*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockImpactStats }),
    });
  });

  // Public gallery
  await page.route('**/api/modules/yajur-veda/anudaan/public/gallery*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockGalleryItems }),
    });
  });

  // Public config
  await page.route('**/api/modules/yajur-veda/anudaan/public/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockConfig }),
    });
  });

  // Admin impact stats
  await page.route('**/api/admin/anudaan/impact/stats*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockImpactStats }),
    });
  });

  // Admin disbursements
  await page.route('**/api/admin/anudaan/disbursements*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockDisbursements }),
    });
  });

  // Admin gallery items
  await page.route('**/api/admin/anudaan/gallery*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockGalleryItems }),
    });
  });

  // Admin config
  await page.route('**/api/admin/anudaan/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockConfig }),
    });
  });
}

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Desktop Public ANUDAAN Portal
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/modules/yajur-veda/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dest = path.join(ARTIFACT_DIR, 'anudaan-public-portal-desktop-1440.png');
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 2. Mobile Public ANUDAAN Portal
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/modules/yajur-veda/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dest = path.join(ARTIFACT_DIR, 'anudaan-public-portal-mobile-390.png');
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 3. Admin Impact Dashboard & Disbursements
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dest = path.join(ARTIFACT_DIR, 'anudaan-admin-impact-ledger-1440.png');
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 4. Admin Gallery CMS
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin/anudaan/gallery`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dest = path.join(ARTIFACT_DIR, 'anudaan-admin-gallery-cms-1440.png');
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 5. Admin Showcase Config
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('vyasa_access_token', 'mock-super-admin-jwt-token');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/admin/anudaan/config`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dest = path.join(ARTIFACT_DIR, 'anudaan-admin-config-1440.png');
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
