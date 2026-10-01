"""atharva_case_core

Revision ID: 8b29c54e1003
Revises: 8b29c54e1002
Create Date: 2026-09-28 19:45:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1003'
down_revision: Union[str, None] = '8b29c54e1002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums idempotently
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_record_status') THEN
                CREATE TYPE student_record_status AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grievance_status') THEN
                CREATE TYPE grievance_status AS ENUM (
                    'SUBMITTED', 'AI_PROCESSING', 'PENDING_REVIEW', 'ASSIGNED',
                    'IN_PROGRESS', 'AWAITING_INFORMATION', 'ESCALATED', 'RESOLVED',
                    'CLOSED', 'REOPENED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grievance_priority') THEN
                CREATE TYPE grievance_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'history_actor_type') THEN
                CREATE TYPE history_actor_type AS ENUM ('USER', 'SYSTEM');
            END IF;
        END $$;
    """)

    student_record_status_type = postgresql.ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED', name='student_record_status', create_type=False)
    grievance_status_type = postgresql.ENUM(
        'SUBMITTED', 'AI_PROCESSING', 'PENDING_REVIEW', 'ASSIGNED', 'IN_PROGRESS',
        'AWAITING_INFORMATION', 'ESCALATED', 'RESOLVED', 'CLOSED', 'REOPENED',
        name='grievance_status', create_type=False,
    )
    grievance_priority_type = postgresql.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='grievance_priority', create_type=False)
    history_actor_type = postgresql.ENUM('USER', 'SYSTEM', name='history_actor_type', create_type=False)

    # 2. Table: nivaran_student_master_records
    op.create_table(
        'nivaran_student_master_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('student_vyasa_user_id', sa.UUID(), nullable=False),
        sa.Column('record_number', sa.String(length=64), nullable=False),
        sa.Column('registration_number_snapshot', sa.String(length=100), nullable=True),
        sa.Column('enrollment_number_snapshot', sa.String(length=100), nullable=True),
        sa.Column('full_name_snapshot', sa.String(length=150), nullable=False),
        sa.Column('email_snapshot', sa.String(length=255), nullable=False),
        sa.Column('mobile_snapshot', sa.String(length=20), nullable=True),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('status', student_record_status_type, server_default='ACTIVE', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['student_vyasa_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['subject_id'], ['nivaran_subjects.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_student_master_records_student_vyasa_user_id'), 'nivaran_student_master_records', ['student_vyasa_user_id'], unique=False)
    op.create_index(op.f('ix_nivaran_student_master_records_record_number'), 'nivaran_student_master_records', ['record_number'], unique=True)
    op.create_index(op.f('ix_nivaran_student_master_records_registration_number_snapshot'), 'nivaran_student_master_records', ['registration_number_snapshot'], unique=False)
    op.create_index(op.f('ix_nivaran_student_master_records_enrollment_number_snapshot'), 'nivaran_student_master_records', ['enrollment_number_snapshot'], unique=False)

    # 3. Table: nivaran_grievances
    op.create_table(
        'nivaran_grievances',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.String(length=30), nullable=False),
        sa.Column('applicant_vyasa_user_id', sa.UUID(), nullable=False),
        sa.Column('student_record_id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('category_id', sa.UUID(), nullable=False),
        sa.Column('final_category_id', sa.UUID(), nullable=True),
        sa.Column('status', grievance_status_type, server_default='SUBMITTED', nullable=False),
        sa.Column('priority', grievance_priority_type, server_default='MEDIUM', nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('assigned_authority_id', sa.UUID(), nullable=True),
        sa.Column('resolved_by_authority_id', sa.UUID(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_summary', sa.Text(), nullable=True),
        sa.Column('closed_by_authority_id', sa.UUID(), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reopen_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('previous_cycle_status', sa.String(length=32), nullable=True),
        sa.Column('previous_resolution_summary', sa.Text(), nullable=True),
        sa.Column('previous_resolved_by_id', sa.UUID(), nullable=True),
        sa.Column('previous_resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('previous_closed_by_id', sa.UUID(), nullable=True),
        sa.Column('previous_closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('category_reviewed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('category_overridden', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('category_override_reason', sa.Text(), nullable=True),
        sa.Column('ai_suggested_category_id', sa.UUID(), nullable=True),
        sa.Column('ai_confidence', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ai_suggested_category_id'], ['nivaran_categories.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['applicant_vyasa_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['assigned_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['category_id'], ['nivaran_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['closed_by_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['final_category_id'], ['nivaran_categories.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['previous_closed_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['previous_resolved_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['resolved_by_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['student_record_id'], ['nivaran_student_master_records.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['subject_id'], ['nivaran_subjects.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_grievances_grievance_id'), 'nivaran_grievances', ['grievance_id'], unique=True)
    op.create_index(op.f('ix_nivaran_grievances_applicant_vyasa_user_id'), 'nivaran_grievances', ['applicant_vyasa_user_id'], unique=False)
    op.create_index(op.f('ix_nivaran_grievances_assigned_authority_id'), 'nivaran_grievances', ['assigned_authority_id'], unique=False)
    op.create_index('ix_nivaran_grv_applicant_active', 'nivaran_grievances', ['applicant_vyasa_user_id', 'status', 'created_at'], unique=False)
    op.create_index('ix_nivaran_grv_auth_triage', 'nivaran_grievances', ['assigned_authority_id', 'status', 'priority', 'created_at'], unique=False)

    # 4. Table: nivaran_grievance_status_history
    op.create_table(
        'nivaran_grievance_status_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('from_status', sa.String(length=32), nullable=True),
        sa.Column('to_status', sa.String(length=32), nullable=False),
        sa.Column('actor_user_id', sa.UUID(), nullable=True),
        sa.Column('actor_authority_id', sa.UUID(), nullable=True),
        sa.Column('actor_type', history_actor_type, server_default='USER', nullable=False),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['actor_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_grievance_status_history_grievance_id'), 'nivaran_grievance_status_history', ['grievance_id'], unique=False)

    # 5. Table: nivaran_comments
    op.create_table(
        'nivaran_comments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('author_user_id', sa.UUID(), nullable=False),
        sa.Column('author_authority_id', sa.UUID(), nullable=True),
        sa.Column('is_internal', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('comment_text', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_comments_grievance_id'), 'nivaran_comments', ['grievance_id'], unique=False)

    # 6. Table: nivaran_grievance_feedback
    op.create_table(
        'nivaran_grievance_feedback',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('timeliness_rating', sa.Integer(), nullable=False),
        sa.Column('fairness_rating', sa.Integer(), nullable=False),
        sa.Column('feedback_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('rating BETWEEN 1 AND 5', name='ck_nivaran_feedback_rating'),
        sa.CheckConstraint('timeliness_rating BETWEEN 1 AND 5', name='ck_nivaran_feedback_timeliness'),
        sa.CheckConstraint('fairness_rating BETWEEN 1 AND 5', name='ck_nivaran_feedback_fairness'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('grievance_id'),
    )

    # 7. Table: nivaran_assignments
    op.create_table(
        'nivaran_assignments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('authority_id', sa.UUID(), nullable=False),
        sa.Column('assigned_by_id', sa.UUID(), nullable=True),
        sa.Column('assignment_reason', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('unassigned_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_assignments_authority_id'), 'nivaran_assignments', ['authority_id'], unique=False)
    op.create_index(op.f('ix_nivaran_assignments_grievance_id'), 'nivaran_assignments', ['grievance_id'], unique=False)

    # 8. Table: nivaran_forwarding_confirmations
    op.create_table(
        'nivaran_forwarding_confirmations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('forwarded_by_authority_id', sa.UUID(), nullable=False),
        sa.Column('forwarded_to_authority_id', sa.UUID(), nullable=False),
        sa.Column('jurisdiction_verified', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('evidence_reviewed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('prior_actions_checked', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('identity_confirmed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('urgency_assessed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('conflict_of_interest_cleared', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('justification_reason', sa.Text(), nullable=False),
        sa.Column('actions_taken_summary', sa.Text(), nullable=False),
        sa.Column('expected_outcome', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['forwarded_by_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['forwarded_to_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_forwarding_confirmations_grievance_id'), 'nivaran_forwarding_confirmations', ['grievance_id'], unique=False)

    # 9. Table: nivaran_escalations
    op.create_table(
        'nivaran_escalations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('escalated_by_id', sa.UUID(), nullable=False),
        sa.Column('target_role', sa.String(length=32), nullable=False),
        sa.Column('escalation_reason', sa.Text(), nullable=False),
        sa.Column('is_resolved', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['escalated_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_escalations_grievance_id'), 'nivaran_escalations', ['grievance_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_nivaran_escalations_grievance_id'), table_name='nivaran_escalations')
    op.drop_table('nivaran_escalations')

    op.drop_index(op.f('ix_nivaran_forwarding_confirmations_grievance_id'), table_name='nivaran_forwarding_confirmations')
    op.drop_table('nivaran_forwarding_confirmations')

    op.drop_index(op.f('ix_nivaran_assignments_grievance_id'), table_name='nivaran_assignments')
    op.drop_index(op.f('ix_nivaran_assignments_authority_id'), table_name='nivaran_assignments')
    op.drop_table('nivaran_assignments')

    op.drop_table('nivaran_grievance_feedback')

    op.drop_index(op.f('ix_nivaran_comments_grievance_id'), table_name='nivaran_comments')
    op.drop_table('nivaran_comments')

    op.drop_index(op.f('ix_nivaran_grievance_status_history_grievance_id'), table_name='nivaran_grievance_status_history')
    op.drop_table('nivaran_grievance_status_history')

    op.drop_index('ix_nivaran_grv_auth_triage', table_name='nivaran_grievances')
    op.drop_index('ix_nivaran_grv_applicant_active', table_name='nivaran_grievances')
    op.drop_index(op.f('ix_nivaran_grievances_assigned_authority_id'), table_name='nivaran_grievances')
    op.drop_index(op.f('ix_nivaran_grievances_applicant_vyasa_user_id'), table_name='nivaran_grievances')
    op.drop_index(op.f('ix_nivaran_grievances_grievance_id'), table_name='nivaran_grievances')
    op.drop_table('nivaran_grievances')

    op.drop_index(op.f('ix_nivaran_student_master_records_enrollment_number_snapshot'), table_name='nivaran_student_master_records')
    op.drop_index(op.f('ix_nivaran_student_master_records_registration_number_snapshot'), table_name='nivaran_student_master_records')
    op.drop_index(op.f('ix_nivaran_student_master_records_record_number'), table_name='nivaran_student_master_records')
    op.drop_index(op.f('ix_nivaran_student_master_records_student_vyasa_user_id'), table_name='nivaran_student_master_records')
    op.drop_table('nivaran_student_master_records')

    op.execute('DROP TYPE IF EXISTS history_actor_type')
    op.execute('DROP TYPE IF EXISTS grievance_priority')
    op.execute('DROP TYPE IF EXISTS grievance_status')
    op.execute('DROP TYPE IF EXISTS student_record_status')
