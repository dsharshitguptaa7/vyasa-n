const { chromium } = require('playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/harsh/.gemini/antigravity/brain/e90803ef-432d-4cee-be21-9af6a6b6ad21';
const BASE_URL = 'http://localhost:5173';

const validCertData = {
  certificate_number: 'CSJMU/SAMA/2026/00142',
  certificate_type: 'RESEARCH_EXCELLENCE',
  status: 'ISSUED',
  title: 'Certificate of Research Excellence',
  presentation_statement: 'Presented in recognition of outstanding scholarly contribution and high-impact publication in Scopus-indexed journal',
  research_contribution_statement: 'Original Research Article',
  research_title: 'Advancements in Deep Reinforcement Learning for Autonomous Quantum Control Systems',
  congratulatory_statement: 'The University commends the researchers for their scholarly achievement and contribution to institutional excellence.',
  sha256_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  is_download_allowed: true,
  is_revoked: false,
  verification_token: 'tok-valid-sample-001',
  issued_at: '2026-02-12T09:00:00Z',
  approved_at: '2026-02-11T10:15:00Z',
  authors: [
    {
      author_name: 'Dr. Ramesh Chandra Verma',
      academic_title: 'Dr.',
      department: 'Department of Computer Science & Engineering',
      affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      author_role: 'First Author',
      scopus_id: '57218492000',
      is_verified: true,
      author_order: 1,
    },
    {
      author_name: 'Prof. Rajesh Kumar',
      academic_title: 'Prof.',
      department: 'Research & Development Cell',
      affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
      author_role: 'Corresponding Author',
      is_verified: true,
      author_order: 2,
    },
  ],
  publication: {
    id: 'pub-001',
    title: 'Advancements in Deep Reinforcement Learning for Autonomous Quantum Control Systems',
    source_journal: 'IEEE Transactions on Neural Networks and Learning Systems (Q1, IF: 10.4)',
    doi: '10.1109/TNNLS.2025.10987654',
    category: 'International Journal',
  },
  approvals: [
    {
      authority_type: 'DEAN_RD',
      signatory_name: 'Prof. (Dr.) Rajesh Kumar',
      designation: 'Dean – Research & Development',
      status: 'APPROVED',
      decided_at: '2026-02-10T14:30:00Z',
    },
    {
      authority_type: 'VICE_CHANCELLOR',
      signatory_name: 'Prof. Vinay Kumar Pathak',
      designation: 'Vice Chancellor',
      status: 'APPROVED',
      decided_at: '2026-02-11T10:15:00Z',
    },
  ],
};

const revokedCertData = {
  ...validCertData,
  certificate_number: 'CSJMU/SAMA/2025/00089',
  status: 'REVOKED',
  is_revoked: true,
  revoked_at: '2025-11-20T16:45:00Z',
  revocation_reason: 'Institutional Integrity Review: Post-publication retraction by journal publisher due to third-party data discrepancy.',
  is_download_allowed: false,
  verification_token: 'tok-revoked-sample-002',
};

const supersededCertData = {
  ...validCertData,
  certificate_number: 'CSJMU/SAMA/2025/00045',
  status: 'SUPERSEDED',
  is_revoked: false,
  reissued_reason: 'Reissued to correct departmental affiliation and co-author institutional ordering per Dean R&D approval.',
  is_download_allowed: false,
  verification_token: 'tok-superseded-sample-003',
  replacement_certificate: {
    id: 'cert-repl-999',
    certificate_number: 'CSJMU/SAMA/2026/00150',
    verification_token: 'tok-replacement-004',
    status: 'ISSUED',
    issued_at: '2026-01-15T11:00:00Z',
    verification_url: '/verify/tok-replacement-004',
  },
};

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1100 } });

  await context.addInitScript(() => {
    sessionStorage.setItem('vyasa_invocation_completed', 'true');
  });

  const page = await context.newPage();

  // 1. Capture Valid Certificate with Download Button
  await page.route('**/modules/sama-veda/certificates/verify/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: validCertData }),
    });
  });

  await page.goto(`${BASE_URL}/verify/tok-valid-sample-001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const validPath = path.join(ARTIFACT_DIR, 'public_verification_valid_certificate.png');
  await page.screenshot({ path: validPath, fullPage: true });
  console.log('Saved Valid Certificate Screenshot:', validPath);

  // 2. Capture Revoked Certificate (Download Blocked, Invalidation Notice)
  await page.unroute('**/modules/sama-veda/certificates/verify/**');
  await page.route('**/modules/sama-veda/certificates/verify/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: revokedCertData }),
    });
  });

  await page.goto(`${BASE_URL}/verify/tok-revoked-sample-002`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const revokedPath = path.join(ARTIFACT_DIR, 'public_verification_revoked_certificate.png');
  await page.screenshot({ path: revokedPath, fullPage: true });
  console.log('Saved Revoked Certificate Screenshot:', revokedPath);

  // 3. Capture Superseded Certificate (Replacement Link, Download Blocked)
  await page.unroute('**/modules/sama-veda/certificates/verify/**');
  await page.route('**/modules/sama-veda/certificates/verify/**', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: supersededCertData }),
    });
  });

  await page.goto(`${BASE_URL}/verify/tok-superseded-sample-003`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const supersededPath = path.join(ARTIFACT_DIR, 'public_verification_superseded_certificate.png');
  await page.screenshot({ path: supersededPath, fullPage: true });
  console.log('Saved Superseded Certificate Screenshot:', supersededPath);

  await browser.close();
  console.log('All screenshots captured successfully.');
})();
