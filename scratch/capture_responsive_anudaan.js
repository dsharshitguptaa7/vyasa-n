const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/01d12825-9dda-4775-aa02-ff6a07254c47';
const BASE_URL = 'http://localhost:4173';

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
  impact_section_enabled: true,
  gallery_section_enabled: true,
  active_academic_year: '2025-2026',
  custom_banner_note: 'Verified against official institutional banking disbursements reconciled as of February 2026.',
  updated_at: '2026-02-28T10:00:00Z',
};

async function setupRoutes(page) {
  await page.route('**/api/modules/yajur-veda/anudaan/public/impact*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockImpactStats }),
    });
  });

  await page.route('**/api/modules/yajur-veda/anudaan/public/gallery*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockGalleryItems }),
    });
  });

  await page.route('**/api/modules/yajur-veda/anudaan/public/config', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: mockConfig }),
    });
  });
}

const viewports = [
  { name: 'anudaan-redesign-desktop-1440', width: 1440, height: 900, isMobile: false },
  { name: 'anudaan-redesign-laptop-1024', width: 1024, height: 768, isMobile: false },
  { name: 'anudaan-redesign-tablet-768', width: 768, height: 1024, isMobile: false },
  { name: 'anudaan-redesign-mobile-454', width: 454, height: 932, isMobile: true },
  { name: 'anudaan-redesign-mobile-375', width: 375, height: 812, isMobile: true },
];

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
    });
    const page = await context.newPage();
    await setupRoutes(page);

    await page.goto(`${BASE_URL}/modules/yajur-veda/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const dest = path.join(ARTIFACT_DIR, `${vp.name}.png`);
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`Saved screenshot: ${dest}`);
    await context.close();
  }

  await browser.close();
  console.log('All responsive viewports captured successfully!');
}

run().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
