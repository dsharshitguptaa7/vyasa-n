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

const mockCycles = {
  total: 2,
  items: [
    {
      id: 'cycle-1',
      volume_number: 2,
      issue_number: 2,
      display_title: 'Annual Research Felicitation Ceremony 2026',
      status: 'COMPLETED',
      felicitation_date: '2026-03-15',
      academic_year: '2025-2026',
      description: 'Official university ceremony honoring scholars for Scopus and Web of Science indexed Q1 and Q2 publications.',
      is_published: true,
      is_archived: false,
      total_sanction_entries: 2,
      total_sanctioned_amount: 125000,
      distinct_researchers: 2,
      gallery_item_count: 1,
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-01-10T10:00:00Z',
    },
    {
      id: 'cycle-2',
      volume_number: 2,
      issue_number: 3,
      display_title: 'Monsoon Research Assembly & Award Distribution',
      status: 'UPCOMING',
      felicitation_date: '2026-09-20',
      academic_year: '2025-2026',
      description: 'Scheduled institutional ceremony for second cycle publication incentives and young researcher commendations.',
      is_published: true,
      is_archived: false,
      total_sanction_entries: 0,
      total_sanctioned_amount: 0,
      distinct_researchers: 0,
      gallery_item_count: 0,
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-01T10:00:00Z',
    },
  ],
};

const mockSanctions = {
  total: 2,
  total_sanctioned_inr: 125000.0,
  items: [
    {
      id: 'sanc-1',
      researcher_name: 'Dr. Ramesh Sharma',
      department_name: 'Department of Physical Sciences',
      project_title: 'DST-SERB Core Grant on Hydride Superconductivity',
      publication_title: 'Room-temperature superconductivity in compressed hydride heterostructures',
      publication_doi: '10.1038/s41586-026-00123-x',
      quartile: 'Q1',
      sanctioned_amount: 75000.0,
      academic_year: '2025-2026',
      sanction_date: '2026-02-10',
      felicitation_cycle_id: 'cycle-1',
      felicitation_cycle_volume: 2,
      felicitation_cycle_issue: 2,
      felicitation_cycle_status: 'COMPLETED',
      felicitation_cycle_title: 'Annual Research Felicitation Ceremony 2026',
      volume_number: 2,
      issue_number: 2,
      cycle_status: 'COMPLETED',
      remarks: 'Sanction Order CSJMU/RES/2026/042',
      is_published: true,
      application_id: 'app-1',
      application_number: 'ANU-2026-00042',
      author_id: null,
      created_at: '2026-02-10T10:00:00Z',
      updated_at: '2026-02-10T10:00:00Z',
    },
    {
      id: 'sanc-2',
      researcher_name: 'Dr. Priya Verma',
      department_name: 'Department of Biotechnology',
      project_title: 'ICMR Advance Therapeutics Initiative',
      publication_title: 'CRISPR-Cas13 mediated RNA targeting in plant-pathogen defense systems',
      publication_doi: '10.1016/j.cell.2025.12.004',
      quartile: 'Q1',
      sanctioned_amount: 50000.0,
      academic_year: '2025-2026',
      sanction_date: '2026-01-20',
      felicitation_cycle_id: 'cycle-1',
      felicitation_cycle_volume: 2,
      felicitation_cycle_issue: 2,
      felicitation_cycle_status: 'COMPLETED',
      felicitation_cycle_title: 'Annual Research Felicitation Ceremony 2026',
      volume_number: 2,
      issue_number: 2,
      cycle_status: 'COMPLETED',
      remarks: 'Sanction Order CSJMU/RES/2026/019',
      is_published: true,
      application_id: 'app-2',
      application_number: 'ANU-2026-00019',
      author_id: null,
      created_at: '2026-01-20T10:00:00Z',
      updated_at: '2026-01-20T10:00:00Z',
    },
  ],
};

const mockPublicShowcaseCycles = {
  total_cycles: 2,
  completed_cycles: [
    {
      id: 'cycle-1',
      volume_number: 2,
      issue_number: 2,
      display_title: 'Annual Research Felicitation Ceremony 2026',
      status: 'COMPLETED',
      felicitation_date: '2026-03-15',
      academic_year: '2025-2026',
      description: 'Official university ceremony honoring scholars for Scopus and Web of Science indexed Q1 and Q2 publications.',
      sanctions: mockSanctions.items,
      total_sanctioned_amount: 125000,
      total_researchers: 2,
      sanction_count: 2,
      gallery_items: [
        {
          id: 'gal-1',
          title: 'Vice Chancellor Honoring Dr. Ramesh Sharma',
          event_name: 'Annual Research Felicitation Ceremony 2026',
          event_date: '2026-03-15',
          academic_year: '2025-2026',
          description: 'Presentation of research publication incentive token.',
          researcher_name: 'Dr. Ramesh Sharma',
          researcher_designation: 'Professor',
          department_name: 'Physical Sciences',
          has_consent: true,
          is_featured: true,
          is_published: true,
          display_order: 1,
          images: [
            {
              id: 'img-1',
              gallery_item_id: 'gal-1',
              storage_key: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&auto=format&fit=crop',
              original_filename: 'ceremony_vc.jpg',
              mime_type: 'image/jpeg',
              file_size_bytes: 204800,
              caption: 'Honorable Vice Chancellor felicitating Dr. Ramesh Sharma',
              is_cover: true,
              display_order: 1,
              created_at: '2026-03-15T12:00:00Z',
            },
          ],
          created_at: '2026-03-15T12:00:00Z',
          updated_at: '2026-03-15T12:00:00Z',
        },
      ],
    },
  ],
  upcoming_cycles: [
    {
      id: 'cycle-2',
      volume_number: 2,
      issue_number: 3,
      display_title: 'Monsoon Research Assembly & Award Distribution',
      status: 'UPCOMING',
      felicitation_date: '2026-09-20',
      academic_year: '2025-2026',
      description: 'Scheduled institutional ceremony for second cycle publication incentives and young researcher commendations.',
      sanctions: [],
      total_sanctioned_amount: 0,
      total_researchers: 0,
      sanction_count: 0,
      gallery_items: [],
    },
  ],
};

