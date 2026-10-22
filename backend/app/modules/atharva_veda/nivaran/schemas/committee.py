from datetime import datetime
import enum
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field, field_validator

from app.modules.atharva_veda.nivaran.models.enums import (
    CommitteeMemberRole,
    CommitteeRequestStatus,
    CommitteeStatus,
)


class CommitteeRequestReviewAction(str, enum.Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    REQUEST_CLARIFICATION = "REQUEST_CLARIFICATION"


class CommitteeRequestReviewPayload(BaseModel):
    action: CommitteeRequestReviewAction = Field(
        ...,
        description="Review action: APPROVE, REJECT, or REQUEST_CLARIFICATION",
    )
    remarks: Optional[str] = Field(
        default=None,
        max_length=2000,
        description="Reason or clarification request remarks",
    )

    @field_validator("remarks")
    @classmethod
    def validate_remarks_on_reject_or_clarify(cls, v: Optional[str], info) -> Optional[str]:
        action = info.data.get("action")
        if action in (CommitteeRequestReviewAction.REJECT, CommitteeRequestReviewAction.REQUEST_CLARIFICATION):
            if not v or not v.strip():
                raise ValueError(f"Remarks are required when action is {action.value}.")
        return v.strip() if v else None


class CommitteeMemberCreateItem(BaseModel):
    authority_id: uuid.UUID = Field(..., description="UUID of appointed Nivaran authority")
    member_role: CommitteeMemberRole = Field(
        default=CommitteeMemberRole.MEMBER,
        description="Role: CHAIRPERSON, MEMBER, OBSERVER",
    )


class CommitteeDirectCreatePayload(BaseModel):
    grievance_id: uuid.UUID = Field(..., description="UUID of associated grievance")
    committee_name: str = Field(..., min_length=3, max_length=200, description="Formal title of the committee")
    terms_of_reference: Optional[str] = Field(
        default=None,
        max_length=5000,
        description="Charter scope and terms of reference",
    )
    chairperson_id: uuid.UUID = Field(..., description="UUID of appointed chairperson authority")
    members: List[CommitteeMemberCreateItem] = Field(..., min_length=1, description="List of appointed members")
    creation_request_id: Optional[uuid.UUID] = Field(
        default=None,
        description="Optional ID of approved creation request linked to this committee",
    )

    @field_validator("committee_name")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Committee title cannot be blank.")
        return v.strip()


class CommitteeMemberResponseItem(BaseModel):
    id: uuid.UUID
    authority_id: uuid.UUID
    authority_name: str
    authority_role: str
    authority_designation: Optional[str] = None
    member_role: str
    appointed_at: datetime
    is_active: bool


class CommitteeResponseItem(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    grievance_tracking_id: Optional[str] = None
    grievance_title: Optional[str] = None
    committee_name: str
    terms_of_reference: Optional[str] = None
    chairperson_id: uuid.UUID
    chairperson_name: str
    chairperson_role: Optional[str] = None
    status: str
    creation_request_id: Optional[uuid.UUID] = None
    chartered_at: datetime
    disbanded_at: Optional[datetime] = None
    dissolution_reason: Optional[str] = None
    dissolved_by_id: Optional[uuid.UUID] = None
    dissolved_by_name: Optional[str] = None
    members_count: int = 0
    messages_count: int = 0
    polls_count: int = 0
    meetings_count: int = 0
    documents_count: int = 0
    decisions_count: int = 0
    members: List[CommitteeMemberResponseItem] = []


class CommitteeRequestDetailedResponseItem(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    grievance_tracking_id: Optional[str] = None
    requested_by_id: uuid.UUID
    requested_by_name: str
    requested_by_role: str
    target_authority_id: Optional[uuid.UUID] = None
    target_authority_name: Optional[str] = None
    target_authority_role: Optional[str] = None
    request_status: str
    justification: str
    proposed_members_snapshot: Optional[dict] = None
    reviewed_by_id: Optional[uuid.UUID] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_remarks: Optional[str] = None
    created_at: datetime
    committee_id: Optional[uuid.UUID] = None


class CommitteeOverviewMetricsResponse(BaseModel):
    total_committees: int
    active_committees: int
    dissolved_committees: int
    pending_requests: int
    pending_polls_for_user: int
    upcoming_meetings: int


class CommitteeDissolvePayload(BaseModel):
    reason: str = Field(..., min_length=3, max_length=1000, description="Reason for formal committee dissolution")


# Chat Schemas
class CommitteeMessageCreatePayload(BaseModel):
    message_text: str = Field(..., min_length=1, max_length=5000, description="Chat message body")
    message_type: str = Field(default="MESSAGE", description="MESSAGE or SYSTEM")
    attachment_url: Optional[str] = Field(default=None, max_length=500)


class CommitteeMessageResponseItem(BaseModel):
    id: uuid.UUID
    committee_id: uuid.UUID
    sender_authority_id: uuid.UUID
    sender_name: str
    sender_role: str
    sender_designation: Optional[str] = None
    message_text: str
    message_type: str
    attachment_url: Optional[str] = None
    created_at: datetime


# Polling & Voting Schemas
class CommitteePollCreatePayload(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Poll question or title")
    description: str = Field(..., max_length=2000, description="Context or explanation")
    voting_policy: str = Field(
        default="SIMPLE_MAJORITY",
        description="SIMPLE_MAJORITY, TWO_THIRDS, UNANIMOUS",
    )
    quorum_required: int = Field(default=2, ge=1, description="Minimum participants required for validity")
    closing_time: Optional[datetime] = Field(default=None, description="Automatic closing timestamp")
    results_visibility: str = Field(
        default="ALWAYS_VISIBLE",
        description="ALWAYS_VISIBLE, AFTER_VOTE, AFTER_CLOSE",
    )
    options: List[str] = Field(..., min_length=2, max_length=10, description="List of voting options")


class CommitteePollOptionResponseItem(BaseModel):
    id: uuid.UUID
    option_key: str
    option_text: str
    display_order: int
    vote_count: int = 0
    vote_percentage: float = 0.0


class CommitteePollVotePayload(BaseModel):
    option_id: uuid.UUID = Field(..., description="ID of chosen poll option")


class CommitteePollResponseItem(BaseModel):
    id: uuid.UUID
    committee_id: uuid.UUID
    title: str
    description: str
    voting_policy: str
    status: str
    quorum_required: int
    closing_time: Optional[datetime] = None
    results_visibility: str
    launched_at: datetime
    closed_at: Optional[datetime] = None
    options: List[CommitteePollOptionResponseItem]
    total_eligible: int
    total_votes: int
    quorum_reached: bool
    user_has_voted: bool
    user_voted_option_id: Optional[uuid.UUID] = None
    winning_option_id: Optional[uuid.UUID] = None
    winning_option_text: Optional[str] = None
    decision_status: Optional[str] = None


# Meetings & Google Meet Schemas
class CommitteeMeetingCreatePayload(BaseModel):
    title: str = Field(default="Committee Meeting", min_length=3, max_length=255)
    agenda: Optional[str] = Field(default=None, max_length=3000)
    meeting_type: str = Field(default="INTERNAL_COMMITTEE")
    scheduled_start: datetime
    scheduled_end: datetime
    notes: Optional[str] = Field(default=None, max_length=3000)
    participant_authority_ids: List[uuid.UUID] = Field(default_factory=list)
    external_meet_link: Optional[str] = Field(default=None, max_length=500)


class CommitteeMeetingUpdatePayload(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    agenda: Optional[str] = Field(default=None, max_length=3000)
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    meet_link: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=3000)
    outcome_summary: Optional[str] = Field(default=None, max_length=3000)
    meeting_status: Optional[str] = None


class CommitteeMeetingParticipantItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    authority_id: Optional[uuid.UUID] = None
    name: str
    role: str
    attendance_confirmed: bool


class CommitteeMeetingResponseItem(BaseModel):
    id: uuid.UUID
    committee_id: uuid.UUID
    title: str
    agenda: Optional[str] = None
    meeting_type: str
    scheduled_start: datetime
    scheduled_end: datetime
    meet_link: Optional[str] = None
    meeting_status: str
    outcome_summary: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    participants: List[CommitteeMeetingParticipantItem] = []


# Documents & Evidence Schemas
class CommitteeDocumentResponseItem(BaseModel):
    id: uuid.UUID
    grievance_id: uuid.UUID
    file_name: str
    file_path: str
    mime_type: str
    file_size: int
    document_type: str
    content_hash: Optional[str] = None
    uploaded_by_name: str
    created_at: datetime


class CommitteeDocumentUploadPayload(BaseModel):
    file_name: str
    mime_type: str
    file_size: int
    document_type: str = "COMMITTEE_EVIDENCE"
    content_base64: str


# Decisions & Minutes Schemas
class CommitteeFormalDecisionCreatePayload(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    decision_type: str = Field(
        default="FORMAL_DECISION",
        description="DRAFT_DECISION, FORMAL_DECISION, MEETING_MINUTES, FINAL_ORDER",
    )
    outcome: str = Field(
        default="APPROVED",
        description="APPROVED, REJECTED, ACTION_RECOMMENDED, POLICY_REVIEW, INCONCLUSIVE",
    )
    summary: str = Field(..., min_length=10, max_length=5000)
    meeting_id: Optional[uuid.UUID] = None
    poll_id: Optional[uuid.UUID] = None
    supporting_document_url: Optional[str] = None
    is_final_institutional_order: bool = False
    institutional_order_ref: Optional[str] = None


class CommitteeFormalDecisionResponseItem(BaseModel):
    id: uuid.UUID
    committee_id: uuid.UUID
    title: str
    decision_type: str
    outcome: str
    summary: str
    meeting_id: Optional[uuid.UUID] = None
    poll_id: Optional[uuid.UUID] = None
    participating_members_snapshot: Optional[dict] = None
    supporting_document_url: Optional[str] = None
    recorded_by_authority_id: uuid.UUID
    recorded_by_name: str
    recorded_by_role: str
    recorded_at: datetime
    is_final_institutional_order: bool
    institutional_order_ref: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# Detailed Workspace Response
class CommitteeWorkspaceDetailResponse(BaseModel):
    committee: CommitteeResponseItem
    user_role_in_committee: Optional[str] = None
    can_manage: bool = False
    can_vote: bool = False
    recent_messages: List[CommitteeMessageResponseItem] = []
    active_polls: List[CommitteePollResponseItem] = []
    upcoming_meetings: List[CommitteeMeetingResponseItem] = []
    recent_documents: List[CommitteeDocumentResponseItem] = []
    recent_decisions: List[CommitteeFormalDecisionResponseItem] = []
