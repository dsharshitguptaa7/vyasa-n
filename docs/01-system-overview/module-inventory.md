# VYASA-N — MASTER MODULE & FEATURE INVENTORY

**Audit Date:** November 7, 2026  
**Auditor Classification:** Principal Software Architect & Technical Reviewer  
**Total Features Assessed:** 95 distinct features across 7 subsystems  

---

## 1. Classification Standards

Every feature in the VYASA-N ecosystem is evaluated against strict evidence criteria:

| Status | Definition |
| :--- | :--- |
| **IMPLEMENTED** | Feature is fully implemented in frontend UI and backend API, connected to database models, with functional logic verified by code inspection and tests. |
| **PARTIALLY IMPLEMENTED** | Some components exist, but the end-to-end workflow has functional gaps, missing validations, or incomplete UI integrations. |
| **UI ONLY** | Frontend user interface exists, but backend API endpoints or database persistence are missing or mock-only. |
| **BACKEND ONLY** | Backend API and database logic are complete and functional, but no dedicated user interface exists in the frontend. |
| **BROKEN** | Implementation exists in both frontend and backend, but inspection or runtime testing reveals a functional failure or network disconnect. |
| **NOT IMPLEMENTED** | Documented or planned capability with no substantive frontend, backend, or schema implementation. |
| **UNVERIFIED** | Insufficient runtime or test evidence is available to confirm operational stability. |

---

## 2. Core Governance & Identity Subsystem

| Feature Name | Intended User | Frontend File | Backend Route / Handler | Database Table | Status | Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Applicant Registration** | Prospective / Enrolled Students | `features/auth/ApplicantRegisterPage.tsx` | `POST /api/auth/register` | `users`, `applicant_profiles` | **IMPLEMENTED** | Atomic transaction creates user identity and profile snapshot across all 56 university subjects. Verified by tests. |
| **Unified Credential Login** | All Personas | `features/auth/ApplicantLoginPage.tsx`, `AuthorityLoginPage.tsx` | `POST /api/auth/login` | `users`, `user_roles` | **IMPLEMENTED** | Enforces email normalization, PBKDF2 hashing, account deactivation checks, and failed attempt rate limiting. |
| **First-Login Password Reset** | Newly Onboarded Authorities | `features/auth/AuthorityLoginPage.tsx` | `POST /api/auth/first-login/set-password` | `users`, `authentication_challenges` | **IMPLEMENTED** | Single-use challenge gate. Rejects temporary password reuse and forces immediate 2FA setup. |
| **TOTP 2FA Enrollment & Verification** | Institutional Authorities | `features/auth/AuthorityLoginPage.tsx` | `POST /api/auth/2fa/setup`, `/confirm-setup`, `/verify` | `user_two_factor_auth`, `authentication_challenges` | **IMPLEMENTED** | Fernet encryption at rest for TOTP seeds. QR code provisioning and 8 emergency backup codes. |
| **2FA Emergency Recovery** | Institutional Authorities | `features/auth/AuthorityLoginPage.tsx` | `POST /api/auth/2fa/recovery` | `user_two_factor_auth` | **IMPLEMENTED** | Consumes one-time hashed recovery codes with automatic session invalidation and security notification dispatch. |
| **Token Verification & Introspection** | Internal Frontend / Gateway | `services/authService.ts` | `POST /api/auth/verify`, `GET /api/auth/me` | `users`, `user_roles` | **IMPLEMENTED** | Stateless JWT decoding, role claims verification, and subject taxonomy expansion. |
| **Unified Ecosystem Navigation** | All Users | `components/layout/UnifiedSidebar.tsx`, `MainLayout.tsx` | N/A (Client routing) | N/A | **IMPLEMENTED** | Dynamic sidebar adapting options based on active JWT persona (Doctoral Scholar, Manager, Dean, Admin). |
| **Centralized Notification Center** | All Users | `features/notifications/NotificationCenterPage.tsx` | `GET /api/notifications`, `PATCH /{id}/read` | `notifications`, `notification_preferences` | **IMPLEMENTED** | Pillar-branded alerts, multi-channel dispatch, preference toggling, and read status tracking. |
| **System Health & Pool Telemetry** | Super Administrators | `admin/pages/AdminDashboardPage.tsx` | `GET /api/health`, `GET /api/health/db`, `GET /api/watchdog/metrics` | N/A (Connection pool) | **IMPLEMENTED** | Reports database connection pool checkout statistics, active connections, and system uptime. |

---

## 3. Atharva Veda &bull; NIVARAN-AI Subsystem

