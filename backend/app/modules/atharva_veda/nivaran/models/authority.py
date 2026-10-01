import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole


class NivaranAuthority(Base):
    __tablename__ = "nivaran_authorities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
        comment="Direct 1:1 foreign key to canonical Core user identity",
    )
    role: Mapped[NivaranRole] = mapped_column(
        Enum(NivaranRole, name="nivaran_role"),
        nullable=False,
        comment="Authority role: MANAGER, ASSISTANT_DEAN, ASSOCIATE_DEAN, DEAN, GUEST_MEMBER",
    )
    name_snapshot: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Snapshot of authority name at appointment for immutable rulings",
    )
    email_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Snapshot of institutional email at appointment",
    )
    designation: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    department: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User", foreign_keys=[vyasa_user_id])

    def __repr__(self) -> str:
        return f"<NivaranAuthority(id={self.id}, vyasa_user_id={self.vyasa_user_id}, role='{self.role}', is_active={self.is_active})>"
