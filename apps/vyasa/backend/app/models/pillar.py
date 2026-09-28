import uuid
from datetime import datetime
from typing import Optional, Any, Dict
from sqlalchemy import String, Boolean, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class PillarRegistry(Base):
    __tablename__ = "pillar_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    pillar_key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique slug identifier: e.g. pillar-1, pillar-2, nivaran",
    )
    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="Human-readable pillar name",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    base_url: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Root service or dispatch endpoint URL for the pillar",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="active",
        nullable=False,
        comment="Operational status: active, maintenance, beta, disabled",
    )
    version: Mapped[Optional[str]] = mapped_column(
        String(32),
        nullable=True,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Extensible JSONB metadata: capabilities, route, icon, required_roles",
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

    def __repr__(self) -> str:
        return f"<PillarRegistry(id={self.id}, pillar_key='{self.pillar_key}', status='{self.status}', is_enabled={self.is_enabled})>"
