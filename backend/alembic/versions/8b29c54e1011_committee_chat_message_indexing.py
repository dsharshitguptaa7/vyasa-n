"""committee_chat_message_indexing

Revision ID: 8b29c54e1011
Revises: 8b29c54e1010
Create Date: 2026-10-17 00:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8b29c54e1011'
down_revision: Union[str, None] = '8b29c54e1010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Composite index for bounded, chronological committee message retrieval
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_nivaran_comm_msg_comm_created "
        "ON nivaran_committee_messages (committee_id, created_at DESC);"
    ))


def downgrade() -> None:
    op.execute(sa.text(
        "DROP INDEX IF EXISTS ix_nivaran_comm_msg_comm_created;"
    ))
