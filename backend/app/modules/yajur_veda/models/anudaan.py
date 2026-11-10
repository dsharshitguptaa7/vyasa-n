"""
ANUDAAN (Yajur Veda) Module Data Models
Implements the 10 core relational entities for CSJMU Research Publication Incentive Management
in strict compliance with ANUDAAN Field Mapping Document V1.1.

Table Namespace: yajur_anudaan_*
"""
import re
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from decimal import Decimal

def normalize_doi(raw_doi: Optional[str]) -> Optional[str]:
    """
    Normalizes a DOI string for consistent lookup and duplicate comparison:
    - Strips whitespace
    - Lowercases
    - Removes common URL and protocol prefixes (https://doi.org/, http://dx.doi.org/, doi:)
    - Removes URL query parameters (?...) and URL fragments (#...) if provided as URL
    - Trims trailing slashes
    - Preserves legitimate punctuation inside bare DOI suffixes
    """
    if not raw_doi:
        return None
    cleaned = raw_doi.strip()
    cleaned = re.sub(r"^https?://(dx\.)?doi\.org/", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^doi:\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()
    # Strip URL query strings or fragments if supplied as a full URL
    cleaned = cleaned.split("?")[0].split("#")[0]
    cleaned = cleaned.rstrip("/").strip().lower()
    return cleaned if cleaned else None

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
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
from app.modules.yajur_veda.models.encryption import (
    encrypt_banking_field,
    decrypt_banking_field,
    extract_last4,
)

if TYPE_CHECKING:
    from app.models.user import User


# =============================================================================
# 1. AnudaanApplication (Root Submission Record)
# =============================================================================

class AnudaanApplication(Base):
    """
    Root application entity submitted by a CSJMU campus researcher.
    Captures applicant profile snapshot, submission metadata, and application state.
    """
    __tablename__ = "yajur_anudaan_applications"
    __table_args__ = (
        Index("ix_anudaan_app_number", "application_number", unique=True),
        Index("ix_anudaan_app_status", "status"),
        Index("ix_anudaan_app_applicant_user", "applicant_user_id"),
        Index("ix_anudaan_app_scopus", "scopus_author_id"),
        Index("ix_anudaan_app_submitted_at", "submitted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_number: Mapped[str] = mapped_column(
        String(32),
        unique=True,
        nullable=False,
        comment="Human-readable application identifier (e.g. 'ANU-2026-00001')",
    )
    applicant_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional foreign key if applicant is an authenticated platform user",
    )
    applicant_category: Mapped[AnudaanApplicantCategory] = mapped_column(
        Enum(AnudaanApplicantCategory, name="anudaan_applicant_category"),
        nullable=False,
        comment="Eligible category: FACULTY_CAMPUS, SCHOLAR_CAMPUS, POSTDOC_CAMPUS",
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Applicant full name as submitted",
    )
    institutional_id: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Employee Code or Ph.D. Registration Number",
    )
    designation: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Designation (e.g. Professor, Assistant Professor, Research Scholar)",
    )
    department_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        comment="Optional department entity identifier if department registry exists",
    )
    department_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Department / School name snapshot at time of submission",
    )
    supervisor_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Supervisor name (mandatory for Research Scholars and Post-Docs)",
    )
    mobile_number: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Applicant contact mobile number",
    )
    scopus_author_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Applicant Scopus Author Identifier",
    )
    scopus_profile_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Full URL to official Scopus author profile",
    )
    status: Mapped[AnudaanApplicationStatus] = mapped_column(
        Enum(AnudaanApplicationStatus, name="anudaan_application_status"),
        default=AnudaanApplicationStatus.SUBMITTED,
        server_default="SUBMITTED",
        nullable=False,
        comment="Application lifecycle stage",
    )
    form_metadata: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        server_default="{}",
        nullable=False,
        comment="Extensible non-critical form fields pending final institutional form release",
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
        comment="Official timestamp when application was submitted",
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
    applicant_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[applicant_user_id],
    )
    publications: Mapped[List["AnudaanPublication"]] = relationship(
        "AnudaanPublication",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    documents: Mapped[List["AnudaanDocument"]] = relationship(
        "AnudaanDocument",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    declarations: Mapped[List["AnudaanDeclaration"]] = relationship(
        "AnudaanDeclaration",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    verifications: Mapped[List["AnudaanVerification"]] = relationship(
        "AnudaanVerification",
        back_populates="application",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<AnudaanApplication(id={self.id}, number='{self.application_number}', status='{self.status}')>"


# =============================================================================
# 2. AnudaanPerson (Reusable Author Identity Ledger)
# =============================================================================

class AnudaanPerson(Base):
    """
    Normalized person entity representing individual researchers and authors.
    Decoupled from application submissions to enable identity reuse across multiple
    applications and publications while avoiding duplicate profiles.
    """
    __tablename__ = "yajur_anudaan_people"
    __table_args__ = (
        Index("ix_anudaan_person_name", "full_name"),
        Index("ix_anudaan_person_scopus", "scopus_author_id"),
        Index("ix_anudaan_person_inst_id", "employee_or_registration_id"),
        Index("ix_anudaan_person_user", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Person full name",
    )
    scopus_author_id: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Scopus Author ID (not universally available, non-unique across uncurated names)",
    )
    scopus_profile_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Scopus Profile URL",
    )
    mobile_number: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Contact phone number",
    )
    employee_or_registration_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="CSJMU Employee Code or Registration ID if affiliated",
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional link to VYASA Core user identity if registered",
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
    user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[user_id],
    )
    publication_authorships: Mapped[List["AnudaanPublicationAuthor"]] = relationship(
        "AnudaanPublicationAuthor",
        back_populates="person",
        cascade="all, delete-orphan",
    )
    bank_account_links: Mapped[List["AnudaanBankAccountHolder"]] = relationship(
        "AnudaanBankAccountHolder",
        back_populates="person",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<AnudaanPerson(id={self.id}, name='{self.full_name}', scopus='{self.scopus_author_id}')>"


# =============================================================================
# 3. AnudaanPublication (Individual Scholarly Work Intake)
# =============================================================================

class AnudaanPublication(Base):
    """
    Research publication record attached to an incentive application.
    Supports dynamic N publications per application without hardcoded limits.
    """
    __tablename__ = "yajur_anudaan_publications"
    __table_args__ = (
        Index("ix_anudaan_pub_app", "application_id"),
        Index("ix_anudaan_pub_norm_doi", "normalized_doi"),
        Index("ix_anudaan_pub_date", "publication_date"),
        Index("ix_anudaan_pub_quartile", "applicant_declared_quartile"),
        Index("ix_anudaan_pub_verified_quartile", "verified_quartile"),
        CheckConstraint("publication_year >= 2020", name="ck_anudaan_pub_year"),
        CheckConstraint("jci_value IS NULL OR jci_value >= 0", name="ck_anudaan_pub_jci_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_applications.id", ondelete="CASCADE"),
        nullable=False,
        comment="Parent application foreign key",
    )
    publication_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Official publication date (must be on or after 2026-01-01 for V1.1 eligibility)",
    )
    document_type: Mapped[AnudaanDocumentType] = mapped_column(
        Enum(AnudaanDocumentType, name="anudaan_document_type"),
        nullable=False,
        comment="Publication document type: ARTICLE or REVIEW",
    )
    publication_status: Mapped[AnudaanPublicationStatus] = mapped_column(
        Enum(AnudaanPublicationStatus, name="anudaan_publication_status"),
        default=AnudaanPublicationStatus.PUBLISHED,
        server_default="PUBLISHED",
        nullable=False,
        comment="Publication stage: only PUBLISHED is eligible",
    )
    indexing_type: Mapped[AnudaanIndexingType] = mapped_column(
        Enum(AnudaanIndexingType, name="anudaan_indexing_type"),
        nullable=False,
        comment="Indexing database: SCOPUS, WEB_OF_SCIENCE, or SCOPUS_AND_WOS",
    )
    has_csjmu_affiliation: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="True if published paper contains explicit CSJMU affiliation",
    )
    doi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Raw DOI identifier string as submitted",
    )
    normalized_doi: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Normalized DOI for duplicate checking (lowercase, stripped prefixes)",
    )
    paper_title: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Full paper title",
    )
    journal_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Publishing journal name",
    )
    issn: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Print ISSN",
    )
    e_issn: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Electronic ISSN",
    )
    publication_year: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Calendar year of publication",
    )
    volume: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Journal volume",
    )
    issue: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Journal issue",
    )
    page_details: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Page numbers or article number (e.g. '123-145' or 'e100234')",
    )
    applicant_declared_quartile: Mapped[AnudaanQuartile] = mapped_column(
        Enum(AnudaanQuartile, name="anudaan_quartile"),
        nullable=False,
        comment="Quartile declared by applicant (Q1, Q2, Q3, Q4, UNASSIGNED)",
    )
    verified_quartile: Mapped[Optional[AnudaanQuartile]] = mapped_column(
        Enum(AnudaanQuartile, name="anudaan_quartile"),
        nullable=True,
        comment="Quartile verified by Dean or authority review",
    )
    jci_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(6, 3),
        nullable=True,
        comment="Journal Citation Indicator (JCI). JCI = 1.0 remains unresolved without automatic Q3/Q4 coercion",
    )
    quartile_verification_source: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Source repository used for verification (e.g. 'CLARIVATE_JCR_2025', 'SCIMAGO_SJR_2025')",
    )
    quartile_verification_remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Audit remarks entered during quartile adjudication",
    )
    quartile_verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User ID of authority who verified quartile",
    )
    quartile_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when quartile verification occurred",
    )
    paper_document_storage_key: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Reference key to PDF in secure storage proxy",
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
        back_populates="publications",
    )
    quartile_verified_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[quartile_verified_by_id],
    )
    authors: Mapped[List["AnudaanPublicationAuthor"]] = relationship(
        "AnudaanPublicationAuthor",
        back_populates="publication",
        cascade="all, delete-orphan",
    )
    documents: Mapped[List["AnudaanDocument"]] = relationship(
        "AnudaanDocument",
        back_populates="publication",
        cascade="all, delete-orphan",
    )
    verifications: Mapped[List["AnudaanVerification"]] = relationship(
        "AnudaanVerification",
        back_populates="publication",
        cascade="all, delete-orphan",
    )

    def set_doi(self, raw_doi: Optional[str]) -> None:
        """Sets both raw DOI and normalized DOI consistently."""
        self.doi = raw_doi
        self.normalized_doi = normalize_doi(raw_doi)

    def __repr__(self) -> str:
        return f"<AnudaanPublication(id={self.id}, doi='{self.doi}', quartile='{self.applicant_declared_quartile}')>"


