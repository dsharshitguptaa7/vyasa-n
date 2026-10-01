import uuid
from datetime import datetime
from typing import Optional, Any, Dict
from sqlalchemy import String, DateTime, ForeignKey, Index, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_module_created", "module", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Actor who performed the action; null for system/anonymous events",
    )
    module: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Subsystem or Veda domain: core, atharva_veda, rig_veda, etc.",
    )
    action: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
        index=True,
        comment="Action performed: e.g. auth.login, taxonomy.mapping_updated, etc.",
    )
    entity_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Target entity: e.g. SubjectCluster, Authority, Grievance",
    )
    entity_id: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="Target primary key or identifier string",
    )
    details: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Structured non-sensitive audit metadata (diffs, before/after, changes)",
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, module='{self.module}', action='{self.action}', entity='{self.entity_name}:{self.entity_id}')>"
