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
from app.modules.atharva_veda.nivaran.schemas.assistant_dean import (
    ForwardingConfirmationPayload,
    DocumentRequestItemPayload,
    DocumentRequestResponseItem,
    CommitteeRequestResponseItem,
)


# ==========================================
# Associate Dean Forwarding / Escalation Request
# ==========================================

class AssociateDeanForwardRequest(BaseModel):
    """
    Associate Dean forward/escalation payload targeting Dean (Executive Tier).
    Supports either institutional justification remarks or full confirmation checklist.
    """
    reason: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=2000,
        description="Institutional reason for escalating to Dean",
    )
    justification: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=2000,
        description="Alias for institutional escalation justification",
    )
    remarks: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Additional case notes or remarks",
    )
    confirmation: Optional[ForwardingConfirmationPayload] = Field(
        default=None,
        description="Optional full 6-affirmation + 3-justification payload",
    )

    @field_validator("reason", "justification", "remarks")
    @classmethod
    def strip_strings(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                return None
        return v


# ==========================================
# Direct Resolution
# ==========================================

class AssociateDeanResolveRequest(BaseModel):
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

class AssociateDeanDocumentRequestPayload(BaseModel):
    documents: List[DocumentRequestItemPayload] = Field(..., min_length=1)
    deadline: Optional[datetime] = None


# ==========================================
# Committee Request
# ==========================================

class AssociateDeanCommitteeRequestPayload(BaseModel):
    target_authority_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional explicit authority target (e.g. Dean)",
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
            raise ValueError("Committee request justification must be at least 5 characters.")
        return v.strip()


# ==========================================
# Dashboard Statistics
# ==========================================

class AssociateDeanDashboardStatsResponse(BaseModel):
    total_assigned: int
    pending: int
    in_progress: int
    resolved: int
    escalated: int
    grievance_cluster_id: Optional[uuid.UUID] = None
    grievance_cluster_name: Optional[str] = None
