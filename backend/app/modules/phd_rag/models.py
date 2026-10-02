import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


class PhdDocument(Base):
    """
    Authoritative Ph.D. Admission source document inventory record.
    Tracks filenames, file types, SHA-256 checksums, and processing lifecycle.
    """
    __tablename__ = "phd_admission_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    filename: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        comment="brochure | ordinance | coursework_ppt",
    )
    academic_session: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    total_pages_or_slides: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    processing_status: Mapped[str] = mapped_column(
        String(50),
        default="COMPLETED",
        nullable=False,
    )
    extraction_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
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

    # Relationships
    chunks: Mapped[List["PhdChunk"]] = relationship(
        "PhdChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="PhdChunk.chunk_index",
    )

    def __repr__(self) -> str:
        return (
            f"<PhdDocument(id={self.id}, filename='{self.filename}', "
            f"type='{self.doc_type}', status='{self.processing_status}')>"
        )


class PhdChunk(Base):
    """
    Extracted textual passage chunk with page/slide metadata and vector embeddings.
    Strictly preserves citation provenance (document, page/slide number, clause/section heading).
    """
    __tablename__ = "phd_admission_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("phd_admission_documents.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
    )
    document_title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    source_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    academic_session: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    page_number: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    slide_number: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    section_heading: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    token_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    # Stored as JSON/JSONB array of floats (768-dim) for portability and pgvector compatibility
    embedding: Mapped[Optional[list]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    document: Mapped["PhdDocument"] = relationship(
        "PhdDocument",
        back_populates="chunks",
    )

    def __repr__(self) -> str:
        loc = f"p.{self.page_number}" if self.page_number else f"s.{self.slide_number}"
        return (
            f"<PhdChunk(id={self.id}, doc='{self.source_filename}', "
            f"loc={loc}, idx={self.chunk_index})>"
        )
