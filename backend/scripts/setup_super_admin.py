"""
Dedicated Super Admin Account Provisioning Utility for VYASA Core.

Target account:
    Email: sadmin@csjmu.ac.in
    Role:  super_admin

Safety Principles:
    1. Default to DRY-RUN mode. Database mutation requires '--confirm-create'.
    2. Strict target isolation: requires '--expected-database <name>' matching configured DB.
    3. Prompts securely via getpass; never accepts plaintext credentials via CLI flags.
    4. Refuses duplicate emails and never silently promotes or overwrites existing accounts.
    5. Fully auditable: logs immutable record to audit_logs.
    6. Atomic: transactional rollback on any failure.
    7. Zero credential leakage: credentials, hashes, and URLs are never printed or logged.
"""

import argparse
import getpass
import re
import sys
import uuid
from typing import Optional, Tuple
from sqlalchemy import select, func, text
from sqlalchemy.engine import make_url

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.audit import AuditLog

SUPER_ADMIN_EMAIL = "sadmin@csjmu.ac.in"
SUPER_ADMIN_ROLE = "super_admin"


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Validates password complexity against VYASA institutional security baseline:
    - Minimum length 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one digit
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one number."
    return True, "Password complexity verified."


def verify_database_target(expected_target: Optional[str]) -> Tuple[bool, str]:
    """
    Validates that the expected database target confirmed by the operator
    matches the actual database configured in settings without printing secrets.
    """
    if not expected_target:
        return False, "Missing required target confirmation: --expected-database <approved-target>"

    try:
        url = make_url(settings.sync_database_url)
    except Exception as exc:
        return False, f"Could not parse configured database URL: {exc}"

    configured_db = url.database or ""
    configured_host = url.host or ""

    clean_expected = expected_target.strip().lower()
    matches = clean_expected in (
        configured_db.lower(),
        configured_host.lower(),
        f"{configured_host.lower()}/{configured_db.lower()}",
    )

    if matches:
        return True, "Database target confirmed."

    masked_host = (
        f"{configured_host[:4]}...{configured_host[-6:]}"
        if len(configured_host) > 10
        else "configured-host"
    )
    return False, f"Target mismatch: configured database (db='{configured_db}', host='{masked_host}') does not match expected '{expected_target}'."


def prompt_for_super_admin_password(
    password_input_fn=None,
    confirm_input_fn=None,
) -> str:
    """
    Securely prompts the user for a new super admin password and confirmation.
    Accepts custom prompt functions for DB-free unit testing.
    """
    pw_fn = password_input_fn or (lambda: getpass.getpass("Enter password for sadmin@csjmu.ac.in: "))
    conf_fn = confirm_input_fn or (lambda: getpass.getpass("Confirm password: "))

    pw1 = pw_fn()
    if not pw1:
        raise ValueError("Password cannot be blank.")

    is_valid, msg = validate_password_strength(pw1)
    if not is_valid:
        raise ValueError(msg)

    pw2 = conf_fn()
    if pw1 != pw2:
        raise ValueError("Passwords do not match. Account creation aborted.")

    return pw1


