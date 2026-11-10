# VYASA-N — SYSTEM-WIDE OPERATIONAL WORKFLOWS

**Audit Date:** November 7, 2026  
**Auditor Classification:** Principal Software Architect & Process Modeler  

---

## 1. Overview of Master Workflows

This document models the end-to-end user and operational workflows implemented within the VYASA-N ecosystem. Each workflow maps the initiating actor, permission requirements, input payloads, validation rules, API interactions, database mutations, notification dispatches, and exception branches.

---

## 2. Workflow 1: Authority First-Login Onboarding & TOTP 2FA Enforcement

All institutional authorities (Case Managers, Assistant Deans, Associate Deans, Deans, Super Admins) must complete mandatory cryptographic onboarding before accessing the platform.

```mermaid
sequenceDiagram
    autonumber
    actor Auth as University Authority
    participant UI as Authority Login UI
    participant API as FastAPI Auth Router
    participant Svc as TwoFactorService
    participant DB as PostgreSQL DB
    participant Mail as Email Service

    Auth->>UI: Enters Email & Temporary Password
    UI->>API: POST /api/auth/login
    API->>DB: Query user by email & verify PBKDF2 hash
    Note over API,DB: Flag user.must_change_password == True
    API->>Svc: create_challenge(purpose="PASSWORD_CHANGE_REQUIRED")
    Svc->>DB: Insert authentication_challenge (5m TTL)
    API-->>UI: 200 OK (requires_password_change=True, challenge_id)
    
    Auth->>UI: Enters New Complex Password
    UI->>API: POST /api/auth/first-login/set-password
    API->>Svc: Validate challenge_id & enforce complexity rules
    API->>DB: Update password_hash, set must_change_password = False
    API->>Svc: create_challenge(purpose="TWO_FACTOR_SETUP")
    API-->>UI: 200 OK (requires_two_factor=True, challenge_id)

    Auth->>UI: Clicks "Setup Authenticator"
    UI->>API: POST /api/auth/2fa/setup (with challenge_id)
    API->>Svc: Generate TOTP secret & 8 backup codes
    API->>Svc: Encrypt secret at rest via Fernet key
    API-->>UI: 200 OK (provisioning_uri, qr_code_svg, backup_codes)

    Auth->>UI: Scans QR code with Google Authenticator, enters 6-digit TOTP
    UI->>API: POST /api/auth/2fa/confirm-setup (challenge_id, code)
    API->>Svc: Verify TOTP token against decrypted secret
    API->>DB: Set is_enabled = True in user_two_factor_auth
    API->>DB: Insert AuditLog (action="2FA_ENROLLED")
    API->>Mail: Dispatch Security Alert Email ("New Device / 2FA Enrolled")
    API-->>UI: 200 OK (access_token, user_roles, profile)
    UI-->>Auth: Redirects to Authority Dashboard
```

---

## 3. Workflow 2: End-to-End Grievance Redressal Lifecycle (NIVARAN-AI)

