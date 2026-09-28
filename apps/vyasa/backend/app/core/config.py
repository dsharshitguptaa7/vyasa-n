import os
from typing import List, Union, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PORT: int = Field(default=5000, description="Server port")
    NODE_ENV: str = Field(default="development", description="Environment mode")
    SERVICE_NAME: str = Field(default="vyasa-core-backend", description="Service identity")
    API_PREFIX: str = Field(default="/api", description="Base API route prefix")
    CORS_ORIGIN: str = Field(default="http://localhost:5173", description="Allowed CORS origins")
    APPLICATION_TIMEZONE: str = Field(default="Asia/Kolkata", description="Application institutional business timezone")

    # Neon PostgreSQL database URL
    DATABASE_URL: str = Field(..., description="PostgreSQL connection string")

    # Database Pool Settings
    DB_POOL_SIZE: int = Field(default=5, description="Connection pool size")
    DB_MAX_OVERFLOW: int = Field(default=10, description="Max overflow connections")
    DB_POOL_TIMEOUT: int = Field(default=30, description="Pool connection timeout in seconds")
    DB_POOL_RECYCLE: int = Field(default=1800, description="Pool connection recycle in seconds")

    # Security & Identity Foundation (milestone preparation)
    SECRET_KEY: str = Field(
        default="vyasa-core-development-secret-key-csjmu-governance",
        description="Signing secret key for platform tokens",
    )
    ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60, description="Token TTL in minutes")

    # Institutional Authority Seed Configuration
    AUTHORITIES_MANIFEST_PATH: Optional[str] = Field(
        default=None,
        description="Path to institutional authorities manifest JSON file",
    )
    AUTHORITIES_MANIFEST_JSON: Optional[str] = Field(
        default=None,
        description="Inline JSON string containing institutional authorities manifest",
    )

    @property
    def sync_database_url(self) -> str:
        """
        Normalize standard postgresql:// or postgres:// URI to postgresql+psycopg://
        for modern SQLAlchemy 2.x + psycopg v3 driver.
        """
        url = self.DATABASE_URL
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


# Cached singleton settings instance
settings = Settings()
