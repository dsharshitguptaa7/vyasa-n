import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import EFileStatus


class EFile(Base):
    __tablename__ = "efiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    e_file_number: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
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

    status: Mapped[EFileStatus] = mapped_column(
        Enum(
            EFileStatus,
            name="efile_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=EFileStatus.DRAFT,
        nullable=False,
        index=True,
    )

    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    sealed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    sealed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )

    summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    pdf_path: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    pdf_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    pdf_size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    generated_at: Mapped[datetime | None] = mapped_column(
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

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    student_record = relationship("StudentMasterRecord", foreign_keys=[student_record_id])
    sealed_by = relationship("NivaranAuthority", foreign_keys=[sealed_by_id])
    documents = relationship("EFileDocument", back_populates="efile", cascade="all, delete-orphan")


class EFileDocument(Base):
    __tablename__ = "efile_documents"
    __table_args__ = (
        UniqueConstraint(
            "efile_id",
            "document_id",
            "document_version",
            name="uq_efile_document_version",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    efile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("efiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    document_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    document_version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    included_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    efile = relationship("EFile", back_populates="documents")
    document = relationship("Document", foreign_keys=[document_id])
