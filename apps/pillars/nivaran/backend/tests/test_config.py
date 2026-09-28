"""Tests for application configuration and settings."""

from pydantic import SecretStr

from app.core.config import Settings, settings


def test_settings_loaded() -> None:
    """Verify settings loaded with correct types and non-empty values."""
    assert settings.SERVICE_NAME == "vyasa-nivaran-backend"
    assert settings.API_V1_PREFIX == "/api/v1"
    assert isinstance(settings.DATABASE_URL, SecretStr)
    assert settings.DATABASE_URL.get_secret_value() != ""


def test_database_url_masked_in_repr_and_str() -> None:
    """Verify that credentials are NEVER exposed when printing settings or DATABASE_URL."""
    db_str = str(settings.DATABASE_URL)
    db_repr = repr(settings.DATABASE_URL)
    settings_repr = repr(settings)

    # Must be masked by Pydantic SecretStr
    assert "**********" in db_str or "SecretStr('**********')" in db_repr
    raw_secret = settings.DATABASE_URL.get_secret_value()
    assert raw_secret not in db_str
    assert raw_secret not in settings_repr


def test_sync_database_url_format() -> None:
    """Verify that sync_database_url uses postgresql+psycopg:// scheme."""
    sync_url = settings.sync_database_url
    assert sync_url.startswith("postgresql+psycopg://")


def test_cors_origins_parsing() -> None:
    """Verify CORS origins string is parsed into a list."""
    custom_settings = Settings(
        DATABASE_URL=SecretStr("postgresql://user:pass@localhost:5432/testdb"),
        CORS_ORIGIN="http://localhost:3000, http://localhost:8000",
    )
    origins = custom_settings.cors_origins
    assert "http://localhost:3000" in origins
    assert "http://localhost:8000" in origins
    assert len(origins) == 2
