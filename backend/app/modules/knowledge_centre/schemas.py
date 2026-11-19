"""
Pydantic schemas and contracts for VYASAⁿ AI Knowledge Centre Administration.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
import uuid
from pydantic import BaseModel, Field


class KnowledgeDashboardStatsResponse(BaseModel):
    """Platform-wide AI Knowledge Centre inventory and pipeline metrics."""
    total_documents: int = Field(..., description="Total count of all document entities")
    published_documents: int = Field(..., description="Count of currently active authoritative documents")
    pending_approvals: int = Field(..., description="Documents parsed and waiting for mandatory SADMIN approval")
    processing_documents: int = Field(..., description="Documents currently undergoing extraction or embedding")
    failed_documents: int = Field(..., description="Documents whose extraction or processing failed")
    total_passages: int = Field(..., description="Total extracted text passage chunks")
    verified_passages: int = Field(..., description="Passages verified for authoritative citation")
    indexed_passages: int = Field(..., description="Passages with active 3072-dim embeddings ready for RAG")
    domain_distribution: Dict[str, int] = Field(default_factory=dict, description="Document counts by knowledge domain")
    status_distribution: Dict[str, int] = Field(default_factory=dict, description="Document counts by lifecycle status")


class KnowledgeChunkItem(BaseModel):
    """Citation passage chunk descriptor."""
    id: uuid.UUID
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    metadata: Optional[dict] = None
    has_embedding: bool = False
    verification_status: str


class KnowledgeDocumentVersionItem(BaseModel):
    """Immutable version descriptor for a knowledge document."""
    id: uuid.UUID
    version_number: int
    storage_key: str
    checksum_sha256: str
    original_filename: str
    mime_type: str
    size_bytes: int
    extraction_status: str
    processing_error: Optional[str] = None
    approval_status: str
    approved_by_id: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    created_at: datetime
    chunk_count: int = 0


class KnowledgeDocumentItem(BaseModel):
    """High-level document descriptor."""
    id: uuid.UUID
    title: str
    description: Optional[str] = None
    domain: str
    subdomain: Optional[str] = None
    document_type: str
    academic_session: Optional[str] = None
    issuing_authority: Optional[str] = None
    effective_from: Optional[datetime] = None
    effective_until: Optional[datetime] = None
    current_version_id: Optional[uuid.UUID] = None
    status: str
    uploaded_by_id: Optional[uuid.UUID] = None
    approved_by_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
    current_version: Optional[KnowledgeDocumentVersionItem] = None
    version_count: int = 0
    chunk_count: int = 0


class KnowledgeDocumentDetailResponse(BaseModel):
    """Full detail view for SADMIN document inspection."""
    document: KnowledgeDocumentItem
    versions: List[KnowledgeDocumentVersionItem] = Field(default_factory=list)
    chunks_sample: List[KnowledgeChunkItem] = Field(default_factory=list)


class KnowledgeDocumentListResponse(BaseModel):
    """Paginated document listing response."""
    items: List[KnowledgeDocumentItem]
    total: int
    skip: int
    limit: int


class KnowledgeApproveRequest(BaseModel):
    """SADMIN approval request."""
    version_id: Optional[uuid.UUID] = Field(default=None, description="Specific version to approve (defaults to document current version)")


class KnowledgeRejectRequest(BaseModel):
    """SADMIN rejection request with mandatory reason."""
    reason: str = Field(..., min_length=3, description="Mandatory audit explanation for document rejection")
    version_id: Optional[uuid.UUID] = Field(default=None, description="Specific version to reject")


class KnowledgeRetryRequest(BaseModel):
    """Retry extraction request."""
    version_id: Optional[uuid.UUID] = Field(default=None, description="Version to retry")


class KnowledgeUploadResponse(BaseModel):
    """Upload acknowledgement."""
    success: bool = True
    document_id: uuid.UUID
    version_id: uuid.UUID
    version_number: int
    storage_key: str
    checksum_sha256: str
    status: str
    extraction_status: str
    message: str


class KnowledgeRetrievalRequest(BaseModel):
    """Administrative multi-domain knowledge retrieval query."""
    query: str = Field(..., min_length=2, description="Institutional search query")
    domains: Optional[List[str]] = Field(default=None, description="Optional domain whitelist")
    document_types: Optional[List[str]] = Field(default=None, description="Optional document type whitelist")
    academic_session: Optional[str] = Field(default=None, description="Optional academic session filter (e.g. 2026-27)")
    issuing_authority: Optional[str] = Field(default=None, description="Optional issuing authority filter")
    subdomain: Optional[str] = Field(default=None, description="Optional subdomain filter")
    top_k: int = Field(default=5, ge=1, le=20, description="Maximum passages to return")
    min_score: float = Field(default=0.25, ge=0.0, le=1.0, description="Minimum relevance threshold")
    semantic_weight: float = Field(default=0.70, ge=0.0, le=1.0, description="Semantic similarity weight")
    lexical_weight: float = Field(default=0.30, ge=0.0, le=1.0, description="Lexical keyword overlap weight")


class KnowledgeRetrievedEvidenceItem(BaseModel):
    """Authoritative retrieved passage descriptor with full citation provenance."""
    chunk_id: str
    document_id: str
    version_id: str
    version_number: int
    document_title: str
    domain: str
    subdomain: Optional[str] = None
    document_type: str
    academic_session: Optional[str] = None
    issuing_authority: Optional[str] = None
    section_heading: Optional[str] = None
    page_number: Optional[int] = None
    chunk_index: int
    source_filename: str
    storage_key: str
    content: str
    relevance_score: float
    semantic_score: float
    lexical_score: float
    retrieval_method: str
    embedding_model: str
    embedding_dimensions: int
    citation_label: str


class KnowledgeRetrievalResponse(BaseModel):
    """Retrieval response envelope."""
    success: bool = True
    query: str
    total_candidates_examined: int
    matched_passages_count: int
    top_evidence: List[KnowledgeRetrievedEvidenceItem]
    applied_filters: Dict[str, Any]
    has_sufficient_evidence: bool
    diagnostic_warnings: List[str] = Field(default_factory=list)
