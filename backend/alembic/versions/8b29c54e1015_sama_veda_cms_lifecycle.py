"""sama_veda_cms_lifecycle

Revision ID: 8b29c54e1015
Revises: 8b29c54e1014
Create Date: 2026-10-26 10:55:00.000000

Adds lifecycle fields (status, abstract, external_url, is_featured, published_at, archived_at)
to Sama Veda bulletins and publications, and introduces the sama_researcher_spotlights table.
Backward-compatible: existing records automatically default to 'published'.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1015'
down_revision: Union[str, None] = '8b29c54e1014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enhance sama_research_bulletins with lifecycle tracking
    op.add_column(
        'sama_research_bulletins',
        sa.Column('status', sa.String(length=32), server_default='published', nullable=False, comment="Content lifecycle status: 'draft' | 'in_review' | 'published' | 'archived'")
    )
    op.create_index('ix_sama_bulletin_status', 'sama_research_bulletins', ['status'], unique=False)
    op.add_column(
        'sama_research_bulletins',
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True, comment="Timestamp when bulletin edition was retired to archives")
    )

    # 2. Enhance sama_research_publications with lifecycle and showcase metadata
    op.add_column(
        'sama_research_publications',
        sa.Column('status', sa.String(length=32), server_default='published', nullable=False, comment="Content lifecycle status: 'draft' | 'in_review' | 'published' | 'archived'")
    )
    op.create_index('ix_sama_pub_status', 'sama_research_publications', ['status'], unique=False)
    op.add_column(
        'sama_research_publications',
        sa.Column('abstract', sa.Text(), nullable=True, comment="Abstract text or publication summary")
    )
    op.add_column(
        'sama_research_publications',
        sa.Column('external_url', sa.String(length=500), nullable=True, comment="Publisher canonical landing URL or open access repository link")
    )
    op.add_column(
        'sama_research_publications',
        sa.Column('is_featured', sa.Boolean(), server_default=sa.text('false'), nullable=False, comment="Whether publication is featured on research showcase landing views")
    )
    op.create_index('ix_sama_pub_featured', 'sama_research_publications', ['is_featured'], unique=False)
    op.add_column(
        'sama_research_publications',
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True, comment="Timestamp when publication was published by an administrator")
    )
    op.add_column(
        'sama_research_publications',
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True, comment="Timestamp when publication was archived")
    )

    # 3. Enhance sama_felicitation_certificates with revocation tracking
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('is_revoked', sa.Boolean(), server_default=sa.text('false'), nullable=False, comment="Whether this certificate has been officially revoked")
    )
    op.create_index('ix_sama_cert_revoked', 'sama_felicitation_certificates', ['is_revoked'], unique=False)
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True, comment="Timestamp when certificate was revoked")
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('revocation_reason', sa.Text(), nullable=True, comment="Institutional justification or audit rationale for revocation")
    )

    # 4. Create sama_researcher_spotlights table
    op.create_table(
        'sama_researcher_spotlights',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=True, comment="Linked researcher author identity; null if spotlight is general"),
        sa.Column('headline', sa.String(length=255), nullable=False, comment="Catchy spotlight title or researcher recognition headline"),
        sa.Column('summary', sa.Text(), nullable=False, comment="Short narrative or excerpt detailing the research contribution"),
        sa.Column('media_type', sa.String(length=32), server_default='photo', nullable=False, comment="'photo' | 'video' | 'interview'"),
        sa.Column('media_url', sa.String(length=500), nullable=False, comment="Storage path or CDN URL for the primary photograph or video thumbnail"),
        sa.Column('video_embed_url', sa.String(length=500), nullable=True, comment="External YouTube/Vimeo video embed link if media_type is video"),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False, comment="Integer determining carousel / grid ranking order"),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False, comment="Whether this spotlight is displayed on public research landing views"),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['sama_research_authors.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sama_spotlight_author_id', 'sama_researcher_spotlights', ['author_id'], unique=False)
    op.create_index('ix_sama_spotlight_active_order', 'sama_researcher_spotlights', ['is_active', 'display_order'], unique=False)


def downgrade() -> None:
    # 1. Drop sama_researcher_spotlights
    op.drop_index('ix_sama_spotlight_active_order', table_name='sama_researcher_spotlights')
    op.drop_index('ix_sama_spotlight_author_id', table_name='sama_researcher_spotlights')
    op.drop_table('sama_researcher_spotlights')

    # 2. Revert sama_research_publications additions
    op.drop_index('ix_sama_pub_featured', table_name='sama_research_publications')
    op.drop_index('ix_sama_pub_status', table_name='sama_research_publications')
    op.drop_column('sama_research_publications', 'archived_at')
    op.drop_column('sama_research_publications', 'published_at')
    op.drop_column('sama_research_publications', 'is_featured')
    op.drop_column('sama_research_publications', 'external_url')
    op.drop_column('sama_research_publications', 'abstract')
    op.drop_column('sama_research_publications', 'status')

    # 3. Revert sama_felicitation_certificates additions
    op.drop_index('ix_sama_cert_revoked', table_name='sama_felicitation_certificates')
    op.drop_column('sama_felicitation_certificates', 'revocation_reason')
    op.drop_column('sama_felicitation_certificates', 'revoked_at')
    op.drop_column('sama_felicitation_certificates', 'is_revoked')

    # 4. Revert sama_research_bulletins additions
    op.drop_index('ix_sama_bulletin_status', table_name='sama_research_bulletins')
    op.drop_column('sama_research_bulletins', 'archived_at')
    op.drop_column('sama_research_bulletins', 'status')
