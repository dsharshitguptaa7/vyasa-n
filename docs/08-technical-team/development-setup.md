# VYASA-N — LOCAL DEVELOPMENT SETUP & BOOTSTRAPPING GUIDE

**Target Audience:** New Software Developers & Technical Contributors  
**Auditor Classification:** Technical Lead & Developer Experience Lead  
**Audit Date:** November 7, 2026  

---

## 1. Prerequisites & System Requirements

- **Operating System:** Windows 10/11, macOS (Apple Silicon / Intel), or Linux (Ubuntu 22.04+).
- **Python:** Python 3.11 or 3.12 (Virtualenv recommended).
- **Node.js:** Node.js v20.x or v22.x LTS with `npm` v10+.
- **Database:** PostgreSQL 15+ instance (Local Docker container or Neon Serverless PostgreSQL connection).

---

## 2. Step-by-Step Setup Guide

### Step 1: Clone Repository & Install Root Dependencies
```bash
git clone https://github.com/csjmu/vyasa.git
cd vyasa
npm install
```

---

### Step 2: Configure Python Virtual Environment & Backend Dependencies
```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

---

### Step 3: Configure Environment Variables
Copy template `.env.example` into `backend/.env`:
```ini
PORT=5000
NODE_ENV=development
SERVICE_NAME=vyasa-core-backend
API_PREFIX=/api
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
APPLICATION_TIMEZONE=Asia/Kolkata

# PostgreSQL Connection String
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/vyasa_dev_db

# Security & Secrets
SECRET_KEY=vyasa-core-development-secret-key-csjmu-governance
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Two-Factor Authentication
TOTP_ISSUER=VYASA-N
MAX_FAILED_LOGIN_ATTEMPTS=5
FAILED_LOGIN_LOCKOUT_MINUTES=15

# Storage Gateway
STORAGE_PROVIDER=local
STORAGE_BASE_DIR=storage

# External Integrations (Optional in Dev)
EMAIL_ENABLED=False
EMAIL_PROVIDER=simulation
GEMINI_MODEL=gemini-2.0-flash-lite
```

---

### Step 4: Apply Alembic Migrations
Ensure PostgreSQL is running and database exists, then run:
```bash
alembic upgrade head
```

---

### Step 5: Provision Primary Super Admin User
Execute the production-conscious provisioning tool:
```bash
python -m scripts.setup_super_admin --expected-database vyasa_dev_db --confirm-create
```
*(Enter your chosen password interactively when prompted).*

---

### Step 6: Start Backend Server
```bash
uvicorn app.main:app --host 127.0.0.1 --port 5000 --reload
```
- API will be accessible at: `http://localhost:5000`
- Interactive Swagger UI: `http://localhost:5000/docs`
- Interactive ReDoc: `http://localhost:5000/redoc`

---

### Step 7: Start Frontend Single Page Application
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Frontend application will be live at: `http://localhost:5173`

---

## 3. Running Automated Tests Safely

### 1. Run Pure Database-Free Backend Unit Tests:
```bash
cd backend
python -m pytest tests/test_isolation_guards.py tests/test_audit_service_db_free.py tests/test_authority_totp_2fa_db_free.py tests/test_sama_permissions_db_free.py -v
```

### 2. Run Database-Dependent Backend Tests (Requires Dedicated Isolated Test DB):
```bash
# Set dedicated test database variable (NEVER point to dev or production)
$env:TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5432/vyasa_test_db"

python -m pytest tests/test_committee_permissions_workflow.py tests/test_committee_management_workspace.py -v
```

### 3. Run Frontend Test Suite:
```bash
cd frontend
npm run test
```

### 4. Build Production Frontend Bundle:
```bash
cd frontend
npm run build
```
*(Verifies TypeScript compilation and creates optimized static assets in `frontend/dist`).*
