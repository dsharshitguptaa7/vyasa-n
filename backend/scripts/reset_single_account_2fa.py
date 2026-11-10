"""
VYASA-N Targeted Single-Account 2FA Reset Utility
Permits safe, controlled re-enrollment for a specific user whose encryption key was lost,
without affecting any other user or modifying platform credentials.

Usage:
    # Dry-run inspection (default, read-only):
    python backend/scripts/reset_single_account_2fa.py --user-id 889e14ec-5411-5554-b8e3-2be991e64080 --dry-run

    # Live execution (requires explicit --commit flag):
    python backend/scripts/reset_single_account_2fa.py --user-id 889e14ec-5411-5554-b8e3-2be991e64080 --commit
"""
import argparse
import logging
import sys
import os
import uuid
from datetime import datetime, timezone

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(SCRIPT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from app.core.database import SessionLocal
from app.models.user import User
from app.models.two_factor import (
    UserTwoFactorAuth,
    TwoFactorRecoveryCode,
    AuthenticationChallenge,
)
from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("reset_single_account_2fa")

CANONICAL_TARGET_USER_ID = "889e14ec-5411-5554-b8e3-2be991e64080"


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    local, dom = email.split("@", 1)
    return f"{local[:2]}***@{dom}"


def reset_single_account_2fa(user_uuid: uuid.UUID, dry_run: bool = True) -> dict:
    db = SessionLocal()
    try:
        # 1. Identify exact user
        user = db.query(User).filter(User.id == user_uuid).first()
        if not user:
            raise ValueError(f"Target user with ID {user_uuid} not found in database.")

        masked = mask_email(user.email)
        logger.info("Found target user: %s (ID: %s)", masked, str(user.id))

        # 2. Verify institutional authority assignment is preserved
        auth_appts = db.query(NivaranAuthority).filter(NivaranAuthority.vyasa_user_id == user_uuid).all()
        logger.info("Authority appointments count: %d (Preserved untouched)", len(auth_appts))

        # 3. Verify exactly one 2FA record exists
        tfa_records = db.query(UserTwoFactorAuth).filter(UserTwoFactorAuth.user_id == user_uuid).all()
        if len(tfa_records) == 0:
            raise ValueError(f"No UserTwoFactorAuth record found for user {user_uuid}.")
        if len(tfa_records) > 1:
            raise ValueError(f"Ambiguity error: Expected 1 UserTwoFactorAuth record, found {len(tfa_records)}.")

        tfa_record = tfa_records[0]
        logger.info("Target 2FA Record ID: %s (Current is_enabled: %s)", str(tfa_record.id), tfa_record.is_enabled)

        # 4. Count recovery codes to invalidate
        recovery_codes = db.query(TwoFactorRecoveryCode).filter(
            TwoFactorRecoveryCode.user_id == user_uuid,
            TwoFactorRecoveryCode.used_at.is_(None),
        ).all()
        logger.info("Unused recovery codes to invalidate: %d", len(recovery_codes))

        # 5. Count active/unconsumed challenges to cancel
        pending_challenges = db.query(AuthenticationChallenge).filter(
            AuthenticationChallenge.user_id == user_uuid,
            AuthenticationChallenge.consumed_at.is_(None),
        ).all()
        logger.info("Pending unconsumed challenges to cancel: %d", len(pending_challenges))

        # 6. Verify isolation: total records for other users
        other_tfa_count = db.query(UserTwoFactorAuth).filter(UserTwoFactorAuth.user_id != user_uuid).count()
        logger.info("Other users' 2FA records in database: %d (Strictly isolated, untouched)", other_tfa_count)

        now = datetime.now(timezone.utc)
        plan = {
            "target_user_id": str(user_uuid),
            "target_email_masked": masked,
            "target_2fa_record_id": str(tfa_record.id),
            "field_changes": {
                "UserTwoFactorAuth.is_enabled": {"old": tfa_record.is_enabled, "new": False},
                "UserTwoFactorAuth.totp_secret_encrypted": {"old": "[OLD_CIPHERTEXT_140_CHARS]", "new": "PENDING_RE_ENROLLMENT"},
                "UserTwoFactorAuth.enabled_at": {"old": str(tfa_record.enabled_at), "new": None},
                "UserTwoFactorAuth.last_verified_at": {"old": str(tfa_record.last_verified_at), "new": None},
                "UserTwoFactorAuth.last_verified_code_hash": {"old": str(tfa_record.last_verified_code_hash), "new": None},
                "UserTwoFactorAuth.last_verified_timestep": {"old": tfa_record.last_verified_timestep, "new": None},
            },
            "invalidated_recovery_codes_count": len(recovery_codes),
            "cancelled_challenges_count": len(pending_challenges),
            "other_users_affected": 0,
            "dry_run": dry_run,
        }

        if not dry_run:
            # Atomic transaction
            tfa_record.is_enabled = False
            tfa_record.totp_secret_encrypted = "PENDING_RE_ENROLLMENT"
            tfa_record.enabled_at = None
            tfa_record.last_verified_at = None
            tfa_record.last_verified_code_hash = None
            tfa_record.last_verified_timestep = None
            tfa_record.updated_at = now
            db.add(tfa_record)

            for rc in recovery_codes:
                rc.used_at = now
                db.add(rc)

            for ch in pending_challenges:
                ch.consumed_at = now
                db.add(ch)

            audit = AuditLog(
                user_id=user_uuid,
                module="auth",
                action="auth.two_factor_single_account_reset",
                entity_name="UserTwoFactorAuth",
                entity_id=str(tfa_record.id),
                details={
                    "reason": "Cryptographic key mismatch resolution; single-account re-enrollment authorized",
                    "invalidated_recovery_codes": len(recovery_codes),
                    "cancelled_challenges": len(pending_challenges),
                },
            )
            db.add(audit)
            db.commit()
            logger.info("SUCCESS: Single-account 2FA reset committed atomically to database.")
        else:
            logger.info("DRY-RUN COMPLETE: Zero database rows were modified.")

        return plan
    except Exception as exc:
        db.rollback()
        logger.error("Error during single-account reset operation: %s", exc)
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Targeted single-account 2FA reset for VYASA-N.")
    parser.add_argument(
        "--user-id",
        type=str,
        default=CANONICAL_TARGET_USER_ID,
        help="Canonical user UUID to reset (default: 889e14ec-5411-5554-b8e3-2be991e64080).",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        default=False,
        help="Apply database writes. Default is dry-run mode.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Run read-only dry-run verification (default: True).",
    )

    args = parser.parse_args()
    user_uuid = uuid.UUID(args.user_id)
    is_dry_run = not args.commit

    logger.info("=" * 60)
    logger.info("VYASA-N SINGLE-ACCOUNT 2FA RECOVERY UTILITY")
    logger.info("Target User UUID: %s", str(user_uuid))
    logger.info("Mode: %s", "DRY-RUN (READ-ONLY)" if is_dry_run else "LIVE COMMIT")
    logger.info("=" * 60)

    reset_single_account_2fa(user_uuid, dry_run=is_dry_run)


if __name__ == "__main__":
    main()