| Feature Name | Intended User | Frontend File | Backend Route / Handler | Database Table | Status | Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Applicant Grievance Intake** | Doctoral Scholars / Students | `modules/atharva-veda/nivaran/pages/GrievanceSubmitPage.tsx` | `POST /api/modules/atharva-veda/nivaran/grievances` | `nivaran_grievances`, `nivaran_case_history` | **IMPLEMENTED** | Enforces 3 active cases limit, duplicate detection, and initial taxonomy linkage. |
| **Multimodal Document Upload** | Applicants & Authorities | `modules/atharva-veda/nivaran/components/GrievanceSubmitPage.tsx` | `POST /.../grievances/{id}/documents` | `nivaran_grievance_documents` | **IMPLEMENTED** | Magic byte validation, SHA-256 hash generation, and storage via `StorageServiceProxy`. |
| **Gemini OCR Extraction** | Applicants | `modules/atharva-veda/nivaran/pages/GrievanceSubmitPage.tsx` | `POST /.../grievances/ocr/extract` | N/A (Ephemeral API) | **IMPLEMENTED** | Extracts text from uploaded PDF/image affidavits using `gemini-2.0-flash-lite`. |
| **Machine Learning Triage & Suggestion** | Case Managers | `modules/atharva-veda/nivaran/pages/ManagerGrievanceReviewPage.tsx` | `PATCH /.../grievances/{id}/ai-review` | `nivaran_ai_classification_logs` | **IMPLEMENTED** | Scikit-learn model predicts category with confidence score. Manager can accept or override. |
| **Manager Triage & Review** | Case Managers | `modules/atharva-veda/nivaran/pages/ManagerTriageQueuePage.tsx` | `POST /.../manager/grievances/{id}/review` | `nivaran_grievances`, `nivaran_case_history` | **IMPLEMENTED** | Allows category reassignment, priority setting, and initial dispatch to Assistant Dean queue. |
| **Assistant Dean Case Resolution** | Assistant Deans | `modules/atharva-veda/nivaran/pages/AssistantDeanDashboardPage.tsx` | `POST /.../assistant-dean/grievances/{id}/resolve` | `nivaran_grievances`, `nivaran_case_history` | **IMPLEMENTED** | Resolves cases falling within jurisdictional subject cluster with detailed resolution notes. |
| **Assistant Dean Forwarding** | Assistant Deans | `modules/atharva-veda/nivaran/components/ForwardToDeanModal.tsx` | `POST /.../assistant-dean/grievances/{id}/forward` | `nivaran_grievances`, `nivaran_case_history` | **IMPLEMENTED** | Forwards complex or policy cases upward to Associate Dean or Dean. |
| **Document Clarification Requests** | Assistant & Associate Deans | `modules/atharva-veda/nivaran/components/RequestDocumentModal.tsx` | `POST /.../document-requests` | `nivaran_document_requests` | **IMPLEMENTED** | Prompts applicant for additional evidence, pausing the resolution SLA timer. |
| **Committee Formation Request** | Assistant Deans | `modules/atharva-veda/nivaran/components/RequestCommitteeModal.tsx` | `POST /.../committees/requests/{id}` | `nivaran_committee_creation_requests` | **IMPLEMENTED** | Submits formal petition with proposed membership snapshot to Associate Dean or Dean. |
| **Direct Committee Chartering** | Associate Deans & Deans | `modules/atharva-veda/nivaran/components/FormCommitteeModal.tsx` | `POST /.../committees/direct` | `nivaran_committees`, `nivaran_committee_members` | **IMPLEMENTED** | Creates dedicated committee with terms of reference, appointed chair, and active roster. |
| **Committee Workspace: Real-Time Chat** | Committee Members | `modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx` | `WS /.../committees/{id}/ws` | `nivaran_committee_messages` | **BROKEN** | Frontend connects to `/api/v1/.../ws` while backend route is mounted at `/api/.../ws` (P0 bug). Falls back to REST polling. |
| **Committee Workspace: Polls & Balloting** | Committee Members | `modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx` | `POST /.../committees/{id}/polls`, `/polls/{id}/vote` | `nivaran_committee_polls`, `nivaran_committee_poll_votes` | **IMPLEMENTED** | Supports Simple Majority, Two-Thirds, Unanimous. Generates immutable SHA-256 ballot hashes. |
| **Committee Hearing Scheduling (Google Meet)** | Committee Members | `modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx` | `POST /.../committees/{id}/meetings` | `nivaran_committee_meetings` | **IMPLEMENTED** | Generates calendar events and Google Meet conference links via Google Calendar API with mock fallback. |
| **Committee Formal Decision Recording** | Committee Chairperson | `modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx` | `POST /.../committees/{id}/decisions` | `nivaran_committee_decisions` | **IMPLEMENTED** | Records official recommendations and consensus type, attaching findings to parent grievance. |
| **Associate Dean Jurisdictional Triage** | Associate Deans | `modules/atharva-veda/nivaran/pages/AssociateDeanDashboardPage.tsx` | `GET /.../associate-dean/dashboard`, `/cases` | `nivaran_grievances`, `nivaran_grievance_clusters` | **IMPLEMENTED** | Displays cross-subject cases organized by grievance cluster (Academic, Financial, Administrative). |
| **Dean Executive Command Center** | Dean (R&D / Academic) | `modules/atharva-veda/nivaran/pages/DeanExecutiveDashboardPage.tsx` | `GET /.../dean/dashboard`, `/cases` | `nivaran_grievances`, `nivaran_case_history` | **IMPLEMENTED** | Institution-wide case ledger, SLA violation warnings, priority donut charts, and workload matrix. |
| **Manager Final Case Closure** | Case Managers | `modules/atharva-veda/nivaran/pages/ManagerClosureQueuePage.tsx` | `POST /.../manager/grievances/{id}/finalize-closure` | `nivaran_grievances`, `nivaran_case_history` | **IMPLEMENTED** | Verifies resolution compliance, records closure remarks, and triggers automated dossier sealing. |
| **Cryptographic E-File Generation & Sealing** | Automated / System | `modules/atharva-veda/nivaran/pages/NivaranEFilesPage.tsx` | `GET /.../e-files`, `GET /.../e-files/{id}/verify` | `nivaran_efiles` | **IMPLEMENTED** | Generates official PDF dossier including all case history, minutes, and documents. Hashes with SHA-256. |
| **Student Master Record (SMR) Indexing** | Authorities & Applicants | `modules/atharva-veda/nivaran/pages/StudentMasterRecordsPage.tsx` | `GET /.../student-records/search`, `/student-records/me` | `nivaran_student_master_records` | **IMPLEMENTED** | Indexes student profile, total complaints, active cases, and links to sealed e-Files. |
| **Applicant Post-Resolution Feedback** | Applicants | `modules/atharva-veda/nivaran/components/ApplicantFeedbackCard.tsx` | `POST /.../grievances/{id}/feedback` | `nivaran_grievance_feedbacks` | **IMPLEMENTED** | 1-to-5 star rating and comments submitted upon closure. Aggregated in public feedback summary. |

