# -*- coding: utf-8 -*-
"""
VYASAⁿ AI Knowledge Centre — Secure Multi-Domain RAG Retrieval Engine
Implements version-aware, multi-domain hybrid retrieval with strict publication eligibility
and authoritative citation provenance.

Publication Eligibility Requirements:
1. AiKnowledgeDocument.status == 'active'
2. AiKnowledgeChunk.version_id == AiKnowledgeDocument.current_version_id
3. AiKnowledgeDocumentVersion.approval_status == 'approved'
4. AiKnowledgeChunk.verification_status IN ('indexed', 'verified')
5. Version extraction_status != 'failed'
6. Embedding provenance matches active model (e.g. gemini-embedding-001) and 768 dimensions.

Guarantees:
- Enforced directly at SQL query level; drafts, rejected, archived, historical, and unapproved versions are never returned.
- Pure database provenance for citations (document_title, page_number, section_heading, authority).
- Zero hallucination fallback: No evidence returns a structured empty result.
"""

from dataclasses import dataclass, field
import hashlib
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.core.config import settings
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.phd_rag.services.embedding_service import (
    EmbeddingService,
    embedding_service,
    DEFAULT_EMBEDDING_DIMENSIONS,
    DEFAULT_EMBEDDING_MODEL,
)

logger = logging.getLogger("vyasa.knowledge_centre.retrieval")

# Official Institutional Domains and Display Names
DOMAIN_DISPLAY_NAMES: Dict[str, str] = {
    "doctoral-studies": "Doctoral Studies",
    "admissions": "Admissions & Eligibility",
    "academic-regulations": "Academic Regulations",
    "research-development": "Research & Innovation",
    "university-administration": "University Administration",
}


# ==============================================================================
# Typed Contracts & Data Structures
# ==============================================================================

@dataclass
class KnowledgeRetrievalQuery:
    """Typed search request for multi-domain university knowledge retrieval."""
    query: str
    domains: Optional[List[str]] = None
    document_types: Optional[List[str]] = None
    academic_session: Optional[str] = None
    issuing_authority: Optional[str] = None
    subdomain: Optional[str] = None
    top_k: int = 5
    min_score: float = 0.25
    semantic_weight: float = 0.70
    lexical_weight: float = 0.30


@dataclass
class KnowledgeRetrievedEvidence:
    """
    Ranked passage chunk with full institutional citation provenance.
    All citation metadata originates strictly from authoritative database records.
    """
    chunk_id: str
    document_id: str
    version_id: str
    version_number: int
    document_title: str
    domain: str
    subdomain: Optional[str]
    document_type: str
    academic_session: Optional[str]
    issuing_authority: Optional[str]
    section_heading: Optional[str]
    page_number: Optional[int]
    chunk_index: int
    source_filename: str
    storage_key: str
    content: str
    relevance_score: float
    semantic_score: float
    lexical_score: float
    retrieval_method: str  # "hybrid" | "semantic" | "lexical"
    embedding_model: str
    embedding_dimensions: int
    citation_label: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "document_id": self.document_id,
            "version_id": self.version_id,
            "version_number": self.version_number,
            "document_title": self.document_title,
            "domain": self.domain,
            "subdomain": self.subdomain,
            "document_type": self.document_type,
            "academic_session": self.academic_session,
            "issuing_authority": self.issuing_authority,
            "section_heading": self.section_heading,
            "page_number": self.page_number,
            "chunk_index": self.chunk_index,
            "source_filename": self.source_filename,
            "storage_key": self.storage_key,
            "content": self.content,
            "relevance_score": round(self.relevance_score, 4),
            "semantic_score": round(self.semantic_score, 4),
            "lexical_score": round(self.lexical_score, 4),
            "retrieval_method": self.retrieval_method,
            "embedding_model": self.embedding_model,
            "embedding_dimensions": self.embedding_dimensions,
            "citation_label": self.citation_label,
        }


@dataclass
class KnowledgeRetrievalResult:
    """Complete retrieval response envelope."""
    query: str
    total_candidates_examined: int
    matched_passages_count: int
    top_evidence: List[KnowledgeRetrievedEvidence]
    applied_filters: Dict[str, Any]
    has_sufficient_evidence: bool
    diagnostic_warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "total_candidates_examined": self.total_candidates_examined,
            "matched_passages_count": self.matched_passages_count,
            "top_evidence": [e.to_dict() for e in self.top_evidence],
            "applied_filters": self.applied_filters,
            "has_sufficient_evidence": self.has_sufficient_evidence,
            "diagnostic_warnings": self.diagnostic_warnings,
        }


