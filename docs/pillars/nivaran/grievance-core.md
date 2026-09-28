# NIVARAN Grievance Core & Applicant Filing Specification

This document establishes the architecture, endpoints, data flow, and lifecycle boundaries for the **Grievance Core & Applicant Filing** phase of the **NIVARAN** pillar within the **VYASA** ecosystem.

---

## 1. Architectural Principles & Identity Boundaries

- **Applicant Identity Ownership**:
  - **VYASA Core** owns user identity, credentials, passwords, JWT issuance, TOTP, and session lifecycles.
  - **NIVARAN** never authenticates applicants locally, maintains no password hashes, and provides no local user registration.
  - The authenticated caller identity is accepted as `applicant_vyasa_user_id: UUID` (passed via gateway identity headers, e.g. `X-Applicant-User-Id`).
  - No physical cross-database foreign keys exist between NIVARAN and VYASA Core databases.
- **Tenant / Applicant Isolation**:
  - All applicant queries (`GET /api/v1/grievances`, `GET /api/v1/grievances/{id}`) are strictly scoped to the authenticated caller's `applicant_vyasa_user_id`.
  - An applicant cannot access, list, or inspect another applicant's grievance. Unauthorized access attempts yield a 403 Forbidden or 404 Not Found error without leaking metadata.

---

## 2. Grievance Submission Flow

```text
Applicant (Frontend)
   │
   │  POST /api/v1/grievances
   │  Headers: X-Applicant-User-Id: <UUID>
   │  Payload: { title, description, subject_id, priority, documents }
   ▼
FastAPI Route (app/api/v1/grievances.py)
   │
   ▼
GrievanceSubmissionService (app/services/grievance_submission.py)
   ├── 1. Validate Subject exists in institutional taxonomy and is_active = True
   ├── 2. Validate Subject belongs to a valid Subject Cluster (1..10)
   ├── 3. Validate initial lifecycle transition (None -> SUBMITTED)
   ├── 4. Generate unique tracking code (e.g. G-20260927-A1B2C3)
   ├── 5. Check/link existing StudentMasterRecord (if provisioned; no fake data created)
   │
   ├── [BEGIN ATOMIC TRANSACTION]
   ├── 6. INSERT into grievances (status=SUBMITTED)
   ├── 7. INSERT into grievance_status_history (previous_status=NULL, new_status=SUBMITTED, actor_type=USER)
   ├── 8. INSERT into documents (initial evidence metadata and checksums)
   ├── 9. INSERT into audit_logs (action=GRIEVANCE_SUBMITTED)
   ├── [COMMIT TRANSACTION]
   │
   ▼
GrievanceQueryService (app/services/grievance_query.py)
   │  Format into ApplicantGrievanceResponse (excludes internal fields)
   ▼
HTTP 201 Created Response to Client
```

---

## 3. Initial Lifecycle State & State Machine Foundation

### Initial State Invariant
A newly filed grievance strictly enters:
```text
status = GrievanceStatus.SUBMITTED
```
Under no circumstances does a grievance begin in `AI_PROCESSING`, `PENDING_REVIEW`, `ASSIGNED`, or `IN_PROGRESS`.

