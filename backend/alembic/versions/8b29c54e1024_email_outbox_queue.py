"""email_outbox_queue

Revision ID: 8b29c54e1024
Revises: 8b29c54e1023
Create Date: 2026-11-12 11:00:00.000000+00:00

Phase 1 Core Email Infrastructure Hardening:
1. Creates email_outbox table for transactional, asynchronous email job persistence.
2. Supports lifecycle states: PENDING, PROCESSING, SENT, FAILED.
3. Adds indexes for concurrent SKIP LOCKED claiming and abandoned job recovery.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1024'
down_revision: Union[str, None] = '8b29c54e1023'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create email_outbox table
    op.create_table(
        'email_outbox',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('notification_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('notification_delivery_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('recipient_email', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('html_content', sa.Text(), nullable=False),
        sa.Column('text_content', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('attempt_count', sa.Integer(), server_default='0', nullable=False),
        sa.Column('max_attempts', sa.Integer(), server_default='3', nullable=False),
        sa.Column('next_attempt_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('locked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('locked_by', sa.String(length=128), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('provider', sa.String(length=32), server_default='brevo', nullable=False),
        sa.Column('provider_message_id', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], name='fk_email_outbox_notification_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['notification_delivery_id'], ['notification_deliveries.id'], name='fk_email_outbox_delivery_id', ondelete='SET NULL'),
        sa.CheckConstraint("status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')", name='ck_email_outbox_status'),
        sa.CheckConstraint('attempt_count >= 0 AND max_attempts > 0', name='ck_email_outbox_attempts'),
    )

    # 2. Indexes for concurrent worker claiming and monitoring
    op.create_index('ix_email_outbox_claim', 'email_outbox', ['status', 'next_attempt_at'])
    op.create_index('ix_email_outbox_abandoned', 'email_outbox', ['status', 'locked_at'])
    op.create_index('ix_email_outbox_recipient', 'email_outbox', ['recipient_email'])
    op.create_index('ix_email_outbox_notification_id', 'email_outbox', ['notification_id'])
    op.create_index('ix_email_outbox_delivery_id', 'email_outbox', ['notification_delivery_id'])


def downgrade() -> None:
    op.drop_index('ix_email_outbox_delivery_id', table_name='email_outbox')
    op.drop_index('ix_email_outbox_notification_id', table_name='email_outbox')
    op.drop_index('ix_email_outbox_recipient', table_name='email_outbox')
    op.drop_index('ix_email_outbox_abandoned', table_name='email_outbox')
    op.drop_index('ix_email_outbox_claim', table_name='email_outbox')
    op.drop_table('email_outbox')
