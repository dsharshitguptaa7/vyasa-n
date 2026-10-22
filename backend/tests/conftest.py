# -*- coding: utf-8 -*-
"""
VYASA / NIVARAN-AI Global Test Configuration & Database Isolation Harness

Safety guarantees:
1. Before any application module or SQLAlchemy engine is initialized,
   enforce_test_environment_safety() neutralizes DATABASE_URL to an unroutable loopback dummy
   (127.0.0.1:65432) unless TEST_DATABASE_URL is explicitly set and validated.
2. If TEST_DATABASE_URL is absent or invalid, all database-dependent fixtures (db_session,
   db_connection, client) fail closed immediately without attempting any database connection.
3. If TEST_DATABASE_URL is provided, it is strictly validated:
   - Must use a supported PostgreSQL driver (postgresql+psycopg).
   - SQLite, MySQL, and non-PostgreSQL drivers are strictly rejected.
   - Must NOT collide with the host and database name of the development/shared/production database.
4. Each database test runs within a SAVEPOINT on a single outer transaction, guaranteeing that
   all commits inside tests or API endpoints only affect the savepoint and are completely rolled back
   at test teardown.
5. Credentials and passwords are never printed or logged in error messages or logs.
"""

import os
import sys
from typing import Generator

# STEP 1: Enforce test safety before ANY application, config, or SQLAlchemy imports
from tests.safety_guard import (
    enforce_test_environment_safety,
    mask_database_url,
    TestDatabaseSecurityError,
    BLOCKED_DUMMY_URL,
)

_VALIDATED_TEST_URL = enforce_test_environment_safety()
_IS_ISOLATED = _VALIDATED_TEST_URL is not None

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from fastapi.testclient import TestClient

# STEP 2: Safe imports after environment variables are neutralized/configured
from app.core.config import settings
from app.core.database import get_db
import app.core.database as core_db
from app.main import app
from app.models.base import Base
from app.services.seed_service import seed_all

_test_engine = None
_TestSessionLocal = None

if _IS_ISOLATED:
    connect_args = {}
    if "postgres" in _VALIDATED_TEST_URL:
        connect_args["options"] = "-c timezone=Asia/Kolkata"

    _test_engine = create_engine(
        _VALIDATED_TEST_URL,
        pool_pre_ping=True,
        connect_args=connect_args,
    )
    _TestSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=_test_engine,
        expire_on_commit=False,
    )

    # Patch core_db engine and SessionLocal so all app modules use the isolated test database
    core_db.engine = _test_engine
    core_db.SessionLocal = _TestSessionLocal

    # Prevent lifespan shutdown from disposing test engine mid-session
    _original_engine_dispose = _test_engine.dispose
    core_db.engine.dispose = lambda: None


def _abort_missing_test_db():
    pytest.fail(
        "\n================================================================================\n"
        "TEST ISOLATION GUARD: TEST_DATABASE_URL is not configured.\n\n"
        "To protect shared, staging, and production databases, backend tests that interact\n"
        "with a database are strictly forbidden from connecting to the default DATABASE_URL.\n\n"
        "To run these tests against a dedicated, isolated PostgreSQL test database:\n"
        "  1. Provision a local or dedicated PostgreSQL database (e.g. vyasa_test_db).\n"
        "  2. Export the TEST_DATABASE_URL environment variable:\n"
        "       Windows PowerShell:\n"
        "         $env:TEST_DATABASE_URL='postgresql://<user>:<password>@localhost:5432/vyasa_test_db'\n"
        "       Linux/macOS:\n"
        "         export TEST_DATABASE_URL='postgresql://<user>:<password>@localhost:5432/vyasa_test_db'\n"
        "  3. Run pytest:\n"
        "         pytest tests/test_committee_permissions_workflow.py\n"
        "================================================================================\n",
        pytrace=False,
    )


@pytest.fixture(scope="session", autouse=True)
def setup_test_database_schema():
    """
    Session-level fixture: if an isolated PostgreSQL test database is configured,
    ensures all schema tables exist and seeds foundational master data.
    Disposes test engine when the entire pytest session finishes.
    """
    if _IS_ISOLATED and _test_engine is not None and _TestSessionLocal is not None:
        Base.metadata.create_all(bind=_test_engine)
        with _TestSessionLocal() as seed_db:
            try:
                seed_all(seed_db)
            except Exception:
                pass
        yield
        if _original_engine_dispose is not None:
            _original_engine_dispose()
    else:
        yield


@pytest.fixture(scope="function")
def db_connection():
    """
    Yields an active database connection within an outer transaction.
    Rolls back the outer transaction on teardown to isolate test side-effects.
    """
    if not _IS_ISOLATED or _test_engine is None:
        _abort_missing_test_db()

    connection = _test_engine.connect()
    transaction = connection.begin()
    try:
        yield connection
    finally:
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def db_session(db_connection) -> Generator[Session, None, None]:
    """
    Yields a SQLAlchemy Session bound to the transactional connection with
    join_transaction_mode='create_savepoint'. Any session.commit() calls inside
    tests or API endpoints commit the SAVEPOINT only. Outer transaction rollback
    undoes all changes cleanly.
    """
    session = Session(
        bind=db_connection,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )

    # Automatically re-open a savepoint if the previous one was committed or rolled back
    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    session.begin_nested()

    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """
    FastAPI TestClient with get_db dependency overridden to route all API database
    operations through the isolated, transactional test session.
    """
    if not _IS_ISOLATED:
        _abort_missing_test_db()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client

    app.dependency_overrides.pop(get_db, None)
