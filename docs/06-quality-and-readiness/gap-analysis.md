# VYASA-N — COMPREHENSIVE GAP ANALYSIS & SYSTEM READINESS

**Audit Date:** November 7, 2026  
**Auditor Classification:** Principal Software Architect & Technical Reviewer  
**Methodology:** Full-Stack Code Review, Structural Audit, Deployment & Operational Gap Analysis  

---

## 1. System-Wide Gap Analysis Summary

While VYASA-N exhibits advanced functionality and architectural integrity across its core pillars, specific operational, technical, and UX gaps must be bridged before the platform is deployed for university-wide production use.

---

## 2. Detailed Subsystem Gaps

### A. Core Platform & Identity Gaps
1. **Administrative Account Unlock Workflow (Operational - Medium):**
   - *Current State:* Accounts locked after 5 consecutive failed attempts remain locked for the full 15-minute window.
   - *Missing Component:* No administrative unlock button exists in the Administration Console. If the Vice Chancellor or Dean is locked out, administrators cannot override the lockout without direct database manipulation.
2. **Dynamic Password Policy Configuration (Governance - Low):**
   - *Current State:* Password complexity (minimum 8 characters, upper, lower, number) is hardcoded in Python services.
   - *Missing Component:* No UI exists for the Registrar to customize password length or expiration intervals.

### B. Atharva Veda &bull; NIVARAN-AI Gaps
1. **WebSocket Client Route Prefix Defect (Technical - Critical P0):**
   - *Current State:* Client connects to `/api/v1/modules/atharva-veda/nivaran/committees/{id}/ws`.
   - *Actual Backend Mount:* Registered under `/api/modules/atharva-veda/nivaran/committees/{id}/ws`.
   - *Impact:* Real-time committee chat fails, forcing fallback to HTTP polling.
2. **Multi-Worker WebSocket Concurrency Synchronization (Architecture - High P1):**
   - *Current State:* Sockets are held in an in-memory dictionary.
   - *Missing Component:* Distributed pub/sub message broker (Redis or Postgres Notify) is required to distribute chat frames across multiple Uvicorn worker threads or Docker containers.
3. **Dedicated Activity History Audit Feed (UX - Low P2):**
   - *Current State:* Tab 8 (Activity History) in `CommitteeWorkspacePage.tsx` synthesizes a timeline from recent meetings and decisions.
   - *Missing Component:* A dedicated server-side `/committees/{id}/audit` feed endpoint tracking granular member join/leave and viewing events.

### C. Sama Veda &bull; ANVESHAN / SAMIKSHA Gaps
1. **Automated Scopus / Crossref API Synchronization (Integration - Medium P2):**
   - *Current State:* Publications are imported via bulk Excel/CSV or entered manually via CMS.
   - *Missing Component:* Automated nightly synchronization with Scopus or Crossref APIs using university affiliation IDs (`AF-ID: 60000000`).
2. **Author Disambiguation Merge Tool (Data - Low P3):**
   - *Current State:* If two authors share identical names, the system resolves them by email.
   - *Missing Component:* Dedicated administrative UI to merge duplicate author profiles.

### D. Public Ph.D. RAG Gaps
1. **Administrative Document Upload UI (Operational - Medium P2):**
   - *Current State:* Ingestion of new ordinance PDFs requires developer CLI execution (`python -m app.modules.phd_rag.cli ingest`).
   - *Missing Component:* Web-based upload form in the Admin console allowing university admissions officers to upload new brochures with automated re-indexing.
2. **Vector Database Scalability (Architecture - Medium P2):**
   - *Current State:* Embeddings are queried via cosine similarity calculations in Python memory/SQL queries.
   - *Recommendation:* Enable `pgvector` extension in PostgreSQL for scalable vector indexing as the document corpus grows.

### E. Storage & Cloud Infrastructure Gaps
1. **Enforcement of Remote Object Storage in Production (Operational - High P1):**
   - *Current State:* System defaults to local filesystem storage (`storage/uploads/`).
   - *Operational Risk:* In containerized cloud environments (e.g., Render), local uploads are wiped upon container restarts.
   - *Requirement:* Ensure production environment templates mandate `STORAGE_PROVIDER=spaces`.
