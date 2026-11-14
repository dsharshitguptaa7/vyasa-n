import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc
from sqlalchemy.exc import OperationalError, DBAPIError

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
from app.modules.sama_veda.services.cms_service import sama_cms_service
from app.modules.sama_veda.services.certificate_download_service import validate_and_stream_certificate_pdf
from app.modules.sama_veda.services.import_service import import_service
from app.modules.sama_veda.models import SamaImportBatch
from app.modules.sama_veda.schemas.import_schemas import HistoricalBundleImportRequest
from app.modules.sama_veda.models.publication import ResearchPublication
from app.admin.schemas.sama_cms import (
    PublicationCreate,
    PublicationUpdate,
    PublicationStatusUpdate,
    PublicationOut,
    PublicationAuthorOut,
    PublicationListResponse,
    BulkDeletePublicationsRequest,
    BulkDeleteAuthorsRequest,
    BulkDeleteBatchesRequest,
    BulkDeleteResult,
    AuthorCreate,
    AuthorUpdate,
    AuthorVerificationUpdate,
    AuthorOut,
    AuthorListResponse,
    BulletinCreate,
    BulletinUpdate,
    BulletinStatusUpdate,
    BulletinOut,
    BulletinListResponse,
    CamProjectCreate,
    CamProjectUpdate,
    CamProjectOut,
    CamProjectListResponse,
    CertificateIssueRequest,
    CertificateRevokeRequest,
    CertificateReissueRequest,
    CertificateOut,
    CertificateListResponse,
    CertificateStatsOut,
    CertificateApprovalActionRequest,
    CertificateSignatoryCreate,
    CertificateSignatoryUpdate,
    CertificateSignatoryOut,
    SignatoryListResponse,
    CertificateTemplateCreate,
    CertificateTemplateUpdate,
    CertificateTemplateOut,
    TemplateListResponse,
    SpotlightCreate,
    SpotlightUpdate,
    SpotlightOut,
    SpotlightListResponse,
)

sama_admin_router = APIRouter(prefix="/sama", tags=["Sama Veda Administration & CMS"])


def _get_production_verification_base_url(request: Request) -> str:
    """
    Resolves the official verification base URL for certificate QR codes.
    Avoids baking development / localhost URLs into permanent issued certificates.
    """
    from app.core.config import settings
    portal_url = getattr(settings, "PORTAL_BASE_URL", "").rstrip("/")
    req_base = str(request.base_url).rstrip("/") if request else ""
    if portal_url and any(h in req_base for h in ["localhost", "127.0.0.1", "testserver"]):
        return portal_url
    return req_base or portal_url or "https://vyasa.csjmu.ac.in"


def _to_publication_out(pub: ResearchPublication) -> PublicationOut:
    author_links_out = []
    if pub.author_links:
        for link in pub.author_links:
            author_links_out.append(
                PublicationAuthorOut(
                    author_id=link.author_id,
                    author_name=link.author.full_name if link.author else None,
                    author_order=link.author_order,
                    is_corresponding=link.is_corresponding,
                    department=link.author.department if link.author else None,
                )
            )
    return PublicationOut(
        id=pub.id,
        bulletin_id=pub.bulletin_id,
        serial_no=pub.serial_no,
        slug=pub.slug,
        title=pub.title,
        source_journal=pub.source_journal,
        category=pub.category,
        doi=pub.doi,
        author_display=pub.author_display,
        authors_complete=pub.authors_complete if pub.authors_complete is not None else True,
        status=pub.status or "draft",
        abstract=pub.abstract,
        external_url=pub.external_url,
        is_featured=pub.is_featured if pub.is_featured is not None else False,
        published_at=pub.published_at,
        archived_at=pub.archived_at,
        created_at=pub.created_at or datetime.now(timezone.utc),
        updated_at=pub.updated_at or datetime.now(timezone.utc),
        author_links=author_links_out,
    )


def _handle_db_schema_exception(exc: Exception, entity_name: str):
    err_str = str(exc).lower()
    
    # 1. Distinguish network / connection / resolution failures from missing schema
    if isinstance(exc, (OperationalError, DBAPIError)) and any(
        kw in err_str for kw in ["connection", "timeout", "refused", "name resolution", "getaddrinfo", "server closed", "could not connect"]
    ):
        logger.error("Database connectivity failure while accessing %s: %s", entity_name, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service is currently unreachable. Please verify database connectivity.",
        )

    # 2. Schema / migration errors (missing table, missing column, undefined relation)
    if any(kw in err_str for kw in ["relation", "does not exist", "undefinedtable", "undefined_table", "undefined_column", "undefinedcolumn"]):
        logger.error("Database schema/migration error accessing %s: %s", entity_name, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{entity_name} database table is uninitialized or not migrated. Please verify database initialization.",
        )

    logger.error("Unexpected database error accessing %s: %s", entity_name, exc)
    raise exc

# ============================================================================
# 1. PUBLICATIONS MANAGEMENT
# ============================================================================

