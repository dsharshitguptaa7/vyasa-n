import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.modules.atharva_veda.nivaran.models.enums import (
    GrievancePriority,
    GrievanceStatus,
    HistoryActorType,
    StudentRecordStatus,
)


class StudentMasterRecord(Base):
    __tablename__ = "nivaran_student_master_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    student_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Direct FK to canonical Core user identity",
    )
    record_number: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )
    registration_number_snapshot: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Snapshot of PhD/Enrollment registration number at time of filing",
    )
    enrollment_number_snapshot: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    full_name_snapshot: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Snapshot of scholar's legal full name at filing",
    )
    email_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    mobile_snapshot: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_subjects.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Academic subject affiliation at filing",
    )
    status: Mapped[StudentRecordStatus] = mapped_column(
        Enum(StudentRecordStatus, name="student_record_status"),
        default=StudentRecordStatus.ACTIVE,
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
    user = relationship("User", foreign_keys=[student_vyasa_user_id])
    subject = relationship("Subject", foreign_keys=[subject_id])


class Grievance(Base):
    __tablename__ = "nivaran_grievances"
    __table_args__ = (
        Index(
            "ix_nivaran_grv_applicant_active",
            "applicant_vyasa_user_id",
            "status",
            "created_at",
        ),
        Index(
            "ix_nivaran_grv_auth_triage",
            "assigned_authority_id",
            "status",
            "priority",
            "created_at",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    grievance_id: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique institutional tracking ID e.g. CSJMU-YYYY-NNNNN",
    )
    applicant_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Direct FK to submitting scholar's Core identity",
    )
    student_record_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_student_master_records.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Point-in-time scholar profile snapshot",
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_subjects.id", ondelete="RESTRICT"),
        nullable=False,
    )
    category_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_categories.id", ondelete="RESTRICT"),
        nullable=False,
    )
    final_category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_categories.id", ondelete="RESTRICT"),
        nullable=True,
        comment="Overridden or ratified category after triage review",
    )
    status: Mapped[GrievanceStatus] = mapped_column(
        Enum(GrievanceStatus, name="grievance_status"),
        default=GrievanceStatus.SUBMITTED,
        nullable=False,
        comment="10 core lifecycle states",
    )
    priority: Mapped[GrievancePriority] = mapped_column(
        Enum(GrievancePriority, name="grievance_priority"),
        default=GrievancePriority.MEDIUM,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    assigned_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
        comment="Currently assigned handling authority",
    )
    resolved_by_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolution_summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    closed_by_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    reopen_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    # Reopen audit fields (preserving cycle 1 upon Dean reopen)
    previous_cycle_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    previous_resolution_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    previous_resolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    previous_resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    previous_closed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    previous_closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Triage flags
    category_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    category_overridden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    category_override_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_suggested_category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    ai_confidence: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)

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
    applicant = relationship("User", foreign_keys=[applicant_vyasa_user_id])
    student_record = relationship("StudentMasterRecord", foreign_keys=[student_record_id])
    subject = relationship("Subject", foreign_keys=[subject_id])
    category = relationship("Category", foreign_keys=[category_id])
    assigned_authority = relationship("NivaranAuthority", foreign_keys=[assigned_authority_id])
    resolved_by = relationship("NivaranAuthority", foreign_keys=[resolved_by_authority_id])
    closed_by = relationship("NivaranAuthority", foreign_keys=[closed_by_authority_id])


class GrievanceStatusHistory(Base):
    __tablename__ = "nivaran_grievance_status_history"

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
        comment="Strict RESTRICT delete rule to preserve historical evidence",
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=True,
    )
    actor_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    actor_type: Mapped[HistoryActorType] = mapped_column(
        Enum(HistoryActorType, name="history_actor_type"),
        default=HistoryActorType.USER,
        nullable=False,
    )
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    grievance = relationship("Grievance", foreign_keys=[grievance_id])


class Comment(Base):
    __tablename__ = "nivaran_comments"

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
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    author_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    is_internal: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    comment_text: Mapped[str] = mapped_column(Text, nullable=False)
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
    grievance = relationship("Grievance", foreign_keys=[grievance_id])


class GrievanceFeedback(Base):
    __tablename__ = "nivaran_grievance_feedback"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_nivaran_feedback_rating"),
        CheckConstraint("timeliness_rating BETWEEN 1 AND 5", name="ck_nivaran_feedback_timeliness"),
        CheckConstraint("fairness_rating BETWEEN 1 AND 5", name="ck_nivaran_feedback_fairness"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    timeliness_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    fairness_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    feedback_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    grievance = relationship("Grievance", foreign_keys=[grievance_id])
