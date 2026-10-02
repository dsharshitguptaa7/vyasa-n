import logging
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.registry import get_module_by_key
from app.models.user import User
from app.modules.atharva_veda.nivaran.dependencies import (
    get_current_atharva_user,
    get_current_nivaran_authority,
    require_atharva_applicant,
    require_atharva_manager,
    require_atharva_assistant_dean,
    require_atharva_associate_dean,
    require_atharva_dean,
)
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.committee import CommitteeCreationRequest
from app.modules.atharva_veda.nivaran.models.document import Document, DocumentRequest
from app.modules.atharva_veda.nivaran.models.enums import GrievancePriority, GrievanceStatus, NivaranRole
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.models.routing import Assignment
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, Subject, SubjectCluster, GrievanceCluster
from app.modules.atharva_veda.nivaran.schemas.assistant_dean import (
    AssistantDeanCommitteeRequestPayload,
    AssistantDeanDocumentRequestPayload,
    AssistantDeanForwardRequest,
    AssistantDeanResolveRequest,
    CommitteeRequestResponseItem,
    DocumentRequestResponseItem,
)
from app.modules.atharva_veda.nivaran.services.assistant_dean_service import AssistantDeanService
from app.modules.atharva_veda.nivaran.schemas.associate_dean import (
    AssociateDeanCommitteeRequestPayload,
    AssociateDeanDashboardStatsResponse,
    AssociateDeanDocumentRequestPayload,
    AssociateDeanForwardRequest,
    AssociateDeanResolveRequest,
)
from app.modules.atharva_veda.nivaran.services.associate_dean_service import AssociateDeanService
from app.modules.atharva_veda.nivaran.services.dean_dashboard_service import DeanDashboardService
from app.modules.atharva_veda.nivaran.schemas.dean_dashboard import (
    DeanDashboardDataResponse,
    ExecutiveLedgerResponse,
)

from app.modules.atharva_veda.nivaran.schemas.grievance import (
    AIReviewRequest,
    DocumentItem,
    GrievanceDetailResponse,
    GrievanceOCRExtractResponse,
    GrievanceStatusHistoryItem,
    GrievanceSubmitRequest,
    GrievanceSummaryItem,
    ManagerReviewRequest,
    RoutingPreviewResponse,
    TaxonomyCategoryItem,
    TaxonomySubjectItem,
)
from app.modules.atharva_veda.nivaran.services.grievance_service import GrievanceService
from app.modules.atharva_veda.nivaran.services.manager_review_service import (
    ManagerReviewService,
)
from app.modules.atharva_veda.nivaran.services.ocr_service import (
    ocr_extractor,
    SUPPORTED_OCR_MIME_TYPES,
    MAX_OCR_FILE_SIZE_BYTES,
)
from app.modules.atharva_veda.nivaran.schemas.phase6d import (
    GrievanceFeedbackCreate,
    GrievanceFeedbackResponse,
    PublicFeedbackSummaryResponse,
    ClosureQueueItem,
    ClosureQueueResponse,
    FinalizeClosureRequest,
    FinalizeClosureResponse,
    ClosureDetailResponse,
    EFileDocumentItem,
    EFileResponse,
    EFileVerificationResponse,
    StudentMasterRecordSummaryItem,
    StudentMasterRecordDetailResponse,
    PaginatedStudentRecordsResponse,
)
from app.modules.atharva_veda.nivaran.services.grievance_feedback_service import (
    GrievanceFeedbackService,
)
from app.modules.atharva_veda.nivaran.services.student_master_record_service import (
    StudentMasterRecordService,
)
from app.modules.atharva_veda.nivaran.services.efile_service import (
    EFileService,
)
from app.modules.atharva_veda.nivaran.services.manager_closure_service import (
    ManagerClosureService,
)
from app.schemas.response import ApiResponse
from pathlib import Path

logger = logging.getLogger("vyasa.atharva.nivaran.router")

router = APIRouter(prefix="/modules/atharva-veda/nivaran", tags=["Atharva Veda: NIVARAN-AI"])


# ==========================================
# Helpers / Serializers
# ==========================================

def serialize_grievance_summary(g: Grievance, db: Session) -> GrievanceSummaryItem:
    final_cat_name = None
    if g.final_category_id:
        final_cat = db.get(Category, g.final_category_id)
        final_cat_name = final_cat.name if final_cat else None

    return GrievanceSummaryItem(
        id=g.id,
        grievance_id=g.grievance_id,
        title=g.title,
        status=g.status.value,
        priority=g.priority.value,
        subject_id=g.subject_id,
        subject_name=g.subject.name if g.subject else "Unknown Subject",
        category_id=g.category_id,
        category_name=g.category.name if g.category else "Unknown Category",
        final_category_name=final_cat_name,
        assigned_authority_name=g.assigned_authority.name_snapshot if g.assigned_authority else None,
        created_at=g.created_at,
        updated_at=g.updated_at,
    )


def serialize_grievance_detail(g: Grievance, db: Session) -> GrievanceDetailResponse:
    final_cat_name = None
    if g.final_category_id:
        final_cat = db.get(Category, g.final_category_id)
        final_cat_name = final_cat.name if final_cat else None

    ai_suggested_name = None
    if g.ai_suggested_category_id:
        ai_cat = db.get(Category, g.ai_suggested_category_id)
        ai_suggested_name = ai_cat.name if ai_cat else None

    # Status history
    history_records = db.scalars(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == g.id)
        .order_by(GrievanceStatusHistory.created_at.asc())
    ).all()
    history_items = [
        GrievanceStatusHistoryItem(
            id=h.id,
            from_status=h.from_status,
            to_status=h.to_status,
            actor_user_id=h.actor_user_id,
            actor_authority_id=h.actor_authority_id,
            actor_type=h.actor_type.value,
            remarks=h.remarks,
            created_at=h.created_at,
        )
        for h in history_records
    ]

    # Documents
    docs = db.scalars(
        select(Document)
        .where(Document.grievance_id == g.id)
        .order_by(Document.created_at.asc())
    ).all()
    doc_items = [
        DocumentItem(
            id=d.id,
            file_name=d.file_name,
            mime_type=d.mime_type,
            file_size=d.file_size,
            document_type=str(d.document_type or "ATTACHMENT"),
            content_hash=d.content_hash,
            created_at=d.created_at,
        )
        for d in docs
    ]

    reg_number = g.student_record.registration_number_snapshot if g.student_record else None
    subj_cluster_name = g.subject.cluster.name if (g.subject and hasattr(g.subject, "cluster") and g.subject.cluster) else None

    return GrievanceDetailResponse(
        id=g.id,
        grievance_id=g.grievance_id,
        title=g.title,
        description=g.description,
        status=g.status.value,
        priority=g.priority.value,
        subject_id=g.subject_id,
        subject_name=g.subject.name if g.subject else "",
        subject_cluster_name=subj_cluster_name,
        category_id=g.category_id,
        category_name=g.category.name if g.category else "",
        final_category_id=g.final_category_id,
        final_category_name=final_cat_name,
        category_reviewed=g.category_reviewed,
        category_overridden=g.category_overridden,
        category_override_reason=g.category_override_reason,
        ai_suggested_category_id=g.ai_suggested_category_id,
        ai_suggested_category_name=ai_suggested_name,
        ai_confidence=float(g.ai_confidence) if g.ai_confidence is not None else None,
        assigned_authority_id=g.assigned_authority_id,
        assigned_authority_name=g.assigned_authority.name_snapshot if g.assigned_authority else None,
        assigned_authority_role=g.assigned_authority.role.value if g.assigned_authority else None,
        applicant_id=g.applicant.id if g.applicant else g.applicant_vyasa_user_id,
        applicant_name=g.applicant.full_name if g.applicant else "Applicant",
        applicant_email=g.applicant.email if g.applicant else "",
        student_registration_number=reg_number,
        created_at=g.created_at,
        updated_at=g.updated_at,
        resolution_summary=g.resolution_summary,
        resolved_at=g.resolved_at,
        history=history_items,
        documents=doc_items,
    )


