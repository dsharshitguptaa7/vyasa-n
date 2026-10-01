# Sama Veda Module: Research Recognition & Communication
**Document Version:** 1.0.0-SPEC  
**Pillar Domain:** Sama Veda (Research Recognition & Communication)  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)  
**Status:** Planned Architectural Boundary (Business logic not yet implemented)

---

## 1. Purpose
Sama Veda governs the celebration, metrics, scholarly recognition, and public communication of research at CSJMU. It aggregates institutional citations, manages faculty research awards, automates symposium management, and powers public knowledge portals.

## 2. Scope
- Faculty and scholar citation telemetry (Google Scholar, Scopus, Web of Science).
- Annual University Research Excellence Awards nomination and judging.
- Academic conference, symposium, and workshop registration and proceedings archival.
- University research newsletter, press release generation, and open-access showcase.

## 3. Functional Requirements (Planned)
- Automated citation and h-index tracking for registered faculty profiles.
- Peer nomination and self-nomination workflows for research awards.
- Symposium lifecycle: Call for papers, abstract review, participant ticketing, proceedings generation.
- Public research explorer featuring high-impact discoveries from CSJMU scholars.

## 4. Users / Actors
- **Scholars & Faculty (`applicant` / `authority`):** Maintain public scholar profiles, claim publications, register for conferences.
- **Award Committee Judges (`authority`):** Evaluate research award dossiers and cast scoring ballots.
- **Symposium Organizers (`authority`):** Manage paper tracks, reviewer assignments, and symposium schedules.
- **Public & Media Visitors (Public):** Explore open-access university research discoveries.
- **System Administrators (`administrator`):** Manage external citation indexing API credentials and award seasons.

## 5. Workflows
- **Award Nomination Workflow:** Call Announced $\rightarrow$ Dossier Submitted $\rightarrow$ Blind Peer Evaluation $\rightarrow$ Committee Consensus $\rightarrow$ Award Conferred.
- **Symposium Submission Workflow:** Abstract Submitted $\rightarrow$ Peer Reviewers Assigned $\rightarrow$ Revision Requested $\rightarrow$ Accepted $\rightarrow$ Camera-Ready Paper Archived.
- **Citation Sync Workflow:** Scheduled cron trigger $\rightarrow$ Scholarly API queried $\rightarrow$ New citations detected $\rightarrow$ Faculty profile updated $\rightarrow$ Milestone notification sent.

## 6. Frontend Architecture
- Location: `apps/vyasa/frontend/src/modules/sama-veda/`
- Mount Route: `/modules/sama-veda`
- Predictable structure: `index.ts`, `routes.tsx`, `pages/`, `components/`, `services/`, `types/`, `README.md`.
- Styled using the `@vyasa/ui` design system.

## 7. Backend Architecture
- Location: `apps/vyasa/backend/app/modules/sama_veda/`
- Mount Route: `/api/modules/sama-veda`
- Predictable structure: `__init__.py`, `router.py`, `models/`, `schemas/`, `services/`, `dependencies.py`, `README.md`.
- In-process module integrated into the master FastAPI application.

## 8. Database Ownership
- Table namespace: `sama_*` (e.g., `sama_citations`, `sama_awards`, `sama_symposiums`).
- Schema ownership: Exclusive ownership of Sama Veda recognition entities in central `vyasa_db`.

## 9. Database Relationships
- Foreign keys to Core: `user_id` $\rightarrow$ `users.id`.
- Potential cross-module linkages:
  - Link to **Rig Veda:** Highlighting outstanding doctoral theses as institutional showcase items.
  - Link to **Yajur Veda:** Automatic trigger of publication incentives upon reaching citation thresholds.

## 10. API Endpoints
- `GET /api/modules/sama-veda/status`: Module operational and integration status.
- Future endpoints: `/api/modules/sama-veda/citations`, `/api/modules/sama-veda/awards`, `/api/modules/sama-veda/symposiums`.

## 11. RBAC Requirements
- Required permissions:
  - `sama:read`: View public profiles, citation counts, and conference schedules.
  - `sama:nominate`: Submit award applications and symposium abstracts.
  - `sama:judge`: Deliberate on awards and review submitted papers.
  - `sama:manage`: Configure symposium tracks, publish proceedings, and update metrics.

## 12. Module Configuration
- Dynamic flags in Core `ModuleRegistry`: `is_enabled`, `status`.
- External citation API keys (OpenAlex, CrossRef, Semantic Scholar), award score weighting formulas.

## 13. Cross-Module Dependencies
- Consumes verified identities and academic profiles from **VYASA Core**.
- Emits achievement announcements through **Core Notification Engine**.

## 14. Events & Notifications
- Emits: `sama.citation.milestone_reached`, `sama.award.conferred`, `sama.paper.accepted`.
- Consumes: User verification and publication creation events.

## 15. Testing Strategy
- Unit tests in `apps/vyasa/backend/tests/test_modules_and_admin.py`.
- Component tests in `apps/vyasa/frontend/src/modules/sama-veda/`.

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
