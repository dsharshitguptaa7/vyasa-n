# Atharva Veda Module: Grievance Redressal & Institutional Well-Being (NIVARAN-AI)
**Document Version:** 1.0.0-SPEC  
**Pillar Domain:** Atharva Veda (Grievance Redressal & Institutional Well-Being)  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)  
**Reference Subsystem:** NIVARAN-AI  
**Status:** Active Modular Monolith Integration Boundary

---

## 1. Purpose
Atharva Veda governs institutional justice, grievance redressal, scholar dispute resolution, and administrative accountability across Chhatrapati Shahu Ji Maharaj University (CSJMU). It integrates the functional **NIVARAN-AI** case management platform directly into the single VYASA application, providing tamper-evident workflows and legally binding cryptographic PDF case dossiers.

## 2. Scope
- Scholar grievance filing, evidence attachment, and OCR text extraction.
- Deterministic two-level administrative triage based on Academic Subjects and Grievance Categories.
- Accountable administrative forwarding mandating verification checkboxes and structured narratives.
- Special Committee governance with live messaging and multi-policy deliberative voting.
- Dean review, escalation adjudication, and case re-opening protocols.
- Cryptographic dossier assembly (RSA-3072 digital signatures + TOTP step-up challenges).

## 3. Functional Requirements
- **Filing Integrity:** Immutable SHA-256 document hashing, automatic anti-tamper validation.
- **Triage Matrix:** Automatic routing based on 10 Subject Clusters (Assistant Dean) and 3 Grievance Clusters (Associate Dean).
- **Non-Bypassable Review:** Assistant Dean must verify 6 explicit administrative checks before forwarding.
- **Deliberative Voting:** Supermajority, Simple Majority, or Unanimous committee decision policies.
- **Digital Closure:** Irrevocable case resolution generating a 15-section ReportLab PDF dossier.

## 4. Users / Actors
- **Doctoral Scholars (`applicant`):** File grievances, attach evidence, track resolution timeline, request appeals.
- **Grievance Manager (`authority`):** Institutional triage, preliminary jurisdiction assessment, committee formation.
- **Subject Assistant Deans (`authority`):** Level 1 academic investigation and accountable forwarding.
- **Grievance Associate Deans (`authority`):** Level 2 policy adjudication and resolution drafting.
- **Dean of Academic Affairs / Vice Chancellor (`authority`):** Final appellate review and re-opening approvals.
- **Committee Members & Guest Observers (`authority`):** Deliberate and cast cryptographic ballots.

## 5. Workflows
- **Standard Grievance Lifecycle:**
  1. Scholar Submission $\rightarrow$ SHA-256 Hashing $\rightarrow$ Tracking ID Minted.
  2. Manager Triage $\rightarrow$ Assigned to Subject Assistant Dean (Level 1).
  3. Assistant Dean Review $\rightarrow$ Accountable Forwarding to Associate Dean (Level 2).
  4. Associate Dean Adjudication $\rightarrow$ Action Proposed $\rightarrow$ Dean Endorsement.
  5. Cryptographic Signature (RSA-3072 + TOTP) $\rightarrow$ Dossier Compiled $\rightarrow$ Case Closed.
- **Special Committee Workflow:**
  Manager Forms Committee $\rightarrow$ Charter & Voting Policy Defined $\rightarrow$ Members Deliberate $\rightarrow$ Ballots Cast $\rightarrow$ Consensus Compiled into Dossier.

## 6. Frontend Architecture
- Location: `apps/vyasa/frontend/src/modules/atharva-veda/nivaran/`
- Mount Routes: `/modules/atharva-veda/nivaran`, `/modules/nivaran`, `/atharva-veda/nivaran`
- Internal Components: `NivaranWorkspaceCard.tsx`, `NivaranWorkspacePage.tsx`, `routes.tsx`, `services/nivaranService.ts`.
- Direct Single-Page Application (SPA) routing replacing the obsolete popup handoff.

