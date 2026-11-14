const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/e90803ef-432d-4cee-be21-9af6a6b6ad21';
const BASE_URL = 'http://localhost:5173';

const mockBulletins = [
  {
    id: 'bul-v3-i1',
    volume_number: 3,
    issue_number: 1,
    title: 'CSJMU Research Bulletin – Official Biannual Journal',
    publication_period: 'January – June 2026',
    publication_count: 24,
    file_size_bytes: 4500000,
    checksum_sha256: 'abc1234567890',
    published_at: '2026-06-30T10:00:00Z',
  },
  {
    id: 'bul-v2-i2',
    volume_number: 2,
    issue_number: 2,
    title: 'CSJMU Research Bulletin – Autumn Edition',
    publication_period: 'July – December 2025',
    publication_count: 18,
    file_size_bytes: 3800000,
    checksum_sha256: 'def987654321',
    published_at: '2025-12-31T10:00:00Z',
  },
  {
    id: 'bul-v2-i1',
    volume_number: 2,
    issue_number: 1,
    title: 'CSJMU Research Bulletin – Spring Edition',
    publication_period: 'January – June 2025',
    publication_count: 15,
    file_size_bytes: 3200000,
    checksum_sha256: 'ghi1122334455',
    published_at: '2025-06-30T10:00:00Z',
  },
];

const mockTemplates = [
  {
    id: 'tpl-research-01',
    template_code: 'DEFAULT_CSJMU_A4',
    name: 'CSJMU Official Research Felicitation Certificate Template (A4 Landscape)',
    certificate_type: 'RESEARCH_PUBLICATION',
    orientation: 'LANDSCAPE',
    page_size: 'A4',
    is_active: true,
  },
  {
    id: 'tpl-incentive-01',
    template_code: 'DEFAULT_CSJMU_INCENTIVE_A4',
    name: 'CSJMU Research Publication Incentive Certificate Template',
    certificate_type: 'INCENTIVE_AWARD',
    orientation: 'LANDSCAPE',
    page_size: 'A4',
    is_active: true,
  },
];

const mockStats = {
  total_certificates: 142,
  issued_count: 128,
  pending_approvals: 6,
  revoked_count: 4,
  superseded_count: 4,
  dual_signed_rate: 98.2,
};