This workflow represents the core operational pipeline of Atharva Veda, tracking a student complaint from intake to cryptographic sealing.

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED: Applicant Submits (OCR Extract / Attachments)
    SUBMITTED --> UNDER_REVIEW: Manager Opens Case in Triage Queue
    
    state UNDER_REVIEW {
        [*] --> AI_Inference: ML Model Suggests Category & Confidence
        AI_Inference --> Manager_Validation: Manager Confirms / Overrides Category
        Manager_Validation --> [*]
    }

    UNDER_REVIEW --> ASSIGNED_TO_ASSISTANT_DEAN: Manager Dispatches to Subject Cluster
    
    state ASSIGNED_TO_ASSISTANT_DEAN {
        [*] --> Case_Hearing
        Case_Hearing --> Request_Document: Missing Evidence
        Request_Document --> Case_Hearing: Applicant Uploads Proof
        Case_Hearing --> Request_Committee: Complex / Disciplinary Case
        Case_Hearing --> Forward_Associate_Dean: Policy / Cross-Subject Conflict
        Case_Hearing --> Resolve_Assistant_Dean: Standard Jurisdictional Issue
    }

    Request_Committee --> REFERRED_TO_COMMITTEE: Associate Dean / Dean Approves Petition
    Forward_Associate_Dean --> ESCALATED_TO_ASSOCIATE_DEAN
    
    state REFERRED_TO_COMMITTEE {
        [*] --> WebSocket_Deliberation: Real-time Member Discussion
        WebSocket_Deliberation --> Virtual_Hearing: Google Meet Call Scheduled
        Virtual_Hearing --> Quorum_Voting: Poll Cast (SHA-256 Ballot)
        Quorum_Voting --> Formal_Resolution: Chairperson Records Minutes
        Formal_Resolution --> [*]
    }

    REFERRED_TO_COMMITTEE --> RESOLVED: Committee Findings Accepted by Authority
    Resolve_Assistant_Dean --> RESOLVED: Assistant Dean Records Decision
    ESCALATED_TO_ASSOCIATE_DEAN --> RESOLVED: Associate Dean Resolves Case

    RESOLVED --> CLOSED: Case Manager Verifies Compliance in Closure Queue
    
    state CLOSED {
        [*] --> EFile_Assembly: Collate Timeline, Documents & Minutes
        EFile_Assembly --> SHA256_Sealing: Cryptographic Hash & Digital Signature
        SHA256_Sealing --> SMR_Update: Increment Student Master Record Stats
        SMR_Update --> Applicant_Rating: Applicant Submits Feedback (1-5 Stars)
        Applicant_Rating --> [*]
    }

    CLOSED --> REOPENED: Dean Issues Executive Reopen Order (Statutory Override)
    REOPENED --> UNDER_REVIEW: Re-enters Triage for Re-investigation
    CLOSED --> [*]
```

### Operational Steps in the Lifecycle:
1. **Intake & Quota Check:**
   - Validates student has < 3 active grievances.
   - Computes text similarity against existing cases to prevent spam/duplicate filings.
   - Extracts OCR text from PDF/image affidavits via Gemini OCR.
2. **AI-Assisted Triage:**
   - Case Manager inspects ML classification (`category_classifier.joblib`).
   - If accepted, system matches approved category Turn-Around-Time (TAT) and auto-routes to the Assistant Dean managing the subject cluster.
3. **Investigation & Evidentiary Request:**
   - Assistant Dean reviews dossier.
   - Can issue a `RequestDocumentModal` prompt; case transitions to `AWAITING_DOCUMENT`, pausing the resolution TAT timer.
4. **Resolution Recording:**
   - Authority inputs formal resolution remarks. System dispatches branded notifications via email and web portal.
5. **Manager Verification & E-File Sealing:**
   - Manager reviews compliance.
   - System invokes `efile_pdf_generator.py`, compiling all filings, approvals, timestamps, and signatures into a standardized PDF.
   - Dossier is hashed with SHA-256 and stored with immutable metadata.

---

## 4. Workflow 3: Statutory Committee Formation, Hearing & Consensus Voting

```mermaid
flowchart TD
    START([Case Requires Inquiry Tribunal]) --> REQ{Authority Level}
    
    REQ -->|Assistant Dean| PETITION[Submit Committee Creation Petition<br/>POST /committees/requests/{id}]
    REQ -->|Associate Dean / Dean| CHARTER[Direct Committee Chartering<br/>POST /committees/direct]

    PETITION --> REVIEW[Associate Dean / Dean Reviews Request]
    REVIEW -->|Clarification Requested| REVISE[Assistant Dean Refines Terms of Reference]
    REVISE --> REVIEW
    REVIEW -->|Rejected| DENIED[Petition Dismissed with Remarks]
    REVIEW -->|Approved| CHARTER

    CHARTER --> SETUP[Assign Chairperson, Members & Observers<br/>Unique Constraint Enforced]
    
    SETUP --> WORKSPACE[Active Committee Workspace Initialized]
    
    subgraph DEDICATED_WORKSPACE ["Committee Workspace Operations"]
        WORKSPACE --> CHAT[Real-Time Evidentiary Deliberation<br/>WebSocket / Fallback REST]
        WORKSPACE --> MEET[Schedule Virtual Hearing<br/>Google Calendar / Meet Integration]
        WORKSPACE --> DOCS[Upload Confidential In-Camera Evidence]
        WORKSPACE --> POLL[Launch Formal Resolution Poll]
        
        POLL --> VOTE[Members Cast Cryptographic Ballots<br/>SHA-256 Ballot Hashing]
        VOTE --> TALLY{Quorum & Policy Met?}
        TALLY -->|Simple Majority / 2/3 / Unanimous| ADOPT[Resolution Passed]
        TALLY -->|Quorum Failed| RETRY[Re-convene or Extend Poll]
    end

    ADOPT --> MINUTES[Chairperson Submits Formal Minutes & Findings<br/>POST /committees/{id}/decisions]
    MINUTES --> DISSOLVE[Committee Formally Dissolved<br/>Findings Attached to Grievance Dossier]
    DISSOLVE --> RESOLVE_CASE[Case Marked as RESOLVED]
