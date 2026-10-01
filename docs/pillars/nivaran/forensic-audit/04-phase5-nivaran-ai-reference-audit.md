# PHASE 5 — STEP 2: NIVARAN-AI REFERENCE IMPLEMENTATION AUDIT
**Classification:** Read-Only Forensic Architecture & Workflow Audit  
**Source Repository:** `C:\Projects\NIVARAN-AI\` (Untouched / Read-Only Reference)  
**Target Migration Module:** `VYASA/frontend/src/modules/atharva-veda/nivaran/` and `VYASA/backend/app/modules/atharva_veda/nivaran/`  
**Current Alembic Head:** `8b29c54e1005` (Preserved — Zero Database Mutations)

---

## 1. NIVARAN-AI Repository Architecture

The reference project `C:\Projects\NIVARAN-AI\` is an independent full-stack implementation structured as follows:

```
C:\Projects\NIVARAN-AI\
├── backend/
│   ├── alembic/                         # 41 database migration versions
│   ├── app/
│   │   ├── ai/                          # ML models (category_classifier.joblib) & TF-IDF pipeline
│   │   ├── api/
│   │   │   ├── auth.py                  # JWT Auth, registration, TOTP MFA, step-up
│   │   │   ├── dependencies.py          # Auth & permission dependencies
│   │   │   └── routes/                  # 19 Route modules (grievances, assignment, etc.)
│   │   ├── core/                        # Settings, security, config, permissions
│   │   ├── db/                          # Engine, sessionmaker, base model
│   │   ├── models/                      # 24 Declarative SQLAlchemy ORM models
│   │   ├── parth/                       # Conversational AI assistant & prompt orchestrator
│   │   ├── schemas/                     # Pydantic schemas for all modules
│   │   ├── services/                    # 21 Core application services
│   │   └── tasks/                       # Celery / background worker tasks
│   ├── keys/                            # RSA-3072 private and public keys
│   ├── storage/                         # Local filesystem upload compartments
│   ├── tests/                           # 51 Dedicated Pytest test suites
│   ├── alembic.ini
│   ├── Dockerfile
│   └── requirements.txt
├── database/                            # Schema dumps and seed SQL scripts
├── docs/                                # Project documentation
├── frontend/
│   ├── src/
│   │   ├── components/                  # Modals, workspaces, cards, forms
│   │   ├── context/                     # AuthContext, NotificationContext
│   │   ├── pages/                       # 30 User & Authority Page components
│   │   ├── services/                    # Axios/Fetch API client wrappers
│   │   ├── styles/                      # Vanilla CSS variable themes
│   │   └── utils/                       # Date, crypto, and status helpers
│   ├── package.json                     # React 19 + Vite 8 setup
│   └── vite.config.js
└── scripts/                             # DB check, seeding, and migration scripts
```

---

## 2. Technology Stack Actually Used

| Domain | Technology | Specification / Version in NIVARAN-AI |
| :--- | :--- | :--- |
| **Backend Language** | Python | `>= 3.10` (`pyproject.toml`, `.python-version`) |
| **API Framework** | FastAPI | `0.115.x` with ASGI `uvicorn` |
| **ORM & DB Adapter** | SQLAlchemy | `2.0.x` with `psycopg2-binary` |
| **Database Migrations** | Alembic | `1.13.x` (41 migration files) |
| **Validation Layer** | Pydantic | `v2.x` (Pydantic-Settings `2.x`) |
| **Digital Signatures** | Cryptography | `RSA-PSS` (3072-bit keys, MGF1 SHA-256) |
| **Two-Factor Auth** | PyOTP | Standard RFC 6238 TOTP |
| **E-File Generation** | ReportLab | Two-pass `NumberedCanvas` PDF engine (`4.x`) |
| **Machine Learning** | Scikit-Learn | `TfidfVectorizer` + `LogisticRegression` pipeline |
| **OCR & Vision** | Google GenAI SDK | `gemini-3.1-flash-lite` |
| **Frontend Runtime** | React 19 | React `19.2.x`, Vite `8.x`, React Router `7.x` |
| **Icons & Design** | Lucide React | Pure CSS design tokens (`index.css`, `index2.css`) |

---

## 3. Complete Feature Inventory (By Actor)

### 3.1 Applicant Features
1. **Authentication & Identity:**
   - Registration with institutional PhD Enrollment/Roll Number.
   - Login with email & password, password reset via email token.
   - Profile view linked to institutional `StudentMasterRecord`.
2. **Grievance Submission:**
   - Form fields: Title, Description, Subject, Category, Confidentiality flag (`is_confidential`).
   - Multimodal OCR assistance: Extracts text and category hints from uploaded documents (PDF/PNG/JPG up to 10MB) via Gemini Flash-Lite.
   - Daily limit restriction: Max 5 submissions per day in `Asia/Kolkata` timezone.
   - Semantic duplicate detection: Hard-blocks active duplicate submissions with HTTP 409 Conflict.
3. **Tracking & Interaction:**
   - Real-time grievance tracking timeline with full state history.
   - Information request responses: Provides replies to administrative queries.
   - Document upload: Adds supplementary evidence.
   - Reopening: Can contest resolved or closed grievances.
   - Feedback & Rating: 1–5 star rating and textual feedback upon case closure.
4. **Conversational Assistant (PARTH):**
   - In-app interactive guidance on CSJMU PhD ordinances and grievance procedures.

### 3.2 Authority Features (Manager, Assistant Dean, Associate Dean, Dean)
1. **Triage Manager (Command Center):**
   - Global grievance queue filtering by status, priority, and date.
   - Category review & override (`category_reviewed`, `category_overridden`).
   - Initial assignment: Routes grievance to Subject Assistant Dean.
   - Direct resolution or closure for administrative cases.
2. **Assistant Dean (Subject Specialist):**
   - Subject-cluster queue inspection.
   - Direct resolution of `SUBJECT_ASSISTANT_DEAN` categories.
   - Forwarding workflow with 6-point confirmation checklist and 3 justifications.
   - Clarification requests to applicant (`AWAITING_INFORMATION`).
   - Committee creation requests to Dean.
3. **Associate Dean (Cluster Head):**
   - Grievance cluster queue inspection.
   - Resolution of escalated or cluster grievances.
   - Approval of lower-authority recommendations.
   - Constitution of inquiry committees.
4. **Dean (Executive Authority):**
   - Executive dashboard with full institutional analytics.
   - Committee chartering and guest member invitations.
   - Dean Reopen Review adjudication (Cycle-2 contestation review).
   - Higher-authority approval ratification.
   - Asymmetric digital signature execution (RSA-PSS SHA-256).

### 3.3 Committee Features
1. **Charter & Composition:** Chair, Members, Secretary, Observers, and Guest Members.
2. **Deliberations:** Real-time messages with internal/public visibility and WebSocket sync.
3. **Hearings:** Scheduled internal meetings and applicant hearings with Google Meet sync.
4. **Democratic Voting Engine:**
   - Formal polls with quorum thresholds.
   - Policies: `SIMPLE_MAJORITY`, `TWO_THIRDS`, `UNANIMOUS`.
   - Recorded ballots and sealed `CommitteeDecisionRecord`.
5. **Final Recommendation:** Draft and finalized recommendations submitted to Dean.

---

## 4. Actual Routing Logic Implementation

The actual routing implementation is located in `backend/app/services/authority_routing.py`:

```
Incoming Grievance
  │
  ├── 1. Subject Resolution:
  │      grievance.subject_id -> Subject -> SubjectCluster -> Assistant Dean (UserRole.ASSISTANT_DEAN)
  │      Fallback: Cluster 1 Assistant Dean, or first active Assistant Dean in alphabetical order.
  │
  └── 2. Category Routing Type Resolution:
         grievance.final_category_id -> Category -> routing_type:
           ├── A. SUBJECT_ASSISTANT_DEAN:
           │      Resolved directly by Subject Assistant Dean (Terminal step, no forwarding).
           ├── B. GRIEVANCE_CLUSTER:
           │      Category -> GrievanceCluster -> Associate Dean (UserRole.ASSOCIATE_DEAN).
           │      Fallback: Cluster 1 Associate Dean (Dr. Arun Kumar Gupta).
           └── C. FIXED_AUTHORITY:
                  Category.fixed_authority_id -> Specific configured User.
