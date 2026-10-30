import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.modules.sama_veda.models.publication import PublicationAuthor
    from app.modules.sama_veda.models.certificate import FelicitationCertificate


class ResearchAuthor(Base):
    """
    Author identity index for CSJMU faculty, scholars, and collaborators.
    Decoupled from User to support external co-authors and unverified historical records.
    Supports provisional identities without fabricating institutional verification.
    """
    __tablename__ = "sama_research_authors"
    __table_args__ = (
        Index("ix_sama_author_scopus", "scopus_id"),
        Index("ix_sama_author_full_name", "full_name"),
        # Partial unique index: only verified authors must have globally unique Scopus IDs
        Index(
            "uq_sama_author_verified_scopus",
            "scopus_id",
            unique=True,
            postgresql_where=text("is_verified = true AND scopus_id IS NOT NULL AND trim(scopus_id) != ''"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    scopus_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Author Scopus Identifier (e.g. '59650228300')",
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Author full name as recorded in publications or certificates",
    )
    department: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Academic department or center affiliation",
    )
    institutional_affiliation: Mapped[str] = mapped_column(
        String(255),
        default="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        nullable=False,
        comment="Institutional affiliation",
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Optional foreign key to verified VYASA platform user profile",
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="True if Scopus ID and institutional identity are officially confirmed",
    )
    verification_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Audit trail for data curation anomalies or provisional status",
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
    user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[user_id],
    )
    publication_links: Mapped[List["PublicationAuthor"]] = relationship(
        "PublicationAuthor",
        back_populates="author",
        cascade="all, delete-orphan",
    )
    certificates: Mapped[List["FelicitationCertificate"]] = relationship(
        "FelicitationCertificate",
        back_populates="author",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ResearchAuthor(id={self.id}, name='{self.full_name}', scopus_id='{self.scopus_id}', verified={self.is_verified})>"
