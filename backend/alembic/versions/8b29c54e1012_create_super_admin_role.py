"""create super_admin role

Revision ID: 8b29c54e1012
Revises: 8b29c54e1011
Create Date: 2026-10-18 00:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8b29c54e1012'
down_revision: Union[str, None] = '8b29c54e1011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Idempotently insert 'super_admin' system role
    op.execute(sa.text("""
        INSERT INTO roles (id, name, description, is_system, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            'super_admin',
            'Supreme Central Governance Administrator',
            true,
            NOW(),
            NOW()
        )
        ON CONFLICT (name) DO NOTHING;
    """))


def downgrade() -> None:
    # Revoke super_admin associations and delete role
    op.execute(sa.text("""
        DELETE FROM user_roles 
        WHERE role_id IN (SELECT id FROM roles WHERE name = 'super_admin');
    """))
    op.execute(sa.text("""
        DELETE FROM roles 
        WHERE name = 'super_admin';
    """))
