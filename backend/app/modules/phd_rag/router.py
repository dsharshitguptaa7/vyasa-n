import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.api.dependencies import get_db
from app.modules.phd_rag.models import PhdDocument, PhdChunk
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
    KnowledgeVerificationStatus,
)
from app.modules.phd_rag.schemas import (
    ChatQueryRequest,
    ChatQueryResponse,
    CitationItem,
    PhdStatusResponse,
    DocumentInventoryItem,
    SuggestedQuestionsResponse,
    SuggestedQuestionItem,
)
from app.modules.phd_rag.services.retrieval_service import PhdRetrievalService
from app.modules.phd_rag.services.llm_service import llm_service
from app.modules.phd_rag.services.embedding_service import embedding_service
from app.modules.phd_rag.services.ingestion_service import ingestion_service
from app.modules.phd_rag.rate_limiter import check_phd_rag_rate_limit

logger = logging.getLogger("vyasa.phd_rag.router")

router = APIRouter(prefix="/public/phd-admission", tags=["Ph.D. Admission Public Assistant"])

retrieval_service = PhdRetrievalService(embedder=embedding_service)


@router.post("/chat", response_model=ChatQueryResponse)
def chat_with_phd_assistant(
    request: ChatQueryRequest,
    db: Session = Depends(get_db),
    _rate_limit: bool = Depends(check_phd_rag_rate_limit),
) -> ChatQueryResponse:
    """
    Public RAG-grounded conversation endpoint for CSJMU Ph.D. Admission guidance.
    Accessible without user login or authentication.
    Strictly answers from retrieved passages across:
    1. Ph.D. Admission Brochure (2026-27)
    2. Ph.D. Ordinance (2024-25)
    3. Course Work Orientation PPT (2026-27)
    """
    cleaned_query = request.query.strip()
    if len(cleaned_query) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query must contain at least 2 characters.",
        )

    try:
        # 1. Retrieve top-k evidence with document routing & prioritization
        evidence = retrieval_service.retrieve(
            query=cleaned_query,
            db=db,
            top_k=5,
            doc_type_filter=request.doc_type_filter,
            domain_filter=request.domain_filter,
        )

        # Format history if present
        history_dicts = None
        if request.conversation_history:
            history_dicts = [
                {"role": turn.role, "content": turn.content}
                for turn in request.conversation_history
            ]

        # 2. Synthesize source-grounded response
        llm_resp = llm_service.answer_query(
            query=cleaned_query,
            evidence=evidence,
            conversation_history=history_dicts,
        )

        citations_payload = [
            CitationItem(**cite) for cite in llm_resp.cited_sources
        ]

        return ChatQueryResponse(
            success=True,
            query=cleaned_query,
            answer=llm_resp.answer,
            is_grounded=llm_resp.is_grounded,
            has_conflict=llm_resp.has_conflict,
            citations=citations_payload,
            suggested_followups=llm_resp.suggested_followups,
            model_used=llm_resp.model_used,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error processing public Ph.D. chat query: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate answer. Please try again or rephrase your question.",
        )


@router.get("/suggested-questions", response_model=SuggestedQuestionsResponse)
def get_suggested_questions() -> SuggestedQuestionsResponse:
    """
    Curated high-value prompts spanning Admission, Course Work, and Ordinance provisions.
    """
    questions = [
        SuggestedQuestionItem(
            category="Course Work",
            question="How many credits are required for Ph.D. course work and what are the 5 components?",
            primary_source="Course Work PPT (2026-27)",
        ),
        SuggestedQuestionItem(
            category="Course Work",
            question="What is the assessment scheme and minimum CGPA required to pass course work?",
            primary_source="Course Work PPT (2026-27)",
        ),
        SuggestedQuestionItem(
            category="Admission & Eligibility",
            question="What are the eligibility criteria and minimum percentage for candidates with a Master's degree?",
            primary_source="Admission Brochure (2026-27)",
        ),
        SuggestedQuestionItem(
            category="Admission & Fees",
            question="What is the Ph.D. application fee for General/OBC vs SC/ST candidates?",
            primary_source="Admission Brochure (2026-27)",
        ),
        SuggestedQuestionItem(
            category="Entrance Test",
            question="Who is exempt from the National Level Entrance Examination for Ph.D. admission?",
            primary_source="Admission Brochure (2026-27)",
        ),
        SuggestedQuestionItem(
            category="Ordinance & Regulations",
            question="What is the minimum and maximum duration of the Ph.D. programme according to the Ordinance?",
            primary_source="Ph.D. Ordinance (2024-25)",
        ),
        SuggestedQuestionItem(
            category="Course Work vs Ordinance",
            question="Is there any difference between the course work credits stated in the Ordinance versus the Course Work PPT?",
            primary_source="Cross-document (PPT & Ordinance)",
        ),
    ]
    return SuggestedQuestionsResponse(success=True, questions=questions)


