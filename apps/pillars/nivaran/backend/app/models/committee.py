import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import (
    CommitteeDecisionStatus,
    CommitteeMemberRole,
    CommitteeMessageType,
    CommitteePollStatus,
    CommitteeRequestStatus,
    CommitteeStatus,
    CommitteeVotingPolicy,
    FinalCommitteeDecision,
    FinalRecommendationStatus,
    MeetingOutcome,
    MeetingStatus,
    MeetingType,
    MemberRecommendationType,
)


class CommitteeCreationRequest(Base):
    __tablename__ = "committee_creation_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    requested_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    request_status: Mapped[CommitteeRequestStatus] = mapped_column(
        Enum(
            CommitteeRequestStatus,
            name="committee_request_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=CommitteeRequestStatus.PENDING,
        nullable=False,
        index=True,
    )

    reason: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    suggested_chairperson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    suggested_members_json: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    reviewed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    review_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    requested_by = relationship("NivaranAuthority", foreign_keys=[requested_by_id])
    suggested_chairperson = relationship("NivaranAuthority", foreign_keys=[suggested_chairperson_id])
    reviewed_by = relationship("NivaranAuthority", foreign_keys=[reviewed_by_id])


class GrievanceCommittee(Base):
    __tablename__ = "grievance_committees"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    chairperson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    status: Mapped[CommitteeStatus] = mapped_column(
        Enum(
            CommitteeStatus,
            name="committee_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=CommitteeStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    mandate: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    dissolved_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    dissolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    dissolution_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    chairperson = relationship("NivaranAuthority", foreign_keys=[chairperson_id])
    dissolved_by = relationship("NivaranAuthority", foreign_keys=[dissolved_by_id])
    members = relationship("CommitteeMember", back_populates="committee", cascade="all, delete-orphan")
    polls = relationship("CommitteePoll", back_populates="committee", cascade="all, delete-orphan")
    meetings = relationship("CommitteeMeeting", back_populates="committee", cascade="all, delete-orphan")


class CommitteeMember(Base):
    __tablename__ = "committee_members"
    __table_args__ = (
        UniqueConstraint(
            "committee_id",
            "authority_id",
            name="uq_committee_members_committee_authority",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievance_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    member_role: Mapped[CommitteeMemberRole] = mapped_column(
        Enum(
            CommitteeMemberRole,
            name="committee_member_role",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=CommitteeMemberRole.MEMBER,
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    removed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    removed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )

    committee = relationship("GrievanceCommittee", back_populates="members")
    authority = relationship("NivaranAuthority", foreign_keys=[authority_id])
    removed_by = relationship("NivaranAuthority", foreign_keys=[removed_by_id])


class CommitteeMemberRecommendation(Base):
    __tablename__ = "committee_member_recommendations"
    __table_args__ = (
        UniqueConstraint(
            "committee_id",
            "member_id",
            name="uq_committee_member_recs_committee_member",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievance_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    recommendation_type: Mapped[MemberRecommendationType] = mapped_column(
        Enum(
            MemberRecommendationType,
            name="member_recommendation_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    rationale: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
    member = relationship("CommitteeMember", foreign_keys=[member_id])


class CommitteeFinalRecommendation(Base):
    __tablename__ = "committee_final_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievance_committees.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    chairperson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    final_decision: Mapped[FinalCommitteeDecision] = mapped_column(
        Enum(
            FinalCommitteeDecision,
            name="final_committee_decision",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    status: Mapped[FinalRecommendationStatus] = mapped_column(
        Enum(
            FinalRecommendationStatus,
            name="final_recommendation_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=FinalRecommendationStatus.DRAFT,
        nullable=False,
    )

    executive_summary: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    detailed_findings: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    dissent_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    finalized_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
    chairperson = relationship("NivaranAuthority", foreign_keys=[chairperson_id])


class CommitteeMessage(Base):
    __tablename__ = "committee_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievance_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    sender_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    message_type: Mapped[CommitteeMessageType] = mapped_column(
        Enum(
            CommitteeMessageType,
            name="committee_message_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=CommitteeMessageType.MESSAGE,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
    sender = relationship("NivaranAuthority", foreign_keys=[sender_id])


class CommitteePoll(Base):
    __tablename__ = "committee_polls"
    __table_args__ = (
        CheckConstraint(
            "quorum_percentage BETWEEN 1 AND 100",
            name="ck_committee_polls_quorum",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievance_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    voting_policy: Mapped[CommitteeVotingPolicy] = mapped_column(
        Enum(
            CommitteeVotingPolicy,
            name="committee_voting_policy",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=CommitteeVotingPolicy.SIMPLE_MAJORITY,
        nullable=False,
    )

    quorum_percentage: Mapped[int] = mapped_column(
        Integer,
        default=50,
        nullable=False,
    )

    status: Mapped[CommitteePollStatus] = mapped_column(
        Enum(
            CommitteePollStatus,
            name="committee_poll_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=CommitteePollStatus.OPEN,
        nullable=False,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    committee = relationship("GrievanceCommittee", back_populates="polls")
    creator = relationship("NivaranAuthority", foreign_keys=[created_by_id])
    options = relationship("CommitteePollOption", back_populates="poll", cascade="all, delete-orphan")
    voters = relationship("CommitteePollVoter", back_populates="poll", cascade="all, delete-orphan")
    votes = relationship("CommitteePollVote", back_populates="poll", cascade="all, delete-orphan")
    decision_record = relationship("CommitteeDecisionRecord", back_populates="poll", uselist=False, cascade="all, delete-orphan")


class CommitteePollOption(Base):
    __tablename__ = "committee_poll_options"
    __table_args__ = (
        UniqueConstraint("poll_id", "display_order", name="uq_committee_poll_options_order"),
        UniqueConstraint("poll_id", "option_text", name="uq_committee_poll_options_text"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    option_text: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    display_order: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    poll = relationship("CommitteePoll", back_populates="options")


class CommitteePollVoter(Base):
    __tablename__ = "committee_poll_voters"
    __table_args__ = (
        UniqueConstraint("poll_id", "authority_id", name="uq_committee_poll_voters_poll_authority"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    committee_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    institutional_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    is_eligible: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    has_voted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    voted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    poll = relationship("CommitteePoll", back_populates="voters")
    committee_member = relationship("CommitteeMember", foreign_keys=[committee_member_id])
    authority = relationship("NivaranAuthority", foreign_keys=[authority_id])


class CommitteePollVote(Base):
    __tablename__ = "committee_poll_votes"
    __table_args__ = (
        UniqueConstraint("poll_id", "voter_id", name="uq_committee_poll_votes_poll_voter"),
        UniqueConstraint("poll_id", "authority_id", name="uq_committee_poll_votes_poll_authority"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    voter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_poll_voters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    selected_option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_poll_options.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    rationale: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    voted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    poll = relationship("CommitteePoll", back_populates="votes")
    voter = relationship("CommitteePollVoter", foreign_keys=[voter_id])
    authority = relationship("NivaranAuthority", foreign_keys=[authority_id])
    selected_option = relationship("CommitteePollOption", foreign_keys=[selected_option_id])


class CommitteeDecisionRecord(Base):
    __tablename__ = "committee_decision_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_polls.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    decision_status: Mapped[CommitteeDecisionStatus] = mapped_column(
        Enum(
            CommitteeDecisionStatus,
            name="committee_decision_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
    )

    total_eligible_voters: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    total_votes_cast: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    winning_option_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_poll_options.id", ondelete="SET NULL"),
        nullable=True,
    )

    certified_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    certified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    poll = relationship("CommitteePoll", back_populates="decision_record")
    winning_option = relationship("CommitteePollOption", foreign_keys=[winning_option_id])
    certified_by = relationship("NivaranAuthority", foreign_keys=[certified_by_id])


class CommitteeMeeting(Base):
    __tablename__ = "committee_meetings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("grievance_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    meeting_type: Mapped[MeetingType] = mapped_column(
        Enum(
            MeetingType,
            name="meeting_type",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    agenda: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    duration_minutes: Mapped[int] = mapped_column(
        Integer,
        default=30,
        nullable=False,
    )

    meet_url: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    calendar_event_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )

    status: Mapped[MeetingStatus] = mapped_column(
        Enum(
            MeetingStatus,
            name="meeting_status",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        default=MeetingStatus.SCHEDULED,
        nullable=False,
        index=True,
    )

    hearing_notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    decision: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    outcome: Mapped[MeetingOutcome | None] = mapped_column(
        Enum(
            MeetingOutcome,
            name="meeting_outcome",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=True,
    )

    cancellation_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    committee = relationship("GrievanceCommittee", back_populates="meetings")
    creator = relationship("NivaranAuthority", foreign_keys=[created_by_id])
    participants = relationship("CommitteeMeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")


class CommitteeMeetingParticipant(Base):
    __tablename__ = "committee_meeting_participants"
    __table_args__ = (
        UniqueConstraint(
            "meeting_id",
            "participant_vyasa_user_id",
            name="uq_committee_meeting_participants_meeting_user",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("committee_meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    participant_vyasa_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )

    participant_role: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    full_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    meeting = relationship("CommitteeMeeting", back_populates="participants")
