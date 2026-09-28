# VYASA-NIVARAN Reconciled Database Entity-Relationship Map

> **Specification Status**: RECONCILED WITH AUTHORITATIVE ARCHITECTURE  
> **Source of Truth**: `docs/pillars/nivaran/database-architecture.md`  
> **Subsystem**: `apps/pillars/nivaran/backend`  
> **Ecosystem Context**: CSJMU Academic Governance Platform (VYASA)  
> **Total Table Count**: Exactly 40 Tables across 8 Domains

---

## 1. High-Level Ecosystem & Identity Boundary

The boundary below depicts the clean decoupling between **VYASA Core** (Platform Identity & Authentication) and the **NIVARAN Pillar** (Grievance Domain Database).

```
+========================================================================================================+
|                                     VYASA CORE DATABASE (Neon PostgreSQL)                              |
+========================================================================================================+
|  users                                                                                                 |
|  - id: UUID (PK) <------------------------------------------------------------------\                  |
|  - email, full_name, mobile_number, password_hash                                    \                 |
|  - role: vyasa_user_role ('applicant' | 'authority' | 'administrator')                \                |
|  - is_active, is_verified, totp_secret                                                 \               |
|  (Core owns: Credentials, Sessions, Login Attempts, Generic Roles, Platform Auditing)   \              |
+==========================================================================================\=============+
                                                                                            \ Logical UUID
                                                                                             \ Reference
+=============================================================================================\==========+
|                                     NIVARAN PILLAR DATABASE (PostgreSQL)                    \          |
+==============================================================================================\=========+
                                                                                                \
    +----------------------------------+                   +-------------------------------------\-----+
    |      APPLICANTS (Student View)   |                   |                nivaran_authorities        |
    | (Files grievance directly with   |                   | - id: UUID (PK)                           |
    |  applicant_vyasa_user_id)        |                   | - vyasa_user_id: UUID (UNIQUE) -----------/
    |                                  |                   | - role: NivaranRole                       |
    |                                  |                   |     ('MANAGER', 'ASSISTANT_DEAN',         |
    |                                  |                   |      'ASSOCIATE_DEAN', 'DEAN',            |
    |                                  |                   |      'GUEST_MEMBER')                      |
    |                                  |                   | - name_snapshot, email_snapshot           |
    |                                  |                   | - designation, department, is_active      |
    +----------------------------------+                   +-------------------------------------------+
                     |                                                           | 1
                     | 1                                                         |
                     | files                                                     | (Assigned / Mapped)
                     v N                                                         v N
    +--------------------------------------------------------------------------------------------------+
    |                                            grievances                                            |
    | - id: UUID (PK)                                                                                  |
    | - grievance_id: VARCHAR(30) UNIQUE                                                               |
    | - applicant_vyasa_user_id: UUID (Logical Reference to VYASA users.id)                            |
    | - student_record_id: UUID (FK) ----------> student_master_records.id                             |
    | - subject_id: UUID (FK) -----------------> subjects.id                                           |
    | - category_id: UUID (FK) ----------------> categories.id                                         |
    | - final_category_id: UUID (FK) -----------> categories.id                                         |
    | - status: GrievanceStatus (10 Core States)                                                       |
    | - priority: GrievancePriority (LOW, MEDIUM, HIGH, CRITICAL)                                      |
    | - category_reviewed, category_overridden, ai_confidence                                          |
    | - resolved_by_authority_id (FK) ---------> nivaran_authorities.id                                |
    | - closed_by_authority_id (FK) -----------> nivaran_authorities.id                                |
    | - previous cycle tracking columns (8 audit fields)                                               |
    +--------------------------------------------------------------------------------------------------+
```

---

## 2. Reconciled 40-Table Domain Registry

All 40 tables are grouped into **8 bounded functional domains** matching `database-architecture.md`:

