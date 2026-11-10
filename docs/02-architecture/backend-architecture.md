# VYASA-N — BACKEND ARCHITECTURE SPECIFICATION

**Audit Date:** November 7, 2026  
**Auditor Classification:** Principal Software Architect & Backend Lead  
**Target Service:** `vyasa-core-backend` (`backend/app`)  

---

## 1. Backend Technology Stack & Environment

```json
{
  "runtime": "Python 3.11 / 3.12 (running 3.14.5 locally)",
  "framework": "FastAPI 0.115.0+ / Starlette",
  "orm": "SQLAlchemy 2.0.0+ (Declarative 2.0 Mappings)",
  "database_driver": "Psycopg 3.2.0 (PostgreSQL v3 Binary Driver)",
  "migrations": "Alembic 1.13.0+",
  "validation": "Pydantic v2.8+ / Pydantic-Settings",
  "cryptography": "PyJWT, Cryptography (Fernet symmetric encryption), PBKDF2-HMAC-SHA256, PyOTP",
  "ml_ai": "scikit-learn (Joblib serialization), Google Gemini API (google-genai)",
  "document_processing": "pypdf, python-docx, python-pptx, openpyxl, reportlab",
  "email": "Brevo v3 REST API, Python standard smtplib"
}
```

---

## 2. Layered Architecture & Directory Structure

```text
backend/app/
├── admin/                      # Administration endpoints & routers
│   ├── atharva_admin_router.py # Taxonomy, authorities, and routing simulation APIs
│   ├── sama_admin_router.py    # CMS CRUD APIs for Sama Veda
│   └── router.py               # Root admin router mount & status
├── api/                        # Core API endpoints & dependencies
│   ├── dependencies.py         # FastApi Depends: get_db, require_user, require_permission
│   ├── router.py               # Master API router uniting all modules
│   └── routes/                 # Core domain routes (auth, users, roles, notifications, pillars)
├── core/                       # Foundational infrastructure & cross-cutting utilities
│   ├── audit/                  # Audit logging interceptor
│   ├── auth/                   # Password hashing, JWT claims, TOTP mechanics
│   ├── config.py               # Pydantic Settings singleton with validation rules
│   ├── database.py             # Engine creation, SessionLocal factory, connection check
│   ├── logging.py              # Structured logging configuration
│   ├── registry.py             # In-memory module registration contracts
│   ├── security.py             # Cryptographic algorithms & sanitization
│   └── storage/                # Storage subsystem (base, local, spaces S3 provider)
├── models/                     # Core relational ORM models (users, roles, permissions, audit)
├── modules/                    # Veda domain subpackages
│   ├── atharva_veda/nivaran/   # NIVARAN-AI models, services, schemas, and router
│   ├── phd_rag/                # Admissions RAG models, parser, retriever, and LLM service
│   ├── rig_veda/               # Rig Veda status stub & boundary contracts
│   ├── sama_veda/              # Sama Veda models, CMS service, bulk importer, and router
│   └── yajur_veda/             # Yajur Veda status stub & boundary contracts
├── schemas/                    # Pydantic request/response validation schemas
├── services/                   # Core business logic services
│   ├── audit_service.py        # Centralized audit logger
│   ├── notifications/          # Multi-channel notification engine, templates & email service
│   ├── seed_service.py         # Idempotent database seeder
│   └── two_factor_service.py   # TOTP 2FA lifecycle & challenge manager
└── watchdog/                   # Operational telemetry router & connection pool stats
```

---

## 3. Dependency Injection & Authorization Middleware

Authorization is enforced at the FastAPI route level using composable dependency functions in [`app/api/dependencies.py`](file:///c:/Projects/VYASA/backend/app/api/dependencies.py):

```mermaid
flowchart TD
    REQ([HTTP Request with Bearer Token]) --> GET_DB[get_db: Yields SQLAlchemy Session]
    GET_DB --> GET_USER[get_current_user: Decodes JWT, Verifies Signature & User Exists]
    
    GET_USER --> CHK_ACTIVE{user.is_active == True?}
    CHK_ACTIVE -->|No| FORBID_403[403 Forbidden: Account Inactive]
    CHK_ACTIVE -->|Yes| EVAL_DEP{Route Dependency Requirement}

    EVAL_DEP -->|require_permission('code')| CHK_PERM{Has Granular Permission?}
    CHK_PERM -->|Yes| EXEC[Execute Route Business Logic]
    CHK_PERM -->|No| FORBID_PERM[403 Forbidden: Missing Required Permission]

    EVAL_DEP -->|require_super_admin_user| CHK_ADMIN{Role == 'super_admin'?}
    CHK_ADMIN -->|Yes| EXEC
    CHK_ADMIN -->|No| FORBID_ADM[403 Forbidden: Administrative Tier Required]

    EVAL_DEP -->|require_can_form_committee| CHK_COMM{Authority Level in<br/>['ASSOCIATE_DEAN', 'DEAN']?}
    CHK_COMM -->|Yes| EXEC
    CHK_COMM -->|No| FORBID_COMM[403 Forbidden: Insufficient Authority Level]
```

### Critical Dependency Gatekeepers:
1. **`get_current_user`:** Validates JWT signature using `SECRET_KEY`, checks token expiration, ensures user exists in the database, and confirms the account has not been deactivated.
2. **`require_permission(permission_name)`:** Dynamically traverses the user's assigned roles and the `role_permissions` join table to verify that the active identity possesses the specific required permission.
3. **`require_super_admin_user`:** Enforces that the user is mapped to the `super_admin` role.
4. **Authority Scoped Gatekeepers (`dependencies.py` in Atharva):**
   - `require_can_form_committee`: Permits Associate Deans and Deans; rejects Assistant Deans with an explicit error explaining that Assistant Deans must submit a petition rather than chartering directly.
   - `require_can_review_committee_request`: Restricts petition approval strictly to higher-tier authorities.

---

## 4. Standard Response Envelope (`ApiResponse[T]`)

Every endpoint across the VYASA-N backend standardizes responses using the generic `ApiResponse` Pydantic model ([`app/schemas/response.py`](file:///c:/Projects/VYASA/backend/app/schemas/response.py)):

```python
class ApiResponse(BaseModel, Generic[DataT]):
    success: bool = True
    message: str = "Operation completed successfully"
    data: Optional[DataT] = None
    error: Optional[ApiErrorDetail] = None
    meta: Optional[Dict[str, Any]] = None
```

### Exception Handling Architecture:
- **`StarletteHTTPException`:** Automatically caught in `app/main.py` and wrapped in `ApiResponse(success=False, error=ApiErrorDetail(code="HTTP_404"))`.
- **`RequestValidationError`:** Formats Pydantic 422 errors into an array of field-level validation errors.
- **`generic_exception_handler`:** Catches uncaught runtime exceptions, logs full stack traces via `logger.error(..., exc_info=True)`, and returns a sanitized `HTTP 500 Internal Server Error` without leaking database connection strings or internal file paths.
