"""sama_veda modern digital certificate system

Revision ID: 8b29c54e1018
Revises: 8b29c54e1017
Create Date: 2026-11-07 14:00:00.000000

Expands the SAMIKSHA certificate architecture into an institution-grade digital
certificate management, design, approval, issuance and public verification platform:
1. Creates sama_certificate_templates (vector design templates, institutional layouts)
2. Creates sama_certificate_signatories (dual signing authority management)
3. Enhances sama_felicitation_certificates with lifecycle states, verification tokens,
   and template linkage while preserving backward compatibility.
4. Creates sama_certificate_authors (normalized multi-author relational ledger)
5. Creates sama_certificate_approvals (dual authority Dean & VC approval audit trail)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1018'
down_revision: Union[str, None] = '8b29c54e1017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. sama_certificate_templates
    op.create_table(
        'sama_certificate_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('certificate_type', sa.String(50), nullable=False, server_default='RESEARCH_PUBLICATION'),
        sa.Column('orientation', sa.String(20), nullable=False, server_default='LANDSCAPE'),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_cert_tpl_code', 'sama_certificate_templates', ['code'], unique=True)
    op.create_index('ix_sama_cert_tpl_type', 'sama_certificate_templates', ['certificate_type'])
    op.create_index('ix_sama_cert_tpl_active', 'sama_certificate_templates', ['is_active'])

    # 2. sama_certificate_signatories
    op.create_table(
        'sama_certificate_signatories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('authority_type', sa.String(50), nullable=False),
        sa.Column('signatory_name', sa.String(255), nullable=False),
        sa.Column('designation', sa.String(255), nullable=False),
        sa.Column('department', sa.String(255), nullable=True),
        sa.Column('signature_image_path', sa.String(500), nullable=True),
        sa.Column('signature_asset_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('effective_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_signatory_type', 'sama_certificate_signatories', ['authority_type'])
    op.create_index('ix_sama_signatory_active', 'sama_certificate_signatories', ['is_active'])

    # 3. Enhance sama_felicitation_certificates
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('certificate_type', sa.String(50), nullable=False, server_default='RESEARCH_PUBLICATION')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('status', sa.String(50), nullable=False, server_default='ISSUED')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('template_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_certificate_templates.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('template_version', sa.Integer(), nullable=False, server_default='1')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('title', sa.String(255), nullable=False, server_default='Certificate of Appreciation & Research Excellence')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('presentation_statement', sa.Text(), nullable=True, server_default='This certificate is proudly conferred upon')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('research_contribution_statement', sa.Text(), nullable=True, server_default='in recognition of meritorious scholarly contribution published in the research article titled:')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('research_title', sa.Text(), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('congratulatory_statement', sa.Text(), nullable=True, server_default='The university commends the exemplary commitment to advancing research frontiers and intellectual pursuit.')
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('publication_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('verification_token', sa.String(64), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('rejection_reason', sa.Text(), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('reissued_from_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_felicitation_certificates.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('reissued_reason', sa.Text(), nullable=True)
    )

    # Populate verification_token for any existing records using md5/uuid
    op.execute("UPDATE sama_felicitation_certificates SET verification_token = md5(random()::text || clock_timestamp()::text) WHERE verification_token IS NULL")
    op.alter_column('sama_felicitation_certificates', 'verification_token', nullable=False)

    op.alter_column('sama_felicitation_certificates', 'bulletin_id', nullable=True)
    op.alter_column('sama_felicitation_certificates', 'author_id', nullable=True)
    op.alter_column('sama_felicitation_certificates', 'file_storage_path', nullable=True)

    op.create_index('ix_sama_cert_verification_token', 'sama_felicitation_certificates', ['verification_token'], unique=True)
    op.create_index('ix_sama_cert_status', 'sama_felicitation_certificates', ['status'])

    # 4. sama_certificate_authors
    op.create_table(
        'sama_certificate_authors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('certificate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_felicitation_certificates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('researcher_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_authors.id', ondelete='SET NULL'), nullable=True),
        sa.Column('author_name_snapshot', sa.String(255), nullable=False),
        sa.Column('academic_title_snapshot', sa.String(50), nullable=True),
        sa.Column('scopus_id_snapshot', sa.String(50), nullable=True),
        sa.Column('affiliation_snapshot', sa.String(255), nullable=True, server_default='Chhatrapati Shahu Ji Maharaj University, Kanpur'),
        sa.Column('department_snapshot', sa.String(255), nullable=True),
        sa.Column('author_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('author_role', sa.String(50), nullable=False, server_default='Author'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_cert_auth_lookup', 'sama_certificate_authors', ['certificate_id', 'author_order'])
    op.create_index('ix_sama_cert_auth_researcher', 'sama_certificate_authors', ['researcher_id'])

    # 5. sama_certificate_approvals
    op.create_table(
        'sama_certificate_approvals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('certificate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_felicitation_certificates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('authority_type', sa.String(50), nullable=False),
        sa.Column('signatory_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_certificate_signatories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('signatory_name_snapshot', sa.String(255), nullable=False),
        sa.Column('designation_snapshot', sa.String(255), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='PENDING'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('decided_by_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_cert_approval_status', 'sama_certificate_approvals', ['certificate_id', 'authority_type', 'status'])


def downgrade() -> None:
    op.drop_table('sama_certificate_approvals')
    op.drop_table('sama_certificate_authors')
    op.drop_index('ix_sama_cert_status', table_name='sama_felicitation_certificates')
    op.drop_index('ix_sama_cert_verification_token', table_name='sama_felicitation_certificates')
    op.drop_column('sama_felicitation_certificates', 'reissued_reason')
    op.drop_column('sama_felicitation_certificates', 'reissued_from_id')
    op.drop_column('sama_felicitation_certificates', 'rejection_reason')
    op.drop_column('sama_felicitation_certificates', 'created_by_user_id')
    op.drop_column('sama_felicitation_certificates', 'approved_at')
    op.drop_column('sama_felicitation_certificates', 'verification_token')
    op.drop_column('sama_felicitation_certificates', 'publication_details')
    op.drop_column('sama_felicitation_certificates', 'congratulatory_statement')
    op.drop_column('sama_felicitation_certificates', 'research_title')
    op.drop_column('sama_felicitation_certificates', 'research_contribution_statement')
    op.drop_column('sama_felicitation_certificates', 'presentation_statement')
    op.drop_column('sama_felicitation_certificates', 'title')
    op.drop_column('sama_felicitation_certificates', 'template_version')
    op.drop_column('sama_felicitation_certificates', 'template_id')
    op.drop_column('sama_felicitation_certificates', 'status')
    op.drop_column('sama_felicitation_certificates', 'certificate_type')
    op.drop_table('sama_certificate_signatories')
    op.drop_table('sama_certificate_templates')
