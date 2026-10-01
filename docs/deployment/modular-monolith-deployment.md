# VYASA Modular Monolith Deployment Guide
**Document Version:** 1.0.0-DEPLOYMENT  
**Parent System:** VYASA Ecosystem (Chhatrapati Shahu Ji Maharaj University, Kanpur)

---

## 1. Deployment Topology
In contrast to the obsolete microservices design that required 8+ independent services, containers, and ports, the VYASA Modular Monolith deploys as **two primary artifacts backed by a single managed database**:

1. **Frontend Static Distribution:**
   - Build output from `npm run build` in `apps/vyasa/frontend/dist/`.
   - Served via NGINX, Cloudflare Pages, AWS S3/CloudFront, or Render Static Sites.
2. **Backend API Service:**
   - Single FastAPI ASGI application running on Python 3.12+ / 3.14 via Uvicorn.
   - Deployed on university infrastructure (Linux VM, Docker container, or Render Web Service).
3. **Database:**
   - Single PostgreSQL 16+ instance (AWS RDS, Neon, or on-premise university PostgreSQL cluster).

---

## 2. Environment Variables Configuration

### Backend (`apps/vyasa/backend/.env`)
```ini
PORT=5000
NODE_ENV=production
SERVICE_NAME=vyasa-core-backend
API_PREFIX=/api
APPLICATION_TIMEZONE=Asia/Kolkata
CORS_ORIGIN=https://vyasa.csjmu.ac.in

DATABASE_URL=postgresql://user:password@host:5432/vyasa_db?sslmode=require
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800

SECRET_KEY=generate-strong-cryptographic-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Frontend (`apps/vyasa/frontend/.env`)
```ini
VITE_API_URL=https://api.vyasa.csjmu.ac.in/api
```
