# Rig Veda Module: Research & Knowledge Creation
**Document Version:** 1.0.0-SPEC  
**Pillar Domain:** Rig Veda (Research & Knowledge Creation)  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)  
**Status:** Planned Architectural Boundary (Business logic not yet implemented)

---

## 1. Purpose
Rig Veda represents the foundational R&D pillar of the VYASA ecosystem. It is dedicated to governing the creation of research, doctoral scholar research lifecycles, synopsis progression, thesis defense workflows, and university scholarly publications.

## 2. Scope
- Doctoral research lifecycle tracking (from PhD coursework completion to final thesis viva).
- Research synopsis review and RAC/RDC meeting approvals.
- Institutional research repository indexing (pre-prints, papers, datasets).
- Plagiarism verification clearance checks and certificate generation.

## 3. Functional Requirements (Planned)
- Scholar research milestone submission and supervisor approvals.
- DRC (Departmental Research Committee) and RDC (Research Degree Committee) evaluation workflows.
- Research progress report semester uploads.
- Pre-submission seminar scheduling and examiner panel nominations.

## 4. Users / Actors
- **Doctoral Scholars (`applicant`):** Upload synopses, semester progress reports, and thesis drafts.
- **Research Supervisors (`authority`):** Review and endorse scholar submissions.
- **DRC / RDC Evaluators & Department Heads (`authority`):** Review milestones and record evaluation committee minutes.
- **Dean of R&D (`authority`):** Final institutional sanction for thesis submissions.
- **System Administrators (`administrator`):** Academic configuration, subject mapping, and quota oversight.

## 5. Workflows
- **Synopsis Approval Pipeline:** Scholar Draft $\rightarrow$ Supervisor Endorsement $\rightarrow$ DRC Review $\rightarrow$ RDC Approval $\rightarrow$ Topic Registered.
- **Semester Progress Evaluation:** Bi-annual report upload $\rightarrow$ Supervisor grading $\rightarrow$ RAC review $\rightarrow$ Milestone cleared.
- **Thesis Submission Pipeline:** Pre-submission viva passed $\rightarrow$ Plagiarism report verified $\rightarrow$ Examiner panel submitted $\rightarrow$ Viva voce conducted $\rightarrow$ Degree awarded.

## 6. Frontend Architecture
- Location: `apps/vyasa/frontend/src/modules/rig-veda/`
- Mount Route: `/modules/rig-veda`
- Predictable structure: `index.ts`, `routes.tsx`, `pages/`, `components/`, `services/`, `types/`, `README.md`.
- Integrates with the shared CSJMU design system in `packages/ui`.

## 7. Backend Architecture
- Location: `apps/vyasa/backend/app/modules/rig_veda/`
- Mount Route: `/api/modules/rig-veda`
- Predictable structure: `__init__.py`, `router.py`, `models/`, `schemas/`, `services/`, `dependencies.py`, `README.md`.
- In-process module integrated into the master FastAPI application.

## 8. Database Ownership
- Table namespace: `rig_*` (e.g., `rig_synopses`, `rig_milestones`, `rig_thesis_submissions`).
- Schema ownership: Exclusive ownership of Rig Veda operational entities within the central `vyasa_db` PostgreSQL database.

## 9. Database Relationships
- Foreign keys to Core: `user_id` $\rightarrow$ `users.id`, `subject_id` $\rightarrow$ `applicant_profiles.subject_id`.
- Potential cross-module linkages:
  - Link to **Yajur Veda:** Scholar research projects citing research grant sanction numbers.
  - Link to **Atharva Veda:** Academic grievances referencing thesis milestone delays.

## 10. API Endpoints
- `GET /api/modules/rig-veda/status`: Module operational and integration status.
- Future endpoints: `/api/modules/rig-veda/synopsis`, `/api/modules/rig-veda/milestones`, `/api/modules/rig-veda/thesis`.

## 11. RBAC Requirements
- Required permissions:
  - `rig:read`: View research milestones and publications.
  - `rig:submit`: Submit synopses, progress reports, and thesis files.
  - `rig:review`: Departmental and supervisor evaluation permissions.
  - `rig:manage`: Dean of R&D administrative authority.

## 12. Module Configuration
- Dynamic flags in Core `ModuleRegistry`: `is_enabled`, `status` (`planned`, `active`, `maintenance`).
- Plagiarism threshold percentages, submission grace periods, and RAC review intervals.

## 13. Cross-Module Dependencies
- Consumes verified identities from **VYASA Core**.
- Emits milestone completion events to **Core Notification Engine**.

## 14. Events & Notifications
- Emits: `rig.synopsis.submitted`, `rig.milestone.approved`, `rig.thesis.viva_scheduled`.
- Consumes: User verification and account activation events.

## 15. Testing Strategy
- Unit and integration tests in `apps/vyasa/backend/tests/test_modules_and_admin.py`.
- Component tests in `apps/vyasa/frontend/src/modules/rig-veda/`.

## 16. Deployment Requirements
- Deployed in-process within the single VYASA container; zero independent microservice overhead.

## 17. Operational Requirements
- Monitored via `/api/watchdog/metrics` and connection pool telemetry.

## 18. Known Limitations
- Rig Veda business logic, tables, and workflows are reserved for future phases. In Phase 2, only architectural boundaries are established.

## 19. Development Guide
- Follow the 18-step engineering lifecycle outlined in `docs/development/adding-a-new-module.md`.

## 20. Change History
- **v1.0.0-SPEC (2026-09-28):** Architectural boundary and documentation foundation established in Phase 2.
