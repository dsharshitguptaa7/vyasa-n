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
  total_researchers_recognised: 25,
  total_incentive_sanctioned_inr: 850000.0,
  total_sanction_entries: 42,
  quartile_breakdown: { Q1: 20, Q2: 14, Q3: 6, Q4: 2 },
  total_claims_received: 42,
  claims_approved: 28,
  claims_under_review: 10,
  claims_rejected: 4,
  researchers_benefited: 25,
  total_incentive_disbursed_inr: 850000.0,
  disbursement_status: 'SANCTIONED',
  academic_years_available: ['2025-2026', '2026-2027'],
  last_updated_at: '2026-02-11T12:00:00Z',
};

const mockSanctions = {
  total: 2,
  total_sanctioned_inr: 150000.0,
  items: [
    {
      id: 'sanc-1',
      researcher_name: 'Dr. Ramesh Sharma',
      department_name: 'Department of Physical Sciences',
      publication_title: 'Room-temperature superconductivity in compressed hydride heterostructures',
      publication_doi: '10.1038/s41586-026-00123-x',
      quartile: 'Q1',
      sanctioned_amount: 50000.0,
      academic_year: '2025-2026',
      sanction_date: '2026-02-10',
      remarks: 'VC sanction order CSJMU/RES/2026/042',
      is_published: true,
      application_id: 'app-1',
      application_number: 'ANU-2026-N1E2W',
      author_id: null,
      created_at: '2026-02-10T10:00:00Z',
      updated_at: '2026-02-10T10:00:00Z',
    },
    {
      id: 'sanc-2',
      researcher_name: 'Prof. Ananya Sen',
      department_name: 'School of Biotechnology',
      publication_title: 'CRISPR-Cas13 targeted transcriptomic modulation for salinity resilience',
      publication_doi: '10.1016/j.cell.2025.11.024',
      quartile: 'Q1',
      sanctioned_amount: 100000.0,
      academic_year: '2025-2026',
      sanction_date: '2026-02-08',
      remarks: 'Executive Council Sanction Res 2026/18',
      is_published: true,
      application_id: 'app-2',
      application_number: 'ANU-2026-88XZ',
      author_id: null,
      created_at: '2026-02-08T09:30:00Z',
      updated_at: '2026-02-08T09:30:00Z',
    },
  ],
};

const mockPublicSanctions = {
  total: 2,
  items: [
    {
      id: 'sanc-1',
      researcher_name: 'Dr. Ramesh Sharma',
      department_name: 'Department of Physical Sciences',
      publication_title: 'Room-temperature superconductivity in compressed hydride heterostructures',
      quartile: 'Q1',
      sanctioned_amount: 50000.0,
      academic_year: '2025-2026',
    },
    {
      id: 'sanc-2',
      researcher_name: 'Prof. Ananya Sen',
      department_name: 'School of Biotechnology',
      publication_title: 'CRISPR-Cas13 targeted transcriptomic modulation for salinity resilience',
      quartile: 'Q1',
      sanctioned_amount: 100000.0,
      academic_year: '2025-2026',
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
          storage_key: 'uploads/gallery/felicitation_2026_01.jpg',
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
      title: 'Distinguished Women in STEM Research Awards',
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
          storage_key: 'uploads/gallery/stem_felicitation.jpg',
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
  custom_banner_note: 'Official Research Publication Incentive Scheme governed by Academic Council Resolution 2026/04.',
  updated_at: '2026-02-11T12:00:00Z',
};

async function setupRoutes(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.includes('/api/')) {
      return route.continue();
    }
    if (url.includes('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) });
    }
    if (url.includes('/admin/status')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockAdminStats }) });
    }
    if (url.includes('/admin/atharva/summary')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) });
    }
    if (url.includes('/notifications/summary')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { unread_count: 0 } }) });
    }
    if (url.includes('/admin/anudaan/impact/stats')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockImpactStats }) });
    }
    if (url.includes('/admin/anudaan/sanctions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockSanctions }) });
    }
    if (url.includes('/admin/anudaan/gallery')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockGalleryItems }) });
    }
    if (url.includes('/admin/anudaan/config')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockConfig }) });
    }
    if (url.includes('/modules/yajur-veda/anudaan/public/impact')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockImpactStats }) });
    }
    if (url.includes('/modules/yajur-veda/anudaan/public/sanctions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockPublicSanctions }) });
    }
    if (url.includes('/modules/yajur-veda/anudaan/public/gallery')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockGalleryItems }) });
    }
    if (url.includes('/modules/yajur-veda/anudaan/public/config')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockConfig }) });
    }
    return route.continue();
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
    await page.waitForTimeout(1000);
    const dest = path.join(ARTIFACT_DIR, 'sadmin-dashboard-sanction-register-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 2. Sadmin Incentive Sanction Register (/admin/anudaan)
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
    const dest = path.join(ARTIFACT_DIR, 'sadmin-sanction-register-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 3. Sadmin Researcher Gallery (/admin/anudaan/gallery)
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
    const dest = path.join(ARTIFACT_DIR, 'sadmin-researcher-gallery-1440.png');
    await page.screenshot({ path: dest, fullPage: false });
    console.log(`Saved: ${dest}`);
    await context.close();
  }

  // 4. Public ANUDAAN Portal Section B (/anudaan)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    const page = await context.newPage();
    await setupRoutes(page);
    await page.goto(`${BASE_URL}/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    try {
      await page.waitForSelector('#section-b', { timeout: 4000 });
      await page.evaluate(() => {
        const el = document.getElementById('section-b');
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
    } catch (e) {
      console.warn('Scroll to #section-b warning:', e.message);
    }
    await page.waitForTimeout(800);
    const dest = path.join(ARTIFACT_DIR, 'anudaan-public-sanction-register-1440.png');
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