---

## 4. Sama Veda &bull; ANVESHAN / SAMIKSHA Subsystem

| Feature Name | Intended User | Frontend File | Backend Route / Handler | Database Table | Status | Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Research Bulletins Catalog** | Public / Researchers | `modules/sama-veda/components/SamikshaBulletinsTab.tsx` | `GET /api/modules/sama-veda/bulletins` | `sama_bulletins` | **IMPLEMENTED** | Volume- and issue-based discovery grid with cover images, table of contents, and PDF downloads. |
| **In-Browser Bulletin PDF Viewer** | Public / Researchers | `modules/sama-veda/components/SamikshaPdfViewer.tsx` | `GET /.../bulletins/{id}/view` | `sama_bulletins` | **IMPLEMENTED** | Streams bulletin PDF with pagination, zoom, and direct download controls. |
| **Peer-Reviewed Publications Directory** | Public / Researchers | `modules/sama-veda/components/SamikshaPublicationsTab.tsx` | `GET /api/modules/sama-veda/publications` | `sama_research_publications` | **IMPLEMENTED** | Searchable catalog by DOI, journal, category, author, and featured status. |
| **Verified Author & Citation Registry** | Public / Researchers | `modules/sama-veda/components/SamikshaResearchersTab.tsx` | `GET /api/modules/sama-veda/authors` | `sama_research_authors` | **IMPLEMENTED** | Author disambiguation with Scopus ID, ORCID ID, departmental affiliation, and verified badge. |
| **CAM AI / Multidisciplinary Projects** | Public / Researchers | `modules/sama-veda/components/SamikshaCamProjectsTab.tsx` | `GET /api/modules/sama-veda/cam-projects` | `sama_cam_projects` | **IMPLEMENTED** | Showcases sponsored research projects with Principal Investigator, funding agency, and grant amounts. |
| **Faculty Research Spotlights** | Public / Researchers | `modules/sama-veda/components/SamikshaHero.tsx` | `GET /api/modules/sama-veda/spotlights` | `sama_researcher_spotlights` | **IMPLEMENTED** | Carousel highlighting faculty breakthrough achievements and international citations. |
| **Fellowship Schemes Showcase** | Public / Students | `modules/sama-veda/components/SamikshaFellowshipsTab.tsx` | `GET /api/modules/sama-veda/fellowships` | `sama_fellowship_schemes` | **IMPLEMENTED** | Detailed listing of university and government fellowships with stipend amounts and eligibility. |
| **Public Certificate QR Verification** | Public / Employers | `modules/sama-veda/components/SamikshaFelicitationTab.tsx` | `GET /.../certificates/verify/{number}` | `sama_felicitation_certificates` | **IMPLEMENTED** | Instant cryptographic verification of certificate authenticity, detecting revoked credentials and logging verification telemetry. |
| **CMS Publication Management** | Content Administrators | `admin/pages/sama/PublicationsPage.tsx` | `POST`, `PUT`, `DELETE /api/admin/sama/publications` | `sama_research_publications` | **IMPLEMENTED** | Full CRUD for research papers with multi-author association and status lifecycle (`draft`, `published`, `archived`). |
| **CMS Author Management** | Content Administrators | `admin/pages/sama/AuthorsPage.tsx` | `POST`, `PUT`, `DELETE /api/admin/sama/authors` | `sama_research_authors` | **IMPLEMENTED** | Author profile management, Scopus/ORCID verification toggle, and bulk deletion. |
| **CMS Bulletin Publisher** | Content Administrators | `admin/pages/sama/BulletinsPage.tsx` | `POST /.../bulletins/upload`, `POST /.../bulletins` | `sama_bulletins` | **IMPLEMENTED** | Multipart PDF upload with automatic page counting, title validation, and publishing toggle. |
| **CMS Felicitation Certificate Issuer** | Content Administrators | `admin/pages/sama/CertificatesPage.tsx` | `POST /.../certificates`, `POST /.../{id}/revoke` | `sama_felicitation_certificates` | **IMPLEMENTED** | Generates digital certificate record with QR code hash and handles formal revocation with audit remarks. |
| **Bulk Historical Research Importer** | Content Administrators | `admin/pages/sama/ImportPage.tsx` | `POST /.../import/preview`, `POST /.../execute/{id}` | `sama_import_batches` | **IMPLEMENTED** | Parses historical Excel/CSV files, previews valid vs. invalid rows, and executes transactional database insertion. |

