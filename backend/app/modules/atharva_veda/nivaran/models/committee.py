import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base
from app.modules.atharva_veda.nivaran.models.enums import (
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
    __tablename__ = "nivaran_committee_creation_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
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
        Enum(CommitteeRequestStatus, name="committee_request_status"),
        default=CommitteeRequestStatus.PENDING,
        nullable=False,
    )
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    proposed_members_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    reviewed_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
    )
    target_authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    requested_by = relationship("NivaranAuthority", foreign_keys=[requested_by_id])
    reviewed_by = relationship("NivaranAuthority", foreign_keys=[reviewed_by_id])
    target_authority = relationship("NivaranAuthority", foreign_keys=[target_authority_id])
    committee = relationship("GrievanceCommittee", back_populates="creation_request", uselist=False)


class GrievanceCommittee(Base):
    __tablename__ = "nivaran_committees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    creation_request_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_creation_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    committee_name: Mapped[str] = mapped_column(String(200), nullable=False)
    terms_of_reference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    chairperson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[CommitteeStatus] = mapped_column(
        Enum(CommitteeStatus, name="committee_status"),
        default=CommitteeStatus.ACTIVE,
        nullable=False,
    )
    chartered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    disbanded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    dissolution_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dissolved_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    grievance = relationship("Grievance", foreign_keys=[grievance_id])
    chairperson = relationship("NivaranAuthority", foreign_keys=[chairperson_id])
    dissolved_by = relationship("NivaranAuthority", foreign_keys=[dissolved_by_id])
    creation_request = relationship("CommitteeCreationRequest", foreign_keys=[creation_request_id], back_populates="committee")
    members = relationship("CommitteeMember", back_populates="committee", cascade="all, delete-orphan")
    messages = relationship("CommitteeMessage", back_populates="committee", cascade="all, delete-orphan")
    polls = relationship("CommitteePoll", back_populates="committee", cascade="all, delete-orphan")
    meetings = relationship("CommitteeMeeting", back_populates="committee", cascade="all, delete-orphan")
    formal_decisions = relationship("CommitteeFormalDecision", back_populates="committee", cascade="all, delete-orphan")