# ==============================================================================
# Helper Functions
# ==============================================================================

def format_citation_label(
    domain: str,
    title: str,
    page: Optional[int],
    heading: Optional[str],
    session: Optional[str] = None,
    authority: Optional[str] = None,
) -> str:
    """
    Constructs an institutional citation label based on authoritative database attributes.
    Example: '[Doctoral Studies] Ph.D. Ordinance 2026-27 (2026-27), Page 4, Section: Clause 3: Duration'
    """
    domain_label = DOMAIN_DISPLAY_NAMES.get(domain, domain.replace("-", " ").title())
    header = f"[{domain_label}] {title}"
    if session:
        header += f" ({session})"

    locs = []
    if page is not None:
        locs.append(f"Page {page}")
    if heading:
        locs.append(f"Section: {heading}")
    if authority:
        locs.append(f"Authority: {authority}")

    if locs:
        return f"{header}, {', '.join(locs)}"
    return header


def compute_lexical_score(
    query: str,
    text: str,
    title: str = "",
    heading: str = "",
) -> float:
    """
    Computes lexical keyword overlap, phrase matching, and structural heading bonuses.
    """
    cleaned_query = query.lower().strip()
    query_words = set(re.findall(r"\w+", cleaned_query))
    if not query_words:
        return 0.0

    # Common English stopwords filtered
    stopwords = {
        "what", "is", "the", "for", "in", "of", "and", "to", "a", "an", "are",
        "how", "many", "can", "do", "does", "any", "which", "who", "whom",
        "this", "that", "these", "those", "from", "with", "by", "at", "on",
    }
    meaningful = {w for w in query_words if w not in stopwords and len(w) > 2}
    if not meaningful:
        meaningful = query_words

    text_words = set(re.findall(r"\w+", text.lower()))
    matched = meaningful.intersection(text_words)
    overlap = len(matched) / len(meaningful) if meaningful else 0.0

    # Exact phrase matching bonus (+0.25)
    if cleaned_query in text.lower():
        overlap += 0.25

    # Document title and section heading term bonus (+0.15)
    title_words = set(re.findall(r"\w+", title.lower()))
    heading_words = set(re.findall(r"\w+", heading.lower()))
    if meaningful.intersection(title_words) or meaningful.intersection(heading_words):
        overlap += 0.15

    return min(overlap, 1.0)


# ==============================================================================
# Knowledge Retrieval Service
# ==============================================================================

