import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ApprovalActionType, ApprovalRequestStatus


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    requested_from_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    justification_notes: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    status: Mapped[ApprovalRequestStatus] = mapped_column(
        Enum(
            ApprovalRequestStatus,
            name="approval_request_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=ApprovalRequestStatus.PENDING,
        nullable=False,
        index=True,
    )

    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    requested_by = relationship("NivaranAuthority", foreign_keys=[requested_by_id])
    requested_from = relationship("NivaranAuthority", foreign_keys=[requested_from_id])
    actions = relationship("ApprovalAction", back_populates="approval_request", cascade="all, delete-orphan")


class ApprovalAction(Base):
    __tablename__ = "approval_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    approval_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("approval_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    actor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    action: Mapped[ApprovalActionType] = mapped_column(
        Enum(
            ApprovalActionType,
            name="approval_action_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    decision_context: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    action_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    approval_request = relationship("ApprovalRequest", back_populates="actions")
    actor = relationship("NivaranAuthority", foreign_keys=[actor_id])
