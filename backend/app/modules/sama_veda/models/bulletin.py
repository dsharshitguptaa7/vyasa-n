import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.sama_veda.models.publication import ResearchPublication
    from app.modules.sama_veda.models.certificate import FelicitationCertificate


class ResearchBulletin(Base):
    """
    Official CSJMU Research Bulletin edition (e.g. Volume 2 • Issue 1, Volume 2 • Issue 2).
    Represents the biannual published compilation of university research achievements.
    """
    __tablename__ = "sama_research_bulletins"
    __table_args__ = (
        UniqueConstraint("volume_number", "issue_number", name="uq_sama_bulletin_volume_issue"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    volume_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Volume sequence number (e.g., 2)",
    )
    issue_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Issue sequence number within volume (e.g., 1 or 2)",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Official edition title (e.g., 'Volume 2 • Issue 1')",
    )
    publication_period: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Cover period (e.g., 'January – March 2026')",
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Relative path or storage key for full bulletin PDF",
    )
    file_size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        default=0,
        nullable=False,
        comment="PDF file size in bytes",
    )
    checksum_sha256: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="Cryptographic SHA-256 hash of the bulletin PDF",
    )
    publication_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total verified publications documented in this edition",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether this bulletin is visible on the public research portal",
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="published",
        server_default="published",
        nullable=False,
        index=True,
        comment="Content lifecycle status: 'draft' | 'in_review' | 'published' | 'archived'",
    )
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date the bulletin was officially launched",
    )
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when bulletin edition was retired to archives",
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
    publications: Mapped[List["ResearchPublication"]] = relationship(
        "ResearchPublication",
        back_populates="bulletin",
        cascade="all, delete-orphan",
        order_by="ResearchPublication.serial_no",
    )
    certificates: Mapped[List["FelicitationCertificate"]] = relationship(
        "FelicitationCertificate",
        back_populates="bulletin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<ResearchBulletin(id={self.id}, title='{self.title}', count={self.publication_count})>"
