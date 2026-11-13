"""anudaan_felicitation_cycles

Revision ID: 8b29c54e1023
Revises: 8b29c54e1022
Create Date: 2026-11-11 16:30:00.000000+00:00

Enhances ANUDAAN with Felicitation / Recognition Cycle Management (Volume & Issue):
1. Creates yajur_anudaan_felicitation_cycles table with volume, issue, status, date, title, description, published, archived.
2. Alters yajur_anudaan_sanction_entries to add project_title, make department_name nullable, and add felicitation_cycle_id.
3. Alters yajur_anudaan_gallery_items to add felicitation_cycle_id for ceremony association.
4. Seeds initial Volume 2 — Issue 2 (Completed) and Volume 2 — Issue 3 (Upcoming) cycles, backlinking existing sanction entries.
"""
from typing import Sequence, Union
import uuid
from datetime import date
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1023'
down_revision: Union[str, None] = '8b29c54e1022'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create yajur_anudaan_felicitation_cycles
    op.create_table(
        'yajur_anudaan_felicitation_cycles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('volume_number', sa.Integer(), nullable=False, comment='Volume number (e.g. 1, 2, 3)'),
        sa.Column('issue_number', sa.Integer(), nullable=False, comment='Issue number within volume (e.g. 1, 2, 3)'),
        sa.Column('display_title', sa.String(length=255), nullable=True, comment='Ceremonial title (e.g. Convocation Felicitation)'),
        sa.Column('status', sa.String(length=20), server_default='UPCOMING', nullable=False, comment='Status: UPCOMING or COMPLETED'),
        sa.Column('felicitation_date', sa.Date(), nullable=True, comment='Date of ceremony / felicitation'),
        sa.Column('academic_year', sa.String(length=20), nullable=True, comment='Academic year (e.g. 2025-2026)'),
        sa.Column('description', sa.Text(), nullable=True, comment='Institutional event description and highlights'),
        sa.Column('is_published', sa.Boolean(), server_default=sa.text('true'), nullable=False, comment='Visible on public showcase if True'),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.text('false'), nullable=False, comment='Archived if True'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name='fk_anudaan_cycle_created_by', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], name='fk_anudaan_cycle_updated_by', ondelete='SET NULL'),
        sa.UniqueConstraint('volume_number', 'issue_number', name='uq_anudaan_cycle_volume_issue'),
        sa.CheckConstraint('volume_number > 0 AND issue_number > 0', name='ck_anudaan_cycle_vol_issue_pos'),
        sa.CheckConstraint("status IN ('UPCOMING', 'COMPLETED')", name='ck_anudaan_cycle_status'),
    )
    op.create_index('ix_anudaan_cycle_year', 'yajur_anudaan_felicitation_cycles', ['academic_year'], unique=False)
    op.create_index('ix_anudaan_cycle_status', 'yajur_anudaan_felicitation_cycles', ['status'], unique=False)
    op.create_index('ix_anudaan_cycle_published', 'yajur_anudaan_felicitation_cycles', ['is_published'], unique=False)
    op.create_index('ix_anudaan_cycle_archived', 'yajur_anudaan_felicitation_cycles', ['is_archived'], unique=False)
    op.create_index('ix_anudaan_cycle_date', 'yajur_anudaan_felicitation_cycles', ['felicitation_date'], unique=False)

    # 2. Alter yajur_anudaan_sanction_entries
    op.add_column(
        'yajur_anudaan_sanction_entries',
        sa.Column('project_title', sa.String(length=500), nullable=True, comment='Optional research project or grant title')
    )
    op.alter_column(
        'yajur_anudaan_sanction_entries',
        'department_name',
        existing_type=sa.String(length=255),
        nullable=True
    )
    op.add_column(
        'yajur_anudaan_sanction_entries',
        sa.Column('felicitation_cycle_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Associated felicitation cycle')
    )
    op.create_foreign_key(
        'fk_anudaan_sanction_cycle_id',
        'yajur_anudaan_sanction_entries',
        'yajur_anudaan_felicitation_cycles',
        ['felicitation_cycle_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_anudaan_sanction_cycle', 'yajur_anudaan_sanction_entries', ['felicitation_cycle_id'], unique=False)

    # 3. Alter yajur_anudaan_gallery_items
    op.add_column(
        'yajur_anudaan_gallery_items',
        sa.Column('felicitation_cycle_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Optional link to felicitation cycle')
    )
    op.create_foreign_key(
        'fk_anudaan_gallery_cycle_id',
        'yajur_anudaan_gallery_items',
        'yajur_anudaan_felicitation_cycles',
        ['felicitation_cycle_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index('ix_anudaan_gallery_cycle', 'yajur_anudaan_gallery_items', ['felicitation_cycle_id'], unique=False)

    # 4. Seed initial Volume 2 — Issue 2 (Completed) and Volume 2 — Issue 3 (Upcoming) cycles
    cycle_1_id = uuid.uuid4()
    cycle_2_id = uuid.uuid4()

    bind = op.get_bind()
    bind.execute(
        sa.text("""
            INSERT INTO yajur_anudaan_felicitation_cycles (
                id, volume_number, issue_number, display_title, status,
                felicitation_date, academic_year, description, is_published, is_archived,
                created_at, updated_at
            ) VALUES
            (
                :c1_id, 2, 2, 'Annual Research Convocation Felicitation', 'COMPLETED',
                '2026-01-20', '2025-2026', 'Honoring outstanding campus researchers published in high-impact Scopus and Web of Science journals.',
                true, false, NOW(), NOW()
            ),
            (
                :c2_id, 2, 3, 'Spring Research Recognition Ceremony', 'UPCOMING',
                '2026-03-15', '2025-2026', 'Upcoming university felicitation ceremony for Q1 & Q2 publication incentive sanctions.',
                true, false, NOW(), NOW()
            )
        """),
        {"c1_id": cycle_1_id, "c2_id": cycle_2_id}
    )

    # Link any existing unlinked sanction entries to Cycle 1 (Volume 2, Issue 2)
    bind.execute(
        sa.text("""
            UPDATE yajur_anudaan_sanction_entries
            SET felicitation_cycle_id = :c1_id
            WHERE felicitation_cycle_id IS NULL
        """),
        {"c1_id": cycle_1_id}
    )

    # Link existing gallery items to Cycle 1 if appropriate
    bind.execute(
        sa.text("""
            UPDATE yajur_anudaan_gallery_items
            SET felicitation_cycle_id = :c1_id
            WHERE felicitation_cycle_id IS NULL AND academic_year = '2025-2026'
        """),
        {"c1_id": cycle_1_id}
    )


def downgrade() -> None:
    # 1. Gallery items
    op.drop_index('ix_anudaan_gallery_cycle', table_name='yajur_anudaan_gallery_items')
    op.drop_constraint('fk_anudaan_gallery_cycle_id', 'yajur_anudaan_gallery_items', type_='foreignkey')
    op.drop_column('yajur_anudaan_gallery_items', 'felicitation_cycle_id')

    # 2. Sanction entries
    op.drop_index('ix_anudaan_sanction_cycle', table_name='yajur_anudaan_sanction_entries')
    op.drop_constraint('fk_anudaan_sanction_cycle_id', 'yajur_anudaan_sanction_entries', type_='foreignkey')
    op.drop_column('yajur_anudaan_sanction_entries', 'felicitation_cycle_id')
    op.alter_column(
        'yajur_anudaan_sanction_entries',
        'department_name',
        existing_type=sa.String(length=255),
        nullable=False
    )
    op.drop_column('yajur_anudaan_sanction_entries', 'project_title')

    # 3. Felicitation cycles table
    op.drop_index('ix_anudaan_cycle_date', table_name='yajur_anudaan_felicitation_cycles')
    op.drop_index('ix_anudaan_cycle_archived', table_name='yajur_anudaan_felicitation_cycles')
    op.drop_index('ix_anudaan_cycle_published', table_name='yajur_anudaan_felicitation_cycles')
    op.drop_index('ix_anudaan_cycle_status', table_name='yajur_anudaan_felicitation_cycles')
    op.drop_index('ix_anudaan_cycle_year', table_name='yajur_anudaan_felicitation_cycles')
    op.drop_table('yajur_anudaan_felicitation_cycles')