@sama_admin_router.get("/publications", response_model=ApiResponse)
def list_admin_publications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    bulletin_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    is_featured: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, pubs = sama_cms_service.list_publications(
            db,
            skip=skip,
            limit=limit,
            bulletin_id=bulletin_id,
            category=category,
            status=status,
            search=search,
            is_featured=is_featured,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Research publications")
    items = [_to_publication_out(p) for p in pubs]
    return ApiResponse(
        success=True,
        message="Research publications retrieved successfully.",
        data=PublicationListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/publications/{publication_id}", response_model=ApiResponse)
def get_admin_publication(
    publication_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    pub = sama_cms_service.get_publication_by_id(db, publication_id)
    if not pub:
        raise HTTPException(status_code=404, detail="Research publication not found.")
    return ApiResponse(
        success=True,
        message="Research publication retrieved successfully.",
        data=_to_publication_out(pub).model_dump(),
    )


@sama_admin_router.post("/publications", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_publication(
    payload: PublicationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    bulletin = sama_cms_service.get_bulletin_by_id(db, payload.bulletin_id)
    if not bulletin:
        raise HTTPException(status_code=400, detail="Referenced bulletin does not exist.")

    pub = sama_cms_service.create_publication(db, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="publication_created",
        entity_name="ResearchPublication",
        entity_id=pub.id,
        actor_user_id=current_user.id,
        details={"slug": pub.slug, "title": pub.title, "status": pub.status},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research publication created successfully.",
        data=_to_publication_out(pub).model_dump(),
    )


@sama_admin_router.put("/publications/{publication_id}", response_model=ApiResponse)
def update_publication(
    publication_id: uuid.UUID,
    payload: PublicationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    pub = sama_cms_service.get_publication_by_id(db, publication_id)
    if not pub:
        raise HTTPException(status_code=404, detail="Research publication not found.")

    if payload.bulletin_id and payload.bulletin_id != pub.bulletin_id:
        bulletin = sama_cms_service.get_bulletin_by_id(db, payload.bulletin_id)
        if not bulletin:
            raise HTTPException(status_code=400, detail="Referenced bulletin does not exist.")

    updated_pub = sama_cms_service.update_publication(db, pub, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="publication_updated",
        entity_name="ResearchPublication",
        entity_id=updated_pub.id,
        actor_user_id=current_user.id,
        details=payload.model_dump(exclude_unset=True),
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research publication updated successfully.",
        data=_to_publication_out(updated_pub).model_dump(),
    )


@sama_admin_router.patch("/publications/{publication_id}/status", response_model=ApiResponse)
def update_publication_status(
    publication_id: uuid.UUID,
    payload: PublicationStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:publish")),
):
    pub = sama_cms_service.get_publication_by_id(db, publication_id)
    if not pub:
        raise HTTPException(status_code=404, detail="Research publication not found.")

    previous_status = pub.status
    updated_pub = sama_cms_service.update_publication_status(db, pub, payload.status)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="publication_status_updated",
        entity_name="ResearchPublication",
        entity_id=updated_pub.id,
        actor_user_id=current_user.id,
        details={"previous_status": previous_status, "new_status": payload.status},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message=f"Research publication lifecycle status updated to '{payload.status}'.",
        data=_to_publication_out(updated_pub).model_dump(),
    )


@sama_admin_router.delete("/publications/{publication_id}", response_model=ApiResponse)
def delete_publication(
    publication_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    pub = sama_cms_service.get_publication_by_id(db, publication_id)
    if not pub:
        raise HTTPException(status_code=404, detail="Research publication not found.")

    slug = pub.slug
    sama_cms_service.delete_publication(db, pub)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="publication_deleted",
        entity_name="ResearchPublication",
        entity_id=publication_id,
        actor_user_id=current_user.id,
        details={"slug": slug},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research publication deleted successfully.",
        data={"id": str(publication_id)},
    )


@sama_admin_router.post("/publications/bulk-delete", response_model=ApiResponse)
def bulk_delete_publications(
    payload: BulkDeletePublicationsRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin_user),
):
    """
    Bulk deletes multiple research publications permanently from SAMIKSHA.
    Restricted strictly to authorized Super Admin users.
    Safeguards:
    - Cascades publication_authors removal.
    - Safely unlinks referenced certificates (sets publication_id=None).
    - Logs detailed audit action including deleted and failed IDs.
    - Handles partial failures gracefully without aborting the entire request.
    """
    if not payload.publication_ids:
        raise HTTPException(status_code=400, detail="No publication IDs provided for bulk deletion.")

    deleted_ids, failed_items = sama_cms_service.bulk_delete_publications(
        db, payload.publication_ids
    )

    batch_op_id = uuid.uuid4()
    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="publications_bulk_deleted",
        entity_name="ResearchPublication",
        entity_id=batch_op_id,
        actor_user_id=current_user.id,
        details={
            "requested_count": len(payload.publication_ids),
            "deleted_count": len(deleted_ids),
            "deleted_ids": [str(i) for i in deleted_ids],
            "failed_count": len(failed_items),
            "failed_items": failed_items,
        },
        fail_silent=False,
    )

    success = len(deleted_ids) > 0 or len(payload.publication_ids) == 0
    message = (
        f"Successfully deleted {len(deleted_ids)} publication(s)."
        if len(failed_items) == 0
        else f"Deleted {len(deleted_ids)} publication(s); {len(failed_items)} failed."
    )

    return ApiResponse(
        success=success,
        message=message,
        data={
            "deleted_count": len(deleted_ids),
            "deleted_ids": [str(i) for i in deleted_ids],
            "failed_count": len(failed_items),
            "failed_items": failed_items,
            "total_requested": len(payload.publication_ids),
        },
    )


# ============================================================================
# 2. RESEARCH AUTHORS MANAGEMENT & SCOPUS REVIEW
# ============================================================================

@sama_admin_router.get("/authors", response_model=ApiResponse)
def list_admin_authors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = None,
    is_verified: Optional[bool] = None,
    department: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, authors = sama_cms_service.list_authors(
            db,
            skip=skip,
            limit=limit,
            search=search,
            is_verified=is_verified,
            department=department,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Research authors")
    items = [AuthorOut.model_validate(a) for a in authors]
    return ApiResponse(
        success=True,
        message="Research authors retrieved successfully.",
        data=AuthorListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/authors/{author_id}", response_model=ApiResponse)
def get_admin_author(
    author_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    author = sama_cms_service.get_author_by_id(db, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Research author not found.")
    return ApiResponse(
        success=True,
        message="Research author retrieved successfully.",
        data=AuthorOut.model_validate(author).model_dump(),
    )


@sama_admin_router.post("/authors", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_author(
    payload: AuthorCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    author = sama_cms_service.create_author(db, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="author_created",
        entity_name="ResearchAuthor",
        entity_id=author.id,
        actor_user_id=current_user.id,
        details={"full_name": author.full_name, "scopus_id": author.scopus_id},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research author created successfully.",
        data=AuthorOut.model_validate(author).model_dump(),
    )


@sama_admin_router.put("/authors/{author_id}", response_model=ApiResponse)
def update_author(
    author_id: uuid.UUID,
    payload: AuthorUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    author = sama_cms_service.get_author_by_id(db, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Research author not found.")

    updated_author = sama_cms_service.update_author(db, author, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="author_updated",
        entity_name="ResearchAuthor",
        entity_id=updated_author.id,
        actor_user_id=current_user.id,
        details=payload.model_dump(exclude_unset=True),
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research author updated successfully.",
        data=AuthorOut.model_validate(updated_author).model_dump(),
    )


@sama_admin_router.patch("/authors/{author_id}/verify", response_model=ApiResponse)
def verify_author(
    author_id: uuid.UUID,
    payload: AuthorVerificationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:author:verify")),
):
    author = sama_cms_service.get_author_by_id(db, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Research author not found.")

    updated_author = sama_cms_service.verify_author(db, author, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="author_verified" if payload.is_verified else "author_unverified",
        entity_name="ResearchAuthor",
        entity_id=updated_author.id,
        actor_user_id=current_user.id,
        details={
            "is_verified": payload.is_verified,
            "scopus_id": updated_author.scopus_id,
            "verification_notes": payload.verification_notes,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message=f"Author identity verification updated (is_verified={payload.is_verified}).",
        data=AuthorOut.model_validate(updated_author).model_dump(),
    )


@sama_admin_router.delete("/authors/{author_id}", response_model=ApiResponse)
def delete_author(
    author_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    author = sama_cms_service.get_author_by_id(db, author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Research author not found.")

    full_name = author.full_name
    sama_cms_service.delete_author(db, author)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="author_deleted",
        entity_name="ResearchAuthor",
        entity_id=author_id,
        actor_user_id=current_user.id,
        details={"full_name": full_name},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research author deleted successfully.",
        data={"id": str(author_id)},
    )


@sama_admin_router.post("/authors/bulk-delete", response_model=ApiResponse)
def bulk_delete_authors(
    payload: BulkDeleteAuthorsRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    """
    Bulk deletes multiple research author records permanently from SAMIKSHA.
    Restricted to authorized users with 'sama:content:edit' permission.
    Safeguards:
    - Cascades publication_authors removal and unlinks associated certificates/spotlights.
    - Logs detailed audit action including deleted and failed IDs.
    - Handles partial failures gracefully without aborting the entire request.
    """
    if not payload.author_ids:
        raise HTTPException(status_code=400, detail="No author IDs provided for bulk deletion.")

    deleted_ids, failed_items = sama_cms_service.bulk_delete_authors(
        db, payload.author_ids
    )

    batch_op_id = uuid.uuid4()
    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="authors_bulk_deleted",
        entity_name="ResearchAuthor",
        entity_id=batch_op_id,
        actor_user_id=current_user.id,
        details={
            "requested_count": len(payload.author_ids),
            "deleted_count": len(deleted_ids),
            "deleted_ids": [str(i) for i in deleted_ids],
            "failed_count": len(failed_items),
            "failed_items": failed_items,
        },
        fail_silent=False,
    )

    success = len(deleted_ids) > 0 or len(payload.author_ids) == 0
    message = (
        f"Bulk deletion completed: {len(deleted_ids)} author profile(s) deleted."
        if not failed_items
        else f"Bulk deletion finished with warnings: {len(deleted_ids)} deleted, {len(failed_items)} failed."
    )

    return ApiResponse(
        success=success,
        message=message,
        data=BulkDeleteResult(
            deleted_count=len(deleted_ids),
            deleted_ids=[str(i) for i in deleted_ids],
            failed_count=len(failed_items),
            failed_items=failed_items,
            total_requested=len(payload.author_ids),
        ).model_dump(),
    )


# ============================================================================
# 3. RESEARCH BULLETINS MANAGEMENT
# ============================================================================

@sama_admin_router.get("/bulletins", response_model=ApiResponse)
def list_admin_bulletins(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, bulletins = sama_cms_service.list_bulletins(
            db,
            skip=skip,
            limit=limit,
            status=status,
            is_active=is_active,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Research bulletins")
    items = [BulletinOut.model_validate(b) for b in bulletins]
    return ApiResponse(
        success=True,
        message="Research bulletins retrieved successfully.",
        data=BulletinListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/bulletins/{bulletin_id}", response_model=ApiResponse)
def get_admin_bulletin(
    bulletin_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    bulletin = sama_cms_service.get_bulletin_by_id(db, bulletin_id)
    if not bulletin:
        raise HTTPException(status_code=404, detail="Research bulletin not found.")
    return ApiResponse(
        success=True,
        message="Research bulletin retrieved successfully.",
        data=BulletinOut.model_validate(bulletin).model_dump(),
    )


@sama_admin_router.post("/bulletins/upload", response_model=ApiResponse)
def upload_bulletin_file(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    """
    Secure file upload for official Research Bulletin PDF.
    Validates PDF magic bytes, generates SHA-256 hash, and stores safely outside Git.
    """
    try:
        result = storage_service.save_file(
            content=file.file,
            filename=file.filename or "bulletin.pdf",
            subfolder="sama_veda/bulletins",
            allowed_mime_types=["application/pdf"],
            mime_type=file.content_type or "application/pdf",
        )
        return ApiResponse(
            success=True,
            message="Bulletin PDF uploaded and validated successfully.",
            data={
                "storage_key": result.storage_key,
                "filename": result.filename,
                "file_size_bytes": result.file_size_bytes,
                "checksum_sha256": result.checksum_sha256,
            },
        )
    except StorageInvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except StorageSizeLimitError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage failure: {e}")


@sama_admin_router.post("/bulletins", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_bulletin(
    payload: BulletinCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    bulletin = sama_cms_service.create_bulletin(db, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="bulletin_created",
        entity_name="ResearchBulletin",
        entity_id=bulletin.id,
        actor_user_id=current_user.id,
        details={
            "volume_number": bulletin.volume_number,
            "issue_number": bulletin.issue_number,
            "title": bulletin.title,
            "status": bulletin.status,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research bulletin created successfully.",
        data=BulletinOut.model_validate(bulletin).model_dump(),
    )


@sama_admin_router.put("/bulletins/{bulletin_id}", response_model=ApiResponse)
def update_bulletin(
    bulletin_id: uuid.UUID,
    payload: BulletinUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    bulletin = sama_cms_service.get_bulletin_by_id(db, bulletin_id)
    if not bulletin:
        raise HTTPException(status_code=404, detail="Research bulletin not found.")

    updated_bulletin = sama_cms_service.update_bulletin(db, bulletin, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="bulletin_updated",
        entity_name="ResearchBulletin",
        entity_id=updated_bulletin.id,
        actor_user_id=current_user.id,
        details=payload.model_dump(exclude_unset=True),
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research bulletin updated successfully.",
        data=BulletinOut.model_validate(updated_bulletin).model_dump(),
    )


@sama_admin_router.patch("/bulletins/{bulletin_id}/status", response_model=ApiResponse)
def update_bulletin_status(
    bulletin_id: uuid.UUID,
    payload: BulletinStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:publish")),
):
    bulletin = sama_cms_service.get_bulletin_by_id(db, bulletin_id)
    if not bulletin:
        raise HTTPException(status_code=404, detail="Research bulletin not found.")

    previous_status = bulletin.status
    updated_bulletin = sama_cms_service.update_bulletin_status(
        db, bulletin, payload.status, is_active=payload.is_active
    )

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="bulletin_status_updated",
        entity_name="ResearchBulletin",
        entity_id=updated_bulletin.id,
        actor_user_id=current_user.id,
        details={
            "previous_status": previous_status,
            "new_status": payload.status,
            "is_active": updated_bulletin.is_active,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message=f"Research bulletin status updated to '{payload.status}'.",
        data=BulletinOut.model_validate(updated_bulletin).model_dump(),
    )


@sama_admin_router.delete("/bulletins/{bulletin_id}", response_model=ApiResponse)
def delete_bulletin(
    bulletin_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    bulletin = sama_cms_service.get_bulletin_by_id(db, bulletin_id)
    if not bulletin:
        raise HTTPException(status_code=404, detail="Research bulletin not found.")

    title = bulletin.title
    sama_cms_service.delete_bulletin(db, bulletin)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="bulletin_deleted",
        entity_name="ResearchBulletin",
        entity_id=bulletin_id,
        actor_user_id=current_user.id,
        details={"title": title},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Research bulletin deleted successfully.",
        data={"id": str(bulletin_id)},
    )


# ============================================================================
# 4. CAM-AI RESEARCH PROJECTS SCHEME
# ============================================================================

@sama_admin_router.get("/cam-projects", response_model=ApiResponse)
def list_admin_cam_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    domain: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, projects = sama_cms_service.list_cam_projects(
            db,
            skip=skip,
            limit=limit,
            category=category,
            domain=domain,
            status=status,
            search=search,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "CAM-AI projects")
    items = [CamProjectOut.model_validate(p) for p in projects]
    return ApiResponse(
        success=True,
        message="CAM-AI projects retrieved successfully.",
        data=CamProjectListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/cam-projects/{project_id}", response_model=ApiResponse)
def get_admin_cam_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    project = sama_cms_service.get_cam_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="CAM-AI project not found.")
    return ApiResponse(
        success=True,
        message="CAM-AI project retrieved successfully.",
        data=CamProjectOut.model_validate(project).model_dump(),
    )


@sama_admin_router.post("/cam-projects", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_cam_project(
    payload: CamProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    project = sama_cms_service.create_cam_project(db, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="cam_project_created",
        entity_name="CamAiProject",
        entity_id=project.id,
        actor_user_id=current_user.id,
        details={"title": project.title, "domain": project.domain, "category": project.category},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="CAM-AI project created successfully.",
        data=CamProjectOut.model_validate(project).model_dump(),
    )


@sama_admin_router.put("/cam-projects/{project_id}", response_model=ApiResponse)
def update_cam_project(
    project_id: uuid.UUID,
    payload: CamProjectUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    project = sama_cms_service.get_cam_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="CAM-AI project not found.")

    updated_project = sama_cms_service.update_cam_project(db, project, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="cam_project_updated",
        entity_name="CamAiProject",
        entity_id=updated_project.id,
        actor_user_id=current_user.id,
        details=payload.model_dump(exclude_unset=True),
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="CAM-AI project updated successfully.",
        data=CamProjectOut.model_validate(updated_project).model_dump(),
    )


@sama_admin_router.delete("/cam-projects/{project_id}", response_model=ApiResponse)
def delete_cam_project(
    project_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    project = sama_cms_service.get_cam_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="CAM-AI project not found.")

    title = project.title
    sama_cms_service.delete_cam_project(db, project)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="cam_project_deleted",
        entity_name="CamAiProject",
        entity_id=project_id,
        actor_user_id=current_user.id,
        details={"title": title},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="CAM-AI project deleted successfully.",
        data={"id": str(project_id)},
    )


# ============================================================================
# 5. FELICITATION CERTIFICATES & MODERN DIGITAL CERTIFICATE MANAGEMENT
# ============================================================================

@sama_admin_router.get("/certificates/stats", response_model=ApiResponse)
def get_certificate_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        stats = sama_cms_service.get_certificate_stats(db)
    except Exception as exc:
        _handle_db_schema_exception(exc, "Felicitation certificates")
    return ApiResponse(
        success=True,
        message="Certificate statistics aggregated successfully.",
        data=CertificateStatsOut.model_validate(stats).model_dump(),
    )


@sama_admin_router.post("/certificates/preview")
def preview_certificate_pdf(
    payload: CertificateIssueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    from fastapi.responses import Response
    from app.modules.sama_veda.services.certificate_pdf_service import certificate_pdf_engine
    
    author_items = []
    if payload.authors:
        sorted_authors = sorted(payload.authors, key=lambda x: getattr(x, "author_order", 1) or 1)
        for a in sorted_authors:
            author_items.append({
                "author_name_snapshot": a.author_name_snapshot,
                "academic_title_snapshot": a.academic_title_snapshot,
                "scopus_id_snapshot": a.scopus_id_snapshot,
                "department_snapshot": a.department_snapshot,
                "affiliation_snapshot": a.affiliation_snapshot,
                "author_role": getattr(a, "author_role", "Author"),
                "author_order": getattr(a, "author_order", 1),
            })
    else:
        author_items = [{
            "author_name_snapshot": "Recipient Researcher",
            "department_snapshot": "Department of Physics",
            "academic_title_snapshot": "Dr.",
            "author_role": "First Author",
            "author_order": 1,
        }]

    # Look up active signatories if present (purely read-only, never seed or commit)
    dean_name = "Prof. (Dr.) Rajesh Kumar"
    dean_desig = "Dean – Research & Development"
    dean_sig = None
    vc_name = "Prof. Vinay Kumar Pathak"
    vc_desig = "Vice Chancellor"
    vc_sig = None
    try:
        from app.modules.sama_veda.models.certificate import CertificateSignatory
        sig_stmt = select(CertificateSignatory).where(CertificateSignatory.is_active == True)
        signatories = db.scalars(sig_stmt).all()
        for s in signatories:
            if s.authority_type == "DEAN_RD":
                dean_name = s.signatory_name
                dean_desig = s.designation
                dean_sig = s.signature_image_path
            elif s.authority_type == "VICE_CHANCELLOR":
                vc_name = s.signatory_name
                vc_desig = s.designation
                vc_sig = s.signature_image_path
    except Exception:
        pass

    bulletin_obj = None
    if payload.bulletin_id:
        try:
            from app.modules.sama_veda.models.bulletin import ResearchBulletin
            bulletin_obj = db.get(ResearchBulletin, payload.bulletin_id)
        except Exception:
            pass

    pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
        certificate_number=payload.certificate_number or "CSJMU/PREVIEW/DRAFT-0000",
        verification_token="PREVIEW",
        verification_url=f"{str(request.base_url).rstrip('/')}/verify/preview-draft",
        title=payload.title,
        certificate_type=payload.certificate_type or "RESEARCH_PUBLICATION",
        presentation_statement=payload.presentation_statement,
        authors=author_items,
        research_contribution_statement=payload.research_contribution_statement,
        research_title=payload.research_title or "Exemplary Research Paper Title",
        publication_details=payload.publication_details,
        bulletin_title=bulletin_obj.title if bulletin_obj else None,
        bulletin_volume=bulletin_obj.volume_number if bulletin_obj else None,
        bulletin_issue=bulletin_obj.issue_number if bulletin_obj else None,
        bulletin_period=bulletin_obj.publication_period if bulletin_obj else None,
        incentive_details=payload.publication_details if payload.certificate_type == "INCENTIVE_AWARD" else None,
        congratulatory_statement=payload.congratulatory_statement,
        dean_name=dean_name,
        dean_designation=dean_desig,
        dean_signature_path=dean_sig,
        vc_name=vc_name,
        vc_designation=vc_desig,
        vc_signature_path=vc_sig,
        is_preview=True,
    )
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline; filename=certificate_preview.pdf",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        }
    )


@sama_admin_router.get("/certificates", response_model=ApiResponse)
def list_admin_certificates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    bulletin_id: Optional[uuid.UUID] = None,
    author_id: Optional[uuid.UUID] = None,
    is_revoked: Optional[bool] = None,
    search: Optional[str] = None,
    status: Optional[str] = None,
    certificate_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, certs = sama_cms_service.list_certificates(
            db,
            skip=skip,
            limit=limit,
            bulletin_id=bulletin_id,
            author_id=author_id,
            is_revoked=is_revoked,
            search=search,
            status=status,
            certificate_type=certificate_type,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Felicitation certificates")
    items = [CertificateOut.model_validate(c) for c in certs]
    return ApiResponse(
        success=True,
        message="Felicitation certificates retrieved successfully.",
        data=CertificateListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/certificates/{certificate_id}", response_model=ApiResponse)
def get_admin_certificate(
    certificate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    cert = sama_cms_service.get_certificate_by_id(db, certificate_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")
    return ApiResponse(
        success=True,
        message="Certificate retrieved successfully.",
        data=CertificateOut.model_validate(cert).model_dump(),
    )


@sama_admin_router.post("/certificates/upload", response_model=ApiResponse)
def upload_certificate_file(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    """
    Secure file upload for felicitation certificate PDF.
    Validates PDF magic bytes, generates SHA-256 hash, and stores outside web root.
    """
    try:
        result = storage_service.save_file(
            content=file.file,
            filename=file.filename or "certificate.pdf",
            subfolder="sama_veda/certificates",
            allowed_mime_types=["application/pdf"],
            mime_type=file.content_type or "application/pdf",
        )
        return ApiResponse(
            success=True,
            message="Certificate PDF uploaded and validated successfully.",
            data={
                "storage_key": result.storage_key,
                "filename": result.filename,
                "file_size_bytes": result.file_size_bytes,
                "checksum_sha256": result.checksum_sha256,
            },
        )
    except StorageInvalidFileTypeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except StorageSizeLimitError as e:
        raise HTTPException(status_code=413, detail=str(e))
    except StorageError as e:
        raise HTTPException(status_code=500, detail=f"Storage failure: {e}")


@sama_admin_router.post("/certificates", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def issue_certificate(
    payload: CertificateIssueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    if payload.certificate_number:
        existing = sama_cms_service.get_certificate_by_number(db, payload.certificate_number)
        if existing:
            raise HTTPException(status_code=400, detail="Certificate number already exists.")

    if payload.bulletin_id:
        bulletin = sama_cms_service.get_bulletin_by_id(db, payload.bulletin_id)
        if not bulletin:
            raise HTTPException(status_code=400, detail="Referenced bulletin does not exist.")
    if payload.author_id:
        author = sama_cms_service.get_author_by_id(db, payload.author_id)
        if not author:
            raise HTTPException(status_code=400, detail="Referenced author does not exist.")

    if payload.authors and not payload.submit_for_approval:
        # Exceptional direct issuance requires mandatory institutional justification (>= 10 chars)
        justification = (payload.direct_issue_justification or "").strip()
        if len(justification) < 10:
            raise HTTPException(
                status_code=400,
                detail="Direct certificate issuance requires a mandatory institutional justification (minimum 10 characters).",
            )

    base_url = _get_production_verification_base_url(request)
    cert = sama_cms_service.issue_certificate(
        db, payload, created_by_user_id=current_user.id, base_verification_url=base_url
    )

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="certificate_issued",
        entity_name="FelicitationCertificate",
        entity_id=cert.id,
        actor_user_id=current_user.id,
        details={
            "certificate_number": cert.certificate_number,
            "author_id": str(cert.author_id),
            "bulletin_id": str(cert.bulletin_id),
            "submit_mode": "APPROVAL" if payload.submit_for_approval else "DIRECT_ISSUANCE",
            "direct_issue_justification": payload.direct_issue_justification if not payload.submit_for_approval else None,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Felicitation certificate issued successfully.",
        data=CertificateOut.model_validate(cert).model_dump(),
    )


@sama_admin_router.post("/certificates/{certificate_id}/revoke", response_model=ApiResponse)
def revoke_certificate(
    certificate_id: uuid.UUID,
    payload: CertificateRevokeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:revoke")),
):
    """
    Revoke a felicitation certificate.
    RESTRICTED TO SUPER_ADMIN ONLY (enforced by RBAC seed and require_permission).
    Mandates an official audit justification / reason for revocation.
    """
    cert = sama_cms_service.get_certificate_by_id(db, certificate_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    if cert.is_revoked:
        raise HTTPException(status_code=400, detail="Certificate is already revoked.")

    revoked_cert = sama_cms_service.revoke_certificate(db, cert, payload.revocation_reason)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="certificate_revoked",
        entity_name="FelicitationCertificate",
        entity_id=revoked_cert.id,
        actor_user_id=current_user.id,
        details={
            "certificate_number": revoked_cert.certificate_number,
            "revocation_reason": payload.revocation_reason,
            "revoked_at": str(revoked_cert.revoked_at),
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message=f"Certificate {revoked_cert.certificate_number} has been officially revoked.",
        data=CertificateOut.model_validate(revoked_cert).model_dump(),
    )


@sama_admin_router.post("/certificates/{certificate_id}/approve", response_model=ApiResponse)
def approve_certificate(
    certificate_id: uuid.UUID,
    payload: CertificateApprovalActionRequest,
    request: Request,
    authority: str = Query("DEAN_RD", description="DEAN_RD | VICE_CHANCELLOR"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    """
    Dual authority approval endpoint for Dean – R&D and Vice Chancellor.
    When both authorities approve, final vector PDF is rendered and document becomes ISSUED.
    """
    cert = sama_cms_service.get_certificate_by_id(db, certificate_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    if payload.action.upper() == "REJECT" and not payload.remarks:
        raise HTTPException(status_code=400, detail="Rejection remarks are mandatory when rejecting a certificate.")

    base_url = _get_production_verification_base_url(request)
    updated_cert = sama_cms_service.process_authority_approval(
        db,
        cert,
        authority_type=authority.strip().upper(),
        action=payload.action,
        remarks=payload.remarks,
        user_id=current_user.id,
        base_verification_url=base_url,
    )

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action=f"certificate_approval_{payload.action.lower()}",
        entity_name="FelicitationCertificate",
        entity_id=updated_cert.id,
        actor_user_id=current_user.id,
        details={
            "certificate_number": updated_cert.certificate_number,
            "authority": authority,
            "action": payload.action,
            "status": updated_cert.status,
            "remarks": payload.remarks,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message=f"Certificate approval action '{payload.action}' recorded successfully.",
        data=CertificateOut.model_validate(updated_cert).model_dump(),
    )


@sama_admin_router.post("/certificates/{certificate_id}/reissue", response_model=ApiResponse)
def reissue_certificate(
    certificate_id: uuid.UUID,
    payload: CertificateReissueRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:revoke")),
):
    """
    Reissue a certificate with corrections. Marks old certificate as SUPERSEDED and issues replacement document.
    Restricted to Super Admin.
    """
    cert = sama_cms_service.get_certificate_by_id(db, certificate_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    base_url = _get_production_verification_base_url(request)
    new_cert = sama_cms_service.reissue_certificate(
        db, cert, reason=payload.reissue_reason, data=payload, created_by_user_id=current_user.id, base_verification_url=base_url
    )

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="certificate_reissued",
        entity_name="FelicitationCertificate",
        entity_id=new_cert.id,
        actor_user_id=current_user.id,
        details={
            "previous_certificate_id": str(cert.id),
            "previous_certificate_number": cert.certificate_number,
            "new_certificate_number": new_cert.certificate_number,
            "reissue_reason": payload.reissue_reason,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message=f"Certificate {cert.certificate_number} superseded and reissued as {new_cert.certificate_number}.",
        data=CertificateOut.model_validate(new_cert).model_dump(),
    )


# ============================================================================
# TEMPLATE MANAGEMENT ENDPOINTS
# ============================================================================

@sama_admin_router.get("/templates", response_model=ApiResponse)
def list_admin_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    certificate_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, tpls = sama_cms_service.list_templates(
            db, skip=skip, limit=limit, is_active=is_active, certificate_type=certificate_type
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Certificate templates")
    items = [CertificateTemplateOut.model_validate(t) for t in tpls]
    return ApiResponse(
        success=True,
        message="Certificate templates retrieved successfully.",
        data=TemplateListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/templates/{template_id}", response_model=ApiResponse)
def get_admin_template(
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    tpl = sama_cms_service.get_template_by_id(db, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Certificate template not found.")
    return ApiResponse(
        success=True,
        message="Certificate template retrieved successfully.",
        data=CertificateTemplateOut.model_validate(tpl).model_dump(),
    )


@sama_admin_router.post("/templates", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_admin_template(
    payload: CertificateTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    tpl = sama_cms_service.create_template(db, payload, user_id=current_user.id)
    return ApiResponse(
        success=True,
        message="Certificate template created successfully.",
        data=CertificateTemplateOut.model_validate(tpl).model_dump(),
    )


@sama_admin_router.put("/templates/{template_id}", response_model=ApiResponse)
def update_admin_template(
    template_id: uuid.UUID,
    payload: CertificateTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    tpl = sama_cms_service.get_template_by_id(db, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Certificate template not found.")
    updated = sama_cms_service.update_template(db, tpl, payload)
    return ApiResponse(
        success=True,
        message="Certificate template updated successfully.",
        data=CertificateTemplateOut.model_validate(updated).model_dump(),
    )


# ============================================================================
# SIGNATORY MANAGEMENT ENDPOINTS
# ============================================================================

@sama_admin_router.get("/signatories", response_model=ApiResponse)
def list_admin_signatories(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    authority_type: Optional[str] = None,
    include_deleted: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, sigs = sama_cms_service.list_signatories(
            db,
            skip=skip,
            limit=limit,
            is_active=is_active,
            authority_type=authority_type,
            include_deleted=include_deleted,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Certificate signatories")
    items = [CertificateSignatoryOut.model_validate(s) for s in sigs]
    return ApiResponse(
        success=True,
        message="Certificate signatories retrieved successfully.",
        data=SignatoryListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/signatories/{signatory_id}", response_model=ApiResponse)
def get_admin_signatory(
    signatory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    sig = sama_cms_service.get_signatory_by_id(db, signatory_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Certificate signatory not found.")
    return ApiResponse(
        success=True,
        message="Certificate signatory retrieved successfully.",
        data=CertificateSignatoryOut.model_validate(sig).model_dump(),
    )


@sama_admin_router.post("/signatories", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_admin_signatory(
    payload: CertificateSignatoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    sig = sama_cms_service.create_signatory(db, payload)
    return ApiResponse(
        success=True,
        message="Certificate signatory created successfully.",
        data=CertificateSignatoryOut.model_validate(sig).model_dump(),
    )


@sama_admin_router.put("/signatories/{signatory_id}", response_model=ApiResponse)
def update_admin_signatory(
    signatory_id: uuid.UUID,
    payload: CertificateSignatoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    sig = sama_cms_service.get_signatory_by_id(db, signatory_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Certificate signatory not found.")
    updated = sama_cms_service.update_signatory(db, sig, payload)
    return ApiResponse(
        success=True,
        message="Certificate signatory updated successfully.",
        data=CertificateSignatoryOut.model_validate(updated).model_dump(),
    )


@sama_admin_router.post("/signatories/{signatory_id}/upload-signature", response_model=ApiResponse)
async def upload_signatory_signature(
    signatory_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    sig = sama_cms_service.get_signatory_by_id(db, signatory_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Certificate signatory not found.")

    # 1. Read file and validate size ceiling (max 2MB)
    MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"Signature asset size exceeds 2MB limit (received {len(contents) / (1024 * 1024):.2f}MB).",
        )
    if len(contents) < 16:
        raise HTTPException(status_code=400, detail="Signature file is empty or corrupted.")

    # 2. Strict magic bytes inspection (Only genuine PNG or JPEG)
    is_png = contents.startswith(b"\x89PNG\r\n\x1a\n")
    is_jpeg = contents.startswith(b"\xff\xd8\xff")
    if not (is_png or is_jpeg):
        raise HTTPException(
            status_code=400,
            detail="Invalid image format. Genuine PNG (preferred, transparent) or JPEG signature assets required.",
        )

    ext = ".png" if is_png else ".jpg"
    mime_type = "image/png" if is_png else "image/jpeg"
    safe_filename = f"signature_{sig.id}_{int(datetime.now(timezone.utc).timestamp())}{ext}"

    try:
        result = storage_service.save_file(
            content=contents,
            filename=safe_filename,
            subfolder="sama_veda/signatures",
            allowed_mime_types=["image/png", "image/jpeg"],
            mime_type=mime_type,
        )
        sig.signature_image_path = result.storage_key
        sig.signature_asset_version = (sig.signature_asset_version or 1) + 1
        db.commit()
        db.refresh(sig)
        return ApiResponse(
            success=True,
            message="Signatory signature asset uploaded successfully.",
            data=CertificateSignatoryOut.model_validate(sig).model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to upload signature asset: {e}")


@sama_admin_router.get("/signatories/{signatory_id}/signature")
def get_admin_signatory_signature(
    signatory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    """
    Stream signing authority digital signature image for secure preview.
    Uses storage_service abstraction without revealing private disk paths.
    """
    sig = sama_cms_service.get_signatory_by_id(db, signatory_id)
    if not sig:
        raise HTTPException(status_code=404, detail="Certificate signatory not found.")
    if not sig.signature_image_path:
        raise HTTPException(status_code=404, detail="No signature image asset uploaded for this authority.")

    try:
        file_path = storage_service.get_file_path(sig.signature_image_path)
    except StorageFileNotFoundError:
        raise HTTPException(status_code=404, detail="Signature image file not found in storage.")
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    media_type = "image/png"
    if str(file_path).lower().endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=f"signature_{sig.id}{os.path.splitext(str(file_path))[1] or '.png'}",
    )


@sama_admin_router.patch("/signatories/{signatory_id}/toggle-active", response_model=ApiResponse)
def toggle_admin_signatory_active(
    signatory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    """
    Toggles the active state of a signing authority.
    """
    try:
        sig = sama_cms_service.toggle_signatory_active(db, signatory_id)
        return ApiResponse(
            success=True,
            message=f"Signatory status updated to {'Active' if sig.is_active else 'Inactive'}.",
            data=CertificateSignatoryOut.model_validate(sig).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to toggle signatory status: {e}")


@sama_admin_router.delete("/signatories/{signatory_id}", response_model=ApiResponse)
def delete_admin_signatory(
    signatory_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:certificate:manage")),
):
    """
    Safely delete or soft-delete a signing authority.
    Checks dependencies: If referenced in certificate approvals, softly deactivates
    and records deleted_at to preserve historical audit trail. If unreferenced, permanently deletes.
    """
    try:
        result = sama_cms_service.delete_signatory(db, signatory_id)
        return ApiResponse(
            success=True,
            message=result["message"],
            data=result,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to delete signatory: {e}")


@sama_admin_router.get("/certificates/{certificate_id}/download")
def download_admin_certificate(
    certificate_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    """
    Stream certificate PDF to authorized administrator.
    Validates storage key and cryptographic SHA-256 integrity without static public file mounting.
    """
    cert = sama_cms_service.get_certificate_by_id(db, certificate_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    return validate_and_stream_certificate_pdf(
        cert=cert,
        request=request,
        db=db,
        current_user=current_user,
        verification_source="ADMIN_PORTAL",
    )


# ============================================================================
# 6. RESEARCHER SPOTLIGHTS MANAGEMENT
# ============================================================================

@sama_admin_router.get("/spotlights", response_model=ApiResponse)
def list_admin_spotlights(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    try:
        total, spotlights = sama_cms_service.list_spotlights(
            db,
            skip=skip,
            limit=limit,
            is_active=is_active,
        )
    except Exception as exc:
        _handle_db_schema_exception(exc, "Researcher spotlights")
    items = [SpotlightOut.model_validate(s) for s in spotlights]
    return ApiResponse(
        success=True,
        message="Researcher spotlights retrieved successfully.",
        data=SpotlightListResponse(total=total, items=items).model_dump(),
    )


@sama_admin_router.get("/spotlights/{spotlight_id}", response_model=ApiResponse)
def get_admin_spotlight(
    spotlight_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    spotlight = sama_cms_service.get_spotlight_by_id(db, spotlight_id)
    if not spotlight:
        raise HTTPException(status_code=404, detail="Researcher spotlight not found.")
    return ApiResponse(
        success=True,
        message="Researcher spotlight retrieved successfully.",
        data=SpotlightOut.model_validate(spotlight).model_dump(),
    )


@sama_admin_router.post("/spotlights", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_spotlight(
    payload: SpotlightCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    if payload.author_id:
        author = sama_cms_service.get_author_by_id(db, payload.author_id)
        if not author:
            raise HTTPException(status_code=400, detail="Referenced author does not exist.")

    spotlight = sama_cms_service.create_spotlight(db, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="spotlight_created",
        entity_name="ResearcherSpotlight",
        entity_id=spotlight.id,
        actor_user_id=current_user.id,
        details={"headline": spotlight.headline, "media_type": spotlight.media_type},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Researcher spotlight created successfully.",
        data=SpotlightOut.model_validate(spotlight).model_dump(),
    )


@sama_admin_router.put("/spotlights/{spotlight_id}", response_model=ApiResponse)
def update_spotlight(
    spotlight_id: uuid.UUID,
    payload: SpotlightUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    spotlight = sama_cms_service.get_spotlight_by_id(db, spotlight_id)
    if not spotlight:
        raise HTTPException(status_code=404, detail="Researcher spotlight not found.")

    if payload.author_id and payload.author_id != spotlight.author_id:
        author = sama_cms_service.get_author_by_id(db, payload.author_id)
        if not author:
            raise HTTPException(status_code=400, detail="Referenced author does not exist.")

    updated_spotlight = sama_cms_service.update_spotlight(db, spotlight, payload)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="spotlight_updated",
        entity_name="ResearcherSpotlight",
        entity_id=updated_spotlight.id,
        actor_user_id=current_user.id,
        details=payload.model_dump(exclude_unset=True),
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Researcher spotlight updated successfully.",
        data=SpotlightOut.model_validate(updated_spotlight).model_dump(),
    )


@sama_admin_router.delete("/spotlights/{spotlight_id}", response_model=ApiResponse)
def delete_spotlight(
    spotlight_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:edit")),
):
    spotlight = sama_cms_service.get_spotlight_by_id(db, spotlight_id)
    if not spotlight:
        raise HTTPException(status_code=404, detail="Researcher spotlight not found.")

    headline = spotlight.headline
    sama_cms_service.delete_spotlight(db, spotlight)

    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="spotlight_deleted",
        entity_name="ResearcherSpotlight",
        entity_id=spotlight_id,
        actor_user_id=current_user.id,
        details={"headline": headline},
        fail_silent=False,
    )

    return ApiResponse(
        success=True,
        message="Researcher spotlight deleted successfully.",
        data={"id": str(spotlight_id)},
    )


# =============================================================================
# DATA IMPORT & RECONCILIATION WORKFLOW ENDPOINTS
# =============================================================================

@sama_admin_router.post("/import/preview", response_model=ApiResponse)
async def preview_import_batch(
    entity_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:import")),
):
    """
    Parses and simulates import of an uploaded CSV, Excel, or JSON data file.
    Performs field validation, duplicate detection, and records preview in batch ledger.
    Zero persistent domain records are created in preview mode.
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        preview = import_service.preview_batch(
            db=db,
            entity_type=entity_type,
            filename=file.filename or "uploaded_file",
            content_bytes=content,
            user_id=current_user.id,
        )
        return ApiResponse(
            success=True,
            message="Data import preview generated successfully.",
            data=preview.model_dump(),
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate import preview: {str(e)}")


@sama_admin_router.post("/import/execute/{batch_id}", response_model=ApiResponse)
def execute_import_batch(
    batch_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:import")),
):
    """
    Executes a previously previewed import batch atomically within a transaction.
    Records structured audit log and updates batch ledger to 'completed'.
    """
    try:
        res = import_service.execute_batch(
            db=db,
            batch_id=batch_id,
            user_id=current_user.id,
            request_context={"client_ip": request.client.host if request.client else None},
        )
        return ApiResponse(
            success=True,
            message="Data import batch executed successfully.",
            data=res.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@sama_admin_router.get("/import/batches", response_model=ApiResponse)
def get_import_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    entity_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    """
    Lists historical import batches and their preview/completion status.
    """
    query = select(SamaImportBatch)
    if entity_type:
        query = query.where(SamaImportBatch.entity_type == entity_type)
    if status:
        query = query.where(SamaImportBatch.status == status)

    try:
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        batches = db.execute(query.order_by(desc(SamaImportBatch.created_at)).offset(skip).limit(limit)).scalars().all()
    except Exception as exc:
        _handle_db_schema_exception(exc, "Import batches")

    items = [
        {
            "id": str(b.id),
            "batch_number": b.batch_number,
            "entity_type": b.entity_type,
            "source_filename": b.source_filename,
            "file_format": b.file_format,
            "mode": b.mode,
            "status": b.status,
            "total_rows": b.total_rows,
            "created_count": b.created_count,
            "updated_count": b.updated_count,
            "skipped_count": b.skipped_count,
            "failed_count": b.failed_count,
            "review_count": b.review_count,
            "executed_at": b.executed_at.isoformat() if b.executed_at else None,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in batches
    ]

    return ApiResponse(
        success=True,
        message="Import batches retrieved successfully.",
        data={"items": items, "total": total, "skip": skip, "limit": limit},
    )


@sama_admin_router.get("/import/batches/{batch_id}", response_model=ApiResponse)
def get_import_batch_detail(
    batch_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    """
    Retrieves detailed reconciliation report and row error summary for an import batch.
    """
    batch = db.execute(select(SamaImportBatch).where(SamaImportBatch.id == batch_id)).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found.")

    return ApiResponse(
        success=True,
        message="Import batch details retrieved.",
        data={
            "id": str(batch.id),
            "batch_number": batch.batch_number,
            "entity_type": batch.entity_type,
            "source_filename": batch.source_filename,
            "file_format": batch.file_format,
            "mode": batch.mode,
            "status": batch.status,
            "total_rows": batch.total_rows,
            "created_count": batch.created_count,
            "updated_count": batch.updated_count,
            "skipped_count": batch.skipped_count,
            "failed_count": batch.failed_count,
            "review_count": batch.review_count,
            "error_summary": batch.error_summary or [],
            "reconciliation_report": batch.reconciliation_report or {},
            "executed_at": batch.executed_at.isoformat() if batch.executed_at else None,
            "created_at": batch.created_at.isoformat() if batch.created_at else None,
        },
    )


@sama_admin_router.post("/import/batches/bulk-delete", response_model=ApiResponse)
def bulk_delete_import_batches(
    payload: BulkDeleteBatchesRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin_user),
):
    """
    Bulk deletes multiple import batch history records from SAMIKSHA.
    Restricted strictly to authorized Super Admin users.
    """
    if not payload.batch_ids:
        raise HTTPException(status_code=400, detail="No batch IDs provided for bulk deletion.")

    deleted_ids = []
    failed_items = []

    for batch_id in payload.batch_ids:
        try:
            batch = db.execute(
                select(SamaImportBatch).where(SamaImportBatch.id == batch_id)
            ).scalar_one_or_none()
            if not batch:
                failed_items.append({"id": str(batch_id), "reason": "Import batch not found."})
                continue
            db.delete(batch)
            deleted_ids.append(batch_id)
        except Exception as e:
            failed_items.append({"id": str(batch_id), "reason": f"Deletion error: {str(e)}"})

    db.commit()

    batch_op_id = uuid.uuid4()
    audit_service.log_from_request(
        request=request,
        db=db,
        module="sama_veda",
        action="import_batches_bulk_deleted",
        entity_name="SamaImportBatch",
        entity_id=batch_op_id,
        actor_user_id=current_user.id,
        details={
            "requested_count": len(payload.batch_ids),
            "deleted_count": len(deleted_ids),
            "deleted_ids": [str(i) for i in deleted_ids],
            "failed_count": len(failed_items),
            "failed_items": failed_items,
        },
        fail_silent=False,
    )

    return ApiResponse(
        success=len(deleted_ids) > 0,
        message=f"Successfully deleted {len(deleted_ids)} import batch(es).",
        data={
            "deleted_count": len(deleted_ids),
            "deleted_ids": [str(i) for i in deleted_ids],
            "failed_count": len(failed_items),
            "failed_items": failed_items,
            "total_requested": len(payload.batch_ids),
        },
    )


@sama_admin_router.post("/import/historical-bundle", response_model=ApiResponse)
def import_historical_bundle(
    payload: HistoricalBundleImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:content:import")),
):
    """
    Guided reconciliation of the standalone research.felicitation.csjmu historical portfolio.
    Supports dry-run preview and atomic execution.
    """
    try:
        report = import_service.run_historical_bundle(
            db=db,
            source_dir=payload.source_directory,
            dry_run=payload.dry_run,
            user_id=current_user.id,
            request_context={"client_ip": request.client.host if request.client else None},
        )
        return ApiResponse(
            success=True,
            message="Historical bundle reconciliation processed.",
            data=report,
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Historical bundle error: {str(e)}")

