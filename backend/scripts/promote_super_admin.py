"""
Selective Super Admin Account Elevation Utility.

DO NOT EXECUTE AUTOMATICALLY OR DURING READ-ONLY/PREPARATION PHASES.

This utility selectively promotes a specific, verified institutional account to the
'super_admin' platform role. It deliberately prevents bulk or wildcard elevation.

Usage:
    python -m scripts.promote_super_admin --email target_user@csjmu.ac.in --confirm
"""

import argparse
import sys
import uuid
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.user import User, user_roles
from app.models.role import Role
from app.models.audit import AuditLog


def promote_user_to_super_admin(email: str, confirmed: bool) -> None:
    if not confirmed:
        print("[ABORTED] Promotion not confirmed. Provide the --confirm flag to execute.")
        sys.exit(1)

    normalized_email = email.strip().lower()
    session = SessionLocal()
    try:
        # 1. Verify target user existence and active status
        user_stmt = select(User).where(User.email == normalized_email)
        user = session.execute(user_stmt).scalar_one_or_none()
        if not user:
            print(f"[ERROR] Target user with email '{normalized_email}' was not found in the database.")
            sys.exit(1)

        if not user.is_active:
            print(f"[ERROR] Target user '{normalized_email}' is marked inactive. Cannot promote deactivated accounts.")
            sys.exit(1)

        # 2. Verify 'super_admin' role exists
        role_stmt = select(Role).where(Role.name == "super_admin")
        super_admin_role = session.execute(role_stmt).scalar_one_or_none()
        if not super_admin_role:
            print("[ERROR] 'super_admin' role is not found in database. Run migration 8b29c54e1012 first.")
            sys.exit(1)

        # 3. Check if user already holds super_admin
        existing_role_ids = {r.id for r in user.roles}
        if super_admin_role.id in existing_role_ids:
            print(f"[INFO] User '{normalized_email}' already possesses the 'super_admin' role.")
            return

        # 4. Attach super_admin role
        session.execute(
            user_roles.insert().values(
                user_id=user.id,
                role_id=super_admin_role.id,
            )
        )

        # 5. Record immutable audit log
        audit = AuditLog(
            user_id=user.id,
            action="PROMOTE_SUPER_ADMIN",
            module="governance_identity",
            entity_name="User",
            entity_id=str(user.id),
            details={
                "target_email": normalized_email,
                "role_promoted": "super_admin",
                "promoted_by": "CLI_MANUAL_PROMOTION_TOOL",
            },
        )
        session.add(audit)
        session.commit()

        print(f"[SUCCESS] Successfully elevated '{normalized_email}' ({user.id}) to 'super_admin'.")

    except Exception as exc:
        session.rollback()
        print(f"[FAILED] Elevation aborted due to error: {exc}")
        sys.exit(1)
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="Selective Super Admin Provisioning Utility")
    parser.add_argument("--email", required=True, help="Verified institutional email address of the account to elevate")
    parser.add_argument("--confirm", action="store_true", help="Explicit confirmation flag required to prevent accidental execution")
    args = parser.parse_args()

    promote_user_to_super_admin(email=args.email, confirmed=args.confirm)


if __name__ == "__main__":
    main()
