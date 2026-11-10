# VYASA-N — SECURITY & ACCESS CONTROL CODE AUDIT

**Audit Date:** November 7, 2026  
**Auditor Classification:** Lead Security Reviewer & Application Security Specialist  
**Methodology:** Read-Only Static Code Analysis, Configuration Review, Cryptographic Verification  

---

## 1. Executive Security Summary

The VYASA-N codebase demonstrates a mature, security-conscious architecture, particularly regarding authentication challenges, password hashing, and granular database constraints. Notable positive implementations include:
- **Canonical Password Hashing:** Uses PBKDF2-HMAC-SHA256 with random salts and 100,000 iterations.
- **Fail-Closed Secrets Management:** In production (`NODE_ENV=production`), the application refuses to boot if default secret keys or unencrypted TOTP seeds are detected.
- **Database Isolation Safeguards:** Test execution is strictly forbidden against production database hosts.
- **Fernet Encryption at Rest:** Authority TOTP secret seeds are encrypted with AES-128 in CBC mode with HMAC-SHA256 authenticated encryption using a dedicated Fernet key.
- **Tamper-Evident Hashing:** Committee ballots and completed e-Files record immutable SHA-256 digests.

However, several critical and high-priority vulnerabilities were uncovered that must be addressed prior to institutional rollout.

---

## 2. Security Findings Ledger

### Finding SEC-001: WebSocket Protocol Route Mismatch Causes Connection Failure
- **Severity:** **Critical (P0)**
- **Affected Component:** `frontend/src/modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx#L134`
- **Description:** The client attempts to open a WebSocket connection to `ws://${host}/api/v1/modules/atharva-veda/nivaran/committees/${id}/ws`. However, the backend router in `backend/app/modules/atharva_veda/nivaran/router.py` is mounted without the `/v1` prefix (`/api/modules/atharva-veda/nivaran/committees/{id}/ws`).
- **Potential Impact:** Real-time in-camera committee chat completely fails to establish over WebSocket, forcing a fallback to REST polling and degrading hearing responsiveness.
- **Remediation:** Remove `/v1` from the WebSocket URL in `CommitteeWorkspacePage.tsx` to match the backend mount prefix.
- **Verification Status:** Verified via static code inspection.

---

### Finding SEC-002: In-Memory WebSocket Concurrency Across Multiple Workers
- **Severity:** **High (P1)**
- **Affected Component:** `backend/app/modules/atharva_veda/nivaran/services/committee_chat_ws.py#L32`
- **Description:** The `CommitteeChatConnectionManager` maintains active client WebSocket connections in an in-memory Python dictionary (`self._rooms: Dict[str, Set[WebSocket]]`).
- **Potential Impact:** In a production multi-worker deployment (e.g. `uvicorn --workers 4` or multiple Docker container instances), committee members connected to Worker A will not receive chat messages or meeting status broadcasts emitted by members connected to Worker B.
- **Remediation:** Implement a distributed pub/sub broker (Redis or PostgreSQL `LISTEN/NOTIFY`) to synchronize broadcast events across worker processes.
- **Verification Status:** Verified via code analysis.

---

### Finding SEC-003: Default Ephemeral Local Storage Fallback
- **Severity:** **High (P1)**
- **Affected Component:** `backend/app/core/config.py#L27-L30`, `backend/app/core/storage/local.py`
- **Description:** `STORAGE_PROVIDER` defaults to `local`. Uploaded affidavits and generated e-Files are written to the local disk path `storage/uploads/`.
- **Potential Impact:** On cloud container hosts (such as Render or Kubernetes with ephemeral root disks), container restarts or redeployments wipe all locally stored evidence and sealed e-File PDFs, causing permanent data loss for students and committees.
- **Remediation:** In production deployment configuration, mandate `STORAGE_PROVIDER=spaces` with configured S3 bucket credentials. Configure a startup assertion ensuring local storage is forbidden in production environments.
- **Verification Status:** Verified via configuration review.

---

### Finding SEC-004: Potential Timing Discrepancy on Password Verification
- **Severity:** **Low (P3)**
- **Affected Component:** `backend/app/api/routes/auth.py#L228`
- **Description:** When an unknown email address is supplied during login, the system immediately records a failed attempt and raises `HTTP 401 Unauthorized` without computing a dummy hash.
- **Potential Impact:** A malicious actor measuring server response latency can differentiate between valid registered emails and invalid emails based on the ~50ms computation time of PBKDF2 hashing.
- **Remediation:** Perform a constant-time dummy hash computation (`verify_password("dummy", DUMMY_HASH)`) when an email is not found before raising `HTTP 401`.
- **Verification Status:** Verified via code analysis.

---

### Finding SEC-005: Absence of Automated Account Lockout Reset
- **Severity:** **Low (P3)**
- **Affected Component:** `backend/app/api/routes/auth.py#L195-L210`
- **Description:** After 5 consecutive failed attempts, the account enters a 15-minute temporary lockout. However, there is no administrative manual unlocking endpoint in the Admin Console.
- **Potential Impact:** A locked-out university Dean or Registrar must wait for the full lockout window to elapse without administrative override capabilities.
- **Remediation:** Provide an administrative `POST /api/admin/users/{id}/unlock` endpoint for Super Admins.
- **Verification Status:** Verified via code inspection.

---

## 3. Cryptographic & Data Protection Controls

| Security Control | Implementation | Verification State |
| :--- | :--- | :--- |
| **Password Storage** | PBKDF2-HMAC-SHA256 (100k rounds, salt) | **Verified & Compliant** |
| **TOTP Secret Protection** | AES-128-CBC + HMAC-SHA256 via Fernet | **Verified & Compliant** |
| **Ballot Anonymity** | SHA-256 Hashing of Voter Member + Poll ID | **Verified & Compliant** |
| **E-File Integrity** | SHA-256 Digest of Full Dossier PDF | **Verified & Compliant** |
| **Session Tokens** | HS256 JWT with 60-minute expiration | **Verified & Compliant** |
| **Upload File Security** | Magic Byte Verification (PDF, PNG, JPG, DOCX, XLSX) | **Verified & Compliant** |
| **Path Traversal Defense** | Strict canonical resolution (`Path.resolve()`) | **Verified & Compliant** |
| **SQL Injection Defense** | Parameterized queries via SQLAlchemy 2.0 ORM | **Verified & Compliant** |
| **Rate Limiting** | 20 req/min/IP on public Ph.D. RAG assistant | **Verified & Compliant** |
