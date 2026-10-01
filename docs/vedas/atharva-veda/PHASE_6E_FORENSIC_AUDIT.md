# PHASE 6E — NIVARAN-AI REFERENCE FORENSIC AUDIT
**ATHARVA VEDA &bull; DOCUMENT REQUESTS, EVIDENTIARY SUBMISSIONS & STATUS PAUSING LIFECYCLE**

---

## 1. Executive Summary

This forensic audit investigates the reference implementation in `C:\Projects\NIVARAN-AI` to determine the exact next workflow functionality following the Phase 6D lifecycle (Resolution &rarr; Feedback &rarr; Manager Closure &rarr; E-File &rarr; Student Master Record).

### Primary Findings
1. **Next Reference Feature**: The canonical, essential next core workflow in NIVARAN-AI is the **Document & Information Request System** (`DocumentRequest`), which enables assigned authorities to formally request additional evidence from applicants, pausing the grievance in `AWAITING_INFORMATION` and restoring the prior state upon applicant fulfillment.
2. **Database Status in VYASA**: The dedicated database table `nivaran_document_requests` was **already created** in Alembic migration `8b29c54e1004_atharva_documents_and_committees.py`. **Zero database migrations are needed**.
3. **Current State in VYASA**:
   - **Authority side**: `AssistantDeanService.request_documents` and `AssociateDeanService.request_documents` create document requests, transition grievances to `AWAITING_INFORMATION`, and record audit logs.
   - **Gaps**:
     - The applicant cannot upload documents to fulfill a specific request (`POST /grievances/{id}/document-requests/{req_id}/upload` is missing in VYASA).
     - The authority cannot review (Approve / Reject) uploaded documents (`POST /grievances/{id}/document-requests/{req_id}/review` is missing in VYASA).
     - The grievance does not automatically restore to its previous status (`ASSIGNED` or `IN_PROGRESS`) with the same authority once all required documents are fulfilled.
     - The frontend `ApplicantGrievanceDetailPage` does not render a document fulfillment / upload interface (`DocumentRequestsSection`).

---

## 2. Reference Feature Inventory

In `C:\Projects\NIVARAN-AI`:
1. **Authority Document Request Creation**:
   - Authorized authority (assigned to grievance, Manager during triage, or Dean) creates a batch of 1 or more document requests (`POST /grievances/{id}/document-requests`).
   - Grievance status transitions from current active state (`ASSIGNED` or `IN_PROGRESS`) to `AWAITING_INFORMATION`.
   - The active assignment (`assignments` record) remains **intact** and **active** (does not unassign or clear authority).
   - In-app notification and email are dispatched to applicant.
   - Audit log recorded (`DOCUMENT_REQUESTED`).
2. **Applicant Document Upload & Fulfillment**:
   - Applicant uploads a file matching the specific request (`POST /grievances/{id}/document-requests/{request_id}/upload`).
   - Validates file type (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.doc`, `.docx`, `.txt`, `.csv`, `.xlsx`, `.xls`) and size (&le; 20 MB).
   - Saves file to storage, creates `documents` record with `document_type="REQUESTED_DOCUMENT"`.
   - Updates `DocumentRequest` status to `UPLOADED`, links `uploaded_document_id`, sets `responded_at`.
   - Checks if **all required** document requests for the grievance are fulfilled (`are_all_required_documents_submitted`).
   - If all required are fulfilled: grievance status is restored to `previous_grievance_status` (or `ASSIGNED`), without altering the assigned authority.
   - Notifies authority (`DOCUMENT_UPLOADED`).
3. **Authority Document Review**:
   - Authority inspects uploaded document and reviews it (`POST /grievances/{id}/document-requests/{request_id}/review`).
   - **APPROVE**: `DocumentRequest.status = APPROVED`. Case continues in normal workflow.
   - **REJECT / REQUEST_REUPLOAD**: `DocumentRequest.status = REJECTED`. Grievance returns to `AWAITING_INFORMATION`. Applicant is notified to re-upload.

---

## 3. Reference Database Inventory

### Table: `document_requests` (Reference)
- **Primary Key**: `id` UUID
- **Foreign Keys**:
  - `grievance_id`: UUID &rarr; `grievances.id` (CASCADE)
  - `requested_by_id`: UUID &rarr; `users.id`
  - `reviewed_by_id`: UUID &rarr; `users.id` (Nullable)
  - `uploaded_document_id`: UUID &rarr; `documents.id` (SET NULL, Nullable)
- **Fields**:
  - `request_group_id`: UUID (groups multiple items created in a single batch)
  - `document_name`: VARCHAR(255)
  - `description`: TEXT
  - `is_required`: BOOLEAN (default: True)
  - `status`: ENUM (`PENDING`, `UPLOADED`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`)
  - `deadline`: TIMESTAMP WITH TIME ZONE
  - `previous_grievance_status`: VARCHAR(50)
  - `requested_at`: TIMESTAMP WITH TIME ZONE
  - `responded_at`: TIMESTAMP WITH TIME ZONE
  - `reviewed_at`: TIMESTAMP WITH TIME ZONE
  - `review_remarks`: TEXT
  - `created_at`, `updated_at`

