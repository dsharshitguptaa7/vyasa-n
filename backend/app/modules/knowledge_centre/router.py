"""
FastAPI Router for VYASAⁿ AI Knowledge Centre Administration.
Base Route: /v1/admin/knowledge-centre (mounted also under /admin/knowledge-centre)
All administrative endpoints are strictly protected by require_sadmin.
"""

from datetime import datetime
import logging
import re
from typing import List, Optional
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, require_sadmin
from app.core.database import SessionLocal
from app.core.storage import storage_service
from app.models.user import User
from app.schemas.response import ApiResponse
from app.modules.knowledge_centre.models import (
    AiKnowledgeDocument,
    AiKnowledgeDocumentVersion,
    AiKnowledgeChunk,
    KnowledgeDocumentStatus,
    KnowledgeApprovalStatus,
    KnowledgeExtractionStatus,
)
from app.modules.knowledge_centre.schemas import (
    KnowledgeDashboardStatsResponse,
    KnowledgeDocumentItem,
    KnowledgeDocumentVersionItem,
    KnowledgeChunkItem,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentDetailResponse,
    KnowledgeUploadResponse,
    KnowledgeApproveRequest,
    KnowledgeRejectRequest,
    KnowledgeRetryRequest,
    KnowledgeRetrievalRequest,
    KnowledgeRetrievalResponse,
)
from app.modules.knowledge_centre.service import (
    knowledge_service,
    KnowledgeCentreError,
    KnowledgeDuplicateDocumentError,
    KnowledgePermissionDeniedError,
    KnowledgeInvalidLifecycleStateError,
)
from app.modules.knowledge_centre.retrieval_service import (
    knowledge_retrieval_service,
    KnowledgeRetrievalQuery,
)

logger = logging.getLogger("vyasa.knowledge_centre.router")

router = APIRouter(tags=["AI Knowledge Centre Administration"])

ALLOWED_KNOWLEDGE_DOMAINS = {
    "doctoral-studies",
    "admissions",
    "academic-regulations",
    "research-development",
    "university-administration",
}

ALLOWED_KNOWLEDGE_DOCUMENT_TYPES = {
    "policy",
    "ordinance",
    "regulation",
    "guideline",
    "manual",
    "circular",
    "notification",
    "brochure",
    "report",
    "form",
    "presentation",
    "other",
}

ACADEMIC_SESSION_REGEX = re.compile(r"^\d{4}-\d{2}(\d{2})?$")


def _parse_optional_form_datetime(val: Optional[str], field_name: str) -> Optional[datetime]:
    """
    Safely parses an optional ISO date/datetime from multipart form data.
    Gracefully handles empty string and whitespace as None, avoiding 422 errors on empty date inputs.
    """
    if val is None:
        return None
    cleaned = str(val).strip()
    if not cleaned:
        return None
    try:
        # Support both '2026-08-25' and '2026-08-25T00:00:00.000Z'
        return datetime.fromisoformat(cleaned.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid date format for '{field_name}'. Must be an ISO-8601 date (e.g. YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS).",
        ) from exc


def run_background_extraction(document_id: uuid.UUID, version_id: uuid.UUID, job_id: Optional[uuid.UUID] = None):
    """Background task worker executing extraction and embedding with an independent DB session."""
    db = SessionLocal()
    try:
        knowledge_service.extract_and_index_document(db, document_id, version_id, job_id=job_id)
    except Exception as exc:
        logger.error("Background extraction job failed for document %s, version %s: %s", document_id, version_id, exc, exc_info=True)
    finally:
        db.close()


def _serialize_version(v: AiKnowledgeDocumentVersion) -> KnowledgeDocumentVersionItem:
    chunks_count = len(getattr(v, "chunks", [])) if hasattr(v, "chunks") else 0
    return KnowledgeDocumentVersionItem(
        id=v.id,
        version_number=v.version_number,
        storage_key=v.storage_key,
        checksum_sha256=v.checksum_sha256,
        original_filename=v.original_filename,
        mime_type=v.mime_type,
        size_bytes=v.size_bytes,
        extraction_status=v.extraction_status,
        processing_error=v.processing_error,
        approval_status=v.approval_status,
        approved_by_id=v.approved_by_id,
        approved_at=v.approved_at,
        created_at=v.created_at,
        chunk_count=chunks_count,
    )


