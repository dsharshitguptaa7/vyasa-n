"""
ANUDAAN (Yajur Veda) Super Admin Router
Provides administrative APIs for:
1. Institutional Incentive Impact Analytics
2. Controlled Financial Disbursement Ledger (Recording, Verifying, Reversing)
3. Researcher Recognition Gallery CMS (CRUD, Photo Uploads, Cover Selection)
4. Public Showcase Display Configuration
"""
import uuid
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.logging import logger
from app.api.dependencies import get_db, require_permission, require_super_admin_user
from app.models.user import User
from app.schemas.response import ApiResponse
from app.services.audit_service import audit_service
from app.core.storage import (
    storage_service,
    StorageError,
    StorageFileNotFoundError,
    StorageInvalidFileTypeError,
    StorageSizeLimitError,
)
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanPublicImpactStats,
    AnudaanDisbursementCreate,
    AnudaanDisbursementVerifyRequest,
    AnudaanDisbursementReverseRequest,
    AnudaanDisbursementOut,
    AnudaanDisbursementListResponse,
    AnudaanGalleryItemCreate,
    AnudaanGalleryItemUpdate,
    AnudaanGalleryItemOut,
    AnudaanGalleryListResponse,
    AnudaanGalleryImageOut,
    AnudaanPublicConfigOut,
    AnudaanPublicConfigUpdate,
    AnudaanSanctionEntryCreate,
    AnudaanSanctionEntryUpdate,
    AnudaanSanctionEntryOut,
    AnudaanSanctionListResponse,
    AnudaanApplicationLookupItem,
)

anudaan_admin_router = APIRouter(prefix="/anudaan", tags=["ANUDAAN Administration & Showcase CMS"])


