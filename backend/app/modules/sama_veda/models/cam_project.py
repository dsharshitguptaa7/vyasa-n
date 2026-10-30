import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from sqlalchemy import DateTime, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class CamAiProject(Base):
    """
    CAM-AI Research Projects Scheme.
    Promoting AI-driven innovation and interdisciplinary research across CSJMU schools.
    """
    __tablename__ = "sama_cam_ai_projects"
    __table_args__ = (
        Index("ix_sama_cam_domain", "domain"),
        Index("ix_sama_cam_category", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    legacy_project_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        unique=True,
        nullable=True,
        comment="Sequential ID from legacy CAM-AI scheme dataset (1 to 6)",
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Grant scale: 'Major' or 'Minor'",
    )
    domain: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Application domain (e.g. 'AI in Healthcare', 'AI in Agriculture')",
    )
    title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full research project title",
    )
    funding_amount_inr: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(14, 2),
        nullable=True,
        comment="Approved sanction amount in Indian Rupees (numeric for calculations)",
    )
    funding_display: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Formatted currency string for public display (e.g. '₹1,10,00,000')",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="Ongoing",
        nullable=False,
        comment="Project status: 'Ongoing' | 'Completed' | 'Sanctioned'",
    )
    principal_investigators: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="Array of PIs with name, department, and school affiliations",
    )
    co_investigators: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="Array of Co-PIs with name, department, and school affiliations",
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
        return f"<CamAiProject(id={self.id}, domain='{self.domain}', category='{self.category}')>"
