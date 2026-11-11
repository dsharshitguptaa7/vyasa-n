"""anudaan_showcase_and_disbursements

Revision ID: 8b29c54e1021
Revises: 8b29c54e1020
Create Date: 2026-11-11 09:30:00.000000+00:00

Establishes the database schema for ANUDAAN Phase 4.3.5:
1. Creates yajur_anudaan_disbursements (Verified financial payout ledger with UTR/reference, amount, and verification status).
2. Creates yajur_anudaan_gallery_items (Ceremony & researcher recognition events).
3. Creates yajur_anudaan_gallery_images (Event photographs, captions, and cover status).
4. Creates yajur_anudaan_public_config (Sadmin showcase display controls).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1021'
down_revision: Union[str, None] = '8b29c54e1020'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create yajur_anudaan_disbursements
    op.create_table(
        'yajur_anudaan_disbursements',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('disbursement_reference', sa.String(length=100), nullable=False, comment='Bank transaction reference (UTR, NEFT, PFMS)'),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False, comment='Actual incentive amount disbursed in INR'),
        sa.Column('disbursement_date', sa.Date(), nullable=False, comment='Date the funds were credited/transferred'),
        sa.Column('academic_year', sa.String(length=20), nullable=False, comment='Academic year (e.g. 2025-2026)'),
        sa.Column('payment_method', sa.String(length=50), server_default='BANK_TRANSFER', nullable=False),
        sa.Column('verification_status', sa.String(length=30), server_default='RECORDED', nullable=False, comment='RECORDED, VERIFIED, REVERSED'),
        sa.Column('reversal_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('verified_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['yajur_anudaan_applications.id'], name='fk_anudaan_disb_app_id', ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['author_id'], ['yajur_anudaan_publication_authors.id'], name='fk_anudaan_disb_author_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['recorded_by_id'], ['users.id'], name='fk_anudaan_disb_rec_user_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['verified_by_id'], ['users.id'], name='fk_anudaan_disb_ver_user_id', ondelete='SET NULL'),
        sa.CheckConstraint('amount > 0', name='ck_anudaan_disbursement_amount_positive'),
        sa.UniqueConstraint('disbursement_reference', name='uq_anudaan_disbursement_reference'),
    )
    op.create_index('ix_anudaan_disb_app', 'yajur_anudaan_disbursements', ['application_id'], unique=False)
    op.create_index('ix_anudaan_disb_author', 'yajur_anudaan_disbursements', ['author_id'], unique=False)
    op.create_index('ix_anudaan_disb_ref', 'yajur_anudaan_disbursements', ['disbursement_reference'], unique=True)
    op.create_index('ix_anudaan_disb_year', 'yajur_anudaan_disbursements', ['academic_year'], unique=False)
    op.create_index('ix_anudaan_disb_status', 'yajur_anudaan_disbursements', ['verification_status'], unique=False)
    op.create_index('ix_anudaan_disb_date', 'yajur_anudaan_disbursements', ['disbursement_date'], unique=False)

    # 2. Create yajur_anudaan_gallery_items
    op.create_table(
        'yajur_anudaan_gallery_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('event_name', sa.String(length=255), nullable=False),
        sa.Column('event_date', sa.Date(), nullable=False),
        sa.Column('academic_year', sa.String(length=20), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('researcher_name', sa.String(length=255), nullable=True),
        sa.Column('researcher_designation', sa.String(length=150), nullable=True),
        sa.Column('department_name', sa.String(length=255), nullable=True),
        sa.Column('has_consent', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('is_featured', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('is_published', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name='fk_anudaan_gal_created_by', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], name='fk_anudaan_gal_updated_by', ondelete='SET NULL'),
    )
    op.create_index('ix_anudaan_gal_year', 'yajur_anudaan_gallery_items', ['academic_year'], unique=False)
    op.create_index('ix_anudaan_gal_published', 'yajur_anudaan_gallery_items', ['is_published'], unique=False)
    op.create_index('ix_anudaan_gal_featured', 'yajur_anudaan_gallery_items', ['is_featured'], unique=False)
    op.create_index('ix_anudaan_gal_order', 'yajur_anudaan_gallery_items', ['display_order'], unique=False)
    op.create_index('ix_anudaan_gal_event_date', 'yajur_anudaan_gallery_items', ['event_date'], unique=False)

    # 3. Create yajur_anudaan_gallery_images
    op.create_table(
        'yajur_anudaan_gallery_images',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('gallery_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('storage_key', sa.String(length=500), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=False),
        sa.Column('mime_type', sa.String(length=100), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('caption', sa.String(length=500), nullable=True),
        sa.Column('is_cover', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('display_order', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['gallery_item_id'], ['yajur_anudaan_gallery_items.id'], name='fk_anudaan_img_item_id', ondelete='CASCADE'),
        sa.CheckConstraint('file_size_bytes > 0 AND file_size_bytes <= 10485760', name='ck_anudaan_img_size_limit'),
    )
    op.create_index('ix_anudaan_img_item', 'yajur_anudaan_gallery_images', ['gallery_item_id'], unique=False)
    op.create_index('ix_anudaan_img_cover', 'yajur_anudaan_gallery_images', ['is_cover'], unique=False)
    op.create_index('ix_anudaan_img_order', 'yajur_anudaan_gallery_images', ['display_order'], unique=False)

    # 4. Create yajur_anudaan_public_config
    op.create_table(
        'yajur_anudaan_public_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('config_key', sa.String(length=50), server_default='global_showcase', nullable=False),
        sa.Column('impact_section_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('gallery_section_enabled', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('active_academic_year', sa.String(length=20), nullable=True),
        sa.Column('custom_banner_note', sa.Text(), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], name='fk_anudaan_cfg_updated_by', ondelete='SET NULL'),
        sa.UniqueConstraint('config_key', name='uq_anudaan_public_config_key'),
    )


def downgrade() -> None:
    op.drop_table('yajur_anudaan_public_config')
    op.drop_table('yajur_anudaan_gallery_images')
    op.drop_table('yajur_anudaan_gallery_items')
    op.drop_table('yajur_anudaan_disbursements')
