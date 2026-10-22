# -*- coding: utf-8 -*-
"""
VYASA / NIVARAN-AI Test Database Isolation & Safety Guard

Enforces strict, fail-closed isolation for all test executions:
1. Rejects missing, empty, or non-PostgreSQL test database URLs.
2. Forbids silent fallback to DATABASE_URL.
3. Forbids using the active development, shared, staging, or production database as a test database.
4. Masks all credentials in error messages and logs.
5. Neutralizes the default DATABASE_URL during test runs to prevent accidental writes.
"""

import os
import re
from pathlib import Path
from typing import Optional, Set, Tuple
from urllib.parse import urlparse, unquote


class TestDatabaseSecurityError(Exception):
    """Raised when a test database configuration violates isolation or safety rules."""
    __test__ = False


BLOCKED_DUMMY_URL = "postgresql+psycopg://isolated_test_blocked:blocked@127.0.0.1:65432/blocked_test_do_not_use?connect_timeout=1"


def mask_database_url(url: Optional[str]) -> str:
    """
    Safely redacts passwords and credentials from a database URL.
    Never exposes usernames or passwords in logs or error messages.
    """
    if not url:
        return "[EMPTY_OR_NONE]"
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc
        if "@" in netloc:
            _, host_part = netloc.rsplit("@", 1)
            netloc = f"***:***@{host_part}"
        masked = parsed._replace(netloc=netloc).geturl()
        return masked
    except Exception:
        return "[REDACTED_URL]"


def parse_database_target(url: Optional[str]) -> Optional[Tuple[str, str]]:
    """
    Extracts the (hostname, database_name) tuple from a database URL for identity comparison.

    Identity components compared:
    - Hostname: Normalized to lowercase, stripped of whitespace.
    - Database Name: Path component stripped of leading/trailing slashes,
      decoded via urllib.parse.unquote (to normalize URL-encoded names like 'my%20db' -> 'my db'),
      and converted to lowercase.
    - Port: Verified to be valid if specified.

    Note: Matching hostname and database name verifies that both URLs target the same
    database namespace on the given host. It does not imply complete connection equivalence
    (which also includes credentials, driver options, and query parameters).
    """
    if not url or not isinstance(url, str):
        return None
    try:
        parsed = urlparse(url.strip())
        host = (parsed.hostname or "").lower().strip()
        raw_path = parsed.path.strip()
        if not raw_path or raw_path == "/":
            return None
        # Safely unquote URL-encoded characters and strip slashes
        clean_path = raw_path.strip("/")
        db_name = unquote(clean_path).lower().strip()
        # Verify port if specified (urlparse.port raises ValueError if invalid)
        _ = parsed.port
        return (host, db_name) if host and db_name else None
    except Exception:
        return None


