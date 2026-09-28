# STATUS: SCHEMA FROZEN FOR IMPLEMENTATION

# VYASA-NIVARAN Database Specification Freeze

> **Specification Authority**: Ecosystem Architecture Board & Lead System Architect  
> **Target Subsystem**: `apps/pillars/nivaran/backend`  
> **Source Ground Truth**: `docs/pillars/nivaran/database-architecture.md`  
> **Reconciled Visualization**: `docs/pillars/nivaran/database-entity-map.md`  
> **Audit Certification**: Forensic audit against running system at `C:\Projects\NIVARAN-AI\`  
> **Database Engine Target**: PostgreSQL 16+ (Dedicated database instance / Neon connection pool)  
> **Final Status**: FROZEN — Implementation Ready (No further schema modifications permitted without formal RFC)

---

## 1. Final Architecture Decision

The VYASA-NIVARAN pillar database is an **independent, bounded domain database** dedicated strictly to grievance management, academic dispute arbitration, committee deliberations, and evidentiary case files.

**Core Architectural Tenets**:
1. **Decoupled Identity**: VYASA Core owns platform identity, credentials, sessions, TOTP secrets, and platform-level authentication. NIVARAN stores zero credentials and authenticates callers via validated JWT claims issued by VYASA Core.
2. **Domain Authority Boundary**: NIVARAN defines domain-specific authority profiles (`nivaran_authorities`) linked 1:1 to VYASA users via `vyasa_user_id: UUID UNIQUE`.
3. **No Cross-Database Foreign Keys**: References between VYASA Core (`users.id`) and NIVARAN (`applicant_vyasa_user_id`, `recipient_vyasa_user_id`, `vyasa_user_id`) are stored as raw `UUID` types without physical database-level foreign key constraints.
4. **Complete Preservation of Institutional Governance**: The 10 Academic Subject Clusters, 3 Grievance Clusters, 3 Category Routing types, 6-checkbox forwarding contract, 13-table committee deliberation & voting subsystem, polymorphic RSA-PSS digital signatures, and Dean Reopen Review are preserved identically from CSJMU's operational governance model.

---

## 2. Database Ownership Boundary

```
+========================================================================================================+
|                                  VYASA CORE PLATFORM BOUNDARY                                          |
+========================================================================================================+
|  Owned Capabilities:                                                                                  |
|  - User registration, authentication, login rate-limiting, and password hashing (Argon2id/bcrypt)       |
|  - JWT access & refresh token issuance and revocation                                                  |
|  - Multi-Factor Authentication (MFA / TOTP) seed storage and challenge verification                    |
|  - Core system user roles ('applicant', 'authority', 'administrator')                                 |
|  - Ecosystem pillar registry and inter-service telemetry                                               |
|  - Platform notification engine (WebSockets, transactional email, SMS gateways)                        |
+========================================================================================================+
                                                    |
                                                    | Authenticated JWT + UUID References
                                                    v