---

## 5. Public Ph.D. Admission Grounded RAG Assistant Subsystem

| Feature Name | Intended User | Frontend File | Backend Route / Handler | Database Table | Status | Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Public Admissions Conversational Chat** | Prospective Applicants | `features/phd-rag/PhdAssistantPage.tsx` | `POST /api/public/phd-admission/chat` | `phd_rag_documents`, `phd_rag_chunks` | **IMPLEMENTED** | Strictly answers from official university brochures and ordinances. Cites specific pages and documents. |
| **Dynamic Suggested Questions** | Prospective Applicants | `features/phd-rag/PhdAssistantPage.tsx` | `GET /.../suggested-questions` | N/A (Dynamic engine) | **IMPLEMENTED** | Suggests context-aware admissions questions (eligibility, syllabus, fee structure). |
| **Document Ingestion CLI Pipeline** | System Administrators | N/A (CLI Tool) | `modules/phd_rag/cli.py` | `phd_rag_documents`, `phd_rag_chunks` | **BACKEND ONLY** | Ingests PDF, DOCX, and PPTX documents into vector embeddings. Fully functional CLI command. |
| **Sliding-Window IP Rate Limiter** | Public Endpoint Security | N/A (Middleware) | `modules/phd_rag/rate_limiter.py` | N/A (In-memory cache) | **IMPLEMENTED** | Limits unauthenticated queries to 20 requests per minute per IP, respecting trusted proxy headers. |
| **Audio Text-to-Speech Playback** | Prospective Applicants | `features/phd-rag/components/AudioSpeechPlayer.tsx` | N/A (Browser SpeechSynthesis) | N/A | **IMPLEMENTED** | Synthesizes response into clear spoken English with play/pause and progress scrubbing. |
| **Voice Input Transcription** | Prospective Applicants | `features/phd-rag/components/VoiceInputButton.tsx` | N/A (Web Speech API) | N/A | **IMPLEMENTED** | Voice-to-text dictation with real-time interim results and fallback notice on unsupported browsers. |

