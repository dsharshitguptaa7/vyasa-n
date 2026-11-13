"""
ANUDAAN (Yajur Veda) Showcase, Impact & Disbursement Data Models
Implements institutional incentive impact tracking, financial disbursements ledger,
researcher recognition gallery, and public showcase configuration.

Table Namespace: yajur_anudaan_*
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.modules.yajur_veda.models.anudaan import (
        AnudaanApplication,
        AnudaanPublicationAuthor,
    )


# =============================================================================
# 1. AnudaanDisbursement (Verified Financial Payout Ledger)
# =============================================================================

class AnudaanDisbursement(Base):
    """
    Official institutional record of incentive funds actually disbursed.
    Provides strict financial traceability, audit reconciliation, and reversal history.
    Decoupled from application status to guarantee that APPROVED != CREDITED.
    """
    __tablename__ = "yajur_anudaan_disbursements"
    __table_args__ = (
        Index("ix_anudaan_disb_app", "application_id"),
        Index("ix_anudaan_disb_author", "author_id"),
        Index("ix_anudaan_disb_ref", "disbursement_reference", unique=True),
        Index("ix_anudaan_disb_year", "academic_year"),
        Index("ix_anudaan_disb_status", "verification_status"),
        Index("ix_anudaan_disb_date", "disbursement_date"),
        CheckConstraint("amount > 0", name="ck_anudaan_disbursement_amount_positive"),
        UniqueConstraint("disbursement_reference", name="uq_anudaan_disbursement_reference"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_applications.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Parent application for which incentive was disbursed",
    )
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_publication_authors.id", ondelete="SET NULL"),
        nullable=True,
        comment="Specific author payee if itemized by author",
    )
    disbursement_reference: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Bank transaction reference (UTR, NEFT/RTGS ref, or Treasury sanction order)",
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Actual incentive amount disbursed in INR",
    )
    disbursement_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date the funds were credited/transferred",
    )
    academic_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Academic year of disbursement (e.g. '2025-2026')",
    )
    payment_method: Mapped[str] = mapped_column(
        String(50),
        default="BANK_TRANSFER",
        server_default="BANK_TRANSFER",
        nullable=False,
        comment="Payment method: BANK_TRANSFER, NEFT, RTGS, PFMS, TREASURY",
    )
    verification_status: Mapped[str] = mapped_column(
        String(30),
        default="RECORDED",
        server_default="RECORDED",
        nullable=False,
        comment="Status: RECORDED, VERIFIED, REVERSED",
    )
    reversal_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Mandatory justification if transaction is reversed",
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Internal accounting remarks",
    )
    recorded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Sadmin user who recorded this entry",
    )
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Finance officer / Sadmin who verified this transaction against bank statement",
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp of verification against official bank ledger",
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
    application: Mapped["AnudaanApplication"] = relationship(
        "AnudaanApplication",
        foreign_keys=[application_id],
    )
    author: Mapped[Optional["AnudaanPublicationAuthor"]] = relationship(
        "AnudaanPublicationAuthor",
        foreign_keys=[author_id],
    )
    recorded_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[recorded_by_id],
    )
    verified_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[verified_by_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanDisbursement(id={self.id}, ref='{self.disbursement_reference}', amount={self.amount}, status='{self.verification_status}')>"


# =============================================================================
# 2. AnudaanGalleryItem (Ceremony & Researcher Recognition Entry)
# =============================================================================

class AnudaanGalleryItem(Base):
    """
    Curated institutional entry showcasing incentive distribution ceremonies,
    researcher recognitions, and scholarly milestones at CSJMU.
    """
    __tablename__ = "yajur_anudaan_gallery_items"
    __table_args__ = (
        Index("ix_anudaan_gal_year", "academic_year"),
        Index("ix_anudaan_gal_published", "is_published"),
        Index("ix_anudaan_gal_featured", "is_featured"),
        Index("ix_anudaan_gal_order", "display_order"),
        Index("ix_anudaan_gal_event_date", "event_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Public headline for ceremony or recognition",
    )
    event_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Official event name (e.g. 'Annual Research Incentive Felicitation')",
    )
    event_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date of distribution ceremony or achievement",
    )
    academic_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Academic year (e.g. '2025-2026')",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Institutional summary of ceremony, incentives awarded, or research milestone",
    )
    researcher_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Featured researcher name, included only with consent",
    )
    researcher_designation: Mapped[Optional[str]] = mapped_column(
        String(150),
        nullable=True,
        comment="Featured researcher academic designation",
    )
    department_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Academic department or school",
    )
    has_consent: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="True if researcher consented to photograph & name publication",
    )
    is_featured: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Pinned to top showcase carousel / banner",
    )
    felicitation_cycle_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_felicitation_cycles.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional link to specific felicitation cycle",
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Publicly visible when True",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
        comment="Sorting sequence for public rendering",
    )
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
    images: Mapped[List["AnudaanGalleryImage"]] = relationship(
        "AnudaanGalleryImage",
        back_populates="gallery_item",
        cascade="all, delete-orphan",
        order_by="AnudaanGalleryImage.display_order",
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    updated_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by_id],
    )
    felicitation_cycle: Mapped[Optional["AnudaanFelicitationCycle"]] = relationship(
        "AnudaanFelicitationCycle",
        back_populates="gallery_items",
        foreign_keys=[felicitation_cycle_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanGalleryItem(id={self.id}, title='{self.title}', published={self.is_published})>"


# =============================================================================
# 3. AnudaanGalleryImage (Ceremony Media Photograph)
# =============================================================================

class AnudaanGalleryImage(Base):
    """
    Photographs associated with an AnudaanGalleryItem.
    Stored securely via VYASA Core storage subsystem (10MB ceiling, valid image MIME).
    """
    __tablename__ = "yajur_anudaan_gallery_images"
    __table_args__ = (
        Index("ix_anudaan_img_item", "gallery_item_id"),
        Index("ix_anudaan_img_cover", "is_cover"),
        Index("ix_anudaan_img_order", "display_order"),
        CheckConstraint("file_size_bytes > 0 AND file_size_bytes <= 10485760", name="ck_anudaan_img_size_limit"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    gallery_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_gallery_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Storage reference key (local disk or S3/Spaces)",
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Original client image filename",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Verified MIME type: image/jpeg, image/png, image/webp",
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Image size in bytes (max 10MB)",
    )
    caption: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Photograph caption or credit",
    )
    is_cover: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="True if this image is the primary card thumbnail",
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
        comment="Image presentation order within gallery",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    gallery_item: Mapped["AnudaanGalleryItem"] = relationship(
        "AnudaanGalleryItem",
        back_populates="images",
    )

    def __repr__(self) -> str:
        return f"<AnudaanGalleryImage(id={self.id}, item={self.gallery_item_id}, cover={self.is_cover})>"


# =============================================================================
# 4. AnudaanPublicConfig (Sadmin Public Display Toggles)
# =============================================================================

class AnudaanPublicConfig(Base):
    """
    Central governance record controlling public showcase visibility and presentation.
    Enables Super Admin to toggle the Impact Dashboard and Gallery sections independently.
    """
    __tablename__ = "yajur_anudaan_public_config"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    config_key: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        default="global_showcase",
        server_default="global_showcase",
        nullable=False,
        comment="Unique identifier for configuration scope",
    )
    impact_section_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="Whether the public Institutional Incentive Impact section is visible",
    )
    gallery_section_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="Whether the public Researcher Recognition Gallery is visible",
    )
    active_academic_year: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Preferred academic year filter on public dashboard (null for latest/all)",
    )
    custom_banner_note: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Optional announcement or institutional advisory note rendered above stats",
    )
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Sadmin who last modified showcase configuration",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    updated_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanPublicConfig(impact={self.impact_section_enabled}, gallery={self.gallery_section_enabled})>"


# =============================================================================
# 5. AnudaanSanctionEntry (Simplified Sadmin Incentive Sanction Register)
# =============================================================================

class AnudaanSanctionEntry(Base):
    """
    Simplified manual and application-linked incentive sanction entry recorded by Sadmin.
    Decoupled from banking/payment workflows. Represents official university sanction.
    """
    __tablename__ = "yajur_anudaan_sanction_entries"
    __table_args__ = (
        Index("ix_anudaan_sanction_year", "academic_year"),
        Index("ix_anudaan_sanction_quartile", "quartile"),
        Index("ix_anudaan_sanction_published", "is_published"),
        Index("ix_anudaan_sanction_app", "application_id"),
        Index("ix_anudaan_sanction_researcher", "researcher_name"),
        Index("ix_anudaan_sanction_dept", "department_name"),
        Index("ix_anudaan_sanction_cycle", "felicitation_cycle_id"),
        CheckConstraint("sanctioned_amount >= 0", name="ck_anudaan_sanction_amount_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    researcher_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Full name of the recognized researcher",
    )
    department_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Department or School name (optional)",
    )
    project_title: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Optional research project or grant title",
    )
    publication_title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Title of the sanctioned research paper",
    )
    publication_doi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="DOI identifier (optional)",
    )
    quartile: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="Quartile: Q1, Q2, Q3, Q4",
    )
    sanctioned_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        comment="Incentive amount sanctioned in INR",
    )
    academic_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Academic year (e.g. 2025-2026)",
    )
    sanction_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Date the incentive was officially sanctioned",
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Optional administrative remarks or sanction order notes",
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="Visible on public register if True",
    )
    felicitation_cycle_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_felicitation_cycles.id", ondelete="SET NULL"),
        nullable=True,
        comment="Associated felicitation cycle",
    )
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_applications.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional link to submitted ANUDAAN application",
    )
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_publication_authors.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional link to specific publication author record",
    )
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
    application: Mapped[Optional["AnudaanApplication"]] = relationship(
        "AnudaanApplication",
        foreign_keys=[application_id],
    )
    author: Mapped[Optional["AnudaanPublicationAuthor"]] = relationship(
        "AnudaanPublicationAuthor",
        foreign_keys=[author_id],
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    updated_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by_id],
    )
    felicitation_cycle: Mapped[Optional["AnudaanFelicitationCycle"]] = relationship(
        "AnudaanFelicitationCycle",
        back_populates="sanction_entries",
        foreign_keys=[felicitation_cycle_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanSanctionEntry(id={self.id}, researcher='{self.researcher_name}', quartile='{self.quartile}', amount={self.sanctioned_amount})>"


# =============================================================================
# 6. AnudaanFelicitationCycle (Volume & Issue Felicitation Cycle)
# =============================================================================

class AnudaanFelicitationCycle(Base):
    """
    Institutional felicitation / recognition cycle (Volume & Issue) governing ANUDAAN
    publication incentive ceremonies and public showcases.
    """
    __tablename__ = "yajur_anudaan_felicitation_cycles"
    __table_args__ = (
        Index("ix_anudaan_cycle_year", "academic_year"),
        Index("ix_anudaan_cycle_status", "status"),
        Index("ix_anudaan_cycle_published", "is_published"),
        Index("ix_anudaan_cycle_archived", "is_archived"),
        Index("ix_anudaan_cycle_date", "felicitation_date"),
        UniqueConstraint("volume_number", "issue_number", name="uq_anudaan_cycle_volume_issue"),
        CheckConstraint("volume_number > 0 AND issue_number > 0", name="ck_anudaan_cycle_vol_issue_pos"),
        CheckConstraint("status IN ('UPCOMING', 'COMPLETED')", name="ck_anudaan_cycle_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    volume_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Volume number (e.g. 1, 2, 3)",
    )
    issue_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Issue number within volume (e.g. 1, 2, 3)",
    )
    display_title: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Ceremonial title (e.g. Convocation Felicitation)",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="UPCOMING",
        server_default="UPCOMING",
        nullable=False,
        comment="Status: UPCOMING or COMPLETED",
    )
    felicitation_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
        comment="Date of ceremony / felicitation",
    )
    academic_year: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Academic year (e.g. 2025-2026)",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Institutional event description and highlights",
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="Visible on public showcase if True",
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Archived if True",
    )
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
    sanction_entries: Mapped[List["AnudaanSanctionEntry"]] = relationship(
        "AnudaanSanctionEntry",
        back_populates="felicitation_cycle",
    )
    gallery_items: Mapped[List["AnudaanGalleryItem"]] = relationship(
        "AnudaanGalleryItem",
        back_populates="felicitation_cycle",
    )
    created_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_id],
    )
    updated_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanFelicitationCycle(id={self.id}, vol={self.volume_number}, issue={self.issue_number}, status='{self.status}')>"


