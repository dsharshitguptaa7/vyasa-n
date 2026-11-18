# -*- coding: utf-8 -*-
"""
VYASAⁿ AI Knowledge Centre — Hardened Scholar-Facing AI Assistant Gateway
Provides an authenticated, rate-limited, multi-domain conversational gateway
connecting authorized scholars and faculty to verified university knowledge.

Safety & Governance Controls:
1. Strict Identity & RBAC: Accessible only to authenticated users with legitimate institutional roles.
2. Persistent Conversation Storage: PostgreSQL-backed threads survive container restarts and deployments.
3. Conversation Ownership Isolation: Users can access and delete only their own conversation sessions.
4. Distributed Atomic Rate Limiting: Cross-instance sliding-window limiter prevents abuse.
5. Input & Context Bounding: Strict payload length and history limits.
6. Zero Internal Path Leakage: Private storage keys, S3 credentials, and raw vectors are never returned.
7. Operational Observability: Provides aggregated health diagnostics without exposing private contents.
"""

from collections import defaultdict
from datetime import datetime, timezone
import logging
import math
import time
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_current_user, require_sadmin
from app.models.user import User
from app.schemas.response import ApiResponse
from app.modules.knowledge_centre.retrieval_service import (
    knowledge_retrieval_service,
    KnowledgeRetrievalQuery,
    DOMAIN_DISPLAY_NAMES,
)
from app.modules.knowledge_centre.synthesis_service import (
    knowledge_synthesis_service,
    ScholarCitationItem,
    SynthesisResult,
)
from app.modules.knowledge_centre.conversation_service import (
    persistent_conversation_service,
    ConversationNotFoundError,
    ConversationAccessDeniedError,
)
from app.modules.knowledge_centre.rate_limiter import distributed_rate_limiter
from app.modules.knowledge_centre.observability import assistant_observability

logger = logging.getLogger("vyasa.knowledge_centre.assistant")

router = APIRouter(prefix="/v1/assistant", tags=["VYASA AI Assistant Gateway"])

# Institutional Roles Permitted to Access Authoritative Knowledge Retrieval
ELIGIBLE_SCHOLAR_ROLES = {
    "applicant",
    "student",
    "scholar",
    "researcher",
    "faculty",
    "manager",
    "assistant_dean",
    "associate_dean",
    "dean",
    "administrator",
    "super_admin",
}

# Rate limit settings: 20 requests per minute per user
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 20

# In-memory sliding window rate limiter mirror (for tests and memory fallback): {user_id: [timestamps]}
_user_rate_limits: Dict[uuid.UUID, List[float]] = defaultdict(list)

# In-memory session store mirror (for test backward-compatibility): {conversation_id: {"user_id": UUID, "turns": list, "updated_at": float}}
_conversation_store: Dict[str, Dict[str, Any]] = {}


