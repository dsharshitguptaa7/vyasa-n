"""
Yajur Veda Module Router
Exposes status endpoints and the ANUDAAN Research Publication Incentive Management System (ANUDAAN V1.1).
"""
import uuid
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.registry import get_module_by_key
from app.schemas.response import ApiResponse
from app.modules.phd_rag.rate_limiter import InMemorySlidingWindowRateLimiter, resolve_client_ip

from app.modules.yajur_veda.models.anudaan import (
    AnudaanApplication,
    AnudaanPublication,
    AnudaanPublicationAuthor,
    AnudaanDocument,
    AnudaanDeclaration,
    AnudaanBankAccount,
)
from app.modules.yajur_veda.models.enums import AnudaanDocumentCategory
from app.modules.yajur_veda.schemas.anudaan import (
    AnudaanApplicationCreateDraft,
    AnudaanApplicationUpdateDraft,
    AnudaanApplicationSubmitRequest,
    AnudaanDraftCreationResponse,
    AnudaanApplicationDetailOut,
    AnudaanPublicationCreate,
    AnudaanPublicationUpdate,
    AnudaanPublicationOut,
    AnudaanAuthorCreate,
    AnudaanAuthorOut,
    AnudaanDocumentOut,
    AnudaanDeclarationOut,
    AnudaanSafeBankAccountOut,
    AnudaanTrackingRequest,
    AnudaanTrackingStatusResponse,
)
from app.modules.yajur_veda.services.anudaan_service import AnudaanService

router = APIRouter(prefix="/modules/yajur-veda", tags=["Yajur Veda: Research Administration & Incentives"])

# Rate limiter singleton for public tracking endpoint (10 requests per 60s per IP)
anudaan_tracking_rate_limiter = InMemorySlidingWindowRateLimiter()


# =============================================================================
# Helper Resolvers & Serializers
# =============================================================================

def get_draft_key(
    x_anudaan_draft_key: Optional[str] = Header(None, alias="X-Anudaan-Draft-Key"),
    draft_key: Optional[str] = Query(None, alias="draft_key"),
) -> Optional[str]:
    """Extracts draft authentication key from custom header or query string."""
    return x_anudaan_draft_key or draft_key


def _to_bank_out(bank: Optional[AnudaanBankAccount]) -> Optional[AnudaanSafeBankAccountOut]:
    if not bank:
        return None
    return AnudaanSafeBankAccountOut(
        id=bank.id,
        account_holder_name=bank.account_holder_name,
        bank_name=bank.bank_name,
        account_number_last4=bank.account_number_last4,
        masked_account_number=f"••••••••{bank.account_number_last4}",
        ifsc_code=bank.ifsc_code,
        branch_name=bank.branch_name,
        account_type=bank.account_type,
        proof_document_storage_key=bank.proof_document_storage_key,
        created_at=bank.created_at,
    )


def _to_author_out(author: AnudaanPublicationAuthor) -> AnudaanAuthorOut:
    person = author.person
    return AnudaanAuthorOut(
        id=author.id,
        publication_id=author.publication_id,
        person_id=author.person_id,
        full_name=person.full_name if person else "",
        scopus_author_id=person.scopus_author_id if person else None,
        scopus_profile_url=person.scopus_profile_url if person else None,
        employee_or_registration_id=person.employee_or_registration_id if person else None,
        mobile_number=person.mobile_number if person else None,
        author_role=author.author_role,
        author_order=author.author_order,
        is_csjmu_affiliated=bool(author.is_csjmu_affiliated) if author.is_csjmu_affiliated is not None else True,
        has_multiple_corresponding_authors=bool(author.has_multiple_corresponding_authors) if author.has_multiple_corresponding_authors is not None else False,
        is_nominated_corresponding_author=bool(author.is_nominated_corresponding_author) if author.is_nominated_corresponding_author is not None else False,
        bank_reuse_selected=bool(author.bank_reuse_selected) if author.bank_reuse_selected is not None else False,
        bank_account=_to_bank_out(author.bank_account),
        created_at=author.created_at,
    )


def _to_document_out(doc: AnudaanDocument) -> AnudaanDocumentOut:
    return AnudaanDocumentOut(
        id=doc.id,
        application_id=doc.application_id,
        publication_id=doc.publication_id,
        person_id=doc.person_id,
        document_type=doc.document_type,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size_bytes=doc.file_size_bytes,
        created_at=doc.created_at,
    )


