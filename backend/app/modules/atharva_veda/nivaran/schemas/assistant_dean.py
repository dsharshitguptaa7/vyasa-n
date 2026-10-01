import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.modules.atharva_veda.nivaran.models.enums import (
    CommitteeRequestStatus,
    DocumentRequestStatus,
    GrievancePriority,
    GrievanceStatus,
)


# ==========================================
# Forwarding Checklist & Confirmation
# ==========================================

class ForwardingConfirmationPayload(BaseModel):
    reviewed_details: bool = Field(
        ...,
        description="I have reviewed the complete grievance details.",
    )
    reviewed_documents: bool = Field(
        ...,
        description="I have reviewed the relevant documents and evidence.",
    )
    understands_status: bool = Field(
        ...,
        description="I understand the grievance and its current status.",
    )
    action_taken_within_authority: bool = Field(
        ...,
        description="I have taken the appropriate action within my authority.",
    )
    forwarding_necessary: bool = Field(
        ...,
        description="Forwarding to the next authority is necessary.",
    )
    accepts_accountability: bool = Field(
        ...,
        description="I accept accountability for forwarding this grievance.",
    )
    forwarding_reason: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Reason for forwarding",
    )
    action_taken: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Action taken at the current level",
    )
    why_higher_intervention_required: str = Field(
        ...,
        min_length=5,
        max_length=2000,
        description="Why next/higher authority intervention is required",
    )

    @field_validator("forwarding_reason", "action_taken", "why_higher_intervention_required")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        if not v or not v.strip() or len(v.strip()) < 5:
            raise ValueError("Justification fields must be at least 5 characters after trimming.")
        return v.strip()


class AssistantDeanForwardRequest(BaseModel):
    remarks: Optional[str] = Field(default=None, max_length=1000)
    confirmation: ForwardingConfirmationPayload


# ==========================================
# Direct Resolution
# ==========================================

class AssistantDeanResolveRequest(BaseModel):
    resolution_notes: str = Field(
        ...,
        min_length=3,
        max_length=4000,
        description="Detailed explanation of how the grievance was resolved",
    )

    @field_validator("resolution_notes")
    @classmethod
    def validate_resolution_notes(cls, v: str) -> str:
        if not v or not v.strip() or len(v.strip()) < 3:
            raise ValueError("Resolution notes must be at least 3 characters long.")
        return v.strip()


# ==========================================
# Document Request
# ==========================================

class DocumentRequestItemPayload(BaseModel):
    document_name: str = Field(..., min_length=2, max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)
    is_required: bool = Field(default=True)


class AssistantDeanDocumentRequestPayload(BaseModel):
    documents: List[DocumentRequestItemPayload] = Field(..., min_length=1)
    deadline: Optional[datetime] = None


class DocumentRequestResponseItem(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    request_group_id: uuid.UUID
    document_name: str
    description: Optional[str] = None
    is_required: bool = True
    status: str
    deadline: Optional[datetime] = None
    requested_by_name: Optional[str] = None
    requested_by_role: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ==========================================
# Committee Request
# ==========================================

class AssistantDeanCommitteeRequestPayload(BaseModel):
    target_authority_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional explicit higher authority target (Associate Dean or Dean)",
    )
    justification: str = Field(
        ...,
        min_length=5,
        max_length=3000,
        description="Justification for requesting committee formation",
    )
    proposed_scope: Optional[str] = Field(default=None, max_length=1000)
    supporting_remarks: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("justification")
    @classmethod
    def validate_justification(cls, v: str) -> str:
        if not v or not v.strip() or len(v.strip()) < 5:
            raise ValueError("Justification must be at least 5 characters long.")
        return v.strip()


class CommitteeRequestResponseItem(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    requested_by_id: uuid.UUID
    requested_by_name: str
    requested_by_role: str
    request_status: str
    justification: str
    reviewed_by_id: Optional[uuid.UUID] = None
    reviewed_at: Optional[datetime] = None
    review_remarks: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