```
+--------------------------------------------------------------------------------------------------------+
|                                  THE 40 AUTHORITATIVE RECONCILED TABLES                                |
+--------------------------------------------------------------------------------------------------------+
| Domain 1: Authority & Taxonomy Foundations (5 Tables)                                                  |
|   1. nivaran_authorities          (Authority profiles linked 1:1 to vyasa_user_id; incl GUEST_MEMBER) |
|   2. subject_clusters             (10 Academic clusters, cluster_number INT UNIQUE, 1:1 Asst Dean)     |
|   3. subjects                     (55 Academic subjects mapped to subject_clusters)                   |
|   4. grievance_clusters           (3 Grievance clusters, cluster_number INT UNIQUE, 1:1 Assoc Dean)    |
|   5. categories                   (Category master: GRIEVANCE_CLUSTER, SUBJECT_ASST_DEAN, FIXED_AUTH)  |
|                                                                                                        |
| Domain 2: Grievance Case Management (5 Tables)                                                         |
|   6. student_master_records       (Immutable student profile snapshots and historical affiliation)     |
|   7. grievances                   (Master case record, tracking ID, 10 states, cycle preservation)     |
|   8. grievance_status_history     (Chronological status transitions with USER/SYSTEM actor attribution)|
|   9. comments                     (Internal administrative notes and applicant-visible updates)        |
|  10. grievance_feedback           (Applicant post-resolution ratings: quality, time, overall 1..5)     |
|                                                                                                        |
| Domain 3: Routing, Assignment & Accountability (3 Tables)                                              |
|  11. assignments                  (Authority case ownership ledger with active/unassigned lifecycle)   |
|  12. forwarding_confirmations     (Accountable forwarding: 6 mandatory checkboxes + 3 justifications)  |
|  13. escalations                  (Role-to-role escalation ledger from Manager/Asst/Assoc to Dean)     |
|                                                                                                        |
| Domain 4: Document Management & Clarifications (2 Tables)                                              |
|  14. documents                    (Uploaded case attachments with SHA-256 hashes and storage keys)     |
|  15. document_requests            (Formal authority requests for additional applicant evidence)        |
|                                                                                                        |
| Domain 5: Committee Deliberation & Voting Subsystem (13 Tables)                                        |
|  16. committee_creation_requests  (Formal authority request to charter inquiry/hearing committee)      |
|  17. grievance_committees         (Committee master entity: 2-10 members, chairperson, status)         |
|  18. committee_members            (Internal & Guest member roster with CHAIRPERSON, MEMBER, OBSERVER)  |
|  19. committee_member_recommendations (Individual member assessments and recommendations)             |
|  20. committee_final_recommendations  (Consolidated Chairperson report, findings, and dissent notes)   |
|  21. committee_messages           (Real-time in-camera deliberation chat log)                          |
|  22. committee_polls              (Formal ballot container with voting policy & quorum thresholds)     |
|  23. committee_poll_options       (Selectable ballot choices for a poll)                               |
|  24. committee_poll_voters        (Frozen snapshot of eligible committee voters at poll launch)        |
|  25. committee_poll_votes         (Individual cast ballots with cryptographic timestamps & audit)      |
|  26. committee_decision_records   (Sealed, certified mathematical outcome of committee ballots)        |
|  27. committee_meetings           (Scheduled Google Meet/virtual sessions: Internal or Hearing)        |
|  28. committee_meeting_participants (Attendance register and participant logs for hearings)           |
|                                                                                                        |
| Domain 6: Dispute Arbitration (1 Table)                                                                |
|  29. dean_reopen_reviews          (Single-chance Dean adjudication with 4 audited decision types)      |
|                                                                                                        |
| Domain 7: Cryptographic Signing & E-File Dossiers (7 Tables)                                           |
|  30. signing_key_versions         (Institutional RSA-3072 key lifecycle: ACTIVE, RETIRED, REVOKED)    |
|  31. signing_authorization_challenges (Single-use 5-minute cryptographic challenges bound to TOTP)    |
|  32. digital_signatures           (Polymorphic RSA-PSS signatures: Resolution, Approval, Committee Rec)|
|  33. efiles                       (Consolidated case dossier: ReportLab PDF, checksum, sealed status)  |
|  34. efile_documents              (Explicit junction binding document versions & hashes to E-File)     |
|  35. approval_requests            (Authority-to-Dean high-stakes approval requests)                    |
|  36. approval_actions             (Step-by-step approval history and decision actions)                 |
|                                                                                                        |
| Domain 8: Platform Eventing, AI & Auditing (4 Tables)                                                  |
|  37. ai_processing_records        (ML inference execution log, predicted category, confidence score)   |
|  38. grievance_notification_outbox (Transactional Outbox staging notifications for VYASA Core)        |
|  39. audit_logs                   (System-wide immutable security, data access, and IP audit trail)    |
|  40. clusters                     (Semantic/ML unsupervised clustering topics and algorithm versions)  |
+--------------------------------------------------------------------------------------------------------+
```

