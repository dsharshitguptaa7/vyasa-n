import uuid
from datetime import datetime
from typing import Optional, Any, Dict
from sqlalchemy import String, Boolean, Text, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, synonym
from app.models.base import Base


class ModuleRegistry(Base):
    __tablename__ = "module_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    module_key: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
        comment="Unique slug identifier: e.g. atharva_veda_nivaran, rig_veda, yajur_veda, sama_veda",
    )
    name: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        comment="Human-readable module name",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    base_url: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Legacy service dispatch URL or documentation path",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="active",
        nullable=False,
        comment="Operational status: active, maintenance, beta, planned, disabled",
    )
    version: Mapped[Optional[str]] = mapped_column(
        String(32),
        default="1.0.0",
        nullable=True,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Operational toggle controlling module availability",
    )
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Non-executable operational metadata and capability flags",
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

    # Backwards compatibility synonym for legacy pillar queries
    pillar_key = synonym("module_key")

    def __repr__(self) -> str:
        return f"<ModuleRegistry(id={self.id}, module_key='{self.module_key}', status='{self.status}', is_enabled={self.is_enabled})>"


# Backwards compatibility alias
PillarRegistry = ModuleRegistry
