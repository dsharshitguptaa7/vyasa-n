# VYASA-n Unresolved Questions & Evidence Gaps
**Document Version:** 2.0.0 (Post-Validation & Empirical Audit)  
**Date:** November 2026  
**Auditor:** Principal Software Architect & Senior Technical Auditor  
**Scope:** Ecosystem-Wide Empirical Gaps Requiring Staging Environment Access or Authority Decisions

---

## 1. Executive Summary

While static code analysis, route introspection, and database-free unit test execution have achieved an empirical understanding of VYASA-n's architecture, certain behaviors cannot be verified without interacting with external cloud infrastructure, live third-party APIs, or institutional authority decisions.

This document enumerates the **eight critical evidence gaps and unresolved questions** that require resolution prior to full production cutover.

---

## 2. Itemized Evidence Gaps & Operational Questions

```mermaid
graph TD
    G1["1. Live DigitalOcean Spaces S3 Verification"]
    G2["2. Google Meet OAuth Token Refresh"]
    G3["3. Redis Pub/Sub for WebSockets"]
    G4["4. DigitalOcean App Platform Spec (.do/app.yaml)"]
    G5["5. Execution of 325 Blocked Integration Tests"]
    G6["6. SMTP / SendGrid Outbound Email Delivery"]
    G7["7. Ph.D. RAG Vector Persistence in Production"]
    G8["8. Rig Veda & Yajur Veda Institutional Timeline"]

    G1 --- G2 --- G3 --- G4
    G5 --- G6 --- G7 --- G8
```

---

### Gap 1: Live DigitalOcean Spaces S3 Upload & Presigned URL Validation
- **Category:** Infrastructure & Storage
- **Code Reference:** `backend/app/core/config.py#L74-L82`, `backend/app/services/storage.py`
- **Current Observation:** The codebase implements S3-compatible file storage routines using `boto3` / `aioboto3` targeting bucket `vyasa-n-documents` at `https://sgp1.digitaloceanspaces.com`. However, in the local development environment, `STORAGE_PROVIDER` defaults to `local` (`storage/uploads/`).
- **Unresolved Questions:**
  1. Have CORS rules been applied to the `vyasa-n-documents` bucket in DigitalOcean Spaces to allow direct browser-to-S3 uploads (if applicable)?
  2. Are presigned URLs correctly configured to expire within 15 minutes, and do they work across institutional firewalls?
- **Required Action:** Run an end-to-end file upload test against a staging Spaces bucket using active DigitalOcean access credentials.

---

### Gap 2: Google Meet OAuth Refresh Token Lifecycle
- **Category:** External Integration & Deliberation
- **Code Reference:** `backend/app/modules/atharva_veda/nivaran/services/google_meet.py`
- **Current Observation:** Atharva Veda committee meetings can automatically generate Google Meet links via the Google Calendar API. The code assumes offline access with a persistent refresh token.
- **Unresolved Questions:**
  1. In the event that a Google OAuth token expires during an extended committee hearing, does the automatic refresh interceptor handle reconnection seamlessly without interrupting the UI?
  2. Has the Google Cloud project passed verification, or is it operating under Google's 100-user unverified test app limit?
- **Required Action:** Execute an automated token expiration and refresh test using the institutional Google Workspace service account.

---

### Gap 3: Redis Pub/Sub for Multi-Worker WebSocket Broadcasting
- **Category:** Scalability & High Availability
- **Code Reference:** `backend/app/modules/atharva_veda/nivaran/services/committee_chat_ws.py#L32`
- **Current Observation:** Active WebSocket connections are tracked in an in-memory dictionary (`self._rooms: Dict[UUID, Set[WebSocket]] = {}`).
- **Unresolved Questions:**
  1. What is the institutional deployment topology for the backend? If Uvicorn runs with `--workers > 1` or across multiple container replicas, messages will be partitioned across workers.
  2. Is a managed Redis instance (e.g., DigitalOcean Managed Redis) provisioned to support distributed WebSocket pub/sub?
- **Required Action:** Introduce an optional Redis broadcast adapter into `committee_chat_ws.py` to ensure high availability across multi-worker deployments.

---