---

## 3. Detailed Entity Relationship Diagrams

### 3.1. Authority, Academic Taxonomy & Grievance Taxonomy

```
   [VYASA users] (Core Database)
         |
         | 1 (Logical vyasa_user_id)
         v 1
   [nivaran_authorities] <======================================================\
   - id: UUID (PK)                                                              |
   - vyasa_user_id: UUID (UNIQUE)                                               |
   - role: NivaranRole ('MANAGER'|'ASSISTANT_DEAN'|                             |
                        'ASSOCIATE_DEAN'|'DEAN'|'GUEST_MEMBER')                  |
   - designation, department, is_active                                         |
         |                                                                      |
         +--- 1:1 (assistant_dean_id UNIQUE) -------------------------------\   |
         |                                                                  |   |
         |                                                                  v   |
         |   +------------------------------------------------------------+ |   |
         |   | subject_clusters (10 Academic Clusters)                    | |   |
         |   | - id: UUID (PK)                                            | |   |
         |   | - cluster_number: INTEGER UNIQUE (1..10)                   | |   |
         |   | - name: VARCHAR(150)                                       | |   |
         |   | - assistant_dean_id: UUID (FK, UNIQUE) <-------------------/ |   |
         |   +------------------------------------------------------------+     |
         |                                 | 1                                  |
         |                                 | has                                |
         |                                 v N                                  |
         |   +------------------------------------------------------------+     |
         |   | subjects (55 Academic Subjects)                            |     |
         |   | - id: UUID (PK)                                            |     |
         |   | - subject_cluster_id: UUID (FK)                            |     |
         |   | - name: VARCHAR(150) UNIQUE                                |     |
         |   +------------------------------------------------------------+     |
         |                                                                      |
         +--- 1:1 (associate_dean_id UNIQUE) -------------------------------\   |
                                                                            |   |
                                                                            v   |
             +------------------------------------------------------------+ |   |
             | grievance_clusters (3 Clusters: P1, P2, P3)                | |   |
             | - id: UUID (PK)                                            | |   |
             | - cluster_number: INTEGER UNIQUE (1, 2, 3)                 | |   |
             | - name: VARCHAR(150)                                       | |   |
             | - associate_dean_id: UUID (FK, UNIQUE) <-------------------/ |   |
             +------------------------------------------------------------+     |
                                           | 1                                  |
                                           | classifies (optional)              |
                                           v 0..N                               |
             +------------------------------------------------------------+     |
             | categories                                                 |     |
             | - id: UUID (PK)                                            |     |
             | - name: VARCHAR(100) UNIQUE                                |     |
             | - routing_type: CategoryRoutingType                        |     |
             |     * GRIEVANCE_CLUSTER    ==> grievance_cluster_id FK     |     |
             |     * SUBJECT_ASST_DEAN    ==> subject cluster Asst Dean        |     |
             |     * FIXED_AUTHORITY      ==> fixed_authority_id FK ------------/
             | - grievance_cluster_id: UUID (FK, Nullable)                |
             | - fixed_authority_id: UUID (FK, Nullable)                  |
             +------------------------------------------------------------+
```

---

### 3.2. Case Management, Routing & Accountability