## 7. Backend Architecture
- Location: `apps/vyasa/backend/app/modules/atharva_veda/nivaran/`
- Mount Route: `/api/modules/atharva-veda/nivaran`
- Internal Components: `router.py`, `models/`, `schemas/`, `services/`, `dependencies.py`.
- In-process module integrated into the master FastAPI application, sharing the database connection pool.

## 8. Database Ownership
- Table namespace: `nivaran_*` within the unified `vyasa_db` PostgreSQL database.
- Key tables:
  - `nivaran_subject_clusters`, `nivaran_subjects`: Academic hierarchy.
  - `nivaran_authorities`: Authority jurisdiction mapped to `users.id`.
  - `nivaran_grievance_categories`: Taxonomy and SLA configurations.
  - `nivaran_grievances`: 10-state lifecycle engine and tracking IDs.
  - `nivaran_documents`: Evidence metadata and hash registry.
  - `nivaran_routing_records`: Accountable forwarding trails.
  - `nivaran_approvals`: Hierarchical decisions.
  - `nivaran_committees`, `nivaran_committee_members`, `nivaran_committee_polls`: Committee voting.
  - `nivaran_efiles`, `nivaran_signatures`: Cryptographic dossiers.

## 9. Database Relationships
- Primary Anchor: `users.id` foreign key for applicant scholars, assigned authorities, and committee members.
- Cross-Module Linkages:
  - Link to **Rig Veda:** Grievance records referencing thesis supervisor conflicts or RAC meeting minutes.
  - Link to **Yajur Veda:** Grievances regarding fellowship disbursement delays or project budget disputes.

## 10. API Endpoints
- `GET /api/modules/atharva-veda/nivaran/status`: Operational status.
- `GET /api/modules/atharva-veda/nivaran/workspace`: Authenticated scholar/authority workspace context.
- Target integrated endpoints: `/grievances`, `/triage`, `/forward`, `/committees`, `/signatures`, `/efile`.

## 11. RBAC Requirements
- Required permissions:
  - `atharva:submit`: File new grievance and upload evidence.
  - `atharva:triage`: Perform preliminary manager triage.
  - `atharva:forward`: Execute accountable administrative forwarding.
  - `atharva:vote`: Cast ballots in special committee deliberations.
  - `atharva:sign`: Execute RSA-3072 cryptographic closure with TOTP challenge.

## 12. Module Configuration
- Dynamic flags in Core `ModuleRegistry`: `is_enabled=True`, `status="active"`.
- SLA timers (e.g. 7-day L1 limit, 14-day L2 limit), escalation thresholds, TOTP issuer name.

## 13. Cross-Module Dependencies
- Consumes verified scholar identities and applicant profiles from **VYASA Core**.
- Emits resolution and escalation events through **Core Notification Engine**.

## 14. Events & Notifications
- Emits: `atharva.grievance.filed`, `atharva.grievance.forwarded`, `atharva.committee.ballot_opened`, `atharva.dossier.signed`.
- Consumes: User verification and authority appointment events.

## 15. Testing Strategy
- Unit and integration tests in `apps/vyasa/backend/tests/test_modules_and_admin.py`.
- Component and routing tests in `apps/vyasa/frontend/src/features/crossPillar/__tests__/NivaranHandoffConfig.test.tsx`.
- Standalone reference tests preserved in `apps/pillars/nivaran/`.

## 16. Deployment Requirements
- Fully deployed in-process within the single VYASA container. No secondary port or CORS origins required.

## 17. Operational Requirements
- Monitored via `/api/watchdog/metrics` for transaction latency and outbox event dispatch queues.

## 18. Known Limitations
- The standalone reference project in `apps/pillars/nivaran/` remains untouched during this phase. Full database schema and model migration into `app/modules/atharva_veda/nivaran/` will occur in the dedicated Database Blueprint & Schema Integration phase.

## 19. Development Guide
- Review the complete technical documentation in `docs/pillars/nivaran/database-architecture.md` and follow `docs/development/adding-a-new-module.md`.

## 20. Change History
- **v1.0.0-MODULAR (2026-09-28):** Reclassified under Atharva Veda, obsolete popup handoff removed, modular internal routing established in Phase 2.
