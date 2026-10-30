import os
import base64
from typing import List, Union, Optional
from pydantic import Field, field_validator, model_validator
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

    # Storage Foundation
    STORAGE_BASE_DIR: str = Field(
        default="storage",
        description="Base filesystem directory for secure document, certificate, and media storage",
    )

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

    # TOTP Two-Factor Authentication Settings
    TOTP_ENCRYPTION_KEY: str = Field(
        default="",
        description="Dedicated Fernet key (32 url-safe base64-encoded bytes) for encrypting TOTP secrets at rest; strictly required in production",
    )
    TOTP_ISSUER: str = Field(
        default="VYASA-N",
        description="Institutional issuer name for authenticator apps",
    )
    TWO_FACTOR_CHALLENGE_EXPIRE_MINUTES: int = Field(
        default=5,
        description="Time-to-live for pre-auth 2FA challenges in minutes",
    )
    MAX_FAILED_LOGIN_ATTEMPTS: int = Field(
        default=5,
        description="Maximum consecutive failed 2FA / login attempts before temporary lockout",
    )
    FAILED_LOGIN_LOCKOUT_MINUTES: int = Field(
        default=15,
        description="Lockout window duration in minutes when failed attempts threshold is exceeded",
    )

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """
        Enforce strict cryptographic configuration in production mode.
        Fails closed if TOTP_ENCRYPTION_KEY or SECRET_KEY are missing, default, or malformed.
        """
        env = (self.NODE_ENV or "development").strip().lower()
        if env in ("production", "prod"):
            # 1. Validate SECRET_KEY is not default
            if (
                not self.SECRET_KEY
                or self.SECRET_KEY == "vyasa-core-development-secret-key-csjmu-governance"
                or "development" in self.SECRET_KEY.lower()
            ):
                raise ValueError(
                    "Production configuration error: SECRET_KEY must be set to a secure, non-default value in production."
                )

            # 2. Validate TOTP_ENCRYPTION_KEY
            key = (self.TOTP_ENCRYPTION_KEY or "").strip()
            if not key:
                raise ValueError(
                    "Production configuration error: TOTP_ENCRYPTION_KEY is strictly required in production mode."
                )
            if (
                key == "vyasa-core-development-secret-key-csjmu-governance"
                or "development" in key.lower()
                or "default" in key.lower()
            ):
                raise ValueError(
                    "Production configuration error: TOTP_ENCRYPTION_KEY must not use a known development secret."
                )

            # Validate valid Fernet key format (32 url-safe base64-encoded bytes, 44 chars)
            try:
                from cryptography.fernet import Fernet
                raw_bytes = base64.urlsafe_b64decode(key.encode("utf-8"))
                if len(raw_bytes) != 32:
                    raise ValueError("Key decoded length must be 32 bytes")
                Fernet(key.encode("utf-8"))
            except Exception:
                raise ValueError(
                    "Production configuration error: TOTP_ENCRYPTION_KEY is not a valid 32-byte URL-safe base64 Fernet key."
                )

        return self

    # Institutional Authority Seed Configuration
    AUTHORITIES_MANIFEST_PATH: Optional[str] = Field(
        default=None,
        description="Path to institutional authorities manifest JSON file",
    )
    AUTHORITIES_MANIFEST_JSON: Optional[str] = Field(
        default=None,
        description="Inline JSON string containing institutional authorities manifest",
    )

    # Atharva Veda / NIVARAN AI & OCR Settings
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        description="Google Gemini API key for OCR extraction and multimodal intake",
    )
    GEMINI_MODEL: str = Field(
        default="gemini-2.0-flash-lite",
        description="Gemini model identifier for institutional OCR extraction",
    )

    # Google Workspace / Google Meet Integration Settings
    GOOGLE_MEET_CLIENT_ID: Optional[str] = Field(
        default=None,
        description="Google OAuth2 Client ID for Meet/Calendar integration",
    )
    GOOGLE_MEET_CLIENT_SECRET: Optional[str] = Field(
        default=None,
        description="Google OAuth2 Client Secret for Meet/Calendar integration",
    )
    GOOGLE_MEET_REFRESH_TOKEN: Optional[str] = Field(
        default=None,
        description="Google OAuth2 Refresh Token for Meet/Calendar integration",
    )
    GOOGLE_SERVICE_ACCOUNT_JSON: Optional[str] = Field(
        default=None,
        description="Google Service Account JSON credentials for Workspace Meet integration",
    )

    # Ph.D. RAG Public Rate Limiting
    PHD_RAG_RATE_LIMIT_ENABLED: bool = Field(
        default=True,
        description="Enable application-level rate limiting on public Ph.D. chat endpoint",
    )
    PHD_RAG_RATE_LIMIT_PER_MINUTE: int = Field(
        default=20,
        description="Maximum requests permitted per minute per client IP",
    )
    PHD_RAG_RATE_LIMIT_WINDOW_SECONDS: int = Field(
        default=60,
        description="Rate limit sliding window duration in seconds",
    )
    TRUSTED_PROXIES: str = Field(
        default="127.0.0.1,::1",
        description="Comma-separated list of trusted upstream proxy IP addresses",
    )

    # Institutional Email & SMTP Settings (VYASA Centralized Email Service)
    EMAIL_PROVIDER: str = Field(default="brevo", description="Active email provider: brevo, smtp, or simulation")
    BREVO_API_KEY: Optional[str] = Field(default=None, description="Brevo API key for transactional email delivery")
    BREVO_API_URL: str = Field(default="https://api.brevo.com/v3/smtp/email", description="Brevo v3 transactional email API endpoint")
    BREVO_TIMEOUT_SECONDS: int = Field(default=10, description="HTTP timeout for Brevo API calls in seconds")
    SMTP_HOST: Optional[str] = Field(default=None, description="SMTP server hostname")
    SMTP_PORT: int = Field(default=587, description="SMTP server port (587 for STARTTLS, 465 for SSL)")
    SMTP_USERNAME: Optional[str] = Field(default=None, description="SMTP authentication username")
    SMTP_PASSWORD: Optional[str] = Field(default=None, description="SMTP authentication password")
    SMTP_USE_TLS: bool = Field(default=True, description="Enable STARTTLS encryption")
    SMTP_USE_SSL: bool = Field(default=False, description="Enable direct SSL encryption")
    SMTP_TIMEOUT_SECONDS: int = Field(default=10, description="SMTP connection timeout in seconds")
    EMAIL_ENABLED: bool = Field(default=False, description="Enable live email delivery; when False, emails are safely simulated/logged")
    EMAIL_FROM_ADDRESS: str = Field(default="noreply@csjmu.ac.in", description="Institutional sender email address")
    EMAIL_FROM_NAME: str = Field(default="VYASAᴺ — CSJMU Kanpur", description="Institutional sender display name")
    PORTAL_BASE_URL: str = Field(default="https://vyasa.csjmu.ac.in", description="Institutional portal base URL for secure deep links")
    SUPPORT_CONTACT_EMAIL: str = Field(default="grievance.support@csjmu.ac.in", description="Institutional support contact email")

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
            base = ["http://localhost:5173", "http://127.0.0.1:5173"]
        else:
            base = [origin.strip() for origin in self.CORS_ORIGIN.split(",") if origin.strip()]
        resolved = list(base)
        for origin in base:
            if "localhost" in origin:
                resolved.append(origin.replace("localhost", "127.0.0.1"))
            elif "127.0.0.1" in origin:
                resolved.append(origin.replace("127.0.0.1", "localhost"))
        return list(dict.fromkeys(resolved))


# Cached singleton settings instance
settings = Settings()