# =============================================================================
# 4. AnudaanBankAccount (Encrypted Bank Details)
# =============================================================================

class AnudaanBankAccount(Base):
    """
    Secure repository for bank accounts used in incentive payouts.
    Enforces application-level AES Fernet encryption on account numbers and PANs.
    Never stores plaintext account numbers or duplicate confirmation inputs.
    """
    __tablename__ = "yajur_anudaan_bank_accounts"
    __table_args__ = (
        Index("ix_anudaan_bank_holder_name", "account_holder_name"),
        Index("ix_anudaan_bank_ifsc", "ifsc_code"),
        Index("ix_anudaan_bank_last4", "account_number_last4"),
        CheckConstraint("length(ifsc_code) = 11", name="ck_anudaan_ifsc_length"),
        CheckConstraint("length(account_number_last4) = 4", name="ck_anudaan_last4_length"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    account_holder_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Account holder name as registered in bank",
    )
    bank_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Bank institution name (e.g. State Bank of India)",
    )
    account_number_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Fernet-encrypted full bank account number. Never stored in plaintext.",
    )
    account_number_last4: Mapped[str] = mapped_column(
        String(4),
        nullable=False,
        comment="Last four digits for safe UI rendering and identification",
    )
    ifsc_code: Mapped[str] = mapped_column(
        String(11),
        nullable=False,
        comment="11-character Indian Financial System Code",
    )
    branch_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Bank branch name or location",
    )
    account_type: Mapped[AnudaanBankAccountType] = mapped_column(
        Enum(AnudaanBankAccountType, name="anudaan_bank_account_type"),
        default=AnudaanBankAccountType.SAVINGS,
        server_default="SAVINGS",
        nullable=False,
        comment="SAVINGS or CURRENT",
    )
    pan_number_encrypted: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Fernet-encrypted Permanent Account Number (PAN)",
    )
    bank_mobile_number: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
        comment="Mobile number registered with bank account",
    )
    proof_document_storage_key: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Storage reference to cancelled cheque or passbook proof",
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
    holders: Mapped[List["AnudaanBankAccountHolder"]] = relationship(
        "AnudaanBankAccountHolder",
        back_populates="bank_account",
        cascade="all, delete-orphan",
    )

    def set_account_number(self, plain_account_number: str) -> None:
        """Encrypts account number and extracts last 4 digits."""
        if not plain_account_number or not str(plain_account_number).strip():
            raise ValueError("Account number cannot be empty")
        cleaned = str(plain_account_number).strip()
        self.account_number_encrypted = encrypt_banking_field(cleaned)
        self.account_number_last4 = extract_last4(cleaned)

    def get_decrypted_account_number(self) -> Optional[str]:
        """Decrypts and returns full account number for authorized banking operations."""
        return decrypt_banking_field(self.account_number_encrypted)

    def set_pan(self, plain_pan: Optional[str]) -> None:
        """Encrypts optional PAN."""
        if plain_pan:
            self.pan_number_encrypted = encrypt_banking_field(plain_pan.strip().upper())
        else:
            self.pan_number_encrypted = None

    def get_decrypted_pan(self) -> Optional[str]:
        """Decrypts and returns full PAN for authorized operations."""
        return decrypt_banking_field(self.pan_number_encrypted)

    def __repr__(self) -> str:
        return f"<AnudaanBankAccount(id={self.id}, bank='{self.bank_name}', last4='{self.account_number_last4}')>"


