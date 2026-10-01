# Yajur Veda Module: Research Administration & Incentives
**Document Version:** 1.0.0-SPEC  
**Pillar Domain:** Yajur Veda (Research Administration & Incentives)  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)  
**Status:** Planned Architectural Boundary (Business logic not yet implemented)

---

## 1. Purpose
Yajur Veda is the administrative and financial pillar of research at CSJMU. It automates institutional project approvals, government and industry research grant administration, scholar fellowships, patent filings, research incentive disbursements, and institutional ethics clearance.

## 2. Scope
- Research project sanctioning and fund utilization certificates.
- Institutional research incentive policies for faculty publications.
- Scholar fellowship disbursement tracking (UGC JRF/SRF, CSIR, Institutional).
- Institutional Ethics Committee (IEC) and Animal Ethics Committee clearances.

## 3. Functional Requirements (Planned)
- Faculty application for publication incentive bonuses according to impact factors.
- Research grant budget ledger and installment tracking.
- Scholar fellowship attendance verification and monthly stipend approval.
- Ethics clearance application, review, and certificate generation.

## 4. Users / Actors
- **Faculty Researchers (`authority`):** Apply for project funding, manage project expenses, and claim publication incentives.
- **Doctoral Scholars (`applicant`):** Apply for monthly fellowship disbursement and travel grant reimbursements.
- **Ethics Review Board Members (`authority`):** Evaluate research proposals involving human or animal subjects.
- **Finance Officer & Registrar (`authority`):** Review utilization certificates and release incentive funds.
- **System Administrators (`administrator`):** Define funding policies, incentive slabs, and budget cycles.

## 5. Workflows
- **Publication Incentive Workflow:** Claim Submitted $\rightarrow$ Automatic ISSN/Scopus Verification $\rightarrow$ Dean R&D Approval $\rightarrow$ Finance Sanction $\rightarrow$ Disbursed.
- **Ethics Review Workflow:** Protocol Submitted $\rightarrow$ Primary Reviewer Assigned $\rightarrow$ Committee Deliberation $\rightarrow$ Clearance Certificate Issued.
- **Fellowship Workflow:** Monthly Attendance Certified $\rightarrow$ Supervisor Signature $\rightarrow$ Dean R&D Verification $\rightarrow$ Treasury Dispatched.

## 6. Frontend Architecture
- Location: `apps/vyasa/frontend/src/modules/yajur-veda/`
- Mount Route: `/modules/yajur-veda`
- Predictable structure: `index.ts`, `routes.tsx`, `pages/`, `components/`, `services/`, `types/`, `README.md`.
- Styled using the `@vyasa/ui` design system.

## 7. Backend Architecture
- Location: `apps/vyasa/backend/app/modules/yajur_veda/`
- Mount Route: `/api/modules/yajur-veda`
- Predictable structure: `__init__.py`, `router.py`, `models/`, `schemas/`, `services/`, `dependencies.py`, `README.md`.
- In-process module integrated into the master FastAPI application.

## 8. Database Ownership
- Table namespace: `yajur_*` (e.g., `yajur_grants`, `yajur_incentives`, `yajur_ethics_reviews`).
- Schema ownership: Exclusive ownership of Yajur Veda domain entities in central `vyasa_db`.

## 9. Database Relationships
- Foreign keys to Core: `user_id` $\rightarrow$ `users.id`.
- Potential cross-module linkages:
  - Link to **Rig Veda:** Research grants funding specific doctoral synopses or equipment.
  - Link to **Sama Veda:** High-impact incentives feeding institutional citation telemetry.

## 10. API Endpoints
- `GET /api/modules/yajur-veda/status`: Module operational and integration status.
- Future endpoints: `/api/modules/yajur-veda/grants`, `/api/modules/yajur-veda/incentives`, `/api/modules/yajur-veda/ethics`.

## 11. RBAC Requirements
- Required permissions:
  - `yajur:read`: View grant registries and approved incentive tiers.
  - `yajur:apply`: Submit incentive claims and project proposals.
  - `yajur:review`: Ethics board evaluation and departmental verification.
  - `yajur:disburse`: Financial clearance and incentive disbursement authority.

## 12. Module Configuration
- Dynamic flags in Core `ModuleRegistry`: `is_enabled`, `status`.
- Budget allocation ceilings, Scopus/Web of Science API keys, incentive calculation matrices.

## 13. Cross-Module Dependencies
- Consumes verified identities and academic profiles from **VYASA Core**.
- Emits fund disbursement notifications through **Core Notification Engine**.

## 14. Events & Notifications
- Emits: `yajur.grant.sanctioned`, `yajur.incentive.approved`, `yajur.ethics.cleared`.
- Consumes: User verification and active status events.

## 15. Testing Strategy
- Unit tests in `apps/vyasa/backend/tests/test_modules_and_admin.py`.
- Component tests in `apps/vyasa/frontend/src/modules/yajur-veda/`.

## 16. Deployment Requirements
- Deployed in-process within the single VYASA container.

## 17. Operational Requirements
- Monitored via `/api/watchdog/metrics`.

## 18. Known Limitations
- Business logic, tables, and workflows are reserved for future phases. In Phase 2, only structural boundaries are established.

## 19. Development Guide
- Follow the 18-step engineering lifecycle outlined in `docs/development/adding-a-new-module.md`.

## 20. Change History
- **v1.0.0-SPEC (2026-09-28):** Architectural boundary and documentation foundation established in Phase 2.
