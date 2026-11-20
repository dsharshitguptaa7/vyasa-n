import logging
import re
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import select, or_, and_

from app.modules.phd_rag.models import PhdChunk, PhdDocument
from app.modules.phd_rag.services.embedding_service import embedding_service, EmbeddingService
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)

logger = logging.getLogger("vyasa.phd_rag.retrieval")


@dataclass
class CandidatePassage:
    """
    Unified candidate passage adapter bridging legacy phd_admission chunks
    and authoritative CMS AiKnowledgeChunk records.
    """
    id: str
    doc_type: str
    document_title: str
    source_filename: str
    academic_session: Optional[str]
    page_number: Optional[int]
    slide_number: Optional[int]
    section_heading: Optional[str]
    chunk_text: str
    embedding: Optional[list]
    chunk_metadata: Optional[dict] = None
    source_table: str = "phd_legacy"


@dataclass
class RetrievedEvidence:
    """
    Ranked retrieved passage chunk with exact citation provenance.
    """
    chunk_id: str
    doc_type: str
    document_title: str
    source_filename: str
    academic_session: Optional[str]
    page_number: Optional[int]
    slide_number: Optional[int]
    section_heading: Optional[str]
    chunk_text: str
    relevance_score: float
    citation_label: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "doc_type": self.doc_type,
            "document_title": self.document_title,
            "source_filename": self.source_filename,
            "academic_session": self.academic_session,
            "page_number": self.page_number,
            "slide_number": self.slide_number,
            "section_heading": self.section_heading,
            "chunk_text": self.chunk_text,
            "relevance_score": round(self.relevance_score, 4),
            "citation_label": self.citation_label,
        }