```

### Routing Progression:
- **Manager Review:** Routes `SUBMITTED` $\rightarrow$ `get_expected_assistant_dean(db, grievance)`.
- **Assistant Dean Forwarding:** Calls `get_expected_forward_target(db, grievance)`, which dispatches to Associate Dean (if `GRIEVANCE_CLUSTER`) or Fixed Authority (if `FIXED_AUTHORITY`).
- **Terminal States:** When the grievance reaches its mapped Associate Dean or Fixed Authority, `get_next_authority_for_grievance` returns `None`.

---

## 5. Grievance State Machine & Lifecycle Table

Authoritative states defined in `backend/app/models/enums.py` (`GrievanceStatus`) and enforced by `backend/app/services/grievance_workflow.py` (`ALLOWED_TRANSITIONS`):

| Current Status | Allowed Next Statuses | Primary Actors | Trigger Conditions & Side Effects |
| :--- | :--- | :--- | :--- |
| `SUBMITTED` | `AI_PROCESSING` | System | Auto-triggered after initial filing. |
| `AI_PROCESSING`| `PENDING_REVIEW` | System | TF-IDF classification and duplicate check complete. |
| `PENDING_REVIEW`| `ASSIGNED`, `IN_PROGRESS`, `AWAITING_INFORMATION`, `RESOLVED`, `ESCALATED` | Manager | Initial assignment to Subject Assistant Dean; records `Assignment` and `AuditLog`. |
| `ASSIGNED` | `IN_PROGRESS`, `AWAITING_INFORMATION`, `RESOLVED`, `ESCALATED` | Assigned Authority | Authority acknowledges case or initiates investigation. |
| `IN_PROGRESS` | `ASSIGNED`, `AWAITING_INFORMATION`, `RESOLVED`, `ESCALATED` | Assigned Authority | Forwarded to next authority (with 6+3 checklist) or escalated. |
| `AWAITING_INFORMATION` | `ASSIGNED`, `IN_PROGRESS`, `ESCALATED`, `PENDING_REVIEW`, `RESOLVED` | Applicant / Authority | Set when information is requested; returns to active review upon reply. |
| `ESCALATED` | `ASSIGNED`, `IN_PROGRESS`, `AWAITING_INFORMATION`, `RESOLVED` | Associate Dean / Dean | Inactivity trigger (>72 hours) or manual escalation. |
| `RESOLVED` | `CLOSED`, `REOPENED`, `IN_PROGRESS` | Authority / Dean | Resolution notes recorded; triggers E-File compilation. |
| `CLOSED` | `REOPENED` | Manager / Dean | Case finalized; can be contested by applicant into Cycle-2. |
| `REOPENED` | `PENDING_REVIEW`, `ASSIGNED`, `IN_PROGRESS`, `ESCALATED`, `RESOLVED` | Dean / Manager | Cycle-1 data preserved in `previous_*` fields; enters Dean Reopen Review. |

---

## 6. Forwarding Workflow (6 Checkboxes & 3 Justifications)

Implemented in `backend/app/models/forwarding_confirmation.py` and enforced in `backend/app/api/routes/assignment.py`:

### The 6 Mandatory Checkboxes (All must be `True`):
1. `reviewed_details`: *"I have reviewed the complete grievance details."*
2. `reviewed_documents`: *"I have reviewed the relevant documents and evidence."*
3. `understands_status`: *"I understand the grievance and its current status."*
4. `action_taken_within_authority`: *"I have taken the appropriate action within my authority."*
5. `forwarding_necessary`: *"Forwarding to the next authority is necessary."*
6. `accepts_accountability`: *"I accept accountability for forwarding this grievance."*

### The 3 Mandatory Text Fields (Min 5 characters each):
1. `forwarding_reason`: Text explaining why the case is forwarded.
2. `action_taken`: Concrete steps already taken within current authority.
3. `why_higher_intervention_required`: Specific justification for escalation/higher intervention.

**Operational Rule:** Forwarding is strictly blocked if an `ApprovalRequest` is pending or returned for revision on the grievance.

---

## 7. Document, E-File & Digital Signature Workflows

### 7.1 Digital Signatures (`backend/app/services/signature_service.py`):
1. **Challenge Protocol:** Authority requests signing authorization via `POST /api/v1/signatures/authorize` with a 6-digit TOTP code and payload.
2. **Binding:** Backend generates a `SigningAuthorizationChallenge` (valid 5 minutes) containing `SHA256(canonical_json(payload))`.
3. **Execution:** Authority posts challenge ID and payload to `POST /api/v1/signatures/sign`.
4. **Signature:** Signs with RSA-3072 / PSS / MGF1 SHA-256. Produces Base64 signature stored in `digital_signatures` table.

### 7.2 E-File Dossier Compilation (`backend/app/services/efile_service.py`):
1. Compiles a 15-section JSONB snapshot (`applicant`, `grievance`, `history`, `assignments`, `documents`, `clarifications`, `committees`, `deliberations`, `polls`, `decisions`, `approvals`, `signatures`).
2. Synthesizes sequential E-File number: `NVR/EF/{YYYY}/{SEQUENCE:06d}`.
3. Generates two-pass ReportLab PDF with CSJMU crimson (`#5B1021`) and gold (`#D4AF37`) palette.
4. Calculates `SHA-256` checksum of the PDF binary and records it in `efiles.pdf_hash`.
5. Confidential cases require step-up TOTP token (`POST /api/v1/auth/verify-step-up`, 15-minute validity) to stream PDF.