# =============================================================================
# 5. AnudaanBankAccountHolder (Explicit Person-to-Account Association)
# =============================================================================

class AnudaanBankAccountHolder(Base):
    """
    Explicit associative entity linking an AnudaanPerson to an AnudaanBankAccount.
    Guarantees that bank accounts are linked to owners only via explicit verified
    relationships, preventing accidental or silent cross-person account reuse.
    """
    __tablename__ = "yajur_anudaan_bank_account_holders"
    __table_args__ = (
        UniqueConstraint("person_id", "bank_account_id", name="uq_anudaan_person_bank_account"),
        Index("ix_anudaan_holder_person", "person_id"),
        Index("ix_anudaan_holder_bank", "bank_account_id"),
        Index("ix_anudaan_holder_status", "ownership_verification_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_people.id", ondelete="CASCADE"),
        nullable=False,
    )
    bank_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_bank_accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    ownership_verification_status: Mapped[AnudaanBankOwnershipStatus] = mapped_column(
        Enum(AnudaanBankOwnershipStatus, name="anudaan_bank_ownership_status"),
        default=AnudaanBankOwnershipStatus.UNVERIFIED,
        server_default="UNVERIFIED",
        nullable=False,
        comment="UNVERIFIED, VERIFIED, or REJECTED",
    )
    ownership_verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Authority user ID who confirmed bank account ownership match",
    )
    ownership_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    person: Mapped["AnudaanPerson"] = relationship(
        "AnudaanPerson",
        back_populates="bank_account_links",
    )
    bank_account: Mapped["AnudaanBankAccount"] = relationship(
        "AnudaanBankAccount",
        back_populates="holders",
    )
    ownership_verified_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[ownership_verified_by_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanBankAccountHolder(person={self.person_id}, bank={self.bank_account_id}, status='{self.ownership_verification_status}')>"


# =============================================================================
# 6. AnudaanPublicationAuthor (Author Attribution & Payout Recipient Mapping)
# =============================================================================

class AnudaanPublicationAuthor(Base):
    """
    Connects a person to a publication with their specific authorship role.
    Critical Constraints:
    - One FIRST author per publication (partial unique index).
    - One nominated CORRESPONDING author per publication (partial unique index).
    - Only FIRST and nominated CORRESPONDING authors can be payable recipients.
    - CO_AUTHOR role is non-payable (bank_account_id must remain NULL).
    """
    __tablename__ = "yajur_anudaan_publication_authors"
    __table_args__ = (
        Index("ix_anudaan_author_pub", "publication_id"),
        Index("ix_anudaan_author_person", "person_id"),
        Index("ix_anudaan_author_bank", "bank_account_id"),
        # Partial unique index 1: Only one FIRST author assignment per publication
        Index(
            "uq_anudaan_pub_first_author",
            "publication_id",
            unique=True,
            postgresql_where=text("author_role = 'FIRST'"),
        ),
        # Partial unique index 2: Only one nominated corresponding author per publication
        Index(
            "uq_anudaan_pub_nominated_corr_author",
            "publication_id",
            unique=True,
            postgresql_where=text("is_nominated_corresponding_author = true"),
        ),
        CheckConstraint("author_order IS NULL OR author_order > 0", name="ck_anudaan_author_order_positive"),
        CheckConstraint(
            "author_role != 'CO_AUTHOR' OR bank_account_id IS NULL",
            name="ck_anudaan_coauthor_no_bank",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    publication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_publications.id", ondelete="CASCADE"),
        nullable=False,
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_people.id", ondelete="RESTRICT"),
        nullable=False,
    )
    author_role: Mapped[AnudaanAuthorRole] = mapped_column(
        Enum(AnudaanAuthorRole, name="anudaan_author_role"),
        nullable=False,
        comment="FIRST, CORRESPONDING, or CO_AUTHOR",
    )
    author_order: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
        comment="Sequential author order as listed on paper (1, 2, 3...)",
    )
    is_csjmu_affiliated: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        comment="Affiliation status for this specific author on the paper",
    )
    has_multiple_corresponding_authors: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Flag indicating whether paper has multiple corresponding authors",
    )
    is_nominated_corresponding_author: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="True if this individual is the single nominated corresponding author for payout share",
    )
    bank_reuse_selected: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Explicit manual choice to reuse previously entered bank details",
    )
    bank_account_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_bank_accounts.id", ondelete="SET NULL"),
        nullable=True,
        comment="Bank account designated for this author's incentive share (null for non-payable co-authors)",
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
    publication: Mapped["AnudaanPublication"] = relationship(
        "AnudaanPublication",
        back_populates="authors",
    )
    person: Mapped["AnudaanPerson"] = relationship(
        "AnudaanPerson",
        back_populates="publication_authorships",
    )
    bank_account: Mapped[Optional["AnudaanBankAccount"]] = relationship(
        "AnudaanBankAccount",
        foreign_keys=[bank_account_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanPublicationAuthor(pub={self.publication_id}, person={self.person_id}, role='{self.author_role}')>"


# =============================================================================
# 7. AnudaanDocument (Document Attachment Reference Ledger)
# =============================================================================

class AnudaanDocument(Base):
    """
    Stores document metadata and storage references for papers, cheques, and proofs.
    Enforces a strict 10MB file size ceiling and references the pluggable storage service.
    Binaries are never stored in the database.
    """
    __tablename__ = "yajur_anudaan_documents"
    __table_args__ = (
        Index("ix_anudaan_doc_app", "application_id"),
        Index("ix_anudaan_doc_pub", "publication_id"),
        Index("ix_anudaan_doc_person", "person_id"),
        Index("ix_anudaan_doc_type", "document_type"),
        CheckConstraint("file_size_bytes > 0 AND file_size_bytes <= 10485760", name="ck_anudaan_doc_size_limit"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    publication_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_publications.id", ondelete="CASCADE"),
        nullable=True,
        comment="Optional link if document is a published paper manuscript",
    )
    person_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_people.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional link if document is personal bank proof for an author",
    )
    document_type: Mapped[AnudaanDocumentCategory] = mapped_column(
        Enum(AnudaanDocumentCategory, name="anudaan_document_category"),
        nullable=False,
        comment="PUBLISHED_PAPER, CANCELLED_CHEQUE, PASSBOOK, OTHER",
    )
    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Client filename at time of upload",
    )
    storage_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Storage subsystem key (local disk or S3/Spaces)",
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Verified MIME type (e.g. 'application/pdf', 'image/jpeg')",
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="File size in bytes (max 10MB: 10485760)",
    )
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Optional uploader user ID if uploaded by authenticated user",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application: Mapped["AnudaanApplication"] = relationship(
        "AnudaanApplication",
        back_populates="documents",
    )
    publication: Mapped[Optional["AnudaanPublication"]] = relationship(
        "AnudaanPublication",
        back_populates="documents",
    )
    person: Mapped[Optional["AnudaanPerson"]] = relationship(
        "AnudaanPerson",
        foreign_keys=[person_id],
    )
    uploaded_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[uploaded_by_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanDocument(id={self.id}, type='{self.document_type}', file='{self.original_filename}')>"


# =============================================================================
# 8. AnudaanDeclaration (Submission Declarations & Wording Snapshots)
# =============================================================================

class AnudaanDeclaration(Base):
    """
    Captures legal, institutional, and research authenticity declarations accepted
    during submission. Preserves the exact declaration wording snapshot and version.
    """
    __tablename__ = "yajur_anudaan_declarations"
    __table_args__ = (
        Index("ix_anudaan_decl_app", "application_id"),
        Index("ix_anudaan_decl_type", "declaration_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    declaration_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Declaration category (e.g. 'AUTHENTICITY', 'AFFILIATION', 'NON_DUPLICATION')",
    )
    accepted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="Flag indicating explicit agreement",
    )
    accepted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when agreement was given",
    )
    accepted_by_identifier: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Applicant name or institutional ID agreeing to declaration",
    )
    declaration_version: Mapped[str] = mapped_column(
        String(20),
        default="1.0",
        server_default="1.0",
        nullable=False,
        comment="Version of legal wording accepted",
    )
    declaration_text_snapshot: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Exact declaration text presented to applicant at time of submission",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application: Mapped["AnudaanApplication"] = relationship(
        "AnudaanApplication",
        back_populates="declarations",
    )

    def __repr__(self) -> str:
        return f"<AnudaanDeclaration(id={self.id}, app={self.application_id}, type='{self.declaration_type}', accepted={self.accepted})>"


