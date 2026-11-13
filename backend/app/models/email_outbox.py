import enum
import uuid
from datetime import datetime
from typing import Optional, Any, Dict, TYPE_CHECKING
from sqlalchemy import String, Boolean, Text, DateTime, ForeignKey, Integer, func, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.notification import Notification, NotificationDelivery


class EmailOutboxStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    SENT = "SENT"
    FAILED = "FAILED"


class EmailOutbox(Base):
    """
    Persistent Transactional Email Outbox.
    Ensures that notifications, business transactions, and outbound email jobs
    are persisted atomically in PostgreSQL without blocking user-facing requests.
    Supports concurrent claiming via SELECT FOR UPDATE SKIP LOCKED.
    """
    __tablename__ = "email_outbox"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    notification_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notifications.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="Associated platform notification UUID",
    )
    notification_delivery_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("notification_deliveries.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
        comment="Associated notification delivery attempt record",
    )
    recipient_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        comment="Validated recipient email address",
    )
    subject: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Rendered institutional email subject line",
    )
    html_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Rendered HTML body content with inline CSS",
    )
    text_content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Rendered plain-text fallback content",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default=EmailOutboxStatus.PENDING.value,
        nullable=False,
        index=True,
        comment="Queue status: PENDING, PROCESSING, SENT, FAILED",
    )
    attempt_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total dispatch attempts completed",
    )
    max_attempts: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
        comment="Maximum allowed retry attempts before marking FAILED",
    )
    next_attempt_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
        comment="Scheduled timestamp for next processing attempt",
    )
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of most recent delivery attempt",
    )
    locked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when claimed by an active worker",
    )
    locked_by: Mapped[Optional[str]] = mapped_column(
        String(128),
        nullable=True,
        comment="Worker instance identifier currently processing this job",
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Sanitized error description from last failed attempt",
    )
    provider: Mapped[str] = mapped_column(
        String(32),
        default="brevo",
        nullable=False,
        comment="Target dispatch provider: brevo, smtp, or simulation",
    )
    provider_message_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Upstream provider message identifier (e.g. Brevo messageId)",
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

    # Table constraints and indexes for high-throughput concurrency
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')",
            name="ck_email_outbox_status",
        ),
        CheckConstraint(
            "attempt_count >= 0 AND max_attempts > 0",
            name="ck_email_outbox_attempts",
        ),
        Index(
            "ix_email_outbox_claim",
            "status",
            "next_attempt_at",
        ),
        Index(
            "ix_email_outbox_abandoned",
            "status",
            "locked_at",
        ),
    )

    # Relationships
    notification: Mapped[Optional["Notification"]] = relationship("Notification")
    delivery: Mapped[Optional["NotificationDelivery"]] = relationship("NotificationDelivery")

    def __repr__(self) -> str:
        return f"<EmailOutbox(id={self.id}, recipient='{self.recipient_email}', status='{self.status}', attempts={self.attempt_count}/{self.max_attempts})>"
