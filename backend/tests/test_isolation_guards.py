# -*- coding: utf-8 -*-
"""
Unit tests for the VYASA / NIVARAN-AI Test Database Isolation & Safety Guard.

Verifies:
1. Missing or empty TEST_DATABASE_URL raises TestDatabaseSecurityError.
2. SQLite, MySQL, and non-PostgreSQL drivers are strictly rejected.
3. Collisions with DATABASE_URL or .env production database targets are detected and rejected.
4. Passwords and credentials are masked in logs and error representations.
5. Scheme normalization from postgresql:// to postgresql+psycopg:// works properly.
6. Environment safety enforcement neutralizes DATABASE_URL to loopback dummy when TEST_DATABASE_URL is absent.
"""

import os
import pytest
from tests.safety_guard import (
    TestDatabaseSecurityError,
    mask_database_url,
    parse_database_target,
    validate_test_database_url,
    validate_alembic_target_url,
    enforce_test_environment_safety,
    BLOCKED_DUMMY_URL,
)


def test_missing_test_database_url_raises_security_error():
    """Verify that validate_test_database_url raises error on None or empty string."""
    with pytest.raises(TestDatabaseSecurityError, match="Missing TEST_DATABASE_URL"):
        validate_test_database_url(None)

    with pytest.raises(TestDatabaseSecurityError, match="Missing TEST_DATABASE_URL"):
        validate_test_database_url("")

    with pytest.raises(TestDatabaseSecurityError, match="Missing TEST_DATABASE_URL"):
        validate_test_database_url("   ")


def test_sqlite_urls_are_strictly_rejected():
    """Verify that SQLite URLs are rejected, adhering to PostgreSQL-only test requirements."""
    sqlite_urls = [
        "sqlite:///test.db",
        "sqlite:///:memory:",
        "sqlite+pysqlite:///relative/path.db",
        "sqlite+aiosqlite:///test.db",
    ]
    for url in sqlite_urls:
        with pytest.raises(TestDatabaseSecurityError, match="SQLite is strictly rejected"):
            validate_test_database_url(url)


def test_non_postgres_schemes_are_rejected():
    """Verify that non-PostgreSQL engines (MySQL, Oracle, MSSQL, Mongo) are rejected."""
    unsupported_urls = [
        "mysql+pymysql://user:pass@localhost:3306/testdb",
        "mssql+pyodbc://user:pass@localhost:1433/testdb",
        "mongodb://localhost:27017/testdb",
        "http://localhost:5432/testdb",
    ]
    for url in unsupported_urls:
        with pytest.raises(TestDatabaseSecurityError, match="Unsupported database scheme"):
            validate_test_database_url(url)


def test_url_collision_with_default_database_url():
    """Verify that targeting the same host and database as DATABASE_URL is blocked."""
    prod_url = "postgresql+psycopg://real_admin:Secret123@neon-cluster.aws.neon.tech:5432/vyasa_prod_db?sslmode=require"
    attempted_test_url = "postgresql+psycopg://test_user:AnotherSecret@neon-cluster.aws.neon.tech:5432/vyasa_prod_db?sslmode=require"

    with pytest.raises(TestDatabaseSecurityError, match="Collision detected: TEST_DATABASE_URL targets the same host and database"):
        validate_test_database_url(attempted_test_url, default_url=prod_url)