def _serialize_document(d: AiKnowledgeDocument) -> KnowledgeDocumentItem:
    cur_ver = None
    if d.current_version:
        cur_ver = _serialize_version(d.current_version)
    elif getattr(d, "versions", None) and len(d.versions) > 0:
        cur_ver = _serialize_version(d.versions[0])

    chunk_cnt = len(getattr(d, "chunks", [])) if hasattr(d, "chunks") else 0
    version_cnt = len(getattr(d, "versions", [])) if hasattr(d, "versions") else 0

    return KnowledgeDocumentItem(
        id=d.id,
        title=d.title,
        description=d.description,
        domain=d.domain,
        subdomain=d.subdomain,
        document_type=d.document_type,
        academic_session=d.academic_session,
        issuing_authority=d.issuing_authority,
        effective_from=d.effective_from,
        effective_until=d.effective_until,
        current_version_id=d.current_version_id,
        status=d.status,
        uploaded_by_id=d.uploaded_by_id,
        approved_by_id=d.approved_by_id,
        created_at=d.created_at,
        updated_at=d.updated_at,
        published_at=d.published_at,
        archived_at=d.archived_at,
        current_version=cur_ver,
        version_count=version_cnt,
        chunk_count=chunk_cnt,
    )


# =============================================================================
# Dashboard & Analytics
# =============================================================================

@router.get("/dashboard/stats", response_model=ApiResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Returns platform-wide inventory, domain distributions, and passage metrics for SADMIN dashboard.
    """
    stats = knowledge_service.get_dashboard_stats(db)
    return ApiResponse(
        success=True,
        message="Knowledge Centre dashboard statistics retrieved successfully.",
        data=stats,
    )


# =============================================================================
# Document Management Endpoints
# =============================================================================

@router.post("/documents/upload", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    domain: str = Form(...),
    document_type: str = Form(...),
    description: Optional[str] = Form(None),
    subdomain: Optional[str] = Form(None),
    academic_session: Optional[str] = Form(None),
    issuing_authority: Optional[str] = Form(None),
    effective_from: Optional[str] = Form(None),
    effective_until: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Upload authoritative document to DigitalOcean Spaces:
    - Validates file content, mime type, and maximum upload size (100MB).
    - Detects duplicate checksums.
    - Persists file under vyasa-knowledge/{domain}/v1_...
    - Creates AiKnowledgeDocument and AiKnowledgeDocumentVersion (v1) in DRAFT state.
    - Dispatches background extraction and embedding task.
    """
    if not file or not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must have a valid filename.")

    clean_title = (title or "").strip()
    if not clean_title:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Document title is mandatory.")

    clean_domain = (domain or "").strip().lower()
    if clean_domain not in ALLOWED_KNOWLEDGE_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid knowledge domain '{domain}'. Allowed domains are: {', '.join(sorted(ALLOWED_KNOWLEDGE_DOMAINS))}.",
        )

    clean_doc_type = (document_type or "").strip().lower()
    if clean_doc_type not in ALLOWED_KNOWLEDGE_DOCUMENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid document type '{document_type}'. Allowed types are: {', '.join(sorted(ALLOWED_KNOWLEDGE_DOCUMENT_TYPES))}.",
        )

    clean_session = (academic_session or "").strip() or None
    if clean_session and not ACADEMIC_SESSION_REGEX.match(clean_session):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Academic session must be in the format YYYY-YY or YYYY-YYYY (e.g. 2026-27 or 2026-2027).",
        )

    dt_effective_from = _parse_optional_form_datetime(effective_from, "effective_from")
    dt_effective_until = _parse_optional_form_datetime(effective_until, "effective_until")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot upload an empty 0-byte file.")

    try:
        doc, version = knowledge_service.create_document(
            db=db,
            title=clean_title,
            domain=clean_domain,
            document_type=clean_doc_type,
            filename=file.filename,
            file_bytes=file_bytes,
            uploaded_by=current_user,
            description=description.strip() if description and description.strip() else None,
            subdomain=subdomain.strip() if subdomain and subdomain.strip() else None,
            academic_session=clean_session,
            issuing_authority=issuing_authority.strip() if issuing_authority and issuing_authority.strip() else None,
            effective_from=dt_effective_from,
            effective_until=dt_effective_until,
        )
        db.commit()
    except KnowledgeDuplicateDocumentError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except (KnowledgePermissionDeniedError, KnowledgeInvalidLifecycleStateError) as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.error("Failed to upload knowledge document: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(exc)}")

    # Schedule background extraction
    background_tasks.add_task(run_background_extraction, doc.id, version.id, getattr(version, "job_id", None))

    payload = KnowledgeUploadResponse(
        success=True,
        document_id=doc.id,
        version_id=version.id,
        version_number=version.version_number,
        storage_key=version.storage_key,
        checksum_sha256=version.checksum_sha256,
        status=doc.status,
        extraction_status=version.extraction_status,
        message="Authoritative document uploaded successfully. Extraction and vector indexing queued in background.",
    )
    return ApiResponse(
        success=True,
        message=payload.message,
        data=payload.model_dump(),
    )


