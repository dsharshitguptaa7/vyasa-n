"""sama_certificate_signature_preservation

Revision ID: 8b29c54e1025
Revises: 8b29c54e1024
Create Date: 2026-11-12 14:40:00.000000+00:00

Enhances SAMIKSHA Certificate system with:
1. Immutable signature snapshots in sama_certificate_approvals:
   - signature_image_path_snapshot (VARCHAR 500)
   - signature_asset_version_snapshot (INTEGER)
2. Soft deletion tracking in sama_certificate_signatories:
   - deleted_at (TIMESTAMP WITH TIME ZONE)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b29c54e1025'
down_revision: Union[str, None] = '8b29c54e1024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add immutable signature snapshot columns to sama_certificate_approvals
    op.add_column(
        'sama_certificate_approvals',
        sa.Column('signature_image_path_snapshot', sa.String(500), nullable=True)
    )
    op.add_column(
        'sama_certificate_approvals',
        sa.Column('signature_asset_version_snapshot', sa.Integer(), nullable=True, server_default='1')
    )

    # Backfill existing approvals with signatory signature path where available
    op.execute("""
        UPDATE sama_certificate_approvals a
        SET signature_image_path_snapshot = s.signature_image_path,
            signature_asset_version_snapshot = COALESCE(s.signature_asset_version, 1)
        FROM sama_certificate_signatories s
        WHERE a.signatory_id = s.id AND a.signature_image_path_snapshot IS NULL
    """)

    # 2. Add soft-deletion tracking to sama_certificate_signatories
    op.add_column(
        'sama_certificate_signatories',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('sama_certificate_signatories', 'deleted_at')
    op.drop_column('sama_certificate_approvals', 'signature_asset_version_snapshot')
    op.drop_column('sama_certificate_approvals', 'signature_image_path_snapshot')