def get_blocked_production_targets() -> Set[Tuple[str, str]]:
    """
    Inspects backend/.env directly without setting environment variables
    to identify the host and database of the active dev/shared/production instance.
    """
    targets: Set[Tuple[str, str]] = set()

    # Read from backend/.env if it exists
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("DATABASE_URL="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        target = parse_database_target(val)
                        if target:
                            targets.add(target)
        except Exception:
            pass

    # Also include whatever original DATABASE_URL was in os.environ before test neutralization
    raw_env_url = os.environ.get("ORIGINAL_DATABASE_URL")
    if raw_env_url:
        target = parse_database_target(raw_env_url)
        if target:
            targets.add(target)

    return targets


def validate_test_database_url(
    test_url: Optional[str],
    default_url: Optional[str] = None,
    blocked_targets: Optional[Set[Tuple[str, str]]] = None,
) -> str:
    """
    Validates that TEST_DATABASE_URL is explicitly provided, uses a supported
    PostgreSQL driver, and does not collide with the dev/shared/production database.

    Raises TestDatabaseSecurityError with sanitized messages if any check fails.
    """
    if not test_url or not test_url.strip():
        raise TestDatabaseSecurityError(
            "Missing TEST_DATABASE_URL: A dedicated PostgreSQL test database URL must be "
            "explicitly provided via the TEST_DATABASE_URL environment variable. "
            "Tests are forbidden from falling back to DATABASE_URL or touching shared databases."
        )

    test_url_clean = test_url.strip()

    # 1. Reject SQLite or other non-PostgreSQL drivers
    try:
        parsed = urlparse(test_url_clean)
    except Exception as e:
        raise TestDatabaseSecurityError(f"Malformed database URL syntax: {type(e).__name__}")

    valid_schemes = ("postgresql", "postgresql+psycopg", "postgresql+psycopg2", "postgres")
    if parsed.scheme.lower() not in valid_schemes:
        raise TestDatabaseSecurityError(
            f"Unsupported database scheme '{parsed.scheme}'. "
            "VYASA test isolation requires a dedicated PostgreSQL database "
            "(scheme: 'postgresql' or 'postgresql+psycopg'). SQLite is strictly rejected."
        )

    # 2. Extract host and database
    test_target = parse_database_target(test_url_clean)
    if not test_target:
        raise TestDatabaseSecurityError(
            "Invalid test database URL: Could not determine valid hostname and database name."
        )

    # 3. Check collision with default_url
    if default_url:
        default_target = parse_database_target(default_url)
        if default_target and test_target == default_target:
            raise TestDatabaseSecurityError(
                f"Collision detected: TEST_DATABASE_URL targets the same host and database "
                f"as DATABASE_URL ({test_target[0]}/{test_target[1]}). "
                "The test database must be a completely separate database instance."
            )

    # 4. Check collision with blocked targets from .env
    all_blocked = blocked_targets if blocked_targets is not None else get_blocked_production_targets()
    if test_target in all_blocked:
        raise TestDatabaseSecurityError(
            f"Security violation: TEST_DATABASE_URL matches a blocked shared/production database target "
            f"({test_target[0]}/{test_target[1]}). "
            "Never run tests against the development, staging, or production database."
        )

    # 5. Normalize scheme to postgresql+psycopg:// if needed
    normalized_url = test_url_clean
    if normalized_url.startswith("postgres://"):
        normalized_url = normalized_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif normalized_url.startswith("postgresql://") and not normalized_url.startswith("postgresql+"):
        normalized_url = normalized_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return normalized_url


def enforce_test_environment_safety() -> Optional[str]:
    """
    Applies test safety overrides to the environment at test process startup:
    - If TEST_DATABASE_URL is set and valid, sets DATABASE_URL = TEST_DATABASE_URL.
    - If TEST_DATABASE_URL is missing, neutralizes DATABASE_URL with an unroutable dummy
      so that no module can accidentally connect to Neon.
    Returns the normalized test URL if valid, or None if not configured.
    """
    # Preserve original DATABASE_URL for validation before overriding
    if "ORIGINAL_DATABASE_URL" not in os.environ:
        if "DATABASE_URL" in os.environ:
            os.environ["ORIGINAL_DATABASE_URL"] = os.environ["DATABASE_URL"]

    test_url = os.environ.get("TEST_DATABASE_URL")

    if test_url and test_url.strip():
        # Validate test database URL
        validated_url = validate_test_database_url(
            test_url,
            default_url=os.environ.get("ORIGINAL_DATABASE_URL"),
        )
        os.environ["DATABASE_URL"] = validated_url
        return validated_url
    else:
        # Neutralize DATABASE_URL with unroutable dummy address to prevent any accidental write
        os.environ["DATABASE_URL"] = BLOCKED_DUMMY_URL
        return None


def get_registered_test_targets() -> Set[Tuple[str, str]]:
    """
    Extracts the registered isolated test database target from TEST_DATABASE_URL.
    """
    test_url = os.environ.get("TEST_DATABASE_URL")
    if not test_url or not test_url.strip():
        return set()
    target = parse_database_target(test_url)
    return {target} if target else set()


def get_approved_migration_targets() -> Set[Tuple[str, str]]:
    """
    Parses APPROVED_MIGRATION_TARGETS environment variable if present.
    Format: comma-separated list of database URLs or 'hostname/database_name' strings.
    Raises TestDatabaseSecurityError if any explicit allowlist entry is invalid.
    """
    raw = os.environ.get("APPROVED_MIGRATION_TARGETS")
    if not raw or not raw.strip():
        return set()

    targets: Set[Tuple[str, str]] = set()
    entries = [e.strip() for e in raw.split(",") if e.strip()]
    for entry in entries:
        target = parse_database_target(entry)
        if not target and "/" in entry and not entry.startswith(("http", "postgres", "sqlite")):
            parts = entry.split("/", 1)
            h = parts[0].strip().lower()
            d = unquote(parts[1].strip("/")).strip().lower()
            if h and d:
                target = (h, d)
        if not target:
            raise TestDatabaseSecurityError(
                f"Invalid approved migration target entry in allowlist: '{mask_database_url(entry)}'. "
                "Each entry must be a valid PostgreSQL URL or 'hostname/database_name'."
            )
        targets.add(target)
    return targets


def validate_alembic_target_url(
    target_url: Optional[str] = None,
    allow_production: bool = False,
    blocked_targets: Optional[Set[Tuple[str, str]]] = None,
    approved_targets: Optional[Set[Tuple[str, str]]] = None,
    approved_test_targets: Optional[Set[Tuple[str, str]]] = None,
) -> str:
    """
    Validates and secures the target database URL for Alembic migrations.

    Safety Rules (Fail-Closed Whitelist Model):
    1. Rejects missing, empty, or non-PostgreSQL URLs (SQLite strictly forbidden).
    2. Identifies registered targets (production targets, isolated test targets, approved targets).
    3. Collision Protection: Any test database target colliding with a protected
       shared/production database is strictly rejected. A test registration cannot override production protection.
    4. Whitelist Enforcement: Unknown/unregistered migration targets are strictly rejected by default.
    5. Production Authorization: ALLOW_PRODUCTION_MIGRATIONS=1 strictly authorizes only the
       registered production database. It cannot authorize an unknown or arbitrary database URL.
    6. Normalizes driver scheme to postgresql+psycopg://.
    7. Redacts credentials in all logs and error messages.
    """
    raw_url = target_url or os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("TEST_DATABASE_URL")
    if not raw_url or not isinstance(raw_url, str) or not raw_url.strip():
        raise TestDatabaseSecurityError(
            "Missing Alembic migration target: A database URL must be explicitly provided "
            "via target_url parameter, CLI argument (-x db=...), MIGRATION_DATABASE_URL, or TEST_DATABASE_URL."
        )

    clean_url = raw_url.strip()

    # 1. Reject SQLite or non-PostgreSQL schemes
    try:
        parsed = urlparse(clean_url)
    except Exception as e:
        raise TestDatabaseSecurityError(f"Malformed database URL syntax: {type(e).__name__}")

    valid_schemes = ("postgresql", "postgresql+psycopg", "postgresql+psycopg2", "postgres")
    if parsed.scheme.lower() not in valid_schemes:
        if "sqlite" in parsed.scheme.lower():
            raise TestDatabaseSecurityError(
                f"Unsupported database scheme '{parsed.scheme}'. "
                "VYASA database migrations require a PostgreSQL database "
                "(scheme: 'postgresql' or 'postgresql+psycopg'). SQLite is strictly rejected."
            )
        else:
            raise TestDatabaseSecurityError(
                f"Unsupported database scheme '{parsed.scheme}'. "
                "VYASA database migrations require a PostgreSQL database "
                "(scheme: 'postgresql' or 'postgresql+psycopg')."
            )

    # 2. Extract host and database
    target = parse_database_target(clean_url)
    if not target:
        raise TestDatabaseSecurityError(
            "Invalid migration database URL: Could not determine valid hostname and database name."
        )

    # 3. Resolve registered production/shared targets
    registered_prod_targets = blocked_targets if blocked_targets is not None else get_blocked_production_targets()

    # 4. Resolve registered test targets and enforce collision protection (Requirement 2 & 3)
    registered_test_targets: Set[Tuple[str, str]] = set()
    if approved_test_targets is not None:
        registered_test_targets = set(approved_test_targets)
    else:
        registered_test_targets = get_registered_test_targets()

    # Collision check: test targets must not collide with protected production targets
    for test_tgt in registered_test_targets:
        if test_tgt in registered_prod_targets:
            raise TestDatabaseSecurityError(
                f"Security violation: Configured test database target ({test_tgt[0]}/{test_tgt[1]}) "
                "collides with protected shared/production database. "
                "A test registration cannot override production protection."
            )

    # 5. Resolve explicit approved targets (Requirement 6)
    explicit_approved_targets: Set[Tuple[str, str]] = set()
    if approved_targets is not None:
        explicit_approved_targets = set(approved_targets)
    else:
        explicit_approved_targets = get_approved_migration_targets()

    env_allow = os.environ.get("ALLOW_PRODUCTION_MIGRATIONS") == "1"
    is_production_authorized = allow_production or env_allow

    # 6. Whitelist authorization check (Fail-Closed)
    if target in registered_prod_targets:
        if not is_production_authorized:
            raise TestDatabaseSecurityError(
                f"Security violation: Migration target matches protected shared/production database "
                f"({target[0]}/{target[1]}). Accidental migrations are blocked. "
                "To explicitly apply migrations to this database, set ALLOW_PRODUCTION_MIGRATIONS=1."
            )
        # Production migration explicitly authorized
    elif target in registered_test_targets:
        # Isolated test database migration authorized
        pass
    elif target in explicit_approved_targets:
        # Explicitly approved target authorized
        pass
    else:
        # UNKNOWN / UNREGISTERED TARGET: Strictly rejected by default
        # Note: ALLOW_PRODUCTION_MIGRATIONS=1 CANNOT authorize an unknown target!
        raise TestDatabaseSecurityError(
            f"Security violation: Migration target ({target[0]}/{target[1]}) is not an approved or "
            "registered migration target. Unknown database targets are rejected by default."
        )

    # 7. Normalize scheme to postgresql+psycopg://
    normalized_url = clean_url
    if normalized_url.startswith("postgres://"):
        normalized_url = normalized_url.replace("postgres://", "postgresql+psycopg://", 1)
    elif normalized_url.startswith("postgresql://") and not normalized_url.startswith("postgresql+"):
        normalized_url = normalized_url.replace("postgresql://", "postgresql+psycopg://", 1)

    return normalized_url