class KnowledgeRetrievalService:
    """
    Dedicated Multi-Domain Retrieval Engine for Authoritative University Knowledge.
    Enforces strict publication eligibility at the database query level,
    combines semantic vector similarity and lexical token overlap,
    suppresses duplicate passages, and constructs precise citation provenance.
    """

    def __init__(
        self,
        embedder: Optional[EmbeddingService] = None,
        dimensions: int = DEFAULT_EMBEDDING_DIMENSIONS,
    ):
        self.embedder = embedder or embedding_service
        self.dimensions = dimensions
        self.active_model = getattr(self.embedder, "model_name", DEFAULT_EMBEDDING_MODEL)

    def retrieve(
        self,
        retrieval_query: KnowledgeRetrievalQuery,
        db: Session,
    ) -> KnowledgeRetrievalResult:
        """
        Executes multi-domain retrieval with strict publication eligibility:
        1. Encodes query into 768-dimensional normalized vector.
        2. Queries database with strict SQL JOINs enforcing:
           - AiKnowledgeDocument.status == 'active'
           - AiKnowledgeDocument.current_version_id == AiKnowledgeDocumentVersion.id
           - AiKnowledgeChunk.version_id == AiKnowledgeDocument.current_version_id
           - AiKnowledgeDocumentVersion.approval_status == 'approved'
           - AiKnowledgeChunk.verification_status IN ('indexed', 'verified')
           - AiKnowledgeDocumentVersion.extraction_status != 'failed'
        3. Applies domain, document_type, academic_session, and authority filters.
        4. Validates embedding provenance (model, dimensions, finite floats).
        5. Computes hybrid (semantic + lexical) scores.
        6. Suppresses duplicate passages.
        7. Filters by minimum relevance threshold and bounds top_k results.
        """
        raw_query = retrieval_query.query.strip()
        applied_filters = {
            "domains": retrieval_query.domains,
            "document_types": retrieval_query.document_types,
            "academic_session": retrieval_query.academic_session,
            "issuing_authority": retrieval_query.issuing_authority,
            "subdomain": retrieval_query.subdomain,
            "top_k": retrieval_query.top_k,
            "min_score": retrieval_query.min_score,
            "semantic_weight": retrieval_query.semantic_weight,
            "lexical_weight": retrieval_query.lexical_weight,
        }

        if len(raw_query) < 2:
            return KnowledgeRetrievalResult(
                query=raw_query,
                total_candidates_examined=0,
                matched_passages_count=0,
                top_evidence=[],
                applied_filters=applied_filters,
                has_sufficient_evidence=False,
                diagnostic_warnings=["Query length must be at least 2 characters."],
            )

        # 1. Embed query
        diagnostic_warnings: List[str] = []
        try:
            query_vector = np.array(self.embedder.embed_text(raw_query), dtype=np.float32)
            q_norm = float(np.linalg.norm(query_vector))
        except Exception as emb_exc:
            logger.error("Failed to generate query embedding: %s", emb_exc)
            diagnostic_warnings.append(f"Query embedding generation failed: {emb_exc}")
            query_vector = np.zeros(self.dimensions, dtype=np.float32)
            q_norm = 0.0

        # 2. Build Strict SQL Query
        # Joins all 3 entities and enforces active, approved, current-version-only criteria
        stmt = (
            select(AiKnowledgeChunk, AiKnowledgeDocument, AiKnowledgeDocumentVersion)
            .join(AiKnowledgeDocument, AiKnowledgeChunk.document_id == AiKnowledgeDocument.id)
            .join(AiKnowledgeDocumentVersion, AiKnowledgeChunk.version_id == AiKnowledgeDocumentVersion.id)
            .where(
                # Condition 1: Document must be active
                AiKnowledgeDocument.status == KnowledgeDocumentStatus.ACTIVE.value,
                # Condition 2: Version must be the current active version pointer
                AiKnowledgeDocument.current_version_id == AiKnowledgeDocumentVersion.id,
                # Condition 3: Chunk version must match the document's current version
                AiKnowledgeChunk.version_id == AiKnowledgeDocument.current_version_id,
                # Condition 4: Version must have explicit SADMIN approval
                AiKnowledgeDocumentVersion.approval_status == KnowledgeApprovalStatus.APPROVED.value,
                # Condition 5: Chunk verification status must be indexed or verified
                AiKnowledgeChunk.verification_status.in_([
                    KnowledgeVerificationStatus.INDEXED.value,
                    KnowledgeVerificationStatus.VERIFIED.value,
                ]),
                # Condition 6: Extraction status must not be failed
                AiKnowledgeDocumentVersion.extraction_status != KnowledgeExtractionStatus.FAILED.value,
            )
        )

        # 3. Apply Multi-Domain and Metadata Filters
        if retrieval_query.domains:
            stmt = stmt.where(AiKnowledgeDocument.domain.in_(retrieval_query.domains))

        if retrieval_query.document_types:
            stmt = stmt.where(AiKnowledgeDocument.document_type.in_(retrieval_query.document_types))

        if retrieval_query.academic_session:
            stmt = stmt.where(AiKnowledgeDocument.academic_session == retrieval_query.academic_session)

        if retrieval_query.issuing_authority:
            auth_filter = f"%{retrieval_query.issuing_authority.strip()}%"
            stmt = stmt.where(AiKnowledgeDocument.issuing_authority.ilike(auth_filter))

        if retrieval_query.subdomain:
            stmt = stmt.where(AiKnowledgeDocument.subdomain == retrieval_query.subdomain)

        # Execute candidate fetch
        candidate_rows = db.execute(stmt).all()
        total_candidates = len(candidate_rows)

        if total_candidates == 0:
            return KnowledgeRetrievalResult(
                query=raw_query,
                total_candidates_examined=0,
                matched_passages_count=0,
                top_evidence=[],
                applied_filters=applied_filters,
                has_sufficient_evidence=False,
                diagnostic_warnings=diagnostic_warnings,
            )

        # 4. Score and Rank Eligible Candidates
        scored_evidence: List[KnowledgeRetrievedEvidence] = []
        seen_passage_hashes: Set[str] = set()

        for chunk, doc, ver in candidate_rows:
            meta = chunk.chunk_metadata or {}

            # --- Embedding Provenance Validation ---
            # Exclude chunks whose embedding model does not match active embedding configuration
            chunk_model = meta.get("embedding_model")
            norm_chunk_m = (chunk_model or "").replace("models/", "").strip().lower()
            norm_active_m = (self.active_model or "").replace("models/", "").strip().lower()
            if chunk_model and self.active_model and norm_chunk_m != norm_active_m:
                warning_msg = (
                    f"Excluded chunk {chunk.id}: model '{chunk_model}' incompatible with active '{self.active_model}'."
                )
                logger.warning(warning_msg)
                diagnostic_warnings.append(warning_msg)
                continue

            # --- Vector Dimension & Finite Check ---
            semantic_score = 0.0
            if chunk.embedding and q_norm > 0:
                try:
                    c_vec = np.array(chunk.embedding, dtype=np.float32)
                    if c_vec.ndim != 1 or len(c_vec) != len(query_vector):
                        warning_msg = (
                            f"Excluded chunk {chunk.id}: dimension mismatch (expected {len(query_vector)}, got {len(c_vec)})."
                        )
                        logger.warning(warning_msg)
                        diagnostic_warnings.append(warning_msg)
                        continue
                    elif not np.all(np.isfinite(c_vec)):
                        warning_msg = f"Excluded chunk {chunk.id}: vector contains non-finite values (NaN/Inf)."
                        logger.warning(warning_msg)
                        diagnostic_warnings.append(warning_msg)
                        continue
                    else:
                        c_norm = float(np.linalg.norm(c_vec))
                        if c_norm > 0:
                            raw_sim = float(np.dot(query_vector, c_vec) / (q_norm * c_norm))
                            semantic_score = max(0.0, min(1.0, raw_sim))
                except Exception as sim_err:
                    logger.warning("Error calculating similarity for chunk %s: %s", chunk.id, sim_err)
                    semantic_score = 0.0

            # --- Lexical Keyword & Phrase Overlap ---
            section_heading = meta.get("section_heading")
            lexical_score = compute_lexical_score(
                query=raw_query,
                text=chunk.content,
                title=doc.title,
                heading=section_heading or "",
            )

            # --- Hybrid Combined Score ---
            sw = retrieval_query.semantic_weight
            lw = retrieval_query.lexical_weight
            combined_score = (sw * semantic_score) + (lw * lexical_score)

            # --- Threshold Check ---
            if combined_score < retrieval_query.min_score:
                continue

            # --- Duplicate Passage Suppression ---
            # Suppress identical boilerplates / passages using sha256 or text content hash
            text_hash = hashlib.sha256(chunk.content.strip().lower().encode("utf-8")).hexdigest()
            if text_hash in seen_passage_hashes:
                continue
            seen_passage_hashes.add(text_hash)

            # Determine retrieval method tag
            if semantic_score > 0 and lexical_score > 0:
                retrieval_method = "hybrid"
            elif semantic_score > 0:
                retrieval_method = "semantic"
            else:
                retrieval_method = "lexical"

            # Construct citation label strictly from database attributes
            citation = format_citation_label(
                domain=doc.domain,
                title=doc.title,
                page=chunk.page_number,
                heading=section_heading,
                session=doc.academic_session,
                authority=doc.issuing_authority,
            )

            evidence_item = KnowledgeRetrievedEvidence(
                chunk_id=str(chunk.id),
                document_id=str(doc.id),
                version_id=str(ver.id),
                version_number=ver.version_number,
                document_title=doc.title,
                domain=doc.domain,
                subdomain=doc.subdomain,
                document_type=doc.document_type,
                academic_session=doc.academic_session,
                issuing_authority=doc.issuing_authority,
                section_heading=section_heading,
                page_number=chunk.page_number,
                chunk_index=chunk.chunk_index,
                source_filename=ver.original_filename,
                storage_key=ver.storage_key,
                content=chunk.content,
                relevance_score=combined_score,
                semantic_score=semantic_score,
                lexical_score=lexical_score,
                retrieval_method=retrieval_method,
                embedding_model=chunk_model or self.active_model,
                embedding_dimensions=len(chunk.embedding) if chunk.embedding else self.dimensions,
                citation_label=citation,
            )
            scored_evidence.append(evidence_item)

        # 5. Sort by Relevance Score Descending
        scored_evidence.sort(key=lambda x: x.relevance_score, reverse=True)

        # 6. Apply Top-K Bound
        top_k_evidence = scored_evidence[: retrieval_query.top_k]
        has_sufficient = len(top_k_evidence) > 0

        return KnowledgeRetrievalResult(
            query=raw_query,
            total_candidates_examined=total_candidates,
            matched_passages_count=len(scored_evidence),
            top_evidence=top_k_evidence,
            applied_filters=applied_filters,
            has_sufficient_evidence=has_sufficient,
            diagnostic_warnings=diagnostic_warnings,
        )


# Singleton instance
knowledge_retrieval_service = KnowledgeRetrievalService()
