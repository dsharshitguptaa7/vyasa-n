"""committee_workflow_permissions

Revision ID: 8b29c54e1009
Revises: 8b29c54e1008
Create Date: 2026-10-13 21:30:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8b29c54e1009'
down_revision: Union[str, None] = '8b29c54e1008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add CLARIFICATION_REQUESTED to committee_request_status enum safely
    op.execute(
        sa.text("ALTER TYPE committee_request_status ADD VALUE IF NOT EXISTS 'CLARIFICATION_REQUESTED';")
    )

    # 2. Add target_authority_id to nivaran_committee_creation_requests
    op.add_column(
        'nivaran_committee_creation_requests',
        sa.Column('target_authority_id', sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        'fk_comm_req_target_authority',
        'nivaran_committee_creation_requests',
        'nivaran_authorities',
        ['target_authority_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_index(
        'ix_nivaran_comm_req_target_authority_id',
        'nivaran_committee_creation_requests',
        ['target_authority_id'],
        unique=False,
    )

    # 3. Add creation_request_id and terms_of_reference to nivaran_committees
    op.add_column(
        'nivaran_committees',
        sa.Column('creation_request_id', sa.UUID(), nullable=True),
    )
    op.add_column(
        'nivaran_committees',
        sa.Column('terms_of_reference', sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        'fk_comm_creation_request',
        'nivaran_committees',
        'nivaran_committee_creation_requests',
        ['creation_request_id'],
        ['id'],
        ondelete='SET NULL',
    )
    op.create_index(
        'ix_nivaran_committees_creation_request_id',
        'nivaran_committees',
        ['creation_request_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('ix_nivaran_committees_creation_request_id', table_name='nivaran_committees')
    op.drop_constraint('fk_comm_creation_request', 'nivaran_committees', type_='foreignkey')
    op.drop_column('nivaran_committees', 'terms_of_reference')
    op.drop_column('nivaran_committees', 'creation_request_id')

    op.drop_index('ix_nivaran_comm_req_target_authority_id', table_name='nivaran_committee_creation_requests')
    op.drop_constraint('fk_comm_req_target_authority', 'nivaran_committee_creation_requests', type_='foreignkey')
    op.drop_column('nivaran_committee_creation_requests', 'target_authority_id')
