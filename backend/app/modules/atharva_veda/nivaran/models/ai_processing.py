import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class AIProcessingRecord(Base):
    __tablename__ = "nivaran_ai_processing_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    predicted_category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    confidence_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 4), nullable=True)
    inference_latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    model_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    predicted_category = relationship("Category", foreign_keys=[predicted_category_id])


class Cluster(Base):
    __tablename__ = "nivaran_ai_clusters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic_label: Mapped[str] = mapped_column(String(150), nullable=False)
    keywords_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    algorithm: Mapped[str] = mapped_column(String(64), default="KMeans", nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
