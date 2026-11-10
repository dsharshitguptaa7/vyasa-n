"""
VYASA-N TOTP Secret Re-encryption & Key Migration Utility
Preserves existing users' 2FA secrets during key rotation.

Usage:
    # Safe dry-run inspection (default, non-destructive):
    python backend/scripts/reencrypt_totp_secrets.py --dry-run

    # Live migration with explicit commit:
    python backend/scripts/reencrypt_totp_secrets.py --commit

    # Specify extra candidate historical keys:
    python backend/scripts/reencrypt_totp_secrets.py --dry-run --candidate-keys "old-key-1,old-key-2"
"""
import argparse
import logging
import sys
import os

# Ensure backend root is on sys.path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(SCRIPT_DIR)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

from cryptography.fernet import InvalidToken, Fernet
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.two_factor import UserTwoFactorAuth
from app.models.user import User
from app.services.two_factor_service import TwoFactorService

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("reencrypt_totp_secrets")


def mask_email(email: str) -> str:
    """Mask email address for privacy in logs."""
    if not email or "@" not in email:
        return "***"
    local_part, domain = email.split("@", 1)
    masked_local = f"{local_part[:2]}***{local_part[-1:]}" if len(local_part) > 3 else f"{local_part[:1]}***"
    return f"{masked_local}@{domain}"


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Safely inspect and migrate TOTP secrets across encryption keys without exposing secrets."
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        default=False,
        help="Apply re-encryption changes to database. Default is dry-run mode (read-only).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Perform read-only diagnostic verification without modifying records (default: True).",
    )
    parser.add_argument(
        "--candidate-keys",
        type=str,
        default="",
        help="Optional comma-separated list of candidate historical keys to attempt.",
    )

    args = parser.parse_args()
    is_live_commit = args.commit

    logger.info("=" * 60)
    logger.info("VYASA-N TOTP KEY RE-ENCRYPTION & MIGRATION UTILITY")
    logger.info("=" * 60)
    logger.info("Execution mode: %s", "LIVE DATABASE COMMIT" if is_live_commit else "DRY-RUN (READ-ONLY)")
    logger.info("Environment: %s", settings.NODE_ENV)

    # Safe health check
    health_ok = TwoFactorService.verify_key_health()
    if not health_ok:
        logger.error("Primary encryption key failed in-memory health check. Aborting.")
        return 1

    fp_info = TwoFactorService.get_key_fingerprint()
    logger.info("Primary key fingerprint: %s", fp_info["primary_key_fingerprint"])
    logger.info("Total configured keys in chain: %d", fp_info["total_keys_configured"])

    # Prepare candidate Fernet instances
    candidate_fernets = []
    if args.candidate_keys:
        for k in args.candidate_keys.split(","):
            inst = TwoFactorService._parse_fernet_key(k)
            if inst:
                candidate_fernets.append(inst)

    db = SessionLocal()
    try:
        records = db.query(UserTwoFactorAuth).all()
        total_count = len(records)
        logger.info("Found %d total UserTwoFactorAuth records in database.", total_count)

        already_valid = 0
        migratable = 0
        failed = 0

        for r in records:
            user = db.query(User).filter(User.id == r.user_id).first()
            user_label = mask_email(user.email) if user else f"user_{r.user_id}"

            try:
                new_ciphertext, was_migrated = TwoFactorService.reencrypt_secret(
                    r.totp_secret_encrypted,
                    candidate_fernets=candidate_fernets if candidate_fernets else None,
                )
                if was_migrated:
                    migratable += 1
                    logger.info("Record for %s: requires re-encryption (migratable from fallback key).", user_label)
                    if is_live_commit:
                        r.totp_secret_encrypted = new_ciphertext
                        db.add(r)
                else:
                    already_valid += 1
                    logger.debug("Record for %s: already valid under primary key.", user_label)
            except InvalidToken:
                failed += 1
                logger.warning(
                    "Record for %s: FAILED decryption with all configured and candidate keys.",
                    user_label,
                )

        logger.info("-" * 60)
        logger.info("Summary of Inspection:")
        logger.info("  Total records:                %d", total_count)
        logger.info("  Already valid (primary key):   %d", already_valid)
        logger.info("  Migrated / Migratable:        %d", migratable)
        logger.info("  Undecryptable / Failed:       %d", failed)
        logger.info("-" * 60)

        if is_live_commit:
            if migratable > 0:
                db.commit()
                logger.info("SUCCESS: Committed %d migrated records to the database.", migratable)
            else:
                logger.info("No records required database write.")
        else:
            logger.info("Dry-run complete. Zero records were modified in the database.")
            if migratable > 0:
                logger.info("To apply re-encryption, re-run with --commit flag.")

        return 0
    except Exception as exc:
        db.rollback()
        logger.error("An unexpected error occurred during execution: %s", exc, exc_info=True)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
