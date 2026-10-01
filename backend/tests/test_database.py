from sqlalchemy import text
from app.core.database import check_database_connection, get_db


def test_database_connection_alive():
    assert check_database_connection() is True


def test_get_db_session(db_session):
    result = db_session.execute(text("SELECT 1")).scalar()
    assert result == 1


def test_get_db_dependency():
    db_gen = get_db()
    session = next(db_gen)
    try:
        result = session.execute(text("SELECT 1")).scalar()
        assert result == 1
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass
