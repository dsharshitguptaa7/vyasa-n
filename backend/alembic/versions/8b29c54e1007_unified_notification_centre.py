"""unified_notification_centre

Revision ID: 8b29c54e1007
Revises: 8b29c54e1006
Create Date: 2026-10-13 18:40:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '8b29c54e1007'
down_revision: Union[str, None] = '8b29c54e1006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add future-proof columns to notifications table
    # Check if columns exist before adding (defense-in-depth)
    op.add_column('notifications', sa.Column('source_pillar', sa.String(length=64), server_default='VYASA_CORE', nullable=False))
    op.add_column('notifications', sa.Column('event_type', sa.String(length=100), nullable=True))
    op.add_column('notifications', sa.Column('event_id', sa.String(length=100), nullable=True))
    op.add_column('notifications', sa.Column('priority', sa.String(length=32), server_default='MEDIUM', nullable=False))
    op.add_column('notifications', sa.Column('action_route', sa.String(length=500), nullable=True))
    op.add_column('notifications', sa.Column('action_required', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('notifications', sa.Column('entity_type', sa.String(length=64), nullable=True))
    op.add_column('notifications', sa.Column('entity_id', sa.String(length=100), nullable=True))
    op.add_column('notifications', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))

    op.create_index('ix_notifications_source_pillar', 'notifications', ['source_pillar'])
    op.create_index('ix_notifications_event_type', 'notifications', ['event_type'])
    op.create_index('ix_notifications_event_id', 'notifications', ['event_id'])
    op.create_index('ix_notifications_priority', 'notifications', ['priority'])
    op.create_index('ix_notifications_action_required', 'notifications', ['action_required'])

    # 2. Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('source_pillar', sa.String(length=64), server_default='*', nullable=False),
        sa.Column('event_type', sa.String(length=100), server_default='*', nullable=False),
        sa.Column('in_app_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('email_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_notif_pref_user_id', 'notification_preferences', ['user_id'])
    op.create_index('ix_notif_pref_user_pillar', 'notification_preferences', ['user_id', 'source_pillar'])

    # 3. Create notification_templates table
    op.create_table(
        'notification_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('source_pillar', sa.String(length=64), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('title_template', sa.String(length=255), nullable=False),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('action_route_template', sa.String(length=500), nullable=True),
        sa.Column('default_priority', sa.String(length=32), server_default='MEDIUM', nullable=False),
        sa.Column('is_action_required', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_notif_templates_pillar_event', 'notification_templates', ['source_pillar', 'event_type'], unique=True)

    # 4. Create notification_deliveries table
    op.create_table(
        'notification_deliveries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('notification_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('channel', sa.String(length=32), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('attempt_count', sa.Integer(), server_default='1', nullable=False),
        sa.Column('last_attempt_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('recipient_destination', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_notif_deliveries_notification_id', 'notification_deliveries', ['notification_id'])
    op.create_index('ix_notif_deliveries_status', 'notification_deliveries', ['status'])
    op.create_index('ix_notif_deliveries_channel', 'notification_deliveries', ['channel'])


def downgrade() -> None:
    op.drop_table('notification_deliveries')
    op.drop_table('notification_templates')
    op.drop_table('notification_preferences')

    op.drop_index('ix_notifications_action_required', table_name='notifications')
    op.drop_index('ix_notifications_priority', table_name='notifications')
    op.drop_index('ix_notifications_event_id', table_name='notifications')
    op.drop_index('ix_notifications_event_type', table_name='notifications')
    op.drop_index('ix_notifications_source_pillar', table_name='notifications')

    op.drop_column('notifications', 'expires_at')
    op.drop_column('notifications', 'entity_id')
    op.drop_column('notifications', 'entity_type')
    op.drop_column('notifications', 'action_required')
    op.drop_column('notifications', 'action_route')
    op.drop_column('notifications', 'priority')
    op.drop_column('notifications', 'event_id')
    op.drop_column('notifications', 'event_type')
    op.drop_column('notifications', 'source_pillar')
