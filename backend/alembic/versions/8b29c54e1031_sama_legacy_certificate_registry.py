"""sama_legacy_certificate_registry

Revision ID: 8b29c54e1031
Revises: 8b29c54e1030
Create Date: 2026-11-19 14:15:00.000000+00:00

Establishes dedicated historical certificate registry for SAMIKSHA archival recovery:
1. Creates sama_legacy_certificate_registry:
   - Stores immutable historical certificate records, original recipient names, paper titles,
     and cryptographic verification tokens recovered from physical print batches.
   - Decoupled from active certificate ledger to preserve zero-mutation guarantees.
2. Creates unique index on verification_token to prevent duplicate or conflicting legacy tokens.
3. Supports multi-tenancy and historical verification fallback.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1031'
down_revision: Union[str, None] = '8b29c54e1030'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sama_legacy_certificate_registry',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('certificate_number', sa.String(100), nullable=False, comment="Original serial number (e.g. 'CSJMU/SAMIKSHA/2026/000002')"),
        sa.Column('recipient_name', sa.String(255), nullable=False, comment="Meritorious researcher name"),
        sa.Column('research_title', sa.Text(), nullable=True, comment="Original research publication title"),
        sa.Column('certificate_type', sa.String(50), nullable=False, server_default='INCENTIVE_AWARD', comment="INCENTIVE_AWARD | SCHOLARLY_FELICITATION | APPRECIATION_AWARD"),
        sa.Column('issue_reference', sa.String(255), nullable=True, comment="Bulletin issue citation (e.g. Volume 2, Issue 3)"),
        sa.Column('sanction_amount', sa.String(50), nullable=True, comment="Sanctioned amount (e.g. INR 6,000)"),
        sa.Column('verification_token', sa.String(100), nullable=False, comment="Original 32-hex QR verification token"),
        sa.Column('source_pdf_reference', sa.String(500), nullable=True, comment="File path to original print PDF"),
        sa.Column('source_sha256', sa.String(64), nullable=True, comment="SHA-256 document checksum"),
        sa.Column('is_legacy', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revocation_reason', sa.Text(), nullable=True),
        sa.Column('recovery_source', sa.String(100), nullable=False, comment="Forensic source provenance"),
        sa.Column('recovery_metadata', postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('ix_sama_legacy_cert_number', 'sama_legacy_certificate_registry', ['certificate_number'])
    op.create_index('ix_sama_legacy_cert_verification_token', 'sama_legacy_certificate_registry', ['verification_token'], unique=True)
    op.create_index('ix_sama_legacy_cert_is_legacy', 'sama_legacy_certificate_registry', ['is_legacy'])
    op.create_index('ix_sama_legacy_cert_type', 'sama_legacy_certificate_registry', ['certificate_type'])


def downgrade() -> None:
    op.drop_index('ix_sama_legacy_cert_type', table_name='sama_legacy_certificate_registry')
    op.drop_index('ix_sama_legacy_cert_is_legacy', table_name='sama_legacy_certificate_registry')
    op.drop_index('ix_sama_legacy_cert_verification_token', table_name='sama_legacy_certificate_registry')
    op.drop_index('ix_sama_legacy_cert_number', table_name='sama_legacy_certificate_registry')
    op.drop_table('sama_legacy_certificate_registry')
