import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.sama_veda.models.bulletin import ResearchBulletin
    from app.modules.sama_veda.models.author import ResearchAuthor
    from app.modules.sama_veda.models.certificate import FelicitationCertificate


class ResearchPublication(Base):
    """
    Scholarly publication documented in a CSJMU Research Bulletin edition.
    Includes articles, reviews, conference papers, book chapters, and books.
    """
    __tablename__ = "sama_research_publications"
    __table_args__ = (
        Index("ix_sama_pub_category", "category"),
        Index("ix_sama_pub_bulletin_serial", "bulletin_id", "serial_no"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    bulletin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_bulletins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Foreign key to the bulletin edition publishing this record",
    )
    serial_no: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Sequential publication number within the bulletin issue",
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
        comment="Stable slug identifier (e.g. 'v2-i1-r001')",
    )
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Complete research publication title",
    )
    source_journal: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Source journal, conference proceedings, or publisher name",
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Publication type: Article, Review, Conference Paper, Book chapter, Book, etc.",
    )
    doi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Digital Object Identifier (DOI) if available",
    )
    author_display: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Exact author citation string as transcribed in the research bulletin",
    )
    authors_complete: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="True if all authors are explicitly listed; False if abbreviated with 'et al.'",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="published",
        server_default="published",
        nullable=False,
        index=True,
        comment="Content lifecycle status: 'draft' | 'in_review' | 'published' | 'archived'",
    )
    abstract: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Abstract text or publication summary",
    )
    external_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Publisher canonical landing URL or open access repository link",
    )
    is_featured: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
        comment="Whether publication is featured on research showcase landing views",
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when publication was published by an administrator",
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when publication was archived",
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
    bulletin: Mapped["ResearchBulletin"] = relationship(
        "ResearchBulletin",
        back_populates="publications",
    )
    author_links: Mapped[List["PublicationAuthor"]] = relationship(
        "PublicationAuthor",
        back_populates="publication",
        cascade="all, delete-orphan",
        order_by="PublicationAuthor.author_order",
    )
    certificates: Mapped[List["FelicitationCertificate"]] = relationship(
        "FelicitationCertificate",
        back_populates="publication",
    )

    def __repr__(self) -> str:
        return f"<ResearchPublication(id={self.id}, slug='{self.slug}', category='{self.category}')>"


class PublicationAuthor(Base):
    """
    Many-to-many junction entity associating ResearchPublication with ResearchAuthor.
    Preserves author sequencing, corresponding authorship, and affiliation.
    """
    __tablename__ = "sama_publication_authors"
    __table_args__ = (
        UniqueConstraint("publication_id", "author_id", name="uq_sama_pub_author"),
        Index("ix_sama_pub_author_lookup", "publication_id", "author_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_publications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_authors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_order: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="1-based sequence order of the author in the paper citation",
    )
    is_corresponding: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether this researcher is the corresponding author",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    publication: Mapped["ResearchPublication"] = relationship(
        "ResearchPublication",
        back_populates="author_links",
    )
    author: Mapped["ResearchAuthor"] = relationship(
        "ResearchAuthor",
        back_populates="publication_links",
    )

    def __repr__(self) -> str:
        return f"<PublicationAuthor(pub_id={self.publication_id}, author_id={self.author_id}, order={self.author_order})>"
