"""phd_rag_documents_and_chunks

Revision ID: 8b29c54e1006
Revises: 8b29c54e1005
Create Date: 2026-10-02 05:30:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1006'
down_revision: Union[str, None] = '8b29c54e1005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create phd_admission_documents table
    op.create_table(
        'phd_admission_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('filename', sa.String(255), unique=True, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('doc_type', sa.String(50), nullable=False),
        sa.Column('academic_session', sa.String(50), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('checksum_sha256', sa.String(64), nullable=False),
        sa.Column('total_pages_or_slides', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('processing_status', sa.String(50), nullable=False, server_default='COMPLETED'),
        sa.Column('extraction_notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_phd_docs_filename', 'phd_admission_documents', ['filename'])
    op.create_index('ix_phd_docs_doc_type', 'phd_admission_documents', ['doc_type'])
    op.create_index('ix_phd_docs_checksum', 'phd_admission_documents', ['checksum_sha256'])

    # 2. Create phd_admission_chunks table
    op.create_table(
        'phd_admission_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('phd_admission_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('doc_type', sa.String(50), nullable=False),
        sa.Column('document_title', sa.String(255), nullable=False),
        sa.Column('source_filename', sa.String(255), nullable=False),
        sa.Column('academic_session', sa.String(50), nullable=True),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('slide_number', sa.Integer(), nullable=True),
        sa.Column('section_heading', sa.String(255), nullable=True),
        sa.Column('chunk_text', sa.Text(), nullable=False),
        sa.Column('token_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('checksum_sha256', sa.String(64), nullable=False),
        sa.Column('embedding', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_phd_chunks_document_id', 'phd_admission_chunks', ['document_id'])
    op.create_index('ix_phd_chunks_doc_type', 'phd_admission_chunks', ['doc_type'])
    op.create_index('ix_phd_chunks_page_number', 'phd_admission_chunks', ['page_number'])
    op.create_index('ix_phd_chunks_slide_number', 'phd_admission_chunks', ['slide_number'])


def downgrade() -> None:
    op.drop_table('phd_admission_chunks')
    op.drop_table('phd_admission_documents')
