import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Assignment(Base):
    __tablename__ = "nivaran_assignments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    assignment_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    unassigned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    authority = relationship("NivaranAuthority", foreign_keys=[authority_id])


class ForwardingConfirmation(Base):
    __tablename__ = "nivaran_forwarding_confirmations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="RESTRICT rule preserves statutory accountability ledger",
    )
    forwarded_by_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    forwarded_to_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # 6 statutory verification checkboxes
    jurisdiction_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    evidence_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    prior_actions_checked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    identity_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    urgency_assessed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    conflict_of_interest_cleared: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # 3 mandatory justification texts
    justification_reason: Mapped[str] = mapped_column(Text, nullable=False)
    actions_taken_summary: Mapped[str] = mapped_column(Text, nullable=False)
    expected_outcome: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    forwarded_by = relationship("NivaranAuthority", foreign_keys=[forwarded_by_authority_id])
    forwarded_to = relationship("NivaranAuthority", foreign_keys=[forwarded_to_authority_id])


class Escalation(Base):
    __tablename__ = "nivaran_escalations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    escalated_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    target_role: Mapped[str] = mapped_column(String(32), nullable=False)
    escalation_reason: Mapped[str] = mapped_column(Text, nullable=False)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    escalated_by = relationship("NivaranAuthority", foreign_keys=[escalated_by_id])
