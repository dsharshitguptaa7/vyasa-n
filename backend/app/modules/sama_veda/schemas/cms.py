import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


# ============================================================================
# 1. RESEARCH PUBLICATIONS
# ============================================================================

class PublicationAuthorLinkInput(BaseModel):
    author_id: uuid.UUID
    author_order: int = 1
    is_corresponding: bool = False


class PublicationAuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    author_id: uuid.UUID
    author_name: Optional[str] = None
    author_order: int
    is_corresponding: bool
    department: Optional[str] = None


class PublicationCreate(BaseModel):
    bulletin_id: uuid.UUID
    serial_no: int = Field(..., ge=1)
    slug: str = Field(..., min_length=2, max_length=100)
    title: str = Field(..., min_length=3)
    source_journal: str = Field(..., min_length=2, max_length=500)
    category: str = Field(..., min_length=2, max_length=100)
    doi: Optional[str] = Field(None, max_length=255)
    author_display: str = Field(..., min_length=2)
    authors_complete: bool = True
    status: str = Field("draft", pattern="^(draft|in_review|published|archived)$")
    abstract: Optional[str] = None
    external_url: Optional[str] = Field(None, max_length=500)
    is_featured: bool = False
    author_links: Optional[List[PublicationAuthorLinkInput]] = None


class PublicationUpdate(BaseModel):
    bulletin_id: Optional[uuid.UUID] = None
    serial_no: Optional[int] = Field(None, ge=1)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    title: Optional[str] = Field(None, min_length=3)
    source_journal: Optional[str] = Field(None, min_length=2, max_length=500)
    category: Optional[str] = Field(None, min_length=2, max_length=100)
    doi: Optional[str] = Field(None, max_length=255)
    author_display: Optional[str] = Field(None, min_length=2)
    authors_complete: Optional[bool] = None
    status: Optional[str] = Field(None, pattern="^(draft|in_review|published|archived)$")
    abstract: Optional[str] = None
    external_url: Optional[str] = Field(None, max_length=500)
    is_featured: Optional[bool] = None
    author_links: Optional[List[PublicationAuthorLinkInput]] = None


class PublicationStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|in_review|published|archived)$")


class PublicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    bulletin_id: uuid.UUID
    serial_no: int
    slug: str
    title: str
    source_journal: str
    category: str
    doi: Optional[str] = None
    author_display: str
    authors_complete: bool
    status: str
    abstract: Optional[str] = None
    external_url: Optional[str] = None
    is_featured: bool
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    author_links: List[PublicationAuthorOut] = []


class PublicationListResponse(BaseModel):
    total: int
    items: List[PublicationOut]
    skip: Optional[int] = 0
    limit: Optional[int] = 50


# ============================================================================
# 2. RESEARCH AUTHORS
# ============================================================================

class AuthorCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    scopus_id: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=255)
    institutional_affiliation: str = Field(
        "Chhatrapati Shahu Ji Maharaj University, Kanpur",
        max_length=255,
    )
    user_id: Optional[uuid.UUID] = None
    is_verified: bool = False
    verification_notes: Optional[str] = None


class AuthorUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    scopus_id: Optional[str] = Field(None, max_length=50)
    department: Optional[str] = Field(None, max_length=255)
    institutional_affiliation: Optional[str] = Field(None, max_length=255)
    user_id: Optional[uuid.UUID] = None
    is_verified: Optional[bool] = None
    verification_notes: Optional[str] = None


class AuthorVerificationUpdate(BaseModel):
    is_verified: bool
    scopus_id: Optional[str] = Field(None, max_length=50)
    verification_notes: Optional[str] = None


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    scopus_id: Optional[str] = None
    department: Optional[str] = None
    institutional_affiliation: str
    user_id: Optional[uuid.UUID] = None
    is_verified: bool
    verification_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AuthorListResponse(BaseModel):
    total: int
    items: List[AuthorOut]


# ============================================================================
# 3. RESEARCH BULLETINS
# ============================================================================

class BulletinCreate(BaseModel):
    volume_number: int = Field(..., ge=1)
    issue_number: int = Field(..., ge=1)
    title: str = Field(..., min_length=3, max_length=255)
    publication_period: str = Field(..., min_length=2, max_length=100)
    file_path: str = Field(..., min_length=1, max_length=500)
    file_size_bytes: int = Field(0, ge=0)
    checksum_sha256: Optional[str] = Field(None, max_length=64)
    publication_count: int = Field(0, ge=0)
    is_active: bool = True
    status: str = Field("draft", pattern="^(draft|in_review|published|archived)$")


class BulletinUpdate(BaseModel):
    volume_number: Optional[int] = Field(None, ge=1)
    issue_number: Optional[int] = Field(None, ge=1)
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    publication_period: Optional[str] = Field(None, min_length=2, max_length=100)
    file_path: Optional[str] = Field(None, min_length=1, max_length=500)
    file_size_bytes: Optional[int] = Field(None, ge=0)
    checksum_sha256: Optional[str] = Field(None, max_length=64)
    publication_count: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    status: Optional[str] = Field(None, pattern="^(draft|in_review|published|archived)$")


class BulletinStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(draft|in_review|published|archived)$")
    is_active: Optional[bool] = None


class BulletinOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    volume_number: int
    issue_number: int
    title: str
    publication_period: str
    file_path: str
    file_size_bytes: int = 0
    checksum_sha256: Optional[str] = None
    publication_count: int = 0
    is_active: bool = True
    status: str = "published"
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    created_at: datetime

    @field_validator("publication_count", "file_size_bytes", mode="before")
    @classmethod
    def default_if_none_int(cls, v):
        return 0 if v is None else v


class BulletinListResponse(BaseModel):
    total: int
    items: List[BulletinOut]


# ============================================================================
# 4. CAM-AI PROJECTS
# ============================================================================

class CamProjectCreate(BaseModel):
    legacy_project_id: Optional[int] = None
    category: str = Field(..., min_length=2, max_length=50)
    domain: str = Field(..., min_length=2, max_length=100)
    title: str = Field(..., min_length=5)
    funding_amount_inr: Optional[Decimal] = None
    funding_display: Optional[str] = Field(None, max_length=100)
    status: str = Field("Ongoing", max_length=50)
    principal_investigators: List[Dict[str, Any]] = Field(default_factory=list)
    co_investigators: List[Dict[str, Any]] = Field(default_factory=list)


class CamProjectUpdate(BaseModel):
    legacy_project_id: Optional[int] = None
    category: Optional[str] = Field(None, min_length=2, max_length=50)
    domain: Optional[str] = Field(None, min_length=2, max_length=100)
    title: Optional[str] = Field(None, min_length=5)
    funding_amount_inr: Optional[Decimal] = None
    funding_display: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)
    principal_investigators: Optional[List[Dict[str, Any]]] = None
    co_investigators: Optional[List[Dict[str, Any]]] = None


class CamProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    legacy_project_id: Optional[int] = None
    category: Optional[str] = None
    domain: Optional[str] = None
    title: str
    funding_amount_inr: Optional[Decimal] = None
    funding_display: Optional[str] = None
    status: str = "Ongoing"
    principal_investigators: List[Dict[str, Any]] = Field(default_factory=list)
    co_investigators: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @field_validator("principal_investigators", "co_investigators", mode="before")
    @classmethod
    def ensure_list(cls, v):
        return [] if v is None else v


class CamProjectListResponse(BaseModel):
    total: int
    items: List[CamProjectOut]


# ============================================================================
# 5. FELICITATION CERTIFICATES
# ============================================================================

class CertificateIssueRequest(BaseModel):
    certificate_number: str = Field(..., min_length=3, max_length=100)
    bulletin_id: uuid.UUID
    author_id: uuid.UUID
    publication_id: Optional[uuid.UUID] = None
    file_storage_path: str = Field(..., min_length=1, max_length=500)
    checksum_sha256: Optional[str] = Field(None, max_length=64)


class CertificateRevokeRequest(BaseModel):
    revocation_reason: str = Field(
        ...,
        min_length=5,
        description="Official institutional justification or audit rationale for revocation",
    )


class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    certificate_number: str
    bulletin_id: uuid.UUID
    author_id: uuid.UUID
    publication_id: Optional[uuid.UUID] = None
    file_storage_path: str
    checksum_sha256: Optional[str] = None
    download_count: int
    issued_at: datetime
    is_revoked: bool
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None
    created_at: datetime


class CertificateListResponse(BaseModel):
    total: int
    items: List[CertificateOut]


# ============================================================================
# 6. RESEARCHER SPOTLIGHTS
# ============================================================================

class SpotlightCreate(BaseModel):
    author_id: Optional[uuid.UUID] = None
    headline: str = Field(..., min_length=3, max_length=255)
    summary: str = Field(..., min_length=10)
    media_type: str = Field("photo", pattern="^(photo|video|interview)$")
    media_url: str = Field(..., min_length=1, max_length=500)
    video_embed_url: Optional[str] = Field(None, max_length=500)
    display_order: int = 0
    is_active: bool = True


class SpotlightUpdate(BaseModel):
    author_id: Optional[uuid.UUID] = None
    headline: Optional[str] = Field(None, min_length=3, max_length=255)
    summary: Optional[str] = Field(None, min_length=10)
    media_type: Optional[str] = Field(None, pattern="^(photo|video|interview)$")
    media_url: Optional[str] = Field(None, min_length=1, max_length=500)
    video_embed_url: Optional[str] = Field(None, max_length=500)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class SpotlightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: Optional[uuid.UUID] = None
    headline: str
    summary: Optional[str] = None
    media_type: str = "photo"
    media_url: Optional[str] = None
    video_embed_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime


class SpotlightListResponse(BaseModel):
    total: int
    items: List[SpotlightOut]
