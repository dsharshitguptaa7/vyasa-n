# VYASA-N — DEPLOYMENT & INFRASTRUCTURE ARCHITECTURE

**Audit Date:** November 7, 2026  
**Auditor Classification:** Senior DevOps & Cloud Infrastructure Engineer  
**Verified Configurations:** `render.yaml`, `Dockerfile`, `frontend/vercel.json`, `frontend/nginx.conf`  

---

## 1. Verified Deployment Topologies

The repository includes explicit, version-controlled deployment configurations for two primary deployment environments:

### Topology A: Render Cloud Native Infrastructure (`render.yaml`)

```yaml
services:
  - type: web
    name: vyasa-backend
    env: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.9
      - key: CORS_ORIGIN
        sync: false

  - type: static
    name: vyasa-frontend
    rootDir: frontend
    buildCommand: npm run build
    staticPublishPath: ./dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
```

- **Backend Service:** Managed Python web service executing `uvicorn app.main:app` on port dynamically assigned by `$PORT`.
- **Frontend Static Site:** High-performance static web hosting publishing `./dist`. SPA rewrite rule rewrites all non-file routes (`/*`) to `/index.html` to allow client-side HTML5 history routing.

---

### Topology B: Containerized Docker Deployment (`Dockerfile`)

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

WORKDIR /app/backend

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

- **Base Image:** `python:3.12-slim` (Debian minimal distribution).
- **System Dependencies:** `build-essential` and `libpq-dev` installed for compiling PostgreSQL C-bindings if required, then cleaned to minimize image size.
- **Port:** Defaults to 8000 or `$PORT`.
- **Process Model:** Single Uvicorn master worker.

---

### Topology C: Enterprise Nginx + Reverse Proxy (`frontend/nginx.conf`)

For self-hosted university server deployments (Bare Metal / VMware / OpenStack on CSJMU campus):
- Nginx acts as the TLS-terminating reverse proxy on port 443.
- Serves pre-compressed static assets (`/dist`) with aggressive HTTP caching (`Cache-Control: public, max-age=31536000, immutable`).
- Proxies `/api/*` and `/docs` to `http://backend:8000` with standard forward headers (`X-Forwarded-For`, `X-Forwarded-Proto`).
- Proxies WebSocket upgrades for `/api/modules/atharva-veda/nivaran/committees/*/ws` with `Upgrade $http_upgrade` and `Connection "Upgrade"`.

---

## 2. Environment Variables & Secrets Management

| Variable Name | Required In | Sensitivity | Purpose & Description |
| :--- | :---: | :---: | :--- |
| `DATABASE_URL` | All | **Secret** | Connection string for Neon Serverless PostgreSQL (`postgresql+psycopg://...`). |
| `SECRET_KEY` | All | **Secret** | 256-bit symmetric signing secret for JWT access tokens. |
| `TOTP_ENCRYPTION_KEY` | Production | **Critical Secret** | 32-byte URL-safe base64 Fernet key for encrypting 2FA secrets at rest. |
| `STORAGE_PROVIDER` | All | Config | Active storage mode: `local` (dev) or `spaces` (cloud). |
| `SPACES_BUCKET` | Production | Config | DigitalOcean Spaces bucket name (e.g. `vyasa-n-documents`). |
| `SPACES_ACCESS_KEY_ID` | Production | **Secret** | S3 API Access Key ID for Spaces. |
| `SPACES_SECRET_ACCESS_KEY` | Production | **Secret** | S3 API Secret Key for Spaces. |
| `GEMINI_API_KEY` | Production | **Secret** | Google Gemini API key for OCR extraction & RAG. |
| `BREVO_API_KEY` | Production | **Secret** | Brevo v3 transactional email delivery key. |
| `EMAIL_ENABLED` | All | Config | When `False`, emails are safely simulated/logged without outbound SMTP. |
| `NODE_ENV` | All | Config | `development`, `staging`, or `production`. |
| `CORS_ORIGIN` | All | Config | Comma-separated list of allowed frontend origins. |

---

## 3. High Availability, Health Checks & Monitoring

1. **Liveness Health Check:** `GET /api/health`
   - Returns HTTP 200 with service identity, uptime, and system time in IST (`Asia/Kolkata`).
2. **Readiness Database Health Check:** `GET /api/health/db`
   - Executes `SELECT 1` through SQLAlchemy engine pool to confirm active database socket connectivity.
3. **Telemetry & Connection Pool Monitoring:** `GET /api/watchdog/metrics`
   - Restricted to `super_admin`. Reports pool size, checked-out connections, overflow count, and timeout limits.
