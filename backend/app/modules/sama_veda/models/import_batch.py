import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class SamaImportBatch(Base):
    """
    Sama Veda Data Import & Reconciliation Batch Ledger.
    Tracks batch lifecycle, provenance, dry-run previews, row validation errors,
    and reconciliation reports for auditability and replay safety.
    """
    __tablename__ = "sama_import_batches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_number = Column(String(100), unique=True, nullable=False, index=True)
    entity_type = Column(String(50), nullable=False, index=True)  # 'publications', 'authors', 'bulletins', 'certificates', 'cam_projects', 'fellowships', 'spotlights', 'historical_bundle'
    source_filename = Column(String(255), nullable=False)
    file_format = Column(String(20), nullable=False)  # 'json', 'csv', 'xlsx'
    mode = Column(String(20), nullable=False, default="preview")  # 'preview' | 'execute'
    status = Column(String(32), nullable=False, default="pending", index=True)  # 'pending' | 'previewed' | 'completed' | 'failed'

    total_rows = Column(Integer, default=0, nullable=False)
    created_count = Column(Integer, default=0, nullable=False)
    updated_count = Column(Integer, default=0, nullable=False)
    skipped_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    review_count = Column(Integer, default=0, nullable=False)

    error_summary = Column(JSONB, nullable=True)  # List of row validation and parsing errors
    reconciliation_report = Column(JSONB, nullable=True)  # Matched, created, updated, and conflicting items breakdown

    imported_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    executed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Indexes
    __table_args__ = (
        Index("ix_sama_batch_entity_status", "entity_type", "status"),
    )
