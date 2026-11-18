"""ai_assistant_persistent_conversations_and_rate_limits

Revision ID: 8b29c54e1029
Revises: 8b29c54e1028
Create Date: 2026-11-19 02:30:00.000000+00:00

Establishes persistent conversation storage and distributed rate limiting
for VYASAⁿ AI Knowledge Centre & Scholar Gateway:
1. Creates ai_assistant_conversations:
   - Persistent threads tied to authenticated user ID, title, and lifecycle states.
2. Creates ai_assistant_messages:
   - User queries and assistant responses with grounded citations, evidence status, and timestamps.
3. Creates ai_assistant_rate_limits:
   - Atomic distributed sliding-window tracker across horizontal backend instances.
4. Adds query optimization indexes and cascade foreign key constraints.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1029'
down_revision: Union[str, None] = '8b29c54e1028'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ai_assistant_conversations table
    op.create_table(
        'ai_assistant_conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('title', sa.String(255), nullable=False, server_default='New Inquiry'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.Column('is_archived', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.create_index(
        'ix_ai_assistant_conversations_user_id',
        'ai_assistant_conversations',
        ['user_id'],
    )
    op.create_index(
        'ix_ai_assistant_conversations_updated_at',
        'ai_assistant_conversations',
        ['updated_at'],
    )
    op.create_index(
        'ix_ai_assistant_conversations_is_deleted',
        'ai_assistant_conversations',
        ['is_deleted'],
    )
    op.create_index(
        'ix_ai_assistant_conversations_user_updated',
        'ai_assistant_conversations',
        ['user_id', 'updated_at'],
    )

    # 2. Create ai_assistant_messages table
    op.create_table(
        'ai_assistant_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'conversation_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('ai_assistant_conversations.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('role', sa.String(20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('evidence_status', sa.String(50), nullable=True),
        sa.Column('has_conflict', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_grounded', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('citations', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('domains_searched', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index(
        'ix_ai_assistant_messages_conversation_id',
        'ai_assistant_messages',
        ['conversation_id'],
    )
    op.create_index(
        'ix_ai_assistant_messages_created_at',
        'ai_assistant_messages',
        ['created_at'],
    )

    # 3. Create ai_assistant_rate_limits table
    op.create_table(
        'ai_assistant_rate_limits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'request_timestamp',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
    )
    op.create_index(
        'ix_ai_assistant_rate_limits_user_id',
        'ai_assistant_rate_limits',
        ['user_id'],
    )
    op.create_index(
        'ix_ai_assistant_rate_limits_request_timestamp',
        'ai_assistant_rate_limits',
        ['request_timestamp'],
    )
    op.create_index(
        'ix_ai_assistant_rate_limits_user_ts',
        'ai_assistant_rate_limits',
        ['user_id', 'request_timestamp'],
    )


def downgrade() -> None:
    op.drop_table('ai_assistant_rate_limits')
    op.drop_table('ai_assistant_messages')
    op.drop_table('ai_assistant_conversations')
