import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.modules.atharva_veda.nivaran.models.enums import EFileStatus


class EFile(Base):
    __tablename__ = "nivaran_efiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    e_file_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="RESTRICT"),
        unique=True,
        nullable=False,
        index=True,
        comment="RESTRICT prevents deleting grievance if an official E-File exists",
    )
    applicant_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    student_record_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_student_master_records.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    status: Mapped[EFileStatus] = mapped_column(
        Enum(EFileStatus, name="efile_status"),
        default=EFileStatus.DRAFT,
        nullable=False,
    )
    file_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    content_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_sealed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sealed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sealed_by_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    applicant = relationship("User", foreign_keys=[applicant_vyasa_user_id])
    student_record = relationship("StudentMasterRecord", foreign_keys=[student_record_id])
    sealed_by = relationship("NivaranAuthority", foreign_keys=[sealed_by_authority_id])
    documents = relationship("EFileDocument", back_populates="efile", cascade="all, delete-orphan")


class EFileDocument(Base):
    __tablename__ = "nivaran_efile_documents"
    __table_args__ = (
        UniqueConstraint("efile_id", "document_id", name="uq_nivaran_efile_doc"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    efile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_efiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_documents.id", ondelete="RESTRICT"),
        nullable=False,
        comment="RESTRICT prevents deleting evidence if referenced by compiled E-File",
    )
    document_sha256_snapshot: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Frozen document hash at time of compilation",
    )
    section_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    efile = relationship("EFile", back_populates="documents")
    document = relationship("Document", foreign_keys=[document_id])
