import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.modules.sama_veda.models.bulletin import ResearchBulletin
    from app.modules.sama_veda.models.author import ResearchAuthor
    from app.modules.sama_veda.models.publication import ResearchPublication


class CertificateTemplate(Base):
    """
    Institutional Certificate Template entity for CSJMU SAMIKSHA.
    Stores visual theme configurations, orientation, typography guidelines,
    and institutional decorative settings for programmatic PDF rendering.
    """
    __tablename__ = "sama_certificate_templates"
    __table_args__ = (
        Index("ix_sama_cert_tpl_code", "code", unique=True),
        Index("ix_sama_cert_tpl_type", "certificate_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment="Unique template identifier (e.g. 'CSJMU_A4_LANDSCAPE_V1')",
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable template title",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Institutional description and intended usage context",
    )
    certificate_type: Mapped[str] = mapped_column(
        String(50),
        default="RESEARCH_PUBLICATION",
        nullable=False,
        comment="Target certificate category (e.g. RESEARCH_PUBLICATION, APPRECIATION, CONTRIBUTION)",
    )
    orientation: Mapped[str] = mapped_column(
        String(20),
        default="LANDSCAPE",
        nullable=False,
        comment="Page orientation: LANDSCAPE | PORTRAIT",
    )
    config: Mapped[Dict[str, Any]] = mapped_column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Comprehensive visual layout, colors, typography, borders, and margins configuration",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        index=True,
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
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
    certificates: Mapped[List["FelicitationCertificate"]] = relationship(
        "FelicitationCertificate",
        back_populates="template",
    )

    def __init__(self, **kwargs):
        if 'id' not in kwargs or kwargs['id'] is None:
            kwargs['id'] = uuid.uuid4()
        if 'version' not in kwargs or kwargs['version'] is None:
            kwargs['version'] = 1
        if 'is_active' not in kwargs or kwargs['is_active'] is None:
            kwargs['is_active'] = True
        if 'is_default' not in kwargs or kwargs['is_default'] is None:
            kwargs['is_default'] = False
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<CertificateTemplate(id={self.id}, code='{self.code}', name='{self.name}')>"


class CertificateSignatory(Base):
    """
    Authorized institutional signing authority for CSJMU digital certificates.
    Enforces dual authority signing:
    Authority 1: Dean – Research & Development
    Authority 2: Vice Chancellor
    """
    __tablename__ = "sama_certificate_signatories"
    __table_args__ = (
        Index("ix_sama_signatory_type", "authority_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    authority_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Institutional role: DEAN_RD | VICE_CHANCELLOR",
    )
    signatory_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Full legal name and academic honorific of the authority",
    )
    designation: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Official university designation (e.g. 'Dean – Research & Development', 'Vice Chancellor')",
    )
    department: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        comment="Academic department or office affiliation",
    )
    signature_image_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Storage path to the verified institutional signature asset",
    )
    signature_asset_version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=text("true"),
        nullable=False,
        index=True,
    )
    effective_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date from which this authority signature became official",
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
    approvals: Mapped[List["CertificateApproval"]] = relationship(
        "CertificateApproval",
        back_populates="signatory",
    )

    def __init__(self, **kwargs):
        if 'id' not in kwargs or kwargs['id'] is None:
            kwargs['id'] = uuid.uuid4()
        if 'signature_asset_version' not in kwargs or kwargs['signature_asset_version'] is None:
            kwargs['signature_asset_version'] = 1
        if 'is_active' not in kwargs or kwargs['is_active'] is None:
            kwargs['is_active'] = True
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<CertificateSignatory(id={self.id}, name='{self.signatory_name}', type='{self.authority_type}')>"