const mockPublicConfig = {
  id: 'cfg-1',
  config_key: 'global_showcase',
  impact_section_enabled: true,
  gallery_section_enabled: true,
  active_academic_year: '2025-2026',
  custom_banner_note: 'Verified institutional publication sanctions awarded by Chhatrapati Shahu Ji Maharaj University.',
  updated_at: '2026-02-11T12:00:00Z',
};

async function setupPageRoutes(page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSuperAdmin) })
  );

  await page.route('**/api/v1/admin/stats', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAdminStats) })
  );

  await page.route('**/api/v1/admin/anudaan/stats*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockImpactStats) })
  );

  await page.route('**/api/v1/admin/anudaan/sanctions*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSanctions) })
  );

  await page.route('**/api/v1/admin/anudaan/felicitations*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCycles) })
  );

  await page.route('**/api/v1/yajur-veda/anudaan/public/config*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockPublicConfig }) })
  );

  await page.route('**/api/v1/yajur-veda/anudaan/public/impact*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockImpactStats }) })
  );

  await page.route('**/api/v1/yajur-veda/anudaan/public/cycles*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: mockPublicShowcaseCycles }) })
  );

  await page.route('**/api/v1/yajur-veda/anudaan/public/gallery*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { total: 1, items: mockPublicShowcaseCycles.completed_cycles[0].gallery_items } }),
    })
  );
}

async function captureScreenshots() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  console.log('Launching browser for Felicitation screenshots...');

  // 1. Sadmin Felicitation Management (Desktop 1440)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupPageRoutes(page);

    await page.addInitScript((adminData) => {
      localStorage.setItem('auth_token', 'mock-sadmin-token-12345');
      localStorage.setItem('vyasa_auth_token', 'mock-sadmin-token-12345');
      localStorage.setItem('vyasa_auth_user', JSON.stringify(adminData));
      localStorage.setItem('auth_user', JSON.stringify(adminData));
    }, mockSuperAdmin);

    console.log('Navigating to /admin/anudaan/felicitations...');
    await page.goto(`${BASE_URL}/admin/anudaan/felicitations`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const outPath = path.join(ARTIFACT_DIR, 'sadmin-felicitation-management-1440.png');
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Saved screenshot: ${outPath}`);
    await context.close();
  }

  // 2. Sadmin Sanction Register with Volume/Issue and Project Title (Desktop 1440)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupPageRoutes(page);

    await page.addInitScript((adminData) => {
      localStorage.setItem('auth_token', 'mock-sadmin-token-12345');
      localStorage.setItem('vyasa_auth_token', 'mock-sadmin-token-12345');
      localStorage.setItem('vyasa_auth_user', JSON.stringify(adminData));
      localStorage.setItem('auth_user', JSON.stringify(adminData));
    }, mockSuperAdmin);

    console.log('Navigating to /admin/anudaan...');
    await page.goto(`${BASE_URL}/admin/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const outPath = path.join(ARTIFACT_DIR, 'sadmin-sanction-register-enhanced-1440.png');
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Saved screenshot: ${outPath}`);

    // 3. Open Add Sanction Entry Modal
    console.log('Opening Add Sanction Entry Modal...');
    const addBtn = await page.getByRole('button', { name: /Add Sanction Entry/i });
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(600);
      const modalPath = path.join(ARTIFACT_DIR, 'sadmin-add-sanction-modal-1440.png');
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log(`Saved screenshot: ${modalPath}`);
    }

    await context.close();
  }

  // 4. Public ANUDAAN Showcase (Desktop 1440)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await setupPageRoutes(page);

    console.log('Navigating to /anudaan public showcase...');
    await page.goto(`${BASE_URL}/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Scroll to Section B
    await page.evaluate(() => {
      const secB = document.getElementById('section-b');
      if (secB) secB.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'anudaan-public-felicitation-showcase-1440.png');
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved screenshot: ${outPath}`);
    await context.close();
  }

  // 5. Public ANUDAAN Showcase (Mobile 375)
  {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await setupPageRoutes(page);

    console.log('Navigating to /anudaan on mobile...');
    await page.goto(`${BASE_URL}/anudaan`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    await page.evaluate(() => {
      const secB = document.getElementById('section-b');
      if (secB) secB.scrollIntoView({ behavior: 'instant' });
    });
    await page.waitForTimeout(600);

    const outPath = path.join(ARTIFACT_DIR, 'anudaan-public-felicitation-showcase-mobile-375.png');
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved screenshot: ${outPath}`);
    await context.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureScreenshots().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
