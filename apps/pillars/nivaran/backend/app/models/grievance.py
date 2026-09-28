import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import (
    GrievancePriority,
    GrievanceStatus,
    HistoryActorType,
    StudentRecordStatus,
)


class StudentMasterRecord(Base):
    __tablename__ = "student_master_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    student_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        index=True,
    )

    record_number: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    registration_number_snapshot: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    enrollment_number_snapshot: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    department_snapshot: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    program_name_snapshot: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    full_name_snapshot: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True,
    )

    email_snapshot: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    mobile_snapshot: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    status: Mapped[StudentRecordStatus] = mapped_column(
        Enum(
            StudentRecordStatus,
            name="student_record_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=StudentRecordStatus.ACTIVE,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievances = relationship("Grievance", back_populates="student_master_record")


class Grievance(Base):
    __tablename__ = "grievances"

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
    )

    applicant_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    student_record_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("student_master_records.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    subject_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    final_category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    category_reviewed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    category_overridden: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    status: Mapped[GrievanceStatus] = mapped_column(
        Enum(
            GrievanceStatus,
            name="grievance_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=GrievanceStatus.SUBMITTED,
        nullable=False,
        index=True,
    )

    priority: Mapped[GrievancePriority] = mapped_column(
        Enum(
            GrievancePriority,
            name="grievance_priority",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=GrievancePriority.MEDIUM,
        nullable=False,
    )

    ai_confidence: Mapped[float | None] = mapped_column(
        Numeric(5, 4),
        nullable=True,
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    last_action_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    last_reminder_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    resolution_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    resolved_by_authority_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    closure_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    closed_by_authority_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Reopening & Cycle Tracking
    reopened_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    reopened_by_vyasa_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    reopen_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    previous_resolution_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    previous_resolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    previous_resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    previous_closure_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    previous_closed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    previous_closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    student_master_record = relationship("StudentMasterRecord", back_populates="grievances")
    subject = relationship("Subject", foreign_keys=[subject_id])
    category = relationship("Category", foreign_keys=[category_id])
    final_category = relationship("Category", foreign_keys=[final_category_id])
    resolved_by = relationship("NivaranAuthority", foreign_keys=[resolved_by_authority_id])
    closed_by = relationship("NivaranAuthority", foreign_keys=[closed_by_authority_id])
    previous_resolved_by = relationship("NivaranAuthority", foreign_keys=[previous_resolved_by_id])
    previous_closed_by = relationship("NivaranAuthority", foreign_keys=[previous_closed_by_id])

    status_history = relationship("GrievanceStatusHistory", back_populates="grievance", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="grievance", cascade="all, delete-orphan")
    feedback = relationship("GrievanceFeedback", back_populates="grievance", uselist=False, cascade="all, delete-orphan")


class GrievanceStatusHistory(Base):
    __tablename__ = "grievance_status_history"

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

    previous_status: Mapped[GrievanceStatus | None] = mapped_column(
        Enum(
            GrievanceStatus,
            name="grievance_status",
            values_callable=lambda obj: [e.value for e in obj],
            create_type=False,
        ),
        nullable=True,
    )

    new_status: Mapped[GrievanceStatus] = mapped_column(
        Enum(
            GrievanceStatus,
            name="grievance_status",
            values_callable=lambda obj: [e.value for e in obj],
            create_type=False,
        ),
        nullable=False,
    )

    changed_by_vyasa_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    actor_type: Mapped[HistoryActorType] = mapped_column(
        Enum(
            HistoryActorType,
            name="history_actor_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=HistoryActorType.USER,
        nullable=False,
    )

    remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", back_populates="status_history")


class Comment(Base):
    __tablename__ = "comments"

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

    user_vyasa_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    comment: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    is_internal: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", back_populates="comments")


class GrievanceFeedback(Base):
    __tablename__ = "grievance_feedback"
    __table_args__ = (
        UniqueConstraint(
            "grievance_id",
            "applicant_vyasa_user_id",
            name="uq_grievance_feedback_grievance_applicant",
        ),
        CheckConstraint(
            "resolution_quality >= 1 AND resolution_quality <= 5",
            name="ck_feedback_resolution_quality",
        ),
        CheckConstraint(
            "response_time >= 1 AND response_time <= 5",
            name="ck_feedback_response_time",
        ),
        CheckConstraint(
            "overall_experience >= 1 AND overall_experience <= 5",
            name="ck_feedback_overall_experience",
        ),
    )

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

    applicant_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    resolution_quality: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    response_time: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    overall_experience: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    comments: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", back_populates="feedback")