@router.get("/status", response_model=PhdStatusResponse)
def get_phd_rag_status(
    domain: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> PhdStatusResponse:
    """
    Public inventory status showing total indexed documents and verified chunks.
    Unifies authoritative university documents from both AiKnowledgeDocument (CMS)
    and legacy PhdDocument records to ensure count consistency across CMS and Assistant.
    """
    inventory_items = []
    seen_identifiers = set()

    # 1. Active, approved documents from CMS (AiKnowledgeDocument)
    try:
        ai_stmt = (
            select(AiKnowledgeDocument, AiKnowledgeDocumentVersion)
            .join(AiKnowledgeDocumentVersion, AiKnowledgeDocument.current_version_id == AiKnowledgeDocumentVersion.id)
            .where(
                AiKnowledgeDocument.status == KnowledgeDocumentStatus.ACTIVE.value,
                AiKnowledgeDocumentVersion.approval_status == KnowledgeApprovalStatus.APPROVED.value,
                AiKnowledgeDocumentVersion.extraction_status != KnowledgeExtractionStatus.FAILED.value,
            )
        )
        if domain and domain != "all":
            ai_stmt = ai_stmt.where(AiKnowledgeDocument.domain == domain)

        ai_docs = db.execute(ai_stmt).all()
        for doc, ver in ai_docs:
            verified_chunks = len([
                c for c in doc.chunks
                if c.verification_status in (
                    KnowledgeVerificationStatus.INDEXED.value,
                    KnowledgeVerificationStatus.VERIFIED.value,
                )
            ])
            max_units = 1
            if doc.chunks:
                pages = [c.page_number for c in doc.chunks if c.page_number is not None]
                if pages:
                    max_units = max(pages)

            ident_checksum = ver.checksum_sha256 or ""
            ident_title = (doc.title or "").lower().strip()
            if ident_checksum:
                seen_identifiers.add(ident_checksum)
            if ident_title:
                seen_identifiers.add(ident_title)

            inventory_items.append(
                DocumentInventoryItem(
                    filename=ver.original_filename,
                    title=doc.title,
                    doc_type=doc.document_type,
                    academic_session=doc.academic_session,
                    file_size_bytes=ver.size_bytes or 0,
                    checksum_sha256=ver.checksum_sha256 or "",
                    total_pages_or_slides=max_units,
                    chunk_count=verified_chunks,
                    processing_status="COMPLETED",
                )
            )
    except Exception as exc:
        logger.warning("Error fetching AiKnowledgeDocument inventory in status: %s", exc)

    # 2. Active documents from legacy PhdDocument
    try:
        phd_docs = db.execute(select(PhdDocument).where(PhdDocument.is_active == True)).scalars().all()
        for d in phd_docs:
            ident_checksum = d.checksum_sha256 or ""
            ident_title = (d.title or "").lower().strip()
            if (ident_checksum and ident_checksum in seen_identifiers) or (ident_title and ident_title in seen_identifiers):
                continue
            if ident_checksum:
                seen_identifiers.add(ident_checksum)
            if ident_title:
                seen_identifiers.add(ident_title)

            chunk_cnt = len(d.chunks)
            inventory_items.append(
                DocumentInventoryItem(
                    filename=d.filename,
                    title=d.title,
                    doc_type=d.doc_type,
                    academic_session=d.academic_session,
                    file_size_bytes=d.file_size_bytes,
                    checksum_sha256=d.checksum_sha256,
                    total_pages_or_slides=d.total_pages_or_slides,
                    chunk_count=chunk_cnt,
                    processing_status=d.processing_status,
                )
            )
    except Exception as exc:
        logger.warning("Error fetching PhdDocument inventory in status: %s", exc)

    total_documents = len(inventory_items)
    total_chunks = sum(item.chunk_count for item in inventory_items)
    is_ready = total_documents >= 1 and total_chunks > 0

    return PhdStatusResponse(
        success=True,
        is_ready=is_ready,
        total_documents=total_documents,
        total_chunks=total_chunks,
        documents=inventory_items,
    )