@router.get("/documents", response_model=ApiResponse)
def list_documents(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    domain: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    document_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    List authoritative documents with filters, pagination, and current version statuses.
    """
    items, total = knowledge_service.list_documents(
        db=db,
        skip=skip,
        limit=limit,
        domain=domain,
        status=status,
        search=search,
        document_type=document_type,
    )
    serialized = [_serialize_document(d) for d in items]
    data = KnowledgeDocumentListResponse(
        items=serialized,
        total=total,
        skip=skip,
        limit=limit,
    )
    return ApiResponse(
        success=True,
        message="Knowledge documents retrieved successfully.",
        data=data.model_dump(),
    )


@router.get("/documents/{document_id}", response_model=ApiResponse)
def get_document_detail(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Retrieve document entity, all historical versions, and sample extracted chunks.
    """
    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    doc_item = _serialize_document(doc)
    versions_list = [_serialize_version(v) for v in doc.versions]

    chunks_sample = []
    if doc.chunks:
        for c in doc.chunks[:20]:
            chunks_sample.append(
                KnowledgeChunkItem(
                    id=c.id,
                    chunk_index=c.chunk_index,
                    content=c.content,
                    page_number=c.page_number,
                    metadata=c.chunk_metadata,
                    has_embedding=c.embedding is not None,
                    verification_status=c.verification_status,
                )
            )

    detail = KnowledgeDocumentDetailResponse(
        document=doc_item,
        versions=versions_list,
        chunks_sample=chunks_sample,
    )
    return ApiResponse(
        success=True,
        message="Document details retrieved successfully.",
        data=detail.model_dump(),
    )


@router.get("/documents/{document_id}/versions", response_model=ApiResponse)
def get_document_versions(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Retrieve version audit log and immutable storage keys for a document.
    """
    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    versions_list = [_serialize_version(v).model_dump() for v in doc.versions]
    return ApiResponse(
        success=True,
        message="Document versions retrieved successfully.",
        data=versions_list,
    )


@router.get("/documents/{document_id}/download")
def download_document_file(
    document_id: uuid.UUID,
    version_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Stream authoritative source file to authorized SADMIN via backend authenticated proxy.
    """
    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    target_ver = None
    if version_id:
        target_ver = next((v for v in doc.versions if v.id == version_id), None)
        if not target_ver:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Version {version_id} not found for document.")
    else:
        target_ver = doc.current_version or (doc.versions[0] if doc.versions else None)

    if not target_ver:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No version files associated with this document.")

    try:
        local_path = storage_service.get_file_path(target_ver.storage_key)
        return FileResponse(
            path=str(local_path),
            filename=target_ver.original_filename,
            media_type=target_ver.mime_type,
        )
    except Exception as exc:
        logger.error("Failed to stream knowledge file key '%s': %s", target_ver.storage_key, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve file from storage.")


@router.post("/documents/{document_id}/versions", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def upload_new_version(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Uploads a new immutable version for an existing document:
    - Prior active version remains active and published.
    - New version is saved with a distinct storage key under vyasa-knowledge/{domain}/v{N}_...
    - Dispatches extraction job for the new version.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must have a valid filename.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot upload an empty 0-byte file.")

    try:
        new_ver = knowledge_service.create_new_version(
            db=db,
            document_id=document_id,
            filename=file.filename,
            file_bytes=file_bytes,
            uploaded_by=current_user,
        )
        db.commit()
    except KnowledgeDuplicateDocumentError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except KnowledgeCentreError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.error("Failed to create new document version: %s", exc, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to persist new version.")

    # Schedule background extraction for new version
    background_tasks.add_task(run_background_extraction, document_id, new_ver.id, getattr(new_ver, "job_id", None))

    payload = KnowledgeUploadResponse(
        success=True,
        document_id=document_id,
        version_id=new_ver.id,
        version_number=new_ver.version_number,
        storage_key=new_ver.storage_key,
        checksum_sha256=new_ver.checksum_sha256,
        status="processing",
        extraction_status=new_ver.extraction_status,
        message=f"Version {new_ver.version_number} uploaded successfully. Prior version remains active until approved.",
    )
    return ApiResponse(
        success=True,
        message=payload.message,
        data=payload.model_dump(),
    )


@router.post("/documents/{document_id}/approve", response_model=ApiResponse)
def approve_document_version(
    document_id: uuid.UUID,
    payload: Optional[KnowledgeApproveRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    SADMIN approval:
    - Requires valid extraction status ('parsed' or 'indexed').
    - Makes document ACTIVE and updates current_version_id.
    - Sets published_at timestamp.
    """
    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    target_ver_id = payload.version_id if (payload and payload.version_id) else None
    if not target_ver_id:
        # Resolve latest pending approval version or current version
        pending_ver = next((v for v in doc.versions if v.approval_status == KnowledgeApprovalStatus.PENDING.value), None)
        target_ver_id = pending_ver.id if pending_ver else (doc.current_version_id or (doc.versions[0].id if doc.versions else None))

    if not target_ver_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No version available to approve.")

    try:
        updated_doc = knowledge_service.approve_version(
            db=db,
            document_id=document_id,
            version_id=target_ver_id,
            approving_user=current_user,
        )
        db.commit()
    except KnowledgeInvalidLifecycleStateError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except KnowledgePermissionDeniedError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc))
    except Exception as exc:
        db.rollback()
        logger.error("Failed to approve document %s: %s", document_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Approval operation failed.")

    return ApiResponse(
        success=True,
        message="Authoritative document version approved successfully and marked ACTIVE for AI knowledge availability.",
        data={"document_id": str(updated_doc.id), "status": updated_doc.status, "current_version_id": str(updated_doc.current_version_id)},
    )


@router.post("/documents/{document_id}/reject", response_model=ApiResponse)
def reject_document_version(
    document_id: uuid.UUID,
    payload: KnowledgeRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    SADMIN rejection with mandatory justification:
    - Version status is marked REJECTED with reason recorded in processing_error.
    - Document status becomes REJECTED.
    """
    if not payload.reason or len(payload.reason.strip()) < 3:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A mandatory justification (minimum 3 characters) is required to reject a document.")

    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    target_ver_id = payload.version_id
    if not target_ver_id:
        pending_ver = next((v for v in doc.versions if v.approval_status == KnowledgeApprovalStatus.PENDING.value), None)
        target_ver_id = pending_ver.id if pending_ver else (doc.current_version_id or (doc.versions[0].id if doc.versions else None))

    if not target_ver_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No version available to reject.")

    try:
        updated_doc = knowledge_service.reject_version(
            db=db,
            document_id=document_id,
            version_id=target_ver_id,
            rejecting_user=current_user,
            reason=payload.reason.strip(),
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to reject document %s: %s", document_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Rejection operation failed.")

    return ApiResponse(
        success=True,
        message="Document version has been rejected.",
        data={"document_id": str(updated_doc.id), "status": updated_doc.status},
    )


@router.post("/documents/{document_id}/archive", response_model=ApiResponse)
def archive_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    SADMIN archiving:
    - Document is marked ARCHIVED and removed from active RAG retrieval availability.
    """
    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    try:
        updated_doc = knowledge_service.archive_document(
            db=db,
            document_id=document_id,
            archiving_user=current_user,
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to archive document %s: %s", document_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Archiving operation failed.")

    return ApiResponse(
        success=True,
        message="Document has been archived and will not be retrieved by AI assistants.",
        data={"document_id": str(updated_doc.id), "status": updated_doc.status, "archived_at": updated_doc.archived_at},
    )


@router.post("/documents/{document_id}/retry", response_model=ApiResponse)
def retry_document_extraction(
    document_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    payload: Optional[KnowledgeRetryRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Retry extraction and embedding for a failed or stuck document.
    """
    doc = knowledge_service.get_document_detail(db, document_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Document {document_id} not found.")

    target_ver_id = payload.version_id if payload else None

    try:
        ver, new_job_id = knowledge_service.retry_extraction(
            db=db,
            document_id=document_id,
            version_id=target_ver_id,
            acting_user=current_user,
        )
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("Failed to schedule retry for document %s: %s", document_id, exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Retry failed: {str(exc)}")

    # Schedule extraction background worker
    background_tasks.add_task(run_background_extraction, document_id, ver.id, new_job_id)

    return ApiResponse(
        success=True,
        message="Document extraction and embedding retry successfully queued.",
        data={"document_id": str(doc.id), "version_id": str(ver.id), "status": doc.status},
    )


@router.post("/documents/recover-stale", response_model=ApiResponse)
def recover_stale_documents(
    stale_minutes: int = Query(default=15, ge=1, le=1440),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    SADMIN-controlled recovery workflow for stranded extraction jobs:
    - Scans for documents stuck in PROCESSING state longer than stale_minutes.
    - Resets failed versions, purges partial chunks, and preserves prior active version.
    """
    recovered = knowledge_service.recover_stale_processing_jobs(
        db=db,
        stale_minutes=stale_minutes,
        acting_user=current_user,
    )
    return ApiResponse(
        success=True,
        message=f"Stale extraction recovery completed. Recovered {len(recovered)} stranded document(s).",
        data={"recovered_count": len(recovered), "items": recovered},
    )


@router.post("/retrieval/search", response_model=ApiResponse[KnowledgeRetrievalResponse])
def search_knowledge_passages(
    payload: KnowledgeRetrievalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sadmin),
):
    """
    Administrative multi-domain knowledge retrieval endpoint.
    Strictly restricted to SADMIN; evaluates publication eligibility,
    executes hybrid ranking, and outputs citation provenance.
    """
    query_obj = KnowledgeRetrievalQuery(
        query=payload.query,
        domains=payload.domains,
        document_types=payload.document_types,
        academic_session=payload.academic_session,
        issuing_authority=payload.issuing_authority,
        subdomain=payload.subdomain,
        top_k=payload.top_k,
        min_score=payload.min_score,
        semantic_weight=payload.semantic_weight,
        lexical_weight=payload.lexical_weight,
    )
    res = knowledge_retrieval_service.retrieve(query_obj, db)
    return ApiResponse(
        success=True,
        message=f"Retrieved {len(res.top_evidence)} authoritative passage(s).",
        data=res.to_dict(),
    )
