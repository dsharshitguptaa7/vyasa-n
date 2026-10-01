"""atharva_authorities_and_taxonomy

Revision ID: 8b29c54e1002
Revises: 8b29c54e1001
Create Date: 2026-09-28 19:42:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1002'
down_revision: Union[str, None] = '8b29c54e1001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums idempotently
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'nivaran_role') THEN
                CREATE TYPE nivaran_role AS ENUM ('APPLICANT', 'MANAGER', 'ASSISTANT_DEAN', 'ASSOCIATE_DEAN', 'DEAN', 'GUEST_MEMBER');
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_routing_type') THEN
                CREATE TYPE category_routing_type AS ENUM ('CLUSTER', 'GRIEVANCE_CLUSTER', 'SUBJECT_ASSISTANT_DEAN', 'FIXED_AUTHORITY');
            END IF;
        END $$;
    """)

    nivaran_role_type = postgresql.ENUM(
        'APPLICANT', 'MANAGER', 'ASSISTANT_DEAN', 'ASSOCIATE_DEAN', 'DEAN', 'GUEST_MEMBER',
        name='nivaran_role',
        create_type=False,
    )
    category_routing_type = postgresql.ENUM(
        'CLUSTER', 'GRIEVANCE_CLUSTER', 'SUBJECT_ASSISTANT_DEAN', 'FIXED_AUTHORITY',
        name='category_routing_type',
        create_type=False,
    )

    # 2. Table: nivaran_authorities
    op.create_table(
        'nivaran_authorities',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('vyasa_user_id', sa.UUID(), nullable=False),
        sa.Column('role', nivaran_role_type, nullable=False),
        sa.Column('name_snapshot', sa.String(length=150), nullable=False),
        sa.Column('email_snapshot', sa.String(length=255), nullable=False),
        sa.Column('designation', sa.String(length=150), nullable=True),
        sa.Column('department', sa.String(length=150), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['vyasa_user_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_authorities_vyasa_user_id'), 'nivaran_authorities', ['vyasa_user_id'], unique=True)

    # 3. Table: nivaran_subject_clusters
    op.create_table(
        'nivaran_subject_clusters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cluster_number', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('assistant_dean_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('cluster_number > 0', name='ck_nivaran_sub_cluster_num_positive'),
        sa.ForeignKeyConstraint(['assistant_dean_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_subject_clusters_cluster_number'), 'nivaran_subject_clusters', ['cluster_number'], unique=True)
    op.create_index(op.f('ix_nivaran_subject_clusters_assistant_dean_id'), 'nivaran_subject_clusters', ['assistant_dean_id'], unique=True)

    # 4. Table: nivaran_subjects
    op.create_table(
        'nivaran_subjects',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('subject_cluster_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['subject_cluster_id'], ['nivaran_subject_clusters.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_subjects_name'), 'nivaran_subjects', ['name'], unique=True)

    # 5. Table: nivaran_grievance_clusters
    op.create_table(
        'nivaran_grievance_clusters',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cluster_number', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('associate_dean_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint('cluster_number > 0', name='ck_nivaran_grv_cluster_num_positive'),
        sa.ForeignKeyConstraint(['associate_dean_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_grievance_clusters_cluster_number'), 'nivaran_grievance_clusters', ['cluster_number'], unique=True)
    op.create_index(op.f('ix_nivaran_grievance_clusters_associate_dean_id'), 'nivaran_grievance_clusters', ['associate_dean_id'], unique=True)

    # 6. Table: nivaran_categories
    op.create_table(
        'nivaran_categories',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('routing_type', category_routing_type, nullable=False),
        sa.Column('grievance_cluster_id', sa.UUID(), nullable=True),
        sa.Column('fixed_authority_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['fixed_authority_id'], ['nivaran_authorities.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['grievance_cluster_id'], ['nivaran_grievance_clusters.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_nivaran_categories_name'), 'nivaran_categories', ['name'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_nivaran_categories_name'), table_name='nivaran_categories')
    op.drop_table('nivaran_categories')

    op.drop_index(op.f('ix_nivaran_grievance_clusters_associate_dean_id'), table_name='nivaran_grievance_clusters')
    op.drop_index(op.f('ix_nivaran_grievance_clusters_cluster_number'), table_name='nivaran_grievance_clusters')
    op.drop_table('nivaran_grievance_clusters')

    op.drop_index(op.f('ix_nivaran_subjects_name'), table_name='nivaran_subjects')
    op.drop_table('nivaran_subjects')

    op.drop_index(op.f('ix_nivaran_subject_clusters_assistant_dean_id'), table_name='nivaran_subject_clusters')
    op.drop_index(op.f('ix_nivaran_subject_clusters_cluster_number'), table_name='nivaran_subject_clusters')
    op.drop_table('nivaran_subject_clusters')

    op.drop_index(op.f('ix_nivaran_authorities_vyasa_user_id'), table_name='nivaran_authorities')
    op.drop_table('nivaran_authorities')

    op.execute('DROP TYPE IF EXISTS category_routing_type')
    op.execute('DROP TYPE IF EXISTS nivaran_role')
