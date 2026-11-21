import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
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

    @field_validator("slug", mode="before")
    @classmethod
    def clean_slug(cls, v: Any) -> Optional[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v


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

    @field_validator("slug", mode="before")
    @classmethod
    def clean_slug(cls, v: Any) -> Optional[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            return v_stripped if v_stripped else None
        return v


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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    author_links: List[PublicationAuthorOut] = []
    volume_number: Optional[int] = None
    issue_number: Optional[int] = None
    bulletin_title: Optional[str] = None


class IssuePublicationCount(BaseModel):
    bulletin_id: Optional[uuid.UUID] = None
    volume_number: int
    issue_number: int
    title: Optional[str] = None
    publication_count: int


class PublicationListResponse(BaseModel):
    total: int
    items: List[PublicationOut]
    skip: Optional[int] = 0
    limit: Optional[int] = 50
    issue_counts: Optional[List[IssuePublicationCount]] = None


class BulkUpdatePublicationStatusRequest(BaseModel):
    publication_ids: List[uuid.UUID] = Field(..., min_length=1)
    status: str = Field(..., pattern="^(draft|in_review|published|archived)$")


class BulkUpdatePublicationStatusResult(BaseModel):
    updated_count: int
    updated_ids: List[str]
    failed_count: int
    failed_items: List[Dict[str, Any]] = []
    total_requested: int
    new_status: str


class BulkDeletePublicationsRequest(BaseModel):
    publication_ids: List[uuid.UUID] = Field(..., min_length=1)


class BulkDeleteAuthorsRequest(BaseModel):
    author_ids: List[uuid.UUID] = Field(..., min_length=1)


class BulkDeleteBatchesRequest(BaseModel):
    batch_ids: List[uuid.UUID] = Field(..., min_length=1)


class BulkDeleteResult(BaseModel):
    deleted_count: int
    deleted_ids: List[str]
    failed_count: int
    failed_items: List[Dict[str, Any]] = []
    total_requested: int


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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AuthorListResponse(BaseModel):
    total: int
    items: List[AuthorOut]
    verified_count: int = 0
    provisional_count: int = 0


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

def _normalize_cam_payload_dict(d: Dict[str, Any], is_create: bool = False) -> Dict[str, Any]:
    # 1. Title mapping
    if not d.get("title") and d.get("project_title"):
        d["title"] = d["project_title"]
    if not d.get("project_title") and d.get("title"):
        d["project_title"] = d["title"]

    # 2. Category normalization (e.g. 'major' -> 'Major', 'minor' -> 'Minor')
    cat = d.get("category")
    if isinstance(cat, str) and cat.strip():
        c_lower = cat.strip().lower()
        if c_lower == "major":
            d["category"] = "Major"
        elif c_lower == "minor":
            d["category"] = "Minor"
        elif c_lower == "special":
            d["category"] = "Special"
        else:
            d["category"] = cat.strip()

    # 3. Status normalization
    st = d.get("status")
    if isinstance(st, str) and st.strip():
        s_lower = st.strip().lower()
        if s_lower in ("in_progress", "ongoing"):
            d["status"] = "Ongoing"
        elif s_lower in ("awarded", "sanctioned"):
            d["status"] = "Sanctioned"
        elif s_lower == "completed":
            d["status"] = "Completed"
        elif s_lower == "terminated":
            d["status"] = "Terminated"

    # 4. Domain default (only on create if missing)
    if is_create and (not d.get("domain") or not str(d.get("domain")).strip()):
        d["domain"] = "General AI & Interdisciplinary Research"

    # 5. Principal investigator(s)
    pis = d.get("principal_investigators")
    pi_str = d.get("principal_investigator")
    if pis is not None or pi_str is not None:
        normalized_pis = []
        if isinstance(pis, list):
            for item in pis:
                if isinstance(item, str) and item.strip():
                    normalized_pis.append({"name": item.strip()})
                elif isinstance(item, dict):
                    name = (item.get("name") or item.get("full_name") or "").strip()
                    if name:
                        normalized_pis.append({**item, "name": name})
        elif isinstance(pis, str) and pis.strip():
            normalized_pis.append({"name": pis.strip()})

        if not normalized_pis and isinstance(pi_str, str) and pi_str.strip():
            normalized_pis.append({"name": pi_str.strip()})

        if pis is not None or normalized_pis:
            d["principal_investigators"] = normalized_pis

    # 6. Co-investigator(s)
    copis = d.get("co_investigators")
    if copis is not None:
        normalized_copis = []
        if isinstance(copis, list):
            for item in copis:
                if isinstance(item, str) and item.strip():
                    normalized_copis.append({"name": item.strip()})
                elif isinstance(item, dict):
                    name = (item.get("name") or item.get("full_name") or "").strip()
                    if name:
                        normalized_copis.append({**item, "name": name})
        elif isinstance(copis, str) and copis.strip():
            for part in copis.split(","):
                if part.strip():
                    normalized_copis.append({"name": part.strip()})

        d["co_investigators"] = normalized_copis

    # 7. Funding mapping & display
    amt = d.get("funding_amount_inr")
    if amt is None and d.get("funding_amount") is not None:
        amt = d.get("funding_amount")
        d["funding_amount_inr"] = amt

    disp = d.get("funding_display")
    if not disp and d.get("funding_amount_display"):
        disp = d.get("funding_amount_display")
        d["funding_display"] = disp

    if not disp and amt is not None:
        try:
            num = float(amt)
            d["funding_display"] = f"₹{num:,.0f}" if num == int(num) else f"₹{num:,.2f}"
        except (ValueError, TypeError):
            pass

    return d


class CamProjectCreate(BaseModel):
    legacy_project_id: Optional[int] = None
    category: str = Field(..., min_length=2, max_length=50)
    domain: str = Field("General AI & Interdisciplinary Research", min_length=2, max_length=100)
    title: str = Field(..., min_length=3)
    funding_amount_inr: Optional[Decimal] = None
    funding_display: Optional[str] = Field(None, max_length=100)
    status: str = Field("Ongoing", max_length=50)
    principal_investigators: List[Union[Dict[str, Any], str]] = Field(default_factory=list)
    co_investigators: List[Union[Dict[str, Any], str]] = Field(default_factory=list)

    # Supported frontend aliases
    project_title: Optional[str] = None
    principal_investigator: Optional[str] = None
    funding_amount: Optional[Decimal] = None
    funding_amount_display: Optional[str] = None
    sanction_year: Optional[int] = None
    deliverables_summary: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_create_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return _normalize_cam_payload_dict(dict(data), is_create=True)
        return data


class CamProjectUpdate(BaseModel):
    legacy_project_id: Optional[int] = None
    category: Optional[str] = Field(None, min_length=2, max_length=50)
    domain: Optional[str] = Field(None, min_length=2, max_length=100)
    title: Optional[str] = Field(None, min_length=3)
    funding_amount_inr: Optional[Decimal] = None
    funding_display: Optional[str] = Field(None, max_length=100)
    status: Optional[str] = Field(None, max_length=50)
    principal_investigators: Optional[List[Union[Dict[str, Any], str]]] = None
    co_investigators: Optional[List[Union[Dict[str, Any], str]]] = None

    # Supported frontend aliases
    project_title: Optional[str] = None
    principal_investigator: Optional[str] = None
    funding_amount: Optional[Decimal] = None
    funding_amount_display: Optional[str] = None
    sanction_year: Optional[int] = None
    deliverables_summary: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_update_payload(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return _normalize_cam_payload_dict(dict(data), is_create=False)
        return data


class CamProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Convenience aliases for frontend contract compatibility
    project_title: Optional[str] = None
    principal_investigator: Optional[str] = None
    funding_amount: Optional[Decimal] = None
    funding_amount_display: Optional[str] = None

    @field_validator("principal_investigators", "co_investigators", mode="before")
    @classmethod
    def ensure_list_of_dicts(cls, v: Any) -> List[Dict[str, Any]]:
        if v is None:
            return []
        if isinstance(v, str):
            parts = [s.strip() for s in v.split(",") if s.strip()]
            return [{"name": p} for p in parts]
        if isinstance(v, list):
            res = []
            for item in v:
                if isinstance(item, str) and item.strip():
                    res.append({"name": item.strip()})
                elif isinstance(item, dict):
                    name = (item.get("name") or item.get("full_name") or "").strip()
                    if name:
                        res.append({**item, "name": name})
                    else:
                        res.append(item)
            return res
        return []

    @model_validator(mode="after")
    def populate_aliases(self) -> "CamProjectOut":
        if not self.project_title:
            self.project_title = self.title
        if not self.principal_investigator and self.principal_investigators:
            first_pi = self.principal_investigators[0]
            if isinstance(first_pi, dict):
                self.principal_investigator = first_pi.get("name") or first_pi.get("full_name") or None
            elif isinstance(first_pi, str):
                self.principal_investigator = first_pi
        if self.funding_amount is None:
            self.funding_amount = self.funding_amount_inr
        if not self.funding_amount_display:
            if self.funding_display:
                self.funding_amount_display = self.funding_display
            elif self.funding_amount_inr is not None:
                try:
                    num = float(self.funding_amount_inr)
                    self.funding_amount_display = f"₹{num:,.0f}" if num == int(num) else f"₹{num:,.2f}"
                except (ValueError, TypeError):
                    self.funding_amount_display = None
        if not self.funding_display and self.funding_amount_display:
            self.funding_display = self.funding_amount_display
        return self


class CamProjectListResponse(BaseModel):
    total: int
    items: List[CamProjectOut]


# ============================================================================
# 5. FELICITATION CERTIFICATES & MODERN DIGITAL CERTIFICATE MANAGEMENT
# ============================================================================

class CertificateAuthorCreate(BaseModel):
    researcher_id: Optional[uuid.UUID] = None
    author_name_snapshot: str = Field(..., min_length=2, max_length=255)
    academic_title_snapshot: Optional[str] = Field(None, max_length=50)
    scopus_id_snapshot: Optional[str] = Field(None, max_length=50)
    affiliation_snapshot: Optional[str] = Field("Chhatrapati Shahu Ji Maharaj University, Kanpur", max_length=255)
    department_snapshot: Optional[str] = Field(None, max_length=255)
    designation_snapshot: Optional[str] = Field(None, max_length=255)
    author_order: int = Field(1, ge=1)
    author_role: str = Field("Author", max_length=50)

    @field_validator("academic_title_snapshot", mode="before")
    @classmethod
    def normalize_academic_title(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = str(v).strip()
        if not cleaned or cleaned.lower() in ("none", "null", "undefined"):
            return None
        return cleaned


class CertificateAuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    certificate_id: uuid.UUID
    researcher_id: Optional[uuid.UUID] = None
    author_name_snapshot: str
    academic_title_snapshot: Optional[str] = None
    scopus_id_snapshot: Optional[str] = None
    affiliation_snapshot: Optional[str] = None
    department_snapshot: Optional[str] = None
    designation_snapshot: Optional[str] = None
    author_order: int
    author_role: str
    created_at: datetime


class CertificateApprovalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    certificate_id: uuid.UUID
    authority_type: str
    signatory_id: Optional[uuid.UUID] = None
    signatory_name_snapshot: str
    designation_snapshot: str
    signature_image_path_snapshot: Optional[str] = None
    signature_asset_version_snapshot: Optional[int] = 1
    status: str
    remarks: Optional[str] = None
    decided_by_user_id: Optional[uuid.UUID] = None
    decided_at: Optional[datetime] = None
    created_at: datetime


class CertificateApprovalActionRequest(BaseModel):
    action: str = Field(..., description="APPROVE | REJECT")
    remarks: Optional[str] = Field(None, description="Mandatory remarks if action is REJECT")


class CertificateSignatoryCreate(BaseModel):
    authority_type: str = Field(..., description="DEAN_RD | VICE_CHANCELLOR")
    signatory_name: str = Field(..., min_length=2, max_length=255)
    designation: str = Field(..., min_length=2, max_length=255)
    department: Optional[str] = Field(None, max_length=255)
    signature_image_path: Optional[str] = Field(None, max_length=500)
    is_active: bool = True
    effective_date: Optional[datetime] = None


class CertificateSignatoryUpdate(BaseModel):
    authority_type: Optional[str] = None
    signatory_name: Optional[str] = Field(None, min_length=2, max_length=255)
    designation: Optional[str] = Field(None, min_length=2, max_length=255)
    department: Optional[str] = None
    signature_image_path: Optional[str] = None
    is_active: Optional[bool] = None
    effective_date: Optional[datetime] = None


class CertificateSignatoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    authority_type: str
    signatory_name: str
    designation: str
    department: Optional[str] = None
    signature_image_path: Optional[str] = None
    signature_asset_version: Optional[int] = 1
    is_active: Optional[bool] = True
    effective_date: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SignatoryListResponse(BaseModel):
    total: int
    items: List[CertificateSignatoryOut]


class CertificateTemplateCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    certificate_type: str = Field("RESEARCH_PUBLICATION", max_length=50)
    orientation: str = Field("LANDSCAPE", max_length=20)
    config: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    is_default: bool = False


class CertificateTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    certificate_type: Optional[str] = None
    orientation: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class CertificateTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: Optional[str] = None
    certificate_type: Optional[str] = 'RESEARCH_PUBLICATION'
    orientation: Optional[str] = 'LANDSCAPE'
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = True
    is_default: Optional[bool] = False
    version: Optional[int] = 1
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TemplateListResponse(BaseModel):
    total: int
    items: List[CertificateTemplateOut]


class CertificateIssueRequest(BaseModel):
    certificate_number: Optional[str] = Field(None, max_length=100)
    bulletin_id: Optional[uuid.UUID] = None
    author_id: Optional[uuid.UUID] = None
    publication_id: Optional[uuid.UUID] = None
    file_storage_path: Optional[str] = Field(None, max_length=500)
    checksum_sha256: Optional[str] = Field(None, max_length=64)
    # Modern Digital System attributes
    certificate_type: str = Field("RESEARCH_PUBLICATION", max_length=50)
    template_id: Optional[uuid.UUID] = None
    title: str = Field("Certificate of Appreciation & Research Excellence", max_length=255)
    presentation_statement: Optional[str] = Field("This certificate is proudly conferred upon")
    research_contribution_statement: Optional[str] = Field("in recognition of meritorious scholarly contribution published in the research article titled:")
    research_title: Optional[str] = None
    congratulatory_statement: Optional[str] = Field("The university commends the exemplary commitment to advancing research frontiers and intellectual pursuit.")
    publication_details: Optional[Dict[str, Any]] = None
    issue_date: Optional[date] = Field(None, description="Official scheduled date of issuance (YYYY-MM-DD). Defaults to today in Asia/Kolkata.")
    authors: Optional[List[CertificateAuthorCreate]] = None
    submit_for_approval: bool = False
    direct_issue_justification: Optional[str] = Field(
        None,
        max_length=1000,
        description="Mandatory institutional justification for exceptional direct issuance bypassing dual approval",
    )
    verification_token: Optional[str] = Field(None, max_length=64, description="Optional manual verification identifier override")
    verification_identifier: Optional[str] = Field(None, description="Optional manual verification identifier or pasted verification URL")

    @model_validator(mode="before")
    @classmethod
    def resolve_verification_identifier(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_ident = data.get("verification_identifier") or data.get("verification_token")
            if raw_ident is not None:
                ident_str = str(raw_ident).strip()
                if not ident_str:
                    data["verification_token"] = None
                    data["verification_identifier"] = None
                else:
                    if "://" in ident_str or ident_str.startswith("/"):
                        url_pattern = r'^(?:https?://[^/]+)?(?:/api)?(?:/modules/sama-veda)?/(?:certificates/)?verify/([a-zA-Z0-9_\-]+)/?$'
                        m = re.match(url_pattern, ident_str, re.IGNORECASE)
                        if m:
                            ident_str = m.group(1).strip()
                        else:
                            raise ValueError(
                                "Invalid verification URL format. Pasted URL must match the application's verification route: /verify/{identifier}."
                            )
                    data["verification_token"] = ident_str
                    data["verification_identifier"] = ident_str
        return data


class CertificateRevokeRequest(BaseModel):
    revocation_reason: str = Field(
        ...,
        min_length=5,
        description="Official institutional justification or audit rationale for revocation",
    )


class CertificateReissueRequest(BaseModel):
    reissue_reason: str = Field(..., min_length=5, description="Institutional reason for superseding previous certificate")
    updated_title: Optional[str] = None
    updated_authors: Optional[List[CertificateAuthorCreate]] = None
    updated_research_title: Optional[str] = None
    updated_publication_details: Optional[Dict[str, Any]] = None


class CertificateRescheduleRequest(BaseModel):
    scheduled_issue_date: date = Field(..., description="New scheduled Date of Issue (YYYY-MM-DD)")


class CertificateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    certificate_number: str
    record_type: Optional[str] = "active"
    certificate_type: Optional[str] = "RESEARCH_PUBLICATION"
    status: Optional[str] = "ISSUED"
    template_id: Optional[uuid.UUID] = None
    template_version: Optional[int] = 1
    title: Optional[str] = "Certificate of Appreciation & Research Excellence"
    presentation_statement: Optional[str] = None
    research_contribution_statement: Optional[str] = None
    research_title: Optional[str] = None
    congratulatory_statement: Optional[str] = None
    publication_details: Optional[Dict[str, Any]] = None
    verification_token: Optional[str] = None
    verification_url: Optional[str] = None
    bulletin_id: Optional[uuid.UUID] = None
    bulletin_volume_snapshot: Optional[int] = None
    bulletin_issue_snapshot: Optional[int] = None
    bulletin_period_snapshot: Optional[str] = None
    author_id: Optional[uuid.UUID] = None
    publication_id: Optional[uuid.UUID] = None
    file_storage_path: Optional[str] = None
    checksum_sha256: Optional[str] = None
    download_count: Optional[int] = 0
    scheduled_issue_date: Optional[date] = None
    activated_at: Optional[datetime] = None
    is_scheduled: Optional[bool] = False
    time_until_activation_seconds: Optional[int] = None
    issued_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    is_revoked: Optional[bool] = False
    revoked_at: Optional[datetime] = None
    revocation_reason: Optional[str] = None
    rejection_reason: Optional[str] = None
    reissued_from_id: Optional[uuid.UUID] = None
    reissued_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    authors: List[CertificateAuthorOut] = []
    approvals: List[CertificateApprovalOut] = []
    is_legacy: Optional[bool] = False
    recovery_source: Optional[str] = None
    issue_reference: Optional[str] = None
    sanction_amount: Optional[str] = None
    has_legacy_collision: Optional[bool] = False
    legacy_collision_info: Optional[Dict[str, Any]] = None


class CertificateListResponse(BaseModel):
    total: int
    items: List[CertificateOut]


class CertificateStatsOut(BaseModel):
    total_certificates: int
    total_issued: Optional[int] = None
    draft_certificates: int
    pending_approvals: int
    scheduled_certificates: int = 0
    issued_certificates: int
    revoked_certificates: int
    reissued_certificates: int
    total_researchers_linked: int
    historical_certificates: Optional[int] = 0


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
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class SpotlightListResponse(BaseModel):
    total: int
    items: List[SpotlightOut]


# ============================================================================
# 7. RESEARCHER CERTIFICATE DISCOVERY & OTP VERIFICATION
# ============================================================================

class DiscoveredCertificateItem(BaseModel):
    id: str
    certificate_number: str
    title: str
    certificate_type: str
    category: str  # RESEARCH_WORK | INCENTIVE
    publication_title: Optional[str] = None
    issue_date: Optional[str] = None
    issued_at: Optional[str] = None
    status: str
    is_revoked: bool
    revocation_reason: Optional[str] = None
    reissued_reason: Optional[str] = None
    verification_token: str
    verification_url: str
    is_download_allowed: bool
    download_url: str


class ResearcherDiscoveryAuthorOut(BaseModel):
    id: str
    full_name: str
    department: Optional[str] = None
    institutional_affiliation: Optional[str] = None
    scopus_id: Optional[str] = None


class IncentiveSummaryOut(BaseModel):
    total_applications: int
    approved_count: int
    pdf_certificates_available: bool
    message: str


class ResearcherDiscoveryData(BaseModel):
    researcher: ResearcherDiscoveryAuthorOut
    research_certificates: List[DiscoveredCertificateItem]
    incentive_certificates: List[DiscoveredCertificateItem]
    anudaan_incentives: IncentiveSummaryOut


class ResearcherOtpSendRequest(BaseModel):
    scopus_id: str = Field(..., min_length=1, max_length=50)


class ResearcherOtpVerifyRequest(BaseModel):
    scopus_id: str = Field(..., min_length=1, max_length=50)
    otp: str = Field(..., min_length=4, max_length=10)


# ============================================================================
# 8. CMS BULK CERTIFICATE OPERATIONS (DELETION & VERIFICATION)
# ============================================================================

class BulkDeleteCertificatesRequest(BaseModel):
    certificate_ids: List[uuid.UUID] = Field(..., min_length=1, max_length=500)
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory institutional reason for certificate deletion")


class SingleDeleteCertificateRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory institutional reason for certificate deletion")


class BulkDeleteFailureItem(BaseModel):
    id: str
    reason: str


class BulkDeleteCertificatesResponse(BaseModel):
    operation_id: str
    total_requested: int
    deleted_count: int
    failed_count: int
    deleted_ids: List[str]
    failed_items: List[BulkDeleteFailureItem]
    audit_logged: bool = True


class BulkVerifyCertificatesRequest(BaseModel):
    certificate_numbers: Optional[List[str]] = Field(None, max_length=250)
    raw_text: Optional[str] = Field(None, max_length=50000, description="Raw newline or comma-separated certificate numbers or CSV text")


class CertificateVerificationItem(BaseModel):
    input_text: str
    certificate_number: Optional[str] = None
    status: str  # VALID / ISSUED | SCHEDULED | REVOKED | SUPERSEDED | NOT FOUND | INVALID
    is_valid: bool = False
    is_scheduled: bool = False
    is_revoked: bool = False
    is_superseded: bool = False
    is_duplicate: bool = False
    error_message: Optional[str] = None
    certificate_id: Optional[str] = None
    title: Optional[str] = None
    certificate_type: Optional[str] = None
    recipient_name: Optional[str] = None
    research_title: Optional[str] = None
    issue_date: Optional[str] = None
    scheduled_issue_date: Optional[str] = None
    revocation_reason: Optional[str] = None
    revoked_at: Optional[str] = None
    replacement_certificate_number: Optional[str] = None
    verification_token: Optional[str] = None
    sha256_checksum: Optional[str] = None


class BulkVerifyCertificatesResponse(BaseModel):
    total_submitted: int
    valid_count: int
    scheduled_count: int
    revoked_count: int
    superseded_count: int
    not_found_count: int
    invalid_count: int
    duplicate_count: int
    results: List[CertificateVerificationItem]



# ============================================================================
# 8. BULK CERTIFICATE GENERATION & DUAL-AUTHORITY WORKFLOW SCHEMAS
# ============================================================================

class BulkBulletinMetadata(BaseModel):
    volume: Optional[int] = None
    issue: Optional[int] = None
    period: Optional[str] = None


class BulkCertificateUploadBatchMetadata(BaseModel):
    batch_name: str = Field(..., min_length=2, max_length=255)
    certificate_type: str = Field("RESEARCH_PUBLICATION", pattern="^(RESEARCH_PUBLICATION|INCENTIVE_AWARD)$")
    issue_date: date
    bulletin: Optional[BulkBulletinMetadata] = None


class BulkResearcherInput(BaseModel):
    researcher_id: Optional[uuid.UUID] = None
    scopus_id: Optional[str] = None
    full_name: str = Field(..., min_length=1)
    department: Optional[str] = None
    institutional_affiliation: Optional[str] = None


class BulkAuthorInput(BaseModel):
    researcher: BulkResearcherInput
    certificate_title: Optional[str] = None  # Explicit snapshot title e.g. "Dr.", "Prof." or None (NEVER copied from profile)
    author_role: Optional[str] = None
    is_corresponding: Optional[bool] = None


class BulkCertificateItemInput(BaseModel):
    item_id: Optional[str] = None
    research_title: str = Field(..., min_length=3)
    authors: List[BulkAuthorInput] = Field(..., min_length=1)
    research_contribution_statement: Optional[str] = None
    publication_details: Optional[Dict[str, Any]] = None
    incentive_details: Optional[Dict[str, Any]] = None
    certificate_number: Optional[str] = Field(None, max_length=100)
    verification_token: Optional[str] = Field(None, max_length=64)
    verification_identifier: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def resolve_bulk_item_identifiers(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_ident = data.get("verification_identifier") or data.get("verification_token")
            if raw_ident is not None:
                ident_str = str(raw_ident).strip()
                if not ident_str:
                    data["verification_token"] = None
                    data["verification_identifier"] = None
                else:
                    if "://" in ident_str or ident_str.startswith("/"):
                        url_pattern = r'^(?:https?://[^/]+)?(?:/api)?(?:/modules/sama-veda)?/(?:certificates/)?verify/([a-zA-Z0-9_\-]+)/?$'
                        m = re.match(url_pattern, ident_str, re.IGNORECASE)
                        if m:
                            ident_str = m.group(1).strip()
                        else:
                            raise ValueError(
                                "Invalid verification URL format. Pasted URL must match the application's verification route: /verify/{identifier}."
                            )
                    data["verification_token"] = ident_str
                    data["verification_identifier"] = ident_str
        return data


class BulkCertificateUploadPayload(BaseModel):
    batch: BulkCertificateUploadBatchMetadata
    certificates: List[BulkCertificateItemInput] = Field(..., min_length=1)


class AuthorCandidate(BaseModel):
    id: str
    full_name: str
    scopus_id: Optional[str] = None
    department: Optional[str] = None
    institutional_affiliation: Optional[str] = None
    is_verified: bool = False
    match_score: Optional[float] = None


class AuthorMatchItem(BaseModel):
    input_full_name: str
    input_scopus_id: Optional[str] = None
    input_department: Optional[str] = None
    certificate_title: Optional[str] = None
    author_role: Optional[str] = None
    status: str  # MATCHED | AMBIGUOUS | NOT_FOUND
    matched_author_id: Optional[str] = None
    matched_author_name: Optional[str] = None
    matched_by: Optional[str] = None  # UUID | SCOPUS_ID | NORMALIZED_NAME
    candidates: List[AuthorCandidate] = []


class BulkCertificatePreviewItem(BaseModel):
    index: int
    research_title: str
    certificate_type: str
    issue_date: str
    is_valid: bool
    validation_errors: List[str] = []
    authors: List[AuthorMatchItem]
    publication_details: Optional[Dict[str, Any]] = None
    incentive_details: Optional[Dict[str, Any]] = None


class BulkCertificatePreviewResponse(BaseModel):
    batch: BulkCertificateUploadBatchMetadata
    total_certificates: int
    valid_certificates_count: int
    invalid_certificates_count: int
    total_authors: int
    matched_authors_count: int
    ambiguous_authors_count: int
    not_found_authors_count: int
    certificates: List[BulkCertificatePreviewItem]


class AuthorResolutionMapping(BaseModel):
    author_index: int
    resolved_author_id: Optional[uuid.UUID] = None
    certificate_title: Optional[str] = None


class CertificateResolutionMapping(BaseModel):
    certificate_index: int
    authors: Optional[List[AuthorResolutionMapping]] = None


class BulkCertificateGenerateRequest(BaseModel):
    batch: BulkCertificateUploadBatchMetadata
    certificates: List[BulkCertificateItemInput]
    resolutions: Optional[List[CertificateResolutionMapping]] = None


class BulkCertificateGenerateResultItem(BaseModel):
    index: int
    certificate_id: str
    certificate_number: str
    research_title: str
    status: str
    authors_count: int


class BulkCertificateGenerateResponse(BaseModel):
    batch_id: str
    batch_name: str
    certificate_type: str
    total_requested: int
    created_count: int
    failed_count: int
    created_certificates: List[BulkCertificateGenerateResultItem]
    failed_items: List[Dict[str, Any]] = []


class BulkSubmitDeanRequest(BaseModel):
    certificate_ids: List[uuid.UUID] = Field(..., min_length=1)


class BulkForwardVCRequest(BaseModel):
    certificate_ids: List[uuid.UUID] = Field(..., min_length=1)


class BulkApprovalActionRequest(BaseModel):
    certificate_ids: List[uuid.UUID] = Field(..., min_length=1)
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    remarks: Optional[str] = None


class BulkApprovalResultItem(BaseModel):
    certificate_id: str
    certificate_number: str
    previous_status: str
    new_status: str
    authority: str
    action: str
    success: bool
    error: Optional[str] = None


class BulkApprovalResponse(BaseModel):
    operation_id: str
    authority: str
    action: str
    total_requested: int
    success_count: int
    failure_count: int
    results: List[BulkApprovalResultItem]


class BatchSummaryItem(BaseModel):
    batch_id: str
    batch_name: str
    certificate_type: str
    created_at: str
    total_certificates: int
    pending_dean_count: int
    pending_vc_count: int
    issued_count: int
    scheduled_count: int
    rejected_count: int
    archived_count: int


class BatchListResponse(BaseModel):
    total: int
    items: List[BatchSummaryItem]


class BatchDetailResponse(BaseModel):
    batch_id: str
    batch_name: str
    certificate_type: str
    created_at: str
    total_certificates: int
    status_counts: Dict[str, int]
    certificates: List[Dict[str, Any]]


# ============================================================================
# 9. CERTIFICATE RESTORATION & ARCHIVED LEDGER SCHEMAS
# ============================================================================

class SingleRestoreCertificateRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory institutional reason for restoring certificate")


class BulkRestoreCertificatesRequest(BaseModel):
    certificate_ids: List[uuid.UUID] = Field(..., min_length=1, max_length=500)
    reason: str = Field(..., min_length=3, max_length=500, description="Mandatory institutional reason for restoring certificates")


class BulkRestoreFailureItem(BaseModel):
    id: str
    reason: str


class BulkRestoreResultItem(BaseModel):
    id: str
    certificate_number: str
    restored_to_status: str


class BulkRestoreCertificatesResponse(BaseModel):
    operation_id: str
    total_requested: int
    restored_count: int
    failed_count: int
    restored_items: List[BulkRestoreResultItem]
    failed_items: List[BulkRestoreFailureItem]
    audit_logged: bool = True


class ArchivedCertificateItem(BaseModel):
    id: uuid.UUID
    certificate_number: str
    title: str
    certificate_type: str
    research_title: Optional[str] = None
    primary_recipient: Optional[str] = None
    previous_status: str
    archived_at: Optional[str] = None
    archived_by_user_id: Optional[str] = None
    archival_reason: Optional[str] = None
    is_revoked: bool = False
    verification_token: Optional[str] = None


class ArchivedCertificateListResponse(BaseModel):
    total: int
    items: List[ArchivedCertificateItem]


# ============================================================================
# 10. RESEARCH INTELLIGENCE & ANALYTICS SCHEMAS
# ============================================================================

class CategoryDistributionItem(BaseModel):
    name: str
    count: int
    percentage: float


class YearlyTrendItem(BaseModel):
    year: str
    count: int


class ResearcherVerificationBreakdown(BaseModel):
    total_researchers: int
    verified_faculty: int
    provisional_scholars: int


class BulletinVolumeAnalyticsItem(BaseModel):
    id: str
    volume_number: int
    issue_number: int
    label: str
    title: str
    period: str
    actual_publication_count: int
    archival_count: int
    file_size_bytes: int


class IndexingMetrics(BaseModel):
    doi_indexed: int
    direct_peer_reviewed: int


class AnalyticsSummary(BaseModel):
    total_publications: int
    total_researchers: int
    verified_faculty: int
    provisional_scholars: int
    total_bulletins: int
    cam_grants: int
    active_fellows: int


class AnalyticsReconciliation(BaseModel):
    total_publications: int
    category_sum: int
    yearly_sum: int
    bulletin_actual_sum: int
    categories_reconciled: bool
    bulletins_reconciled: bool


class OverviewAnalyticsResponse(BaseModel):
    summary: AnalyticsSummary
    category_distribution: List[CategoryDistributionItem]
    yearly_trends: List[YearlyTrendItem]
    researcher_breakdown: ResearcherVerificationBreakdown
    bulletin_volumes: List[BulletinVolumeAnalyticsItem]
    indexing_metrics: IndexingMetrics
    reconciliation: AnalyticsReconciliation
    generated_at: str

