"""add_must_change_password_to_users

Revision ID: 8b29c54e1017
Revises: 8b29c54e1016
Create Date: 2026-10-31 08:30:00.000000

Adds must_change_password boolean column to users table with server_default=false.
Existing accounts (super_admin, existing authorities, applicants) retain false (unaffected).
Newly registered authority accounts created by Super Admin have must_change_password=true.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1017'
down_revision: Union[str, None] = '8b29c54e1016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'must_change_password',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='Explicit flag requiring user to set permanent password on first login',
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'must_change_password')
