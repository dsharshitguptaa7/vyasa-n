import uuid
from datetime import datetime
from typing import Optional, List
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


class GrievanceCommittee(Base):
    __tablename__ = "nivaran_committees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_grievances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    committee_name: Mapped[str] = mapped_column(String(200), nullable=False)
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
    members = relationship("CommitteeMember", back_populates="committee")


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

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
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
    launched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])
    options = relationship("CommitteePollOption", back_populates="poll", cascade="all, delete-orphan")


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

    poll = relationship("CommitteePoll", foreign_keys=[poll_id])
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


class CommitteeMeeting(Base):
    __tablename__ = "nivaran_committee_meetings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    committee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nivaran_committees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    committee = relationship("GrievanceCommittee", foreign_keys=[committee_id])


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
    role: Mapped[str] = mapped_column(String(64), nullable=False)
    joined_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attendance_confirmed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    meeting = relationship("CommitteeMeeting", foreign_keys=[meeting_id])
    user = relationship("User", foreign_keys=[user_id])