```
   [student_master_records]        [subjects]      [categories]      [nivaran_authorities]
              |                         |               |                     |
              | 1 (Optional)            | 1             | 1                   | 1
              v N                       v N             v N                   v N
   +-----------------------------------------------------------------------------------+
   |                                     grievances                                    |
   | - id: UUID (PK)                                                                   |
   | - grievance_id: VARCHAR(30) UNIQUE (e.g. G-2026-XXXX)                             |
   | - applicant_vyasa_user_id: UUID (Logical Reference to VYASA Core)                 |
   | - student_record_id: UUID (FK, Nullable)                                           |
   | - subject_id: UUID (FK)                                                           |
   | - category_id: UUID (FK)                                                          |
   | - final_category_id: UUID (FK)                                                    |
   | - status: GrievanceStatus (10 Core States)                                        |
   | - priority: GrievancePriority (LOW, MEDIUM, HIGH, CRITICAL)                       |
   | - resolved_by_authority_id: UUID (FK) --------------------------------------------+
   | - closed_by_authority_id: UUID (FK) ----------------------------------------------+
   +-----------------------------------------------------------------------------------+
       |            |                 |                |                 |
       | 1:N        | 1:N             | 1:N            | 1:N             | 1:1
       v            v                 v                v                 v
   [grievance_  [comments]       [assignments]    [escalations]    [grievance_feedback]
    status_     - user_id        - assigned_to    - from_user_id   - applicant_vyasa_id
    history]    - comment        - assigned_by    - from_role      - resolution_quality
   - changed_by - is_internal    - is_active      - to_role        - response_time
   - actor_type                        | 1        - reason         - overall_exp
                                       |          - remarks
                                       v 1:1 (UNIQUE)
                                 [forwarding_confirmations]
                                 - 6 Mandatory Boolean Checkboxes (all TRUE)
                                 - 3 Mandatory Justification Texts (length >= 10)
```

---

### 3.3. Committee Deliberation, Meetings & Voting Subsystem

```
                 [grievances]
                      |
                      | 1:N
                      v
        +-----------------------------+
        | committee_creation_requests |
        | - requested_by_id (FK)      |
        | - request_status            |
        | - suggested_members (JSONB) |
        +-----------------------------+
                      | Approved by Associate Dean / Dean
                      v
        +-------------------------------------------------------------------------------+
        |                              grievance_committees                             |
        | - id: UUID (PK)                                                               |
        | - grievance_id: UUID (FK)                                                     |
        | - chairperson_id: UUID (FK) --> nivaran_authorities.id                        |
        | - status: CommitteeStatus ('ACTIVE', 'CLOSED', 'DISSOLVED')                   |
        | - dissolved_by_id: UUID (FK), dissolution_reason                              |
        +-------------------------------------------------------------------------------+
           |               |              |             |               |
           | 1:N           | 1:N          | 1:1         | 1:N           | 1:N
           v               v              v             v               v
     [committee_      [committee_    [committee_   [committee_     [committee_
      members]         member_        final_        messages]       meetings]
      - authority_id   recs]          rec]         - sender_id     - meeting_type
        (Incl. GUEST_  - member_id    - chair_id   - message         (INTERNAL or
         MEMBER)       - rec_type     - final_rec  - message_type     APPLICANT_HEARING)
      - member_role    - rationale    - dissent      (MESSAGE/     - scheduled_at
        (CHAIR,          notes          summary       SYSTEM)      - meet_url
         MEMBER,                                                   - status
         OBSERVER)                                                        | 1
           |                                                              |
           |                                                              v N
           |                                                       [committee_meeting_
           |                                                        participants]
           |                                                       - participant_role
           |                                                       - email, full_name
           |
           +--------------------------------\
                                             |
                                             v 1:N
                              +---------------------------------+
                              |         committee_polls         |
                              | - committee_id: UUID (FK)       |
                              | - voting_policy (MAJORITY/etc.) |
                              | - quorum_percentage (e.g. 50)   |
                              | - status ('OPEN'|'CLOSED')      |
                              +---------------------------------+
                                  | 1             | 1         | 1
                                  | 1:N           | 1:N       | 1:1 (UNIQUE)
                                  v               v           v
                             [committee_     [committee_  [committee_decision_
                              poll_options]   poll_        records]
                             - option_text    voters]     - decision_status
                             - display_order - voter_id     (RATIFIED/FAILED_QUORUM/
                                             - eligible     FAILED_MAJORITY/TIE)
                                                  | 1     - total_eligible
                                                  |       - winning_option_id
                                                  v 1:1   - certified_by_id
                                             [committee_  - certified_at
                                              poll_votes]
                                             - selected_option_id
                                             - rationale
```

