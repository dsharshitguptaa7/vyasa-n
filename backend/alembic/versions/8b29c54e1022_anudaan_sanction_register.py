"""anudaan_sanction_register

Revision ID: 8b29c54e1022
Revises: 8b29c54e1021
Create Date: 2026-11-11 11:30:00.000000+00:00

Establishes the simplified database schema for the ANUDAAN Sadmin Incentive Sanction Register:
1. Creates yajur_anudaan_sanction_entries (Simplified manual & application-linked incentive sanction records).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1022'
down_revision: Union[str, None] = '8b29c54e1021'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create yajur_anudaan_sanction_entries
    op.create_table(
        'yajur_anudaan_sanction_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('researcher_name', sa.String(length=255), nullable=False, comment='Full name of the recognized researcher'),
        sa.Column('department_name', sa.String(length=255), nullable=False, comment='Department or School name'),
        sa.Column('publication_title', sa.String(length=500), nullable=False, comment='Title of the sanctioned research paper'),
        sa.Column('publication_doi', sa.String(length=255), nullable=True, comment='DOI identifier (optional)'),
        sa.Column('quartile', sa.String(length=10), nullable=False, comment='Quartile: Q1, Q2, Q3, Q4'),
        sa.Column('sanctioned_amount', sa.Numeric(precision=12, scale=2), nullable=False, comment='Incentive amount sanctioned in INR'),
        sa.Column('academic_year', sa.String(length=20), nullable=False, comment='Academic year (e.g. 2025-2026)'),
        sa.Column('sanction_date', sa.Date(), nullable=False, comment='Date the incentive was officially sanctioned'),
        sa.Column('remarks', sa.Text(), nullable=True, comment='Optional administrative remarks or sanction order notes'),
        sa.Column('is_published', sa.Boolean(), server_default=sa.text('true'), nullable=False, comment='Visible on public register if True'),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Optional link to submitted ANUDAAN application'),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=True, comment='Optional link to specific publication author record'),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('updated_by_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['yajur_anudaan_applications.id'], name='fk_anudaan_sanction_app_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['author_id'], ['yajur_anudaan_publication_authors.id'], name='fk_anudaan_sanction_author_id', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], name='fk_anudaan_sanction_created_by', ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], name='fk_anudaan_sanction_updated_by', ondelete='SET NULL'),
        sa.CheckConstraint('sanctioned_amount >= 0', name='ck_anudaan_sanction_amount_non_negative'),
    )
    op.create_index('ix_anudaan_sanction_year', 'yajur_anudaan_sanction_entries', ['academic_year'], unique=False)
    op.create_index('ix_anudaan_sanction_quartile', 'yajur_anudaan_sanction_entries', ['quartile'], unique=False)
    op.create_index('ix_anudaan_sanction_published', 'yajur_anudaan_sanction_entries', ['is_published'], unique=False)
    op.create_index('ix_anudaan_sanction_app', 'yajur_anudaan_sanction_entries', ['application_id'], unique=False)
    op.create_index('ix_anudaan_sanction_researcher', 'yajur_anudaan_sanction_entries', ['researcher_name'], unique=False)
    op.create_index('ix_anudaan_sanction_dept', 'yajur_anudaan_sanction_entries', ['department_name'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_anudaan_sanction_dept', table_name='yajur_anudaan_sanction_entries')
    op.drop_index('ix_anudaan_sanction_researcher', table_name='yajur_anudaan_sanction_entries')
    op.drop_index('ix_anudaan_sanction_app', table_name='yajur_anudaan_sanction_entries')
    op.drop_index('ix_anudaan_sanction_published', table_name='yajur_anudaan_sanction_entries')
    op.drop_index('ix_anudaan_sanction_quartile', table_name='yajur_anudaan_sanction_entries')
    op.drop_index('ix_anudaan_sanction_year', table_name='yajur_anudaan_sanction_entries')
    op.drop_table('yajur_anudaan_sanction_entries')
