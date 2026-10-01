import uuid
from datetime import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field


# ==========================================
# 1. Applicant Feedback Schemas
# ==========================================

class GrievanceFeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Overall resolution satisfaction rating (1-5)")
    timeliness_rating: int = Field(..., ge=1, le=5, description="Timeliness of resolution rating (1-5)")
    fairness_rating: int = Field(..., ge=1, le=5, description="Fairness and transparency rating (1-5)")
    feedback_text: Optional[str] = Field(None, max_length=2000, description="Optional applicant remarks")


class GrievanceFeedbackResponse(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    rating: int
    timeliness_rating: int
    fairness_rating: int
    feedback_text: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PublicFeedbackSummaryResponse(BaseModel):
    average_rating: Optional[float] = None
    average_timeliness: Optional[float] = None
    average_fairness: Optional[float] = None
    total_feedback: int = 0


# ==========================================
# 2. Manager Closure Review Schemas
# ==========================================

class ClosureQueueItem(BaseModel):
    id: uuid.UUID
    grievance_id: str
    title: str
    priority: str
    applicant_name: str
    applicant_email: str
    registration_number: Optional[str] = None
    subject_name: str
    category_name: str
    resolved_by_name: Optional[str] = None
    resolved_by_role: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_summary: Optional[str] = None
    feedback_rating: Optional[int] = None
    feedback_timeliness: Optional[int] = None
    feedback_fairness: Optional[int] = None
    feedback_text: Optional[str] = None
    feedback_created_at: Optional[datetime] = None
    is_closure_ready: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class ClosureQueueResponse(BaseModel):
    items: List[ClosureQueueItem]
    total: int
    page: int
    page_size: int


class FinalizeClosureRequest(BaseModel):
    closure_notes: Optional[str] = Field(None, max_length=2000, description="Optional Manager final closure remarks")


class FinalizeClosureResponse(BaseModel):
    grievance_id: str
    status: str
    closed_at: datetime
    closed_by_name: str
    e_file_id: uuid.UUID
    e_file_number: str
    student_record_id: uuid.UUID
    student_record_number: str
    content_hash: str
    page_count: int


class ClosureDetailResponse(BaseModel):
    grievance: Dict[str, Any]
    applicant: Dict[str, Any]
    student_record: Optional[Dict[str, Any]] = None
    resolution: Dict[str, Any]
    feedback: Optional[Dict[str, Any]] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
    documents: List[Dict[str, Any]] = Field(default_factory=list)
    closure_eligibility: Dict[str, Any]


# ==========================================
# 3. E-File Schemas
# ==========================================

class EFileDocumentItem(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    file_name: str
    document_sha256_snapshot: str
    section_order: int

    model_config = {"from_attributes": True}


class EFileResponse(BaseModel):
    id: uuid.UUID
    e_file_number: str
    grievance_id: uuid.UUID
    grievance_ref: str
    applicant_vyasa_user_id: uuid.UUID
    applicant_name: Optional[str] = None
    student_record_id: Optional[uuid.UUID] = None
    student_record_number: Optional[str] = None
    status: str
    file_path: Optional[str] = None
    content_hash: Optional[str] = None
    page_count: int = 0
    is_sealed: bool = False
    sealed_at: Optional[datetime] = None
    sealed_by_authority_name: Optional[str] = None
    created_at: datetime
    documents: List[EFileDocumentItem] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class EFileVerificationResponse(BaseModel):
    e_file_number: str
    is_valid: bool
    calculated_hash: str
    stored_hash: str
    is_sealed: bool
    sealed_at: Optional[datetime] = None
    algorithm: str = "SHA-256"


# ==========================================
# 4. Student Master Record Schemas
# ==========================================

class SMRGrievanceItem(BaseModel):
    id: uuid.UUID
    grievance_id: str
    title: str
    status: str
    priority: str
    category_name: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    e_file_id: Optional[uuid.UUID] = None
    e_file_number: Optional[str] = None


class SMREFileItem(BaseModel):
    id: uuid.UUID
    e_file_number: str
    grievance_id: uuid.UUID
    grievance_ref: str
    status: str
    page_count: int
    content_hash: Optional[str] = None
    is_sealed: bool
    sealed_at: Optional[datetime] = None
    created_at: datetime


class StudentMasterRecordSummaryItem(BaseModel):
    id: uuid.UUID
    record_number: str
    student_vyasa_user_id: uuid.UUID
    full_name_snapshot: str
    email_snapshot: str
    mobile_snapshot: Optional[str] = None
    registration_number_snapshot: Optional[str] = None
    enrollment_number_snapshot: Optional[str] = None
    subject_id: uuid.UUID
    subject_name: str
    status: str
    total_grievances: int = 0
    open_grievances: int = 0
    resolved_grievances: int = 0
    closed_grievances: int = 0
    total_efiles: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentMasterRecordDetailResponse(BaseModel):
    id: uuid.UUID
    record_number: str
    student_vyasa_user_id: uuid.UUID
    full_name_snapshot: str
    email_snapshot: str
    mobile_snapshot: Optional[str] = None
    registration_number_snapshot: Optional[str] = None
    enrollment_number_snapshot: Optional[str] = None
    subject_id: uuid.UUID
    subject_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    grievances: List[SMRGrievanceItem] = Field(default_factory=list)
    efiles: List[SMREFileItem] = Field(default_factory=list)


class PaginatedStudentRecordsResponse(BaseModel):
    items: List[StudentMasterRecordSummaryItem]
    total: int
    page: int
    page_size: int
