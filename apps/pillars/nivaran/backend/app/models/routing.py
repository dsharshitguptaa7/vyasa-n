import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EscalationRole


class Assignment(Base):
    __tablename__ = "assignments"

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

    assigned_to: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    assigned_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    unassigned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    assignee = relationship("NivaranAuthority", foreign_keys=[assigned_to])
    assigner = relationship("NivaranAuthority", foreign_keys=[assigned_by])
    forwarding_confirmation = relationship("ForwardingConfirmation", back_populates="assignment", uselist=False)


class ForwardingConfirmation(Base):
    __tablename__ = "forwarding_confirmations"
    __table_args__ = (
        CheckConstraint(
            "reviewed_details = TRUE AND reviewed_documents = TRUE AND "
            "understands_status = TRUE AND action_taken_within_authority = TRUE AND "
            "forwarding_necessary = TRUE AND accepts_accountability = TRUE",
            name="ck_forwarding_confirmations_all_checked",
        ),
        CheckConstraint(
            "char_length(forwarding_reason) >= 10",
            name="ck_forwarding_reason_length",
        ),
        CheckConstraint(
            "char_length(action_taken) >= 10",
            name="ck_forwarding_action_taken_length",
        ),
        CheckConstraint(
            "char_length(why_higher_intervention_required) >= 10",
            name="ck_forwarding_why_higher_length",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("assignments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    confirmed_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    target_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    reviewed_details: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    reviewed_documents: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    understands_status: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    action_taken_within_authority: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    forwarding_necessary: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    accepts_accountability: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    forwarding_reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    action_taken: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    why_higher_intervention_required: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    confirmed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    assignment = relationship("Assignment", back_populates="forwarding_confirmation")
    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    confirmed_by = relationship("NivaranAuthority", foreign_keys=[confirmed_by_id])
    target_authority = relationship("NivaranAuthority", foreign_keys=[target_authority_id])


class Escalation(Base):
    __tablename__ = "escalations"

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

    from_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    from_role: Mapped[EscalationRole] = mapped_column(
        Enum(
            EscalationRole,
            name="escalation_role",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    to_role: Mapped[EscalationRole] = mapped_column(
        Enum(
            EscalationRole,
            name="escalation_role",
            values_callable=lambda obj: [e.value for e in obj],
            create_type=False,
        ),
        nullable=False,
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    escalated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    from_authority = relationship("NivaranAuthority", foreign_keys=[from_authority_id])
