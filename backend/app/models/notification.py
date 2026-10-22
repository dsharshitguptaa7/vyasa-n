import uuid
from datetime import datetime
from typing import Optional, Any, Dict, List, TYPE_CHECKING
from sqlalchemy import String, Boolean, Text, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_pillar: Mapped[str] = mapped_column(
        String(64),
        default="VYASA_CORE",
        nullable=False,
        index=True,
        comment="Originating ecosystem pillar (e.g., NIVARAN, VYASA_AI, VYASA_CORE)",
    )
    event_type: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Specific event identifier (e.g., grievance.submitted, grievance.resolved)",
    )
    event_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Deduplication and idempotency tracking key",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    type: Mapped[str] = mapped_column(
        String(64),
        default="info",
        nullable=False,
        comment="Category: info, alert, task, workflow",
    )
    priority: Mapped[str] = mapped_column(
        String(32),
        default="MEDIUM",
        nullable=False,
        comment="Priority tier: LOW, MEDIUM, HIGH, CRITICAL",
    )
    action_route: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Safe internal routing destination for interactive action",
    )
    action_required: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Flag indicating explicit user action or response required",
    )
    entity_type: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="Type of underlying domain entity (e.g., grievance, efile, document)",
    )
    entity_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Reference ID of underlying domain entity",
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    read_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Contextual links, entity IDs, or pillar origin data",
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
    user: Mapped["User"] = relationship(
        "User",
        back_populates="notifications",
    )
    deliveries: Mapped[List["NotificationDelivery"]] = relationship(
        "NotificationDelivery",
        back_populates="notification",
        cascade="all, delete-orphan",
    )

    def __init__(self, **kwargs):
        src = kwargs.get("source_pillar")
        evt = kwargs.get("event_type")
        ent = kwargs.get("entity_type")
        notif_type = kwargs.get("type")
        title = kwargs.get("title")

        # Resolve authoritative source pillar if omitted or set to CORE
        if not src or src.strip().upper() in {"VYASA_CORE", "CORE"}:
            if (
                (evt and any(evt.startswith(p) for p in ["grievance.", "manager.", "authority.", "committee."]))
                or (notif_type and any(t in notif_type.upper() for t in ["GRIEVANCE", "DOCUMENT_REQUEST", "COMMITTEE"]))
                or ent == "grievance"
                or (title and any(w in title for w in ["Grievance", "E-File", "Feedback"]))
            ):
                kwargs["source_pillar"] = "NIVARAN"
            elif src:
                kwargs["source_pillar"] = src.strip().upper()
            else:
                kwargs["source_pillar"] = "VYASA_CORE"
        else:
            kwargs["source_pillar"] = src.strip().upper()

        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, user_id={self.user_id}, pillar={self.source_pillar}, title='{self.title}', is_read={self.is_read})>"


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_pillar: Mapped[str] = mapped_column(
        String(64),
        default="*",
        nullable=False,
        comment="Pillar ID or '*' for ecosystem-wide default",
    )
    event_type: Mapped[str] = mapped_column(
        String(100),
        default="*",
        nullable=False,
        comment="Specific event type or '*' for all pillar events",
    )
    in_app_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    email_enabled: Mapped[bool] = mapped_column(
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

    user: Mapped["User"] = relationship("User")

    def __repr__(self) -> str:
        return f"<NotificationPreference(user_id={self.user_id}, pillar={self.source_pillar}, in_app={self.in_app_enabled}, email={self.email_enabled})>"


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    source_pillar: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    title_template: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    body_template: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    action_route_template: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    default_priority: Mapped[str] = mapped_column(
        String(32),
        default="MEDIUM",
        nullable=False,
    )
    is_action_required: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
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

    def __repr__(self) -> str:
        return f"<NotificationTemplate(pillar={self.source_pillar}, event={self.event_type}, v={self.version})>"


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    notification_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    channel: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        comment="Channel: IN_APP, EMAIL",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="PENDING",
        nullable=False,
        comment="Status: PENDING, SENT, FAILED, SKIPPED",
    )
    attempt_count: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )
    last_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    recipient_destination: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Destination target like email address (sanitized)",
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
    notification: Mapped["Notification"] = relationship(
        "Notification",
        back_populates="deliveries",
    )

    def __repr__(self) -> str:
        return f"<NotificationDelivery(id={self.id}, channel={self.channel}, status={self.status})>"
