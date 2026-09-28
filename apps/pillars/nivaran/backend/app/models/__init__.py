from app.models.base import Base
from app.models.enums import (
    AIProcessingStatus,
    ApprovalActionType,
    ApprovalRequestStatus,
    CategoryRoutingType,
    CommitteeDecisionStatus,
    CommitteeMemberRole,
    CommitteeMessageType,
    CommitteePollStatus,
    CommitteeRequestStatus,
    CommitteeStatus,
    CommitteeVotingPolicy,
    DeanReopenDecisionType,
    DeanReopenReviewStatus,
    DigitalSignatureEntityType,
    DocumentRequestStatus,
    EFileStatus,
    EscalationRole,
    FinalCommitteeDecision,
    FinalRecommendationStatus,
    GrievancePriority,
    GrievanceStatus,
    HistoryActorType,
    MeetingOutcome,
    MeetingStatus,
    MeetingType,
    MemberRecommendationType,
    NivaranRole,
    OutboxStatus,
    SigningKeyStatus,
    StudentRecordStatus,
)

# 1. Authority
from app.models.authority import NivaranAuthority

# 2. Taxonomy
from app.models.taxonomy import (
    Category,
    GrievanceCluster,
    Subject,
    SubjectCluster,
)

# 3. Case Management
from app.models.grievance import (
    Comment,
    Grievance,
    GrievanceFeedback,
    GrievanceStatusHistory,
    StudentMasterRecord,
)

# 4. Routing & Forwarding
from app.models.routing import (
    Assignment,
    Escalation,
    ForwardingConfirmation,
)

# 5. Documents
from app.models.document import (
    Document,
    DocumentRequest,
)

# 6. Committee Deliberation & Voting (13 models)
from app.models.committee import (
    CommitteeCreationRequest,
    CommitteeDecisionRecord,
    CommitteeFinalRecommendation,
    CommitteeMeeting,
    CommitteeMeetingParticipant,
    CommitteeMember,
    CommitteeMemberRecommendation,
    CommitteeMessage,
    CommitteePoll,
    CommitteePollOption,
    CommitteePollVoter,
    CommitteePollVote,
    GrievanceCommittee,
)

# 7. Dispute Arbitration
from app.models.dean_reopen import DeanReopenReview

# 8. Cryptographic Signatures
from app.models.signature import (
    DigitalSignature,
    SigningAuthorizationChallenge,
    SigningKeyVersion,
)

# 9. E-Files
from app.models.efile import (
    EFile,
    EFileDocument,
)

# 10. Approvals
from app.models.approval import (
    ApprovalAction,
    ApprovalRequest,
)

# 11. AI Processing & Semantic Clusters
from app.models.ai_processing import (
    AIProcessingRecord,
    Cluster,
)

# 12. Notification Outbox
from app.models.outbox import GrievanceNotificationOutbox

# 13. Audit Trail
from app.models.audit import AuditLog

__all__ = [
    # Base
    "Base",
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
    "OutboxStatus",
    "StudentRecordStatus",
    # 40 Tables / Models
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
    "GrievanceNotificationOutbox",
    "AuditLog",
    "Cluster",
]
