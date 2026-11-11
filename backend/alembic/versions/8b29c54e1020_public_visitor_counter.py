"""public_visitor_counter

Revision ID: 8b29c54e1020
Revises: 8b29c54e1019
Create Date: 2026-11-11 08:50:00.000000+00:00

Establishes the database schema for the main VYASA public website visitor counter:
1. Creates public_visitors table for anonymous first-party visitor identities.
2. Creates public_daily_visits table for unique visitor tracking scoped to Asia/Kolkata (IST).
3. Adds primary keys, unique constraints, and indexes for high-concurrency, multi-instance safety.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1020'
down_revision: Union[str, None] = '8b29c54e1019'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create public_visitors table
    op.create_table(
        'public_visitors',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('visitor_token', sa.String(length=64), nullable=False, comment='Random anonymous first-party visitor identifier'),
        sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('total_visits', sa.Integer(), server_default='1', nullable=False, comment='Total lifetime track invocations by this visitor'),
        sa.UniqueConstraint('visitor_token', name='uq_public_visitors_token'),
    )
    op.create_index('ix_public_visitors_visitor_token', 'public_visitors', ['visitor_token'], unique=True)

    # 2. Create public_daily_visits table
    op.create_table(
        'public_daily_visits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('visitor_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('visit_date', sa.Date(), nullable=False, comment='Institutional calendar date (Asia/Kolkata) of the visit'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['visitor_id'], ['public_visitors.id'], name='fk_public_daily_visits_visitor_id', ondelete='CASCADE'),
        sa.UniqueConstraint('visitor_id', 'visit_date', name='uq_public_daily_visits_visitor_date'),
    )
    op.create_index('ix_public_daily_visits_visitor_id', 'public_daily_visits', ['visitor_id'], unique=False)
    op.create_index('ix_public_daily_visits_date', 'public_daily_visits', ['visit_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_public_daily_visits_date', table_name='public_daily_visits')
    op.drop_index('ix_public_daily_visits_visitor_id', table_name='public_daily_visits')
    op.drop_table('public_daily_visits')
    op.drop_index('ix_public_visitors_visitor_token', table_name='public_visitors')
    op.drop_table('public_visitors')