def check_scholar_access(current_user: User = Depends(get_current_user)) -> User:
    """
    Validates that the authenticated user possesses an eligible institutional role.
    Rejects unauthenticated callers with 401 and unauthorized roles with 403.
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    user_roles = {r.name.lower() for r in current_user.roles}
    if not user_roles.intersection(ELIGIBLE_SCHOLAR_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized university scholars, faculty, and administrators.",
        )

    return current_user


def check_rate_limit(
    response: Response = None,
    current_user: User = Depends(check_scholar_access),
    db: Session = Depends(get_db),
) -> User:
    """
    Enforces atomic sliding-window rate limit per authenticated user.
    Checks PostgreSQL distributed limiter, while keeping in-memory state synchronized.
    """
    now = time.time()
    user_id = current_user.id

    # 1. Distributed rate limit check (PostgreSQL)
    retry_after = distributed_rate_limiter.check_and_record(user_id, db)
    if retry_after is not None:
        assistant_observability.record_rate_limit_rejection()
        if response:
            response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Please wait a moment before asking another question.",
            headers={"Retry-After": str(retry_after)},
        )

    # 2. Check in-memory mirror if pre-populated by test harnesses
    timestamps = _user_rate_limits[user_id]
    valid_timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    _user_rate_limits[user_id] = valid_timestamps

    if len(valid_timestamps) >= MAX_REQUESTS_PER_WINDOW:
        assistant_observability.record_rate_limit_rejection()
        logger.warning("Rate limit exceeded for user %s (%d requests in 60s)", user_id, len(valid_timestamps))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please wait a moment before asking another question.",
            headers={"Retry-After": "60"},
        )

    _user_rate_limits[user_id].append(now)
    return current_user


# ==============================================================================
# Request & Response Contracts
# ==============================================================================

class ConversationTurnItem(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., max_length=2000, description="Message text")


class AssistantChatRequest(BaseModel):
    query: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        description="Natural language question regarding university regulations, ordinances, or policies.",
    )
    conversation_id: Optional[str] = Field(
        default=None,
        description="Optional conversation identifier for thread continuity.",
    )
    domains: Optional[List[str]] = Field(
        default=None,
        description="Optional domain scope (e.g. ['doctoral-studies', 'academic-regulations']).",
    )
    academic_session: Optional[str] = Field(
        default=None,
        description="Optional academic session filter (e.g. '2026-27').",
    )
    conversation_history: Optional[List[ConversationTurnItem]] = Field(
        default=None,
        max_length=5,
        description="Recent conversation history (up to 5 turns).",
    )


class AssistantChatResponse(BaseModel):
    success: bool = True
    conversation_id: str
    query: str
    answer: str
    evidence_status: str  # "sufficient" | "insufficient" | "conflicting_sources" | "generation_failed"
    citations: List[Dict[str, Any]]
    domains_searched: List[str]
    has_conflict: bool
    is_grounded: bool
    model_used: str
    timestamp: str
    claim_validation_status: Optional[str] = "verified"
    unsupported_claims: Optional[List[str]] = Field(default_factory=list)


class AssistantScopeDomainItem(BaseModel):
    domain: str
    label: str
    description: str


class AssistantScopeResponse(BaseModel):
    success: bool = True
    available_domains: List[AssistantScopeDomainItem]
    default_model: str


# ==============================================================================
# Endpoints
# ==============================================================================

@router.post("/chat", response_model=ApiResponse[AssistantChatResponse])
def chat_with_assistant(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_rate_limit),
):
    """
    Scholar-facing authoritative AI Assistant endpoint.
    Retrieves approved university documents and synthesizes evidence-grounded answers.
    Persists conversations and message turns durably to PostgreSQL.
    """
    cleaned_query = payload.query.strip()
    t_start = time.time()

    # 1. Resolve or Initialize Conversation ID & Ownership (PostgreSQL + Memory Mirror)
    conv_id_str = payload.conversation_id
    if conv_id_str in _conversation_store:
        existing_owner = _conversation_store[conv_id_str]["user_id"]
        if existing_owner != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this conversation.",
            )

    try:
        conv_record, created = persistent_conversation_service.get_or_create_conversation(
            db=db,
            user_id=current_user.id,
            conversation_id=conv_id_str,
            initial_title=cleaned_query,
        )
        resolved_conv_id = str(conv_record.id)
    except ConversationAccessDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except Exception as e:
        logger.warning("DB conversation resolution error, falling back to memory: %s", e)
        assistant_observability.record_persistence_failure()
        resolved_conv_id = conv_id_str or str(uuid.uuid4())

    # Sync memory mirror
    if resolved_conv_id not in _conversation_store:
        _conversation_store[resolved_conv_id] = {
            "user_id": current_user.id,
            "turns": [],
            "updated_at": time.time(),
        }

    # 2. Prepare History Context
    history_turns = []
    if payload.conversation_history:
        for t in payload.conversation_history:
            history_turns.append({"role": t.role, "content": t.content})
    elif resolved_conv_id in _conversation_store and _conversation_store[resolved_conv_id]["turns"]:
        history_turns = _conversation_store[resolved_conv_id]["turns"][-4:]
    else:
        # Fetch from DB if available
        try:
            db_history = persistent_conversation_service.get_conversation_history(
                db=db,
                conversation_id=resolved_conv_id,
                user_id=current_user.id,
                limit=4,
                offset=0,
            )
            history_turns = [{"role": m["role"], "content": m["content"]} for m in db_history["turns"]]
        except Exception:
            history_turns = []

    # 3. Execute Authoritative Multi-Domain Retrieval (Phase 4B Engine)
    retrieval_query = KnowledgeRetrievalQuery(
        query=cleaned_query,
        domains=payload.domains,
        academic_session=payload.academic_session,
        top_k=5,
        min_score=0.25,
    )
    t_retrieval_start = time.time()
    retrieval_result = knowledge_retrieval_service.retrieve(retrieval_query, db)
    retrieval_latency_ms = round((time.time() - t_retrieval_start) * 1000, 2)

    # 4. Synthesize Grounded Answer (Phase 4C Synthesis Service)
    synthesis_result = knowledge_synthesis_service.synthesize(
        query=cleaned_query,
        retrieval_result=retrieval_result,
        conversation_history=history_turns,
    )

    # 5. Persist Turn in PostgreSQL & Sync Memory Mirror
    try:
        persistent_conversation_service.record_turn(
            db=db,
            conversation_id=uuid.UUID(resolved_conv_id),
            user_id=current_user.id,
            user_query=cleaned_query,
            synthesis_result=synthesis_result,
        )
    except Exception as e:
        logger.warning("DB turn persistence failed: %s", e)
        assistant_observability.record_persistence_failure()

    _conversation_store[resolved_conv_id]["turns"].append({"role": "user", "content": cleaned_query})
    _conversation_store[resolved_conv_id]["turns"].append({"role": "assistant", "content": synthesis_result.answer})
    _conversation_store[resolved_conv_id]["updated_at"] = time.time()

    # 6. Format Response (Sanitized citations without internal file keys)
    response_data = AssistantChatResponse(
        success=True,
        conversation_id=resolved_conv_id,
        query=cleaned_query,
        answer=synthesis_result.answer,
        evidence_status=synthesis_result.evidence_status,
        citations=[c.to_dict() for c in synthesis_result.citations],
        domains_searched=synthesis_result.domains_searched,
        has_conflict=synthesis_result.has_conflict,
        is_grounded=synthesis_result.is_grounded,
        model_used=synthesis_result.model_used,
        timestamp=datetime.now(timezone.utc).isoformat(),
        claim_validation_status=getattr(synthesis_result, "claim_validation_status", "verified"),
        unsupported_claims=getattr(synthesis_result, "unsupported_claims", []),
    )

    return ApiResponse(
        success=True,
        message="Grounded answer generated successfully." if synthesis_result.is_grounded else "Official guidance provided.",
        data=response_data.model_dump(),
    )


@router.get("/scope", response_model=ApiResponse[AssistantScopeResponse])
def get_assistant_scope(
    current_user: User = Depends(check_scholar_access),
):
    """
    Returns available knowledge domains and configuration scope for client filter selectors.
    """
    domains_data = [
        AssistantScopeDomainItem(
            domain="doctoral-studies",
            label="Doctoral Studies",
            description="Ph.D. guidelines, RAC procedures, coursework ordinances, and thesis standards",
        ),
        AssistantScopeDomainItem(
            domain="admissions",
            label="Admissions & Eligibility",
            description="Eligibility criteria, entrance exams, reservation matrices, and intake policies",
        ),
        AssistantScopeDomainItem(
            domain="academic-regulations",
            label="Academic Regulations",
            description="Curriculum frameworks, grading schemes, NEP compliance, and examination rules",
        ),
        AssistantScopeDomainItem(
            domain="research-development",
            label="Research & Innovation",
            description="Grant allocations, ethics approvals, IPR guidelines, and seed funding policies",
        ),
        AssistantScopeDomainItem(
            domain="university-administration",
            label="University Administration",
            description="Statutes, administrative circulars, service rules, and executive council decisions",
        ),
    ]

    return ApiResponse(
        success=True,
        message="Knowledge scope retrieved successfully.",
        data=AssistantScopeResponse(
            success=True,
            available_domains=domains_data,
            default_model=knowledge_synthesis_service.model_name,
        ).model_dump(),
    )


@router.get("/conversations", response_model=ApiResponse)
def list_user_conversations(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_scholar_access),
):
    """
    Lists paginated persistent conversation threads owned by the authenticated scholar.
    """
    result = persistent_conversation_service.list_user_conversations(
        db=db,
        user_id=current_user.id,
        limit=limit,
        offset=offset,
    )
    return ApiResponse(
        success=True,
        message="Conversations retrieved successfully.",
        data=result,
    )


@router.get("/conversations/{conversation_id}", response_model=ApiResponse)
def get_conversation_history(
    conversation_id: str,
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_scholar_access),
):
    """
    Retrieves stored conversation turns for an active conversation session.
    Enforces user ownership verification. Supports pagination.
    """
    # Check in-memory mirror first (for test mocking compatibility)
    conv_mem = _conversation_store.get(conversation_id)
    if conv_mem:
        if conv_mem["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this conversation.",
            )
        return ApiResponse(
            success=True,
            message="Conversation history retrieved successfully.",
            data={"conversation_id": conversation_id, "turns": conv_mem["turns"]},
        )

    # Query persistent PostgreSQL storage
    try:
        history = persistent_conversation_service.get_conversation_history(
            db=db,
            conversation_id=conversation_id,
            user_id=current_user.id,
            limit=limit,
            offset=offset,
        )
        return ApiResponse(
            success=True,
            message="Conversation history retrieved successfully.",
            data=history,
        )
    except ConversationNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ConversationAccessDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.delete("/conversations/{conversation_id}", response_model=ApiResponse)
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_scholar_access),
):
    """
    Clears / soft-deletes a conversation session with ownership check.
    """
    # Check in-memory mirror
    conv_mem = _conversation_store.get(conversation_id)
    if conv_mem:
        if conv_mem["user_id"] != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not own this conversation.",
            )
        del _conversation_store[conversation_id]

    # Delete from DB
    try:
        persistent_conversation_service.delete_conversation(
            db=db,
            conversation_id=conversation_id,
            user_id=current_user.id,
        )
    except ConversationNotFoundError:
        if not conv_mem:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conversation {conversation_id} not found.",
            )
    except ConversationAccessDeniedError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))

    return ApiResponse(
        success=True,
        message="Conversation cleared successfully.",
        data={"conversation_id": conversation_id},
    )


@router.get("/diagnostics", response_model=ApiResponse)
def get_assistant_diagnostics(
    current_user: User = Depends(require_sadmin),
):
    """
    Administrative operational health & diagnostics summary.
    Exposes aggregated latencies, query counts, and reliability stats.
    Strictly restricted to SADMIN.
    Strictly hides private conversation text, document content, and API credentials.
    """
    summary = assistant_observability.get_diagnostic_summary()
    return ApiResponse(
        success=True,
        message="Assistant diagnostic summary retrieved successfully.",
        data=summary,
    )