---

### 3.4. Cryptographic Signing, Approvals & E-File Dossiers

```
                 [grievances]
                      |
                      +--- 1:N ---> [approval_requests]
                      |              - requested_by_id (FK)
                      |              - requested_from_id (Dean FK)
                      |              - status ('PENDING'|'APPROVED'|'REJECTED')
                      |              - justification_notes
                      |                     | 1
                      |                     | 1:N
                      |                     v
                      |             [approval_actions]
                      |             - actor_id (FK)
                      |             - action ('REQUESTED'|'APPROVED'|'REJECTED')
                      |             - decision_context (JSONB)
                      |
                      +--- 1:N ---> [documents] <---------------------------------\
                      |              - file_name, file_path                       |
                      |              - mime_type, file_size                       |
                      |              - content_hash (SHA-256)                     |
                      |                     ^                                     |
                      |                     | 1:N (Satisfies)                     |
                      +--- 1:N ---> [document_requests]                           |
                      |              - requested_by_id (FK)                       |
                      |              - document_name                              |
                      |              - status (PENDING/UPLOADED/APPROVED)         |
                      |                                                           |
                      +--- 1:1 (UNIQUE) ---> [efiles]                             |
                                              - e_file_number: VARCHAR(64) UNIQUE |
                                              - status ('DRAFT'|'FINALIZED'|'ARCH')|
                                              - pdf_path, pdf_hash, pdf_size      |
                                              - sealed_at, sealed_by_id (Dean FK) |
                                                    | 1                           |
                                                    | 1:N                         |
                                                    v                             |
                                             [efile_documents] -------------------/
                                             - document_id (FK)
                                             - document_version
                                             - document_hash (SHA-256)

 ========================================================================================================
                            POLYMORPHIC CRYPTOGRAPHIC SIGNING LEDGER
 ========================================================================================================

   [signing_key_versions]
   - id: UUID (PK), key_id: VARCHAR(100) UNIQUE
   - algorithm: 'RSA-PSS-SHA256'
   - public_key_pem, fingerprint, status ('ACTIVE'|'RETIRED'|'REVOKED')
          | 1
          | references key_id
          v N
   [digital_signatures]
   - id: UUID (PK)
   - entity_type: DigitalSignatureEntityType
       * 'GRIEVANCE_RESOLUTION'           ==> entity_id = grievances.id
       * 'APPROVAL_DECISION'              ==> entity_id = approval_actions.id
       * 'COMMITTEE_FINAL_RECOMMENDATION' ==> entity_id = committee_final_recommendations.id
   - entity_id: UUID
   - grievance_id: UUID (FK) -----------> grievances.id
   - signed_by_id: UUID (FK) -----------> nivaran_authorities.id
   - signature_algorithm: 'RSA-PSS-SHA256'
   - signature_value: TEXT (Base64)
   - content_hash: VARCHAR(64) (SHA-256)
   - signed_content: JSONB (Signed payload snapshot)
   - key_fingerprint: VARCHAR(64)
   - signing_authorization_method: 'TOTP'
          | Verified via
          v
   [signing_authorization_challenges]
   - id: UUID (PK)
   - user_vyasa_id: UUID (Validated via VYASA Core TOTP)
   - grievance_id: UUID (FK)
   - purpose: 'SIGN_RESOLUTION', 'SIGN_APPROVAL', 'SIGN_RECOMMENDATION'
   - payload_hash: VARCHAR(64)
   - expires_at: 5 minutes lifetime
```

---

### 3.5. Dispute Arbitration, AI/ML, Outbox & System Auditing