### Table: `nivaran_document_requests` (VYASA — Already Created in Alembic `8b29c54e1004`)
- **Primary Key**: `id` UUID
- **Foreign Keys**:
  - `grievance_id`: UUID &rarr; `nivaran_grievances.id` (CASCADE)
  - `requested_by_id`: UUID &rarr; `nivaran_authorities.id` (RESTRICT)
- **Fields**:
  - `request_group_id`: UUID
  - `document_name`: VARCHAR(255)
  - `description`: TEXT
  - `due_date`: TIMESTAMP WITH TIME ZONE
  - `status`: ENUM (`PENDING`, `UPLOADED`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`)
  - `submitted_at`: TIMESTAMP WITH TIME ZONE
  - `created_at`: TIMESTAMP WITH TIME ZONE

---

## 4. Reference API Inventory

| HTTP Method | Path | Role / Authorization | Description |
|---|---|---|---|
| `POST` | `/grievances/{id}/document-requests` | Assigned Authority, Manager, Dean | Creates 1..N document requests; pauses case to `AWAITING_INFORMATION`. |
| `GET` | `/grievances/{id}/document-requests` | Applicant (own only), Authorities | Returns all document requests for the grievance. |
| `POST` | `/grievances/{id}/document-requests/{req_id}/upload` | Applicant (own grievance only) | Uploads multipart file; sets status `UPLOADED`; restores grievance status if all required met. |
| `POST` | `/grievances/{id}/document-requests/{req_id}/review` | Assigned Authority, Dean | Approves or rejects uploaded file; returns case to `AWAITING_INFORMATION` if rejected. |

---

## 5. Reference Authorization Matrix

- **Request Creation**:
  - `APPLICANT`: **Forbidden (403)**.
  - `ASSISTANT_DEAN`: Allowed **only** if actively assigned to the grievance.
  - `ASSOCIATE_DEAN`: Allowed **only** if actively assigned to the grievance.
  - `MANAGER`: Allowed during triage (`PENDING_REVIEW` or `ASSIGNED`).
  - `DEAN`: Allowed globally.
- **Viewing Requests**:
  - `APPLICANT`: Allowed for own grievances only. Requesting authority names are sanitized to "Competent Authority" to protect officer privacy.
  - `AUTHORITY`: Allowed for grievances within jurisdiction.
- **Document Upload**:
  - `APPLICANT`: Allowed **only** for own grievance, when request is in `PENDING` or `REJECTED` state, and grievance is not `CLOSED`.
  - Non-owner applicants: **Forbidden (403)**.
- **Document Review**:
  - `APPLICANT`: **Forbidden (403)**.
  - Assigned Authority / Dean: Allowed when request is in `UPLOADED` state and grievance is not `RESOLVED` / `CLOSED`.

---

## 6. Reference State Machine

```
              ┌──────────────────────────────────────────────────┐
              │                                                  │
              ▼                                                  │
         [ PENDING ] ──(Applicant Uploads File)──► [ UPLOADED ]  │
              ▲                                         │        │
              │                                         │        │
    (Authority Rejects)                                 │        │
              │                                         │        │
              └────────────── [ REJECTED ] ◄────────────┤        │
                                                        │        │
                                               (Authority Approves)
                                                        │        │
                                                        ▼        │
                                                   [ APPROVED ]  │
                                                                 │
[ PENDING / REJECTED ] ──(Deadline Passes Without Action)──► [ EXPIRED ]
```

### Grievance State Interactions
- When request is issued: Grievance transitions to `AWAITING_INFORMATION` from prior state (`ASSIGNED` or `IN_PROGRESS`). The prior state is stored in `previous_grievance_status`.
- When applicant fulfills all required requests: Grievance transitions back from `AWAITING_INFORMATION` to `previous_grievance_status` (or `ASSIGNED`). Assigned authority is unchanged.
- If an uploaded document is rejected by authority: Grievance is returned to `AWAITING_INFORMATION`.

---

## 7. Reference Notification Matrix

1. **Document Request Issued**:
   - In-app notification to Applicant: Title `"Additional Document(s) Required"`, Type `DOCUMENT_REQUESTED`.
   - Email notification to Applicant: via `send_document_request_email`.
2. **Document Uploaded**:
   - In-app notification to Authority: Title `"Requested Document Uploaded"` or `"All Requested Documents Received"`, Type `DOCUMENT_UPLOADED`.
3. **Document Approved**:
   - In-app notification to Applicant: Title `"Document Approved"`, Type `DOCUMENT_APPROVED`.
4. **Document Rejected**:
   - In-app notification to Applicant: Title `"Document Re-upload Required"`, Type `DOCUMENT_REJECTED`.

---

## 8. Reference Watchdog / Audit Matrix

Every lifecycle event creates an immutable `AuditLog` row:
- `DOCUMENT_REQUESTED`: `user_id`, `grievance_id`, list of requested document names.
- `DOCUMENT_UPLOADED`: `user_id` (Applicant), `entity_type="DOCUMENT_REQUEST"`, sanitized filename.
- `DOCUMENT_APPROVED`: `user_id` (Authority), `entity_id` (Request ID), remarks.
- `DOCUMENT_REJECTED`: `user_id` (Authority), `entity_id` (Request ID), rejection reason.

---

## 9. Reference Frontend Inventory

- **`RequestDocumentModal.jsx`**: Modal for authorities to add multiple document requirements, choose from common presets (Fee Payment Receipt, Supervisor NOC, Grade Card, etc.), specify deadline, and commit request.
- **`DocumentRequestsSection.jsx`**: Rendered in grievance detail page:
  - For Applicant: Displays required documents, status badges, due date, and file upload zone with file-size/extension validation.
  - For Authority: Displays submitted documents, download/preview links, and Approve / Reject action buttons.
- **`documentRequestService.js`**: Frontend API client handling `requestDocuments`, `getDocumentRequests`, `uploadRequestedDocument`, and `reviewRequestedDocument`.

---

## 10. VYASA Existing Implementation Inventory

| Component | VYASA File | Current Implementation Status |
|---|---|---|
| Database Table | `nivaran_document_requests` (in Alembic `8b29c54e1004`) | **IMPLEMENTED** in DB schema. |
| Model | [`document.py`](file:///C:/Projects/VYASA/backend/app/modules/atharva_veda/nivaran/models/document.py) (`DocumentRequest`) | **IMPLEMENTED** (Missing relationships to `uploaded_document` and review fields in model). |
| Authority Request API | `POST /assistant-dean/grievances/{id}/document-requests`, `POST /associate-dean/...` | **IMPLEMENTED**. |
| List Requests API | `GET /grievances/{id}/document-requests` in [`router.py`](file:///C:/Projects/VYASA/backend/app/modules/atharva_veda/nivaran/router.py) | **IMPLEMENTED**. |
| Applicant Upload API | `POST /grievances/{id}/document-requests/{req_id}/upload` | **MISSING**. |
| Authority Review API | `POST /grievances/{id}/document-requests/{req_id}/review` | **MISSING**. |
| State Restoration Engine | Auto-restore to `ASSIGNED` when all required documents uploaded | **MISSING**. |
| Frontend Modal | [`RequestDocumentModal.tsx`](file:///C:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/components/RequestDocumentModal.tsx) | **IMPLEMENTED**. |
| Frontend Section | `DocumentRequestsSection.tsx` (Fulfillment + Review) | **MISSING**. |
| Tests | Backend test suite for document request fulfillment & status restore | **MISSING**. |

---

## 11. Reference vs VYASA Parity Matrix

| Feature | Reference Status | VYASA Status | Parity Classification |
|---|---|---|---|
| Issue Document Request | Fully working | Working for Asst/Assoc Dean | **PARTIALLY_IMPLEMENTED** |
| Pause case in `AWAITING_INFORMATION` | Yes | Yes | **IMPLEMENTED** |
| Applicant List Document Requests | Yes | Yes (`GET /grievances/{id}/document-requests`) | **IMPLEMENTED** |
| Applicant Upload Document to Request | Yes (`POST .../upload`) | Not implemented | **MISSING** |
| Restore status when fulfilled | Yes (restores to previous state) | Not implemented | **MISSING** |
| Authority Review (Approve/Reject) | Yes (`POST .../review`) | Not implemented | **MISSING** |
| Frontend Applicant Fulfillment UI | Yes (`DocumentRequestsSection`) | Not implemented | **MISSING** |
| Frontend Authority Review UI | Yes (`DocumentRequestsSection`) | Not implemented | **MISSING** |

---

## 12. Missing Features

1. **Backend Service Methods**:
   - `fulfill_document_request(db, grievance_id, request_id, file, applicant)`
   - `review_document_request(db, grievance_id, request_id, authority, payload)`
   - `are_all_required_documents_submitted(db, grievance)` helper.
2. **Backend API Endpoints**:
   - `POST /grievances/{grievance_id}/document-requests/{request_id}/upload`
   - `POST /grievances/{grievance_id}/document-requests/{request_id}/review`
3. **Frontend Components & Integration**:
   - `DocumentRequestsSection.tsx` providing applicant file upload controls and authority review controls.
   - Integration of `DocumentRequestsSection` into [`ApplicantGrievanceDetailPage.tsx`](file:///C:/Projects/VYASA/frontend/src/modules/atharva-veda/nivaran/pages/ApplicantGrievanceDetailPage.tsx) and authority detail pages.

---

## 13. Partial Features

1. **Model `DocumentRequest`**:
   - Exists in [`backend/app/modules/atharva_veda/nivaran/models/document.py`](file:///C:/Projects/VYASA/backend/app/modules/atharva_veda/nivaran/models/document.py), but needs mapping for `uploaded_document_id`, `previous_grievance_status`, `reviewed_by_id`, and `review_remarks` to enable review and restore workflows.
2. **Authority Request Creation**:
   - Currently implemented in `AssistantDeanService` and `AssociateDeanService`, but needs to store `previous_grievance_status` so the case can be restored correctly when the applicant responds.

---

## 14. Intentional Differences

1. **Authority Identity Structure**:
   - Reference binds `requested_by_id` directly to `users.id`.
   - VYASA binds `requested_by_id` to `nivaran_authorities.id` (with Core `users.id` resolved via authority).
2. **Applicant Privacy**:
   - VYASA preserves the reference rule that when applicants view document requests, authority names/roles are masked to "Competent Authority" unless policy dictates disclosure.

---

## 15. Database Reuse Opportunities

- The database table `nivaran_document_requests` is **already created** with columns for `grievance_id`, `requested_by_id`, `request_group_id`, `document_name`, `description`, `due_date`, `status`, `submitted_at`, and `created_at`.
- Supporting documents are stored in `nivaran_documents` with `document_type='REQUESTED_DOCUMENT'`.
- **Zero database migrations required**.

---

## 16. Required Implementation Order for Phase 6E

1. **Step 1: Models & Schemas Update**:
   - Add fulfillment and review schemas (`DocumentRequestUploadResponse`, `DocumentRequestReviewPayload`).
   - Enhance `DocumentRequest` model with `uploaded_document_id`, `previous_grievance_status`, `reviewed_by_id`, `review_remarks`.
2. **Step 2: Service Layer**:
   - Implement `DocumentRequestService` handling fulfillment, file validation, storage, status restoration to `previous_grievance_status`, authority notifications, and review (Approve/Reject).
3. **Step 3: API Routing**:
   - Add `POST .../{request_id}/upload` and `POST .../{request_id}/review` endpoints with strict RBAC and ownership verification.
4. **Step 4: Frontend Components**:
   - Implement `DocumentRequestsSection.tsx` and integrate it into `ApplicantGrievanceDetailPage.tsx` and authority detail pages.
5. **Step 5: Automated Testing**:
   - Create end-to-end integration test suite (`test_atharva_document_request_lifecycle.py`) verifying the complete cycle: Request &rarr; `AWAITING_INFORMATION` &rarr; Upload &rarr; Status Restore &rarr; Approve/Reject.

---

## 17. Security & IDOR Requirements

- Applicants may only upload to document requests belonging to their own grievances (`grievance.applicant_vyasa_user_id == current_user.id`).
- Document requests cannot be uploaded once a grievance is `CLOSED`.
- Authorities may only review document requests for grievances assigned to their jurisdiction.
- File uploads must validate extension, MIME type, and size limit (&le; 20 MB).

---

## 18. Audit Confirmation

- **Non-mutating verification**: Zero database changes, zero code changes, zero migrations executed during this audit.
- **Reference pristine**: `C:\Projects\NIVARAN-AI` remains completely untouched.
- **VYASA Alembic head**: Remains at `8b29c54e1005 (head)`.
