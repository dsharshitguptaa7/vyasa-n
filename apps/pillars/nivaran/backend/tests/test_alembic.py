"""Tests verifying Alembic migration state and head revision."""

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.orm import Session


def test_alembic_migration_head() -> None:
    """Verify that Alembic script directory has exactly one head revision."""
    alembic_cfg = Config("alembic.ini")
    script = ScriptDirectory.from_config(alembic_cfg)
    heads = script.get_heads()
    assert len(heads) == 1
    assert heads[0] == "cb0e7ff029ea"


def test_database_alembic_version(db_session: Session) -> None:
    """Verify that the database alembic_version table matches the head revision."""
    result = db_session.execute(text("SELECT version_num FROM alembic_version")).scalar()
    assert result == "cb0e7ff029ea"