def run_super_admin_setup(
    confirm_create: bool = False,
    expected_database: Optional[str] = None,
    password_input_fn=None,
    confirm_input_fn=None,
    session_factory=SessionLocal,
) -> int:
    """
    Executes the Super Admin setup pipeline.
    Returns:
        0 on success (or successful dry-run)
        1 on any validation or execution failure
    """
    print("=" * 60)
    print("VYASA Core — Super Admin Account Provisioning")
    print(f"Target Account: {SUPER_ADMIN_EMAIL}")
    print(f"Target Role:    {SUPER_ADMIN_ROLE}")
    print("=" * 60)

    # 1. Verify Target Confirmation
    target_ok, target_msg = verify_database_target(expected_database)
    if not target_ok:
        print(f"[REFUSED] {target_msg}")
        return 1
    print(f"[VERIFIED] {target_msg}")

    # 2. Check Execution Mode
    if not confirm_create:
        print("[DRY RUN] Mode: Validation-only (default). No database writes will occur.")
    else:
        print("[CONFIRMED] Explicit confirmation flag '--confirm-create' detected.")

    session = session_factory()
    try:
        # 3. Verify Live Connected Database Identity from Server
        actual_db = session.execute(text("SELECT current_database()")).scalar()
        if actual_db:
            clean_expected = (expected_database or "").strip().lower()
            if clean_expected != actual_db.lower() and not clean_expected.endswith(f"/{actual_db.lower()}"):
                print(f"[REFUSED] Connected server reports current_database()='{actual_db}', which does not match expected target '{expected_database}'.")
                return 1
            print(f"[VERIFIED] Live connected database identity confirmed: '{actual_db}'.")

        # 4. Check for Existing Account
        user_stmt = select(User).where(func.lower(User.email) == SUPER_ADMIN_EMAIL.lower())
        existing_user = session.execute(user_stmt).scalar_one_or_none()
        if existing_user:
            print(f"[REFUSED] Account '{SUPER_ADMIN_EMAIL}' already exists (ID: {existing_user.id}).")
            print("[REFUSED] Script strictly refuses to overwrite, promote, or alter existing accounts.")
            return 1

        # 4. Check for Required super_admin Role
        role_stmt = select(Role).where(Role.name == SUPER_ADMIN_ROLE)
        super_admin_role = session.execute(role_stmt).scalar_one_or_none()
        if not super_admin_role:
            print(f"[REFUSED] Role '{SUPER_ADMIN_ROLE}' does not exist in the database.")
            print("[REFUSED] Apply Alembic migration '8b29c54e1012_create_super_admin_role' before running setup.")
            return 1

        print(f"[VERIFIED] Role '{SUPER_ADMIN_ROLE}' exists (ID: {super_admin_role.id}).")
        print(f"[VERIFIED] Email '{SUPER_ADMIN_EMAIL}' is available for registration.")

        # 5. Prompt and Validate Password
        try:
            password = prompt_for_super_admin_password(
                password_input_fn=password_input_fn,
                confirm_input_fn=confirm_input_fn,
            )
        except ValueError as val_err:
            print(f"[REFUSED] Password validation error: {val_err}")
            return 1

        # 6. Dry Run Completion
        if not confirm_create:
            print("[DRY RUN SUCCESS] All validation checks passed cleanly.")
            print("[DRY RUN SUCCESS] To execute account creation, re-run with '--confirm-create'.")
            return 0

        # 7. Atomic Database Mutation
        new_user = User(
            id=uuid.uuid4(),
            email=SUPER_ADMIN_EMAIL,
            first_name="Super",
            last_name="Admin",
            password_hash=hash_password(password),
            is_active=True,
            is_verified=True,
        )
        session.add(new_user)
        session.flush()

        # Attach single administrative role
        session.execute(
            user_roles.insert().values(
                user_id=new_user.id,
                role_id=super_admin_role.id,
            )
        )

        # Record immutable audit event
        audit = AuditLog(
            user_id=new_user.id,
            action="CREATE_SUPER_ADMIN",
            module="governance_identity",
            entity_name="User",
            entity_id=str(new_user.id),
            details={
                "email": SUPER_ADMIN_EMAIL,
                "role": SUPER_ADMIN_ROLE,
                "created_by": "CLI_SETUP_SUPER_ADMIN",
            },
        )
        session.add(audit)
        session.commit()

        print("=" * 60)
        print(f"[SUCCESS] Super Admin account '{SUPER_ADMIN_EMAIL}' successfully created.")
        print(f"[SUCCESS] User UUID: {new_user.id}")
        print(f"[SUCCESS] Role:      {SUPER_ADMIN_ROLE}")
        print(f"[SUCCESS] AuditLog:  CREATE_SUPER_ADMIN recorded.")
        print("=" * 60)
        return 0

    except Exception as exc:
        session.rollback()
        print(f"[FAILED] Error during setup; transaction rolled back: {exc}")
        return 1
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(
        description="VYASA Core — Dedicated Super Admin Account Provisioning Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--expected-database",
        required=True,
        help="Mandatory target confirmation (e.g. database name or host) to prevent accidental execution.",
    )
    parser.add_argument(
        "--confirm-create",
        action="store_true",
        default=False,
        help="Explicit confirmation flag required to authorize database writes. Defaults to dry-run.",
    )

    args = parser.parse_args()

    exit_code = run_super_admin_setup(
        confirm_create=args.confirm_create,
        expected_database=args.expected_database,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
