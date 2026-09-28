"""Tests verifying the 40 frozen database models and live schema."""

from sqlalchemy import inspect

from app.core.database import engine
from app.models import (
    AIProcessingRecord,
    ApprovalAction,
    ApprovalRequest,
    Assignment,
    AuditLog,
    Base,
    Category,
    Cluster,
    Comment,
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
    DeanReopenReview,
    DigitalSignature,
    Document,
    DocumentRequest,
    EFile,
    EFileDocument,
    Escalation,
    ForwardingConfirmation,
    Grievance,
    GrievanceCluster,
    GrievanceCommittee,
    GrievanceFeedback,
    GrievanceNotificationOutbox,
    GrievanceStatusHistory,
    NivaranAuthority,
    SigningAuthorizationChallenge,
    SigningKeyVersion,
    StudentMasterRecord,
    Subject,
    SubjectCluster,
)
from app.models.enums import GrievancePriority, GrievanceStatus, NivaranRole


def test_metadata_table_count(expected_tables: set[str]) -> None:
    """Verify that Base.metadata contains exactly the 40 frozen tables."""
    metadata_tables = set(Base.metadata.tables.keys())
    assert len(metadata_tables) == 40, f"Expected 40 tables in Base.metadata, found {len(metadata_tables)}"
    assert metadata_tables == expected_tables, (
        f"Missing: {expected_tables - metadata_tables}, Unexpected: {metadata_tables - expected_tables}"
    )


def test_live_database_table_count(expected_tables: set[str]) -> None:
    """Verify that the live database contains all 40 frozen tables."""
    inspector = inspect(engine)
    live_tables = set(t for t in inspector.get_table_names() if t != "alembic_version")
    assert len(live_tables) == 40, f"Expected 40 live tables, found {len(live_tables)}"
    assert live_tables == expected_tables, (
        f"Missing live tables: {expected_tables - live_tables}, Extra: {live_tables - expected_tables}"
    )


def test_model_classes_registered() -> None:
    """Verify all 40 model classes inherit from Base and map to correct table names."""
    model_mapping = {
        NivaranAuthority: "nivaran_authorities",
        SubjectCluster: "subject_clusters",
        Subject: "subjects",
        GrievanceCluster: "grievance_clusters",
        Category: "categories",
        StudentMasterRecord: "student_master_records",
        Grievance: "grievances",
        GrievanceStatusHistory: "grievance_status_history",
        Comment: "comments",
        GrievanceFeedback: "grievance_feedback",
        Assignment: "assignments",
        ForwardingConfirmation: "forwarding_confirmations",
        Escalation: "escalations",
        Document: "documents",
        DocumentRequest: "document_requests",
        CommitteeCreationRequest: "committee_creation_requests",
        GrievanceCommittee: "grievance_committees",
        CommitteeMember: "committee_members",
        CommitteeMemberRecommendation: "committee_member_recommendations",
        CommitteeFinalRecommendation: "committee_final_recommendations",
        CommitteeMessage: "committee_messages",
        CommitteePoll: "committee_polls",
        CommitteePollOption: "committee_poll_options",
        CommitteePollVoter: "committee_poll_voters",
        CommitteePollVote: "committee_poll_votes",
        CommitteeDecisionRecord: "committee_decision_records",
        CommitteeMeeting: "committee_meetings",
        CommitteeMeetingParticipant: "committee_meeting_participants",
        DeanReopenReview: "dean_reopen_reviews",
        SigningKeyVersion: "signing_key_versions",
        SigningAuthorizationChallenge: "signing_authorization_challenges",
        DigitalSignature: "digital_signatures",
        EFile: "efiles",
        EFileDocument: "efile_documents",
        ApprovalRequest: "approval_requests",
        ApprovalAction: "approval_actions",
        AIProcessingRecord: "ai_processing_records",
        Cluster: "clusters",
        GrievanceNotificationOutbox: "grievance_notification_outbox",
        AuditLog: "audit_logs",
    }

    assert len(model_mapping) == 40
    for model_cls, expected_tablename in model_mapping.items():
        assert issubclass(model_cls, Base)
        assert model_cls.__tablename__ == expected_tablename


def test_forwarding_confirmation_fields() -> None:
    """Verify ForwardingConfirmation possesses all 6 required checkboxes and 3 justifications."""
    table = Base.metadata.tables["forwarding_confirmations"]
    cols = {c.name for c in table.columns}

    expected_checkboxes = {
        "reviewed_details",
        "reviewed_documents",
        "understands_status",
        "action_taken_within_authority",
        "forwarding_necessary",
        "accepts_accountability",
    }
    expected_justifications = {
        "action_taken",
        "forwarding_reason",
        "why_higher_intervention_required",
    }

    assert expected_checkboxes.issubset(cols), f"Missing checkboxes: {expected_checkboxes - cols}"
    assert expected_justifications.issubset(cols), f"Missing justifications: {expected_justifications - cols}"


def test_enums_defined() -> None:
    """Verify key domain enums contain required members."""
    # Authority roles
    assert NivaranRole.APPLICANT == "APPLICANT"
    assert NivaranRole.MANAGER == "MANAGER"
    assert NivaranRole.ASSISTANT_DEAN == "ASSISTANT_DEAN"
    assert NivaranRole.ASSOCIATE_DEAN == "ASSOCIATE_DEAN"
    assert NivaranRole.DEAN == "DEAN"
    assert NivaranRole.GUEST_MEMBER == "GUEST_MEMBER"

    # Grievance statuses
    assert GrievanceStatus.SUBMITTED == "SUBMITTED"
    assert GrievanceStatus.PENDING_REVIEW == "PENDING_REVIEW"
    assert GrievanceStatus.ASSIGNED == "ASSIGNED"
    assert GrievanceStatus.RESOLVED == "RESOLVED"

    # Grievance priorities
    assert GrievancePriority.LOW == "LOW"
    assert GrievancePriority.MEDIUM == "MEDIUM"
    assert GrievancePriority.HIGH == "HIGH"
    assert GrievancePriority.CRITICAL == "CRITICAL"