```
              [grievances]
                   |
                   +--- 1:N ---> [dean_reopen_reviews]
                   |              - grievance_id: UUID (FK)
                   |              - dean_id: UUID (FK)
                   |              - concerned_authority_id: UUID (FK)
                   |              - status: ('AWAITING_REVIEW', 'CLARIFICATION_REQUESTED',
                   |                         'CLARIFICATION_PROVIDED', 'DECIDED')
                   |              - question_text, response_text
                   |              - decision_type: ('UPHOLD_PREVIOUS_RESOLUTION',
                   |                                'FORWARD_FOR_FRESH_RESOLUTION',
                   |                                'SEND_FOR_FURTHER_ACTION',
                   |                                'FURTHER_REVIEW_REQUIRED')
                   |              - decision_remarks, decided_at
                   |
                   +--- 1:N ---> [ai_processing_records]
                   |              - model_name, model_version
                   |              - predicted_category_id (FK) -> categories.id
                   |              - confidence_score: NUMERIC(5, 4)
                   |              - status ('PENDING'|'COMPLETED'|'FAILED')
                   |
                   +--- 1:N ---> [grievance_notification_outbox]
                   |              - event_type: VARCHAR(100) (e.g. 'GRIEVANCE_ASSIGNED')
                   |              - recipient_vyasa_user_id: UUID (Logical Reference)
                   |              - payload: JSONB
                   |              - status ('PENDING'|'DISPATCHED'|'FAILED')
                   |              - retry_count, next_retry_at
                   |
                   +--- 1:N ---> [audit_logs]
                                  - user_vyasa_id: UUID (Logical Reference)
                                  - action, entity_type, entity_id
                                  - description, ip_address (INET)
                                  - created_at: TIMESTAMPTZ

   [clusters] (Semantic / ML Unsupervised Clustering Topics)
   - id: UUID (PK)
   - cluster_number: INTEGER UNIQUE (Semantic group ID)
   - name: VARCHAR(150) (e.g. 'Fellowship Disbursement Delay Topics')
   - description: TEXT
   - algorithm: VARCHAR(100) (e.g. 'TF-IDF + K-Means', 'BERTopic')
   - model_version: VARCHAR(100)
   - is_active: BOOLEAN
   (Maintained independently of academic Subject Clusters and administrative Grievance Clusters)
```

---

## 4. Architectural Invariants & Consistency Proofs

1. **Persistent Identity for Guest Members**:
   - Guest members are provisioned with an account in VYASA Core (`users.id`) and assigned a profile in `nivaran_authorities` with `role = 'GUEST_MEMBER'`.
   - They join committees as a first-class member via `committee_members` (`member_role = 'MEMBER'`).
   - They vote via `committee_poll_voters` and `committee_poll_votes`.
   - No bearer token tables (`committee_guest_tokens`) exist in the schema.
2. **Complete Committee Polling Lifecycle**:
   - Formal democratic voting preserves the full audited cascade: `committee_polls` $\rightarrow$ `committee_poll_options` $\rightarrow$ `committee_poll_voters` $\rightarrow$ `committee_poll_votes` $\rightarrow$ `committee_decision_records`.
   - Individual member advice is preserved in `committee_member_recommendations`, while the final executive synthesis is held in `committee_final_recommendations`.
3. **Cryptographic Integrity & Polymorphism**:
   - `digital_signatures` records are append-only.
   - Signatures polymorphic across three institutional actions: `GRIEVANCE_RESOLUTION`, `APPROVAL_DECISION`, and `COMMITTEE_FINAL_RECOMMENDATION`.
   - `signing_authorization_challenges` links single-use step-up TOTP authorization to the payload digest.
4. **Clean Transactional Notification Outbox**:
   - `grievance_notification_outbox` commits event rows within the local grievance transaction.
   - An asynchronous worker relays events to VYASA Core's notification infrastructure (`POST /api/notifications`).
   - Downstream SMS, email, and WebSockets remain completely owned by VYASA Core.
5. **Exact Naming Standard**:
   - Table names strictly match existing NIVARAN conventions: `categories`, `documents`, `document_requests`, `efiles`, `efile_documents`, `assignments`, `escalations`, `grievance_feedback`.
   - Speculative table prefixes or alternate terms (`grievance_categories`, `grievance_attachments`, `e_files`) are completely eliminated.
