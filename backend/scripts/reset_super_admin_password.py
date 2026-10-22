"""
Dedicated Super Admin Password Reset & Setup Utility for VYASA Core.

Target account:
    Email: sadmin@csjmu.ac.in
    Role:  super_admin

Safety Principles:
    1. Default to DRY-RUN mode. Database mutation requires '--confirm-reset'.
    2. Strict target isolation: requires '--expected-database <name>' matching configured DB.
    3. Target account restriction: strictly restricted to 'sadmin@csjmu.ac.in'.
       Refuses to modify any other account.
    4. Account & Role pre-conditions:
       - The target account must already exist.
       - The account must be active.
       - The account must possess the 'super_admin' role.
    5. Single role preservation: does not add, remove, or modify existing roles.
    6. Non-destructive: does not modify unrelated user attributes (email, names, phone).
    7. Prompts securely via getpass; never accepts plaintext credentials via CLI flags.
    8. Password complexity: enforces VYASA institutional baseline (min 8 chars, upper, lower, digit).
    9. Canonical hashing: uses app.core.security.hash_password (PBKDF2-HMAC-SHA256).
    10. Fully auditable: logs immutable record to audit_logs without storing password or hash.
    11. Atomic: transactional commit; rolls back all operations on failure.
    12. Zero credential leakage: credentials, hashes, and URLs are never printed or logged.
"""

import argparse
import getpass
import re
import sys
from typing import Optional, Tuple
from sqlalchemy import select, func, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role
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


def prompt_for_new_password(
    password_input_fn=None,
    confirm_input_fn=None,
) -> str:
    """
    Securely prompts the user for a new password and confirmation.
    Accepts custom prompt functions for DB-free unit testing.
    """
    pw_fn = password_input_fn or (lambda: getpass.getpass("Enter new password for sadmin@csjmu.ac.in: "))
    conf_fn = confirm_input_fn or (lambda: getpass.getpass("Confirm new password: "))

    pw1 = pw_fn()
    if not pw1:
        raise ValueError("Password cannot be blank.")

    is_valid, msg = validate_password_strength(pw1)
    if not is_valid:
        raise ValueError(msg)

    pw2 = conf_fn()
    if pw1 != pw2:
        raise ValueError("Passwords do not match. Password reset aborted.")

    return pw1