---

## 6. Institutional Administration & Configuration Subsystem

| Feature Name | Intended User | Frontend File | Backend Route / Handler | Database Table | Status | Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Governance KPI Executive Overview** | Super Administrators | `admin/pages/AdminDashboardPage.tsx` | `GET /api/admin/status`, `GET /api/admin/modules` | `users`, `roles`, `permissions`, `modules` | **IMPLEMENTED** | Real-time counts of users, active roles, granular permissions, and Veda module deployment states. |
| **Subject Cluster Management** | Super Administrators | `admin/pages/atharva/SubjectClustersPage.tsx` | `GET`, `POST`, `PATCH /api/admin/atharva/subject-clusters` | `nivaran_subject_clusters` | **IMPLEMENTED** | Manages subject clusters and maps dedicated Assistant Deans. |
| **Subject Taxonomy (56 Subjects)** | Super Administrators | `admin/pages/atharva/SubjectsPage.tsx` | `GET`, `POST`, `PATCH, DELETE /.../subjects` | `nivaran_subjects` | **IMPLEMENTED** | Full CRUD for university academic subjects with cluster remapping and dependency conflict checks. |
| **Grievance Cluster Management** | Super Administrators | `admin/pages/atharva/GrievanceClustersPage.tsx` | `GET`, `POST`, `PATCH /.../grievance-clusters` | `nivaran_grievance_clusters` | **IMPLEMENTED** | Manages functional clusters (Academic, Examinations, Financial) and assigns Associate Deans. |
| **Grievance Category & TAT Configuration** | Super Administrators | `admin/pages/atharva/GrievanceCategoriesPage.tsx` | `GET`, `POST`, `PATCH /.../categories` | `nivaran_grievance_categories` | **IMPLEMENTED** | Configures approved grievance categories, default Turn-Around-Time (TAT in days), and priority levels. |
| **Institutional Authority Roster** | Super Administrators | `admin/pages/atharva/AuthoritiesPage.tsx` | `GET`, `POST`, `PATCH /.../authorities` | `nivaran_authorities` | **IMPLEMENTED** | Onboards university officials, assigns designation, and links to user credentials. |
| **Authority Office Transfer** | Super Administrators | `admin/pages/atharva/AuthoritiesPage.tsx` | `POST /.../authorities/{id}/transfer` | `nivaran_authorities`, `audit_logs` | **IMPLEMENTED** | Atomically transfers jurisdiction from an outgoing official to an incoming successor. |
| **Routing Rule Simulation** | Super Administrators | `admin/pages/atharva/GrievanceCategoriesPage.tsx` | `POST /.../routing/simulate` | N/A (Algorithmic test) | **IMPLEMENTED** | Simulates intake parameters (subject + category) to preview the exact authority dispatch chain. |
| **Platform-Wide Audit Log Explorer** | Super Administrators | `admin/pages/atharva/AuditLogsPage.tsx` | `GET /api/admin/audit-logs` | `audit_logs` | **IMPLEMENTED** | Filterable log viewer supporting filtering by module, action, user, date range, and IP address. |

---

## 7. Rig Veda & Yajur Veda Subsystems

| Feature Name | Intended User | Frontend File | Backend Route / Handler | Database Table | Status | Evidence & Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Rig Veda Status & Discovery Boundary** | Academic Researchers | `modules/rig-veda/pages/RigVedaDashboardPage.tsx` | `GET /api/modules/rig-veda/status` | `modules` | **IMPLEMENTED** (Boundary) | Returns architectural status and active service registry contracts. Domain logic planned for Phase 3. |
| **Rig Veda Doctoral Progress Tracking** | Ph.D. Scholars / Guides | `modules/rig-veda/components/RigVedaPlaceholder.tsx` | N/A | None | **UI ONLY** | Visual placeholder outlining upcoming synopsis, coursework, and RAC milestone workflows. |
| **Yajur Veda Status & Admin Boundary** | Research Administrators | `modules/yajur-veda/pages/YajurVedaDashboardPage.tsx` | `GET /api/modules/yajur-veda/status` | `modules` | **IMPLEMENTED** (Boundary) | Returns architectural boundary status. Domain logic planned for Phase 3. |
| **Yajur Veda Grant Sanctioning Portal** | Faculty PIs / Accounts | `modules/yajur-veda/components/YajurVedaPlaceholder.tsx` | N/A | None | **UI ONLY** | Visual placeholder outlining upcoming grant disbursement, ethics approval, and UC tracking. |
