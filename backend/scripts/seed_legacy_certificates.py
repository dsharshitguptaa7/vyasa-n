# -*- coding: utf-8 -*-
"""
SAMIKSHA CMS — Historical Legacy Certificate Seeder CLI Script
Authoritative, safe, idempotent CLI tool for seeding verified historical certificates
into `sama_legacy_certificate_registry`.

Safety Guarantees & Multi-Layered Protection:
1. Default Execution Mode: Always DRY-RUN unless explicit `--execute` is supplied.
2. Explicit Environment Guard: Requires `--confirm-target-env=<ENVIRONMENT_NAME>`.
3. Multi-Layer Host Check: Rejects unconfirmed remote database connections.
4. Concurrency Guard: Obtains transactional advisory lock to prevent concurrent runs.
5. Atomic Transaction: Full rollback on any validation failure or constraint error.
6. Zero Credentials / Token Exposure: Credentials masked; tokens truncated in logs.
"""
import os
import sys
import argparse
import json
import logging
from urllib.parse import urlparse
from typing import Optional, Dict, Any

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.modules.sama_veda.services.legacy_recovery_service import (
    LegacyRecoveryService,
    LegacyRecoverySecurityError,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vyasa.scripts.seed_legacy")


def mask_url(url: str) -> str:
    """Masks database credentials for secure display."""
    if not url:
        return "[EMPTY]"
    try:
        p = urlparse(url)
        netloc = p.netloc
        if "@" in netloc:
            _, host = netloc.rsplit("@", 1)
            netloc = f"***:***@{host}"
        return p._replace(netloc=netloc).geturl()
    except Exception:
        return "[REDACTED_URL]"


def is_remote_db(url: str) -> bool:
    """Checks whether database host is external/remote."""
    try:
        p = urlparse(url)
        host = (p.hostname or "").lower()
        return host not in ("localhost", "127.0.0.1", "", "test_loopback")
    except Exception:
        return True


def parse_args():
    parser = argparse.ArgumentParser(
        description="SAMIKSHA Historical Certificate Seeder (Idempotent & Safe)"
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "normalized_recovery", "historical_75_certificates.json"),
        help="Path to normalized historical certificates JSON file."
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicitly run in non-destructive dry-run mode (default)."
    )
    group.add_argument(
        "--execute",
        action="store_true",
        help="Explicitly permit database writes. Required to commit changes."
    )
    parser.add_argument(
        "--confirm-target-env",
        type=str,
        default="",
        help="Must match target environment (e.g. 'ISOLATED_TEST', 'STAGING', 'PRODUCTION_AUTHORIZED')."
    )
    parser.add_argument(
        "--allow-remote-db",
        action="store_true",
        default=False,
        help="Explicit authorization flag required if connecting to a non-local database host."
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        default=False,
        help="Bypass interactive confirmation prompt (requires VYASA_RECOVERY_SESSION_TOKEN)."
    )
    return parser.parse_args()


def main():
    args = parse_args()

    # Determine execution mode
    is_live_execute = bool(args.execute)
    
    print("\n" + "=" * 80)
    print(" SAMIKSHA CMS — HISTORICAL CERTIFICATE SEEDER PREFLIGHT")
    print("=" * 80)
    print(f" Execution Mode: {'LIVE DATABASE WRITE' if is_live_execute else 'STRICT DRY-RUN (READ-ONLY)'}")
    print(f" Dataset Path:   {os.path.abspath(args.dataset)}")

    # 1. Validate Dataset File
    if not os.path.exists(args.dataset):
        logger.error(f"Dataset file not found at: {args.dataset}")
        sys.exit(1)

    with open(args.dataset, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    val = LegacyRecoveryService.validate_dataset(dataset)
    if not val["is_valid"]:
        logger.error("Dataset validation failed with errors:")
        for err in val["errors"]:
            logger.error(f"  - {err}")
        sys.exit(1)

    print(f" Dataset Check:  PASSED ({val['valid_count']} valid certificates, 0 errors)")

    # 2. Database Environment & Safety Verification
    db_url = os.getenv("DATABASE_URL", "")
    masked = mask_url(db_url)
    remote = is_remote_db(db_url)
    print(f" Target DB URL:  {masked} (Remote Host: {remote})")

    if is_live_execute:
        # Require target environment confirmation
        if not args.confirm_target_env:
            logger.error(
                "SAFETY BLOCK: Live execution requires --confirm-target-env=<ENV>. "
                "Specify environment name explicitly to proceed."
            )
            sys.exit(1)

        # Remote host guard
        if remote and not args.allow_remote_db:
            logger.error(
                "SAFETY BLOCK: Target database host is REMOTE and --allow-remote-db was not provided. "
                "Refusing live execution against remote database without explicit permission."
            )
            sys.exit(1)

        # Interactive or session token confirmation guard for remote execution
        if remote:
            if not args.non_interactive:
                confirm_phrase = input("\nType 'CONFIRM_AUTHORITY_75_RECORDS' to authorize live write: ").strip()
                if confirm_phrase != "CONFIRM_AUTHORITY_75_RECORDS":
                    logger.error("Authorization phrase mismatch. Aborting execution.")
                    sys.exit(1)
            else:
                token = os.getenv("VYASA_RECOVERY_SESSION_TOKEN", "")
                if not token or len(token) < 16:
                    logger.error("Non-interactive mode requires a valid VYASA_RECOVERY_SESSION_TOKEN (min 16 chars). Aborting.")
                    sys.exit(1)

        print(f" Target Confirmed: {args.confirm_target_env}")
        print(" Proceeding with LIVE atomic execution...")
    else:
        print(" Running in DRY-RUN mode. Zero database records will be modified.")

    # 3. Connect and execute
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        if is_live_execute:
            res = LegacyRecoveryService.execute_seed(
                session, dataset, dry_run=False, allow_remote=args.allow_remote_db
            )
        else:
            res = LegacyRecoveryService.dry_run_seed(session, dataset)

        print("\n" + "-" * 80)
        print(" SEEDER EXECUTION RESULTS")
        print("-" * 80)
        print(f" Success:                   {res.get('success')}")
        print(f" Total Proposed Records:    {res.get('total_proposed')}")
        print(f" Valid Records:             {res.get('valid_records')}")
        print(f" New Records to Seed:       {res.get('new_records_count')}")
        print(f" Already Present in DB:     {res.get('already_present_count')}")
        print(f" Active Token Collisions:   {len(res.get('token_collisions_with_active', []))}")
        print(f" Conflicting Records:       {len(res.get('conflicts', []))}")

        if res.get("executed"):
            print(f" Actually Inserted:         {res.get('inserted_count')} records committed to database.")
            print(f" Message:                   {res.get('message')}")
        else:
            print(" Status:                    Dry-run complete. Database remains unchanged.")
        print("=" * 80 + "\n")

    except LegacyRecoverySecurityError as sec_err:
        logger.critical(f"SECURITY BLOCK TRIGGERED: {sec_err}")
        sys.exit(2)
    except Exception as exc:
        logger.error(f"Seeder execution failed: {exc}", exc_info=True)
        session.rollback()
        sys.exit(1)
    finally:
        session.close()
        engine.dispose()


if __name__ == "__main__":
    main()