---

## 8. Committee & Deliberation Engine

Defined across `backend/app/models/committee.py` and `meeting.py`:
- **Chartering:** `CommitteeCreationRequest` $\rightarrow$ Dean approval $\rightarrow$ `GrievanceCommittee`.
- **Members:** `CommitteeMember` with roles `CHAIRPERSON`, `MEMBER`, `OBSERVER`.
- **Deliberation:** Real-time messages via `committee_messages` and WebSocket `GET /api/v1/committees/{id}/ws`.
- **Democratic Voting:** `committee_polls` supporting:
  - `SIMPLE_MAJORITY` ($> 50\%$ votes cast)
  - `TWO_THIRDS` ($\ge 66.7\%$ eligible members)
  - `UNANIMOUS` ($100\%$ eligible, 0 reject)
  - Decisions sealed in `committee_decision_records`.
- **Hearings:** Scheduled in `committee_meetings` with attendee tracking and Google Meet URL integration.

---

## 9. Database Mapping Table: NIVARAN-AI vs VYASA Phase 4

| NIVARAN-AI Table | VYASA Phase 4 Table (`nivaran_*`) | Status | Mapping Notes |
| :--- | :--- | :--- | :--- |
| `users` (authorities) | `core.users` + `nivaran_authorities` | **MATCH** | Reconciled via Core RBAC and Authority bridge. |
| `student_master_records` | `nivaran_student_master_records` | **MATCH** | Identical columns, constraints, and relationships. |
| `subjects` | `nivaran_subjects` | **MATCH** | Subject definitions and clusters mapped. |
| `subject_clusters` | `nivaran_subject_clusters` | **MATCH** | Assistant Dean assignment links mapped. |
| `categories` | `nivaran_categories` | **MATCH** | Routing types (`GRIEVANCE_CLUSTER`, etc.) mapped. |
| `grievance_clusters` | `nivaran_grievance_clusters` | **MATCH** | Associate Dean assignment links mapped. |
| `grievances` | `nivaran_grievances` | **MATCH** | Full column set including Cycle-1 preservation. |
| `grievance_status_history`| `nivaran_grievance_status_history` | **MATCH** | Actor types and transition reasons preserved. |
| `comments` | `nivaran_comments` | **MATCH** | Internal/external notes mapped. |
| `grievance_feedback` | `nivaran_grievance_feedback` | **MATCH** | 5-star rating and satisfaction metrics mapped. |
| `assignments` | `nivaran_assignments` | **MATCH** | Active assignment tracking preserved. |
| `forwarding_confirmations`| `nivaran_forwarding_confirmations` | **MATCH** | 6 checkboxes + 3 justification fields mapped. |
| `escalations` | `nivaran_escalations` | **MATCH** | 72-hour automated and manual escalation logs. |
| `documents` | `nivaran_documents` | **MATCH** | Metadata, paths, and byte sizes preserved. |
| `document_requests` | `nivaran_document_requests` | **MATCH** | Clarification requests to applicants mapped. |
| `committee_creation_requests`| `nivaran_committee_creation_requests` | **MATCH** | Manager request $\rightarrow$ Dean charter flow mapped. |
| `grievance_committees` | `nivaran_grievance_committees` | **MATCH** | Committee entities and lifecycles mapped. |
| `committee_members` | `nivaran_committee_members` | **MATCH** | Membership roles and joins mapped. |
| `committee_member_recommendations`| `nivaran_committee_member_recommendations` | **MATCH** | Individual member recommendations mapped. |
| `committee_final_recommendations` | `nivaran_committee_final_recommendations` | **MATCH** | Sealed committee reports mapped. |
| `committee_messages` | `nivaran_committee_messages` | **MATCH** | Deliberation audit trails mapped. |
| `committee_polls` | `nivaran_committee_polls` | **MATCH** | Voting policies and quorum thresholds mapped. |
| `committee_poll_options`| `nivaran_committee_poll_options` | **MATCH** | Ballot options mapped. |
| `committee_poll_voters` | `nivaran_committee_poll_voters` | **MATCH** | Eligible voter rosters mapped. |
| `committee_poll_votes` | `nivaran_committee_poll_votes` | **MATCH** | Recorded ballots mapped. |
| `committee_decision_records`| `nivaran_committee_decision_records` | **MATCH** | Sealed decision certificates mapped. |
| `committee_meetings` | `nivaran_committee_meetings` | **MATCH** | Scheduled hearing logs mapped. |
| `committee_meeting_attendees`| `nivaran_committee_meeting_participants`| **MATCH** | Attendee confirmations mapped. |
| `dean_reopen_reviews` | `nivaran_dean_reopen_reviews` | **MATCH** | Cycle-2 Dean interrogation mapped. |
| `signing_keys` | `nivaran_signing_key_versions` | **MATCH** | Asymmetric key metadata mapped. |
| `signing_challenges` | `nivaran_signing_challenges` | **MATCH** | Ephemeral TOTP signing challenges mapped. |
| `digital_signatures` | `nivaran_digital_signatures` | **MATCH** | RSA-PSS SHA-256 signatures mapped. |
| `efiles` | `nivaran_efiles` | **MATCH** | 15-section JSONB snapshots & PDF hashes mapped. |
| `efile_documents` | `nivaran_efile_documents` | **MATCH** | Dossier component links mapped. |
| `approval_requests` | `nivaran_approval_requests` | **MATCH** | Higher-authority approval requests mapped. |
| `approval_actions` | `nivaran_approval_actions` | **MATCH** | Approval lifecycle action trails mapped. |
| `ai_processing_records` | `nivaran_ai_processing_records` | **MATCH** | Inference scores and metadata mapped. |
| `clusters` | `nivaran_clusters` | **MATCH** | Semantic clustering logs mapped. |

