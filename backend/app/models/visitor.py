import uuid
from datetime import datetime, date
from typing import Optional
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, UniqueConstraint, Index, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PublicVisitor(Base):
    """
    Anonymous visitor identity ledger for the main VYASA website.
    Maintains first-party anonymous visitor tokens with zero PII or raw IP storage.
    """
    __tablename__ = "public_visitors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visitor_token: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="Random anonymous cryptographically secure first-party visitor identifier",
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Instant when this visitor was first recorded",
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Instant when this visitor last visited the main website",
    )
    total_visits: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
        comment="Total lifetime track invocations by this visitor",
    )

    # Relationships
    daily_visits = relationship(
        "PublicDailyVisit",
        back_populates="visitor",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<PublicVisitor id={self.id} token={self.visitor_token[:8]}... visits={self.total_visits}>"


class PublicDailyVisit(Base):
    """
    Daily unique visit ledger for the main VYASA website.
    Scoped strictly to the institutional Asia/Kolkata (IST) calendar day.
    """
    __tablename__ = "public_daily_visits"
    __table_args__ = (
        UniqueConstraint("visitor_id", "visit_date", name="uq_public_daily_visits_visitor_date"),
        Index("ix_public_daily_visits_date", "visit_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    visitor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public_visitors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Foreign key referencing the anonymous visitor",
    )
    visit_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Institutional calendar date (Asia/Kolkata) of the visit",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Exact timestamp of the first daily visit",
    )

    # Relationships
    visitor = relationship("PublicVisitor", back_populates="daily_visits")

    def __repr__(self) -> str:
        return f"<PublicDailyVisit visitor_id={self.visitor_id} date={self.visit_date}>"
