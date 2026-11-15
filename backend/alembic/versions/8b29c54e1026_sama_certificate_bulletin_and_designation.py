"""sama_certificate_bulletin_and_designation

Revision ID: 8b29c54e1026
Revises: 8b29c54e1025
Create Date: 2026-11-14 15:05:00.000000+00:00

Enhances SAMIKSHA Certificate system with:
1. Research Bulletin volume and issue snapshot columns in sama_felicitation_certificates:
   - bulletin_volume_snapshot (INTEGER)
   - bulletin_issue_snapshot (INTEGER)
   - bulletin_period_snapshot (VARCHAR 100)
2. Academic designation snapshot in sama_certificate_authors:
   - designation_snapshot (VARCHAR 255)
3. Backfills bulletin snapshots from sama_research_bulletins for existing issued certificates
4. Cleans up artificial 'Department of Research' placeholders in sama_certificate_authors
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1026'
down_revision: Union[str, None] = '8b29c54e1025'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add bulletin snapshot columns to sama_felicitation_certificates
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('bulletin_volume_snapshot', sa.Integer(), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('bulletin_issue_snapshot', sa.Integer(), nullable=True)
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('bulletin_period_snapshot', sa.String(100), nullable=True)
    )

    # 2. Add designation snapshot column to sama_certificate_authors
    op.add_column(
        'sama_certificate_authors',
        sa.Column('designation_snapshot', sa.String(255), nullable=True)
    )

    # 3. Backfill bulletin snapshots from sama_research_bulletins
    op.execute("""
        UPDATE sama_felicitation_certificates c
        SET bulletin_volume_snapshot = b.volume_number,
            bulletin_issue_snapshot = b.issue_number,
            bulletin_period_snapshot = b.publication_period
        FROM sama_research_bulletins b
        WHERE c.bulletin_id = b.id
          AND c.bulletin_volume_snapshot IS NULL
    """)

    # 4. Clean up artificial 'Department of Research' default in sama_certificate_authors
    op.execute("""
        UPDATE sama_certificate_authors
        SET department_snapshot = NULL
        WHERE TRIM(department_snapshot) = 'Department of Research'
    """)

    # Also clean up in sama_research_authors if present
    op.execute("""
        UPDATE sama_research_authors
        SET department = NULL
        WHERE TRIM(department) = 'Department of Research'
    """)


def downgrade() -> None:
    op.drop_column('sama_certificate_authors', 'designation_snapshot')
    op.drop_column('sama_felicitation_certificates', 'bulletin_period_snapshot')
    op.drop_column('sama_felicitation_certificates', 'bulletin_issue_snapshot')
    op.drop_column('sama_felicitation_certificates', 'bulletin_volume_snapshot')
