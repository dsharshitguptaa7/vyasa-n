"""authority two factor auth tables

Revision ID: 8b29c54e1013
Revises: 8b29c54e1012
Create Date: 2026-10-22 00:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '8b29c54e1013'
down_revision: Union[str, None] = '8b29c54e1012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. user_two_factor_auth
    op.create_table(
        'user_two_factor_auth',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('totp_secret_encrypted', sa.Text(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('enabled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_verified_code_hash', sa.String(64), nullable=True),
        sa.Column('last_verified_timestep', sa.BigInteger(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_user_two_factor_auth_user_id', 'user_two_factor_auth', ['user_id'], unique=True)
    op.create_index('ix_user_two_factor_auth_is_enabled', 'user_two_factor_auth', ['is_enabled'])

    # 2. two_factor_recovery_codes
    op.create_table(
        'two_factor_recovery_codes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code_hash', sa.String(255), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_two_factor_recovery_codes_user_id', 'two_factor_recovery_codes', ['user_id'])
    op.create_index('ix_two_factor_recovery_codes_code_hash', 'two_factor_recovery_codes', ['code_hash'])

    # 3. authentication_challenges
    op.create_table(
        'authentication_challenges',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('purpose', sa.String(50), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ip_address', sa.String(100), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_authentication_challenges_user_id', 'authentication_challenges', ['user_id'])
    op.create_index('ix_authentication_challenges_purpose', 'authentication_challenges', ['purpose'])
    op.create_index('ix_authentication_challenges_expires_at', 'authentication_challenges', ['expires_at'])

    # 4. two_factor_attempts
    op.create_table(
        'two_factor_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_identifier', sa.String(255), nullable=False),
        sa.Column('ip_address', sa.String(100), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('attempted_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_two_factor_attempts_user_identifier', 'two_factor_attempts', ['user_identifier'])
    op.create_index('ix_two_factor_attempts_attempted_at', 'two_factor_attempts', ['attempted_at'])


def downgrade() -> None:
    op.drop_table('two_factor_attempts')
    op.drop_table('authentication_challenges')
    op.drop_table('two_factor_recovery_codes')
    op.drop_table('user_two_factor_auth')
