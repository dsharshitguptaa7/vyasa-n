import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, Enum, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import DeanReopenDecisionType, DeanReopenReviewStatus


class DeanReopenReview(Base):
    __tablename__ = "dean_reopen_reviews"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    dean_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    concerned_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[DeanReopenReviewStatus] = mapped_column(
        Enum(
            DeanReopenReviewStatus,
            name="dean_reopen_review_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=DeanReopenReviewStatus.AWAITING_REVIEW,
        nullable=False,
        index=True,
    )

    question_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    questioned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    response_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    decision_type: Mapped[DeanReopenDecisionType | None] = mapped_column(
        Enum(
            DeanReopenDecisionType,
            name="dean_reopen_decision_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
    )

    decision_remarks: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    decided_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    dean = relationship("NivaranAuthority", foreign_keys=[dean_id])
    concerned_authority = relationship("NivaranAuthority", foreign_keys=[concerned_authority_id])