def _to_declaration_out(decl: AnudaanDeclaration) -> AnudaanDeclarationOut:
    return AnudaanDeclarationOut(
        id=decl.id,
        declaration_type=decl.declaration_type,
        accepted=decl.accepted,
        accepted_at=decl.accepted_at,
        accepted_by_identifier=decl.accepted_by_identifier,
        declaration_version=decl.declaration_version,
        declaration_text_snapshot=decl.declaration_text_snapshot,
    )


def _to_publication_out(pub: AnudaanPublication) -> AnudaanPublicationOut:
    authors_out = [_to_author_out(a) for a in (pub.authors or [])]
    docs_out = [_to_document_out(d) for d in (pub.documents or [])]
    return AnudaanPublicationOut(
        id=pub.id,
        application_id=pub.application_id,
        publication_date=pub.publication_date,
        document_type=pub.document_type,
        publication_status=pub.publication_status,
        indexing_type=pub.indexing_type,
        has_csjmu_affiliation=pub.has_csjmu_affiliation,
        doi=pub.doi,
        normalized_doi=pub.normalized_doi,
        paper_title=pub.paper_title,
        journal_name=pub.journal_name,
        issn=pub.issn,
        e_issn=pub.e_issn,
        publication_year=pub.publication_year,
        volume=pub.volume,
        issue=pub.issue,
        page_details=pub.page_details,
        applicant_declared_quartile=pub.applicant_declared_quartile,
        verified_quartile=pub.verified_quartile,
        jci_value=pub.jci_value,
        paper_document_storage_key=pub.paper_document_storage_key,
        authors=authors_out,
        documents=docs_out,
        created_at=pub.created_at,
    )