# =============================================================================
# 9. AnudaanAnnualLimitPolicy (Configurable Annual Quartile Caps)
# =============================================================================

class AnudaanAnnualLimitPolicy(Base):
    """
    Stores configurable annual submission / claim ceilings per quartile.
    Existing form values: Q1: 6, Q2: 6, Q3: 4, Q4: 2.
    Boundary Policy Invariant:
    The official counting basis (calendar vs. academic year vs. financial year)
    is currently UNCONFIRMED by CSJMU administration.
    Therefore, is_active is set to False by default, clearly separating
    configured defaults from legally enforced policy.
    """
    __tablename__ = "yajur_anudaan_annual_limit_policies"
    __table_args__ = (
        UniqueConstraint("academic_or_calendar_year", "quartile", name="uq_anudaan_policy_year_quartile"),
        Index("ix_anudaan_policy_year", "academic_or_calendar_year"),
        Index("ix_anudaan_policy_active", "is_active"),
        CheckConstraint("maximum_claims >= 0", name="ck_anudaan_policy_max_claims_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    academic_or_calendar_year: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Policy evaluation period (e.g. '2026' or '2025-2026')",
    )
    quartile: Mapped[AnudaanQuartile] = mapped_column(
        Enum(AnudaanQuartile, name="anudaan_quartile"),
        nullable=False,
        comment="Quartile tier: Q1, Q2, Q3, Q4",
    )
    maximum_claims: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Maximum allowed claims per author/applicant in this quartile tier",
    )
    counting_basis: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Evaluation basis: CALENDAR_YEAR, ACADEMIC_YEAR, FINANCIAL_YEAR (unconfirmed)",
    )
    effective_from: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        comment="Start date of policy validity",
    )
    effective_until: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
        comment="End date of policy validity, or null for indefinite",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        comment="False by default until institutional counting policy is officially confirmed",
    )
    policy_reference: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Official institutional order or notification reference number",
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
        return f"<AnudaanAnnualLimitPolicy(year='{self.academic_or_calendar_year}', quartile='{self.quartile}', max={self.maximum_claims}, active={self.is_active})>"