```

---

## 5. Workflow 4: Sama Veda Research Recognition & Certificate Verification

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Sama CMS Admin
    actor Public as Public Employer / Scholar
    participant CMS as Admin CMS UI
    participant Portal as Samiksha Public UI
    participant API as Sama Veda Router
    participant Svc as SamaCmsService
    participant DB as PostgreSQL DB
    participant Store as Secure Storage

    Note over Admin,Store: Phase A: Digital Certificate Issuance
    Admin->>CMS: Submits Recipient, Achievement & Category
    CMS->>API: POST /api/admin/sama/certificates
    API->>Svc: Generate UUID & Unique Certificate Number (CSJMU/SAMA/YYYY/XXXX)
    API->>Svc: Compute SHA-256 QR Verification Hash
    API->>Store: Save Certificate PDF & QR metadata
    API->>DB: Insert into sama_felicitation_certificates
    API-->>CMS: 201 Created (Certificate Dossier)

    Note over Public,Store: Phase B: Public Verification Flow
    Public->>Portal: Scans QR code or Enters Certificate Number
    Portal->>API: GET /api/modules/sama-veda/certificates/verify/{certificate_number}
    API->>DB: Query certificate by number / hash
    alt Certificate Exists & Active
        API->>DB: Log Verification Event (IP, Timestamp, User-Agent)
        API-->>Portal: 200 OK (Authentic Certificate Metadata)
        Portal-->>Public: Displays Verified Green Seal & PDF Download Button
    else Certificate Has Been Revoked
        API-->>Portal: 200 OK (is_revoked=True, revocation_reason, revoked_at)
        Portal-->>Public: Displays Warning Seal & Blocks Download
    else Certificate Not Found
        API-->>Portal: 404 Not Found ("Unrecognized Certificate")
        Portal-->>Public: Displays Red Fraud Warning Alert
    end
```

---

## 6. Workflow 5: Public Ph.D. RAG Conversational Guidance

```mermaid
flowchart TD
    A([Prospective Scholar Submits Query]) --> B{Rate Limiter Check}
    B -->|Exceeds 20 req/min/IP| C[429 Too Many Requests<br/>Returns Retry-After Header]
    B -->|Within Limit| D[Text Sanitization & Trimming]
    
    D --> E[Vector Embedding Generation<br/>all-MiniLM-L6-v2 Embedder]
    E --> F[Cosine Similarity Vector Search<br/>Across phd_rag_chunks]
    
    F --> G{Confidence Score >= 0.65?}
    G -->|No Relevant Chunks Found| H[Ungrounded Fallback Response<br/>Branded: Informational • VYASA Assistant]
    G -->|Relevant Chunks Found| I[Augment Prompt with Top-K Passages<br/>Include Ordinance & Brochure Citations]
    
    I --> J[Invoke Google Gemini 2.0 Flash LLM]
    J --> K[Construct Grounded Response Payload]
    K --> L[Format Citation References<br/>Document Name, Section, Page Number]
    L --> M([Deliver Response to User Interface<br/>Branded: Source Grounded • VYASA Assistant])
```