class CommitteeMember(Base):
    __tablename__ = "nivaran_committee_members"
    __table_args__ = (
        UniqueConstraint("committee_id", "authority_id", name="uq_nivaran_comm_member"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
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
        Enum(CommitteeMemberRole, name="committee_member_role"),
        default=CommitteeMemberRole.MEMBER,
        nullable=False,
    )
    appointed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    committee = relationship("GrievanceCommittee", back_populates="members")
    authority = relationship("NivaranAuthority", foreign_keys=[authority_id])


class CommitteeMemberRecommendation(Base):
    __tablename__ = "nivaran_committee_member_recommendations"
    __table_args__ = (
        UniqueConstraint("committee_id", "member_id", name="uq_nivaran_comm_member_rec"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recommendation_type: Mapped[MemberRecommendationType] = mapped_column(
        Enum(MemberRecommendationType, name="member_recommendation_type"),
        nullable=False,
    )
    findings: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation_text: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
    member = relationship("CommitteeMember", foreign_keys=[member_id])


class CommitteeFinalRecommendation(Base):
    __tablename__ = "nivaran_committee_final_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    chairperson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    decision: Mapped[FinalCommitteeDecision] = mapped_column(
        Enum(FinalCommitteeDecision, name="final_committee_decision"),
        nullable=False,
    )
    consolidated_report: Mapped[str] = mapped_column(Text, nullable=False)
    dissent_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[FinalRecommendationStatus] = mapped_column(
        Enum(FinalRecommendationStatus, name="final_recommendation_status"),
        default=FinalRecommendationStatus.DRAFT,
        nullable=False,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
    chairperson = relationship("NivaranAuthority", foreign_keys=[chairperson_id])


class CommitteeMessage(Base):
    __tablename__ = "nivaran_committee_messages"
    __table_args__ = (
        Index("ix_nivaran_comm_msg_comm_created", "committee_id", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sender_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[CommitteeMessageType] = mapped_column(
        Enum(CommitteeMessageType, name="committee_message_type"),
        default=CommitteeMessageType.MESSAGE,
        nullable=False,
    )
    attachment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", back_populates="messages")
    sender = relationship("NivaranAuthority", foreign_keys=[sender_authority_id])


class CommitteePoll(Base):
    __tablename__ = "nivaran_committee_polls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    voting_policy: Mapped[CommitteeVotingPolicy] = mapped_column(
        Enum(CommitteeVotingPolicy, name="committee_voting_policy"),
        default=CommitteeVotingPolicy.SIMPLE_MAJORITY,
        nullable=False,
    )
    status: Mapped[CommitteePollStatus] = mapped_column(
        Enum(CommitteePollStatus, name="committee_poll_status"),
        default=CommitteePollStatus.OPEN,
        nullable=False,
    )
    quorum_required: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    closing_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    results_visibility: Mapped[str] = mapped_column(String(50), default="ALWAYS_VISIBLE", nullable=False)
    launched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    committee = relationship("GrievanceCommittee", back_populates="polls")
    options = relationship("CommitteePollOption", back_populates="poll", cascade="all, delete-orphan")
    votes = relationship("CommitteePollVote", foreign_keys="CommitteePollVote.poll_id", cascade="all, delete-orphan")
    voters = relationship("CommitteePollVoter", back_populates="poll", cascade="all, delete-orphan")
    decision_record = relationship("CommitteeDecisionRecord", foreign_keys="CommitteeDecisionRecord.poll_id", back_populates="poll", uselist=False, cascade="all, delete-orphan")


class CommitteePollOption(Base):
    __tablename__ = "nivaran_committee_poll_options"
    __table_args__ = (
        UniqueConstraint("poll_id", "option_key", name="uq_nivaran_poll_opt_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    option_key: Mapped[str] = mapped_column(String(64), nullable=False)
    option_text: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    poll = relationship("CommitteePoll", back_populates="options")


class CommitteePollVoter(Base):
    __tablename__ = "nivaran_committee_poll_voters"
    __table_args__ = (
        UniqueConstraint("poll_id", "member_id", name="uq_nivaran_poll_voter"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_members.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    has_voted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    voted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    poll = relationship("CommitteePoll", back_populates="voters")
    member = relationship("CommitteeMember", foreign_keys=[member_id])


class CommitteePollVote(Base):
    __tablename__ = "nivaran_committee_poll_votes"
    __table_args__ = (
        UniqueConstraint("poll_id", "voter_member_id", name="uq_nivaran_poll_vote_cast"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_polls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    option_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_poll_options.id", ondelete="CASCADE"),
        nullable=False,
    )
    voter_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_members.id", ondelete="CASCADE"),
        nullable=False,
    )
    vote_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    cast_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )


class CommitteeDecisionRecord(Base):
    __tablename__ = "nivaran_committee_decision_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    poll_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_polls.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    winning_option_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_poll_options.id", ondelete="SET NULL"),
        nullable=True,
    )
    decision_status: Mapped[CommitteeDecisionStatus] = mapped_column(
        Enum(CommitteeDecisionStatus, name="committee_decision_status"),
        nullable=False,
    )
    total_eligible: Mapped[int] = mapped_column(Integer, nullable=False)
    total_votes_cast: Mapped[int] = mapped_column(Integer, nullable=False)
    certified_by_chairperson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
    )
    certified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    poll = relationship("CommitteePoll", foreign_keys=[poll_id], back_populates="decision_record")
    winning_option = relationship("CommitteePollOption", foreign_keys=[winning_option_id])
    certified_by = relationship("NivaranAuthority", foreign_keys=[certified_by_chairperson_id])


class CommitteeMeeting(Base):
    __tablename__ = "nivaran_committee_meetings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), default="Committee Meeting", nullable=False)
    agenda: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    meeting_type: Mapped[MeetingType] = mapped_column(
        Enum(MeetingType, name="meeting_type"),
        default=MeetingType.INTERNAL_COMMITTEE,
        nullable=False,
    )
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    meet_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    meeting_status: Mapped[MeetingStatus] = mapped_column(
        Enum(MeetingStatus, name="meeting_status"),
        default=MeetingStatus.SCHEDULED,
        nullable=False,
    )
    outcome_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", back_populates="meetings")
    participants = relationship("CommitteeMeetingParticipant", back_populates="meeting", cascade="all, delete-orphan")


class CommitteeMeetingParticipant(Base):
    __tablename__ = "nivaran_committee_meeting_participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Participant Core identity",
    )
    authority_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="SET NULL"),
        nullable=True,
    )
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attendance_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    meeting = relationship("CommitteeMeeting", back_populates="participants")
    user = relationship("User", foreign_keys=[user_id])
    authority = relationship("NivaranAuthority", foreign_keys=[authority_id])


class CommitteeFormalDecision(Base):
    __tablename__ = "nivaran_committee_formal_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    decision_type: Mapped[str] = mapped_column(
        String(50),
        default="FORMAL_DECISION",
        nullable=False,
        comment="DRAFT_DECISION, FORMAL_DECISION, MEETING_MINUTES, FINAL_ORDER",
    )
    outcome: Mapped[str] = mapped_column(
        String(100),
        default="APPROVED",
        nullable=False,
        comment="APPROVED, REJECTED, ACTION_RECOMMENDED, POLICY_REVIEW, INCONCLUSIVE",
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    meeting_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_meetings.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    poll_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committee_polls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    participating_members_snapshot: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    supporting_document_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    recorded_by_authority_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_authorities.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    is_final_institutional_order: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    institutional_order_ref: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", back_populates="formal_decisions")
    recorded_by = relationship("NivaranAuthority", foreign_keys=[recorded_by_authority_id])
    meeting = relationship("CommitteeMeeting", foreign_keys=[meeting_id])
    poll = relationship("CommitteePoll", foreign_keys=[poll_id])