+========================================================================================================+
|                                    NIVARAN PILLAR BOUNDARY                                             |
+========================================================================================================+
|  Owned Capabilities:                                                                                  |
|  - Authority profiles & designations ('MANAGER', 'ASSISTANT_DEAN', 'ASSOCIATE_DEAN', 'DEAN', 'GUEST')  |
|  - Academic taxonomy (10 Subject Clusters, 55 Subjects)                                                |
|  - Grievance categories and institutional routing matrices                                             |
|  - Master grievance lifecycle (10-state machine, cycle history)                                        |
|  - Assignment chains & 6-checkbox / 3-justification forwarding accountability                          |
|  - Case documents & formal document request workflows                                                 |
|  - 13-table committee inquiry subsystem (polls, voters, secret ballots, sealed decision records)       |
|  - High-stakes Dean approval workflows (`approval_requests`, `approval_actions`)                       |
|  - Polymorphic RSA-PSS-SHA256 digital signature ledger & single-use authorization challenges           |
|  - E-File dossier compilation (ReportLab PDFs, SHA-256 checksums, document binding)                   |
|  - Dean reopen review adjudication                                                                     |
|  - AI classification prediction logs & unsupervised semantic cluster models                            |
|  - Transactional notification outbox (relayed asynchronously to VYASA Core)                            |
+========================================================================================================+
```

---

## 3. Final 40-Table Registry

The frozen database specification consists of **exactly 40 relational tables** organized into 8 functional domains:

| # | Table Name | Domain | Primary Responsibility |
|---|---|---|---|
| **1** | `nivaran_authorities` | Domain 1: Authority & Taxonomy | Domain governance profiles linked 1:1 to `vyasa_user_id`. |
| **2** | `subject_clusters` | Domain 1: Authority & Taxonomy | 10 Academic clusters, `cluster_number INT UNIQUE`, 1:1 Asst Dean. |
| **3** | `subjects` | Domain 1: Authority & Taxonomy | 55 Academic subjects mapped 1:many to `subject_clusters`. |
| **4** | `grievance_clusters` | Domain 1: Authority & Taxonomy | 3 Grievance clusters, `cluster_number INT UNIQUE`, 1:1 Assoc Dean. |
| **5** | `categories` | Domain 1: Authority & Taxonomy | Grievance categories with 3 routing types (`GRIEVANCE_CLUSTER`, `SUBJECT_ASSISTANT_DEAN`, `FIXED_AUTHORITY`). |
| **6** | `student_master_records` | Domain 2: Case Management | Immutable student registration, enrollment, and affiliation snapshots. |
| **7** | `grievances` | Domain 2: Case Management | Central case management record, 10-state lifecycle, cycle tracking. |
| **8** | `grievance_status_history`| Domain 2: Case Management | Append-only status transition ledger with `USER`/`SYSTEM` actor attribution. |
| **9** | `comments` | Domain 2: Case Management | Internal case notes and official applicant-visible remarks. |
| **10**| `grievance_feedback` | Domain 2: Case Management | Post-resolution applicant ratings (quality, time, overall 1..5) & remarks. |
| **11**| `assignments` | Domain 3: Routing & Accountability | Historical and active grievance ownership tracking. |
| **12**| `forwarding_confirmations`| Domain 3: Routing & Accountability | 6 mandatory boolean confirmations + 3 textual justifications. |
| **13**| `escalations` | Domain 3: Routing & Accountability | Role-to-role escalation ledger from Manager/Asst/Assoc to Dean. |
| **14**| `documents` | Domain 4: Document Management | Uploaded case files, storage paths, MIME types, and SHA-256 hashes. |
| **15**| `document_requests` | Domain 4: Document Management | Formal authority requests for additional applicant evidence. |
| **16**| `committee_creation_requests` | Domain 5: Committee Subsystem | Formal requests to charter an inquiry or hearing committee. |
| **17**| `grievance_committees` | Domain 5: Committee Subsystem | Committee container (2–10 members, chairperson, active/dissolved status). |
| **18**| `committee_members` | Domain 5: Committee Subsystem | Internal & Guest member roster (`CHAIRPERSON`, `MEMBER`, `OBSERVER`). |
| **19**| `committee_member_recommendations` | Domain 5: Committee Subsystem | Individual member evaluations, dissenting notes, and recommendations. |
| **20**| `committee_final_recommendations` | Domain 5: Committee Subsystem | Consolidated Chairperson findings, executive summary, and dissent report. |
| **21**| `committee_messages` | Domain 5: Committee Subsystem | Real-time in-camera deliberation chat log (`MESSAGE` / `SYSTEM`). |
| **22**| `committee_polls` | Domain 5: Committee Subsystem | Formal ballot sessions with voting policy & quorum percentage. |
| **23**| `committee_poll_options` | Domain 5: Committee Subsystem | Selectable ballot choices for a committee poll. |
| **24**| `committee_poll_voters` | Domain 5: Committee Subsystem | Frozen snapshot of eligible committee voters at poll launch. |
| **25**| `committee_poll_votes` | Domain 5: Committee Subsystem | Individual secret ballots cast with rationale and timestamp. |
| **26**| `committee_decision_records` | Domain 5: Committee Subsystem | Sealed, certified mathematical outcome of committee polls. |
| **27**| `committee_meetings` | Domain 5: Committee Subsystem | Virtual/hybrid meeting schedules (`INTERNAL_COMMITTEE` / `APPLICANT_HEARING`). |
| **28**| `committee_meeting_participants` | Domain 5: Committee Subsystem | Attendance registry and participant logs for hearings. |
| **29**| `dean_reopen_reviews` | Domain 6: Dispute Arbitration | Single-chance Dean adjudication with 4 audited decision types. |
| **30**| `signing_key_versions` | Domain 7: Cryptographic Signing | Institutional RSA-3072 key lifecycle (`ACTIVE`, `RETIRED`, `REVOKED`). |
| **31**| `signing_authorization_challenges` | Domain 7: Cryptographic Signing | Single-use 5-minute cryptographic challenges verified via Step-Up TOTP. |
| **32**| `digital_signatures` | Domain 7: Cryptographic Signing | Polymorphic RSA-PSS-SHA256 non-repudiation signature ledger. |
| **33**| `efiles` | Domain 7: Cryptographic Signing | Consolidated case dossiers: ReportLab PDF, checksum, sealed status. |
| **34**| `efile_documents` | Domain 7: Cryptographic Signing | Explicit junction binding document versions & hashes into E-Files. |
| **35**| `approval_requests` | Domain 7: Cryptographic Signing | Formal authority requests for Dean executive approval. |
| **36**| `approval_actions` | Domain 7: Cryptographic Signing | Step-by-step approval/rejection action history and context. |
| **37**| `ai_processing_records` | Domain 8: Platform Eventing & AI | Machine learning inference logs, category predictions, and confidence. |
| **38**| `grievance_notification_outbox` | Domain 8: Platform Eventing & AI | Transactional Outbox staging events for asynchronous relay to Core. |
| **39**| `audit_logs` | Domain 8: Platform Eventing & AI | System-wide immutable security, data access, and IP audit trail. |
| **40**| `clusters` | Domain 8: Platform Eventing & AI | Unsupervised semantic clustering models and discovered topic clusters. |

---

## 4. Removed Unsupported Entities

The following **15 entities** identified during previous drafts are **strictly rejected and excluded** from the frozen schema:

1. `authority_hierarchies`: Rejected. Administrative escalation hierarchy is deterministic in code (`MANAGER` $\rightarrow$ `ASSISTANT_DEAN` $\rightarrow$ `ASSOCIATE_DEAN` $\rightarrow$ `DEAN`).
2. `authority_delegations`: Rejected. Dynamic authority delegation is not supported by current institutional policy.
3. `grievance_versions`: Rejected. Redundant data duplication; version history is fully captured by `grievance_status_history` and `audit_logs`.
4. `sla_configurations`: Rejected. SLA risk ($> 4$ days) and overdue aging ($\ge 7$ days) are computed dynamically in application service logic.
5. `committee_guest_tokens`: Rejected. Guest Members must possess persistent identities in VYASA Core and profiles in `nivaran_authorities`. Bearer tokens violate auditability.
6. `committee_voting_policies`: Rejected. Voting policies (`SIMPLE_MAJORITY`, `TWO_THIRDS`, `UNANIMOUS`) are enumerated directly on `committee_polls`.
7. `vote_reminders`: Rejected. Handled via background task workers, not persistent relational tables.
8. `hearings`: Rejected. Handled directly via `committee_meetings` with `meeting_type = 'APPLICANT_HEARING'`.
9. `hearing_attendees`: Rejected. Handled directly via `committee_meeting_participants`.
10. `hearing_feedbacks`: Rejected. Handled directly via `committee_meetings.hearing_notes`.
11. `hearing_recordings`: Rejected. Media storage outside approved E-File dossier scope.
12. `feedback_appeals`: Rejected. No institutional appeals process exists for applicant feedback ratings.
13. `feedback_moderations`: Rejected. No administrative feedback redaction/moderation workflow exists.
14. `external_dispatch_events`: Rejected. External dispatch (SMS, email, WebSockets) is owned entirely by VYASA Core.
15. `system_health_metrics`: Rejected. Operational telemetry belongs in Prometheus/logging agents, not the business database.

---

## 5. Identity Mapping Model

- **Applicants**: Students authenticate with VYASA Core. When filing a grievance, `grievances.applicant_vyasa_user_id` stores the applicant's `users.id` UUID. No applicant profile row is stored in `nivaran_authorities`.
- **Authorities**: University officials authenticate with VYASA Core. Each official holding a NIVARAN role has a corresponding row in `nivaran_authorities` where `vyasa_user_id` is a `UNIQUE` foreign reference to VYASA Core's `users.id`.
- **Display Snapshotting**: To preserve historical non-repudiation even if a user's name or email changes in VYASA Core, `nivaran_authorities` snapshots `name_snapshot` and `email_snapshot` at provisioning.

---

## 6. Authority Roles (`NivaranRole`)

```sql
CREATE TYPE nivaran_role AS ENUM (
    'MANAGER',
    'ASSISTANT_DEAN',
    'ASSOCIATE_DEAN',
    'DEAN',
    'GUEST_MEMBER'
);
```

- `MANAGER`: Triage, AI category review & override, initial assignment, closure verification, E-file compilation.
- `ASSISTANT_DEAN`: Subject-cluster investigation, document requests, resolution with digital signature, terminal handling for `SUBJECT_ASSISTANT_DEAN` categories, committee creation requests.
- `ASSOCIATE_DEAN`: Grievance-cluster investigation, committee constitution & approval, Dean escalation, approval requests.
- `DEAN`: Apex executive authority, final appeals, committee dissolution, single-chance reopen review adjudication, E-file sealing.
- `GUEST_MEMBER`: Committee-scoped external expert. Full voting rights in assigned committee; zero access to general dashboards or case resolution.

---

## 7. Subject Cluster Model (10 Academic Clusters)

- Table: `subject_clusters`
- Invariant: `cluster_number INTEGER NOT NULL UNIQUE CHECK (cluster_number BETWEEN 1 AND 10)`
- Invariant: `assistant_dean_id UUID NOT NULL UNIQUE REFERENCES nivaran_authorities(id)`
- Child Table: `subjects` (55 Subjects, each with `subject_cluster_id UUID NOT NULL REFERENCES subject_clusters(id)`)

---

## 8. Grievance Cluster Model (3 Grievance Clusters)

- Table: `grievance_clusters`
- Invariant: `cluster_number INTEGER NOT NULL UNIQUE CHECK (cluster_number BETWEEN 1 AND 3)`
- Invariant: `associate_dean_id UUID NOT NULL UNIQUE REFERENCES nivaran_authorities(id)`
- Academic Scopes:
  - **Cluster 1**: PhD Pre-Registration, Synopsis, RAC Allocation, Supervisor Allocation/Change $\rightarrow$ Associate Dean 1 (Dr. Arun Kumar Gupta)
  - **Cluster 2**: Pre-PhD Course Work, RDC Meetings, Full-time to Part-time Conversion $\rightarrow$ Associate Dean 2 (Dr. Manas Upadhyay)
  - **Cluster 3**: Mandatory Publication Verification, Plagiarism Clearance, Examiner Panel, Thesis Submission $\rightarrow$ Associate Dean 3 (Dr. Sweta Pandey)

---

## 9. Category Routing Model

- Table: `categories`
- Routing Types:
  1. `GRIEVANCE_CLUSTER`: Routes to the mapped Associate Dean via `grievance_cluster_id`.
  2. `SUBJECT_ASSISTANT_DEAN`: Terminal at the Assistant Dean of the grievance's Subject Cluster (`Viva`, `Fee`, `Portal_Data_Correction`, `Other`). Cannot be forwarded laterally.
  3. `FIXED_AUTHORITY`: Routes directly to a designated authority via `fixed_authority_id` (e.g., `Fellowship` $\rightarrow$ Dr. Dipesh Kumar Verma, `RTI_IIGRS` $\rightarrow$ Dr. Samiuddin).
- SQL Integrity Constraint:
```sql
CONSTRAINT ck_category_routing CHECK (
    (routing_type = 'GRIEVANCE_CLUSTER' AND grievance_cluster_id IS NOT NULL) OR
    (routing_type = 'FIXED_AUTHORITY' AND fixed_authority_id IS NOT NULL) OR
    (routing_type = 'SUBJECT_ASSISTANT_DEAN' AND grievance_cluster_id IS NULL AND fixed_authority_id IS NULL)
)
```

---

## 10. Grievance State Machine (10 Core States)

```sql
CREATE TYPE grievance_status AS ENUM (
    'SUBMITTED',
    'AI_PROCESSING',
    'PENDING_REVIEW',
    'ASSIGNED',
    'IN_PROGRESS',
    'AWAITING_INFORMATION',
    'ESCALATED',
    'RESOLVED',
    'CLOSED',
    'REOPENED'
);
```

- All transitions are logged in `grievance_status_history` with `actor_type` (`USER` or `SYSTEM`), `changed_by`, `previous_status`, and `new_status`.
- Cycle Preservation: When a grievance transitions from `CLOSED` to `REOPENED`, all resolution notes and closer identities are copied into `previous_resolution_notes`, `previous_resolved_by_id`, `previous_closure_remarks`, etc.

---

## 11. Assignment & Forwarding Model

- Table: `assignments` records all historical and active authority assignments (`is_active: BOOLEAN`).
- Table: `forwarding_confirmations` enforces the institutional anti-passing contract:
  - **6 Boolean Checkboxes** (all must be explicitly `TRUE`):
    1. `reviewed_details`
    2. `reviewed_documents`
    3. `understands_status`
    4. `action_taken_within_authority`
    5. `forwarding_necessary`
    6. `accepts_accountability`
  - **3 Textual Justifications** (all required, length $\ge 10$ characters):
    1. `forwarding_reason`
    2. `action_taken`
    3. `why_higher_intervention_required`
- Table: `escalations` logs formal hierarchical escalations to the Dean.

---

## 12. Committee Subsystem (13 Tables)

Preserves the complete democratic inquiry process:
1. `committee_creation_requests`: Request and charter approval by Associate Dean or Dean.
2. `grievance_committees`: Committee container (enforces 2 to 10 members).
3. `committee_members`: Roster with roles (`CHAIRPERSON`, `MEMBER`, `OBSERVER`).
4. `committee_member_recommendations`: Independent individual recommendations with rationale.
5. `committee_final_recommendations`: Consolidated chairperson executive findings and dissent notes.
6. `committee_messages`: Internal in-camera chat deliberations.
7. `committee_polls`: Formal ballot container (`SIMPLE_MAJORITY`, `TWO_THIRDS`, `UNANIMOUS`).
8. `committee_poll_options`: Specific selectable options for a ballot.
9. `committee_poll_voters`: Frozen eligibility snapshot taken when a poll is opened.
10. `committee_poll_votes`: Individual secret ballots cast by eligible members.
11. `committee_decision_records`: Sealed mathematical certifications of poll outcomes.
12. `committee_meetings`: Scheduling virtual/hybrid sessions (Google Meet).
13. `committee_meeting_participants`: Attendance and participant register.

---

## 13. Guest Member Model

- **Identity**: Guest Members must be registered users in VYASA Core (`users.id`).
- **NIVARAN Record**: Provisioned in `nivaran_authorities` with `role = 'GUEST_MEMBER'`.
- **Scoping**: Added to a specific committee via `committee_members` (`member_role = 'MEMBER'`).
- **Permissions**: Forbidden from accessing general student master records, applicant dossiers outside their assigned committee, and cannot resolve, forward, or close grievances.
- **Participation**: Fully eligible to vote in `committee_polls` and submit recommendations.
- **Deactivation**: Automatically marked inactive when their assigned committee is closed or dissolved.

---

## 14. Dean Reopen Review Model

- Table: `dean_reopen_reviews`
- Lifecycle Statuses:
  - `AWAITING_REVIEW`
  - `CLARIFICATION_REQUESTED`
  - `CLARIFICATION_PROVIDED`
  - `DECIDED`
- Decision Determinations:
  - `UPHOLD_PREVIOUS_RESOLUTION`: Previous resolution reaffirmed; case permanently closed.
  - `FORWARD_FOR_FRESH_RESOLUTION`: Case remanded for fresh investigation and resolution.
  - `SEND_FOR_FURTHER_ACTION`: Administrative or disciplinary action mandated.
  - `FURTHER_REVIEW_REQUIRED`: Dean orders extended inquiry or committee constitution.
- Invariant: A grievance can undergo Dean Reopen Review **at most once** (`grievance_id` is indexed and checked).

---

## 15. Digital Signature Model

- **Algorithm**: `RSA-PSS-SHA256` with 3072-bit keys and PSS salt length equal to digest length (32 bytes).
- **Key Registry**: `signing_key_versions` tracks public keys, fingerprints, and statuses (`ACTIVE`, `RETIRED`, `REVOKED`). Private keys are stored in secure environment secrets / KMS, never in the database.
- **Step-Up Authorization**: `signing_authorization_challenges` issues single-use 5-minute cryptographic challenges verified via VYASA Core TOTP.
- **Polymorphic Scope**: `digital_signatures` records signatures across three distinct entity types:
  1. `GRIEVANCE_RESOLUTION`: Final grievance resolution by Assistant Dean / Associate Dean / Dean.
  2. `APPROVAL_DECISION`: Dean approval of high-stakes concession requests.
  3. `COMMITTEE_FINAL_RECOMMENDATION`: Chairperson sealing of committee report.
- **Immutability**: `digital_signatures` records are strictly append-only; updates and hard deletes are blocked at the database level.

---

## 16. Document & E-File Model

- **Case Documents**: `documents` stores metadata, storage path, MIME type, file size, and SHA-256 hash. `document_requests` tracks formal evidence requests to applicants.
- **Official E-File Dossier**: `efiles` contains the compiled ReportLab PDF dossier (`e_file_number VARCHAR(64) UNIQUE`, `pdf_hash VARCHAR(64)`), generated upon grievance closure.
- **Explicit Evidentiary Binding**: `efile_documents` binds specific document versions and their bit-level hashes into the sealed E-File dossier (`UNIQUE(efile_id, document_id, document_version)`).

---

## 17. AI & Semantic Machine Learning Model

- `ai_processing_records`: Captures machine learning inference runs, category predictions, token counts, latency, and confidence scores for auditability.
- `clusters`: Persists unsupervised semantic clustering models, algorithm metadata (`TF-IDF + K-Means`, `BERTopic`), model versions, and discovered topic clusters. Maintained strictly separate from academic Subject Clusters and administrative Grievance Clusters.

---

## 18. Notification Outbox Pattern

- Table: `grievance_notification_outbox`
- Pattern: **Transactional Outbox**. Domain events are committed in the same local ACID transaction as grievance state changes.
- Invariant: Zero distributed transactions and zero direct calls to external email/SMS providers from within NIVARAN business transactions.
- Asynchronous Relay: A dedicated Celery/Arq worker polls `grievance_notification_outbox WHERE status = 'PENDING'`, dispatches the event payload to VYASA Core's notification API (`POST /api/notifications`), and marks the row `DISPATCHED`.

---

## 19. Critical Integrity Constraints

1. **Assistant Dean Uniqueness**: `subject_clusters.assistant_dean_id UNIQUE NOT NULL REFERENCES nivaran_authorities(id)`.
2. **Associate Dean Uniqueness**: `grievance_clusters.associate_dean_id UNIQUE NOT NULL REFERENCES nivaran_authorities(id)`.
3. **Cluster Number Ranges**: `subject_clusters.cluster_number BETWEEN 1 AND 10`; `grievance_clusters.cluster_number BETWEEN 1 AND 3`.
4. **Category Routing Invariant**: `CONSTRAINT ck_category_routing` enforces mutual exclusivity of routing paths.
5. **Forwarding Confirmations**: `CONSTRAINT ck_forwarding_confirmations_all_checked` requires all 6 booleans to be `TRUE`.
6. **E-File Uniqueness**: `efiles.grievance_id UNIQUE NOT NULL REFERENCES grievances(id)`.
7. **Committee Member Range**: Application services enforce 2 to 10 members per active committee.
8. **Digital Signature Verification**: `digital_signatures.content_hash` must match the SHA-256 digest of `signed_content`.

---

## 20. Standard Naming Conventions

All table and column names strictly adhere to existing NIVARAN conventions:
- **Table Names**: Lowercase snake_case, plural where collection of entities (`categories`, `documents`, `efiles`, `assignments`, `escalations`, `clusters`), singular where institutional standard (`grievance_feedback`).
- **Primary Keys**: Always named `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Foreign Keys**: Named `<singular_entity>_id` (e.g., `grievance_id`, `subject_id`, `committee_id`).
- **VYASA Core Cross-References**: Explicitly named `<entity>_vyasa_user_id` or `vyasa_user_id` to clearly signal cross-service logical boundaries.
- **Timestamps**: All timestamps use `TIMESTAMPTZ` with default `NOW()`.

---

## 21. Implementation Rules

1. **Framework**: SQLAlchemy 2.0+ Declarative Mapped models using `typing.Annotated` and `Mapped[T]`.
2. **Migration Tool**: Alembic with sequential numbering and strict transaction boundaries.
3. **Database Driver**: Async PostgreSQL driver (`asyncpg`) or Psycopg 3 (`psycopg`).
4. **No Premature Execution**: No database tables, Alembic migrations, or model files are to be created until the code implementation phase is formally initiated.
5. **Zero Modification to Existing Systems**: The current running system at `C:\Projects\NIVARAN-AI\` and the VYASA Core backend remain completely untouched.
