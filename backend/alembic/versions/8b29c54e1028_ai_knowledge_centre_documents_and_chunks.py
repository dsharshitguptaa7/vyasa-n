"""ai_knowledge_centre_documents_and_chunks

Revision ID: 8b29c54e1028
Revises: 8b29c54e1027
Create Date: 2026-11-18 12:00:00.000000+00:00

Establishes dedicated database schema for VYASAⁿ AI Knowledge Centre:
1. Creates ai_knowledge_documents:
   - Central document registry, domain categorization, issuance metadata, and active version tracking.
2. Creates ai_knowledge_document_versions:
   - Immutable version snapshots with DigitalOcean Spaces object keys, SHA-256 checksums, and SADMIN approval states.
3. Creates ai_knowledge_chunks:
   - Extracted text passages, page citations, metadata, and JSONB embeddings (3072-dim Gemini / offline compatible).
4. Configures relational constraints, cascade rules, and query optimization indexes.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b29c54e1028'
down_revision: Union[str, None] = '8b29c54e1027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ai_knowledge_documents table
    op.create_table(
        'ai_knowledge_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('domain', sa.String(100), nullable=False),
        sa.Column('subdomain', sa.String(100), nullable=True),
        sa.Column('document_type', sa.String(50), nullable=False),
        sa.Column('academic_session', sa.String(50), nullable=True),
        sa.Column('issuing_authority', sa.String(255), nullable=True),
        sa.Column('effective_from', sa.DateTime(timezone=True), nullable=True),
        sa.Column('effective_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_version_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('uploaded_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_ai_knowledge_docs_domain', 'ai_knowledge_documents', ['domain'])
    op.create_index('ix_ai_knowledge_docs_subdomain', 'ai_knowledge_documents', ['subdomain'])
    op.create_index('ix_ai_knowledge_docs_doc_type', 'ai_knowledge_documents', ['document_type'])
    op.create_index('ix_ai_knowledge_docs_status', 'ai_knowledge_documents', ['status'])
    op.create_index('ix_ai_knowledge_docs_uploaded_by', 'ai_knowledge_documents', ['uploaded_by_id'])
    op.create_index('ix_ai_knowledge_docs_approved_by', 'ai_knowledge_documents', ['approved_by_id'])
    op.create_index('ix_ai_knowledge_docs_current_version_id', 'ai_knowledge_documents', ['current_version_id'])

    # 2. Create ai_knowledge_document_versions table
    op.create_table(
        'ai_knowledge_document_versions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_knowledge_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('storage_key', sa.String(512), nullable=False),
        sa.Column('checksum_sha256', sa.String(64), nullable=False),
        sa.Column('original_filename', sa.String(255), nullable=False),
        sa.Column('mime_type', sa.String(100), nullable=False),
        sa.Column('size_bytes', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('extraction_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('processing_error', sa.Text(), nullable=True),
        sa.Column('approval_status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('approved_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('document_id', 'version_number', name='uq_knowledge_doc_version_number'),
        sa.UniqueConstraint('storage_key', name='uq_knowledge_doc_version_storage_key'),
    )
    op.create_index('ix_ai_knowledge_versions_doc_id', 'ai_knowledge_document_versions', ['document_id'])
    op.create_index('ix_ai_knowledge_versions_checksum', 'ai_knowledge_document_versions', ['checksum_sha256'])
    op.create_index('ix_ai_knowledge_versions_extract_status', 'ai_knowledge_document_versions', ['extraction_status'])
    op.create_index('ix_ai_knowledge_versions_approval_status', 'ai_knowledge_document_versions', ['approval_status'])

    # 3. Add circular foreign key from ai_knowledge_documents.current_version_id to ai_knowledge_document_versions.id
    op.create_foreign_key(
        'fk_ai_knowledge_documents_current_version_id',
        'ai_knowledge_documents',
        'ai_knowledge_document_versions',
        ['current_version_id'],
        ['id'],
        ondelete='SET NULL',
        use_alter=True,
    )

    # 4. Create ai_knowledge_chunks table
    op.create_table(
        'ai_knowledge_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_knowledge_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ai_knowledge_document_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('metadata', postgresql.JSONB(), nullable=True),
        sa.Column('embedding', postgresql.JSONB(), nullable=True),
        sa.Column('verification_status', sa.String(50), nullable=False, server_default='unverified'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('version_id', 'chunk_index', name='uq_knowledge_chunk_version_idx'),
    )
    op.create_index('ix_ai_knowledge_chunks_doc_id', 'ai_knowledge_chunks', ['document_id'])
    op.create_index('ix_ai_knowledge_chunks_version_id', 'ai_knowledge_chunks', ['version_id'])
    op.create_index('ix_ai_knowledge_chunks_page', 'ai_knowledge_chunks', ['page_number'])
    op.create_index('ix_ai_knowledge_chunks_verification', 'ai_knowledge_chunks', ['verification_status'])


def downgrade() -> None:
    op.drop_constraint('fk_ai_knowledge_documents_current_version_id', 'ai_knowledge_documents', type_='foreignkey')
    op.drop_table('ai_knowledge_chunks')
    op.drop_table('ai_knowledge_document_versions')
    op.drop_table('ai_knowledge_documents')
