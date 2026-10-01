"""atharva_signatures_efiles_approvals_ai

Revision ID: 8b29c54e1005
Revises: 8b29c54e1004
Create Date: 2026-09-28 19:50:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1005'
down_revision: Union[str, None] = '8b29c54e1004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums idempotently
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signing_key_status') THEN
                CREATE TYPE signing_key_status AS ENUM ('ACTIVE', 'RETIRED', 'REVOKED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'digital_signature_entity_type') THEN
                CREATE TYPE digital_signature_entity_type AS ENUM (
                    'GRIEVANCE_RESOLUTION', 'APPROVAL_DECISION', 'COMMITTEE_FINAL_RECOMMENDATION'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'efile_status') THEN
                CREATE TYPE efile_status AS ENUM ('DRAFT', 'FINALIZED', 'ARCHIVED');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_request_status') THEN
                CREATE TYPE approval_request_status AS ENUM (
                    'PENDING', 'APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'CANCELLED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_action_type') THEN
                CREATE TYPE approval_action_type AS ENUM (
                    'REQUESTED', 'APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'RESUBMITTED', 'CANCELLED'
                );
            END IF;
        END $$;
    """)

    signing_key_status_type = postgresql.ENUM('ACTIVE', 'RETIRED', 'REVOKED', name='signing_key_status', create_type=False)
    dig_sig_entity_type = postgresql.ENUM('GRIEVANCE_RESOLUTION', 'APPROVAL_DECISION', 'COMMITTEE_FINAL_RECOMMENDATION', name='digital_signature_entity_type', create_type=False)
    efile_status_type = postgresql.ENUM('DRAFT', 'FINALIZED', 'ARCHIVED', name='efile_status', create_type=False)
    appr_req_status_type = postgresql.ENUM('PENDING', 'APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'CANCELLED', name='approval_request_status', create_type=False)
    appr_action_type_type = postgresql.ENUM('REQUESTED', 'APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION', 'RESUBMITTED', 'CANCELLED', name='approval_action_type', create_type=False)

    # 2. Table: nivaran_signing_key_versions
    op.create_table(
        'nivaran_signing_key_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('key_id', sa.String(length=100), nullable=False),
        sa.Column('algorithm', sa.String(length=50), server_default='RSA-PSS-SHA256', nullable=False),
        sa.Column('public_key_pem', sa.Text(), nullable=False),
        sa.Column('private_key_reference', sa.String(length=255), nullable=False),
        sa.Column('fingerprint', sa.String(length=64), nullable=False),
        sa.Column('status', signing_key_status_type, server_default='ACTIVE', nullable=False),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('retired_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_signing_key_versions_fingerprint'), 'nivaran_signing_key_versions', ['fingerprint'], unique=False)
    op.create_index(op.f('ix_nivaran_signing_key_versions_key_id'), 'nivaran_signing_key_versions', ['key_id'], unique=True)

    # 3. Table: nivaran_signing_challenges
    op.create_table(
        'nivaran_signing_challenges',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('authority_id', sa.UUID(), nullable=False),
        sa.Column('challenge_nonce', sa.String(length=64), nullable=False),
        sa.Column('purpose', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_consumed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_signing_challenges_authority_id'), 'nivaran_signing_challenges', ['authority_id'], unique=False)
    op.create_index(op.f('ix_nivaran_signing_challenges_challenge_nonce'), 'nivaran_signing_challenges', ['challenge_nonce'], unique=True)

    # 4. Table: nivaran_digital_signatures
    op.create_table(
        'nivaran_digital_signatures',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('key_version_id', sa.UUID(), nullable=False),
        sa.Column('signer_user_id', sa.UUID(), nullable=False),
        sa.Column('signer_authority_id', sa.UUID(), nullable=False),
        sa.Column('entity_type', dig_sig_entity_type, nullable=False),
        sa.Column('entity_id', sa.UUID(), nullable=False),
        sa.Column('payload_sha256', sa.String(length=64), nullable=False),
        sa.Column('signature_base64', sa.Text(), nullable=False),
        sa.Column('signed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['key_version_id'], ['nivaran_signing_key_versions.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['signer_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['signer_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_digital_signatures_entity_id'), 'nivaran_digital_signatures', ['entity_id'], unique=False)

    # 5. Table: nivaran_efiles
    op.create_table(
        'nivaran_efiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('e_file_number', sa.String(length=64), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('applicant_vyasa_user_id', sa.UUID(), nullable=False),
        sa.Column('student_record_id', sa.UUID(), nullable=True),
        sa.Column('status', efile_status_type, server_default='DRAFT', nullable=False),
        sa.Column('file_path', sa.String(length=1000), nullable=True),
        sa.Column('content_hash', sa.String(length=64), nullable=True),
        sa.Column('page_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_sealed', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('sealed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sealed_by_authority_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['applicant_vyasa_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['sealed_by_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['student_record_id'], ['nivaran_student_master_records.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('grievance_id'),
    )
    op.create_index(op.f('ix_nivaran_efiles_applicant_vyasa_user_id'), 'nivaran_efiles', ['applicant_vyasa_user_id'], unique=False)
    op.create_index(op.f('ix_nivaran_efiles_e_file_number'), 'nivaran_efiles', ['e_file_number'], unique=True)
    op.create_index(op.f('ix_nivaran_efiles_student_record_id'), 'nivaran_efiles', ['student_record_id'], unique=False)

    # 6. Table: nivaran_efile_documents
    op.create_table(
        'nivaran_efile_documents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('efile_id', sa.UUID(), nullable=False),
        sa.Column('document_id', sa.UUID(), nullable=False),
        sa.Column('document_sha256_snapshot', sa.String(length=64), nullable=False),
        sa.Column('section_order', sa.Integer(), server_default='1', nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['nivaran_documents.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['efile_id'], ['nivaran_efiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('efile_id', 'document_id', name='uq_nivaran_efile_doc'),
    )
    op.create_index(op.f('ix_nivaran_efile_documents_efile_id'), 'nivaran_efile_documents', ['efile_id'], unique=False)

    # 7. Table: nivaran_approval_requests
    op.create_table(
        'nivaran_approval_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('requested_by_id', sa.UUID(), nullable=False),
        sa.Column('target_authority_id', sa.UUID(), nullable=False),
        sa.Column('approval_type', sa.String(length=64), nullable=False),
        sa.Column('request_note', sa.Text(), nullable=False),
        sa.Column('status', appr_req_status_type, server_default='PENDING', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['target_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_approval_requests_grievance_id'), 'nivaran_approval_requests', ['grievance_id'], unique=False)
    op.create_index(op.f('ix_nivaran_approval_requests_requested_by_id'), 'nivaran_approval_requests', ['requested_by_id'], unique=False)
    op.create_index(op.f('ix_nivaran_approval_requests_target_authority_id'), 'nivaran_approval_requests', ['target_authority_id'], unique=False)

    # 8. Table: nivaran_approval_actions
    op.create_table(
        'nivaran_approval_actions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('approval_request_id', sa.UUID(), nullable=False),
        sa.Column('action_by_authority_id', sa.UUID(), nullable=False),
        sa.Column('action_type', appr_action_type_type, nullable=False),
        sa.Column('decision_note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['action_by_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['approval_request_id'], ['nivaran_approval_requests.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_approval_actions_approval_request_id'), 'nivaran_approval_actions', ['approval_request_id'], unique=False)

    # 9. Table: nivaran_ai_processing_records
    op.create_table(
        'nivaran_ai_processing_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('grievance_id', sa.UUID(), nullable=False),
        sa.Column('predicted_category_id', sa.UUID(), nullable=True),
        sa.Column('confidence_score', sa.Numeric(precision=5, scale=4), nullable=True),
        sa.Column('inference_latency_ms', sa.Integer(), nullable=True),
        sa.Column('model_version', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['grievance_id'], ['nivaran_grievances.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['predicted_category_id'], ['nivaran_categories.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_ai_processing_records_grievance_id'), 'nivaran_ai_processing_records', ['grievance_id'], unique=False)

    # 10. Table: nivaran_ai_clusters
    op.create_table(
        'nivaran_ai_clusters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('topic_label', sa.String(length=150), nullable=False),
        sa.Column('keywords_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('algorithm', sa.String(length=64), server_default='KMeans', nullable=False),
        sa.Column('sample_size', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('nivaran_ai_clusters')

    op.drop_index(op.f('ix_nivaran_ai_processing_records_grievance_id'), table_name='nivaran_ai_processing_records')
    op.drop_table('nivaran_ai_processing_records')

    op.drop_index(op.f('ix_nivaran_approval_actions_approval_request_id'), table_name='nivaran_approval_actions')
    op.drop_table('nivaran_approval_actions')

    op.drop_index(op.f('ix_nivaran_approval_requests_target_authority_id'), table_name='nivaran_approval_requests')
    op.drop_index(op.f('ix_nivaran_approval_requests_requested_by_id'), table_name='nivaran_approval_requests')
    op.drop_index(op.f('ix_nivaran_approval_requests_grievance_id'), table_name='nivaran_approval_requests')
    op.drop_table('nivaran_approval_requests')

    op.drop_index(op.f('ix_nivaran_efile_documents_efile_id'), table_name='nivaran_efile_documents')
    op.drop_table('nivaran_efile_documents')

    op.drop_index(op.f('ix_nivaran_efiles_student_record_id'), table_name='nivaran_efiles')
    op.drop_index(op.f('ix_nivaran_efiles_e_file_number'), table_name='nivaran_efiles')
    op.drop_index(op.f('ix_nivaran_efiles_applicant_vyasa_user_id'), table_name='nivaran_efiles')
    op.drop_table('nivaran_efiles')

    op.drop_index(op.f('ix_nivaran_digital_signatures_entity_id'), table_name='nivaran_digital_signatures')
    op.drop_table('nivaran_digital_signatures')

    op.drop_index(op.f('ix_nivaran_signing_challenges_challenge_nonce'), table_name='nivaran_signing_challenges')
    op.drop_index(op.f('ix_nivaran_signing_challenges_authority_id'), table_name='nivaran_signing_challenges')
    op.drop_table('nivaran_signing_challenges')

    op.drop_index(op.f('ix_nivaran_signing_key_versions_key_id'), table_name='nivaran_signing_key_versions')
    op.drop_index(op.f('ix_nivaran_signing_key_versions_fingerprint'), table_name='nivaran_signing_key_versions')
    op.drop_table('nivaran_signing_key_versions')

    op.execute('DROP TYPE IF EXISTS approval_action_type')
    op.execute('DROP TYPE IF EXISTS approval_request_status')
    op.execute('DROP TYPE IF EXISTS efile_status')
    op.execute('DROP TYPE IF EXISTS digital_signature_entity_type')
    op.execute('DROP TYPE IF EXISTS signing_key_status')
