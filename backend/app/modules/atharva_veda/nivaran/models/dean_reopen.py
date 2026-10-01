import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.modules.atharva_veda.nivaran.models.enums import DeanReopenDecisionType, DeanReopenReviewStatus


class DeanReopenReview(Base):
    __tablename__ = "nivaran_dean_reopen_reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    dean_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    status: Mapped[DeanReopenReviewStatus] = mapped_column(
        Enum(DeanReopenReviewStatus, name="dean_reopen_review_status"),
        default=DeanReopenReviewStatus.AWAITING_REVIEW,
        nullable=False,
    )
    decision_type: Mapped[Optional[DeanReopenDecisionType]] = mapped_column(
        Enum(DeanReopenDecisionType, name="dean_reopen_decision_type"),
        nullable=True,
    )
    applicant_justification: Mapped[str] = mapped_column(Text, nullable=False)
    dean_adjudication_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    requested_by = relationship("User", foreign_keys=[requested_by_user_id])
    dean = relationship("NivaranAuthority", foreign_keys=[dean_authority_id])
