import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class UserTwoFactorAuth(Base):
    __tablename__ = "user_two_factor_auth"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
        comment="1:1 relationship with institutional User record",
    )

    totp_secret_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="AES-encrypted base32 TOTP secret; never stored in plaintext",
    )

    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
        comment="Active status: True only after initial OTP code is confirmed",
    )

    enabled_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when 2FA was initially verified and activated",
    )

    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of most recent successful TOTP or recovery verification",
    )

    last_verified_code_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="SHA-256 hash of last accepted OTP code for replay prevention",
    )

    last_verified_timestep: Mapped[Optional[int]] = mapped_column(
        BigInteger,
        nullable=True,
        comment="RFC 6238 time-step counter of last accepted OTP to prevent reuse",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="two_factor_auth")

    def __repr__(self) -> str:
        return f"<UserTwoFactorAuth(id={self.id}, user_id={self.user_id}, is_enabled={self.is_enabled})>"


class TwoFactorRecoveryCode(Base):
    __tablename__ = "two_factor_recovery_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Foreign key to user holding this recovery code",
    )

    code_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="SHA-256 hash of normalized recovery code",
    )

    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when consumed; null if unused",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<TwoFactorRecoveryCode(id={self.id}, user_id={self.user_id}, used={self.used_at is not None})>"


class AuthenticationChallenge(Base):
    __tablename__ = "authentication_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Pre-authenticated user identity for whom this challenge was issued",
    )

    purpose: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="TWO_FACTOR_SETUP, TWO_FACTOR_LOGIN, or TWO_FACTOR_REPLACE",
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        comment="Strict expiration time (typically 5 minutes from issuance)",
    )

    consumed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when single-use challenge was consumed",
    )

    ip_address: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )

    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AuthenticationChallenge(id={self.id}, user_id={self.user_id}, purpose='{self.purpose}')>"


class TwoFactorAttempt(Base):
    __tablename__ = "two_factor_attempts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_identifier: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="User email or identifier under evaluation",
    )

    ip_address: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )

    success: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    attempted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<TwoFactorAttempt(id={self.id}, user_identifier='{self.user_identifier}', success={self.success})>"