class PhdRetrievalService:
    """
    Multi-stage evidence-aware retrieval engine for Ph.D. Admission inquiries.
    Enforces document routing rules, coursework PPT prioritization,
    semantic vector cosine similarity, keyword/FTS scoring, and conflict surfacing.
    """

    def __init__(self, embedder: Optional[EmbeddingService] = None):
        self.embedder = embedder or embedding_service

    @staticmethod
    def classify_query_intent(query: str) -> Dict[str, Any]:
        """
        Analyzes query keywords to determine document prioritization.
        """
        lower = query.lower()

        is_explicit_ordinance = bool(
            re.search(r"\bordinance\b|clause\s*6|\bstatute\b|\bregulation\b", lower)
        )
        is_conflict_or_comparison = bool(
            re.search(r"\bversus\b|\bvs\b|\bdiffer\b|\bconflict\b|\bdiscrepan\b|\bcompare\b|\bboth\b", lower)
            or (re.search(r"\bordinance\b", lower) and re.search(r"\b(ppt|presentation|slide)\b", lower))
        )
        is_coursework = bool(
            re.search(r"course\s*work|coursework|credit|mid[\s-]?term|cgpa|practicum|orientation|attendance\s*requirement|syllabus|ethics paper|mooc", lower)
        )
        is_admission = bool(
            re.search(r"admission|apply|application|fee|form|seat|vacancy|exemption|national level|entrance test|eligib\w*|fellowship|scholarship|stipend|percentage|deadline|date|interview|campus college", lower)
        )
        is_ordinance = bool(
            re.search(r"ordinance|rule|regulation|act|supervisor|guide|duration|minimum duration|maximum duration|co-supervisor|synopsis|rdc|living author|statutory|degree conferral", lower)
        )
        is_credit_specific = bool(
            re.search(r"credit|credits|how many credit|minimum credit", lower)
        )

        return {
            "is_coursework": is_coursework,
            "is_admission": is_admission,
            "is_ordinance": is_ordinance,
            "is_credit_specific": is_credit_specific,
            "is_explicit_ordinance": is_explicit_ordinance,
            "is_conflict_or_comparison": is_conflict_or_comparison,
        }

    @staticmethod
    def format_citation_label(
        title: str,
        page: Optional[int],
        slide: Optional[int],
        heading: Optional[str],
        session: Optional[str] = None,
    ) -> str:
        loc = []
        if slide is not None:
            loc.append(f"Slide {slide}")
        elif page is not None:
            loc.append(f"Page {page}")
        if heading:
            loc.append(f"Section: {heading}")
        
        session_str = f" ({session})" if session else ""
        loc_str = f", {', '.join(loc)}" if loc else ""
        return f"{title}{session_str}{loc_str}"

    def compute_lexical_overlap(self, query: str, text: str, title: str = "", heading: str = "") -> float:
        """
        Computes token overlap and phrase matching score with title/heading awareness.
        """
        query_words = set(re.findall(r"\w+", query.lower()))
        if not query_words:
            return 0.0

        # Filter out very common stopwords
        stopwords = {
            "what", "is", "the", "for", "in", "of", "and", "to", "a", "an", "are",
            "how", "many", "can", "do", "does", "any", "which", "who", "whom",
            "this", "that", "these", "those", "from", "with", "by", "at", "on",
        }
        meaningful = {w for w in query_words if w not in stopwords and len(w) > 2}
        if not meaningful:
            meaningful = query_words

        text_lower = text.lower()
        text_words = set(re.findall(r"\w+", text_lower))
        matched = meaningful.intersection(text_words)
        overlap = len(matched) / len(meaningful) if meaningful else 0.0

        # Exact phrase bonus
        if query.lower().strip() in text_lower:
            overlap += 0.30

        # Document title or heading match bonus
        title_words = set(re.findall(r"\w+", title.lower()))
        heading_words = set(re.findall(r"\w+", heading.lower()))
        if meaningful.intersection(title_words) or meaningful.intersection(heading_words):
            overlap += 0.15

        return min(overlap, 1.0)

    def retrieve(
        self,
        query: str,
        db: Session,
        top_k: int = 5,
        doc_type_filter: Optional[str] = None,
        domain_filter: Optional[str] = None,
    ) -> List[RetrievedEvidence]:
        """
        Executes unified hybrid retrieval across both authoritative AiKnowledgeChunk (CMS)
        and PhdChunk records, enforcing strict publication eligibility and prioritization rules.
        """
        query_clean = query.strip()
        if not query_clean:
            return []

        intent = self.classify_query_intent(query_clean)
        try:
            query_vector = np.array(self.embedder.embed_text(query_clean), dtype=np.float32)
            q_norm = float(np.linalg.norm(query_vector))
        except Exception as emb_err:
            logger.warning("Query embedding generation failed: %s", emb_err)
            query_vector = np.zeros(getattr(self.embedder, "dimensions", 768), dtype=np.float32)
            q_norm = 0.0

        all_candidates: List[CandidatePassage] = []

        # 1. Fetch eligible passages from authoritative AiKnowledgeChunk records (CMS)
        try:
            ai_stmt = (
                select(AiKnowledgeChunk, AiKnowledgeDocument, AiKnowledgeDocumentVersion)
                .join(AiKnowledgeDocument, AiKnowledgeChunk.document_id == AiKnowledgeDocument.id)
                .join(AiKnowledgeDocumentVersion, AiKnowledgeChunk.version_id == AiKnowledgeDocumentVersion.id)
                .where(
                    AiKnowledgeDocument.status == KnowledgeDocumentStatus.ACTIVE.value,
                    AiKnowledgeDocument.current_version_id == AiKnowledgeDocumentVersion.id,
                    AiKnowledgeChunk.version_id == AiKnowledgeDocument.current_version_id,
                    AiKnowledgeDocumentVersion.approval_status == KnowledgeApprovalStatus.APPROVED.value,
                    AiKnowledgeChunk.verification_status.in_([
                        KnowledgeVerificationStatus.INDEXED.value,
                        KnowledgeVerificationStatus.VERIFIED.value,
                    ]),
                    AiKnowledgeDocumentVersion.extraction_status != KnowledgeExtractionStatus.FAILED.value,
                )
            )
            if domain_filter and domain_filter != "all":
                ai_stmt = ai_stmt.where(AiKnowledgeDocument.domain == domain_filter)
            if doc_type_filter:
                ai_stmt = ai_stmt.where(AiKnowledgeDocument.document_type == doc_type_filter)

            ai_rows = db.execute(ai_stmt).all()
            for chunk, doc, ver in ai_rows:
                meta = chunk.chunk_metadata or {}
                all_candidates.append(
                    CandidatePassage(
                        id=str(chunk.id),
                        doc_type=doc.document_type,
                        document_title=doc.title,
                        source_filename=ver.original_filename,
                        academic_session=doc.academic_session,
                        page_number=chunk.page_number,
                        slide_number=meta.get("slide_number"),
                        section_heading=meta.get("section_heading"),
                        chunk_text=chunk.content,
                        embedding=chunk.embedding,
                        chunk_metadata=meta,
                        source_table="ai_knowledge",
                    )
                )
        except Exception as ai_exc:
            logger.warning("Error fetching AiKnowledgeChunk candidates: %s", ai_exc)

        # 2. Fetch candidate chunks from legacy phd_admission tables
        try:
            stmt_phd = (
                select(PhdChunk, PhdDocument)
                .join(PhdDocument, PhdChunk.document_id == PhdDocument.id)
                .where(PhdDocument.is_active == True)
            )
            if doc_type_filter:
                stmt_phd = stmt_phd.where(PhdChunk.doc_type == doc_type_filter)

            phd_rows = db.execute(stmt_phd).all()
            for chunk, doc in phd_rows:
                all_candidates.append(
                    CandidatePassage(
                        id=str(chunk.id),
                        doc_type=chunk.doc_type,
                        document_title=chunk.document_title or doc.title,
                        source_filename=chunk.source_filename or doc.filename,
                        academic_session=chunk.academic_session or doc.academic_session,
                        page_number=chunk.page_number,
                        slide_number=chunk.slide_number,
                        section_heading=chunk.section_heading,
                        chunk_text=chunk.chunk_text,
                        embedding=chunk.embedding,
                        chunk_metadata={"embedding_model": getattr(self.embedder, "model_name", "gemini-embedding-001")},
                        source_table="phd_legacy",
                    )
                )
        except Exception as phd_exc:
            logger.warning("Error fetching PhdChunk candidates: %s", phd_exc)

        if not all_candidates:
            logger.warning("No candidate chunks found in database for retrieval.")
            return []

        ranked_items: List[Tuple[float, CandidatePassage]] = []

        # Interleaving applies when user explicitly asks for cross-document comparison
        is_cross_doc = intent["is_conflict_or_comparison"] or (
            ("ordinance" in query_clean.lower() and ("ppt" in query_clean.lower() or "brochure" in query_clean.lower()))
            or ("brochure" in query_clean.lower() and ("ordinance" in query_clean.lower() or "ppt" in query_clean.lower()))
        )

        for chunk in all_candidates:
            # 1. Semantic Cosine Similarity (with dimension safety guard)
            semantic_score = 0.0
            if chunk.embedding and q_norm > 0:
                try:
                    c_vec = np.array(chunk.embedding, dtype=np.float32)
                    if c_vec.ndim != 1 or len(c_vec) != len(query_vector):
                        logger.warning(
                            "Embedding dimension mismatch for chunk %s: expected %d, got %d. Skipping semantic score.",
                            chunk.id, len(query_vector), len(c_vec),
                        )
                    elif not np.all(np.isfinite(c_vec)):
                        logger.warning(
                            "Embedding for chunk %s contains non-finite values. Skipping semantic score.",
                            chunk.id,
                        )
                    else:
                        c_norm = np.linalg.norm(c_vec)
                        if c_norm > 0:
                            semantic_score = float(np.dot(query_vector, c_vec) / (q_norm * c_norm))
                except Exception as sim_exc:
                    logger.warning("Error computing similarity for chunk %s: %s", chunk.id, sim_exc)
                    semantic_score = 0.0

            # 2. Lexical Keyword Overlap with title & heading support
            lexical_score = self.compute_lexical_overlap(
                query=query_clean,
                text=chunk.chunk_text,
                title=chunk.document_title,
                heading=chunk.section_heading or "",
            )

            # Combined base score (70% semantic, 30% lexical)
            base_score = (0.7 * max(0.0, semantic_score)) + (0.3 * lexical_score)

            # 3. Document-Specific Rule Routing Boosts
            doc_type = (chunk.doc_type or "").lower()

            # Rule A: Ordinary Course Work Questions (PPT is authoritative source of truth for 2026-27)
            if intent["is_coursework"] and not intent["is_explicit_ordinance"] and not intent["is_conflict_or_comparison"]:
                if doc_type == "coursework_ppt":
                    base_score += 0.45
                    if intent["is_credit_specific"] and "12 credits" in chunk.chunk_text.lower():
                        base_score += 0.45
                elif doc_type == "ordinance":
                    base_score -= 0.30
                elif doc_type == "brochure":
                    base_score -= 0.15

            # Rule B: Explicit Ordinance queries (User specifically asks for Ordinance or regulatory rules)
            elif intent["is_explicit_ordinance"] and not intent["is_conflict_or_comparison"]:
                if doc_type == "ordinance":
                    base_score += 0.40
                    if intent["is_credit_specific"] and ("credit" in chunk.chunk_text.lower() or "6." in (chunk.section_heading or "").lower()):
                        base_score += 0.35
                elif doc_type == "coursework_ppt":
                    base_score -= 0.25

            # Rule C: Comparison / Discrepancy queries (Boost both PPT and Ordinance)
            elif intent["is_conflict_or_comparison"]:
                if doc_type == "coursework_ppt" and "12 credits" in chunk.chunk_text.lower():
                    base_score += 0.45
                elif doc_type == "ordinance" and ("credit" in chunk.chunk_text.lower() or "6." in (chunk.section_heading or "").lower()):
                    base_score += 0.45

            # Rule D: Admission & Fellowship questions (Brochure, policies, circulars are authoritative)
            elif intent["is_admission"]:
                if doc_type in ("brochure", "policy", "guideline", "circular", "ordinance", "regulation"):
                    base_score += 0.35
                elif doc_type == "coursework_ppt":
                    base_score -= 0.20

            # Rule E: General Ordinance / Regulatory questions
            elif intent["is_ordinance"]:
                if doc_type in ("ordinance", "regulation", "act", "statute"):
                    base_score += 0.35
                elif doc_type == "coursework_ppt":
                    base_score -= 0.20

            # Title or heading match bonus
            heading_lower = (chunk.section_heading or "").lower()
            title_lower = (chunk.document_title or "").lower()
            if any(w in heading_lower or w in title_lower for w in query_clean.lower().split() if len(w) > 3):
                base_score += 0.10

            ranked_items.append((base_score, chunk))

        # Sort by total score descending
        ranked_items.sort(key=lambda x: x[0], reverse=True)

        # Select top-k distinct or most relevant chunks with cross-document coverage
        selected: List[RetrievedEvidence] = []
        seen_texts = set()

        if is_cross_doc:
            # Guarantee at least 1-2 chunks from each referenced document type
            by_type: Dict[str, List[CandidatePassage]] = {}
            for score, chunk in ranked_items:
                by_type.setdefault(chunk.doc_type, []).append(chunk)

            # Interleave top candidates from each doc type
            doc_types_to_include = [t for t in ["coursework_ppt", "ordinance", "brochure", "policy"] if t in by_type]
            for t in doc_types_to_include:
                if by_type[t]:
                    chunk = by_type[t].pop(0)
                    citation = self.format_citation_label(
                        title=chunk.document_title,
                        page=chunk.page_number,
                        slide=chunk.slide_number,
                        heading=chunk.section_heading,
                        session=chunk.academic_session,
                    )
                    selected.append(
                        RetrievedEvidence(
                            chunk_id=str(chunk.id),
                            doc_type=chunk.doc_type,
                            document_title=chunk.document_title,
                            source_filename=chunk.source_filename,
                            academic_session=chunk.academic_session,
                            page_number=chunk.page_number,
                            slide_number=chunk.slide_number,
                            section_heading=chunk.section_heading,
                            chunk_text=chunk.chunk_text,
                            relevance_score=1.0,
                            citation_label=citation,
                        )
                    )
                    seen_texts.add(chunk.chunk_text[:100])

        for score, chunk in ranked_items:
            # Deduplicate near-identical text
            text_snippet = chunk.chunk_text[:100]
            if text_snippet in seen_texts:
                continue
            seen_texts.add(text_snippet)

            citation = self.format_citation_label(
                title=chunk.document_title,
                page=chunk.page_number,
                slide=chunk.slide_number,
                heading=chunk.section_heading,
                session=chunk.academic_session,
            )

            selected.append(
                RetrievedEvidence(
                    chunk_id=str(chunk.id),
                    doc_type=chunk.doc_type,
                    document_title=chunk.document_title,
                    source_filename=chunk.source_filename,
                    academic_session=chunk.academic_session,
                    page_number=chunk.page_number,
                    slide_number=chunk.slide_number,
                    section_heading=chunk.section_heading,
                    chunk_text=chunk.chunk_text,
                    relevance_score=score,
                    citation_label=citation,
                )
            )

            if len(selected) >= top_k:
                break

        return selected