const mockCertificatesList = {
  items: [],
  total: 0,
};

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

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Wizard Step 1: Category and Hierarchical Bulletin Volume/Issue
  {
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

    await page.route('**/*admin/sama/bulletins*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: mockBulletins, total: mockBulletins.length } }),
      });
    });

    await page.route('**/*admin/sama/templates*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: mockTemplates, total: mockTemplates.length } }),
      });
    });

    await page.route('**/*admin/sama/authors*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
    });

    await page.route('**/*admin/sama/publications*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
    });

    await page.route('**/*admin/sama/signatories*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { items: [], total: 0 } }),
      });
    });

    await page.route('**/*admin/sama/certificates/stats*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockStats }),
      });
    });

    await page.route('**/*admin/sama/certificates?*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockCertificatesList }),
      });
    });

    await page.goto(`${BASE_URL}/admin/sama/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Click "New Joint Certificate" to open the wizard modal
    const issueBtn = page.locator('button:has-text("New Joint Certificate"), button:has-text("Issue")').first();
    await issueBtn.waitFor({ state: 'visible', timeout: 5000 });
    await issueBtn.click();
    await page.waitForTimeout(600);

    // Select Bulletin Volume 3
    const volumeSelect = page.locator('select:has(option:has-text("Volume 3"))');
    await volumeSelect.waitFor({ state: 'visible', timeout: 5000 });
    await volumeSelect.selectOption('3');
    await page.waitForTimeout(400);

    // Select Issue 1
    const issueSelect = page.locator('select:has(option:has-text("Issue 1"))');
    if (await issueSelect.isVisible()) {
      await issueSelect.selectOption('bul-v3-i1');
      await page.waitForTimeout(300);
    }

    const modalPath = path.join(ARTIFACT_DIR, 'enhanced_wizard_step1_bulletin_and_category.png');
    const modal = page.locator('.vyasa-modal-container, .vyasa-modal, div[role="dialog"]').first();
    if (await modal.isVisible()) {
      await modal.screenshot({ path: modalPath });
    } else {
      await page.screenshot({ path: modalPath });
    }
    console.log('Saved Screenshot 1 (Enhanced Wizard Step 1):', modalPath);
    await context.close();
    await browser.close();
    return;
  }

  // 2. Public Verification: Research Work Certificate
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });

    const page = await context.newPage();

    const mockResearchVerification = {
      id: 'cert-res-001',
      certificate_number: 'CSJMU/SAMA/2026/00142',
      certificate_type: 'RESEARCH_PUBLICATION',
      status: 'ISSUED',
      title: 'Certificate of Appreciation & Research Excellence',
      research_title: 'Advancements in Deep Reinforcement Learning for Autonomous Quantum Control Systems',
      verification_token: 'tok-csjmu-res-2026-00142',
      issued_at: '2026-02-12T09:00:00Z',
      approved_at: '2026-02-12T08:30:00Z',
      is_revoked: false,
      sha256_checksum: '812924b06bd7e2213d5cfcf2020a11200921fe164f9b8c0490bf9e345091a9df',
      is_download_allowed: true,
      bulletin: {
        id: 'bul-v3-i1',
        title: 'CSJMU Research Bulletin – Official Biannual Journal',
        volume_number: 3,
        issue_number: 1,
        publication_period: 'January – June 2026',
      },
      authors: [
        {
          author_name: 'Dr. Ramesh Chandra Verma',
          academic_title: 'Associate Professor',
          scopus_id: '57218492000',
          department: 'Department of Computer Science & Engineering',
          affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
        },
        {
          author_name: 'Prof. Alok Kumar Gupta',
          academic_title: 'Professor',
          scopus_id: '57199482110',
          department: 'Department of Physics & Materials Science',
          affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
        },
      ],
      approvals: [
        {
          authority_type: 'DEAN_RD',
          signatory_name: 'Prof. (Dr.) Rajesh Kumar',
          designation: 'Dean – Research & Development',
          status: 'APPROVED',
          decided_at: '2026-02-12T08:00:00Z',
        },
        {
          authority_type: 'VICE_CHANCELLOR',
          signatory_name: 'Prof. Vinay Kumar Pathak',
          designation: 'Vice Chancellor',
          status: 'APPROVED',
          decided_at: '2026-02-12T08:30:00Z',
        },
      ],
    };

    await page.route('**/modules/sama-veda/certificates/verify/*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockResearchVerification }),
      });
    });

    await page.route('**/api/v1/sama/certificates/verify/*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockResearchVerification }),
      });
    });

    await page.goto(`${BASE_URL}/verify/tok-csjmu-res-2026-00142`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const researchPath = path.join(ARTIFACT_DIR, 'public_verification_research_certificate.png');
    await page.screenshot({ path: researchPath, fullPage: true });
    console.log('Saved Screenshot 2 (Public Verification - Research Work):', researchPath);
    await context.close();
  }

  // 3. Public Verification: Incentive Award Certificate
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });

    const page = await context.newPage();

    const mockIncentiveVerification = {
      id: 'cert-inc-001',
      certificate_number: 'CSJMU/SAMA/2026/INC-00045',
      certificate_type: 'INCENTIVE_AWARD',
      status: 'ISSUED',
      title: 'Certificate of Research Publication Incentive Award',
      research_title: 'CRISPR-Cas12 Targeted Epigenetic Editing for Enhanced Drought Resistance in Crop Plants',
      verification_token: 'tok-csjmu-inc-2026-00045',
      issued_at: '2026-02-14T10:00:00Z',
      approved_at: '2026-02-14T09:30:00Z',
      is_revoked: false,
      sha256_checksum: 'a04af816465b098198dc0f96d66e74b3336ebafc9d09c31405e55716182103f5',
      is_download_allowed: true,
      publication_details: {
        incentive_amount: 50000,
        sanction_order_ref: 'CSJMU/R&D/INC-2026/089',
      },
      bulletin: {
        id: 'bul-v3-i1',
        title: 'CSJMU Research Bulletin – Official Biannual Journal',
        volume_number: 3,
        issue_number: 1,
        publication_period: 'January – June 2026',
      },
      authors: [
        {
          author_name: 'Prof. (Dr.) Sunita Sharma',
          academic_title: 'Professor & Head',
          scopus_id: '56291847100',
          department: 'Department of Biotechnology & Bioinformatics',
          affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
        },
      ],
      approvals: [
        {
          authority_type: 'DEAN_RD',
          signatory_name: 'Prof. (Dr.) Rajesh Kumar',
          designation: 'Dean – Research & Development',
          status: 'APPROVED',
          decided_at: '2026-02-14T09:00:00Z',
        },
        {
          authority_type: 'VICE_CHANCELLOR',
          signatory_name: 'Prof. Vinay Kumar Pathak',
          designation: 'Vice Chancellor',
          status: 'APPROVED',
          decided_at: '2026-02-14T09:30:00Z',
        },
      ],
    };

    await page.route('**/modules/sama-veda/certificates/verify/*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockIncentiveVerification }),
      });
    });

    await page.route('**/api/v1/sama/certificates/verify/*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockIncentiveVerification }),
      });
    });

    await page.goto(`${BASE_URL}/verify/tok-csjmu-inc-2026-00045`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const incentivePath = path.join(ARTIFACT_DIR, 'public_verification_incentive_certificate.png');
    await page.screenshot({ path: incentivePath, fullPage: true });
    console.log('Saved Screenshot 3 (Public Verification - Incentive Award):', incentivePath);
    await context.close();
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
})();
