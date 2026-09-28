"""Grievance schemas for filing and applicant-scoped retrieval."""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import GrievancePriority, GrievanceStatus
from app.schemas.document import ApplicantDocumentResponse, InitialDocumentAttachment


class GrievanceSubmissionRequest(BaseModel):
    """Submission payload for an applicant creating a new grievance."""

    title: str = Field(..., min_length=3, max_length=255, description="Brief summary of the grievance")
    description: str = Field(..., min_length=10, description="Detailed statement of facts and relief sought")
    subject_id: uuid.UUID = Field(..., description="ID of the academic subject from taxonomy")
    priority: Optional[GrievancePriority] = Field(
        default=GrievancePriority.MEDIUM,
        description="Applicant suggested priority",
    )
    documents: Optional[List[InitialDocumentAttachment]] = Field(
        default=None,
        description="Optional initial evidentiary attachments",
    )


class ApplicantStatusHistoryResponse(BaseModel):
    """Safe lifecycle history entry visible to the applicant."""

    model_config = ConfigDict(from_attributes=True)

    new_status: GrievanceStatus
    remarks: Optional[str]
    changed_at: datetime


class ApplicantGrievanceResponse(BaseModel):
    """
    Applicant-safe view of a grievance.
    Strictly excludes internal comments, authority IDs, AI confidence, and audit data.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    grievance_id: str
    title: str
    description: str
    subject_id: Optional[uuid.UUID]
    subject_name: Optional[str] = None
    subject_cluster_name: Optional[str] = None
    status: GrievanceStatus
    priority: GrievancePriority
    submitted_at: datetime
    last_action_at: datetime
    documents: List[ApplicantDocumentResponse] = []
    status_history: List[ApplicantStatusHistoryResponse] = []


class ApplicantGrievanceListResponse(BaseModel):
    """Paginated or listed response for applicant's own grievances."""

    total: int
    items: List[ApplicantGrievanceResponse]


class GrievanceOCRExtractResponse(BaseModel):
    """Stateless OCR extraction response for applicant form pre-fill."""

    title: str = Field(..., description="Concise grievance title extracted by Gemini")
    description: str = Field(..., description="Detailed grievance description extracted by Gemini")
