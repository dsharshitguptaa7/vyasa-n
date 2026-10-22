# VYASA-N — Super Admin Account Provisioning Guide

## Overview

The Super Admin setup utility ([`backend/scripts/setup_super_admin.py`](file:///c:/Projects/VYASA/backend/scripts/setup_super_admin.py)) is a dedicated, production-conscious provisioning tool designed to securely initialize the primary institutional Super Admin account in the VYASA platform.

- **Target Account Email:** `sadmin@csjmu.ac.in`
- **Target Platform Role:** `super_admin` (Sole administrative tier)
- **Script Path:** `backend/scripts/setup_super_admin.py`

---

## 1. What the Script Does

1. **Strict Target Validation:** Verifies the user-provided target identifier (`--expected-database <approved-target>`) against the configured database hostname or database name without printing or exposing connection secrets.
2. **Default Dry-Run Mode:** Executes in validation-only mode by default. Database mutations are strictly blocked unless `--confirm-create` is explicitly passed.
3. **Pre-flight Invariant Checks:**
   - Ensures the `super_admin` role exists in the database.
   - Ensures the email `sadmin@csjmu.ac.in` does not already exist.
4. **Secure Password Intake:** Prompts for credentials interactively using Python's `getpass` module with mandatory confirmation. Never accepts plaintext passwords as CLI arguments.
5. **Institutional Password Complexity Enforcement:** Validates that the password meets complexity rules (minimum 8 characters, uppercase letter, lowercase letter, number).
6. **Canonical Password Hashing:** Uses the platform's standard PBKDF2-HMAC-SHA256 hasher (`hash_password` from `app.core.security`).
7. **Role Assignment:** Maps the user to the `super_admin` role via the `user_roles` association table.
8. **Immutable Audit Logging:** Writes a compliant `AuditLog` entry (`action="CREATE_SUPER_ADMIN"`, `module="governance_identity"`, `entity_name="User"`, `entity_id=<uuid>`).
9. **Atomic Execution:** Encloses all write operations in an atomic transaction that executes an automatic `rollback()` if any error occurs.

---

## 2. What the Script Deliberately Refuses to Do

- **Refuses to overwrite or alter existing users:** If `sadmin@csjmu.ac.in` already exists in the database, the script immediately halts with exit code 1. It will **never** alter an existing password, role, or attribute.
- **Refuses arbitrary account promotion:** The script targets **only** `sadmin@csjmu.ac.in`. It cannot be used to elevate arbitrary email addresses.
- **Refuses unconfirmed execution:** Running without `--confirm-create` will only validate preconditions and will perform zero database writes.
- **Refuses unconfirmed targets:** If `--expected-database` is missing or does not match the configured database, execution aborts immediately.
- **Refuses non-compliant passwords:** Rejects blank, weak, or mismatched passwords.
- **Refuses missing roles:** If the `super_admin` role is not present in the database (i.e. migration `8b29c54e1012` has not run), it aborts without creating an orphaned user.
- **Refuses credential leakage:** Passwords, password hashes, and database connection strings are never printed to stdout/stderr or stored in logs.

---

## 3. Safe Verification: Syntax Checks & Database-Free Tests

The script and its dependencies can be fully verified in an isolated environment without connecting to Neon, PostgreSQL, or any external network.

### CLI Help & Syntax Validation
```powershell
cd C:\Projects\VYASA\backend
.venv\Scripts\python.exe -m scripts.setup_super_admin --help
```

### Run Pure Database-Free Unit Tests
```powershell
cd C:\Projects\VYASA\backend
.venv\Scripts\python.exe -m pytest tests/test_super_admin_setup_db_free.py tests/test_super_admin_elevation_db_free.py tests/test_super_admin_auth_db_free.py tests/test_isolation_guards.py -v --tb=short
```

---

## 4. How to Validate the Intended Database Target

Before executing live account creation, verify the identity of the designated database target.

1. Inspect the database name or hostname specified in `.env` (without printing secret credentials):
   - Database name: e.g. `neondb` or `vyasa_staging`
   - Hostname: e.g. `ep-ancient-hill-1234.neon.tech`
2. Formulate the `--expected-database` confirmation string matching that database name or host.

---

## 5. Owner Execution Procedure (When Database Writes Are Authorized)

When the authorized institutional owner is ready to provision the Super Admin account in the target database, execute the following steps:

### Step 1: Ensure Role Migration Has Been Applied
Verify that Alembic migration `8b29c54e1012_create_super_admin_role` has been applied to the target database:
```powershell
cd C:\Projects\VYASA\backend
alembic upgrade head
```

### Step 2: Run Dry-Run Validation
Execute validation mode to ensure all preconditions are met without performing any database write:
```powershell
cd C:\Projects\VYASA\backend
.venv\Scripts\python.exe -m scripts.setup_super_admin --expected-database <approved-target-db-name>
```

### Step 3: Execute Account Creation
Run with explicit confirmation:
```powershell
cd C:\Projects\VYASA\backend
.venv\Scripts\python.exe -m scripts.setup_super_admin --expected-database <approved-target-db-name> --confirm-create
```
*The script will prompt interactively for the password twice via masked console input.*

---

## 6. Post-Creation Verification (Without Exposing Secrets)

After execution, the owner can verify account setup using standard API endpoints or read queries:

1. **API Login Verification:**
   ```bash
   curl -X POST "http://localhost:5000/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "sadmin@csjmu.ac.in", "password": "<entered-password>"}'
   ```
   *Verify that the response returns `HTTP 200` with JWT token and `"roles": ["super_admin"]`.*

2. **Protected Route Verification:**
   ```bash
   curl -X GET "http://localhost:5000/api/admin/status" \
     -H "Authorization: Bearer <access_token>"
   ```
   *Verify that the response returns `HTTP 200` with institutional metrics and `"admin_user": "sadmin@csjmu.ac.in"`.*

3. **Database Audit Log Verification (Read-Only):**
   ```sql
   SELECT id, user_id, action, module, entity_name, entity_id, created_at 
   FROM audit_logs 
   WHERE action = 'CREATE_SUPER_ADMIN' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

---

## 7. Super Admin Password Reset & Credential Rotation

For ongoing maintenance and credential rotation, a dedicated reset utility ([`backend/scripts/reset_super_admin_password.py`](file:///c:/Projects/VYASA/backend/scripts/reset_super_admin_password.py)) is provided.

### Safety Principles & Invariants:
1. **Target Account Restriction:** Strictly locked to `sadmin@csjmu.ac.in`. Rejects any other email parameter.
2. **Pre-condition Enforcement:** The account must already exist in the database, must be active (`is_active = True`), and must possess the `super_admin` role.
3. **Single-Role & Data Preservation:** Modifies **only** `password_hash`. Leaves role memberships, names, and contact fields unchanged.
4. **Default Dry-Run Mode:** Runs validation-only by default. Requires `--confirm-reset` for database mutation.
5. **Interactive Masked Input:** Prompts securely via `getpass` with mandatory confirmation. Never takes plaintext passwords via CLI arguments.
6. **Canonical PBKDF2 Hashing:** Uses `app.core.security.hash_password` (PBKDF2-HMAC-SHA256, 100,000 iterations).
7. **Zero Secret Leakage in Audit:** Logs an immutable `RESET_SUPER_ADMIN_PASSWORD` audit record in `audit_logs` without storing passwords or password hashes.
8. **Transactional Rollback:** All operations are atomic; unhandled exceptions trigger automatic rollback.

### Step 1: Run Dry-Run Validation (Zero Writes)
```powershell
cd C:\Projects\VYASA\backend
.venv\Scripts\python.exe -m scripts.reset_super_admin_password --expected-database <approved-target-db-name>
```

### Step 2: Execute Confirmed Password Reset
```powershell
cd C:\Projects\VYASA\backend
.venv\Scripts\python.exe -m scripts.reset_super_admin_password --expected-database <approved-target-db-name> --confirm-reset
```
*The operator is prompted interactively twice to enter and confirm the new password.*

