import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.api.dependencies import get_db
from app.modules.phd_rag.models import PhdDocument, PhdChunk
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
def get_phd_rag_status(db: Session = Depends(get_db)) -> PhdStatusResponse:
    """
    Public inventory status showing total indexed documents and chunks.
    Does not expose sensitive system paths or credentials.
    """
    docs = db.execute(select(PhdDocument).where(PhdDocument.is_active == True)).scalars().all()
    
    inventory_items = []
    total_chunks = 0

    for d in docs:
        chunk_cnt = len(d.chunks)
        total_chunks += chunk_cnt
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

    is_ready = len(docs) >= 3 and total_chunks > 0

    return PhdStatusResponse(
        success=True,
        is_ready=is_ready,
        total_documents=len(docs),
        total_chunks=total_chunks,
        documents=inventory_items,
    )