### Lifecycle State Machine (`LifecycleStateMachine`)
Located in [`app/services/lifecycle.py`](file:///c:/Projects/VYASA/apps/pillars/nivaran/backend/app/services/lifecycle.py), the state machine defines the permissible transition graph across all 10 documented states:
- `SUBMITTED`
- `AI_PROCESSING`
- `PENDING_REVIEW`
- `ASSIGNED`
- `IN_PROGRESS`
- `AWAITING_INFORMATION`
- `RESOLVED`
- `ESCALATED`
- `CLOSED`
- `REOPENED`

For this phase:
- Initial filing validates `None -> SUBMITTED`.
- Illegal direct jumps (e.g., `None -> RESOLVED` or `SUBMITTED -> RESOLVED`) raise `InvalidLifecycleTransitionError` (HTTP 400).
- The state machine is structured to allow future role-based transition matrices without modifying the underlying database models.

---

## 4. Status History vs. Audit Logging

Both mechanisms are populated atomically during grievance creation, serving distinct business and compliance purposes:

| Aspect | `grievance_status_history` | `audit_logs` |
|---|---|---|
| **Purpose** | Business lifecycle audit trail | Institutional security & compliance log |
| **Initial Filing State** | `previous_status = NULL`<br>`new_status = SUBMITTED`<br>`actor_type = USER` | `action = GRIEVANCE_SUBMITTED`<br>`entity_type = Grievance`<br>`entity_id = <UUID>` |
| **Actor Reference** | `changed_by_vyasa_user_id` | `user_vyasa_id` |
| **Applicant Visibility** | Exposed safely in tracking view | **Strictly internal** (never exposed to applicants) |

---

## 5. Applicant Data Isolation & Response Sanitization

When an applicant queries their grievances via `GET /api/v1/grievances` or `GET /api/v1/grievances/{id}`, the response is sanitized through [`ApplicantGrievanceResponse`](file:///c:/Projects/VYASA/apps/pillars/nivaran/backend/app/schemas/grievance.py).

### Fields Exposed to Applicant
- `id`: Grievance primary key UUID
- `grievance_id`: Human-readable tracking code (e.g. `G-20260927-A1B2C3`)
- `title`: Grievance title
- `description`: Grievance narrative
- `subject_id`, `subject_name`, `subject_cluster_name`: Associated academic taxonomy
- `status`: Current lifecycle status (`SUBMITTED`)
- `priority`: Declared priority
- `submitted_at`, `last_action_at`: Timestamps
- `documents`: Safe attachment metadata (`id`, `file_name`, `mime_type`, `file_size`, `document_type`, `created_at`)
- `status_history`: Safe timeline entries (`new_status`, `remarks`, `changed_at`)

### Strictly Redacted / Prohibited Fields
The applicant response **NEVER** exposes:
- AI confidence metrics (`ai_confidence`)
- Review flags (`category_reviewed`, `category_overridden`)
- Authority foreign keys (`resolved_by_authority_id`, `closed_by_authority_id`, `previous_resolved_by_id`, `previous_closed_by_id`)
- Internal authority notes (`resolution_notes`, `closure_remarks`)
- Internal discussion threads (`comments`)
- System audit records (`audit_logs`)
- Committee deliberations or forwarding confirmation checklists

---

## 6. API Endpoints

### 1. Submit Grievance
- **Method / Path**: `POST /api/v1/grievances`
- **Headers**: `X-Applicant-User-Id: <UUID>`
- **Request Body**:
  ```json
  {
    "title": "Mathematics Coursework Registration Delay",
    "description": "My doctoral registration renewal for semester 3 coursework has been delayed for 4 weeks.",
    "subject_id": "8bb5d165-d602-4fc3-a9d0-6218d6e38a2c",
    "priority": "HIGH",
    "documents": [
      {
        "file_name": "fee_receipt.pdf",
        "file_path": "uploads/2026/09/fee_receipt.pdf",
        "mime_type": "application/pdf",
        "file_size": 1048576,
        "document_type": "FEE_RECEIPT",
        "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    ]
  }
  ```
- **Response**: `201 Created` with `ApplicantGrievanceResponse`.

### 2. List Filed Grievances
- **Method / Path**: `GET /api/v1/grievances`
- **Headers**: `X-Applicant-User-Id: <UUID>`
- **Response**: `200 OK` with `ApplicantGrievanceListResponse`. Only lists records where `applicant_vyasa_user_id == caller_uuid`.

### 3. Get Grievance Details
- **Method / Path**: `GET /api/v1/grievances/{grievance_id}`
- **Headers**: `X-Applicant-User-Id: <UUID>`
- **Parameter**: `grievance_id` accepts either the UUID primary key or tracking code string (`G-YYYYMMDD-XXXXXX`).
- **Response**: `200 OK` with `ApplicantGrievanceResponse`. Returns `403 Forbidden` if requested by another applicant.

---

## 7. Deferred Workflow Boundaries

To maintain strict modularity, the following capabilities are **explicitly not implemented** in this phase and are deferred to their designated architectural milestones:

- **AI Classification**: Grievance filing does NOT trigger embedding generation, semantic cluster matching, or automated category prediction.
- **Manager Triage**: No manager triage queues, unassigned ticket listings, or category override endpoints are implemented.
- **Subject Routing**: Automated assignment to Assistant Deans based on subject cluster mapping is not triggered during filing.
- **SSO / Authentication**: No JWT decoding, token signing, or local login services are built. Caller identity relies purely on gateway headers.
- **Committee Workflows & E-File**: Committee chartering, digital signatures, and dossier PDF compilation remain unmounted.