*Verdict:* All 38 relational entities from NIVARAN-AI have exact corresponding tables in VYASA Phase 4 under the unified `nivaran_*` database schema.

---

## 10. Gap Analysis & Migration Strategy

### 10.1 Already Covered in VYASA (Phase 4):
- Complete 38-table relational database schema (`8b29c54e1005`).
- Core User & Applicant Profile authentication foundation.
- Centralized RBAC (`roles`, `permissions`, `user_roles`, `role_permissions`).
- Routing engine core (`Subject` $\rightarrow$ `SubjectCluster` $\rightarrow$ `Assistant Dean`; `Category` $\rightarrow$ `GrievanceCluster` $\rightarrow$ `Associate Dean`).
- Admin configuration service for Atharva Veda taxonomies.

### 10.2 Features Requiring Workflow Migration in Phase 5 Step 3:
1. **Applicant Submission & Verification:** Daily 5/day limit check, semantic duplicate blocker (cosine similarity $\ge 0.85$), and Gemini Flash-Lite OCR pre-fill helper.
2. **Authority Workflows:** Manager Triage command center, Assistant Dean / Associate Dean queues, and the 6+3 forwarding workflow.
3. **Clarifications & Document Requests:** Official queries to applicants and evidence uploading.
4. **Higher Authority Approvals:** Formal approval request and action workflow.
5. **Special Committees:** Deliberation, voting engine, and hearing scheduling.
6. **Digital Signatures & E-Files:** TOTP challenge authorization, RSA-PSS SHA-256 signing, and ReportLab dossier PDF assembly.
7. **Dean Reopen Review:** Cycle-2 contestation handling and authority interrogation.

