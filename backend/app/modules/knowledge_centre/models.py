"""
SQLAlchemy models for VYASAⁿ AI Knowledge Centre.
Stores authoritative university source documents, version history, and passage chunks.

Schema:
1. ai_knowledge_documents: High-level document identity, domain categorization, and publication lifecycle.
2. ai_knowledge_document_versions: Immutable version-specific storage keys, SHA-256 integrity, and extraction states.
3. ai_knowledge_chunks: Extracted textual passages, citations (page numbers, metadata), and embedding vectors.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models.base import Base


KNOWLEDGE_STORAGE_PREFIX = "vyasa-knowledge"


class KnowledgeDocumentStatus(str, Enum):
    """Lifecycle status for an authoritative AI Knowledge document."""
    DRAFT = "draft"
    PROCESSING = "processing"
    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    REJECTED = "rejected"
    ARCHIVED = "archived"


class KnowledgeApprovalStatus(str, Enum):
    """Approval status for document versions."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class KnowledgeExtractionStatus(str, Enum):
    """Extraction and parser status for document versions."""
    PENDING = "pending"
    PARSED = "parsed"
    INDEXED = "indexed"
    FAILED = "failed"


class KnowledgeVerificationStatus(str, Enum):
    """Integrity and indexing verification for individual passage chunks."""
    UNVERIFIED = "unverified"
    INDEXED = "indexed"
    VERIFIED = "verified"
    REJECTED = "rejected"


class AiKnowledgeDocument(Base):
    """
    Authoritative AI Knowledge Centre document record.
    Manages metadata, domain classification, and the active published version pointer.
    """
    __tablename__ = "ai_knowledge_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    domain: Mapped[str] = mapped_column(
        String(100),
        index=True,
        nullable=False,
        comment="e.g. doctoral-studies | admissions | academic-regulations | research-development | university-administration",
    )
    subdomain: Mapped[Optional[str]] = mapped_column(
        String(100),
        index=True,
        nullable=True,
    )
    document_type: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        comment="ordinance | brochure | regulation | policy | manual | presentation | guideline",
    )
    academic_session: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="e.g. 2026-27",
    )
    issuing_authority: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="e.g. Academic Council, Research Degree Committee, Office of the Registrar",
    )
    effective_from: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    effective_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    current_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_knowledge_document_versions.id", use_alter=True, name="fk_ai_knowledge_documents_current_version_id"),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        default=KnowledgeDocumentStatus.DRAFT.value,
        comment="draft | processing | pending_approval | active | rejected | archived",
    )
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    versions: Mapped[List["AiKnowledgeDocumentVersion"]] = relationship(
        "AiKnowledgeDocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="[AiKnowledgeDocumentVersion.document_id]",
        order_by="AiKnowledgeDocumentVersion.version_number",
    )
    current_version: Mapped[Optional["AiKnowledgeDocumentVersion"]] = relationship(
        "AiKnowledgeDocumentVersion",
        foreign_keys=[current_version_id],
        post_update=True,
    )
    chunks: Mapped[List["AiKnowledgeChunk"]] = relationship(
        "AiKnowledgeChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        foreign_keys="[AiKnowledgeChunk.document_id]",
    )
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])

    def __repr__(self) -> str:
        return (
            f"<AiKnowledgeDocument(id={self.id}, title='{self.title}', "
            f"domain='{self.domain}', status='{self.status}')>"
        )


class AiKnowledgeDocumentVersion(Base):
    """
    Immutable version snapshot for an authoritative knowledge document.
    Stores the exact Spaces object key, SHA-256 digest, extraction status, and SADMIN approval state.
    """
    __tablename__ = "ai_knowledge_document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="uq_knowledge_doc_version_number"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_knowledge_documents.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    storage_key: Mapped[str] = mapped_column(
        String(512),
        unique=True,
        index=True,
        nullable=False,
        comment="Immutable DigitalOcean Spaces object key under vyasa-knowledge/",
    )
    checksum_sha256: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    extraction_status: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        default=KnowledgeExtractionStatus.PENDING.value,
        comment="pending | parsed | indexed | failed",
    )
    processing_error: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    approval_status: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        default=KnowledgeApprovalStatus.PENDING.value,
        comment="pending | approved | rejected",
    )
    approved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Unique job token for active extraction worker; used for CAS ownership verification",
    )
    heartbeat_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Monotonically updated worker progress heartbeat preventing active long-running jobs from being reclaimed",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    document: Mapped["AiKnowledgeDocument"] = relationship(
        "AiKnowledgeDocument",
        back_populates="versions",
        foreign_keys=[document_id],
    )
    chunks: Mapped[List["AiKnowledgeChunk"]] = relationship(
        "AiKnowledgeChunk",
        back_populates="version",
        cascade="all, delete-orphan",
        foreign_keys="[AiKnowledgeChunk.version_id]",
        order_by="AiKnowledgeChunk.chunk_index",
    )
    approved_by = relationship("User", foreign_keys=[approved_by_id])

    def __repr__(self) -> str:
        return (
            f"<AiKnowledgeDocumentVersion(id={self.id}, doc_id={self.document_id}, "
            f"v={self.version_number}, approval='{self.approval_status}')>"
        )


class AiKnowledgeChunk(Base):
    """
    Extracted textual passage chunk from an authoritative document version.
    Carries source citations (page numbers, section headings), metadata, and embedding vectors.
    """
    __tablename__ = "ai_knowledge_chunks"
    __table_args__ = (
        UniqueConstraint("version_id", "chunk_index", name="uq_knowledge_chunk_version_idx"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_knowledge_documents.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_knowledge_document_versions.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    page_number: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        index=True,
    )
    # Stored in column "metadata" without colliding with SQLAlchemy Base.metadata
    chunk_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    # Stored as JSON/JSONB array of floats (3072 dimensions) matching Gemini embedding service
    embedding: Mapped[Optional[list]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"),
        nullable=True,
    )
    verification_status: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        default=KnowledgeVerificationStatus.UNVERIFIED.value,
        comment="unverified | indexed | verified | rejected",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    document: Mapped["AiKnowledgeDocument"] = relationship(
        "AiKnowledgeDocument",
        back_populates="chunks",
        foreign_keys=[document_id],
    )
    version: Mapped["AiKnowledgeDocumentVersion"] = relationship(
        "AiKnowledgeDocumentVersion",
        back_populates="chunks",
        foreign_keys=[version_id],
    )

    def __repr__(self) -> str:
        return (
            f"<AiKnowledgeChunk(id={self.id}, doc_id={self.document_id}, "
            f"v_id={self.version_id}, idx={self.chunk_index}, page={self.page_number})>"
        )


# Import Phase 4D conversation and distributed rate limit models
from app.modules.knowledge_centre.conversation_models import (
    AiAssistantConversation,
    AiAssistantMessage,
    AiAssistantRateLimit,
)