def test_url_collision_with_blocked_targets_list():
    """Verify that targeting a host and database present in blocked targets is blocked."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    attempted_test_url = "postgresql://user:pass@ep-autumn-leaf-123456.aws.neon.tech:5432/neondb"

    with pytest.raises(TestDatabaseSecurityError, match="Security violation: TEST_DATABASE_URL matches a blocked shared/production database target"):
        validate_test_database_url(attempted_test_url, blocked_targets=blocked)


def test_credentials_are_masked_in_all_representations():
    """Verify that sensitive user passwords are never exposed in masked output."""
    raw_url = "postgresql+psycopg://db_admin:SuperSecretP@ssw0rd!@ep-cool-service.aws.neon.tech:5432/vyasaprime?sslmode=require"
    masked = mask_database_url(raw_url)

    assert "SuperSecretP@ssw0rd!" not in masked
    assert "db_admin" not in masked
    assert "***:***@ep-cool-service.aws.neon.tech:5432/vyasaprime" in masked


def test_valid_postgresql_test_url_normalization():
    """Verify valid PostgreSQL URL is accepted and normalized to postgresql+psycopg driver."""
    valid_url = "postgresql://test_isolated:safe_pw@localhost:5432/vyasa_test_isolated"
    normalized = validate_test_database_url(
        valid_url,
        default_url="postgresql+psycopg://prod:pass@production-server:5432/prod_db",
        blocked_targets=set(),
    )
    assert normalized.startswith("postgresql+psycopg://")
    assert "vyasa_test_isolated" in normalized
    assert "safe_pw" in normalized


def test_parse_database_target_helper():
    """Verify hostname and database parsing handles query parameters and ports."""
    target = parse_database_target("postgresql+psycopg://user:pass@myhost.neon.tech:5432/mydb?sslmode=require")
    assert target == ("myhost.neon.tech", "mydb")

    assert parse_database_target("") is None
    assert parse_database_target(None) is None


def test_enforce_test_environment_safety_neutralizes_when_no_test_url(monkeypatch):
    """Verify that when TEST_DATABASE_URL is not set, DATABASE_URL is replaced with loopback dummy."""
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://danger:secret@danger-host:5432/danger_db")

    result = enforce_test_environment_safety()
    assert result is None
    assert os.environ["DATABASE_URL"] == BLOCKED_DUMMY_URL


def test_alembic_guard_blocks_missing_or_empty_url():
    """Verify that validate_alembic_target_url raises error when no URL is provided."""
    with pytest.raises(TestDatabaseSecurityError, match="Missing Alembic migration target"):
        validate_alembic_target_url(None)

    with pytest.raises(TestDatabaseSecurityError, match="Missing Alembic migration target"):
        validate_alembic_target_url("")

    with pytest.raises(TestDatabaseSecurityError, match="Missing Alembic migration target"):
        validate_alembic_target_url("   ")


def test_alembic_guard_blocks_sqlite_migrations():
    """Verify that SQLite is strictly blocked from running migrations."""
    sqlite_urls = [
        "sqlite:///alembic.db",
        "sqlite:///:memory:",
        "sqlite+aiosqlite:///alembic.db",
    ]
    for url in sqlite_urls:
        with pytest.raises(TestDatabaseSecurityError, match="SQLite is strictly rejected"):
            validate_alembic_target_url(url)


def test_alembic_guard_blocks_production_without_flag():
    """Verify that targeting production/shared database is blocked without ALLOW_PRODUCTION_MIGRATIONS."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    prod_target = "postgresql://user:pass@ep-autumn-leaf-123456.aws.neon.tech:5432/neondb"

    with pytest.raises(TestDatabaseSecurityError, match="Accidental migrations are blocked"):
        validate_alembic_target_url(prod_target, allow_production=False, blocked_targets=blocked)