def _to_sanction_out(entry) -> AnudaanSanctionEntryOut:
    app_num = None
    if getattr(entry, "application", None):
        app_num = entry.application.application_number
    return AnudaanSanctionEntryOut(
        id=entry.id,
        researcher_name=entry.researcher_name,
        department_name=entry.department_name,
        publication_title=entry.publication_title,
        publication_doi=entry.publication_doi,
        quartile=entry.quartile,
        sanctioned_amount=entry.sanctioned_amount,
        academic_year=entry.academic_year,
        sanction_date=entry.sanction_date,
        remarks=entry.remarks,
        is_published=entry.is_published,
        application_id=entry.application_id,
        application_number=app_num,
        author_id=entry.author_id,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _to_disb_out(disb) -> AnudaanDisbursementOut:
    app_num = "RECORDED"
    app_name = "APPLICANT"
    auth_name = None
    rec_email = None
    ver_email = None
    if getattr(disb, "application", None):
        app_num = disb.application.application_number
        app_name = disb.application.full_name
    if getattr(disb, "author", None) and getattr(disb.author, "person", None):
        auth_name = disb.author.person.full_name
    if getattr(disb, "recorded_by", None):
        rec_email = disb.recorded_by.email
    if getattr(disb, "verified_by", None):
        ver_email = disb.verified_by.email

    return AnudaanDisbursementOut(
        id=disb.id,
        application_id=disb.application_id,
        application_number=app_num,
        applicant_name=app_name,
        author_id=disb.author_id,
        author_name=auth_name,
        disbursement_reference=disb.disbursement_reference,
        amount=disb.amount,
        disbursement_date=disb.disbursement_date,
        academic_year=disb.academic_year,
        payment_method=disb.payment_method,
        verification_status=disb.verification_status,
        reversal_reason=disb.reversal_reason,
        notes=disb.notes,
        recorded_by_email=rec_email,
        verified_by_email=ver_email,
        verified_at=disb.verified_at,
        created_at=disb.created_at,
    )


# =============================================================================
# 1. Institutional Incentive Impact Dashboard
# =============================================================================

@anudaan_admin_router.get("/impact/stats", response_model=ApiResponse)
def get_admin_impact_stats(
    academic_year: Optional[str] = Query(None, description="Academic year filter (e.g. '2025-2026' or 'ALL')"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """
    Returns administrative institutional impact metrics and academic-year breakdowns.
    """
    stats = anudaan_showcase_service.get_public_impact_stats(db, academic_year=academic_year)
    return ApiResponse(
        success=True,
        message="Institutional incentive impact statistics retrieved.",
        data=stats.model_dump(),
    )


# =============================================================================
# 1.1 Simplified Sadmin Incentive Sanction Register
# =============================================================================

@anudaan_admin_router.get("/sanctions", response_model=ApiResponse)
def list_admin_sanctions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    academic_year: Optional[str] = Query(None),
    quartile: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Lists recorded incentive sanction entries with filtering and totals."""
    items, total, total_amount = anudaan_showcase_service.list_sanction_entries(
        db,
        skip=skip,
        limit=limit,
        academic_year=academic_year,
        quartile=quartile,
        department=department,
        is_published=is_published,
        search=search,
    )
    return ApiResponse(
        success=True,
        message="Incentive sanction entries retrieved successfully.",
        data=AnudaanSanctionListResponse(
            total=total,
            items=[_to_sanction_out(item) for item in items],
            total_sanctioned_inr=total_amount,
        ).model_dump(),
    )


@anudaan_admin_router.get("/sanctions/lookup", response_model=ApiResponse)
def lookup_applications_for_sanction(
    search: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Searches submitted applications and authors to assist Sadmin with identity linkage."""
    results = anudaan_showcase_service.lookup_applications_for_sanction(db, search=search, limit=limit)
    return ApiResponse(
        success=True,
        message="Application lookup results retrieved.",
        data=results,
    )


@anudaan_admin_router.post("/sanctions", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_sanction_entry(
    payload: AnudaanSanctionEntryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """Manually records an official university incentive sanction."""
    try:
        entry = anudaan_showcase_service.create_sanction_entry(
            db,
            payload=payload,
            created_by_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    audit_service.log_action(
        db=db,
        action="CREATE",
        entity_type="ANULAAN_SANCTION_ENTRY",
        entity_id=str(entry.id),
        actor_id=current_user.id,
        actor_email=current_user.email,
        details={
            "researcher_name": entry.researcher_name,
            "publication_title": entry.publication_title,
            "quartile": entry.quartile,
            "amount": str(entry.sanctioned_amount),
            "academic_year": entry.academic_year,
        },
        ip_address=request.client.host if request.client else None,
    )

    return ApiResponse(
        success=True,
        message="Incentive sanction entry recorded successfully.",
        data=_to_sanction_out(entry).model_dump(),
    )


@anudaan_admin_router.get("/sanctions/{sanction_id}", response_model=ApiResponse)
def get_sanction_entry(
    sanction_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Retrieves a single incentive sanction entry."""
    entry = anudaan_showcase_service.get_sanction_entry(db, sanction_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanction entry not found")
    return ApiResponse(
        success=True,
        message="Sanction entry retrieved.",
        data=_to_sanction_out(entry).model_dump(),
    )


@anudaan_admin_router.put("/sanctions/{sanction_id}", response_model=ApiResponse)
def update_sanction_entry(
    sanction_id: uuid.UUID,
    payload: AnudaanSanctionEntryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """Updates an existing incentive sanction entry."""
    try:
        entry = anudaan_showcase_service.update_sanction_entry(
            db,
            sanction_id=sanction_id,
            payload=payload,
            updated_by_id=current_user.id,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanction entry not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    audit_service.log_action(
        db=db,
        action="UPDATE",
        entity_type="ANULAAN_SANCTION_ENTRY",
        entity_id=str(entry.id),
        actor_id=current_user.id,
        actor_email=current_user.email,
        details={
            "researcher_name": entry.researcher_name,
            "publication_title": entry.publication_title,
            "amount": str(entry.sanctioned_amount),
        },
        ip_address=request.client.host if request.client else None,
    )

    return ApiResponse(
        success=True,
        message="Incentive sanction entry updated successfully.",
        data=_to_sanction_out(entry).model_dump(),
    )


@anudaan_admin_router.patch("/sanctions/{sanction_id}/publish", response_model=ApiResponse)
def toggle_sanction_publication(
    sanction_id: uuid.UUID,
    is_published: bool = Query(...),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """Publishes or unpublishes a sanction entry on the public portal."""
    try:
        entry = anudaan_showcase_service.toggle_sanction_publication(
            db,
            sanction_id=sanction_id,
            is_published=is_published,
            updated_by_id=current_user.id,
        )
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanction entry not found")

    return ApiResponse(
        success=True,
        message=f"Sanction entry {'published' if is_published else 'unpublished'} successfully.",
        data=_to_sanction_out(entry).model_dump(),
    )


@anudaan_admin_router.delete("/sanctions/{sanction_id}", response_model=ApiResponse)
def delete_sanction_entry(
    sanction_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """Deletes an incentive sanction entry with audit trail."""
    try:
        anudaan_showcase_service.delete_sanction_entry(db, sanction_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sanction entry not found")

    audit_service.log_action(
        db=db,
        action="DELETE",
        entity_type="ANULAAN_SANCTION_ENTRY",
        entity_id=str(sanction_id),
        actor_id=current_user.id,
        actor_email=current_user.email,
        details={"deleted_id": str(sanction_id)},
        ip_address=request.client.host if request.client else None,
    )

    return ApiResponse(
        success=True,
        message="Sanction entry deleted successfully.",
        data={"id": str(sanction_id)},
    )


# =============================================================================
# 2. Controlled Financial Disbursements Ledger
# =============================================================================

@anudaan_admin_router.get("/disbursements", response_model=ApiResponse)
def list_disbursements(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    academic_year: Optional[str] = Query(None),
    verification_status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Lists recorded incentive disbursements with reconciliation totals."""
    total, items, total_amount = anudaan_showcase_service.list_disbursements(
        db,
        skip=skip,
        limit=limit,
        academic_year=academic_year,
        verification_status=verification_status,
    )
    return ApiResponse(
        success=True,
        message="Incentive disbursements retrieved successfully.",
        data=AnudaanDisbursementListResponse(
            total=total,
            items=items,
            total_amount_inr=total_amount,
        ).model_dump(),
    )


@anudaan_admin_router.post("/disbursements", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def record_disbursement(
    payload: AnudaanDisbursementCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """
    Records a new incentive payout transaction against an application.
    Requires 'anudaan:finance:manage' or Super Admin role.
    """
    try:
        disb = anudaan_showcase_service.create_disbursement(db, payload, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="disbursement_recorded",
        entity_name="AnudaanDisbursement",
        entity_id=disb.id,
        actor_user_id=current_user.id,
        details={
            "application_id": str(disb.application_id),
            "reference": disb.disbursement_reference,
            "amount": str(disb.amount),
            "academic_year": disb.academic_year,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Incentive disbursement recorded successfully in RECORDED state.",
        data=_to_disb_out(disb).model_dump(),
    )


@anudaan_admin_router.put("/disbursements/{disbursement_id}/verify", response_model=ApiResponse)
def verify_disbursement(
    disbursement_id: uuid.UUID,
    payload: AnudaanDisbursementVerifyRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """
    Confirms verification of a disbursement transaction against official bank statements.
    Transitions status to 'VERIFIED' for public aggregate inclusion.
    """
    try:
        disb = anudaan_showcase_service.verify_disbursement(
            db, disbursement_id, user_id=current_user.id, notes=payload.notes
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="disbursement_verified",
        entity_name="AnudaanDisbursement",
        entity_id=disb.id,
        actor_user_id=current_user.id,
        details={"reference": disb.disbursement_reference, "amount": str(disb.amount)},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Disbursement transaction verified successfully.",
        data=_to_disb_out(disb).model_dump(),
    )


@anudaan_admin_router.post("/disbursements/{disbursement_id}/reverse", response_model=ApiResponse)
def reverse_disbursement(
    disbursement_id: uuid.UUID,
    payload: AnudaanDisbursementReverseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:finance:manage")),
):
    """
    Reverses an erroneous disbursement with mandatory audit justification.
    """
    try:
        disb = anudaan_showcase_service.reverse_disbursement(
            db, disbursement_id, reversal_reason=payload.reversal_reason, user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="disbursement_reversed",
        entity_name="AnudaanDisbursement",
        entity_id=disb.id,
        actor_user_id=current_user.id,
        details={"reversal_reason": payload.reversal_reason, "amount": str(disb.amount)},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Disbursement transaction reversed.",
        data=_to_disb_out(disb).model_dump(),
    )


# =============================================================================
# 3. Researcher Recognition Gallery CMS
# =============================================================================

@anudaan_admin_router.get("/gallery", response_model=ApiResponse)
def list_admin_gallery(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    academic_year: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Lists all gallery items for Sadmin management."""
    total, items = anudaan_showcase_service.list_admin_gallery_items(
        db, skip=skip, limit=limit, academic_year=academic_year, is_published=is_published
    )
    return ApiResponse(
        success=True,
        message="Gallery items retrieved successfully.",
        data=AnudaanGalleryListResponse(
            total=total,
            items=[AnudaanGalleryItemOut.model_validate(item) for item in items],
        ).model_dump(),
    )


@anudaan_admin_router.get("/gallery/{item_id}", response_model=ApiResponse)
def get_gallery_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Retrieves a single gallery item by UUID."""
    item = anudaan_showcase_service.get_gallery_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Gallery item not found.")
    return ApiResponse(
        success=True,
        message="Gallery item retrieved.",
        data=AnudaanGalleryItemOut.model_validate(item).model_dump(),
    )


@anudaan_admin_router.post("/gallery", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_gallery_item(
    payload: AnudaanGalleryItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:gallery:edit")),
):
    """Creates a new recognition gallery entry."""
    item = anudaan_showcase_service.create_gallery_item(db, payload, user_id=current_user.id)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="gallery_item_created",
        entity_name="AnudaanGalleryItem",
        entity_id=item.id,
        actor_user_id=current_user.id,
        details={"title": item.title, "event_name": item.event_name},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Gallery item created successfully.",
        data=AnudaanGalleryItemOut.model_validate(item).model_dump(),
    )


@anudaan_admin_router.put("/gallery/{item_id}", response_model=ApiResponse)
def update_gallery_item(
    item_id: uuid.UUID,
    payload: AnudaanGalleryItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:gallery:edit")),
):
    """Updates gallery item properties."""
    try:
        item = anudaan_showcase_service.update_gallery_item(db, item_id, payload, user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="gallery_item_updated",
        entity_name="AnudaanGalleryItem",
        entity_id=item.id,
        actor_user_id=current_user.id,
        details={"title": item.title},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Gallery item updated successfully.",
        data=AnudaanGalleryItemOut.model_validate(item).model_dump(),
    )


@anudaan_admin_router.delete("/gallery/{item_id}", response_model=ApiResponse)
def delete_gallery_item(
    item_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:gallery:edit")),
):
    """Deletes a gallery entry."""
    success = anudaan_showcase_service.delete_gallery_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="Gallery item not found.")

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="gallery_item_deleted",
        entity_name="AnudaanGalleryItem",
        entity_id=item_id,
        actor_user_id=current_user.id,
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Gallery item deleted successfully.",
        data={"deleted_id": str(item_id)},
    )


@anudaan_admin_router.post("/gallery/{item_id}/images", response_model=ApiResponse)
def upload_gallery_image(
    item_id: uuid.UUID,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    is_cover: bool = Form(False),
    display_order: int = Form(0),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:gallery:edit")),
):
    """
    Uploads a photograph for an existing gallery item.
    Enforces image MIME validation (JPEG, PNG, WEBP) and a 10MB file ceiling.
    """
    item = anudaan_showcase_service.get_gallery_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Gallery item not found.")

    allowed_mimes = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid image type '{file.content_type}'. Permitted types: {allowed_mimes}",
        )

    try:
        content = file.file.read()
        result = storage_service.save_file(
            file_data=content,
            filename=file.filename,
            subfolder="anudaan/gallery",
            allowed_mime_types=allowed_mimes,
            max_bytes=10485760,  # 10MB
        )
    except StorageInvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except StorageSizeLimitError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Gallery image upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save image file.")

    image = anudaan_showcase_service.add_gallery_image(
        db,
        item_id=item_id,
        storage_key=result.storage_path,
        filename=result.filename,
        mime_type=result.mime_type,
        file_size=result.file_size,
        caption=caption,
        is_cover=is_cover,
        display_order=display_order,
    )

    return ApiResponse(
        success=True,
        message="Gallery photograph uploaded successfully.",
        data=AnudaanGalleryImageOut.model_validate(image).model_dump(),
    )


@anudaan_admin_router.delete("/gallery/images/{image_id}", response_model=ApiResponse)
def remove_gallery_image(
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:gallery:edit")),
):
    """Removes a photograph from a gallery entry."""
    success = anudaan_showcase_service.remove_gallery_image(db, image_id)
    if not success:
        raise HTTPException(status_code=404, detail="Gallery photograph not found.")
    return ApiResponse(
        success=True,
        message="Gallery photograph removed successfully.",
        data={"deleted_image_id": str(image_id)},
    )


@anudaan_admin_router.put("/gallery/{item_id}/images/{image_id}/cover", response_model=ApiResponse)
def set_gallery_cover_image(
    item_id: uuid.UUID,
    image_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:gallery:edit")),
):
    """Sets the designated cover image for a gallery entry."""
    success = anudaan_showcase_service.set_cover_image(db, item_id, image_id)
    if not success:
        raise HTTPException(status_code=404, detail="Gallery item or image not found.")
    return ApiResponse(
        success=True,
        message="Cover photograph updated successfully.",
        data={"cover_image_id": str(image_id)},
    )


# =============================================================================
# 4. Public Display Configuration
# =============================================================================

@anudaan_admin_router.get("/config", response_model=ApiResponse)
def get_public_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:read")),
):
    """Retrieves showcase display configuration."""
    cfg = anudaan_showcase_service.get_public_config(db)
    return ApiResponse(
        success=True,
        message="Showcase display configuration retrieved.",
        data=AnudaanPublicConfigOut.model_validate(cfg).model_dump(),
    )


@anudaan_admin_router.put("/config", response_model=ApiResponse)
def update_public_config(
    payload: AnudaanPublicConfigUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("anudaan:config:manage")),
):
    """Updates showcase display configuration."""
    cfg = anudaan_showcase_service.update_public_config(db, payload, user_id=current_user.id)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="yajur_veda",
        action="public_config_updated",
        entity_name="AnudaanPublicConfig",
        entity_id=cfg.id,
        actor_user_id=current_user.id,
        details={
            "impact_enabled": cfg.impact_section_enabled,
            "gallery_enabled": cfg.gallery_section_enabled,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Showcase display configuration updated successfully.",
        data=AnudaanPublicConfigOut.model_validate(cfg).model_dump(),
    )