### Gap 4: DigitalOcean App Platform Specification (`.do/app.yaml`)
- **Category:** DevOps & CI/CD
- **Code Reference:** Repository root contains `render.yaml`, `Dockerfile`, `frontend/vercel.json`, and `frontend/nginx.conf`.
- **Current Observation:** While `safety_guard.py` explicitly identifies the DigitalOcean Bangalore Managed PostgreSQL cluster as the production database, the repository lacks a declarative `.do/app.yaml` file defining container resource sizing, autoscaling rules, environment variable bindings, and build commands for DigitalOcean App Platform.
- **Unresolved Questions:**
  1. Is the application deployed to DigitalOcean via App Platform web console, a custom Kubernetes cluster (DOKS), or standalone Droplets?
  2. Is the App Platform configuration tracked in an external private repository or CI pipeline?
- **Required Action:** Export and check in the authoritative `.do/app.yaml` or Kubernetes manifests into the repository under `deployment/digitalocean/`.

---

### Gap 5: Execution of 325 Safety-Blocked Integration Tests
- **Category:** Test Assurance & Data Integrity
- **Code Reference:** `backend/tests/safety_guard.py#L80-L88`
- **Current Observation:** 325 backend tests were safely blocked from executing because they require live PostgreSQL transactions, and `safety_guard.py` correctly prevents tests from touching the production Bangalore cluster or the Neon development pooler.
- **Unresolved Questions:**
  1. What is the exact pass/fail rate of these 325 tests when run against a fully migrated, clean schema?
  2. Are there latent schema drift issues or foreign key constraint mismatches between Alembic migrations and SQLAlchemy models?
- **Required Action:** Spin up an ephemeral local PostgreSQL container (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=test postgres:16-alpine`), export `TEST_DATABASE_URL=postgresql+asyncpg://postgres:test@localhost:5432/vyasa_test`, and execute the complete test suite.

---

### Gap 6: Outbound Email & SMS Notification Delivery
- **Category:** Communication & Security
- **Code Reference:** `backend/app/core/security/email.py`, `backend/app/core/config.py#L65-L72`
- **Current Observation:** Grievance filing receipts, committee summons, and MFA codes invoke `security_email_service`. The development environment logs emails to the console (`DEBUG` mode).
- **Unresolved Questions:**
  1. What SMTP gateway or transactional email provider (SendGrid, AWS SES, Postmark) is configured for production?
  2. Are SPF, DKIM, and DMARC DNS records configured on the university's domain to prevent notification emails from landing in spam/junk folders?
- **Required Action:** Validate outbound email delivery to institutional email addresses (`@university.edu`) from the staging environment.

---

### Gap 7: Production Vector Persistence for Ph.D. RAG Engine
- **Category:** Artificial Intelligence & Storage
- **Code Reference:** `backend/app/modules/phd_rag/service.py`
- **Current Observation:** The Ph.D. Admission RAG engine uses local ChromaDB storage for embedding retrieval during development.
- **Unresolved Questions:**
  1. In a multi-container cloud environment, local ChromaDB files will not synchronize between replicas. Will production utilize the `pgvector` extension inside the DigitalOcean Managed PostgreSQL database, or an external vector service?
  2. What is the institutional token quota and budget for the underlying LLM provider (Gemini API / OpenAI API)?
- **Required Action:** Confirm whether pgvector is enabled on the DigitalOcean Bangalore cluster (`CREATE EXTENSION IF NOT EXISTS vector;`) and verify migration readiness.

---

### Gap 8: Institutional Prioritization of Rig Veda & Yajur Veda
- **Category:** Strategic Governance & Roadmap
- **Code Reference:** `backend/app/modules/rig_veda/`, `backend/app/modules/yajur_veda/`
- **Current Observation:** Rig Veda (Faculty Recognition) is 53.0% ready, and Yajur Veda (Academic Collaboration) is 46.8% ready. Both modules have complete schemas and baseline CRUD routers, but workflow transitions and peer review scoring remain incomplete.
- **Unresolved Questions:**
  1. Is the initial institutional launch strictly scoped to Atharva Veda (NIVARAN Grievances) and Sama Veda (ANVESHAN Research)?
  2. Should Rig Veda and Yajur Veda be disabled via feature flags during the Phase 1 release to avoid end-user confusion?
- **Required Action:** Institutional leadership (Dean / Vice Chancellor / IT Steering Committee) must sign off on the Phase 1 vs. Phase 2 module rollout schedule.
