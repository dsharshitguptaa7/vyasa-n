"""sama_certificate_scheduling_and_activation

Revision ID: 8b29c54e1027
Revises: 8b29c54e1026
Create Date: 2026-11-15 08:00:00.000000+00:00

Enhances SAMIKSHA Certificate system with:
1. Scheduled certificate issuance support:
   - scheduled_issue_date (DATE)
   - activated_at (TIMESTAMP WITH TIME ZONE)
2. Index on (scheduled_issue_date, status) for efficient due-certificate activation lookup
3. Backfills existing legacy certificates so all historical ISSUED records remain active
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1027'
down_revision: Union[str, None] = '8b29c54e1026'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add scheduled_issue_date and activated_at columns to sama_felicitation_certificates
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('scheduled_issue_date', sa.Date(), nullable=True, comment="Official scheduled calendar date of issuance in Asia/Kolkata")
    )
    op.add_column(
        'sama_felicitation_certificates',
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True, comment="Exact timestamp when certificate transitioned to ISSUED and became publicly accessible")
    )

    # 2. Add index for scheduling and due activation queries
    op.create_index(
        'ix_sama_cert_scheduled_issue_date',
        'sama_felicitation_certificates',
        ['scheduled_issue_date', 'status']
    )

    # 3. Backfill historical records safely
    # Set scheduled_issue_date from issued_at or created_at in Asia/Kolkata
    op.execute("""
        UPDATE sama_felicitation_certificates
        SET scheduled_issue_date = COALESCE((issued_at AT TIME ZONE 'Asia/Kolkata')::date, (created_at AT TIME ZONE 'Asia/Kolkata')::date)
        WHERE scheduled_issue_date IS NULL
    """)

    # Set activated_at for already issued certificates
    op.execute("""
        UPDATE sama_felicitation_certificates
        SET activated_at = COALESCE(issued_at, created_at)
        WHERE status = 'ISSUED' AND activated_at IS NULL
    """)


def downgrade() -> None:
    op.drop_index('ix_sama_cert_scheduled_issue_date', table_name='sama_felicitation_certificates')
    op.drop_column('sama_felicitation_certificates', 'activated_at')
    op.drop_column('sama_felicitation_certificates', 'scheduled_issue_date')