def run_super_admin_password_reset(
    target_email: str = SUPER_ADMIN_EMAIL,
    confirm_reset: bool = False,
    expected_database: Optional[str] = None,
    password_input_fn=None,
    confirm_input_fn=None,
    session_factory=SessionLocal,
) -> int:
    """
    Executes the Super Admin password reset pipeline.

    Returns:
        0 on success (or successful dry-run)
        1 on any validation or execution failure
    """
    print("=" * 60)
    print("VYASA Core — Super Admin Password Reset & Setup Utility")
    print(f"Target Account: {SUPER_ADMIN_EMAIL}")
    print(f"Required Role:  {SUPER_ADMIN_ROLE}")
    print("=" * 60)

    # 1. Target Account Enforcement: Refuse any account other than SUPER_ADMIN_EMAIL
    normalized_target = (target_email or "").strip().lower()
    if normalized_target != SUPER_ADMIN_EMAIL.lower():
        print(f"[REFUSED] Security violation: This utility strictly refuses to modify any account other than '{SUPER_ADMIN_EMAIL}'.")
        print(f"[REFUSED] Attempted target: '{target_email}'.")
        return 1

    # 2. Verify Target Confirmation
    target_ok, target_msg = verify_database_target(expected_database)
    if not target_ok:
        print(f"[REFUSED] {target_msg}")
        return 1
    print(f"[VERIFIED] {target_msg}")

    # 3. Check Execution Mode
    if not confirm_reset:
        print("[DRY RUN] Mode: Validation-only (default). No database writes will occur.")
    else:
        print("[CONFIRMED] Explicit confirmation flag '--confirm-reset' detected.")

    session = session_factory()
    try:
        # 4. Verify Live Connected Database Identity from Server
        actual_db = session.execute(text("SELECT current_database()")).scalar()
        if actual_db:
            clean_expected = (expected_database or "").strip().lower()
            if clean_expected != actual_db.lower() and not clean_expected.endswith(f"/{actual_db.lower()}"):
                print(f"[REFUSED] Connected server reports current_database()='{actual_db}', which does not match expected target '{expected_database}'.")
                return 1
            print(f"[VERIFIED] Live connected database identity confirmed: '{actual_db}'.")

        # 5. Check for Existing Target Account
        user_stmt = (
            select(User)
            .options(joinedload(User.roles))
            .where(func.lower(User.email) == SUPER_ADMIN_EMAIL.lower())
        )
        existing_user = session.execute(user_stmt).unique().scalar_one_or_none()

        if not existing_user:
            print(f"[REFUSED] Super Admin account '{SUPER_ADMIN_EMAIL}' was not found in the database.")
            print("[REFUSED] Run 'scripts.setup_super_admin' first to provision the initial Super Admin account.")
            return 1

        if not existing_user.is_active:
            print(f"[REFUSED] Super Admin account '{SUPER_ADMIN_EMAIL}' is inactive. Cannot reset password for deactivated accounts.")
            return 1

        # 6. Verify User Holds the 'super_admin' Role
        assigned_roles = {r.name for r in existing_user.roles}
        if SUPER_ADMIN_ROLE not in assigned_roles:
            print(f"[REFUSED] Account '{SUPER_ADMIN_EMAIL}' does not possess the required '{SUPER_ADMIN_ROLE}' role.")
            print("[REFUSED] Password reset utility is strictly restricted to accounts holding the 'super_admin' role.")
            return 1

        print(f"[VERIFIED] Super Admin account '{SUPER_ADMIN_EMAIL}' found (ID: {existing_user.id}).")
        print(f"[VERIFIED] Role '{SUPER_ADMIN_ROLE}' confirmed for target account.")

        # 7. Prompt and Validate New Password
        try:
            new_password = prompt_for_new_password(
                password_input_fn=password_input_fn,
                confirm_input_fn=confirm_input_fn,
            )
        except ValueError as val_err:
            print(f"[REFUSED] Password validation error: {val_err}")
            return 1

        # 8. Dry Run Completion
        if not confirm_reset:
            print("[DRY RUN SUCCESS] All validation checks passed cleanly.")
            print("[DRY RUN SUCCESS] To execute password update, re-run with '--confirm-reset'.")
            return 0

        # 9. Atomic Password Update & Audit Log Mutation
        existing_user.password_hash = hash_password(new_password)

        # Record immutable audit event without password or hash
        audit = AuditLog(
            user_id=existing_user.id,
            action="RESET_SUPER_ADMIN_PASSWORD",
            module="governance_identity",
            entity_name="User",
            entity_id=str(existing_user.id),
            details={
                "email": SUPER_ADMIN_EMAIL,
                "role": SUPER_ADMIN_ROLE,
                "reset_by": "CLI_RESET_SUPER_ADMIN_PASSWORD",
            },
        )
        session.add(audit)
        session.commit()

        print("=" * 60)
        print(f"[SUCCESS] Super Admin password for '{SUPER_ADMIN_EMAIL}' successfully updated.")
        print(f"[SUCCESS] User UUID: {existing_user.id}")
        print(f"[SUCCESS] Role:      {SUPER_ADMIN_ROLE} (unmodified)")
        print(f"[SUCCESS] AuditLog:  RESET_SUPER_ADMIN_PASSWORD recorded.")
        print("=" * 60)
        return 0

    except Exception as exc:
        session.rollback()
        print(f"[FAILED] Error during password reset; transaction rolled back: {exc}")
        return 1
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(
        description="VYASA Core — Dedicated Super Admin Password Reset & Setup Utility",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--expected-database",
        required=True,
        help="Mandatory target confirmation (e.g. database name or host) to prevent accidental execution.",
    )
    parser.add_argument(
        "--confirm-reset",
        action="store_true",
        default=False,
        help="Explicit confirmation flag required to authorize password update. Defaults to dry-run.",
    )
    parser.add_argument(
        "--email",
        default=SUPER_ADMIN_EMAIL,
        help=f"Target email. Defaults to '{SUPER_ADMIN_EMAIL}'. Attempting any other email will be rejected.",
    )

    args = parser.parse_args()

    exit_code = run_super_admin_password_reset(
        target_email=args.email,
        confirm_reset=args.confirm_reset,
        expected_database=args.expected_database,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
