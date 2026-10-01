from enum import Enum
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
from app.modules.atharva_veda.nivaran.models.enums import GrievancePriority, GrievanceStatus


# ==========================================
# Taxonomy Request & Response
# ==========================================

class TaxonomySubjectItem(BaseModel):
    id: uuid.UUID
    name: str
    code: Optional[str] = None
    cluster_id: Optional[uuid.UUID] = None
    cluster_name: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


class TaxonomyCategoryItem(BaseModel):
    id: uuid.UUID
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    routing_type: str
    cluster_id: Optional[uuid.UUID] = None
    cluster_name: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}


# ==========================================
# Grievance Submission
# ==========================================

class DocumentUploadItem(BaseModel):
    file_name: str = Field(..., min_length=1, max_length=255)
    mime_type: str = Field(..., max_length=100)
    file_size: int = Field(..., gt=0)
    content_base64: Optional[str] = None
    document_type: str = "ATTACHMENT"


class GrievanceSubmitRequest(BaseModel):
    title: str = Field(..., min_length=5, max_length=255, description="Brief summary of the grievance")
    description: str = Field(..., min_length=20, description="Full factual narrative of the grievance")
    subject_id: Optional[uuid.UUID] = Field(None, description="Optional academic subject UUID")
    category_id: Optional[uuid.UUID] = Field(None, description="Optional initial category UUID")
    documents: List[DocumentUploadItem] = Field(default_factory=list)


class GrievanceOCRExtractResponse(BaseModel):
    title: str
    description: str
    confidence_note: Optional[str] = None


# ==========================================
# Grievance History & Detail Models
# ==========================================

class GrievanceStatusHistoryItem(BaseModel):
    id: uuid.UUID
    from_status: Optional[str] = None
    to_status: str
    actor_type: str
    actor_name: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentItem(BaseModel):
    id: uuid.UUID
    file_name: str
    mime_type: str
    file_size: int
    document_type: Optional[str] = None
    content_hash: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GrievanceSummaryItem(BaseModel):
    id: uuid.UUID
    grievance_id: str
    title: str
    status: str
    priority: str
    subject_id: uuid.UUID
    subject_name: str
    category_id: uuid.UUID
    category_name: str
    final_category_name: Optional[str] = None
    assigned_authority_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GrievanceDetailResponse(BaseModel):
    id: uuid.UUID
    grievance_id: str
    title: str
    description: str
    status: str
    priority: str
    subject_id: uuid.UUID
    subject_name: str
    subject_cluster_name: Optional[str] = None
    category_id: uuid.UUID
    category_name: str
    final_category_id: Optional[uuid.UUID] = None
    final_category_name: Optional[str] = None
    category_reviewed: bool = False
    category_overridden: bool = False
    category_override_reason: Optional[str] = None
    ai_suggested_category_id: Optional[uuid.UUID] = None
    ai_suggested_category_name: Optional[str] = None
    ai_confidence: Optional[float] = None
    assigned_authority_id: Optional[uuid.UUID] = None
    assigned_authority_name: Optional[str] = None
    assigned_authority_role: Optional[str] = None
    applicant_id: uuid.UUID
    applicant_name: str
    applicant_email: str
    student_registration_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    resolution_summary: Optional[str] = None
    resolved_at: Optional[datetime] = None
    history: List[GrievanceStatusHistoryItem] = Field(default_factory=list)
    documents: List[DocumentItem] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# ==========================================
# Manager Triage & Review
# ==========================================

class AIReviewDecision(str, Enum):
    CONFIRMED = "CONFIRMED"
    ACCEPTED = "ACCEPTED"
    OVERRIDDEN = "OVERRIDDEN"


class AIReviewRequest(BaseModel):
    category_id: Optional[uuid.UUID] = None
    decision: AIReviewDecision


class ManagerReviewRequest(BaseModel):
    confirm_category: bool = Field(default=True, description="Whether manager agrees with the category")
    override_category_id: Optional[uuid.UUID] = Field(default=None, description="New category if overriding")
    override_reason: Optional[str] = Field(default=None, description="Mandatory justification when overriding")
    priority: Optional[GrievancePriority] = Field(default=None, description="Optional priority adjustment")
    remarks: Optional[str] = Field(default=None, description="Triage notes or instructions for assigned authority")


class RoutingPreviewResponse(BaseModel):
    grievance_id: str
    subject_name: str
    category_name: str
    routing_type: str
    target_authority_id: uuid.UUID
    target_authority_name: str
    target_authority_role: str
    target_authority_email: str
    is_active: bool


class ManagerGrievanceQueueResponse(BaseModel):
    items: List[GrievanceSummaryItem]
    total: int
    page: int
    page_size: int
