"""atharva_documents_and_committees

Revision ID: 8b29c54e1004
Revises: 8b29c54e1003
Create Date: 2026-09-28 19:48:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1004'
down_revision: Union[str, None] = '8b29c54e1003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums idempotently
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_request_status') THEN
                CREATE TYPE document_request_status AS ENUM ('PENDING', 'UPLOADED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_request_status') THEN
                CREATE TYPE committee_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_status') THEN
                CREATE TYPE committee_status AS ENUM ('ACTIVE', 'CLOSED', 'DISSOLVED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_member_role') THEN
                CREATE TYPE committee_member_role AS ENUM ('CHAIRPERSON', 'MEMBER', 'OBSERVER');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_recommendation_type') THEN
                CREATE TYPE member_recommendation_type AS ENUM ('UPHOLD', 'PARTIALLY_UPHOLD', 'REJECT', 'REQUEST_ADDITIONAL_EVIDENCE', 'ADMINISTRATIVE_ACTION', 'POLICY_REVIEW', 'OTHER');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'final_committee_decision') THEN
                CREATE TYPE final_committee_decision AS ENUM ('UPHOLD', 'PARTIALLY_UPHOLD', 'REJECT', 'REQUEST_ADDITIONAL_EVIDENCE', 'RECOMMEND_ADMINISTRATIVE_ACTION', 'RECOMMEND_POLICY_REVIEW', 'OTHER');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'final_recommendation_status') THEN
                CREATE TYPE final_recommendation_status AS ENUM ('DRAFT', 'FINALIZED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_message_type') THEN
                CREATE TYPE committee_message_type AS ENUM ('MESSAGE', 'SYSTEM');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_voting_policy') THEN
                CREATE TYPE committee_voting_policy AS ENUM ('SIMPLE_MAJORITY', 'TWO_THIRDS', 'UNANIMOUS');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_poll_status') THEN
                CREATE TYPE committee_poll_status AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'committee_decision_status') THEN
                CREATE TYPE committee_decision_status AS ENUM ('RATIFIED', 'FAILED_QUORUM', 'FAILED_MAJORITY', 'TIE', 'REJECTED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_type') THEN
                CREATE TYPE meeting_type AS ENUM ('INTERNAL_COMMITTEE', 'APPLICANT_HEARING');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meeting_status') THEN
                CREATE TYPE meeting_status AS ENUM ('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dean_reopen_review_status') THEN
                CREATE TYPE dean_reopen_review_status AS ENUM ('AWAITING_REVIEW', 'CLARIFICATION_REQUESTED', 'CLARIFICATION_PROVIDED', 'DECIDED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dean_reopen_decision_type') THEN
                CREATE TYPE dean_reopen_decision_type AS ENUM ('UPHOLD_PREVIOUS_RESOLUTION', 'FORWARD_FOR_FRESH_RESOLUTION', 'SEND_FOR_FURTHER_ACTION', 'FURTHER_REVIEW_REQUIRED');
            END IF;
        END $$;
    """)

    doc_req_status_type = postgresql.ENUM('PENDING', 'UPLOADED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', name='document_request_status', create_type=False)
    comm_req_status_type = postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', name='committee_request_status', create_type=False)
    comm_status_type = postgresql.ENUM('ACTIVE', 'CLOSED', 'DISSOLVED', name='committee_status', create_type=False)
    comm_member_role_type = postgresql.ENUM('CHAIRPERSON', 'MEMBER', 'OBSERVER', name='committee_member_role', create_type=False)
    member_rec_type = postgresql.ENUM('UPHOLD', 'PARTIALLY_UPHOLD', 'REJECT', 'REQUEST_ADDITIONAL_EVIDENCE', 'ADMINISTRATIVE_ACTION', 'POLICY_REVIEW', 'OTHER', name='member_recommendation_type', create_type=False)
    final_comm_decision_type = postgresql.ENUM('UPHOLD', 'PARTIALLY_UPHOLD', 'REJECT', 'REQUEST_ADDITIONAL_EVIDENCE', 'RECOMMEND_ADMINISTRATIVE_ACTION', 'RECOMMEND_POLICY_REVIEW', 'OTHER', name='final_committee_decision', create_type=False)
    final_rec_status_type = postgresql.ENUM('DRAFT', 'FINALIZED', name='final_recommendation_status', create_type=False)
    comm_msg_type = postgresql.ENUM('MESSAGE', 'SYSTEM', name='committee_message_type', create_type=False)
    comm_voting_policy_type = postgresql.ENUM('SIMPLE_MAJORITY', 'TWO_THIRDS', 'UNANIMOUS', name='committee_voting_policy', create_type=False)
    comm_poll_status_type = postgresql.ENUM('OPEN', 'CLOSED', 'CANCELLED', name='committee_poll_status', create_type=False)
    comm_decision_status_type = postgresql.ENUM('RATIFIED', 'FAILED_QUORUM', 'FAILED_MAJORITY', 'TIE', 'REJECTED', name='committee_decision_status', create_type=False)
    meeting_type_type = postgresql.ENUM('INTERNAL_COMMITTEE', 'APPLICANT_HEARING', name='meeting_type', create_type=False)
    meeting_status_type = postgresql.ENUM('SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', name='meeting_status', create_type=False)
    dean_reopen_review_status_type = postgresql.ENUM('AWAITING_REVIEW', 'CLARIFICATION_REQUESTED', 'CLARIFICATION_PROVIDED', 'DECIDED', name='dean_reopen_review_status', create_type=False)
    dean_reopen_decision_type_type = postgresql.ENUM('UPHOLD_PREVIOUS_RESOLUTION', 'FORWARD_FOR_FRESH_RESOLUTION', 'SEND_FOR_FURTHER_ACTION', 'FURTHER_REVIEW_REQUIRED', name='dean_reopen_decision_type', create_type=False)

    # 2. Table: nivaran_documents
    op.create_table(
        'nivaran_documents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('uploaded_by_vyasa_user_id', sa.UUID(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size', sa.BigInteger(), nullable=False),
        sa.Column('document_type', sa.String(length=50), server_default='ATTACHMENT', nullable=True),
        sa.Column('storage_key', sa.String(length=500), nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('ocr_status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('extracted_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['uploaded_by_vyasa_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_documents_grievance_id'), 'nivaran_documents', ['grievance_id'], unique=False)
    op.create_index(op.f('ix_nivaran_documents_uploaded_by_vyasa_user_id'), 'nivaran_documents', ['uploaded_by_vyasa_user_id'], unique=False)
    op.create_index('ix_nivaran_docs_sha256', 'nivaran_documents', ['content_hash'], unique=False)

    # 3. Table: nivaran_document_requests
    op.create_table(
        'nivaran_document_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('requested_by_id', sa.UUID(), nullable=False),
        sa.Column('request_group_id', sa.UUID(), nullable=False),
        sa.Column('document_name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', doc_req_status_type, server_default='PENDING', nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_document_requests_grievance_id'), 'nivaran_document_requests', ['grievance_id'], unique=False)
    op.create_index(op.f('ix_nivaran_document_requests_requested_by_id'), 'nivaran_document_requests', ['requested_by_id'], unique=False)

    # 4. Table: nivaran_committee_creation_requests
    op.create_table(
        'nivaran_committee_creation_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('requested_by_id', sa.UUID(), nullable=False),
        sa.Column('request_status', comm_req_status_type, server_default='PENDING', nullable=False),
        sa.Column('justification', sa.Text(), nullable=False),
        sa.Column('proposed_members_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('reviewed_by_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_committee_creation_requests_grievance_id'), 'nivaran_committee_creation_requests', ['grievance_id'], unique=False)
    op.create_index(op.f('ix_nivaran_committee_creation_requests_requested_by_id'), 'nivaran_committee_creation_requests', ['requested_by_id'], unique=False)

    # 5. Table: nivaran_committees
    op.create_table(
        'nivaran_committees',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('committee_name', sa.String(length=200), nullable=False),
        sa.Column('chairperson_id', sa.UUID(), nullable=False),
        sa.Column('status', comm_status_type, server_default='ACTIVE', nullable=False),
        sa.Column('chartered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('disbanded_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['chairperson_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_committees_chairperson_id'), 'nivaran_committees', ['chairperson_id'], unique=False)
    op.create_index(op.f('ix_nivaran_committees_grievance_id'), 'nivaran_committees', ['grievance_id'], unique=False)

    # 6. Table: nivaran_committee_members
    op.create_table(
        'nivaran_committee_members',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('authority_id', sa.UUID(), nullable=False),
        sa.Column('member_role', comm_member_role_type, server_default='MEMBER', nullable=False),
        sa.Column('appointed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.ForeignKeyConstraint(['authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['committee_id'], ['nivaran_committees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('committee_id', 'authority_id', name='uq_nivaran_comm_member'),
    )
    op.create_index(op.f('ix_nivaran_committee_members_authority_id'), 'nivaran_committee_members', ['authority_id'], unique=False)
    op.create_index(op.f('ix_nivaran_committee_members_committee_id'), 'nivaran_committee_members', ['committee_id'], unique=False)

    # 7. Table: nivaran_committee_member_recommendations
    op.create_table(
        'nivaran_committee_member_recommendations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('member_id', sa.UUID(), nullable=False),
        sa.Column('recommendation_type', member_rec_type, nullable=False),
        sa.Column('findings', sa.Text(), nullable=False),
        sa.Column('recommendation_text', sa.Text(), nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['committee_id'], ['nivaran_committees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['member_id'], ['nivaran_committee_members.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('committee_id', 'member_id', name='uq_nivaran_comm_member_rec'),
    )
    op.create_index(op.f('ix_nivaran_committee_member_recommendations_committee_id'), 'nivaran_committee_member_recommendations', ['committee_id'], unique=False)
    op.create_index(op.f('ix_nivaran_committee_member_recommendations_member_id'), 'nivaran_committee_member_recommendations', ['member_id'], unique=False)

    # 8. Table: nivaran_committee_final_recommendations
    op.create_table(
        'nivaran_committee_final_recommendations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('chairperson_id', sa.UUID(), nullable=False),
        sa.Column('decision', final_comm_decision_type, nullable=False),
        sa.Column('consolidated_report', sa.Text(), nullable=False),
        sa.Column('dissent_notes', sa.Text(), nullable=True),
        sa.Column('status', final_rec_status_type, server_default='DRAFT', nullable=False),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['chairperson_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['committee_id'], ['nivaran_committees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('committee_id'),
    )

    # 9. Table: nivaran_committee_messages
    op.create_table(
        'nivaran_committee_messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('sender_authority_id', sa.UUID(), nullable=False),
        sa.Column('message_text', sa.Text(), nullable=False),
        sa.Column('message_type', comm_msg_type, server_default='MESSAGE', nullable=False),
        sa.Column('attachment_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['committee_id'], ['nivaran_committees.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_committee_messages_committee_id'), 'nivaran_committee_messages', ['committee_id'], unique=False)
    op.create_index(op.f('ix_nivaran_committee_messages_sender_authority_id'), 'nivaran_committee_messages', ['sender_authority_id'], unique=False)

    # 10. Table: nivaran_committee_polls
    op.create_table(
        'nivaran_committee_polls',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('voting_policy', comm_voting_policy_type, server_default='SIMPLE_MAJORITY', nullable=False),
        sa.Column('status', comm_poll_status_type, server_default='OPEN', nullable=False),
        sa.Column('quorum_required', sa.Integer(), server_default='2', nullable=False),
        sa.Column('launched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['committee_id'], ['nivaran_committees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_committee_polls_committee_id'), 'nivaran_committee_polls', ['committee_id'], unique=False)

    # 11. Table: nivaran_committee_poll_options
    op.create_table(
        'nivaran_committee_poll_options',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('poll_id', sa.UUID(), nullable=False),
        sa.Column('option_key', sa.String(length=64), nullable=False),
        sa.Column('option_text', sa.String(length=255), nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['poll_id'], ['nivaran_committee_polls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('poll_id', 'option_key', name='uq_nivaran_poll_opt_key'),
    )
    op.create_index(op.f('ix_nivaran_committee_poll_options_poll_id'), 'nivaran_committee_poll_options', ['poll_id'], unique=False)

    # 12. Table: nivaran_committee_poll_voters
    op.create_table(
        'nivaran_committee_poll_voters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('poll_id', sa.UUID(), nullable=False),
        sa.Column('member_id', sa.UUID(), nullable=False),
        sa.Column('has_voted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('voted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['member_id'], ['nivaran_committee_members.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['poll_id'], ['nivaran_committee_polls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('poll_id', 'member_id', name='uq_nivaran_poll_voter'),
    )
    op.create_index(op.f('ix_nivaran_committee_poll_voters_member_id'), 'nivaran_committee_poll_voters', ['member_id'], unique=False)
    op.create_index(op.f('ix_nivaran_committee_poll_voters_poll_id'), 'nivaran_committee_poll_voters', ['poll_id'], unique=False)

    # 13. Table: nivaran_committee_poll_votes
    op.create_table(
        'nivaran_committee_poll_votes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('poll_id', sa.UUID(), nullable=False),
        sa.Column('option_id', sa.UUID(), nullable=False),
        sa.Column('voter_member_id', sa.UUID(), nullable=False),
        sa.Column('vote_hash', sa.String(length=64), nullable=False),
        sa.Column('cast_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['option_id'], ['nivaran_committee_poll_options.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['poll_id'], ['nivaran_committee_polls.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['voter_member_id'], ['nivaran_committee_members.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('poll_id', 'voter_member_id', name='uq_nivaran_poll_vote_cast'),
    )
    op.create_index(op.f('ix_nivaran_committee_poll_votes_poll_id'), 'nivaran_committee_poll_votes', ['poll_id'], unique=False)

    # 14. Table: nivaran_committee_decision_records
    op.create_table(
        'nivaran_committee_decision_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('poll_id', sa.UUID(), nullable=False),
        sa.Column('winning_option_id', sa.UUID(), nullable=True),
        sa.Column('decision_status', comm_decision_status_type, nullable=False),
        sa.Column('total_eligible', sa.Integer(), nullable=False),
        sa.Column('total_votes_cast', sa.Integer(), nullable=False),
        sa.Column('certified_by_chairperson_id', sa.UUID(), nullable=False),
        sa.Column('certified_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['certified_by_chairperson_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['poll_id'], ['nivaran_committee_polls.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['winning_option_id'], ['nivaran_committee_poll_options.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('poll_id'),
    )

    # 15. Table: nivaran_committee_meetings
    op.create_table(
        'nivaran_committee_meetings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('meeting_type', meeting_type_type, server_default='INTERNAL_COMMITTEE', nullable=False),
        sa.Column('scheduled_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scheduled_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('meet_link', sa.String(length=500), nullable=True),
        sa.Column('meeting_status', meeting_status_type, server_default='SCHEDULED', nullable=False),
        sa.Column('outcome_summary', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['committee_id'], ['nivaran_committees.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_committee_meetings_committee_id'), 'nivaran_committee_meetings', ['committee_id'], unique=False)

    # 16. Table: nivaran_committee_meeting_participants
    op.create_table(
        'nivaran_committee_meeting_participants',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('meeting_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=64), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('left_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attendance_confirmed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.ForeignKeyConstraint(['meeting_id'], ['nivaran_committee_meetings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_committee_meeting_participants_meeting_id'), 'nivaran_committee_meeting_participants', ['meeting_id'], unique=False)

    # 17. Table: nivaran_dean_reopen_reviews
    op.create_table(
        'nivaran_dean_reopen_reviews',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('requested_by_user_id', sa.UUID(), nullable=False),
        sa.Column('dean_authority_id', sa.UUID(), nullable=True),
        sa.Column('status', dean_reopen_review_status_type, server_default='AWAITING_REVIEW', nullable=False),
        sa.Column('decision_type', dean_reopen_decision_type_type, nullable=True),
        sa.Column('applicant_justification', sa.Text(), nullable=False),
        sa.Column('dean_adjudication_text', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['dean_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_dean_reopen_reviews_grievance_id'), 'nivaran_dean_reopen_reviews', ['grievance_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_nivaran_dean_reopen_reviews_grievance_id'), table_name='nivaran_dean_reopen_reviews')
    op.drop_table('nivaran_dean_reopen_reviews')

    op.drop_index(op.f('ix_nivaran_committee_meeting_participants_meeting_id'), table_name='nivaran_committee_meeting_participants')
    op.drop_table('nivaran_committee_meeting_participants')

    op.drop_index(op.f('ix_nivaran_committee_meetings_committee_id'), table_name='nivaran_committee_meetings')
    op.drop_table('nivaran_committee_meetings')

    op.drop_table('nivaran_committee_decision_records')

    op.drop_index(op.f('ix_nivaran_committee_poll_votes_poll_id'), table_name='nivaran_committee_poll_votes')
    op.drop_table('nivaran_committee_poll_votes')

    op.drop_index(op.f('ix_nivaran_committee_poll_voters_poll_id'), table_name='nivaran_committee_poll_voters')
    op.drop_index(op.f('ix_nivaran_committee_poll_voters_member_id'), table_name='nivaran_committee_poll_voters')
    op.drop_table('nivaran_committee_poll_voters')

    op.drop_index(op.f('ix_nivaran_committee_poll_options_poll_id'), table_name='nivaran_committee_poll_options')
    op.drop_table('nivaran_committee_poll_options')

    op.drop_index(op.f('ix_nivaran_committee_polls_committee_id'), table_name='nivaran_committee_polls')
    op.drop_table('nivaran_committee_polls')

    op.drop_index(op.f('ix_nivaran_committee_messages_sender_authority_id'), table_name='nivaran_committee_messages')
    op.drop_index(op.f('ix_nivaran_committee_messages_committee_id'), table_name='nivaran_committee_messages')
    op.drop_table('nivaran_committee_messages')

    op.drop_table('nivaran_committee_final_recommendations')

    op.drop_index(op.f('ix_nivaran_committee_member_recommendations_member_id'), table_name='nivaran_committee_member_recommendations')
    op.drop_index(op.f('ix_nivaran_committee_member_recommendations_committee_id'), table_name='nivaran_committee_member_recommendations')
    op.drop_table('nivaran_committee_member_recommendations')

    op.drop_index(op.f('ix_nivaran_committee_members_committee_id'), table_name='nivaran_committee_members')
    op.drop_index(op.f('ix_nivaran_committee_members_authority_id'), table_name='nivaran_committee_members')
    op.drop_table('nivaran_committee_members')

    op.drop_index(op.f('ix_nivaran_committees_grievance_id'), table_name='nivaran_committees')
    op.drop_index(op.f('ix_nivaran_committees_chairperson_id'), table_name='nivaran_committees')
    op.drop_table('nivaran_committees')

    op.drop_index(op.f('ix_nivaran_committee_creation_requests_requested_by_id'), table_name='nivaran_committee_creation_requests')
    op.drop_index(op.f('ix_nivaran_committee_creation_requests_grievance_id'), table_name='nivaran_committee_creation_requests')
    op.drop_table('nivaran_committee_creation_requests')

    op.drop_index(op.f('ix_nivaran_document_requests_requested_by_id'), table_name='nivaran_document_requests')
    op.drop_index(op.f('ix_nivaran_document_requests_grievance_id'), table_name='nivaran_document_requests')
    op.drop_table('nivaran_document_requests')

    op.drop_index('ix_nivaran_docs_sha256', table_name='nivaran_documents')
    op.drop_index(op.f('ix_nivaran_documents_uploaded_by_vyasa_user_id'), table_name='nivaran_documents')
    op.drop_index(op.f('ix_nivaran_documents_grievance_id'), table_name='nivaran_documents')
    op.drop_table('nivaran_documents')

    op.execute('DROP TYPE IF EXISTS dean_reopen_decision_type')
    op.execute('DROP TYPE IF EXISTS dean_reopen_review_status')
    op.execute('DROP TYPE IF EXISTS meeting_status')
    op.execute('DROP TYPE IF EXISTS meeting_type')
    op.execute('DROP TYPE IF EXISTS committee_decision_status')
    op.execute('DROP TYPE IF EXISTS committee_poll_status')
    op.execute('DROP TYPE IF EXISTS committee_voting_policy')
    op.execute('DROP TYPE IF EXISTS committee_message_type')
    op.execute('DROP TYPE IF EXISTS final_recommendation_status')
    op.execute('DROP TYPE IF EXISTS final_committee_decision')
    op.execute('DROP TYPE IF EXISTS member_recommendation_type')
    op.execute('DROP TYPE IF EXISTS committee_member_role')
    op.execute('DROP TYPE IF EXISTS committee_status')
    op.execute('DROP TYPE IF EXISTS committee_request_status')
    op.execute('DROP TYPE IF EXISTS document_request_status')
