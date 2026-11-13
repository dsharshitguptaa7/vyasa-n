"""
ANUDAAN (Yajur Veda) Showcase, Impact & Disbursement Schemas
Pydantic contracts for Public & Sadmin incentive impact reporting,
disbursements financial ledger, and researcher recognition gallery.
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# 1. Public Institutional Impact Statistics Schemas
# =============================================================================

class AnudaanPublicImpactStats(BaseModel):
    """
    Publicly visible aggregated institutional incentive statistics.
    Derived strictly from published sanction entries. Excludes PII.
    """
    model_config = ConfigDict(from_attributes=True)

    reporting_academic_year: str = Field(
        ...,
        description="Active reporting period, e.g. '2025-2026' or 'ALL'",
    )
    total_researchers_recognised: int = Field(
        0,
        description="Distinct count of recognised researchers in published sanctions",
    )
    total_incentive_sanctioned_inr: Decimal = Field(
        Decimal("0.00"),
        description="Total incentive amount sanctioned across published entries",
    )
    total_sanction_entries: int = Field(
        0,
        description="Total count of published sanction entries",
    )
    quartile_breakdown: dict = Field(
        default_factory=lambda: {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0},
        description="Distribution of published sanctions by journal quartile",
    )
    academic_years_available: List[str] = Field(
        default_factory=list,
        description="List of academic years available for filtering",
    )
    last_updated_at: Optional[datetime] = Field(
        None,
        description="Timestamp of latest sanction entry or showcase update",
    )
    # Legacy backwards-compatibility fields:
    total_claims_received: int = 0
    claims_approved: int = 0
    claims_under_review: int = 0
    claims_rejected: int = 0
    researchers_benefited: int = 0
    total_incentive_disbursed_inr: Decimal = Decimal("0.00")
    disbursement_status: str = "SANCTIONED"


# =============================================================================
# 2. Financial Disbursement Schemas (Sadmin Controlled Ledger)
# =============================================================================

class AnudaanDisbursementCreate(BaseModel):
    """Input payload to record a verified bank incentive payout."""
    application_id: uuid.UUID = Field(..., description="Application ID")
    author_id: Optional[uuid.UUID] = Field(None, description="Optional specific author payee ID")
    disbursement_reference: str = Field(..., min_length=3, max_length=100, description="Bank transaction reference (UTR, NEFT, RTGS, PFMS)")
    amount: Decimal = Field(..., gt=0, description="Amount in INR (must be positive)")
    disbursement_date: date = Field(..., description="Date funds were credited/disbursed")
    academic_year: str = Field(..., min_length=4, max_length=20, description="Academic year (e.g. '2025-2026')")
    payment_method: str = Field(default="BANK_TRANSFER", max_length=50)
    notes: Optional[str] = Field(None, description="Optional internal accounting remarks")


class AnudaanDisbursementVerifyRequest(BaseModel):
    """Payload to confirm verification of a recorded disbursement against official bank statements."""
    notes: Optional[str] = Field(None, description="Auditor verification notes")


class AnudaanDisbursementReverseRequest(BaseModel):
    """Payload to reverse an erroneous or recalled disbursement."""
    reversal_reason: str = Field(..., min_length=5, description="Mandatory justification for transaction reversal")


class AnudaanDisbursementOut(BaseModel):
    """Public/Admin serialized representation of an incentive disbursement record."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    application_number: Optional[str] = "RECORDED"
    applicant_name: Optional[str] = None
    author_id: Optional[uuid.UUID] = None
    author_name: Optional[str] = None
    disbursement_reference: str
    amount: Decimal
    disbursement_date: date
    academic_year: str
    payment_method: str
    verification_status: str
    reversal_reason: Optional[str] = None
    notes: Optional[str] = None
    recorded_by_email: Optional[str] = None
    verified_by_email: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime


class AnudaanDisbursementListResponse(BaseModel):
    total: int
    items: List[AnudaanDisbursementOut]
    total_amount_inr: Decimal


# =============================================================================
# 3. Researcher Recognition Gallery Schemas
# =============================================================================

class AnudaanGalleryImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    gallery_item_id: uuid.UUID
    storage_key: str
    original_filename: str
    mime_type: str
    file_size_bytes: int
    caption: Optional[str] = None
    is_cover: bool = False
    display_order: int = 0
    created_at: datetime


class AnudaanGalleryItemCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    event_name: str = Field(..., min_length=3, max_length=255)
    event_date: date
    academic_year: str = Field(..., min_length=4, max_length=20)
    description: str = Field(..., min_length=10)
    researcher_name: Optional[str] = Field(None, max_length=255)
    researcher_designation: Optional[str] = Field(None, max_length=150)
    department_name: Optional[str] = Field(None, max_length=255)
    has_consent: bool = Field(True, description="Whether researcher consented to photo/name inclusion")
    is_featured: bool = False
    is_published: bool = False
    display_order: int = 0
    felicitation_cycle_id: Optional[uuid.UUID] = Field(None, description="Optional link to felicitation cycle")


class AnudaanGalleryItemUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    event_name: Optional[str] = Field(None, min_length=3, max_length=255)
    event_date: Optional[date] = None
    academic_year: Optional[str] = Field(None, min_length=4, max_length=20)
    description: Optional[str] = Field(None, min_length=10)
    researcher_name: Optional[str] = None
    researcher_designation: Optional[str] = None
    department_name: Optional[str] = None
    has_consent: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_published: Optional[bool] = None
    display_order: Optional[int] = None
    felicitation_cycle_id: Optional[uuid.UUID] = None


class AnudaanGalleryItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    event_name: str
    event_date: date
    academic_year: str
    description: str
    researcher_name: Optional[str] = None
    researcher_designation: Optional[str] = None
    department_name: Optional[str] = None
    has_consent: bool
    is_featured: bool
    is_published: bool
    display_order: int
    felicitation_cycle_id: Optional[uuid.UUID] = None
    felicitation_cycle_volume: Optional[int] = None
    felicitation_cycle_issue: Optional[int] = None
    images: List[AnudaanGalleryImageOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AnudaanGalleryListResponse(BaseModel):
    total: int
    items: List[AnudaanGalleryItemOut]


# =============================================================================
# 4. Public Display Configuration Schemas
# =============================================================================

class AnudaanPublicConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    impact_section_enabled: bool = True
    gallery_section_enabled: bool = True
    active_academic_year: Optional[str] = None
    custom_banner_note: Optional[str] = None
    updated_at: Optional[datetime] = None


class AnudaanPublicConfigUpdate(BaseModel):
    impact_section_enabled: Optional[bool] = None
    gallery_section_enabled: Optional[bool] = None
    active_academic_year: Optional[str] = None
    custom_banner_note: Optional[str] = None


# =============================================================================
# 5. Sadmin Incentive Sanction Register Schemas
# =============================================================================

class AnudaanSanctionEntryCreate(BaseModel):
    """Input payload to record an official university incentive sanction."""
    researcher_name: str = Field(..., min_length=2, max_length=255, description="Full name of researcher")
    department_name: Optional[str] = Field(None, max_length=255, description="Department / School (optional)")
    project_title: Optional[str] = Field(None, max_length=500, description="Optional project or grant title")
    publication_title: str = Field(..., min_length=3, max_length=500, description="Paper / publication title (mandatory)")
    publication_doi: Optional[str] = Field(None, max_length=255, description="Optional publication DOI")
    quartile: str = Field(..., pattern=r"^(Q1|Q2|Q3|Q4)$", description="Quartile tier: Q1, Q2, Q3, Q4")
    sanctioned_amount: Decimal = Field(..., ge=0, description="Sanctioned amount in INR (non-negative)")
    academic_year: str = Field(..., min_length=4, max_length=20, description="Academic year (e.g. '2025-2026')")
    sanction_date: date = Field(..., description="Official sanction approval date")
    felicitation_cycle_id: uuid.UUID = Field(..., description="Mandatory association with a Felicitation Cycle")
    remarks: Optional[str] = Field(None, description="Optional administrative remarks or sanction order notes")
    is_published: bool = Field(True, description="Visible on public portal when True")
    application_id: Optional[uuid.UUID] = Field(None, description="Optional link to submitted application")
    author_id: Optional[uuid.UUID] = Field(None, description="Optional link to author record")


class AnudaanSanctionEntryUpdate(BaseModel):
    """Payload to update an existing sanction register entry."""
    researcher_name: Optional[str] = Field(None, min_length=2, max_length=255)
    department_name: Optional[str] = Field(None, max_length=255)
    project_title: Optional[str] = Field(None, max_length=500)
    publication_title: Optional[str] = Field(None, min_length=3, max_length=500)
    publication_doi: Optional[str] = None
    quartile: Optional[str] = Field(None, pattern=r"^(Q1|Q2|Q3|Q4)$")
    sanctioned_amount: Optional[Decimal] = Field(None, ge=0)
    academic_year: Optional[str] = Field(None, min_length=4, max_length=20)
    sanction_date: Optional[date] = None
    felicitation_cycle_id: Optional[uuid.UUID] = None
    remarks: Optional[str] = None
    is_published: Optional[bool] = None
    application_id: Optional[uuid.UUID] = None
    author_id: Optional[uuid.UUID] = None


class AnudaanSanctionEntryOut(BaseModel):
    """Full administrative view of an incentive sanction entry."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    researcher_name: str
    department_name: Optional[str] = None
    project_title: Optional[str] = None
    publication_title: str
    publication_doi: Optional[str] = None
    quartile: str
    sanctioned_amount: Decimal
    academic_year: str
    sanction_date: date
    remarks: Optional[str] = None
    is_published: bool
    felicitation_cycle_id: Optional[uuid.UUID] = None
    felicitation_cycle_volume: Optional[int] = None
    felicitation_cycle_issue: Optional[int] = None
    felicitation_cycle_status: Optional[str] = None
    felicitation_cycle_title: Optional[str] = None
    application_id: Optional[uuid.UUID] = None
    application_number: Optional[str] = None
    author_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class AnudaanSanctionListResponse(BaseModel):
    total: int
    items: List[AnudaanSanctionEntryOut]
    total_sanctioned_inr: Decimal


class AnudaanPublicSanctionOut(BaseModel):
    """Strictly privacy-safe public sanction record for institutional recognition register."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    researcher_name: str
    department_name: Optional[str] = None
    project_title: Optional[str] = None
    publication_title: str
    quartile: str
    sanctioned_amount: Decimal
    academic_year: str
    felicitation_cycle_id: Optional[uuid.UUID] = None
    volume_number: Optional[int] = None
    issue_number: Optional[int] = None
    cycle_display_title: Optional[str] = None
    cycle_status: Optional[str] = None
    felicitation_date: Optional[date] = None


class AnudaanPublicSanctionsResponse(BaseModel):
    total: int
    items: List[AnudaanPublicSanctionOut]


# =============================================================================
# 6. Felicitation / Recognition Cycle Schemas
# =============================================================================

class AnudaanFelicitationCycleCreate(BaseModel):
    """Input payload to create a new Volume & Issue felicitation cycle."""
    volume_number: int = Field(..., gt=0, description="Volume number (e.g. 1, 2, 3)")
    issue_number: int = Field(..., gt=0, description="Issue number within volume (e.g. 1, 2, 3)")
    display_title: Optional[str] = Field(None, max_length=255, description="Ceremonial title")
    status: str = Field("UPCOMING", pattern=r"^(UPCOMING|COMPLETED)$", description="UPCOMING or COMPLETED")
    felicitation_date: Optional[date] = Field(None, description="Felicitation ceremony date")
    academic_year: Optional[str] = Field(None, min_length=4, max_length=20, description="Academic year")
    description: Optional[str] = Field(None, description="Event description")
    is_published: bool = Field(True, description="Publicly visible when True")
    is_archived: bool = Field(False, description="Archived when True")


class AnudaanFelicitationCycleUpdate(BaseModel):
    """Payload to update an existing felicitation cycle."""
    volume_number: Optional[int] = Field(None, gt=0)
    issue_number: Optional[int] = Field(None, gt=0)
    display_title: Optional[str] = Field(None, max_length=255)
    status: Optional[str] = Field(None, pattern=r"^(UPCOMING|COMPLETED)$")
    felicitation_date: Optional[date] = None
    academic_year: Optional[str] = Field(None, min_length=4, max_length=20)
    description: Optional[str] = None
    is_published: Optional[bool] = None
    is_archived: Optional[bool] = None


class AnudaanFelicitationCycleOut(BaseModel):
    """Detailed administrative view of a felicitation cycle with aggregated counters."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    volume_number: int
    issue_number: int
    display_title: Optional[str] = None
    status: str
    felicitation_date: Optional[date] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    is_published: bool
    is_archived: bool
    sanction_count: int = 0
    total_sanctioned_amount: Decimal = Decimal("0.00")
    created_at: datetime
    updated_at: datetime


class AnudaanFelicitationCycleListResponse(BaseModel):
    total: int
    items: List[AnudaanFelicitationCycleOut]


class AnudaanPublicFelicitationCycleOut(BaseModel):
    """Public showcase view of a felicitation cycle, grouping published sanction entries."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    volume_number: int
    issue_number: int
    display_title: Optional[str] = None
    status: str
    felicitation_date: Optional[date] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    sanctions: List[AnudaanPublicSanctionOut] = Field(default_factory=list)
    total_sanctioned_amount: Decimal = Decimal("0.00")
    total_researchers: int = 0
    sanction_count: int = 0
    gallery_items: List[AnudaanGalleryItemOut] = Field(default_factory=list)


class AnudaanPublicShowcaseCyclesResponse(BaseModel):
    total_cycles: int
    completed_cycles: List[AnudaanPublicFelicitationCycleOut]
    upcoming_cycles: List[AnudaanPublicFelicitationCycleOut]


class AnudaanApplicationLookupItem(BaseModel):
    """Lightweight lookup representation for Sadmin to select existing application/author."""
    model_config = ConfigDict(from_attributes=True)

    application_id: uuid.UUID
    application_number: str
    applicant_name: str
    department_name: str
    publication_title: Optional[str] = None
    publication_doi: Optional[str] = None
    quartile: Optional[str] = None
    authors: List[dict] = Field(default_factory=list)

