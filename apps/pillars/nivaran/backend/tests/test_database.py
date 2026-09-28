"""Tests for database connectivity and session lifecycle."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import check_database_connection, engine, get_db


def test_engine_initialized() -> None:
    """Verify SQLAlchemy engine is properly initialized."""
    assert engine is not None
    assert engine.dialect.name == "postgresql"


def test_database_connection_check() -> None:
    """Verify live connectivity check succeeds against the database."""
    connected = check_database_connection()
    assert connected is True


def test_db_session_query(db_session: Session) -> None:
    """Verify session can execute queries."""
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_get_db_generator() -> None:
    """Verify get_db dependency yields a valid session and closes cleanly."""
    gen = get_db()
    session = next(gen)
    try:
        assert isinstance(session, Session)
        result = session.execute(text("SELECT 1")).scalar()
        assert result == 1
    finally:
        try:
            next(gen)
        except StopIteration:
            pass
