# VYASA NIVARAN Pillar Backend Foundation

Production-grade FastAPI backend and PostgreSQL database foundation for the **NIVARAN** pillar within the **VYASA** ecosystem.

---

## Architecture & Boundaries

- **Separation of Concerns**:
  - **VYASA Core** owns identity, authentication, users, roles, and pillar registry.
  - **NIVARAN Pillar** owns grievance-domain data, workflows, routing, committees, e-filing, and digital audit dossiers.
  - References to platform users use `vyasa_user_id: UUID` (no cross-database foreign keys).
- **Technology Stack**:
  - **Framework**: Python 3.12+ / FastAPI
  - **ORM**: SQLAlchemy 2.0 (Declarative Base with `Mapped` typed columns)
  - **Driver**: `psycopg` (v3) with SSL connection pooling
  - **Database**: Neon Serverless PostgreSQL
  - **Migrations**: Alembic
  - **Configuration**: Pydantic Settings with `SecretStr` credentials protection
  - **Testing**: `pytest` + `httpx` (19 automated tests passing)

---

## Database Schema (Frozen 40-Table Architecture)

The database schema implements the frozen 40-table architecture across 13 domains:

| Domain | Table Name | Description |
|---|---|---|
| **1. Authority** | `nivaran_authorities` | Role registry (Applicant, Manager, Assistant Dean, Associate Dean, Dean, Guest Member) |
| **2. Taxonomy** | `subject_clusters` | Academic subject cluster divisions |
| | `subjects` | Individual academic subject mappings |
| | `grievance_clusters` | 3 broad grievance clusters (Academic, Administrative, Welfare) |
| | `categories` | Categorization hierarchy and routing rules |
| **3. Grievance Core** | `student_master_records` | Student enrollment and identity master |
| | `grievances` | Grievance tickets, tracking tokens, metadata, status |
| | `grievance_status_history` | Audit trail of lifecycle status transitions |
| | `comments` | Internal authority notes and public updates |
| | `grievance_feedback` | Applicant satisfaction rating and feedback |
| **4. Routing & Escalation** | `assignments` | Operational authority assignment tracking |
| | `forwarding_confirmations` | Mandatory 6-checkbox + 3-justification forwarding confirmation |
| | `escalations` | Time/authority-based escalation events |
| **5. Documents** | `documents` | Evidentiary attachment metadata and storage paths |
| | `document_requests` | Formal requests for additional applicant evidence |
| **6. Committee Management** | `committee_creation_requests` | Formal requests to establish ad-hoc committees |
| | `grievance_committees` | Committee instances, chair, and terms |
| | `committee_members` | Committee membership roster |
| | `committee_member_recommendations` | Individual member recommendations |
| | `committee_final_recommendations` | Synthesized final committee report |
| | `committee_messages` | In-committee deliberation threads |
| | `committee_polls` | Formal internal committee voting polls |
| | `committee_poll_options` | Voting choices for committee polls |
| | `committee_poll_voters` | Designated voter authorization |
| | `committee_poll_votes` | Cast votes and cryptographic timestamps |
| | `committee_decision_records` | Binding decisions ratified by committee |
| | `committee_meetings` | Scheduled hearing/meeting records |
| | `committee_meeting_participants` | Meeting attendance and participation log |
| **7. Dean Reopen Review** | `dean_reopen_reviews` | Dean-level appeals and case reopening reviews |
| **8. Digital Signatures** | `signing_key_versions` | Versioned signing keys & public certs |
| | `signing_authorization_challenges` | 2FA/authorization challenge tokens |
| | `digital_signatures` | Cryptographic SHA-256 signatures & audit proofs |
| **9. E-File Lifecycle** | `efiles` | Official university e-dossiers |
| | `efile_documents` | Ordered evidentiary attachments in dossier |
| **10. Approvals** | `approval_requests` | Multi-level approval requirements |
| | `approval_actions` | Approval, rejection, or amendment actions |
| **11. AI Processing** | `ai_processing_records` | AI categorization inference outputs & confidence |
| | `clusters` | Unsupervised grievance trend clusters |
| **12. Notification** | `grievance_notification_outbox` | Guaranteed delivery notification queue |
| **13. Audit & Compliance** | `audit_logs` | Tamper-evident operational audit trail |

---

## Project Structure

```text
apps/pillars/nivaran/backend/
├── alembic/
│   ├── env.py                  # Alembic environment with Base.metadata target
│   ├── script.py.mako          # Migration template
│   └── versions/
│       └── cb0e7ff029ea_initial_40_table_nivaran_schema.py  # Frozen 40-table DDL
├── alembic.ini                 # Alembic configuration
├── app/
│   ├── api/
│   │   ├── __init__.py         # API router aggregation
│   │   └── v1/
│   │       ├── __init__.py     # V1 router
│   │       └── health.py       # Health & connectivity probe
│   ├── core/
│   │   ├── config.py           # Pydantic BaseSettings & SecretStr handling
│   │   └── database.py         # SQLAlchemy engine, session factory, ping probe
│   ├── models/
│   │   ├── __init__.py         # Exports Base and all 40 models
│   │   ├── ai_processing.py
│   │   ├── approval.py
│   │   ├── audit.py
│   │   ├── authority.py
│   │   ├── base.py
│   │   ├── committee.py
│   │   ├── dean_reopen.py
│   │   ├── document.py
│   │   ├── efile.py
│   │   ├── enums.py
│   │   ├── grievance.py
│   │   ├── outbox.py
│   │   ├── routing.py
│   │   ├── signature.py
│   │   └── taxonomy.py
│   ├── schemas/
│   │   └── health.py           # Pydantic health response schemas
│   ├── services/
│   └── main.py                 # FastAPI application factory & lifespan
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Pytest fixtures and 40-table constant set
│   ├── test_alembic.py         # Migration head & alembic_version tests
│   ├── test_api.py             # FastAPI routes & OpenAPI documentation tests
│   ├── test_config.py          # Settings & SecretStr credential masking tests
│   ├── test_database.py        # Engine & live connection ping tests
│   └── test_models.py          # Schema count, table reflection & enum tests
├── .env                        # Neon PostgreSQL connection string (gitignored)
├── .gitignore
└── requirements.txt
```

---

## Running the Application

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Verify Database Connection
```bash
python -c "from app.core.database import check_database_connection; print('Connected:', check_database_connection())"
```

### 3. Run Database Migrations
```bash
python -m alembic upgrade head
```

### 4. Seed Institutional Master Data (Idempotent)
```bash
python -m app.seed
```

### 5. Start Development Server
```bash
python -m uvicorn app.main:app --port 8001 --reload
```
Access the interactive documentation:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`
- Health check: `http://localhost:8001/health`

### 6. Run Test Suite
```bash
python -m pytest -v
```
All 43 tests will execute, validating the configuration, live database tables, models, Alembic revision, API health endpoints, institutional master data seeding, and grievance core filing/retrieval workflows.