class FelicitationCertificate(Base):
    """
    Official Research Appreciation & Felicitation Certificate issued by CSJMU R&D Cell.
    Awarded to faculty and scholars for publication achievements in indexed journals.
    Supports complete lifecycle: Draft -> Submitted -> Pending Approvals -> Issued -> Revoked / Reissued.
    """
    __tablename__ = "sama_felicitation_certificates"
    __table_args__ = (
        Index("ix_sama_cert_auth_bulletin", "author_id", "bulletin_id"),
        Index("ix_sama_cert_number", "certificate_number", unique=True),
        Index("ix_sama_cert_verification_token", "verification_token", unique=True),
        Index("ix_sama_cert_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    certificate_number: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        comment="Unique institutional serial number (e.g. 'CSJMU/SAMIKSHA/2026/000125')",
    )
    certificate_type: Mapped[str] = mapped_column(
        String(50),
        default="RESEARCH_PUBLICATION",
        server_default="RESEARCH_PUBLICATION",
        nullable=False,
        comment="Certificate category: RESEARCH_PUBLICATION | APPRECIATION | CONTRIBUTION",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="ISSUED",
        server_default="ISSUED",
        nullable=False,
        index=True,
        comment="State machine status: DRAFT | SUBMITTED | PENDING_DEAN_APPROVAL | PENDING_VC_APPROVAL | APPROVED | ISSUED | REJECTED | REVOKED | SUPERSEDED",
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_certificate_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Template layout used for this certificate",
    )
    template_version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
        comment="Immutable template version snapshot at issuance",
    )
    title: Mapped[str] = mapped_column(
        String(255),
        default="Certificate of Appreciation & Research Excellence",
        server_default="Certificate of Appreciation & Research Excellence",
        nullable=False,
        comment="Formal title displayed prominently on the certificate",
    )
    presentation_statement: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default="This certificate is proudly conferred upon",
        comment="Formal presentation statement preceding recipient names",
    )
    research_contribution_statement: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default="in recognition of meritorious scholarly contribution published in the research article titled:",
        comment="Research contribution clause preceding publication title",
    )
    research_title: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Exact title of felicitated publication or scholarly achievement",
    )
    congratulatory_statement: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        default="The university commends the exemplary commitment to advancing research frontiers and intellectual pursuit.",
        comment="Closing institutional commendation statement",
    )
    publication_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Structured metadata snapshot: journal, volume, issue, DOI, Scopus indexing, impact factor",
    )
    verification_token: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        default=lambda: uuid.uuid4().hex,
        comment="Cryptographically unpredictable token for public verification URL and QR code",
    )
    bulletin_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_bulletins.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="The research bulletin issue in which the work was felicitated (optional for direct issuances)",
    )
    author_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_authors.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        comment="Primary felicitated author receiving this certificate (legacy / primary link)",
    )
    publication_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_publications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Optional foreign key to the specific paper qualifying for this certificate",
    )
    file_storage_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="Path to certificate PDF in secure storage (nullable while in draft/approval)",
    )
    checksum_sha256: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="Cryptographic SHA-256 hash of the final issued certificate PDF",
    )
    download_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of times this certificate document has been streamed/downloaded",
    )
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Date of certificate issuance or felicitation ceremony",
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when dual authority approvals were completed",
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Super Admin or administrator user who created this certificate record",
    )
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text("false"),
        nullable=False,
        index=True,
        comment="Whether this certificate has been officially revoked",
    )
    revoked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when certificate was revoked",
    )
    revocation_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Institutional justification or audit rationale for revocation",
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Remarks entered if the certificate was rejected during the approval workflow",
    )
    reissued_from_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_felicitation_certificates.id", ondelete="SET NULL"),
        nullable=True,
        comment="Pointer to the superseded certificate if this is a reissued document",
    )
    reissued_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Audit rationale for reissuing a new certificate",
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
    bulletin: Mapped[Optional["ResearchBulletin"]] = relationship(
        "ResearchBulletin",
        back_populates="certificates",
    )
    author: Mapped[Optional["ResearchAuthor"]] = relationship(
        "ResearchAuthor",
        back_populates="certificates",
    )
    publication: Mapped[Optional["ResearchPublication"]] = relationship(
        "ResearchPublication",
        back_populates="certificates",
    )
    template: Mapped[Optional["CertificateTemplate"]] = relationship(
        "CertificateTemplate",
        back_populates="certificates",
    )
    authors: Mapped[List["CertificateAuthor"]] = relationship(
        "CertificateAuthor",
        back_populates="certificate",
        cascade="all, delete-orphan",
        order_by="CertificateAuthor.author_order.asc()",
    )
    approvals: Mapped[List["CertificateApproval"]] = relationship(
        "CertificateApproval",
        back_populates="certificate",
        cascade="all, delete-orphan",
    )
    verification_events: Mapped[List["CertificateVerificationEvent"]] = relationship(
        "CertificateVerificationEvent",
        back_populates="certificate",
        cascade="all, delete-orphan",
        order_by="CertificateVerificationEvent.verified_at.desc()",
    )
    reissued_from: Mapped[Optional["FelicitationCertificate"]] = relationship(
        "FelicitationCertificate",
        remote_side=[id],
        foreign_keys=[reissued_from_id],
        backref="reissued_to",
    )
    created_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by_user_id],
    )

    def __init__(self, **kwargs):
        if "certificate_type" not in kwargs:
            kwargs["certificate_type"] = "RESEARCH_PUBLICATION"
        if "status" not in kwargs:
            kwargs["status"] = "ISSUED"
        if "title" not in kwargs:
            kwargs["title"] = "Certificate of Appreciation & Research Excellence"
        if "template_version" not in kwargs:
            kwargs["template_version"] = 1
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"<FelicitationCertificate(id={self.id}, cert_no='{self.certificate_number}', status='{self.status}')>"


