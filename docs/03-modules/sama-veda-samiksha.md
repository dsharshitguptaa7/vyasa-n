# SAMA VEDA &bull; ANVESHAN / SAMIKSHA SUB-ECOSYSTEM AUDIT

**Domain:** Research Recognition, Scientific Communication & Institutional Innovation  
**Subsystem Code:** `sama_veda`  
**Current Audit Date:** November 7, 2026  
**Implementation Classification:** **IMPLEMENTED (CORE OPERATIONAL)**  

---

## 1. Subsystem Overview & Vision

Sama Veda (branded publicly as **ANVESHAN** / **SAMIKSHA**) serves as CSJMU's centralized research discovery and recognition engine. It provides a public showcase of university scientific breakthroughs, volume-indexed research bulletins, verified faculty author profiles (Scopus / ORCID), Centre for Advanced Materials (CAM) projects, and a public QR-code cryptographic certificate verification system.

Internally, it provides a comprehensive Content Management System (CMS) and a high-performance batch data importer for historical research records.

---

## 2. Key Functional Workspaces & Features

### 1. Public Research Portal (`/modules/sama-veda`)
- **Frontend Page:** [`SamaVedaDashboardPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/sama-veda/pages/SamaVedaDashboardPage.tsx)
- **Backend Endpoints:** `GET /modules/sama-veda/publications`, `/bulletins`, `/authors`, `/cam-projects`, `/spotlights`, `/fellowships`
- **Component Architecture:**
  - **SamikshaHero:** Dynamic banner highlighting university research metrics (total publications, cumulative impact, indexed citations) and faculty breakthrough spotlights.
  - **SamikshaPublicationsTab:** Searchable publication catalog filterable by category (Medicine, Engineering, Basic Sciences), DOI, journal title, and featured status.
  - **SamikshaBulletinsTab:** Volume- and issue-based archive grid. Users can click any issue to view table of contents, preview metadata, or download the full PDF.
  - **SamikshaPdfViewer:** In-browser document viewer for published university bulletins with page controls and full-screen view.
  - **SamikshaResearchersTab:** Disambiguated directory of university faculty authors with Scopus IDs, ORCID IDs, departmental affiliations, and verified researcher badges.
  - **SamikshaCamProjectsTab:** Directory of advanced research projects supported by national funding agencies (DST, SERB, CSIR, ICMR).
  - **SamikshaFellowshipsTab:** Listing of doctoral and post-doctoral fellowship schemes, stipend values, and application criteria.

### 2. Public Digital Certificate Verification Portal (`/modules/sama-veda/felicitation`)
- **Frontend Component:** [`SamikshaFelicitationTab.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/sama-veda/components/SamikshaFelicitationTab.tsx)
- **Backend Endpoints:** `GET /modules/sama-veda/certificates/verify/{certificate_number}`, `GET /.../certificates/download/{certificate_number}`
- **Security Features:**
  - Employers, academic institutions, and students scan certificate QR codes to instantly verify authenticity.
  - Returns recipient name, achievement title, category, issue date, and issuing authority seal.
  - **Revocation Detection:** If a certificate has been revoked due to academic misconduct or administrative cancellation, the portal displays a prominent warning banner with the formal revocation reason and date, strictly disabling PDF downloading.
  - **Verification Telemetry:** Every verification event records the verifier's IP address, user agent, and timestamp in `sama_certificate_verification_events`.

### 3. Administrative CMS Console (`/admin/sama/*`)
- **Frontend Pages:** [`PublicationsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/PublicationsPage.tsx), [`AuthorsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/AuthorsPage.tsx), [`BulletinsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/BulletinsPage.tsx), [`CertificatesPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/CertificatesPage.tsx), [`CamProjectsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/CamProjectsPage.tsx), [`SpotlightsPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/SpotlightsPage.tsx)
- **Backend Router:** [`sama_admin_router.py`](file:///c:/Projects/VYASA/backend/app/admin/sama_admin_router.py) (32 dedicated endpoints)
- **Features:**
  - Full CRUD lifecycle for publications with multi-author sequencing and corresponding author designation.
  - Bulletin file uploader automatically extracting page counts and enforcing PDF magic byte validation.
  - Certificate issuance generating unique institutional certificate identifiers (`CSJMU/SAMA/YYYY/XXXX`) and SHA-256 verification hashes.
  - Revocation manager allowing administrators to cancel issued certificates with mandatory audit remarks.

### 4. Bulk Historical Data Importer (`/admin/sama/import`)
- **Frontend Page:** [`ImportPage.tsx`](file:///c:/Projects/VYASA/frontend/src/admin/pages/sama/ImportPage.tsx)
- **Backend Endpoints:** `POST /api/admin/sama/import/preview`, `POST /api/admin/sama/import/execute/{id}`, `GET /api/admin/sama/import/batches`
- **Features:**
  - High-throughput ingestion of historical university publications from Excel (`.xlsx`) or CSV files.
  - **Two-Phase Commit:**
    1. *Preview Phase:* Validates spreadsheet headers, checks DOI uniqueness, identifies existing vs. new authors, and reports invalid rows without modifying the database.
    2. *Execution Phase:* Inserts approved records inside an atomic database transaction. If any fatal constraint fails, the entire batch rolls back.
  - Tracks historical batches in `sama_import_batches` with detailed JSON error logs.

---

## 3. Discovered Vulnerabilities & Known Limitations

1. **Frontend Vitest Timeout on Initial Render (Testing - Medium):**
   - The test `renders portal header, overview cards, and navigation tabs` in `samaVedaPublicPortal.test.tsx` timed out at 5000ms during heavy parallel test execution under Windows jsdom due to simultaneous mock resolution of 6 endpoints.
   - *Remediation:* Increase test timeout or consolidate initial batch calls into a unified summary endpoint.
2. **Author Disambiguation Collision Risk (Data - Low):**
   - Faculty authors with common names without Scopus or ORCID identifiers can experience profile collision during bulk import. Importer resolves by email when present.
