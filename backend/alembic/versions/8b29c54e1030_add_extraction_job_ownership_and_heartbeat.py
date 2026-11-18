"""add_extraction_job_ownership_and_heartbeat

Revision ID: 8b29c54e1030
Revises: 8b29c54e1029
Create Date: 2026-11-19 03:15:00.000000+00:00

Establishes reliable extraction worker job ownership and progress heartbeats
for VYASAⁿ AI Knowledge Centre:
1. Adds job_id (UUID) to ai_knowledge_document_versions:
   - Unique job identifier/token ensuring only the active authorized worker can commit results.
2. Adds heartbeat_at (DateTime with timezone) to ai_knowledge_document_versions:
   - Monotonically updated timestamp preventing long-running active extractions from being reclaimed.
3. Creates query optimization indexes for job lookup and stale recovery scanning.
4. Fully nullable and backward-compatible for seamless zero-downtime deployment.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1030'
down_revision: Union[str, None] = '8b29c54e1029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add job_id and heartbeat_at columns to ai_knowledge_document_versions
    op.add_column(
        'ai_knowledge_document_versions',
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'ai_knowledge_document_versions',
        sa.Column('heartbeat_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 2. Add indexes for job lookup and stale recovery queries
    op.create_index(
        'ix_ai_knowledge_doc_versions_job_id',
        'ai_knowledge_document_versions',
        ['job_id'],
    )
    op.create_index(
        'ix_ai_knowledge_doc_versions_heartbeat_at',
        'ai_knowledge_document_versions',
        ['heartbeat_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_ai_knowledge_doc_versions_heartbeat_at', table_name='ai_knowledge_document_versions')
    op.drop_index('ix_ai_knowledge_doc_versions_job_id', table_name='ai_knowledge_document_versions')
    op.drop_column('ai_knowledge_document_versions', 'heartbeat_at')
    op.drop_column('ai_knowledge_document_versions', 'job_id')
