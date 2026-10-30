"""sama veda core tables

Revision ID: 8b29c54e1014
Revises: 8b29c54e1013
Create Date: 2026-10-26 00:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '8b29c54e1014'
down_revision: Union[str, None] = '8b29c54e1013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. sama_research_bulletins
    op.create_table(
        'sama_research_bulletins',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('volume_number', sa.Integer(), nullable=False, comment='Volume sequence number (e.g., 2)'),
        sa.Column('issue_number', sa.Integer(), nullable=False, comment='Issue sequence number within volume (e.g., 1 or 2)'),
        sa.Column('title', sa.String(255), nullable=False, comment='Official edition title'),
        sa.Column('publication_period', sa.String(100), nullable=False, comment='Cover period'),
        sa.Column('file_path', sa.String(500), nullable=False, comment='Storage path for bulletin PDF'),
        sa.Column('file_size_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('checksum_sha256', sa.String(64), nullable=True),
        sa.Column('publication_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('volume_number', 'issue_number', name='uq_sama_bulletin_volume_issue'),
    )

    # 2. sama_research_authors
    op.create_table(
        'sama_research_authors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scopus_id', sa.String(50), nullable=True, comment='Author Scopus Identifier'),
        sa.Column('full_name', sa.String(255), nullable=False, comment='Author full name'),
        sa.Column('department', sa.String(255), nullable=True),
        sa.Column('institutional_affiliation', sa.String(255), nullable=False, server_default='Chhatrapati Shahu Ji Maharaj University, Kanpur'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_author_scopus', 'sama_research_authors', ['scopus_id'])
    op.create_index('ix_sama_author_full_name', 'sama_research_authors', ['full_name'])
    op.create_index('ix_sama_author_user_id', 'sama_research_authors', ['user_id'])
    # Partial unique index: only verified authors must have unique Scopus IDs
    op.create_index(
        'uq_sama_author_verified_scopus',
        'sama_research_authors',
        ['scopus_id'],
        unique=True,
        postgresql_where=sa.text("is_verified = true AND scopus_id IS NOT NULL AND trim(scopus_id) != ''"),
    )

    # 3. sama_research_publications
    op.create_table(
        'sama_research_publications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('bulletin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_bulletins.id', ondelete='CASCADE'), nullable=False),
        sa.Column('serial_no', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('source_journal', sa.String(500), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('doi', sa.String(255), nullable=True),
        sa.Column('author_display', sa.Text(), nullable=False),
        sa.Column('authors_complete', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_pub_bulletin_id', 'sama_research_publications', ['bulletin_id'])
    op.create_index('ix_sama_pub_slug', 'sama_research_publications', ['slug'], unique=True)
    op.create_index('ix_sama_pub_category', 'sama_research_publications', ['category'])
    op.create_index('ix_sama_pub_bulletin_serial', 'sama_research_publications', ['bulletin_id', 'serial_no'])

    # 4. sama_publication_authors
    op.create_table(
        'sama_publication_authors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('publication_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_publications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_authors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('is_corresponding', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('publication_id', 'author_id', name='uq_sama_pub_author'),
    )
    op.create_index('ix_sama_pub_author_lookup', 'sama_publication_authors', ['publication_id', 'author_id'])

    # 5. sama_felicitation_certificates
    op.create_table(
        'sama_felicitation_certificates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('certificate_number', sa.String(100), nullable=False),
        sa.Column('bulletin_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_bulletins.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_authors.id', ondelete='CASCADE'), nullable=False),
        sa.Column('publication_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_research_publications.id', ondelete='SET NULL'), nullable=True),
        sa.Column('file_storage_path', sa.String(500), nullable=False),
        sa.Column('checksum_sha256', sa.String(64), nullable=True),
        sa.Column('download_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_cert_number', 'sama_felicitation_certificates', ['certificate_number'], unique=True)
    op.create_index('ix_sama_cert_bulletin_id', 'sama_felicitation_certificates', ['bulletin_id'])
    op.create_index('ix_sama_cert_author_id', 'sama_felicitation_certificates', ['author_id'])
    op.create_index('ix_sama_cert_publication_id', 'sama_felicitation_certificates', ['publication_id'])
    op.create_index('ix_sama_cert_auth_bulletin', 'sama_felicitation_certificates', ['author_id', 'bulletin_id'])

    # 6. sama_certificate_verification_events
    op.create_table(
        'sama_certificate_verification_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('certificate_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sama_felicitation_certificates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('verification_source', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_cert_verify_cert_id', 'sama_certificate_verification_events', ['certificate_id'])
    op.create_index('ix_sama_cert_verify_time', 'sama_certificate_verification_events', ['certificate_id', 'verified_at'])

    # 7. sama_cam_ai_projects
    op.create_table(
        'sama_cam_ai_projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('legacy_project_id', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('domain', sa.String(100), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('funding_amount_inr', sa.Numeric(14, 2), nullable=True),
        sa.Column('funding_display', sa.String(100), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='Ongoing'),
        sa.Column('principal_investigators', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('co_investigators', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_cam_legacy_id', 'sama_cam_ai_projects', ['legacy_project_id'], unique=True)
    op.create_index('ix_sama_cam_domain', 'sama_cam_ai_projects', ['domain'])
    op.create_index('ix_sama_cam_category', 'sama_cam_ai_projects', ['category'])

    # 8. sama_fellowship_schemes
    op.create_table(
        'sama_fellowship_schemes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('scheme_code', sa.String(50), nullable=False),
        sa.Column('scheme_name', sa.String(255), nullable=False),
        sa.Column('active_scholars_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_fellowship_code', 'sama_fellowship_schemes', ['scheme_code'], unique=True)


def downgrade() -> None:
    op.drop_table('sama_fellowship_schemes')
    op.drop_table('sama_cam_ai_projects')
    op.drop_table('sama_certificate_verification_events')
    op.drop_table('sama_felicitation_certificates')
    op.drop_table('sama_publication_authors')
    op.drop_table('sama_research_publications')
    op.drop_table('sama_research_authors')
    op.drop_table('sama_research_bulletins')
