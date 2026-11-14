const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/e90803ef-432d-4cee-be21-9af6a6b6ad21';
const BASE_URL = 'http://localhost:5173';

const mockDiscoveryData = {
  researcher: {
    id: 'res-ramesh-1',
    full_name: 'Dr. Ramesh Chandra Verma',
    department: 'Department of Computer Science & Engineering',
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    scopus_id: '57218492000',
  },
  research_certificates: [
    {
      id: 'cert-001',
      certificate_number: 'CSJMU/SAMA/2026/00142',
      title: 'Certificate of Research Excellence',
      certificate_type: 'RESEARCH_PUBLICATION',
      category: 'RESEARCH_WORK',
      publication_title: 'Advancements in Deep Reinforcement Learning for Autonomous Quantum Control Systems',
      issue_date: '12 February 2026',
      issued_at: '2026-02-12T09:00:00Z',
      status: 'ISSUED',
      is_revoked: false,
      verification_token: 'tok-valid-sample-001',
      verification_url: '/verify/tok-valid-sample-001',
      is_download_allowed: true,
      download_url: '/api/modules/sama-veda/certificates/verify/tok-valid-sample-001/download',
    },
    {
      id: 'cert-002',
      certificate_number: 'CSJMU/SAMA/2025/00095',
      title: 'Institutional Felicitation Certificate',
      certificate_type: 'APPRECIATION',
      category: 'RESEARCH_WORK',
      publication_title: 'Scalable Graph Neural Networks for Molecular Property Prediction',
      issue_date: '15 November 2025',
      issued_at: '2025-11-15T11:00:00Z',
      status: 'ISSUED',
      is_revoked: false,
      verification_token: 'tok-valid-sample-002',
      verification_url: '/verify/tok-valid-sample-002',
      is_download_allowed: true,
      download_url: '/api/modules/sama-veda/certificates/verify/tok-valid-sample-002/download',
    },
  ],
  incentive_certificates: [],
  anudaan_incentives: {
    total_applications: 2,
    approved_count: 2,
    pdf_certificates_available: false,
    message: 'Official PDF incentive certificates have not yet been generated in SAMIKSHA for approved incentive records. If you have approved incentives, please consult the R&D Cell for physical certificates.',
  },
};

const mockAuthChallenge = {
  status: 'AUTH_REQUIRED',
  requires_authentication: true,
  researcher: {
    id: 'res-ramesh-1',
    full_name: 'Dr. Ramesh Chandra Verma',
    department: 'Department of Computer Science & Engineering',
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    scopus_id: '57218492000',
    has_registered_user: true,
    masked_email: 'r***a@csjmu.ac.in',
  },
  message: 'Researcher verified: Dr. Ramesh Chandra Verma. In accordance with university credential security guidelines, please sign in or verify via registered email OTP.',
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Desktop Screenshot: Certificate Centre Overview (Both Sections visible)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/modules/sama-veda/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // Scroll to the Certificate Centre card
    await page.locator('#researcher-certificate-discovery').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const desktopPath = path.join(ARTIFACT_DIR, 'certificate_centre_desktop_overview.png');
    await page.screenshot({ path: desktopPath, fullPage: false });
    console.log('Saved Screenshot 1 (Desktop Overview):', desktopPath);
    await context.close();
  }

  // 2. Mobile Screenshot: Responsive Mobile Layout (iPhone 14 standard 390x844)
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/modules/sama-veda/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.locator('#researcher-certificate-discovery').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    const mobilePath = path.join(ARTIFACT_DIR, 'certificate_centre_mobile_layout.png');
    await page.screenshot({ path: mobilePath, fullPage: false });
    console.log('Saved Screenshot 2 (Mobile Layout):', mobilePath);
    await context.close();
  }

  // 3. Desktop Screenshot: Discovered Certificates State (Category 1 & Category 2)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    const page = await context.newPage();

    await page.route('**/modules/sama-veda/certificates/researcher-discovery?*', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockDiscoveryData }),
      });
    });

    await page.goto(`${BASE_URL}/modules/sama-veda/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const scopusInput = page.locator('input[placeholder*="registered Scopus ID"]');
    await scopusInput.fill('57218492000');
    await page.locator('button:has-text("Find My Certificates")').click();
    await page.waitForTimeout(600);

    const discElem = page.locator('#researcher-certificate-discovery');
    await discElem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const discoveredPath = path.join(ARTIFACT_DIR, 'certificate_centre_discovered_certificates.png');
    await discElem.screenshot({ path: discoveredPath });
    console.log('Saved Screenshot 3 (Discovered Certificates):', discoveredPath);
    await context.close();
  }

  // 4. Desktop Screenshot: Security Auth Challenge / Email OTP
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    const page = await context.newPage();

    await page.route('**/modules/sama-veda/certificates/researcher-discovery?*', (route) => {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: mockAuthChallenge.message,
          data: mockAuthChallenge,
        }),
      });
    });

    await page.goto(`${BASE_URL}/modules/sama-veda/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const scopusInput = page.locator('input[placeholder*="registered Scopus ID"]');
    await scopusInput.fill('57218492000');
    await page.locator('button:has-text("Find My Certificates")').click();
    await page.waitForTimeout(600);

    const discElem = page.locator('#researcher-certificate-discovery');
    await discElem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const authChallengePath = path.join(ARTIFACT_DIR, 'certificate_centre_auth_challenge.png');
    await discElem.screenshot({ path: authChallengePath });
    console.log('Saved Screenshot 4 (Security Auth Challenge):', authChallengePath);
    await context.close();
  }

  // 5. Desktop Screenshot: Public Certificate Verification (Method A & B)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('vyasa_invocation_completed', 'true');
    });
    const page = await context.newPage();

    await page.goto(`${BASE_URL}/modules/sama-veda/certificates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    const verifyElem = page.locator('#certificate-verification');
    await verifyElem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    const publicVerifyPath = path.join(ARTIFACT_DIR, 'certificate_centre_public_verification.png');
    await verifyElem.screenshot({ path: publicVerifyPath });
    console.log('Saved Screenshot 5 (Public Verification Section):', publicVerifyPath);
    await context.close();
  }

  await browser.close();
  console.log('All Certificate Centre screenshots captured successfully.');
})();
