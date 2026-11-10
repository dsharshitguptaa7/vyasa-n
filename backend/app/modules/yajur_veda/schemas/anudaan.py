"""
ANUDAAN (Yajur Veda) Pydantic v2 Schemas
Authoritative request, response, and tracking validation schemas for
CSJMU Research Publication Incentive Management System (ANUDAAN V1.1).
"""
import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.modules.yajur_veda.models.enums import (
    AnudaanApplicantCategory,
    AnudaanApplicationStatus,
    AnudaanDocumentType,
    AnudaanPublicationStatus,
    AnudaanIndexingType,
    AnudaanQuartile,
    AnudaanAuthorRole,
    AnudaanBankAccountType,
    AnudaanBankOwnershipStatus,
    AnudaanDocumentCategory,
    AnudaanVerificationType,
    AnudaanVerificationStatus,
)


# =============================================================================
# Helper Regex Patterns
# =============================================================================
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]{1}$")
PHONE_REGEX = re.compile(r"^\+?[0-9]{10,15}$")


# =============================================================================
# 1. Bank Account Schemas
# =============================================================================

class AnudaanBankAccountInput(BaseModel):
    """Input payload for adding or updating banking details."""
    account_holder_name: str = Field(..., min_length=2, max_length=255, description="Full name on bank account")
    bank_name: str = Field(..., min_length=2, max_length=255, description="Bank institution name")
    account_number: str = Field(..., min_length=6, max_length=30, description="Full bank account number")
    confirm_account_number: str = Field(..., min_length=6, max_length=30, description="Confirmation account number")
    ifsc_code: str = Field(..., min_length=11, max_length=11, description="11-character IFSC code")
    branch_name: str = Field(..., min_length=2, max_length=255, description="Branch location/name")
    account_type: AnudaanBankAccountType = Field(default=AnudaanBankAccountType.SAVINGS)
    pan_number: Optional[str] = Field(None, description="10-character PAN number")
    bank_mobile_number: Optional[str] = Field(None, max_length=20, description="Mobile number registered with bank")

    @field_validator("ifsc_code")
    @classmethod
    def validate_ifsc(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if not IFSC_REGEX.match(cleaned):
            raise ValueError("Invalid IFSC code format. Must be 11 characters (e.g., SBIN0001234).")
        return cleaned

    @field_validator("pan_number")
    @classmethod
    def validate_pan(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = v.strip().upper()
        if not PAN_REGEX.match(cleaned):
            raise ValueError("Invalid PAN format. Must be 10 characters (e.g., ABCDE1234F).")
        return cleaned

    @model_validator(mode="after")
    def verify_account_numbers_match(self) -> "AnudaanBankAccountInput":
        if self.account_number.strip() != self.confirm_account_number.strip():
            raise ValueError("Account numbers do not match.")
        return self


class AnudaanSafeBankAccountOut(BaseModel):
    """
    Publicly safe representation of a bank account.
    Plaintext account number and PAN are strictly never exposed.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    account_holder_name: str
    bank_name: str
    account_number_last4: str
    masked_account_number: str = ""
    ifsc_code: str
    branch_name: str
    account_type: AnudaanBankAccountType
    proof_document_storage_key: Optional[str] = None
    created_at: datetime

    @model_validator(mode="after")
    def compute_masked(self) -> "AnudaanSafeBankAccountOut":
        if not self.masked_account_number:
            self.masked_account_number = f"••••••••{self.account_number_last4}"
        return self


# =============================================================================
# 2. Author & Person Schemas
# =============================================================================

class AnudaanAuthorCreate(BaseModel):
    """Payload to add an author attribution to a publication."""
    full_name: str = Field(..., min_length=2, max_length=255)
    scopus_author_id: Optional[str] = Field(None, max_length=50)
    scopus_profile_url: Optional[str] = Field(None, max_length=500)
    mobile_number: Optional[str] = Field(None, max_length=20)
    employee_or_registration_id: Optional[str] = Field(None, max_length=100)
    author_role: AnudaanAuthorRole
    author_order: Optional[int] = Field(None, ge=1)
    is_csjmu_affiliated: bool = True
    has_multiple_corresponding_authors: bool = False
    is_nominated_corresponding_author: bool = False
    bank_reuse_selected: bool = False
    bank_account_id: Optional[uuid.UUID] = None
    new_bank_details: Optional[AnudaanBankAccountInput] = None

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = re.sub(r"[\s\-]", "", v.strip())
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("Invalid phone number format. Must contain 10 to 15 digits.")
        return cleaned

    @model_validator(mode="after")
    def check_author_invariants(self) -> "AnudaanAuthorCreate":
        # Co-author cannot have bank details
        if self.author_role == AnudaanAuthorRole.CO_AUTHOR:
            if self.bank_account_id or self.new_bank_details:
                raise ValueError("Co-authors are non-payable. Bank details cannot be designated for CO_AUTHOR role.")
            if self.is_nominated_corresponding_author:
                raise ValueError("Only a CORRESPONDING author can be designated as the nominated corresponding author.")

        # Nominated corresponding author must have role CORRESPONDING
        if self.is_nominated_corresponding_author and self.author_role != AnudaanAuthorRole.CORRESPONDING:
            raise ValueError("Only an author with CORRESPONDING role can be designated as the nominated corresponding author.")

        # Reusing bank details requires bank_account_id
        if self.bank_reuse_selected and not self.bank_account_id:
            raise ValueError("bank_account_id is required when bank_reuse_selected is True.")

        return self


class AnudaanAuthorUpdate(BaseModel):
    """Payload to update an author attribution."""
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    scopus_author_id: Optional[str] = Field(None, max_length=50)
    scopus_profile_url: Optional[str] = Field(None, max_length=500)
    mobile_number: Optional[str] = Field(None, max_length=20)
    employee_or_registration_id: Optional[str] = Field(None, max_length=100)
    author_role: Optional[AnudaanAuthorRole] = None
    author_order: Optional[int] = Field(None, ge=1)
    is_csjmu_affiliated: Optional[bool] = None
    has_multiple_corresponding_authors: Optional[bool] = None
    is_nominated_corresponding_author: Optional[bool] = None
    bank_reuse_selected: Optional[bool] = None
    bank_account_id: Optional[uuid.UUID] = None
    new_bank_details: Optional[AnudaanBankAccountInput] = None


class AnudaanAuthorOut(BaseModel):
    """Safe author output representation."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    publication_id: uuid.UUID
    person_id: uuid.UUID
    full_name: str = ""
    scopus_author_id: Optional[str] = None
    scopus_profile_url: Optional[str] = None
    employee_or_registration_id: Optional[str] = None
    mobile_number: Optional[str] = None
    author_role: AnudaanAuthorRole
    author_order: Optional[int] = None
    is_csjmu_affiliated: bool
    has_multiple_corresponding_authors: bool
    is_nominated_corresponding_author: bool
    bank_reuse_selected: bool
    bank_account: Optional[AnudaanSafeBankAccountOut] = None
    created_at: datetime


# =============================================================================
# 3. Document Schemas
# =============================================================================

class AnudaanDocumentOut(BaseModel):
    """Metadata response for an uploaded document."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    publication_id: Optional[uuid.UUID] = None
    person_id: Optional[uuid.UUID] = None
    document_type: AnudaanDocumentCategory
    original_filename: str
    mime_type: str
    file_size_bytes: int
    created_at: datetime


# =============================================================================
# 4. Publication Schemas
# =============================================================================

class AnudaanPublicationCreate(BaseModel):
    """Payload to add a research publication to an application draft."""
    publication_date: date = Field(..., description="Official publication date (must be on or after 2026-01-01)")
    document_type: AnudaanDocumentType = Field(..., description="ARTICLE or REVIEW")
    publication_status: AnudaanPublicationStatus = Field(default=AnudaanPublicationStatus.PUBLISHED)
    indexing_type: AnudaanIndexingType = Field(..., description="SCOPUS, WEB_OF_SCIENCE, or SCOPUS_AND_WOS")
    has_csjmu_affiliation: bool = Field(default=True, description="Must have explicit CSJMU affiliation")
    doi: Optional[str] = Field(None, max_length=255)
    paper_title: str = Field(..., min_length=3, description="Full paper title")
    journal_name: str = Field(..., min_length=2, max_length=500, description="Journal title")
    issn: Optional[str] = Field(None, max_length=50)
    e_issn: Optional[str] = Field(None, max_length=50)
    publication_year: int = Field(..., ge=2020)
    volume: Optional[str] = Field(None, max_length=50)
    issue: Optional[str] = Field(None, max_length=50)
    page_details: Optional[str] = Field(None, max_length=100)
    applicant_declared_quartile: AnudaanQuartile = Field(..., description="Q1, Q2, Q3, Q4, or UNASSIGNED")

    @field_validator("publication_date")
    @classmethod
    def validate_publication_date(cls, v: date) -> date:
        if v < date(2026, 1, 1):
            raise ValueError("Ineligible publication date. Only works published on or after January 1, 2026 are eligible.")
        return v

    @field_validator("publication_status")
    @classmethod
    def validate_publication_status(cls, v: AnudaanPublicationStatus) -> AnudaanPublicationStatus:
        if v != AnudaanPublicationStatus.PUBLISHED:
            raise ValueError("Only fully PUBLISHED works are eligible for the incentive scheme.")
        return v


class AnudaanPublicationUpdate(BaseModel):
    """Payload to update an existing draft publication."""
    publication_date: Optional[date] = None
    document_type: Optional[AnudaanDocumentType] = None
    publication_status: Optional[AnudaanPublicationStatus] = None
    indexing_type: Optional[AnudaanIndexingType] = None
    has_csjmu_affiliation: Optional[bool] = None
    doi: Optional[str] = Field(None, max_length=255)
    paper_title: Optional[str] = Field(None, min_length=3)
    journal_name: Optional[str] = Field(None, min_length=2, max_length=500)
    issn: Optional[str] = Field(None, max_length=50)
    e_issn: Optional[str] = Field(None, max_length=50)
    publication_year: Optional[int] = Field(None, ge=2020)
    volume: Optional[str] = Field(None, max_length=50)
    issue: Optional[str] = Field(None, max_length=50)
    page_details: Optional[str] = Field(None, max_length=100)
    applicant_declared_quartile: Optional[AnudaanQuartile] = None

    @field_validator("publication_date")
    @classmethod
    def validate_publication_date(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v < date(2026, 1, 1):
            raise ValueError("Ineligible publication date. Only works published on or after January 1, 2026 are eligible.")
        return v


class AnudaanPublicationOut(BaseModel):
    """Detailed publication response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_id: uuid.UUID
    publication_date: date
    document_type: AnudaanDocumentType
    publication_status: AnudaanPublicationStatus
    indexing_type: AnudaanIndexingType
    has_csjmu_affiliation: bool
    doi: Optional[str] = None
    normalized_doi: Optional[str] = None
    paper_title: str
    journal_name: str
    issn: Optional[str] = None
    e_issn: Optional[str] = None
    publication_year: int
    volume: Optional[str] = None
    issue: Optional[str] = None
    page_details: Optional[str] = None
    applicant_declared_quartile: AnudaanQuartile
    verified_quartile: Optional[AnudaanQuartile] = None
    jci_value: Optional[Decimal] = None
    paper_document_storage_key: Optional[str] = None
    authors: List[AnudaanAuthorOut] = []
    documents: List[AnudaanDocumentOut] = []
    created_at: datetime


# =============================================================================
# 5. Declaration Schemas & Approved V1.1 Definitions
# =============================================================================

MANDATORY_DECLARATION_TYPES = [
    "APPLICANT_ELIGIBILITY",
    "AUTHOR_ROLE",
    "PUBLICATION_ELIGIBILITY",
    "ANNUAL_LIMITS",
    "AUTHENTICITY",
    "NON_DUPLICATION",
    "BANK_OWNERSHIP",
    "REFUND_UNDERTAKING",
]

DRAFT_DECLARATION_TEXTS = {
    "APPLICANT_ELIGIBILITY": (
        "I confirm that I am currently a serving Faculty member, registered Research Scholar, "
        "or registered Post-Doctoral Researcher at the CSJMU Campus, and satisfy the eligibility criteria "
        "specified under the ANUDAAN Research Publication Incentive Scheme."
    ),
    "AUTHOR_ROLE": (
        "I declare that my authorship attribution as First Author or nominated Corresponding Author "
        "is true and correct, and has been mutually consented to by all co-authors of the paper."
    ),
    "PUBLICATION_ELIGIBILITY": (
        "I confirm that this publication was officially published on or after January 1, 2026, "
        "is classified as an Article or Review, is indexed in Scopus or Web of Science, and bears "
        "explicit institutional affiliation with Chhatrapati Shahu Ji Maharaj University, Kanpur."
    ),
    "ANNUAL_LIMITS": (
        "I acknowledge the applicable institutional publication submission ceilings per tier "
        "(Q1: 6, Q2: 6, Q3: 4, Q4: 2) as configured under university guidelines."
    ),
    "AUTHENTICITY": (
        "I affirm that all information, publication metadata, author roles, and supporting documents "
        "submitted in this application are authentic, accurate, and unmanipulated."
    ),
    "NON_DUPLICATION": (
        "I solemnly declare that this research publication has not been submitted for, rewarded by, "
        "or claimed under any other cash incentive scheme or award of CSJMU or any other external agency."
    ),
    "BANK_OWNERSHIP": (
        "I confirm that the designated bank account is active, valid, and owned by the declared payable "
        "author as registered in bank records, and all provided banking details are accurate."
    ),
    "REFUND_UNDERTAKING": (
        "I hereby undertake to refund the entire disbursed incentive amount to CSJMU if the publication "
        "is subsequently retracted, found in violation of academic ethics, or determined ineligible."
    ),
}


class AnudaanDeclarationAcceptance(BaseModel):
    """Acceptance payload for a specific statutory declaration."""
    declaration_type: str = Field(..., min_length=2, max_length=100, description="Mandatory declaration category code")
    accepted: bool = Field(..., description="Must be True")
    declaration_version: str = Field(default="1.0", max_length=20)
    declaration_text_snapshot: str = Field(..., min_length=10, description="Exact text agreed to by applicant")

    @field_validator("accepted")
    @classmethod
    def validate_accepted(cls, v: bool) -> bool:
        if not v:
            raise ValueError("Declaration must be explicitly accepted (accepted=True).")
        return v


class AnudaanDeclarationOut(BaseModel):
    """Output declaration record."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    declaration_type: str
    accepted: bool
    accepted_at: Optional[datetime] = None
    accepted_by_identifier: Optional[str] = None
    declaration_version: str
    declaration_text_snapshot: str


# =============================================================================
# 6. Application Draft & Lifecycle Schemas
# =============================================================================

class AnudaanApplicationCreateDraft(BaseModel):
    """
    Initial submission intake creating a DRAFT application record.
    Returns tracking credentials required for subsequent draft updates and submission.
    """
    applicant_category: AnudaanApplicantCategory
    full_name: str = Field(..., min_length=2, max_length=255)
    institutional_id: str = Field(..., min_length=2, max_length=100, description="Employee Code or Ph.D. Registration No.")
    designation: str = Field(..., min_length=2, max_length=150)
    department_name: str = Field(..., min_length=2, max_length=255)
    supervisor_name: Optional[str] = Field(None, max_length=255)
    mobile_number: str = Field(..., min_length=10, max_length=20)
    scopus_author_id: Optional[str] = Field(None, max_length=50)
    scopus_profile_url: Optional[str] = Field(None, max_length=500)
    form_metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        cleaned = re.sub(r"[\s\-]", "", v.strip())
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("Invalid mobile number format. Must contain 10 to 15 digits.")
        return cleaned


class AnudaanApplicationUpdateDraft(BaseModel):
    """Update profile and extensible metadata of a DRAFT application."""
    applicant_category: Optional[AnudaanApplicantCategory] = None
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    institutional_id: Optional[str] = Field(None, min_length=2, max_length=100)
    designation: Optional[str] = Field(None, min_length=2, max_length=150)
    department_name: Optional[str] = Field(None, min_length=2, max_length=255)
    supervisor_name: Optional[str] = Field(None, max_length=255)
    mobile_number: Optional[str] = Field(None, min_length=10, max_length=20)
    scopus_author_id: Optional[str] = Field(None, max_length=50)
    scopus_profile_url: Optional[str] = Field(None, max_length=500)
    form_metadata: Optional[Dict[str, Any]] = None

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = re.sub(r"[\s\-]", "", v.strip())
        if not PHONE_REGEX.match(cleaned):
            raise ValueError("Invalid mobile number format. Must contain 10 to 15 digits.")
        return cleaned


class AnudaanApplicationSubmitRequest(BaseModel):
    """
    Final submission request payload.
    Applicant provides all 8 statutory declarations to seal the application.
    """
    declarations: List[AnudaanDeclarationAcceptance] = Field(
        ...,
        min_length=8,
        description="Must accept all 8 mandatory statutory declarations as per V1.1",
    )


class AnudaanDraftCreationResponse(BaseModel):
    """
    Response returned when a draft is created.
    Crucial: tracking_secret is returned ONCE here and must be retained by the applicant.
    """
    application_id: uuid.UUID
    application_number: str
    tracking_secret: str
    status: AnudaanApplicationStatus
    applicant_category: AnudaanApplicantCategory
    full_name: str
    institutional_id: str
    department_name: str
    created_at: datetime
    message: str = "Draft application created successfully. Save your application number and tracking secret."


class AnudaanApplicationDetailOut(BaseModel):
    """Full detail view of an application for authorized review or draft editing."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    application_number: str
    applicant_category: AnudaanApplicantCategory
    full_name: str
    institutional_id: str
    designation: str
    department_name: str
    supervisor_name: Optional[str] = None
    mobile_number: str
    scopus_author_id: Optional[str] = None
    scopus_profile_url: Optional[str] = None
    status: AnudaanApplicationStatus
    form_metadata: Dict[str, Any] = {}
    submitted_at: Optional[datetime] = None
    publications: List[AnudaanPublicationOut] = []
    documents: List[AnudaanDocumentOut] = []
    declarations: List[AnudaanDeclarationOut] = []
    created_at: datetime
    updated_at: datetime


# =============================================================================
# 7. Secure Tracking Schemas
# =============================================================================

class AnudaanTrackingRequest(BaseModel):
    """Payload to query application status using Application ID and Tracking Secret."""
    application_number: str = Field(..., min_length=5, max_length=50)
    tracking_secret: str = Field(..., min_length=10, max_length=100)


class AnudaanTrackingPublicationSummary(BaseModel):
    """Summary of a publication for tracking display."""
    id: uuid.UUID
    paper_title: str
    journal_name: str
    publication_year: int
    applicant_declared_quartile: AnudaanQuartile
    verified_quartile: Optional[AnudaanQuartile] = None
    indexing_type: AnudaanIndexingType
    document_type: AnudaanDocumentType


class AnudaanTrackingStatusResponse(BaseModel):
    """
    Sanitized public tracking response.
    Never leaks sensitive personal contact tokens, account numbers, or PANs.
    """
    application_number: str
    status: AnudaanApplicationStatus
    applicant_name: str
    applicant_category: AnudaanApplicantCategory
    department_name: str
    submitted_at: Optional[datetime] = None
    publication_count: int
    publications: List[AnudaanTrackingPublicationSummary]
    last_updated: datetime
    status_description: str