class CertificateAuthor(Base):
    """
    Multi-Author Association entity for CSJMU Certificates.
    Preserves full author order, role, and immutable snapshots of researcher data
    (name, academic title, Scopus ID, department, affiliation) as of issuance time.
    """
    __tablename__ = "sama_certificate_authors"
    __table_args__ = (
        Index("ix_sama_cert_auth_order", "certificate_id", "author_order"),
        Index("ix_sama_cert_auth_researcher", "researcher_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_felicitation_certificates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    researcher_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_authors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to official Researcher Directory author profile (nullable for manual entries)",
    )
    author_name_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Immutable recipient name snapshot as rendered on the certificate",
    )
    academic_title_snapshot: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Academic title prefix (e.g. 'Dr.', 'Prof.')",
    )
    scopus_id_snapshot: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        comment="Author Scopus Identifier snapshot",
    )
    affiliation_snapshot: Mapped[Optional[str]] = mapped_column(
        String(255),
        default="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        nullable=True,
    )
    department_snapshot: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    author_order: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
        comment="Sequential presentation order (1, 2, 3...)",
    )
    author_role: Mapped[str] = mapped_column(
        String(50),
        default="Author",
        server_default="Author",
        nullable=False,
        comment="Author contribution role (e.g. First Author, Corresponding Author, Co-Author)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    certificate: Mapped["FelicitationCertificate"] = relationship(
        "FelicitationCertificate",
        back_populates="authors",
    )
    researcher: Mapped[Optional["ResearchAuthor"]] = relationship(
        "ResearchAuthor",
        foreign_keys=[researcher_id],
    )

    def __repr__(self) -> str:
        return f"<CertificateAuthor(id={self.id}, name='{self.author_name_snapshot}', order={self.author_order})>"


class CertificateApproval(Base):
    """
    Mandatory Dual Signing Authority Approval Record.
    Tracks review decisions, timestamps, remarks, and identity of approving authority
    for Dean – R&D and Vice Chancellor.
    """
    __tablename__ = "sama_certificate_approvals"
    __table_args__ = (
        Index("ix_sama_cert_approval_status", "certificate_id", "authority_type", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_felicitation_certificates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    authority_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="DEAN_RD | VICE_CHANCELLOR",
    )
    signatory_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_certificate_signatories.id", ondelete="SET NULL"),
        nullable=True,
    )
    signatory_name_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Snapshot of signing authority name",
    )
    designation_snapshot: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Snapshot of official designation",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        server_default="PENDING",
        nullable=False,
        comment="PENDING | APPROVED | REJECTED",
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        comment="Institutional feedback or mandatory rejection rationale",
    )
    decided_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    decided_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    certificate: Mapped["FelicitationCertificate"] = relationship(
        "FelicitationCertificate",
        back_populates="approvals",
    )
    signatory: Mapped[Optional["CertificateSignatory"]] = relationship(
        "CertificateSignatory",
        back_populates="approvals",
    )
    decided_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[decided_by_user_id],
    )

    def __repr__(self) -> str:
        return f"<CertificateApproval(cert_id={self.certificate_id}, auth='{self.authority_type}', status='{self.status}')>"


class CertificateVerificationEvent(Base):
    """
    Audit log of certificate lookups, verification checks, and download requests.
    Enforces security telemetry, rate-limiting oversight, and access tracking.
    """
    __tablename__ = "sama_certificate_verification_events"
    __table_args__ = (
        Index("ix_sama_cert_verify_time", "certificate_id", "verified_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    certificate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_felicitation_certificates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    verification_source: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Source method: SCOPUS_ID | QR_CODE | PORTAL | AUTHENTICATED",
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True,
        comment="IPv4 or IPv6 address of requesting client",
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
        comment="User-Agent string of client browser",
    )
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationships
    certificate: Mapped["FelicitationCertificate"] = relationship(
        "FelicitationCertificate",
        back_populates="verification_events",
    )

    def __repr__(self) -> str:
        return f"<CertificateVerificationEvent(cert_id={self.certificate_id}, source='{self.verification_source}', at={self.verified_at})>"
