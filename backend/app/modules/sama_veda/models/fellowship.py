import uuid
from datetime import datetime
from sqlalchemy import DateTime, Index, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class FellowshipScheme(Base):
    """
    Active doctoral and postgraduate research fellowship schemes supported at CSJMU.
    Encompasses national and institutional award schemes (JRF, NFSC, CSIR, GATE, NFOBC, SJSGC).
    """
    __tablename__ = "sama_fellowship_schemes"
    __table_args__ = (
        Index("ix_sama_fellowship_code", "scheme_code", unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    scheme_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment="Abbreviated scheme code (e.g. 'JRF', 'NFSC', 'CSIR')",
    )
    scheme_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Full expanded title of the fellowship scheme",
    )
    active_scholars_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of actively enrolled researchers supported under this scheme",
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

    def __repr__(self) -> str:
        return f"<FellowshipScheme(code='{self.scheme_code}', count={self.active_scholars_count})>"
