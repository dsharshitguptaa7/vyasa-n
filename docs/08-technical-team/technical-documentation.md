# VYASA-N — ENGINEERING & TECHNICAL TEAM DOCUMENTATION

**Target Audience:** Software Developers, Technical Leads, DevOps Engineers, System Administrators, Security Reviewers  
**Repository Working Directory:** `c:\Projects\VYASA`  
**Current Audit Date:** November 7, 2026  
**Document Version:** 1.0  

---

## 1. Technical Executive Overview

VYASA-N is implemented as a **Single Application Modular Monolith** ([`ADR-001`](file:///c:/Projects/VYASA/docs/decisions/ADR-001-modular-monolith.md)), combining a Python FastAPI backend and a React 19 Single Page Application (SPA) backed by a central Neon PostgreSQL database.

### Key Technology Stack Matrix:

| Subsystem / Layer | Technology & Version | Key Libraries & Drivers |
| :--- | :--- | :--- |
| **Backend API** | Python 3.11 / 3.12 (running 3.14 locally) | FastAPI 0.115+, Starlette, Pydantic v2.8+, Uvicorn |
| **Data Access & ORM** | SQLAlchemy 2.0.0+ | Psycopg 3.2.0 (PostgreSQL v3 binary driver), Alembic 1.13+ |
| **Primary Database** | PostgreSQL 16+ | Neon Serverless PostgreSQL (51 Relational Tables) |
| **Frontend SPA** | React 19.2.8 | React Router DOM 7.18.4, Vite 8.3.0, TypeScript 5.7.3 |
| **UI Design System** | Tailwind CSS / CSS Modules | `@vyasa/ui` internal monorepo package |
| **Authentication & Cryptography** | Fernet (AES-128-CBC + HMAC-SHA256) | PyJWT, PyOTP, hashlib (SHA-256), passlib (PBKDF2) |
| **AI & Machine Learning** | scikit-learn, Google Gemini API | joblib, google-genai (`gemini-2.0-flash-lite`) |
| **Vector Search / RAG** | sentence-transformers | all-MiniLM-L6-v2 (384-dimensional dense vectors) |
| **Document Processing** | ReportLab, pypdf, python-docx | python-pptx, openpyxl |
| **Storage Subsystem** | Boto3 (S3 Client) / Python Pathlib | DigitalOcean Spaces (SGP1 region) or local filesystem |
| **Transactional Email** | Brevo v3 REST API / standard smtplib | Jinja2 HTML email templates |

---

## 2. Monorepo Repository Structure

```text
C:\Projects\VYASA\
├── backend/                    # FastAPI Backend Application
│   ├── alembic/                # Database migrations & version scripts (19 migrations)
│   ├── app/                    # Application source code
│   │   ├── admin/              # Super admin routers & schemas (Atharva & Sama CMS)
│   │   ├── api/                # Core routes, dependencies, and master router
│   │   ├── core/               # Database, storage, security, config, and audit logging
│   │   ├── models/             # SQLAlchemy 2.0 ORM models (users, roles, permissions)
│   │   ├── modules/            # Veda domain subpackages
│   │   │   ├── atharva_veda/   # NIVARAN-AI models, services, and 46 API routes
│   │   │   ├── phd_rag/        # Admissions assistant services, parser, embeddings
│   │   │   ├── rig_veda/       # Rig Veda status stub & boundary contracts
│   │   │   ├── sama_veda/      # Sama Veda models, CMS, and bulk importer
│   │   │   └── yajur_veda/     # Yajur Veda status stub & boundary contracts
│   │   ├── schemas/            # Pydantic v2 validation contracts
│   │   ├── services/           # Business services (notifications, 2FA, seeder)
│   │   └── watchdog/           # Operational telemetry & connection pool health
│   ├── scripts/                # Provisioning scripts (setup_super_admin.py)
│   ├── tests/                  # 53 pytest test files (720 automated test cases)
│   ├── pyproject.toml          # Python project build & dependencies definition
│   └── pytest.ini              # Pytest configuration
├── frontend/                   # React 19 Frontend SPA Application
│   ├── src/                    # Source code
│   │   ├── admin/              # Admin Console pages, services, components
│   │   ├── components/         # Shared layouts, shells, and route guards
│   │   ├── context/            # AuthContext provider
│   │   ├── features/           # Core feature suites (auth, landing, dashboard, RAG)
│   │   ├── modules/            # Veda frontend modules (atharva, sama, rig, yajur)
│   │   └── services/           # HTTP API client wrappers
│   ├── package.json            # NPM dependencies & scripts (Vitest 5, React 19)
│   └── vite.config.ts          # Vite build config with manual code splitting chunks
├── packages/ui/                # Shared `@vyasa/ui` component design system
├── data/phd-admission/         # Official regulatory source documents (PDF, DOCX, PPTX)
├── docs/                       # Comprehensive documentation suite (This directory)
├── render.yaml                 # Render cloud deployment blueprint
└── Dockerfile                  # Containerized deployment blueprint
```

---

## 3. Core Architectural Subsystems

### A. Centralized Identity & Authority RBAC
- **User Record (`users`):** Single source of truth. Tracks `email`, `password_hash`, `is_active`, `must_change_password`.
- **Dynamic Role Association (`user_roles`):** Normalizes roles across student and authority domains.
- **Authority Scoping (`nivaran_authorities`):** Maps university faculty members to a specific authority tier (`ASSISTANT_DEAN`, `ASSOCIATE_DEAN`, `DEAN`, `MANAGER`) and jurisdictional subject cluster.

### B. Machine Learning Classification Pipeline (`Atharva Veda`)
- **Classifier Artifact:** [`backend/app/modules/atharva_veda/nivaran/ai_models/category_classifier.joblib`](file:///c:/Projects/VYASA/backend/app/modules/atharva_veda/nivaran/ai_models/category_classifier.joblib)
- **Pipeline:** Term Frequency-Inverse Document Frequency (TF-IDF) vectorizer followed by a Multinomial Naive Bayes classifier trained on historical grievance complaints.
- **Inference Service:** [`ai_classification_pipeline.py`](file:///c:/Projects/VYASA/backend/app/modules/atharva_veda/nivaran/services/ai_classification_pipeline.py). Emits predicted category and confidence probability score.
- **Fail-Safe Heuristic Fallback:** If the scikit-learn model artifact is unavailable, the pipeline falls back to keyword heuristic pattern matching without raising 500 errors.

### C. Public Ph.D. RAG Pipeline (`phd_rag`)
- **Embeddings:** 384-dimensional vectors generated via `sentence-transformers/all-MiniLM-L6-v2`.
- **Retrieval Engine:** [`retrieval_service.py`](file:///c:/Projects/VYASA/backend/app/modules/phd_rag/services/retrieval_service.py). Computes cosine similarity between user query embedding and passage embeddings in `phd_rag_chunks`.
- **LLM Synthesis:** [`llm_service.py`](file:///c:/Projects/VYASA/backend/app/modules/phd_rag/services/llm_service.py). Formats top-k retrieved chunks into an augmented grounding prompt delivered to Google Gemini 2.0 Flash (`gemini-2.0-flash-lite`).

### D. Pluggable Document Storage Gateway
- **Proxy Interface:** [`storage_service`](file:///c:/Projects/VYASA/backend/app/core/storage/__init__.py).
- **Providers:**
  - `LocalStorageProvider`: Secure local filesystem writes with canonical path traversal checks.
  - `SpacesStorageProvider`: DigitalOcean Spaces (S3-compatible) upload/download client using `boto3`.
- **Magic Byte Validation:** Enforces binary signature validation for all file uploads.

---

## 4. Database Migrations & Seeding Protocol

### Migration Execution:
Migrations are versioned via Alembic. To upgrade the target PostgreSQL database to head:
```powershell
cd C:\Projects\VYASA\backend
alembic upgrade head
```

### Idempotent Startup Seeding:
During application boot, `seed_all()` executes automatically:
1. Seeds 6 foundational system roles (`super_admin`, `applicant`, `manager`, `assistant_dean`, `associate_dean`, `dean`).
2. Populates all 56 officially recognized CSJMU academic subjects in `nivaran_subjects`.
3. Seeds approved grievance categories with default Turn-Around-Time (TAT in days).
4. Seeds 4 Veda governance modules in `modules`.
All seeding runs in an atomic transaction that safely rolls back on conflict without corrupting user data.
