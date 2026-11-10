# ATHARVA VEDA &bull; NIVARAN-AI SUB-ECOSYSTEM AUDIT

**Domain:** Grievance Redressal, Statutory Committees & Institutional Well-Being  
**Subsystem Code:** `atharva_veda.nivaran`  
**Current Audit Date:** November 7, 2026  
**Implementation Classification:** **IMPLEMENTED (CORE OPERATIONAL)**  

---

## 1. Subsystem Overview & Institutional Mandate

Atharva Veda (specifically the **NIVARAN-AI** subsystem) constitutes the core operational pillar of the VYASA-N ecosystem. It automates and governs the entire lifecycle of student, scholar, and faculty grievances at CSJMU. The module enforces rigid statutory hierarchies, eliminates informal paper delays, introduces machine-learning triage, charters formal inquiry panels with cryptographic voting, and seals completed cases into tamper-proof electronic dossiers (e-Files).

---

## 2. Key Functional Workspaces & Features

### 1. Applicant Intake & Multimodal OCR
- **Frontend Page:** [`GrievanceSubmitPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/GrievanceSubmitPage.tsx)
- **Backend Endpoints:** `POST /grievances`, `POST /grievances/ocr/extract`, `POST /grievances/{id}/documents`
- **Features:**
  - Multi-step submission wizard selecting from 56 academic subjects and approved complaint categories.
  - Automatic quota limit enforcement (maximum 3 active grievances per scholar).
  - Duplicate intake detection based on cosine similarity of existing case descriptions.
  - Multimodal affidavit parsing: Students upload PDF/image evidence; Gemini OCR (`gemini-2.0-flash-lite`) extracts text and pre-fills complaint narratives.

### 2. Case Manager Intake Triage & Machine Learning Assistance
- **Frontend Pages:** [`ManagerTriageQueuePage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/ManagerTriageQueuePage.tsx), [`ManagerGrievanceReviewPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/ManagerGrievanceReviewPage.tsx)
- **Backend Endpoints:** `GET /manager/queue`, `PATCH /grievances/{id}/ai-review`, `POST /manager/grievances/{id}/review`
- **Features:**
  - Machine learning classification pipeline using an embedded scikit-learn model (`category_classifier.joblib`).
  - System presents the predicted category and confidence percentage. Case Manager reviews and confirms or overrides.
  - Automatic SLA calculation based on approved Turn-Around-Time (TAT in days).
  - Dynamic routing algorithm dispatches the case directly into the docket of the Assistant Dean assigned to that subject cluster.

### 3. Assistant Dean Jurisdictional Case Queue
- **Frontend Pages:** [`AssistantDeanDashboardPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/AssistantDeanDashboardPage.tsx), [`AssistantDeanGrievanceDetailPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/AssistantDeanGrievanceDetailPage.tsx)
- **Backend Endpoints:** `GET /assistant-dean/queue`, `POST /assistant-dean/grievances/{id}/resolve`, `POST /assistant-dean/grievances/{id}/document-requests`, `POST /assistant-dean/grievances/{id}/forward`, `POST /committees/requests/{id}`
- **Features:**
  - Scoped strictly to grievances filed within the Assistant Dean's assigned subjects.
  - Evidentiary Request Tool: Prompts student for additional documents, placing the case in `AWAITING_DOCUMENT` and pausing the SLA timer.
  - Committee Petitioning: If an inquiry panel is needed, Assistant Dean submits a formal petition with proposed members to the Associate Dean or Dean. Direct chartering is blocked.

### 4. Associate Dean Functional Cluster Queue
- **Frontend Pages:** [`AssociateDeanDashboardPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/AssociateDeanDashboardPage.tsx), [`AssociateDeanGrievanceDetailPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/AssociateDeanGrievanceDetailPage.tsx)
- **Backend Endpoints:** `GET /associate-dean/dashboard`, `POST /associate-dean/grievances/{id}/resolve`, `POST /associate-dean/grievances/{id}/escalate`, `POST /committees/requests/{id}/review`, `POST /committees/direct`
- **Features:**
  - Oversees functional clusters (Academic Affairs, Examinations, Fees/Finance).
  - Reviews Assistant Dean committee petitions (Approve, Reject, Request Clarification).
  - Direct chartering authority for departmental inquiry committees.

### 5. Statutory Committee Management Workspace
- **Frontend Pages:** [`CommitteesListPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/CommitteesListPage.tsx), [`CommitteeWorkspacePage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx)
- **Backend Endpoints:** 28 dedicated routes under `/committees/*`
- **Features:**
  - 8-Tab dedicated workspace: Overview, Members & Responsibilities, Real-Time Chat, Documents & Evidence, Polls & Voting, Meetings, Formal Decisions, and History.
  - Real-time in-camera WebSocket deliberation with fallback to REST.
  - Formal Consensus Voting: Simple Majority, Two-Thirds, Unanimous. Each cast ballot generates an immutable SHA-256 vote hash.
  - Google Meet Hearing Scheduler: Creates Google Calendar events and Meet links via Google Calendar API with mock fallbacks.
  - Minutes & Resolutions: Committee Chair formalizes findings and resolution text, attaching them to the parent grievance.

### 6. Dean Executive Command Center
- **Frontend Page:** [`DeanExecutiveDashboardPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/DeanExecutiveDashboardPage.tsx)
- **Backend Endpoints:** `GET /dean/dashboard`, `GET /dean/cases`, `POST /grievances/{id}/reopen`
- **Features:**
  - Panoramic university-wide case ledger.
  - Real-time SLA breach countdowns and high-priority escalation alerts.
  - Workload distribution matrix across all Assistant Deans, Associate Deans, and Case Managers.
  - Sole statutory authority empowered to issue formal case reopening orders.

### 7. Manager Closure Queue & Cryptographic E-Files
- **Frontend Pages:** [`ManagerClosureQueuePage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/ManagerClosureQueuePage.tsx), [`NivaranEFilesPage.tsx`](file:///c:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/NivaranEFilesPage.tsx)
- **Backend Endpoints:** `POST /manager/grievances/{id}/finalize-closure`, `GET /e-files`, `GET /e-files/{id}/verify`
- **Features:**
  - Verifies compliance with authority resolutions.
  - Triggers automated dossier generation via ReportLab (`efile_pdf_generator.py`).
  - Computes SHA-256 integrity hash of the final PDF dossier.
  - Updates longitudinal Student Master Record (SMR) and unlocks applicant satisfaction rating form.

---

## 3. Discovered Vulnerabilities & Known Limitations

1. **WebSocket URL Mismatch (P0 - Critical):**
   - In `CommitteeWorkspacePage.tsx` line 134, client uses `/api/v1/modules/atharva-veda/nivaran/committees/{id}/ws`.
   - Backend mounts route at `/api/modules/atharva-veda/nivaran/committees/{id}/ws`.
   - *Remediation:* Update line 134 to omit `/v1`.
2. **In-Memory WebSocket Concurrency (P1 - High):**
   - Active sockets stored in in-memory dictionary. Multi-worker scaling requires Redis Pub/Sub backplane.
3. **Local Upload Default (P1 - High):**
   - Storage defaults to local disk; must ensure `STORAGE_PROVIDER=spaces` is enforced in production.