# ==========================================
# Module & Workspace Meta
# ==========================================

@router.get("/status", response_model=ApiResponse)
def get_nivaran_status():
    """
    Returns the operational and integration status of Atharva Veda: NIVARAN-AI
    within the single modular monolith application.
    """
    module = get_module_by_key("atharva_veda_nivaran")
    return ApiResponse(
        success=True,
        message="Atharva Veda (NIVARAN-AI) modular monolith boundary operational.",
        data=module.model_dump() if module else {"status": "active"},
    )


@router.get("/workspace", response_model=ApiResponse)
def get_nivaran_workspace_summary(
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Returns authenticated user context and persona for the Atharva Veda NIVARAN workspace.
    Verifies user identity within the single VYASA session.
    """
    roles = [r.name.lower() for r in current_user.roles]
    is_admin = "administrator" in roles or "admin" in roles
    is_applicant = "applicant" in roles

    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == current_user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )

    persona = "guest"
    if is_admin and not authority:
        persona = "admin"
    elif authority:
        if authority.role.value == "MANAGER":
            persona = "manager"
        elif authority.role.value == "ASSISTANT_DEAN":
            persona = "assistant_dean"
        elif authority.role.value == "ASSOCIATE_DEAN":
            persona = "associate_dean"
        elif authority.role.value == "DEAN":
            persona = "dean"
        else:
            persona = "authority"
    elif is_applicant:
        persona = "applicant"
    elif is_admin:
        persona = "admin"

    return ApiResponse(
        success=True,
        message="Atharva Veda user session verified.",
        data={
            "user_id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "roles": [r.name for r in current_user.roles],
            "persona": persona,
            "authority_role": authority.role.value if authority else None,
            "authority_id": str(authority.id) if authority else None,
            "authority_designation": authority.designation if authority else None,
            "is_applicant": is_applicant,
            "is_admin": is_admin,
            "is_authority": authority is not None,
            "domain": "Atharva Veda: Grievance Redressal & Institutional Well-Being",
            "system": "NIVARAN-AI",
        },
    )



# ==========================================
# Taxonomy Endpoints
# ==========================================

@router.get("/taxonomy/subjects", response_model=ApiResponse)
def list_active_subjects(db: Session = Depends(get_db)):
    """
    Retrieves all active academic subjects for grievance submission.
    """
    stmt = (
        select(Subject)
        .options(selectinload(Subject.cluster))
        .where(Subject.is_active.is_(True))
        .order_by(Subject.name.asc())
    )
    subjects = db.scalars(stmt).all()
    data = [
        TaxonomySubjectItem(
            id=s.id,
            name=s.name,
            code=s.code,
            cluster_id=s.subject_cluster_id,
            cluster_name=s.cluster.name if s.cluster else None,
            is_active=s.is_active,
        ).model_dump()
        for s in subjects
    ]
    return ApiResponse(
        success=True,
        message="Active academic subjects retrieved successfully.",
        data=data,
    )


@router.get("/taxonomy/categories", response_model=ApiResponse)
def list_active_categories(db: Session = Depends(get_db)):
    """
    Retrieves all active grievance categories for grievance submission and triage.
    """
    stmt = (
        select(Category)
        .options(selectinload(Category.grievance_cluster))
        .where(Category.is_active.is_(True))
        .order_by(Category.name.asc())
    )
    categories = db.scalars(stmt).all()
    data = [
        TaxonomyCategoryItem(
            id=c.id,
            name=c.name,
            code=getattr(c, "code", None),
            description=c.description,
            routing_type=c.routing_type.value,
            cluster_id=c.grievance_cluster_id,
            cluster_name=c.grievance_cluster.name if c.grievance_cluster else None,
            is_active=c.is_active,
        ).model_dump()
        for c in categories
    ]
    return ApiResponse(
        success=True,
        message="Active grievance categories retrieved successfully.",
        data=data,
    )


# ==========================================
# OCR Extraction (Input Assistance)
# ==========================================

@router.post("/grievances/ocr/extract", response_model=ApiResponse, status_code=status.HTTP_200_OK)
async def extract_handwritten_grievance(
    file: UploadFile = File(...),
    current_user: User = Depends(require_atharva_applicant),
):
    """
    Extract title and description from an uploaded handwritten or printed application document.
    INPUT-ASSISTANCE ONLY: Does NOT create or persist a grievance record.
    The applicant reviews and edits the returned fields in the form before standard submission.
    """
    mime_type = file.content_type or ""
    if not mime_type or mime_type == "application/octet-stream":
        ext = (file.filename or "").lower().split(".")[-1]
        ext_map = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "webp": "image/webp",
            "pdf": "application/pdf",
        }
        mime_type = ext_map.get(ext, mime_type)

    if mime_type not in SUPPORTED_OCR_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{file.content_type}'. Please upload a PNG, JPG, JPEG, WEBP image or PDF document.",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if len(file_bytes) > MAX_OCR_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10MB limit for OCR extraction.",
        )

    try:
        extracted = ocr_extractor.extract_from_document(
            file_bytes=file_bytes,
            mime_type=mime_type,
        )
        return ApiResponse(
            success=True,
            message="Document digitized successfully using AI multimodal extraction.",
            data=GrievanceOCRExtractResponse(
                title=extracted["title"],
                description=extracted["description"],
                confidence_note=extracted.get("confidence_note"),
            ).model_dump(),
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        logger.error(f"OCR extraction system error: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to digitize handwritten document using AI. Please type your grievance details manually or try a clearer image.",
        )


# ==========================================
# Grievance Submission & Tracking
# ==========================================

@router.post("/grievances", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def submit_grievance(
    payload: GrievanceSubmitRequest,
    current_user: User = Depends(require_atharva_applicant),
    db: Session = Depends(get_db),
):
    """
    Submits a new formal grievance into Atharva Veda:
    1. Enforces daily submission quota (5/day in Asia/Kolkata).
    2. Runs duplicate detection against active cases (HTTP 409).
    3. Generates institutional tracking ID (CSJMU-YYYY-NNNNN).
    4. Triggers automatic AI classification (SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW).
    5. Preserves immutable status history and audit log.
    """
    grievance = GrievanceService.submit_grievance(
        db=db,
        applicant=current_user,
        request_data=payload,
    )
    data = serialize_grievance_detail(grievance, db)
    return ApiResponse(
        success=True,
        message=f"Grievance {grievance.grievance_id} submitted successfully and queued for review.",
        data=data.model_dump(),
    )


@router.get("/grievances/my", response_model=ApiResponse)
def get_my_grievances(
    current_user: User = Depends(require_atharva_applicant),
    db: Session = Depends(get_db),
):
    """
    Lists all grievances submitted by the authenticated applicant with complete user isolation.
    """
    grievances = GrievanceService.get_applicant_grievances(db=db, applicant=current_user)
    data = [serialize_grievance_summary(g, db).model_dump() for g in grievances]
    return ApiResponse(
        success=True,
        message="Applicant grievances retrieved successfully.",
        data=data,
    )


@router.get("/grievances/{grievance_id}", response_model=ApiResponse)
def get_grievance_detail(
    grievance_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves full grievance dossier including AI classification, status history, and attachments.
    Enforces object-level access control: submitting applicant or authorized institutional authority.
    """
    grievance = GrievanceService.get_grievance_detail(
        db=db,
        grievance_id=grievance_id,
        current_user=current_user,
    )
    data = serialize_grievance_detail(grievance, db)
    return ApiResponse(
        success=True,
        message="Grievance dossier retrieved successfully.",
        data=data.model_dump(),
    )


# ==========================================
# Document Attachments & Download
# ==========================================

@router.post("/grievances/{grievance_id}/documents", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
async def upload_grievance_document(
    grievance_id: str,
    file: UploadFile = File(...),
    document_type: str = Form("ATTACHMENT"),
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Uploads a supporting document attachment to a grievance matching reference NIVARAN API.
    Enforces applicant ownership, 5-file cap, 20MB size cap, and allowed extensions.
    """
    file_bytes = await file.read()
    doc = GrievanceService.upload_grievance_document(
        db=db,
        grievance_id_or_tracking=grievance_id,
        current_user=current_user,
        file_name=file.filename or "attachment",
        file_bytes=file_bytes,
        mime_type=file.content_type or "application/octet-stream",
        document_type=document_type,
    )
    data = DocumentItem(
        id=doc.id,
        file_name=doc.file_name,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        document_type=str(doc.document_type or "ATTACHMENT"),
        content_hash=doc.content_hash,
        created_at=doc.created_at,
    )
    return ApiResponse(
        success=True,
        message=f"Document '{doc.file_name}' uploaded successfully.",
        data=data.model_dump(),
    )


@router.get("/documents/{document_id}/download")
def download_grievance_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Downloads an attached grievance document.
    Enforces authorization: applicant can only download own grievance documents;
    authorities with appointment can download documents within their jurisdiction.
    """
    file_path, file_name, mime_type = GrievanceService.get_document_file_for_download(
        db=db,
        document_id=document_id,
        current_user=current_user,
    )
    return FileResponse(
        path=str(file_path),
        filename=file_name,
        media_type=mime_type,
    )


# ==========================================
# Manager Triage & Review
# ==========================================

@router.get("/manager/queue", response_model=ApiResponse)
def get_manager_triage_queue(
    status_filter: Optional[GrievanceStatus] = Query(None, description="Filter by status (default: PENDING_REVIEW)"),
    queue: Optional[str] = Query(None, description="Action queue: ai_review, reopened, assigned"),
    priority: Optional[GrievancePriority] = Query(None, description="Filter by priority"),
    category_id: Optional[uuid.UUID] = Query(None, description="Filter by category ID"),
    subject_id: Optional[uuid.UUID] = Query(None, description="Filter by subject ID"),
    search: Optional[str] = Query(None, description="Search term for ID, title, description"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
    manager_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Retrieves the Manager triage queue for Atharva Veda.
    Defaults to cases in PENDING_REVIEW awaiting category confirmation and routing assignment.
    """
    items = ManagerReviewService.get_triage_queue(
        db=db,
        status_filter=status_filter,
        queue=queue,
        priority=priority,
        category_id=category_id,
        subject_id=subject_id,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    data = [serialize_grievance_summary(g, db).model_dump() for g in items]
    return ApiResponse(
        success=True,
        message="Manager triage queue retrieved successfully.",
        data=data,
    )


@router.patch("/grievances/{grievance_id}/ai-review", response_model=ApiResponse)
def review_ai_recommendation(
    grievance_id: str,
    payload: AIReviewRequest,
    manager_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Manager review of AI classification (reference parity for PATCH /grievances/{id}/ai-review):
    1. Ratifies AI recommendation (CONFIRMED/ACCEPTED) or overrides (OVERRIDDEN).
    2. Updates final_category_id, category_reviewed, category_overridden.
    3. Preserves immutable AI classification in AIProcessingRecord.
    4. Writes structured audit log ("AI_CATEGORY_CONFIRMED" or "AI_CATEGORY_OVERRIDDEN").
    """
    grievance = ManagerReviewService.review_ai_recommendation(
        db=db,
        grievance_id_or_tracking=grievance_id,
        manager_user=manager_user,
        review_data=payload,
    )
    data = serialize_grievance_detail(grievance, db)
    return ApiResponse(
        success=True,
        message=f"AI recommendation reviewed successfully for {grievance.grievance_id}.",
        data=data.model_dump(),
    )


@router.get("/manager/grievances/{grievance_id}/preview-routing", response_model=ApiResponse)
def preview_routing(
    grievance_id: uuid.UUID,
    category_id: Optional[uuid.UUID] = Query(None, description="Optional override category ID to preview"),
    manager_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Calculates and previews the dynamically resolved authority before committing triage assignment.
    """
    preview = ManagerReviewService.preview_routing(
        db=db,
        grievance_id=grievance_id,
        category_id=category_id,
    )
    return ApiResponse(
        success=True,
        message="Routing destination preview calculated successfully.",
        data=preview.model_dump(),
    )


@router.post("/manager/grievances/{grievance_id}/review", response_model=ApiResponse)
def review_and_assign_grievance(
    grievance_id: uuid.UUID,
    payload: ManagerReviewRequest,
    manager_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Manager action to confirm or override grievance category and assign to the dynamically resolved authority.
    1. Ratifies AI/applicant category OR sets override category with mandatory justification.
    2. Dynamically routes to Stage 1 accountable Assistant Dean based on academic subject cluster.
       (Downstream grievance-category routing occurs at Stage 2 when Assistant Dean forwards).
    3. Deactivates prior active assignments and creates new active assignment.
    4. Transitions case status from PENDING_REVIEW to ASSIGNED.
    5. Logs status history and audit trail.
    """
    grievance = ManagerReviewService.review_and_assign_grievance(
        db=db,
        grievance_id=grievance_id,
        manager_user=manager_user,
        action_data=payload,
    )
    data = serialize_grievance_detail(grievance, db)
    return ApiResponse(
        success=True,
        message=f"Grievance {grievance.grievance_id} successfully triaged and assigned to accountable authority.",
        data=data.model_dump(),
    )


# ==========================================
# Assistant Dean Workflow (Phase 6C Parity)
# ==========================================

@router.get("/assistant-dean/queue", response_model=ApiResponse)
def get_assistant_dean_queue(
    status_filter: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    priority: Optional[GrievancePriority] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Retrieves the assigned case queue for the authenticated Assistant Dean.
    Strictly scoped to cases where this Assistant Dean has active jurisdiction.
    """
    items, total = AssistantDeanService.get_assigned_queue(
        db=db,
        asst_dean_user=user,
        status_filter=status_filter,
        search=search,
        priority=priority,
        page=page,
        page_size=page_size,
    )
    data = {
        "items": [serialize_grievance_summary(g, db).model_dump() for g in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
    }
    return ApiResponse(
        success=True,
        message="Assistant Dean assigned queue retrieved successfully.",
        data=data,
    )


@router.get("/assistant-dean/cases", response_model=ApiResponse)
def get_assistant_dean_cases(
    status_filter: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    priority: Optional[GrievancePriority] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Backwards-compatible case queue endpoint for Assistant Dean.
    Returns list of cases directly in data.
    """
    items, _ = AssistantDeanService.get_assigned_queue(
        db=db,
        asst_dean_user=user,
        status_filter=status_filter,
        search=search,
        priority=priority,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(
        success=True,
        message="Assistant Dean case queue retrieved successfully.",
        data=[serialize_grievance_summary(g, db).model_dump() for g in items],
    )


@router.get("/assignments/my/grievances", response_model=ApiResponse)
def get_my_assigned_grievances(
    user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Reference-equivalent endpoint (apiRequest('/assignments/my/grievances')).
    Returns all active grievances assigned to the calling authority.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active authority profile found.")

    active_ids = select(Assignment.grievance_id).where(
        Assignment.authority_id == authority.id,
        Assignment.is_active.is_(True),
    )
    other_active = select(Assignment.grievance_id).where(
        Assignment.authority_id != authority.id,
        Assignment.is_active.is_(True),
    )
    cases = list(
        db.scalars(
            select(Grievance)
            .options(
                selectinload(Grievance.subject).selectinload(Subject.cluster),
                selectinload(Grievance.category),
                selectinload(Grievance.applicant),
                selectinload(Grievance.assigned_authority),
            )
            .where(
                or_(
                    Grievance.id.in_(active_ids),
                    and_(
                        Grievance.assigned_authority_id == authority.id,
                        ~Grievance.id.in_(other_active),
                    ),
                )
            )
            .order_by(Grievance.created_at.desc())
        ).all()
    )
    return ApiResponse(
        success=True,
        message="Assigned grievances retrieved successfully.",
        data=[serialize_grievance_summary(g, db).model_dump() for g in cases],
    )


@router.get("/assistant-dean/grievances/{grievance_id}", response_model=ApiResponse)
def get_assistant_dean_grievance_detail(
    grievance_id: str,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Retrieves full case dossier for Assistant Dean review,
    including Stage 2 routing destination preview and forwarding eligibility.
    """
    grievance, next_auth, can_forward = AssistantDeanService.get_grievance_detail(
        db=db,
        grievance_id_or_tracking=grievance_id,
        asst_dean_user=user,
    )
    detail = serialize_grievance_detail(grievance, db)

    next_auth_data = None
    stage2_preview = None
    if next_auth:
        next_auth_data = {
            "id": str(next_auth.id),
            "name": next_auth.name_snapshot,
            "role": next_auth.role.value,
            "designation": next_auth.designation,
            "email": next_auth.email_snapshot,
        }

        # Resolve category routing type
        cat = grievance.category
        if grievance.final_category_id:
            cat = db.get(Category, grievance.final_category_id) or cat
        routing_type_str = cat.routing_type.value if (cat and hasattr(cat, "routing_type") and cat.routing_type) else "CLUSTER"

        stage2_preview = {
            "grievance_id": str(grievance.id),
            "subject_name": grievance.subject.name if grievance.subject else "",
            "category_name": cat.name if cat else "",
            "routing_type": routing_type_str,
            "target_authority_id": str(next_auth.id),
            "target_authority_name": next_auth.name_snapshot,
            "target_authority_role": next_auth.role.value,
            "target_authority_email": next_auth.email_snapshot,
            "is_active": next_auth.is_active,
        }

    forward_blocked_reason = None
    if not can_forward:
        if grievance.status in [GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED]:
            forward_blocked_reason = "Grievance is already resolved or closed."
        elif not next_auth:
            forward_blocked_reason = "Terminal routing: this category has no higher escalation authority."
        else:
            forward_blocked_reason = "Not authorized to forward this case."

    routing_data = {
        "can_forward": can_forward,
        "can_resolve": grievance.status not in [GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED],
        "routing_type": stage2_preview["routing_type"] if stage2_preview else None,
        "next_authority_id": str(next_auth.id) if next_auth else None,
        "next_authority_name": next_auth.name_snapshot if next_auth else None,
        "next_authority_role": next_auth.role.value if next_auth else None,
        "next_authority": next_auth_data,
    }

    data = detail.model_dump()
    data.update({
        "can_forward": can_forward,
        "forward_blocked_reason": forward_blocked_reason,
        "stage2_routing_preview": stage2_preview,
        "next_authority": next_auth_data,
        "routing": routing_data,
        "resolution_summary": grievance.resolution_summary,
        "resolved_at": grievance.resolved_at.isoformat() if grievance.resolved_at else None,
        "grievance": detail.model_dump(),
    })

    return ApiResponse(
        success=True,
        message="Grievance dossier retrieved successfully.",
        data=data,
    )


@router.post("/assistant-dean/grievances/{grievance_id}/resolve", response_model=ApiResponse)
def resolve_grievance_assistant_dean(
    grievance_id: str,
    payload: AssistantDeanResolveRequest,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Direct resolution of grievance by Assistant Dean:
    Transitions status to RESOLVED, captures resolution notes,
    records status history & audit log, and notifies applicant + managers.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    resolved = AssistantDeanService.resolve_grievance(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=payload,
    )
    return ApiResponse(
        success=True,
        message=f"Grievance {resolved.grievance_id} has been resolved successfully.",
        data=serialize_grievance_detail(resolved, db).model_dump(),
    )



@router.post("/grievances/{grievance_id}/resolve", response_model=ApiResponse)
def resolve_grievance_canonical_alias(
    grievance_id: str,
    payload: dict,
    user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Canonical reference alias: POST /grievances/{grievance_id}/resolve
    Supports resolution by assigned authority (Assistant Dean or Associate Dean).
    """
    authority = get_current_nivaran_authority(user, db)
    if not authority:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Institutional authority profile required.")

    target_uuid = None
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    notes = payload.get("resolution_notes") or payload.get("notes") or ""

    if authority.role == NivaranRole.ASSOCIATE_DEAN:
        req = AssociateDeanResolveRequest(resolution_notes=notes)
        resolved = AssociateDeanService.resolve_grievance(
            db=db,
            grievance_id=target_uuid,
            assoc_dean_user=user,
            payload=req,
        )
    elif authority.role == NivaranRole.ASSISTANT_DEAN:
        req = AssistantDeanResolveRequest(resolution_notes=notes)
        resolved = AssistantDeanService.resolve_grievance(
            db=db,
            grievance_id=target_uuid,
            asst_dean_user=user,
            payload=req,
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only appointed Assistant Deans or Associate Deans can resolve grievances.",
        )

    return ApiResponse(
        success=True,
        message=f"Grievance {resolved.grievance_id} has been resolved successfully.",
        data=serialize_grievance_detail(resolved, db).model_dump(),
    )



@router.post("/assistant-dean/grievances/{grievance_id}/forward", response_model=ApiResponse)
def forward_grievance_assistant_dean(
    grievance_id: str,
    payload: AssistantDeanForwardRequest,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Stage 2 Category Routing Forwarding:
    Enforces 6-point checklist + 3 justification fields,
    routes case to Associate Dean (Grievance Cluster) or Fixed Authority,
    creates ForwardingConfirmation and new active assignment.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    updated, target_auth = AssistantDeanService.forward_grievance(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=payload,
    )
    return ApiResponse(
        success=True,
        message=f"Grievance {updated.grievance_id} successfully forwarded to {target_auth.name_snapshot} ({target_auth.role.value}).",
        data={
            "grievance": serialize_grievance_detail(updated, db).model_dump(),
            "assigned_to": {
                "id": str(target_auth.id),
                "name": target_auth.name_snapshot,
                "role": target_auth.role.value,
            },
        },
    )



@router.post("/assignments/{grievance_id}", response_model=ApiResponse)
def forward_assignment_canonical_alias(
    grievance_id: str,
    payload: dict,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Canonical reference alias: POST /assignments/{grievance_id}
    Maps reference ForwardConfirmationModal payload to AssistantDeanForwardRequest.
    """
    target_uuid = None
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    conf_data = payload.get("confirmation") or payload
    req = AssistantDeanForwardRequest(
        remarks=payload.get("remarks"),
        confirmation=conf_data,
    )
    updated, target_auth = AssistantDeanService.forward_grievance(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=req,
    )
    return ApiResponse(
        success=True,
        message=f"Grievance {updated.grievance_id} successfully forwarded to {target_auth.name_snapshot} ({target_auth.role.value}).",
        data={
            "grievance": serialize_grievance_detail(updated, db).model_dump(),
            "assigned_to": {
                "id": str(target_auth.id),
                "name": target_auth.name_snapshot,
                "role": target_auth.role.value,
            },
        },
    )


@router.post("/assistant-dean/grievances/{grievance_id}/document-requests", response_model=ApiResponse)
def request_documents_assistant_dean(
    grievance_id: str,
    payload: AssistantDeanDocumentRequestPayload,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Requests additional evidentiary documents from the applicant:
    Transitions status to AWAITING_INFORMATION, preserves active assignment,
    and dispatches notification to applicant.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    requests = AssistantDeanService.request_documents(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=payload,
    )

    return ApiResponse(
        success=True,
        message=f"Successfully requested {len(requests)} document(s).",
        data=[
            DocumentRequestResponseItem(
                id=r.id,
                grievance_id=r.grievance_id,
                request_group_id=r.request_group_id,
                document_name=r.document_name,
                description=r.description,
                is_required=True,
                status=r.status.value,
                deadline=r.due_date,
                requested_by_name=r.requested_by.name_snapshot if r.requested_by else None,
                requested_by_role=r.requested_by.role.value if r.requested_by else None,
                created_at=r.created_at,
            ).model_dump()
            for r in requests
        ],
    )


@router.post("/grievances/{grievance_id}/document-requests", response_model=ApiResponse)
def request_documents_canonical_alias(
    grievance_id: str,
    payload: dict,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Canonical reference alias: POST /grievances/{grievance_id}/document-requests
    """
    target_uuid = None
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    docs = payload.get("documents", [])
    if not docs and "document_name" in payload:
        docs = [{"document_name": payload["document_name"], "description": payload.get("description")}]
    req = AssistantDeanDocumentRequestPayload(
        documents=docs,
        deadline=payload.get("deadline"),
    )
    requests = AssistantDeanService.request_documents(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=req,
    )
    return ApiResponse(
        success=True,
        message=f"Successfully requested {len(requests)} document(s).",
        data=[
            DocumentRequestResponseItem(
                id=r.id,
                grievance_id=r.grievance_id,
                request_group_id=r.request_group_id,
                document_name=r.document_name,
                description=r.description,
                is_required=True,
                status=r.status.value,
                deadline=r.due_date,
                requested_by_name=r.requested_by.name_snapshot if r.requested_by else None,
                requested_by_role=r.requested_by.role.value if r.requested_by else None,
                created_at=r.created_at,
            ).model_dump()
            for r in requests
        ],
    )


@router.get("/grievances/{grievance_id}/document-requests", response_model=ApiResponse)
def get_grievance_document_requests(
    grievance_id: str,
    user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves document requests for a grievance.
    Accessible to applicant and authorized authorities.
    """
    target_uuid = None
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    requests = list(
        db.scalars(
            select(DocumentRequest)
            .options(selectinload(DocumentRequest.requested_by))
            .where(DocumentRequest.grievance_id == target_uuid)
            .order_by(DocumentRequest.created_at.desc())
        ).all()
    )
    return ApiResponse(
        success=True,
        message="Document requests retrieved successfully.",
        data=[
            DocumentRequestResponseItem(
                id=r.id,
                grievance_id=r.grievance_id,
                request_group_id=r.request_group_id,
                document_name=r.document_name,
                description=r.description,
                is_required=True,
                status=r.status.value,
                deadline=r.due_date,
                requested_by_name=r.requested_by.name_snapshot if r.requested_by else None,
                requested_by_role=r.requested_by.role.value if r.requested_by else None,
                created_at=r.created_at,
            ).model_dump()
            for r in requests
        ],
    )


@router.post("/assistant-dean/grievances/{grievance_id}/committee-requests", response_model=ApiResponse)
def request_committee_assistant_dean(
    grievance_id: str,
    payload: AssistantDeanCommitteeRequestPayload,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Requests formal committee formation from higher authority (Associate Dean / Dean).
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    req = AssistantDeanService.request_committee(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=payload,
    )

    return ApiResponse(
        success=True,
        message="Committee creation request submitted successfully.",
        data=CommitteeRequestResponseItem(
            id=req.id,
            grievance_id=req.grievance_id,
            requested_by_id=req.requested_by_id,
            requested_by_name=req.requested_by.name_snapshot if req.requested_by else "Assistant Dean",
            requested_by_role=req.requested_by.role.value if req.requested_by else "ASSISTANT_DEAN",
            request_status=req.request_status.value,
            justification=req.justification,
            reviewed_by_id=req.reviewed_by_id,
            reviewed_at=req.reviewed_at,
            review_remarks=req.review_remarks,
            created_at=req.created_at,
        ).model_dump(),
    )


@router.post("/committees/requests/{grievance_id}", response_model=ApiResponse)
def request_committee_canonical_alias(
    grievance_id: str,
    payload: dict,
    user: User = Depends(require_atharva_assistant_dean),
    db: Session = Depends(get_db),
):
    """
    Canonical reference alias: POST /committees/requests/{grievance_id}
    """
    target_uuid = None
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    req_payload = AssistantDeanCommitteeRequestPayload(
        target_authority_id=payload.get("target_authority_id"),
        justification=payload.get("justification") or payload.get("reason") or "",
        proposed_scope=payload.get("proposed_scope"),
        supporting_remarks=payload.get("supporting_remarks"),
    )
    req = AssistantDeanService.request_committee(
        db=db,
        grievance_id=target_uuid,
        asst_dean_user=user,
        payload=req_payload,
    )
    return ApiResponse(
        success=True,
        message="Committee creation request submitted successfully.",
        data=CommitteeRequestResponseItem(
            id=req.id,
            grievance_id=req.grievance_id,
            requested_by_id=req.requested_by_id,
            requested_by_name=req.requested_by.name_snapshot if req.requested_by else "Assistant Dean",
            requested_by_role=req.requested_by.role.value if req.requested_by else "ASSISTANT_DEAN",
            request_status=req.request_status.value,
            justification=req.justification,
            reviewed_by_id=req.reviewed_by_id,
            reviewed_at=req.reviewed_at,
            review_remarks=req.review_remarks,
            created_at=req.created_at,
        ).model_dump(),
    )


# ==========================================
# Associate Dean Workflow
# ==========================================

@router.get("/associate-dean/dashboard", response_model=ApiResponse)
def get_associate_dean_dashboard(
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Retrieves docket statistics and cluster identity for the authenticated Associate Dean.
    """
    stats = AssociateDeanService.get_dashboard_stats(db=db, assoc_dean_user=user)
    return ApiResponse(
        success=True,
        message="Associate Dean dashboard stats retrieved successfully.",
        data=stats,
    )


@router.get("/associate-dean/grievances", response_model=ApiResponse)
def get_associate_dean_grievances(
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    priority: Optional[GrievancePriority] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Retrieves grievances assigned to this Associate Dean within their jurisdictional docket.
    """
    items, total = AssociateDeanService.get_assigned_queue(
        db=db,
        assoc_dean_user=user,
        status_filter=status_filter,
        search=search,
        priority=priority,
        page=page,
        page_size=page_size,
    )
    data = [serialize_grievance_summary(g, db).model_dump() for g in items]
    return ApiResponse(
        success=True,
        message="Associate Dean jurisdictional grievances retrieved successfully.",
        data={
            "items": data,
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    )


@router.get("/associate-dean/cases", response_model=ApiResponse)
def get_associate_dean_cases(
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Compatibility alias for Associate Dean case queue.
    """
    items, total = AssociateDeanService.get_assigned_queue(
        db=db,
        assoc_dean_user=user,
        page=1,
        page_size=100,
    )
    data = [serialize_grievance_summary(g, db).model_dump() for g in items]
    return ApiResponse(
        success=True,
        message="Associate Dean case queue retrieved successfully.",
        data=data,
    )


@router.get("/associate-dean/grievances/{grievance_id}", response_model=ApiResponse)
def get_associate_dean_grievance_detail(
    grievance_id: str,
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Retrieves full case dossier for an Associate Dean:
    Enforces active assignment jurisdiction, previews downstream Dean destination,
    and returns complete status history, documents, and document requests.
    """
    grievance, next_auth, can_forward = AssociateDeanService.get_grievance_detail(
        db=db,
        grievance_id_or_tracking=grievance_id,
        assoc_dean_user=user,
    )

    detail = serialize_grievance_detail(grievance, db)

    next_auth_data = None
    stage3_preview = None
    if next_auth:
        next_auth_data = {
            "id": str(next_auth.id),
            "name": next_auth.name_snapshot,
            "role": next_auth.role.value,
            "email": next_auth.email_snapshot,
        }
        stage3_preview = {
            "grievance_id": str(grievance.id),
            "routing_type": "DEAN",
            "target_authority_id": str(next_auth.id),
            "target_authority_name": next_auth.name_snapshot,
            "target_authority_role": next_auth.role.value,
            "target_authority_email": next_auth.email_snapshot,
            "is_active": next_auth.is_active,
        }

    forward_blocked_reason = None
    if not can_forward:
        if grievance.status in [GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED]:
            forward_blocked_reason = "Grievance is already resolved or closed."
        elif not next_auth:
            forward_blocked_reason = "Executive routing: no active Dean authority is configured."
        else:
            forward_blocked_reason = "Not authorized to forward this case."

    routing_data = {
        "can_forward": can_forward,
        "can_resolve": grievance.status not in [GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED],
        "routing_type": "DEAN",
        "next_authority_id": str(next_auth.id) if next_auth else None,
        "next_authority_name": next_auth.name_snapshot if next_auth else None,
        "next_authority_role": next_auth.role.value if next_auth else None,
        "next_authority": next_auth_data,
    }

    data = detail.model_dump()
    data.update({
        "can_forward": can_forward,
        "can_resolve": routing_data["can_resolve"],
        "forward_blocked_reason": forward_blocked_reason,
        "stage3_dean_preview": stage3_preview,
        "next_authority": next_auth_data,
        "routing": routing_data,
        "resolution_summary": grievance.resolution_summary,
        "resolved_at": grievance.resolved_at.isoformat() if grievance.resolved_at else None,
        "grievance": detail.model_dump(),
    })

    return ApiResponse(
        success=True,
        message="Grievance dossier retrieved successfully.",
        data=data,
    )


@router.post("/associate-dean/grievances/{grievance_id}/resolve", response_model=ApiResponse)
def resolve_grievance_associate_dean(
    grievance_id: str,
    payload: AssociateDeanResolveRequest,
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Direct resolution of grievance by Associate Dean:
    Transitions status to RESOLVED, captures resolution notes,
    records status history & audit log, and notifies applicant + managers.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    resolved = AssociateDeanService.resolve_grievance(
        db=db,
        grievance_id=target_uuid,
        assoc_dean_user=user,
        payload=payload,
    )
    res_data = serialize_grievance_detail(resolved, db).model_dump()
    res_data["resolution_summary"] = resolved.resolution_summary
    res_data["resolved_at"] = resolved.resolved_at.isoformat() if resolved.resolved_at else None
    return ApiResponse(
        success=True,
        message=f"Grievance {resolved.grievance_id} has been resolved successfully by Associate Dean.",
        data=res_data,
    )


@router.post("/associate-dean/grievances/{grievance_id}/forward", response_model=ApiResponse)
def forward_grievance_associate_dean(
    grievance_id: str,
    payload: AssociateDeanForwardRequest,
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Stage 3 Forwarding / Escalation to Dean R&D:
    Deactivates active Associate Dean assignment, creates active Dean assignment,
    sets status to ESCALATED, logs status history and audit event, and dispatches notifications.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    updated, target_auth = AssociateDeanService.forward_grievance(
        db=db,
        grievance_id=target_uuid,
        assoc_dean_user=user,
        payload=payload,
    )
    grv_data = serialize_grievance_detail(updated, db).model_dump()
    fwd_data = dict(grv_data)
    fwd_data["status"] = updated.status.value
    fwd_data["grievance"] = grv_data
    fwd_data["assigned_to"] = {
        "id": str(target_auth.id),
        "name": target_auth.name_snapshot,
        "role": target_auth.role.value,
    }
    return ApiResponse(
        success=True,
        message=f"Grievance {updated.grievance_id} successfully escalated to Dean {target_auth.name_snapshot}.",
        data=fwd_data,
    )


@router.post("/associate-dean/grievances/{grievance_id}/escalate", response_model=ApiResponse)
def escalate_grievance_associate_dean(
    grievance_id: str,
    payload: AssociateDeanForwardRequest,
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Direct alias for Associate Dean escalation to Dean R&D.
    """
    return forward_grievance_associate_dean(grievance_id=grievance_id, payload=payload, user=user, db=db)


@router.post("/associate-dean/grievances/{grievance_id}/document-requests", response_model=ApiResponse)
def request_documents_associate_dean(
    grievance_id: str,
    payload: AssociateDeanDocumentRequestPayload,
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Requests additional evidentiary documents from the applicant:
    Transitions status to AWAITING_INFORMATION, preserves active assignment,
    and dispatches notification to applicant.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    requests = AssociateDeanService.request_documents(
        db=db,
        grievance_id=target_uuid,
        assoc_dean_user=user,
        payload=payload,
    )

    items = [
        DocumentRequestResponseItem(
            id=r.id,
            grievance_id=r.grievance_id,
            request_group_id=r.request_group_id,
            document_name=r.document_name,
            description=r.description,
            is_required=True,
            status=r.status.value,
            deadline=r.due_date,
            requested_by_name=r.requested_by.name_snapshot if r.requested_by else None,
            requested_by_role=r.requested_by.role.value if r.requested_by else None,
            created_at=r.created_at,
        ).model_dump()
        for r in requests
    ]
    return ApiResponse(
        success=True,
        message=f"Successfully requested {len(requests)} document(s).",
        data={
            "status": "AWAITING_INFORMATION",
            "grievance_id": str(target_uuid),
            "requests": items,
            "document_requests": items,
            "items": items,
        },
    )


@router.post("/associate-dean/grievances/{grievance_id}/request-committee", response_model=ApiResponse)
def request_committee_associate_dean(
    grievance_id: str,
    payload: AssociateDeanCommitteeRequestPayload,
    user: User = Depends(require_atharva_associate_dean),
    db: Session = Depends(get_db),
):
    """
    Submits a committee creation request for special inquiry / departmental investigation.
    """
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    req = AssociateDeanService.request_committee(
        db=db,
        grievance_id=target_uuid,
        assoc_dean_user=user,
        payload=payload,
    )
    return ApiResponse(
        success=True,
        message="Committee creation request submitted successfully by Associate Dean.",
        data=CommitteeRequestResponseItem(
            id=req.id,
            grievance_id=req.grievance_id,
            requested_by_id=req.requested_by_id,
            requested_by_name=req.requested_by.name_snapshot if req.requested_by else "Associate Dean",
            requested_by_role=req.requested_by.role.value if req.requested_by else "ASSOCIATE_DEAN",
            request_status=req.request_status.value,
            justification=req.justification,
            reviewed_by_id=req.reviewed_by_id,
            reviewed_at=req.reviewed_at,
            review_remarks=req.review_remarks,
            created_at=req.created_at,
        ).model_dump(),
    )


@router.post("/grievances/{grievance_id}/escalate", response_model=ApiResponse)
def escalate_grievance_canonical_alias(
    grievance_id: str,
    payload: dict,
    user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Canonical reference alias: POST /grievances/{grievance_id}/escalate
    Dispatches to Assistant Dean or Associate Dean forwarding service based on caller role.
    """
    authority = get_current_nivaran_authority(user, db)
    if not authority:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Institutional authority profile required.")

    target_uuid = None
    try:
        target_uuid = uuid.UUID(grievance_id)
    except ValueError:
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == grievance_id))
        if not g:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found.")
        target_uuid = g.id

    if authority.role == NivaranRole.ASSOCIATE_DEAN:
        reason = payload.get("reason") or payload.get("remarks") or ""
        fwd_req = AssociateDeanForwardRequest(
            reason=reason,
            remarks=payload.get("remarks"),
            confirmation=payload.get("confirmation"),
        )
        updated, target_auth = AssociateDeanService.forward_grievance(
            db=db,
            grievance_id=target_uuid,
            assoc_dean_user=user,
            payload=fwd_req,
        )
        grv_data = serialize_grievance_detail(updated, db).model_dump()
        res_data = dict(grv_data)
        res_data["status"] = updated.status.value
        res_data["grievance"] = grv_data
        res_data["assigned_to"] = {
            "id": str(target_auth.id),
            "name": target_auth.name_snapshot,
            "role": target_auth.role.value,
        }
        return ApiResponse(
            success=True,
            message=f"Grievance {updated.grievance_id} successfully escalated to Dean {target_auth.name_snapshot}.",
            data=res_data,
        )
    elif authority.role == NivaranRole.ASSISTANT_DEAN:
        conf_data = payload.get("confirmation") or payload
        req = AssistantDeanForwardRequest(
            remarks=payload.get("remarks"),
            confirmation=conf_data,
        )
        updated, target_auth = AssistantDeanService.forward_grievance(
            db=db,
            grievance_id=target_uuid,
            asst_dean_user=user,
            payload=req,
        )
        return ApiResponse(
            success=True,
            message=f"Grievance {updated.grievance_id} successfully forwarded to {target_auth.name_snapshot}.",
            data={
                "grievance": serialize_grievance_detail(updated, db).model_dump(),
                "assigned_to": {
                    "id": str(target_auth.id),
                    "name": target_auth.name_snapshot,
                    "role": target_auth.role.value,
                },
            },
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only appointed Assistant Deans or Associate Deans can escalate grievances.",
        )



# ==========================================
# Dean Workflow
# ==========================================

@router.get("/dean/cases", response_model=ApiResponse)
def get_dean_cases(
    user: User = Depends(require_atharva_dean),
    db: Session = Depends(get_db),
):
    """
    Retrieves institutional executive review queue for the Dean.
    """
    authority = db.scalar(
        select(NivaranAuthority).where(
            NivaranAuthority.vyasa_user_id == user.id,
            NivaranAuthority.is_active.is_(True),
        )
    )
    if not authority:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Authority profile not found.")

    stmt = (
        select(Grievance)
        .options(
            selectinload(Grievance.subject),
            selectinload(Grievance.category),
            selectinload(Grievance.applicant),
            selectinload(Grievance.assigned_authority),
        )
        .where(
            Grievance.status.in_([
                GrievanceStatus.ASSIGNED,
                GrievanceStatus.IN_PROGRESS,
                GrievanceStatus.ESCALATED,
            ])
            | (Grievance.assigned_authority_id == authority.id)
        )
        .order_by(Grievance.created_at.desc())
    )
    cases = db.scalars(stmt).all()
    data = [serialize_grievance_summary(g, db).model_dump() for g in cases]
    return ApiResponse(
        success=True,
        message="Dean executive review queue retrieved successfully.",
        data=data,
    )


@router.get("/dean/dashboard", response_model=ApiResponse)
def get_dean_dashboard(
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    status: Optional[str] = Query(None, description="Grievance status filter"),
    priority: Optional[str] = Query(None, description="Priority level filter"),
    current_level: Optional[str] = Query(None, description="Workflow stage filter"),
    authority_id: Optional[uuid.UUID] = Query(None, description="Active handling authority ID"),
    category_id: Optional[uuid.UUID] = Query(None, description="Category ID"),
    grievance_cluster_id: Optional[uuid.UUID] = Query(None, description="Grievance Cluster ID"),
    subject_cluster_id: Optional[uuid.UUID] = Query(None, description="Subject Cluster ID"),
    subject_id: Optional[uuid.UUID] = Query(None, description="Subject ID"),
    routing_type: Optional[str] = Query(None, description="Routing type filter"),
    aging_bucket: Optional[str] = Query(None, description="Aging bucket filter"),
    user: User = Depends(require_atharva_dean),
    db: Session = Depends(get_db),
):
    """
    Dean Executive Command Center Analytics Endpoint.
    Returns complete institutional metrics, stage flows, bottleneck analysis,
    aging distributions, authority workloads, and surveillance indicators.
    Strictly restricted to appointed Atharva Veda Dean.
    """
    dashboard_data = DeanDashboardService.get_dashboard_data(
        db=db,
        start_date=start_date,
        end_date=end_date,
        status=status,
        priority=priority,
        current_level=current_level,
        authority_id=authority_id,
        category_id=category_id,
        grievance_cluster_id=grievance_cluster_id,
        subject_cluster_id=subject_cluster_id,
        subject_id=subject_id,
        routing_type=routing_type,
        aging_bucket=aging_bucket,
    )
    return ApiResponse(
        success=True,
        message="Dean Executive Command Center analytics retrieved successfully.",
        data=dashboard_data.model_dump(),
    )


@router.get("/dean/dashboard/cases", response_model=ApiResponse)
def get_dean_dashboard_cases_ledger(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search tracking ID or keyword"),
    sort_by: str = Query("created_at", description="Field to sort by"),
    sort_dir: str = Query("desc", description="Sort direction (asc or desc)"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    status: Optional[str] = Query(None, description="Grievance status filter"),
    priority: Optional[str] = Query(None, description="Priority level filter"),
    current_level: Optional[str] = Query(None, description="Workflow stage filter"),
    authority_id: Optional[uuid.UUID] = Query(None, description="Active handling authority ID"),
    category_id: Optional[uuid.UUID] = Query(None, description="Category ID"),
    grievance_cluster_id: Optional[uuid.UUID] = Query(None, description="Grievance Cluster ID"),
    subject_cluster_id: Optional[uuid.UUID] = Query(None, description="Subject Cluster ID"),
    subject_id: Optional[uuid.UUID] = Query(None, description="Subject ID"),
    routing_type: Optional[str] = Query(None, description="Routing type filter"),
    aging_bucket: Optional[str] = Query(None, description="Aging bucket filter"),
    user: User = Depends(require_atharva_dean),
    db: Session = Depends(get_db),
):
    """
    Dean Executive Grievance Ledger Endpoint.
    Returns searchable, sortable, paginated case rows responsive to global cross-filters.
    Strictly restricted to appointed Atharva Veda Dean.
    """
    ledger_data = DeanDashboardService.get_dashboard_cases_ledger(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        start_date=start_date,
        end_date=end_date,
        status=status,
        priority=priority,
        current_level=current_level,
        authority_id=authority_id,
        category_id=category_id,
        grievance_cluster_id=grievance_cluster_id,
        subject_cluster_id=subject_cluster_id,
        subject_id=subject_id,
        routing_type=routing_type,
        aging_bucket=aging_bucket,
    )
    return ApiResponse(
        success=True,
        message="Dean executive grievance ledger retrieved successfully.",
        data=ledger_data.model_dump(),
    )


# ==============================================================================
# PHASE 6D: APPLICANT FEEDBACK, MANAGER CLOSURE, E-FILE, & STUDENT MASTER RECORD
# ==============================================================================

# ---------------------------------------------------------------------------
# 1. Applicant Feedback
# ---------------------------------------------------------------------------

@router.post("/grievances/{grievance_id}/feedback", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def submit_grievance_feedback_api(
    grievance_id: str,
    feedback_payload: GrievanceFeedbackCreate,
    current_user: User = Depends(require_atharva_applicant),
    db: Session = Depends(get_db),
):
    """
    Applicant submits mandatory 1-5 ratings for Quality, Timeliness, Fairness.
    Case becomes queued for Manager Final Closure review.
    """
    feedback = GrievanceFeedbackService.submit_feedback(
        db=db,
        grievance_id_or_ref=grievance_id,
        feedback_data=feedback_payload,
        current_user=current_user,
    )
    return ApiResponse(
        success=True,
        message="Resolution feedback submitted successfully. The grievance is now queued for Manager final closure.",
        data=GrievanceFeedbackResponse.model_validate(feedback).model_dump(),
    )


@router.get("/grievances/{grievance_id}/feedback", response_model=ApiResponse)
def get_grievance_feedback_api(
    grievance_id: str,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves submitted feedback for a grievance.
    """
    feedback = GrievanceFeedbackService.get_feedback(
        db=db,
        grievance_id_or_ref=grievance_id,
        current_user=current_user,
    )
    return ApiResponse(
        success=True,
        message="Grievance feedback retrieved successfully.",
        data=GrievanceFeedbackResponse.model_validate(feedback).model_dump(),
    )


@router.get("/public/feedback-summary", response_model=ApiResponse)
def get_public_feedback_summary_api(
    db: Session = Depends(get_db),
):
    """
    Public aggregate feedback statistics with zero PII.
    """
    summary = GrievanceFeedbackService.get_public_summary(db)
    return ApiResponse(
        success=True,
        message="Public satisfaction summary retrieved successfully.",
        data=summary,
    )


# ---------------------------------------------------------------------------
# 2. Manager Final Closure Queue & Ratification
# ---------------------------------------------------------------------------

@router.get("/manager/closure-queue", response_model=ApiResponse)
def get_manager_closure_queue_api(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(15, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Returns cases in RESOLVED status that have submitted applicant feedback,
    ready for Manager Final Closure.
    """
    items, total = ManagerClosureService.get_closure_queue(db=db, page=page, page_size=page_size)
    return ApiResponse(
        success=True,
        message="Manager closure review queue retrieved successfully.",
        data=ClosureQueueResponse(items=items, total=total, page=page, page_size=page_size).model_dump(),
    )


@router.get("/manager/grievances/{grievance_id}/closure-detail", response_model=ApiResponse)
def get_manager_closure_detail_api(
    grievance_id: str,
    current_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Returns complete authoritative case context for Manager closure inspection.
    """
    detail = ManagerClosureService.get_closure_detail(db=db, grievance_id_or_ref=grievance_id)
    return ApiResponse(
        success=True,
        message="Case closure dossier retrieved successfully.",
        data=detail,
    )


@router.post("/manager/grievances/{grievance_id}/finalize-closure", response_model=ApiResponse)
def finalize_grievance_closure_api(
    grievance_id: str,
    payload: FinalizeClosureRequest = FinalizeClosureRequest(),
    current_user: User = Depends(require_atharva_manager),
    db: Session = Depends(get_db),
):
    """
    Atomically closes grievance under row lock, compiles and seals E-File,
    and updates/links Student Master Record.
    """
    authority = get_current_nivaran_authority(current_user, db)
    if not authority or authority.role != NivaranRole.MANAGER:
        raise HTTPException(status_code=403, detail="Manager authority profile required")

    result = ManagerClosureService.finalize_closure(
        db=db,
        grievance_id_or_ref=grievance_id,
        closure_notes=payload.closure_notes,
        manager_authority=authority,
    )
    return ApiResponse(
        success=True,
        message="Grievance formally closed, sealed E-File generated, and Student Master Record linked.",
        data=result,
    )


# ---------------------------------------------------------------------------
# 3. Digital E-Files
# ---------------------------------------------------------------------------

@router.get("/e-files/my", response_model=ApiResponse)
def get_my_efiles_api(
    current_user: User = Depends(require_atharva_applicant),
    db: Session = Depends(get_db),
):
    """
    Returns all sealed E-Files belonging to the current applicant.
    """
    efiles = EFileService.get_my_efiles(db=db, current_user=current_user)
    return ApiResponse(
        success=True,
        message="Applicant E-Files retrieved successfully.",
        data=efiles,
    )


@router.get("/e-files", response_model=ApiResponse)
def list_efiles_api(
    search: Optional[str] = Query(None, description="Search by E-File number, tracking ID, title, or student info"),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves institutional E-Files for authorized authorities within their jurisdiction.
    """
    authority = get_current_nivaran_authority(current_user, db)
    if not authority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized institutional authorities",
        )
    items, total = EFileService.list_efiles(
        db=db,
        current_authority=authority,
        search=search,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(
        success=True,
        message="Institutional E-Files retrieved successfully.",
        data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if page_size > 0 else 1,
        },
    )


@router.get("/e-files/{efile_id}", response_model=ApiResponse)
def get_efile_detail_api(
    efile_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves E-File detail and document references with strict IDOR enforcement.
    """
    authority = get_current_nivaran_authority(current_user, db)
    detail = EFileService.get_efile_detail(
        db=db,
        efile_id=efile_id,
        current_user=current_user,
        current_authority=authority,
    )
    return ApiResponse(
        success=True,
        message="E-File details retrieved successfully.",
        data=detail,
    )


@router.get("/e-files/{efile_id}/download")
def download_efile_pdf_api(
    efile_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Downloads physical sealed E-File PDF dossier.
    """
    authority = get_current_nivaran_authority(current_user, db)
    pdf_path = EFileService.get_efile_pdf_path(
        db=db,
        efile_id=efile_id,
        current_user=current_user,
        current_authority=authority,
    )
    filename = Path(pdf_path).name
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=filename,
    )


@router.get("/e-files/{efile_id}/verify", response_model=ApiResponse)
def verify_efile_integrity_api(
    efile_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Cryptographically verifies SHA-256 seal against physical PDF storage.
    """
    verification = EFileService.verify_efile_integrity(db=db, efile_id=efile_id)
    return ApiResponse(
        success=True,
        message="E-File integrity verification completed.",
        data=verification,
    )


# ---------------------------------------------------------------------------
# 4. Student Master Records
# ---------------------------------------------------------------------------

@router.get("/student-records/me", response_model=ApiResponse)
def get_my_student_record_api(
    current_user: User = Depends(require_atharva_applicant),
    db: Session = Depends(get_db),
):
    """
    Retrieves authenticated scholar's Master Digital E-Record with grievance & e-file history.
    """
    record = StudentMasterRecordService.get_my_record(db=db, current_user=current_user)
    return ApiResponse(
        success=True,
        message="Scholar Master Record retrieved successfully.",
        data=record,
    )


@router.get("/student-records/search", response_model=ApiResponse)
def search_student_records_api(
    query: Optional[str] = Query(None, description="Search term for name, registration, email, or record number"),
    registration_number: Optional[str] = Query(None, description="Exact registration number filter"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(15, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Search Student Master Records across the institution.
    Filtered by authority jurisdiction (Manager/Dean: institution-wide; Assistant Dean: cluster subjects).
    """
    authority = get_current_nivaran_authority(current_user, db)
    if not authority or authority.role not in (
        NivaranRole.MANAGER,
        NivaranRole.DEAN,
        NivaranRole.ASSISTANT_DEAN,
        NivaranRole.ASSOCIATE_DEAN,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to authorized institutional authorities.",
        )

    items, total = StudentMasterRecordService.search_records(
        db=db,
        current_authority=authority,
        query_str=query,
        registration_number=registration_number,
        page=page,
        page_size=page_size,
    )
    return ApiResponse(
        success=True,
        message="Student Master Records directory search retrieved successfully.",
        data=PaginatedStudentRecordsResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        ).model_dump(),
    )


@router.get("/student-records/{record_id}", response_model=ApiResponse)
def get_student_record_detail_api(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves detailed Student Master Record with IDOR protection.
    """
    authority = get_current_nivaran_authority(current_user, db)
    detail = StudentMasterRecordService.get_record_detail(
        db=db,
        record_id=record_id,
        current_user=current_user,
        current_authority=authority,
    )
    return ApiResponse(
        success=True,
        message="Student Master Record detail retrieved successfully.",
        data=detail,
    )


@router.get("/student-records/{record_id}/grievances", response_model=ApiResponse)
def get_student_record_grievances_api(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    authority = get_current_nivaran_authority(current_user, db)
    detail = StudentMasterRecordService.get_record_detail(
        db=db,
        record_id=record_id,
        current_user=current_user,
        current_authority=authority,
    )
    return ApiResponse(
        success=True,
        message="Student grievances retrieved successfully.",
        data=detail.get("grievances", []),
    )


@router.get("/student-records/{record_id}/efiles", response_model=ApiResponse)
def get_student_record_efiles_api(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_atharva_user),
    db: Session = Depends(get_db),
):
    authority = get_current_nivaran_authority(current_user, db)
    detail = StudentMasterRecordService.get_record_detail(
        db=db,
        record_id=record_id,
        current_user=current_user,
        current_authority=authority,
    )
    return ApiResponse(
        success=True,
        message="Student E-Files retrieved successfully.",
        data=detail.get("efiles", []),
    )