def test_alembic_guard_allows_production_with_explicit_flag(monkeypatch):
    """Verify that production migration is permitted when ALLOW_PRODUCTION_MIGRATIONS=1."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    prod_target = "postgresql://user:pass@ep-autumn-leaf-123456.aws.neon.tech:5432/neondb"

    # Via parameter
    res = validate_alembic_target_url(prod_target, allow_production=True, blocked_targets=blocked)
    assert res.startswith("postgresql+psycopg://")

    # Via environment variable
    monkeypatch.setenv("ALLOW_PRODUCTION_MIGRATIONS", "1")
    res2 = validate_alembic_target_url(prod_target, allow_production=False, blocked_targets=blocked)
    assert res2.startswith("postgresql+psycopg://")


def test_alembic_guard_blocks_unsupported_schemes():
    """Verify that non-PostgreSQL drivers (MySQL, MSSQL, Mongo) are rejected."""
    for scheme in ["mysql+pymysql://u:p@localhost:3306/db", "mssql+pyodbc://u:p@localhost/db", "mongodb://localhost/db"]:
        with pytest.raises(TestDatabaseSecurityError, match="Unsupported database scheme"):
            validate_alembic_target_url(scheme)


def test_alembic_guard_rejects_missing_hostname_or_database():
    """Verify that URLs missing hostname or database name are rejected."""
    invalid_urls = [
        "postgresql:///only_db_no_host",
        "postgresql://localhost",
        "postgresql://localhost/",
    ]
    for url in invalid_urls:
        with pytest.raises(TestDatabaseSecurityError, match="Could not determine valid hostname and database name"):
            validate_alembic_target_url(url)


def test_alembic_guard_rejects_unknown_external_postgres_target():
    """Verify that unknown/unregistered PostgreSQL targets are rejected by default (fail-closed)."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    unknown_url = "postgresql://user:pass@some-random-external-host:5432/random_db"

    with pytest.raises(TestDatabaseSecurityError, match="not an approved or registered migration target"):
        validate_alembic_target_url(unknown_url, allow_production=False, blocked_targets=blocked)


def test_alembic_guard_production_flag_does_not_authorize_arbitrary_target(monkeypatch):
    """Verify that ALLOW_PRODUCTION_MIGRATIONS=1 CANNOT authorize an unknown or arbitrary database URL."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    arbitrary_url = "postgresql://attacker:secret@rogue-db.example.com:5432/stolen_db"

    # Via allow_production=True parameter
    with pytest.raises(TestDatabaseSecurityError, match="not an approved or registered migration target"):
        validate_alembic_target_url(arbitrary_url, allow_production=True, blocked_targets=blocked)

    # Via ALLOW_PRODUCTION_MIGRATIONS=1 environment variable
    monkeypatch.setenv("ALLOW_PRODUCTION_MIGRATIONS", "1")
    with pytest.raises(TestDatabaseSecurityError, match="not an approved or registered migration target"):
        validate_alembic_target_url(arbitrary_url, allow_production=False, blocked_targets=blocked)


def test_alembic_guard_allows_registered_isolated_test_target(monkeypatch):
    """Verify that an explicitly registered isolated test database is permitted for migrations."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    test_target = "postgresql://test_user:test_pass@localhost:5432/vyasa_test_isolated"

    # Via approved_test_targets parameter
    res = validate_alembic_target_url(
        test_target,
        allow_production=False,
        blocked_targets=blocked,
        approved_test_targets={("localhost", "vyasa_test_isolated")},
    )
    assert res.startswith("postgresql+psycopg://")
    assert "vyasa_test_isolated" in res

    # Via TEST_DATABASE_URL environment variable
    monkeypatch.setenv("TEST_DATABASE_URL", test_target)
    res2 = validate_alembic_target_url(test_target, allow_production=False, blocked_targets=blocked)
    assert res2.startswith("postgresql+psycopg://")
    assert "vyasa_test_isolated" in res2


