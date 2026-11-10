# VYASA-N — INCIDENT RESPONSE & TROUBLESHOOTING GUIDE

**Target Audience:** DevOps Engineers, On-Call Engineers, System Administrators  
**Auditor Classification:** Principal Technical Auditor & Support Specialist  
**Audit Date:** November 7, 2026  

---

## 1. Common Operational Errors & Remediations

### Incident 1: Backend Fails to Start with `ValueError: Production configuration error: TOTP_ENCRYPTION_KEY is strictly required`
- **Symptom:** Backend process crashes immediately upon startup when `NODE_ENV=production`.
- **Root Cause:** In production mode, the application enforces cryptographic invariants ([`config.py#L120-L164`](file:///c:/Projects/VYASA/backend/app/core/config.py#L120-L164)). If `TOTP_ENCRYPTION_KEY` is missing, blank, or not a valid 32-byte URL-safe base64 Fernet key, it refuses to start.
- **Remediation:** Generate a compliant Fernet key using Python:
  ```python
  from cryptography.fernet import Fernet
  print(Fernet.generate_key().decode())
  ```
  Set the resulting string as `TOTP_ENCRYPTION_KEY` in the environment.

---

### Incident 2: Database Connection Timeout or Pool Saturation (`QueuePool limit of size 5 overflow 10 reached`)
- **Symptom:** API routes return `HTTP 500 Internal Server Error` with SQLAlchemy `TimeoutError`.
- **Root Cause:** Database connection pool exhausted. Active connections not returned to the pool due to long-running uncommitted transactions or slow analytical queries.
- **Remediation:**
  1. Inspect active pool metrics: `GET /api/watchdog/metrics`.
  2. Increase pool size and max overflow in `.env`:
     ```ini
     DB_POOL_SIZE=10
     DB_MAX_OVERFLOW=20
     ```
  3. Ensure all custom routes use the dependency `db: Session = Depends(get_db)` so sessions close automatically upon response emission.

---

### Incident 3: Committee Workspace Real-Time Chat Fails / Shows Disconnected
- **Symptom:** Chat messages in `CommitteeWorkspacePage` do not appear immediately without manual page refresh.
- **Root Cause:** Known P0 issue where frontend connects to `/api/v1/.../ws` while backend route is mounted at `/api/.../ws` (Finding SEC-001).
- **Remediation:** Edit line 134 in `frontend/src/modules/atharva-veda/nivaran/pages/CommitteeWorkspacePage.tsx` to remove `/v1`. Rebuild and redeploy frontend.

---

### Incident 4: Uploaded Affidavits Missing After Server Redeploy
- **Symptom:** Clicking a document download link returns `404 Not Found` with message `Storage file not found`.
- **Root Cause:** Container host redeployed while `STORAGE_PROVIDER` was configured as `local`. Ephemeral disk storage was wiped.
- **Remediation:** Migrate storage to DigitalOcean Spaces:
  ```ini
  STORAGE_PROVIDER=spaces
  SPACES_BUCKET=vyasa-n-documents
  SPACES_REGION=sgp1
  SPACES_ENDPOINT_URL=https://sgp1.digitaloceanspaces.com
  SPACES_ACCESS_KEY_ID=<your-access-key>
  SPACES_SECRET_ACCESS_KEY=<your-secret-key>
  ```

---

### Incident 5: Applicant Cannot Submit New Grievance (`400 Bad Request: Active quota exceeded`)
- **Symptom:** Student receives error: `You have reached the maximum allowed limit of 3 active grievances.`
- **Root Cause:** Intentional anti-spam policy limit ([`submission_restriction_service.py`](file:///c:/Projects/VYASA/backend/app/modules/atharva_veda/nivaran/services/submission_restriction_service.py)). The applicant already has 3 cases in non-final statuses (`SUBMITTED`, `UNDER_REVIEW`, `ASSIGNED`, `REFERRED`).
- **Remediation:** Inform the student that they must wait for at least one active grievance to reach `CLOSED` status before filing a new case. If urgent, a Case Manager or Dean can expedite closure.
