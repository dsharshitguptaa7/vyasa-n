# VYASA-N — PRODUCTION DEPLOYMENT & MAINTENANCE RUNBOOK

**Target Audience:** DevOps Engineers, System Administrators, Release Managers  
**Auditor Classification:** Principal DevOps Architect  
**Audit Date:** November 7, 2026  

---

## 1. Production Release Checklist (Pre-Flight)

Before deploying a new release or hotfix to staging or production, verify all pre-flight invariants:

- [ ] **Cryptographic Secret Verification:** Ensure `SECRET_KEY` is set to a secure, randomly generated 64-character string (never use the default development string).
- [ ] **TOTP Key Verification:** Ensure `TOTP_ENCRYPTION_KEY` is configured with a valid 32-byte URL-safe base64 Fernet key.
- [ ] **Database Migration Status:** Verify all 19 Alembic migrations have been applied to the production database (`alembic upgrade head`).
- [ ] **Cloud Storage Configuration:** Confirm `STORAGE_PROVIDER=spaces` with verified DigitalOcean Spaces bucket name, region, endpoint, access key, and secret key.
- [ ] **Email Delivery Configuration:** Confirm `EMAIL_ENABLED=True` and `BREVO_API_KEY` is provisioned and funded.
- [ ] **Frontend Build Verification:** Execute `npm run --prefix frontend build` and verify Exit Code 0.
- [ ] **CORS Origin Whitelist:** Confirm `CORS_ORIGIN` includes only the official university domains (e.g. `https://vyasa.csjmu.ac.in`).

---

## 2. Deployment Procedures

### Procedure A: Automated Deploy via Render (`render.yaml`)

1. **Commit and Push:** Push approved release commit to the designated release branch (e.g., `main` or `production`).
2. **Render Web Service Deployment:**
   - Render detects repository webhook.
   - Executes backend build command: `pip install -r requirements.txt`.
   - Starts application worker: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - Executes database lifespan startup verification and seeding.
3. **Render Static Site Deployment:**
   - Executes frontend build command: `npm run build`.
   - Deploys static build artifact (`./dist`) across global CDN edge nodes.
4. **Post-Deploy Smoke Test:**
   - Query `GET /api/health` to confirm liveness.
   - Query `GET /api/health/db` to confirm database connectivity.
   - Test applicant login and public certificate verification portal.

---

### Procedure B: Docker Container Deployment

```bash
# 1. Build Production Docker Image
docker build -t csjmu/vyasa-backend:1.0.0 -f Dockerfile .

# 2. Run Container with Production Environment
docker run -d \
  --name vyasa-backend-prod \
  -p 8000:8000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgresql+psycopg://..." \
  -e SECRET_KEY="..." \
  -e TOTP_ENCRYPTION_KEY="..." \
  -e STORAGE_PROVIDER=spaces \
  -e SPACES_BUCKET="vyasa-n-documents" \
  -e SPACES_ACCESS_KEY_ID="..." \
  -e SPACES_SECRET_ACCESS_KEY="..." \
  -e EMAIL_ENABLED=True \
  -e BREVO_API_KEY="..." \
  --restart unless-stopped \
  csjmu/vyasa-backend:1.0.0
```

---

## 3. Database Backup & Disaster Recovery Runbook

### Neon Serverless PostgreSQL Backups:
- **Point-in-Time Restore (PITR):** Neon maintains automated continuous write-ahead log (WAL) backups allowing instant restoration to any point within the preceding 7–30 days.
- **Manual Cold Backup Dump:**
  Execute prior to applying major schema migrations:
  ```bash
  pg_dump -d "$DATABASE_URL" -F c -b -v -f "vyasa_backup_$(date +%Y%m%d_%H%M%S).dump"
  ```
- **Disaster Recovery Restoration:**
  ```bash
  pg_restore -d "$TARGET_DATABASE_URL" -v "vyasa_backup_20261107_120000.dump"
  ```

---

## 4. Rollback Strategy

If a deployment introduces a critical regression:
1. **Frontend Rollback:** In Render / Vercel dashboard, click **Rollback to Previous Deploy** (instant atomic CDN pointer switch).
2. **Backend Rollback:**
   - Re-deploy previous stable container image or commit.
   - If database schema changed, downgrade migration using Alembic:
     ```bash
     alembic downgrade -1
     ```
3. **Notify System Operators:** Emit an audit incident notice to the university IT leadership.
