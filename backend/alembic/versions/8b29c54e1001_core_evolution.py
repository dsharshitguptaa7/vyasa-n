"""core_evolution

Revision ID: 8b29c54e1001
Revises: 74bfd3bf7936
Create Date: 2026-09-28 19:40:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1001'
down_revision: Union[str, None] = '74bfd3bf7936'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Evolve pillar_registry -> module_registry (non-destructive rename)
    op.rename_table('pillar_registry', 'module_registry')
    op.alter_column('module_registry', 'pillar_key', new_column_name='module_key', existing_type=sa.String(length=64))
    op.alter_column('module_registry', 'base_url', existing_type=sa.String(length=255), nullable=True)
    op.drop_index('ix_pillar_registry_pillar_key', table_name='module_registry')
    op.create_index(op.f('ix_module_registry_module_key'), 'module_registry', ['module_key'], unique=True)

    # 2. Central Platform audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=True, comment='Actor who performed the action; null for system events'),
        sa.Column('module', sa.String(length=64), nullable=False, comment='Subsystem or Veda domain'),
        sa.Column('action', sa.String(length=128), nullable=False, comment='Action performed e.g. auth.login'),
        sa.Column('entity_name', sa.String(length=100), nullable=False),
        sa.Column('entity_id', sa.String(length=64), nullable=False),
        sa.Column('details', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_logs_user_id'), 'audit_logs', ['user_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_module'), 'audit_logs', ['module'], unique=False)
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_name'), 'audit_logs', ['entity_name'], unique=False)
    op.create_index(op.f('ix_audit_logs_entity_id'), 'audit_logs', ['entity_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_created_at'), 'audit_logs', ['created_at'], unique=False)
    op.create_index('ix_audit_logs_module_created', 'audit_logs', ['module', 'created_at'], unique=False)

    # 3. Dynamic institutional system_settings table
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('data_type', sa.String(length=32), server_default='string', nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_public', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('key'),
    )


def downgrade() -> None:
    op.drop_table('system_settings')
    op.drop_index('ix_audit_logs_module_created', table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_created_at'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entity_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_entity_name'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_module'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_user_id'), table_name='audit_logs')
    op.drop_table('audit_logs')

    op.drop_index(op.f('ix_module_registry_module_key'), table_name='module_registry')
    op.create_index('ix_pillar_registry_pillar_key', 'module_registry', ['module_key'], unique=True)
    op.alter_column('module_registry', 'module_key', new_column_name='pillar_key', existing_type=sa.String(length=64))
    op.alter_column('module_registry', 'base_url', existing_type=sa.String(length=255), nullable=True)
    op.rename_table('module_registry', 'pillar_registry')
