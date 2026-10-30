import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.modules.sama_veda.models.bulletin import ResearchBulletin
    from app.modules.sama_veda.models.author import ResearchAuthor
    from app.modules.sama_veda.models.publication import ResearchPublication


class FelicitationCertificate(Base):
    """
    Official Research Appreciation & Felicitation Certificate issued by CSJMU R&D Cell.
    Awarded to faculty and scholars for publication achievements in indexed journals.
    """
    __tablename__ = "sama_felicitation_certificates"
    __table_args__ = (
        Index("ix_sama_cert_auth_bulletin", "author_id", "bulletin_id"),
        Index("ix_sama_cert_number", "certificate_number", unique=True),
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
        comment="Unique institutional serial number (e.g. 'CSJMU/RD/2026/V2-I1/048')",
    )
    bulletin_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_bulletins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The research bulletin issue in which the work was felicitated",
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_authors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="The felicitated author receiving this certificate",
    )
    publication_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sama_research_publications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Optional foreign key to the specific paper qualifying for this certificate",
    )
    file_storage_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
        comment="Path to certificate PDF in secure storage",
    )
    checksum_sha256: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
        comment="Cryptographic SHA-256 hash of the certificate PDF",
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
    bulletin: Mapped["ResearchBulletin"] = relationship(
        "ResearchBulletin",
        back_populates="certificates",
    )
    author: Mapped["ResearchAuthor"] = relationship(
        "ResearchAuthor",
        back_populates="certificates",
    )
    publication: Mapped[Optional["ResearchPublication"]] = relationship(
        "ResearchPublication",
        back_populates="certificates",
    )
    verification_events: Mapped[List["CertificateVerificationEvent"]] = relationship(
        "CertificateVerificationEvent",
        back_populates="certificate",
        cascade="all, delete-orphan",
        order_by="CertificateVerificationEvent.verified_at.desc()",
    )

    def __repr__(self) -> str:
        return f"<FelicitationCertificate(id={self.id}, cert_no='{self.certificate_number}')>"


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
