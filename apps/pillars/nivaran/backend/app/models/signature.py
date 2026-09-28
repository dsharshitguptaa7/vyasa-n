import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import DigitalSignatureEntityType, SigningKeyStatus


class SigningKeyVersion(Base):
    __tablename__ = "signing_key_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    key_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    algorithm: Mapped[str] = mapped_column(
        String(50),
        default="RSA-PSS-SHA256",
        nullable=False,
    )

    public_key_pem: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    private_key_reference: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    fingerprint: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    status: Mapped[SigningKeyStatus] = mapped_column(
        Enum(
            SigningKeyStatus,
            name="signing_key_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=SigningKeyStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    retired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class SigningAuthorizationChallenge(Base):
    __tablename__ = "signing_authorization_challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    user_vyasa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    purpose: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )

    resource_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    payload_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])


class DigitalSignature(Base):
    __tablename__ = "digital_signatures"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    signature_version: Mapped[int] = mapped_column(
        Integer,
        default=2,
        nullable=False,
    )

    entity_type: Mapped[DigitalSignatureEntityType] = mapped_column(
        Enum(
            DigitalSignatureEntityType,
            name="digital_signature_entity_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )

    entity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    signed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    signed_by_name_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    signed_by_role_snapshot: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    signed_by_department_snapshot: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    signed_content: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )

    content_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )

    signature_algorithm: Mapped[str] = mapped_column(
        String(50),
        default="RSA-PSS-SHA256",
        nullable=False,
    )

    signature_value: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    key_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    key_fingerprint: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    public_key_snapshot: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    signing_authorization_method: Mapped[str | None] = mapped_column(
        String(50),
        default="TOTP",
        nullable=True,
    )

    signing_authorized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    signed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    is_valid: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )

    invalidated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    invalidation_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    signed_by = relationship("NivaranAuthority", foreign_keys=[signed_by_id])