---

## 11. Recommended Migration Sequence (Phase 5 Step 3)

1. **Step 3.1: Core Grievance Filing & Intake Services**
   - Port `submission_restriction_service.py` (quota & dedup) and `ocr_service.py` into `VYASA/backend/app/modules/atharva_veda/nivaran/services/`.
   - Implement `POST /api/v1/atharva/grievances/` and `GET /api/v1/atharva/grievances/me`.
2. **Step 3.2: Authority Triage & Forwarding Engine**
   - Port `assignment.py` and `forwarding_confirmation` endpoints into Atharva router.
   - Wire the 6-checkbox and 3-justification validation rules.
3. **Step 3.3: Approval & Document Management**
   - Port `approval.py` and `document_request_service.py`.
4. **Step 3.4: Special Committees & Deliberations**
   - Port committee lifecycle, voting engine, and meeting scheduling.
5. **Step 3.5: Cryptographic Sealing & E-File Generation**
   - Port `signature_service.py` and `efile_pdf_generator.py`.
6. **Step 3.6: Dean Reopen & Resolution Sealing**
   - Port Cycle-2 `dean_reopen_service.py`.
7. **Step 3.7: Frontend Module Integration**
   - Build out Atharva Veda / NIVARAN applicant and authority views in `VYASA/frontend/src/modules/atharva-veda/nivaran/`.
