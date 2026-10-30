"""sama_veda_import_batches

Revision ID: 8b29c54e1016
Revises: 8b29c54e1015
Create Date: 2026-10-26 13:30:00.000000

Adds the sama_import_batches table for auditable historical data import,
dry-run preview ledger, row error tracking, and reconciliation reports.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1016'
down_revision: Union[str, None] = '8b29c54e1015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sama_import_batches',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('batch_number', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('source_filename', sa.String(length=255), nullable=False),
        sa.Column('file_format', sa.String(length=20), nullable=False),
        sa.Column('mode', sa.String(length=20), nullable=False, server_default='preview'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
        sa.Column('total_rows', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('skipped_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('review_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_summary', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('reconciliation_report', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('imported_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sama_batch_number', 'sama_import_batches', ['batch_number'], unique=True)
    op.create_index('ix_sama_batch_entity_type', 'sama_import_batches', ['entity_type'], unique=False)
    op.create_index('ix_sama_batch_status', 'sama_import_batches', ['status'], unique=False)
    op.create_index('ix_sama_batch_entity_status', 'sama_import_batches', ['entity_type', 'status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_sama_batch_entity_status', table_name='sama_import_batches')
    op.drop_index('ix_sama_batch_status', table_name='sama_import_batches')
    op.drop_index('ix_sama_batch_entity_type', table_name='sama_import_batches')
    op.drop_index('ix_sama_batch_number', table_name='sama_import_batches')
    op.drop_table('sama_import_batches')
