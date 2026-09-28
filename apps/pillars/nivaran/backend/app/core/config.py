from typing import List
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    SERVICE_NAME: str = Field(default="vyasa-nivaran-backend", description="Pillar service name")
    API_V1_PREFIX: str = Field(default="/api/v1", description="API v1 prefix")
    PORT: int = Field(default=8001, description="NIVARAN backend port")
    ENVIRONMENT: str = Field(default="development", description="Environment mode")
    CORS_ORIGIN: str = Field(default="http://localhost:5173", description="Allowed CORS origins")

    # Neon PostgreSQL database URL (SecretStr to prevent accidental exposure)
    DATABASE_URL: SecretStr = Field(..., description="PostgreSQL connection string")

    # Database Pool Settings
    DB_POOL_SIZE: int = Field(default=5, description="Connection pool size")
    DB_MAX_OVERFLOW: int = Field(default=10, description="Max overflow connections")
    DB_POOL_TIMEOUT: int = Field(default=30, description="Pool connection timeout in seconds")
    DB_POOL_RECYCLE: int = Field(default=1800, description="Pool connection recycle in seconds")

    # Applicant Rate Limits & Timezone
    DAILY_GRIEVANCE_SUBMISSION_LIMIT: int = Field(default=3, description="Daily grievance submission limit per applicant")
    DAILY_OCR_REQUEST_LIMIT: int = Field(default=3, description="Daily OCR extraction limit per applicant")
    APPLICATION_TIMEZONE: str = Field(default="Asia/Kolkata", description="Timezone for calendar day accounting")
    SIMILARITY_THRESHOLD_GLOBAL: float = Field(default=0.85, description="Global TF-IDF cosine similarity threshold")

    # Gemini OCR Extraction (Stateless Input Assistance Only)
    GEMINI_API_KEY: str = Field(default="", description="Gemini API key for OCR extraction")
    GEMINI_MODEL: str = Field(default="gemini-3.1-flash-lite", description="Gemini model name for OCR extraction")

    # VYASA Core Identity Integration
    VYASA_CORE_URL: str = Field(default="http://localhost:5000", description="Base URL of VYASA Core identity service")
    VYASA_IDENTITY_VERIFY_TIMEOUT_SECONDS: float = Field(default=5.0, description="Timeout for VYASA verification requests")

    @property
    def raw_database_url(self) -> str:
        """Access raw database URL string securely."""
        return self.DATABASE_URL.get_secret_value()

    @property
    def sync_database_url(self) -> str:
        """
        Normalize standard postgresql:// or postgres:// URI to postgresql+psycopg://
        for modern SQLAlchemy 2.x + psycopg v3 driver.
        """
        url = self.raw_database_url
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+psycopg://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def cors_origins(self) -> List[str]:
        if not self.CORS_ORIGIN:
            return ["http://localhost:5173"]
        return [origin.strip() for origin in self.CORS_ORIGIN.split(",") if origin.strip()]


settings = Settings()