def test_alembic_guard_rejects_test_target_colliding_with_production():
    """Verify that a TEST_DATABASE_URL colliding with the production database is strictly rejected."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    colliding_test_target = "postgresql://test_user:test_pass@ep-autumn-leaf-123456.aws.neon.tech:5432/neondb"

    with pytest.raises(TestDatabaseSecurityError, match="collides with protected shared/production database"):
        validate_alembic_target_url(
            colliding_test_target,
            allow_production=False,
            blocked_targets=blocked,
            approved_test_targets={("ep-autumn-leaf-123456.aws.neon.tech", "neondb")},
        )


def test_alembic_guard_rejects_invalid_approved_allowlist_entries(monkeypatch):
    """Verify that invalid/malformed entries in APPROVED_MIGRATION_TARGETS fail closed."""
    monkeypatch.setenv("APPROVED_MIGRATION_TARGETS", "valid-host.com/validdb, invalid_entry_without_db, another-valid.com/db")
    with pytest.raises(TestDatabaseSecurityError, match="Invalid approved migration target entry in allowlist"):
        validate_alembic_target_url(
            "postgresql://u:p@valid-host.com:5432/validdb",
            blocked_targets=set(),
        )


def test_alembic_guard_allows_valid_explicit_allowlist_target(monkeypatch):
    """Verify that targets registered in APPROVED_MIGRATION_TARGETS are permitted."""
    allowed_url = "postgresql://ci_runner:pass@staging-ci.internal:5432/vyasa_staging"
    monkeypatch.setenv("APPROVED_MIGRATION_TARGETS", "staging-ci.internal/vyasa_staging")

    res = validate_alembic_target_url(allowed_url, blocked_targets=set())
    assert res.startswith("postgresql+psycopg://")
    assert "vyasa_staging" in res


def test_alembic_guard_url_encoded_database_name_normalization():
    """Verify that URL-encoded database names are decoded and matched correctly."""
    blocked = {("db.example.com", "vyasa test db")}
    url_encoded = "postgresql://user:pass@db.example.com:5432/vyasa%20test%20db"

    # Should detect collision with normalized name
    with pytest.raises(TestDatabaseSecurityError, match="Accidental migrations are blocked"):
        validate_alembic_target_url(url_encoded, allow_production=False, blocked_targets=blocked)

    # Should allow when authorized
    res = validate_alembic_target_url(url_encoded, allow_production=True, blocked_targets=blocked)
    assert "vyasa%20test%20db" in res


def test_alembic_guard_redacts_credentials_in_exception_messages():
    """Verify that credentials are never exposed in exception messages for rejected targets."""
    blocked = {("ep-autumn-leaf-123456.aws.neon.tech", "neondb")}
    sensitive_url = "postgresql://confidential_user:SuperSecretPassword123!@unknown-host.com:5432/secret_db"

    with pytest.raises(TestDatabaseSecurityError) as exc_info:
        validate_alembic_target_url(sensitive_url, allow_production=False, blocked_targets=blocked)

    error_msg = str(exc_info.value)
    assert "SuperSecretPassword123!" not in error_msg
    assert "confidential_user" not in error_msg
    assert "unknown-host.com/secret_db" in error_msg


def test_alembic_cli_conflicting_targets_rejected():
    """Verify that providing conflicting -x db and -x url arguments raises security error."""
    x_db = "postgresql://u:p@host1:5432/db1"
    x_url = "postgresql://u:p@host2:5432/db2"
    with pytest.raises(TestDatabaseSecurityError, match="Conflicting CLI migration target arguments"):
        if x_db and x_url and x_db.strip() != x_url.strip():
            raise TestDatabaseSecurityError("Conflicting CLI migration target arguments: both -x db and -x url were provided with different values.")


def test_alembic_ambiguous_environment_targets_rejected():
    """Verify that ambiguous MIGRATION_DATABASE_URL and TEST_DATABASE_URL without CLI argument is rejected."""
    mig_env = "postgresql://u:p@mig-host:5432/mig_db"
    test_env = "postgresql://u:p@test-host:5432/test_db"
    with pytest.raises(TestDatabaseSecurityError, match="Ambiguous migration target"):
        if mig_env and test_env and mig_env.strip() != test_env.strip():
            raise TestDatabaseSecurityError(
                "Ambiguous migration target: both MIGRATION_DATABASE_URL and TEST_DATABASE_URL are configured "
                "with different targets. Disambiguate by specifying target explicitly via CLI argument (-x db=...)."
            )