# =============================================================================
# 10. AnudaanVerification (Preserved Multi-Step Verification Ledger)
# =============================================================================

class AnudaanVerification(Base):
    """
    Append-only verification audit history for applications and publications.
    Preserves verification decisions, sources, and remarks without overwriting
    earlier evaluation steps.
    """
    __tablename__ = "yajur_anudaan_verifications"
    __table_args__ = (
        Index("ix_anudaan_verif_app", "application_id"),
        Index("ix_anudaan_verif_pub", "publication_id"),
        Index("ix_anudaan_verif_type", "verification_type"),
        Index("ix_anudaan_verif_status", "verification_status"),
        Index("ix_anudaan_verif_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_applications.id", ondelete="CASCADE"),
        nullable=False,
    )
    publication_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("yajur_anudaan_publications.id", ondelete="CASCADE"),
        nullable=True,
        comment="Optional link if verification applies to a specific publication",
    )
    verification_type: Mapped[AnudaanVerificationType] = mapped_column(
        Enum(AnudaanVerificationType, name="anudaan_verification_type"),
        nullable=False,
        comment="AFFILIATION_CHECK, QUARTILE_VERIFICATION, BANK_ACCOUNT_VERIFICATION, etc.",
    )
    verification_status: Mapped[AnudaanVerificationStatus] = mapped_column(
        Enum(AnudaanVerificationStatus, name="anudaan_verification_status"),
        default=AnudaanVerificationStatus.PENDING,
        server_default="PENDING",
        nullable=False,
        comment="PENDING, VERIFIED, FLAGGED, REJECTED",
    )
    verification_source: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        comment="Source of verification data (e.g. 'DEAN_MANUAL', 'SCOPUS_API', 'BANK_IFSC')",
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Auditor / Dean remarks explaining decision",
    )
    verified_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Authority user ID who performed verification",
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when verification occurred",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application: Mapped["AnudaanApplication"] = relationship(
        "AnudaanApplication",
        back_populates="verifications",
    )
    publication: Mapped[Optional["AnudaanPublication"]] = relationship(
        "AnudaanPublication",
        back_populates="verifications",
    )
    verified_by: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[verified_by_id],
    )

    def __repr__(self) -> str:
        return f"<AnudaanVerification(id={self.id}, type='{self.verification_type}', status='{self.verification_status}')>"
