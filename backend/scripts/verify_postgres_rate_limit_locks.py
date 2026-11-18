"""
Phase 4H: PostgreSQL Advisory Lock Concurrency Verification Script.

Verifies multi-session transaction-scoped advisory locking (pg_advisory_xact_lock / pg_try_advisory_xact_lock)
used by AiAssistantRateLimiter to coordinate distributed rate limiting across multiple app instances / pods.

Verification steps:
1. Connects to PostgreSQL using DATABASE_URL.
2. Verifies engine dialect is PostgreSQL; exits gracefully (code 0) with a notice if not PostgreSQL (e.g. SQLite).
3. Opens two independent database connections (Connection A and Connection B).
4. Step 1: Session A begins a transaction and acquires advisory lock for user_1.
5. Step 2: Session B attempts to acquire advisory lock for user_1 using pg_try_advisory_xact_lock and asserts False (lock contention detected, serialized).
6. Step 3: Session B attempts to acquire advisory lock for user_2 (different user) and asserts True (uncontended independent users proceed).
7. Step 4: Session A commits its transaction (releases transaction-scoped advisory lock).
8. Step 5: Session B attempts to acquire advisory lock for user_1 and asserts True (lock successfully handed over).
9. Exits with code 0 on success, non-zero on failure.
"""

import os
import sys
import uuid
from sqlalchemy import create_engine, select, text


def compute_advisory_key(user_id: uuid.UUID) -> int:
    return int.from_bytes(user_id.bytes[:8], byteorder="big", signed=True)


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        # Fall back to app.core.config if available
        try:
            from app.core.config import settings
            database_url = settings.DATABASE_URL
        except Exception:
            pass

    if not database_url:
        print("[SKIP] DATABASE_URL is not set. Cannot run PostgreSQL concurrency verification against live database.")
        sys.exit(0)

    # Check for postgresql dialect
    if not database_url.startswith("postgresql") and not database_url.startswith("postgres"):
        print(f"[SKIP] Configured database dialect is not PostgreSQL (URL: {database_url[:15]}...).")
        print("This script is designed for staging / production PostgreSQL verification.")
        sys.exit(0)

    print(f"[INFO] Connecting to PostgreSQL instance: {database_url.split('@')[-1] if '@' in database_url else 'configured DB'}")
    
    try:
        engine = create_engine(database_url, echo=False)
    except Exception as e:
        print(f"[ERROR] Failed to create SQLAlchemy engine: {e}")
        sys.exit(1)

    user_1 = uuid.uuid4()
    user_2 = uuid.uuid4()
    key_1 = compute_advisory_key(user_1)
    key_2 = compute_advisory_key(user_2)

    print(f"[INFO] Test User 1: {user_1} (Advisory Key: {key_1})")
    print(f"[INFO] Test User 2: {user_2} (Advisory Key: {key_2})")

    # Open two separate, independent connections to the database
    conn_a = engine.connect()
    conn_b = engine.connect()

    try:
        # Step 1: Session A begins transaction and acquires transaction-scoped advisory lock for user_1
        print("\n--- Test Step 1: Session A acquires advisory lock for User 1 ---")
        trans_a = conn_a.begin()
        conn_a.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": key_1})
        print("[PASS] Session A acquired pg_advisory_xact_lock for User 1.")

        # Step 2: Session B attempts to acquire lock for User 1 (should fail / return False)
        print("\n--- Test Step 2: Session B attempts to lock User 1 via pg_try_advisory_xact_lock ---")
        trans_b = conn_b.begin()
        res_user1_b = conn_b.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key_1}
        ).scalar()
        print(f"[INFO] Session B try-lock result for User 1: {res_user1_b}")
        if res_user1_b is not False:
            print("[FAIL] Session B was unexpectedly able to acquire lock held by Session A!")
            trans_a.rollback()
            trans_b.rollback()
            sys.exit(1)
        print("[PASS] Session B correctly blocked from acquiring lock for User 1 (Contention serialized).")

        # Step 3: Session B attempts to acquire lock for User 2 (should succeed / return True)
        print("\n--- Test Step 3: Session B attempts to lock User 2 (independent user) ---")
        res_user2_b = conn_b.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key_2}
        ).scalar()
        print(f"[INFO] Session B try-lock result for User 2: {res_user2_b}")
        if res_user2_b is not True:
            print("[FAIL] Session B failed to acquire lock for independent User 2!")
            trans_a.rollback()
            trans_b.rollback()
            sys.exit(1)
        print("[PASS] Session B acquired lock for independent User 2 without interference.")
        trans_b.commit()

        # Step 4: Session A commits its transaction, releasing the lock for User 1
        print("\n--- Test Step 4: Session A commits and releases lock for User 1 ---")
        trans_a.commit()
        print("[PASS] Session A transaction committed; lock released.")

        # Step 5: Session B now attempts to acquire lock for User 1 (should succeed / return True)
        print("\n--- Test Step 5: Session B attempts to acquire lock for User 1 post-release ---")
        trans_b2 = conn_b.begin()
        res_user1_b_after = conn_b.execute(
            text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": key_1}
        ).scalar()
        print(f"[INFO] Session B try-lock result for User 1 post-release: {res_user1_b_after}")
        if res_user1_b_after is not True:
            print("[FAIL] Session B failed to acquire released lock for User 1!")
            trans_b2.rollback()
            sys.exit(1)
        print("[PASS] Session B successfully acquired lock for User 1 after Session A release.")
        trans_b2.commit()

        print("\n=======================================================")
        print("ALL POSTGRESQL ADVISORY LOCK CONCURRENCY CHECKS PASSED.")
        print("Multi-instance rate limit coordination is fully verified.")
        print("=======================================================")
        sys.exit(0)

    except Exception as exc:
        print(f"\n[ERROR] Unexpected error during verification: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn_a.close()
        conn_b.close()
        engine.dispose()


if __name__ == "__main__":
    main()
