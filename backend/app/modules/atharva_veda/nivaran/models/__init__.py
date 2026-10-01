"""
Atharva Veda (NIVARAN-AI) Unified Domain Models
Exports all 38 approved domain models under the 'nivaran_*' database namespace.
"""
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    CategoryRoutingType,
    GrievanceStatus,
    GrievancePriority,
    HistoryActorType,
    EscalationRole,
    DocumentRequestStatus,
    CommitteeRequestStatus,
    CommitteeStatus,
    CommitteeMemberRole,
    MemberRecommendationType,
    FinalCommitteeDecision,
    FinalRecommendationStatus,
    CommitteeMessageType,
    CommitteeVotingPolicy,
    CommitteePollStatus,
    CommitteeDecisionStatus,
    MeetingType,
    MeetingStatus,
    MeetingOutcome,
    DeanReopenReviewStatus,
    DeanReopenDecisionType,
    SigningKeyStatus,
    DigitalSignatureEntityType,
    EFileStatus,
    ApprovalRequestStatus,
    ApprovalActionType,
    AIProcessingStatus,
    StudentRecordStatus,
)

from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    SubjectCluster,
    Subject,
    GrievanceCluster,
    Category,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    StudentMasterRecord,
    Grievance,
    GrievanceStatusHistory,
    Comment,
    GrievanceFeedback,
)
from app.modules.atharva_veda.nivaran.models.routing import (
    Assignment,
    ForwardingConfirmation,
    Escalation,
)
from app.modules.atharva_veda.nivaran.models.document import (
    Document,
    DocumentRequest,
)
from app.modules.atharva_veda.nivaran.models.committee import (
    CommitteeCreationRequest,
    GrievanceCommittee,
    CommitteeMember,
    CommitteeMemberRecommendation,
    CommitteeFinalRecommendation,
    CommitteeMessage,
    CommitteePoll,
    CommitteePollOption,
    CommitteePollVoter,
    CommitteePollVote,
    CommitteeDecisionRecord,
    CommitteeMeeting,
    CommitteeMeetingParticipant,
)
from app.modules.atharva_veda.nivaran.models.dean_reopen import DeanReopenReview
from app.modules.atharva_veda.nivaran.models.signature import (
    SigningKeyVersion,
    SigningAuthorizationChallenge,
    DigitalSignature,
)
from app.modules.atharva_veda.nivaran.models.efile import (
    EFile,
    EFileDocument,
)
from app.modules.atharva_veda.nivaran.models.approval import (
    ApprovalRequest,
    ApprovalAction,
)
from app.modules.atharva_veda.nivaran.models.ai_processing import (
    AIProcessingRecord,
    Cluster,
)

__all__ = [
    # Enums
    "NivaranRole",
    "CategoryRoutingType",
    "GrievanceStatus",
    "GrievancePriority",
    "HistoryActorType",
    "EscalationRole",
    "DocumentRequestStatus",
    "CommitteeRequestStatus",
    "CommitteeStatus",
    "CommitteeMemberRole",
    "MemberRecommendationType",
    "FinalCommitteeDecision",
    "FinalRecommendationStatus",
    "CommitteeMessageType",
    "CommitteeVotingPolicy",
    "CommitteePollStatus",
    "CommitteeDecisionStatus",
    "MeetingType",
    "MeetingStatus",
    "MeetingOutcome",
    "DeanReopenReviewStatus",
    "DeanReopenDecisionType",
    "SigningKeyStatus",
    "DigitalSignatureEntityType",
    "EFileStatus",
    "ApprovalRequestStatus",
    "ApprovalActionType",
    "AIProcessingStatus",
    "StudentRecordStatus",
    # 38 Atharva Veda Domain Tables
    "NivaranAuthority",
    "SubjectCluster",
    "Subject",
    "GrievanceCluster",
    "Category",
    "StudentMasterRecord",
    "Grievance",
    "GrievanceStatusHistory",
    "Comment",
    "GrievanceFeedback",
    "Assignment",
    "ForwardingConfirmation",
    "Escalation",
    "Document",
    "DocumentRequest",
    "CommitteeCreationRequest",
    "GrievanceCommittee",
    "CommitteeMember",
    "CommitteeMemberRecommendation",
    "CommitteeFinalRecommendation",
    "CommitteeMessage",
    "CommitteePoll",
    "CommitteePollOption",
    "CommitteePollVoter",
    "CommitteePollVote",
    "CommitteeDecisionRecord",
    "CommitteeMeeting",
    "CommitteeMeetingParticipant",
    "DeanReopenReview",
    "SigningKeyVersion",
    "SigningAuthorizationChallenge",
    "DigitalSignature",
    "EFile",
    "EFileDocument",
    "ApprovalRequest",
    "ApprovalAction",
    "AIProcessingRecord",
    "Cluster",
]
