# VYASAᴺ / NIVARAN-AI PostgreSQL Test Isolation & Safety Guide

## Overview

This repository enforces **strict, fail-closed database isolation** for all backend test suites (`pytest`). Under no circumstances can tests run against or mutate development, shared, staging, or production databases (such as Neon PostgreSQL).

---

## 1. Safety Architecture & Safeguards

| Safeguard | Implementation | Behavior |
| :--- | :--- | :--- |
| **Fail-Closed Abort** | [`backend/tests/safety_guard.py`](file:///c:/Projects/VYASA/backend/tests/safety_guard.py), [`backend/tests/conftest.py`](file:///c:/Projects/VYASA/backend/tests/conftest.py) | When `TEST_DATABASE_URL` is missing, tests that interact with the database immediately abort with an explicit actionable message before establishing any database connection. |
| **Loopback Neutralization** | `enforce_test_environment_safety()` | When `TEST_DATABASE_URL` is absent, `DATABASE_URL` is overridden with an unroutable loopback dummy (`postgresql+psycopg://isolated_test_blocked:blocked@127.0.0.1:65432/blocked_test_do_not_use`). Any module attempting an unmanaged direct connection will immediately fail. |
| **Driver & Engine Enforcement** | `validate_test_database_url()` | Only PostgreSQL (`postgresql`, `postgresql+psycopg`) is supported. SQLite (`sqlite:///...`), MySQL, and non-PostgreSQL drivers are strictly rejected. |
| **Target Collision Detection** | `parse_database_target()`, `get_blocked_production_targets()` | Inspects `backend/.env` without polluting the environment. Rejects any `TEST_DATABASE_URL` matching the hostname and database of the active shared/production database. |
| **Credential Masking** | `mask_database_url()` | Usernames and passwords are automatically redacted (`***:***@host:port/db`) in all error messages, logs, and exception strings. |
| **SAVEPOINT Transaction Isolation** | SQLAlchemy 2.0 `join_transaction_mode="create_savepoint"` | Each test runs inside a nested SAVEPOINT on an outer connection transaction. Test code and application API endpoints can call `db.commit()` safely; commits only commit the SAVEPOINT. Fixture teardown executes `transaction.rollback()`, restoring the test database to its pristine state without needing table truncations. |
| **FastAPI Dependency Override** | `app.dependency_overrides[get_db]` | In [`backend/tests/conftest.py`](file:///c:/Projects/VYASA/backend/tests/conftest.py), `client` overrides `get_db` to yield the exact transactional session of the test, ensuring all API mutations are rolled back. |

---

## 2. Environment Configuration

### Required Environment Variable

Tests require a dedicated PostgreSQL database supplied via `TEST_DATABASE_URL`. It must **never** point to the same database as `DATABASE_URL`.

```ini
# Example valid test database URLs:
# Local Docker or native PostgreSQL
TEST_DATABASE_URL=postgresql://test_user:test_password@localhost:5432/vyasa_test_db

# Or dedicated cloud test database (completely separate instance from production/dev)
TEST_DATABASE_URL=postgresql://test_user:test_password@ep-isolated-test-instance.region.aws.neon.tech/isolated_test_db?sslmode=require
```

This configuration template is documented in [`backend/.env.example`](file:///c:/Projects/VYASA/backend/.env.example).

---

## 3. Developer Workflow: Running Backend Tests Safely

### Step 1: Provision a Dedicated Test Database

You can spin up a local PostgreSQL instance with Docker:

```bash
# Run local PostgreSQL container
docker run --name vyasa-test-postgres -e POSTGRES_USER=test_user -e POSTGRES_PASSWORD=test_password -e POSTGRES_DB=vyasa_test_db -p 5432:5432 -d postgres:16-alpine
```

Or create a dedicated separate database inside an existing local PostgreSQL instance:

```sql
CREATE DATABASE vyasa_test_db;
```

---

### Step 2: Set the Test Database URL

#### Windows PowerShell:
```powershell
$env:TEST_DATABASE_URL = "postgresql://test_user:test_password@localhost:5432/vyasa_test_db"
```

#### Windows CMD:
```cmd
set TEST_DATABASE_URL=postgresql://test_user:test_password@localhost:5432/vyasa_test_db
```

#### Linux / macOS / Bash:
```bash
export TEST_DATABASE_URL="postgresql://test_user:test_password@localhost:5432/vyasa_test_db"
```

---

### Step 3: Run the Test Suites

#### 1. Verify Safety Guardrails (No Database Needed):
```powershell
cd c:\Projects\VYASA\backend
python -m pytest tests/test_isolation_guards.py -v
```

#### 2. Run NIVARAN-AI Committee Management Test Suites:
```powershell
cd c:\Projects\VYASA\backend

# Run Committee Formation & Authority Permissions Workflow
python -m pytest tests/test_committee_permissions_workflow.py -v

# Run Committee Workspace, Polls, Meetings & Chat Test Suite
python -m pytest tests/test_committee_management_workspace.py -v

# Run all committee test suites together
python -m pytest tests/test_committee_permissions_workflow.py tests/test_committee_management_workspace.py -v
```

---

## 4. Verification Checklist

- [x] `TEST_DATABASE_URL` is never defaulted to `DATABASE_URL`.
- [x] Zero mutations, schema changes, or seeds were executed against Neon.
- [x] Neutralization replaces `DATABASE_URL` with an unroutable loopback dummy (`127.0.0.1:65432`) when tests run without `TEST_DATABASE_URL`.
- [x] SQLite is strictly rejected (`Unsupported database scheme 'sqlite'`).
- [x] Collisions with `.env` / Neon host and database are detected and blocked.
- [x] Credentials and passwords are automatically masked in all representations.
- [x] 9/9 unit tests in `tests/test_isolation_guards.py` pass.
- [x] Fail-closed abort verified on committee test suites when `TEST_DATABASE_URL` is absent.
