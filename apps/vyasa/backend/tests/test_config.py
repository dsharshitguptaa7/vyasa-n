from app.core.config import Settings


def test_settings_database_url_normalization():
    s1 = Settings(DATABASE_URL="postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require")
    assert s1.sync_database_url == "postgresql+psycopg://user:pass@ep-test.neon.tech/neondb?sslmode=require"

    s2 = Settings(DATABASE_URL="postgres://user:pass@ep-test.neon.tech/neondb?sslmode=require")
    assert s2.sync_database_url == "postgresql+psycopg://user:pass@ep-test.neon.tech/neondb?sslmode=require"

    s3 = Settings(DATABASE_URL="postgresql+psycopg://user:pass@ep-test.neon.tech/neondb?sslmode=require")
    assert s3.sync_database_url == "postgresql+psycopg://user:pass@ep-test.neon.tech/neondb?sslmode=require"


def test_cors_origins_parsing():
    s = Settings(
        DATABASE_URL="postgresql://test:test@localhost/test",
        CORS_ORIGIN="http://localhost:3000, https://vyasa.csjmu.ac.in",
    )
    assert s.cors_origins == ["http://localhost:3000", "https://vyasa.csjmu.ac.in"]