def _to_application_out(app: AnudaanApplication) -> AnudaanApplicationDetailOut:
    safe_metadata = dict(app.form_metadata or {})
    safe_metadata.pop("tracking_secret_hash", None)
    pubs_out = [_to_publication_out(p) for p in (app.publications or [])]
    docs_out = [_to_document_out(d) for d in (app.documents or [])]
    decls_out = [_to_declaration_out(d) for d in (app.declarations or [])]
    return AnudaanApplicationDetailOut(
        id=app.id,
        application_number=app.application_number,
        applicant_category=app.applicant_category,
        full_name=app.full_name,
        institutional_id=app.institutional_id,
        designation=app.designation,
        department_name=app.department_name,
        supervisor_name=app.supervisor_name,
        mobile_number=app.mobile_number,
        scopus_author_id=app.scopus_author_id,
        scopus_profile_url=app.scopus_profile_url,
        status=app.status,
        form_metadata=safe_metadata,
        submitted_at=app.submitted_at,
        publications=pubs_out,
        documents=docs_out,
        declarations=decls_out,
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


# =============================================================================
# Architectural Status
# =============================================================================

@router.get("/status", response_model=ApiResponse)
def get_yajur_veda_status():
    """
    Architectural boundary status endpoint for Yajur Veda.
    Indicates status of the Research Administration & Incentives pillar and ANUDAAN sub-system.
    """
    module = get_module_by_key("yajur_veda")
    data = module.model_dump() if module else {"status": "active"}
    data["submodules"] = {
        "anudaan": {
            "name": "ANUDAAN Research Publication Incentive Management System",
            "version": "1.1",
            "status": "active",
        }
    }
    return ApiResponse(
        success=True,
        message="Yajur Veda active: ANUDAAN Research Incentive System operational.",
        data=data,
    )


# =============================================================================
# ANUDAAN: Application Draft Lifecycle
# =============================================================================

@router.post(
    "/anudaan/applications",
    response_model=ApiResponse[AnudaanDraftCreationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create Draft Application",
)
def create_draft_application(
    payload: AnudaanApplicationCreateDraft,
    db: Session = Depends(get_db),
):
    """
    Public entry point to create an ANUDAAN research incentive application draft.
    Generates unique application number and tracking secret.
    """
    app, secret = AnudaanService.create_draft_application(db=db, data=payload)
    response_data = AnudaanDraftCreationResponse(
        application_id=app.id,
        application_number=app.application_number,
        tracking_secret=secret,
        status=app.status,
        applicant_category=app.applicant_category,
        full_name=app.full_name,
        institutional_id=app.institutional_id,
        department_name=app.department_name,
        created_at=app.created_at,
    )
    return ApiResponse(
        success=True,
        message="Draft application created successfully. Retain your Application Number and Tracking Secret.",
        data=response_data,
    )


@router.get(
    "/anudaan/applications/{application_id}",
    response_model=ApiResponse[AnudaanApplicationDetailOut],
    summary="Get Draft Application Details",
)
def get_draft_application(
    application_id: uuid.UUID,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Retrieves full details of an application draft.
    Requires header 'X-Anudaan-Draft-Key' matching the tracking secret.
    """
    app = AnudaanService.verify_draft_access(db, application_id, draft_key)
    # Refresh to ensure relationships are loaded
    app = AnudaanService.get_application_or_404(db, application_id)
    return ApiResponse(
        success=True,
        data=_to_application_out(app),
    )


@router.patch(
    "/anudaan/applications/{application_id}",
    response_model=ApiResponse[AnudaanApplicationDetailOut],
    summary="Update Draft Applicant Profile",
)
def update_draft_application(
    application_id: uuid.UUID,
    payload: AnudaanApplicationUpdateDraft,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Updates profile and metadata on an application draft.
    """
    app = AnudaanService.update_draft_application(
        db=db,
        application_id=application_id,
        data=payload,
        draft_key=draft_key,
    )
    app = AnudaanService.get_application_or_404(db, application_id)
    return ApiResponse(
        success=True,
        message="Application draft updated successfully.",
        data=_to_application_out(app),
    )


# =============================================================================
# ANUDAAN: Publication Management
# =============================================================================

@router.post(
    "/anudaan/applications/{application_id}/publications",
    response_model=ApiResponse[AnudaanPublicationOut],
    status_code=status.HTTP_201_CREATED,
    summary="Add Publication to Draft Application",
)
def add_publication(
    application_id: uuid.UUID,
    payload: AnudaanPublicationCreate,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Adds a research publication to a draft application.
    Validates publication date (>= 2026-01-01), document type, and checks for duplicate active DOIs.
    """
    pub = AnudaanService.add_publication(
        db=db,
        application_id=application_id,
        data=payload,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        message="Publication added successfully.",
        data=_to_publication_out(pub),
    )


@router.patch(
    "/anudaan/publications/{publication_id}",
    response_model=ApiResponse[AnudaanPublicationOut],
    summary="Update Publication Details",
)
def update_publication(
    publication_id: uuid.UUID,
    payload: AnudaanPublicationUpdate,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """Updates metadata of a draft publication."""
    pub = AnudaanService.update_publication(
        db=db,
        publication_id=publication_id,
        data=payload,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        message="Publication updated successfully.",
        data=_to_publication_out(pub),
    )


@router.delete(
    "/anudaan/publications/{publication_id}",
    response_model=ApiResponse,
    summary="Delete Publication from Draft",
)
def delete_publication(
    publication_id: uuid.UUID,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """Deletes a publication from a draft application."""
    AnudaanService.delete_publication(
        db=db,
        publication_id=publication_id,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        message="Publication removed successfully.",
    )


# =============================================================================
# ANUDAAN: Author & Bank Details Management
# =============================================================================

@router.post(
    "/anudaan/publications/{publication_id}/authors",
    response_model=ApiResponse[AnudaanAuthorOut],
    status_code=status.HTTP_201_CREATED,
    summary="Add Author Attribution",
)
def add_author_to_publication(
    publication_id: uuid.UUID,
    payload: AnudaanAuthorCreate,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Attaches an author to a publication. Enforces:
    - Maximum 1 First Author.
    - Maximum 1 Nominated Corresponding Author.
    - Co-authors cannot designate banking details.
    - Sensitive banking info is encrypted at rest using AES Fernet.
    """
    author = AnudaanService.add_author_to_publication(
        db=db,
        publication_id=publication_id,
        data=payload,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        message="Author attribution added successfully.",
        data=_to_author_out(author),
    )


@router.delete(
    "/anudaan/authors/{author_id}",
    response_model=ApiResponse,
    summary="Delete Author Attribution",
)
def delete_author(
    author_id: uuid.UUID,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """Removes an author attribution from a publication in draft."""
    AnudaanService.delete_author(
        db=db,
        author_id=author_id,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        message="Author attribution removed successfully.",
    )


# =============================================================================
# ANUDAAN: Document Upload & Deletion
# =============================================================================

@router.post(
    "/anudaan/applications/{application_id}/documents",
    response_model=ApiResponse[AnudaanDocumentOut],
    status_code=status.HTTP_201_CREATED,
    summary="Upload Supporting Document",
)
async def upload_document(
    application_id: uuid.UUID,
    file: UploadFile = File(...),
    document_type: AnudaanDocumentCategory = Form(...),
    publication_id: Optional[uuid.UUID] = Form(None),
    person_id: Optional[uuid.UUID] = Form(None),
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Uploads supporting PDF, PNG, or JPEG file (max 10MB).
    Stores via storage proxy and attaches metadata record.
    """
    doc = await AnudaanService.upload_document(
        db=db,
        application_id=application_id,
        file=file,
        document_type=document_type,
        draft_key=draft_key,
        publication_id=publication_id,
        person_id=person_id,
    )
    return ApiResponse(
        success=True,
        message="Document uploaded successfully.",
        data=_to_document_out(doc),
    )


@router.delete(
    "/anudaan/documents/{document_id}",
    response_model=ApiResponse,
    summary="Delete Uploaded Document",
)
def delete_document(
    document_id: uuid.UUID,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """Deletes uploaded document and purges file from storage provider."""
    AnudaanService.delete_document(
        db=db,
        document_id=document_id,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        message="Document deleted successfully.",
    )


# =============================================================================
# ANUDAAN: Final Submission & Declarations
# =============================================================================

@router.post(
    "/anudaan/applications/{application_id}/submit",
    response_model=ApiResponse[AnudaanApplicationDetailOut],
    summary="Final Application Submission",
)
def submit_application(
    application_id: uuid.UUID,
    payload: AnudaanApplicationSubmitRequest,
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Executes atomic final submission:
    - Validates mandatory first author and nominated corresponding author.
    - Validates designated banking details.
    - Validates paper manuscript PDF attachment.
    - Validates statutory declarations (AUTHENTICITY, AFFILIATION, NON_DUPLICATION).
    - Locks application status to SUBMITTED.
    - Dispatches confirmation email.
    """
    app = AnudaanService.submit_application(
        db=db,
        application_id=application_id,
        declarations=payload.declarations,
        draft_key=draft_key,
    )
    # Refresh to guarantee fresh relations
    app = AnudaanService.get_application_or_404(db, application_id)
    return ApiResponse(
        success=True,
        message="Application submitted successfully. Your submission has been forwarded to the Dean's review queue.",
        data=_to_application_out(app),
    )


# =============================================================================
# ANUDAAN: Application Tracking
# =============================================================================

@router.post(
    "/anudaan/track",
    response_model=ApiResponse[AnudaanTrackingStatusResponse],
    summary="Track Application Status",
)
def track_application(
    payload: AnudaanTrackingRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public tracking endpoint.
    Accepts application number and tracking secret to retrieve real-time status.
    Protected by IP-based sliding-window rate limiter (10 requests/min).
    Strictly excludes sensitive banking and personal credentials.
    """
    client_ip = resolve_client_ip(request)
    allowed, retry_after = anudaan_tracking_rate_limiter.is_allowed(
        key=f"anudaan_track:{client_ip}",
        limit=10,
        window=60,
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    tracking_data = AnudaanService.track_application(
        db=db,
        application_number=payload.application_number,
        tracking_secret=payload.tracking_secret,
    )
    return ApiResponse(
        success=True,
        data=tracking_data,
    )


# =============================================================================
# ANUDAAN: Bank Account Reusability
# =============================================================================

@router.get(
    "/anudaan/applications/{application_id}/people/{person_id}/verified-bank-accounts",
    response_model=ApiResponse[List[AnudaanSafeBankAccountOut]],
    summary="Get Verified Bank Accounts for Researcher (Application Context)",
)
@router.get(
    "/anudaan/people/{person_id}/verified-bank-accounts",
    response_model=ApiResponse[List[AnudaanSafeBankAccountOut]],
    summary="Get Verified Bank Accounts for Researcher",
)
def get_verified_bank_accounts(
    person_id: uuid.UUID,
    application_id: Optional[uuid.UUID] = None,
    x_anudaan_application_id: Optional[uuid.UUID] = Header(None, alias="X-Anudaan-Application-Id"),
    app_id_query: Optional[uuid.UUID] = Query(None, alias="application_id"),
    draft_key: Optional[str] = Depends(get_draft_key),
    db: Session = Depends(get_db),
):
    """
    Retrieves previously verified bank accounts linked to an identified researcher.
    Requires draft authentication and verifies that the researcher belongs to the specified application (SEC-01).
    """
    target_app_id = application_id or x_anudaan_application_id or app_id_query
    if not target_app_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application ID is required via path, header ('X-Anudaan-Application-Id'), or query parameter.",
        )

    accounts = AnudaanService.get_verified_bank_accounts_for_person(
        db=db,
        application_id=target_app_id,
        person_id=person_id,
        draft_key=draft_key,
    )
    return ApiResponse(
        success=True,
        data=accounts,
    )


# =============================================================================
# ANUDAAN: Public Showcase, Impact Dashboard & Recognition Gallery
# =============================================================================

from fastapi.responses import FileResponse
from app.core.storage import storage_service
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service
from app.modules.yajur_veda.models.showcase import AnudaanGalleryImage
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanPublicImpactStats,
    AnudaanGalleryListResponse,
    AnudaanGalleryItemOut,
    AnudaanPublicConfigOut,
    AnudaanPublicSanctionOut,
    AnudaanPublicSanctionsResponse,
)


@router.get(
    "/anudaan/public/impact",
    response_model=ApiResponse[AnudaanPublicImpactStats],
    summary="Get Public Institutional Incentive Impact Statistics",
)
def get_public_impact_statistics(
    academic_year: Optional[str] = Query(None, description="Academic year filter (e.g. '2025-2026' or 'ALL')"),
    db: Session = Depends(get_db),
):
    """
    Returns aggregated public institutional incentive impact statistics.
    Checks public configuration to ensure impact section is enabled.
    Returns safe aggregate totals without exposing researcher PII.
    """
    cfg = anudaan_showcase_service.get_public_config(db)
    effective_year = academic_year or cfg.active_academic_year or "ALL"
    stats = anudaan_showcase_service.get_public_impact_stats(db, academic_year=effective_year)
    return ApiResponse(
        success=True,
        message="Public incentive impact statistics retrieved successfully.",
        data=stats,
    )


@router.get(
    "/anudaan/public/sanctions",
    response_model=ApiResponse[AnudaanPublicSanctionsResponse],
    summary="Get Public Institutional Incentive Sanction Register",
)
def get_public_sanction_register(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    academic_year: Optional[str] = Query(None),
    quartile: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Retrieves published institutional incentive sanction records.
    Strictly excludes sensitive identity, registration, employee, or financial details.
    """
    items, total = anudaan_showcase_service.get_public_sanction_entries(
        db, skip=skip, limit=limit, academic_year=academic_year, quartile=quartile, search=search
    )
    return ApiResponse(
        success=True,
        message="Public incentive sanction register retrieved.",
        data=AnudaanPublicSanctionsResponse(
            total=total,
            items=[
                AnudaanPublicSanctionOut(
                    id=item.id,
                    researcher_name=item.researcher_name,
                    department_name=item.department_name,
                    publication_title=item.publication_title,
                    quartile=item.quartile,
                    sanctioned_amount=item.sanctioned_amount,
                    academic_year=item.academic_year,
                )
                for item in items
            ],
        ),
    )


@router.get(
    "/anudaan/public/gallery",
    response_model=ApiResponse[AnudaanGalleryListResponse],
    summary="Get Public Researcher Recognition & Distribution Gallery",
)
def get_public_recognition_gallery(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Retrieves published ceremony and researcher recognition items with researcher consent.
    Respects public configuration and orders featured items prominently.
    """
    total, items = anudaan_showcase_service.list_public_gallery_items(
        db, skip=skip, limit=limit, academic_year=academic_year
    )
    return ApiResponse(
        success=True,
        message="Public researcher recognition gallery retrieved successfully.",
        data=AnudaanGalleryListResponse(
            total=total,
            items=[AnudaanGalleryItemOut.model_validate(item) for item in items],
        ),
    )


@router.get(
    "/anudaan/public/config",
    response_model=ApiResponse[AnudaanPublicConfigOut],
    summary="Get Public ANUDAAN Showcase Display Configuration",
)
def get_public_showcase_configuration(
    db: Session = Depends(get_db),
):
    """
    Returns public display visibility flags for Impact Dashboard and Recognition Gallery.
    """
    cfg = anudaan_showcase_service.get_public_config(db)
    return ApiResponse(
        success=True,
        message="Public showcase display configuration retrieved.",
        data=AnudaanPublicConfigOut.model_validate(cfg),
    )


@router.get(
    "/anudaan/public/gallery/images/{image_id}/file",
    summary="Stream Public Recognition Gallery Photograph Asset",
)
def stream_gallery_image(
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Streams public gallery photograph file asset with caching and verified content-type.
    """
    img = db.get(AnudaanGalleryImage, image_id)
    if not img or not img.gallery_item.is_published:
        raise HTTPException(status_code=404, detail="Photograph asset not found or not published.")

    try:
        file_path = storage_service.get_file_path(img.storage_key)
        return FileResponse(
            path=str(file_path),
            media_type=img.mime_type,
            headers={
                "Cache-Control": "public, max-age=86400, immutable",
                "Content-Disposition": f'inline; filename="{img.original_filename}"',
            },
        )
    except Exception as e:
        logger.error(f"Failed to stream gallery image {image_id}: {e}")
        raise HTTPException(status_code=404, detail="Photograph storage asset could not be accessed.")

