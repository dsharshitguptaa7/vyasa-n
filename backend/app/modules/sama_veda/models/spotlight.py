"""
Sama Veda Researcher Spotlight Model.
Curates media showcases, researcher highlights, photographs, and video features
for the institutional research portal.
"""
from datetime import datetime
from typing import Optional, TYPE_CHECKING
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.sama_veda.models.author import ResearchAuthor


class ResearcherSpotlight(Base):
    """
    Curated researcher spotlight showcasing faculty and scholar achievements,
    quotes, research impact summaries, photographs, and video media.
    """
    __tablename__ = "sama_researcher_spotlights"
    __table_args__ = (
        Index("ix_sama_spotlight_active_order", "is_active", "display_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_authors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Linked researcher author identity; null if spotlight is general",
    )
    headline: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Catchy spotlight title or researcher recognition headline",
    )
    summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Short narrative or excerpt detailing the research contribution",
    )
    media_type: Mapped[str] = mapped_column(
        String(32),
        default="photo",
        nullable=False,
        comment="'photo' | 'video' | 'interview'",
    )
    media_url: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Storage path or CDN URL for the primary photograph or video thumbnail",
    )
    video_embed_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="External YouTube/Vimeo video embed link if media_type is video",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Integer determining carousel / grid ranking order",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether this spotlight is displayed on public research landing views",
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
    author: Mapped[Optional["ResearchAuthor"]] = relationship(
        "ResearchAuthor",
        foreign_keys=[author_id],
    )

    def __repr__(self) -> str:
        return f"<ResearcherSpotlight(id={self.id}, headline='{self.headline[:30]}', active={self.is_active})>"
