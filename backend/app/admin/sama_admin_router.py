import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, func, desc

from app.api.dependencies import get_db, require_permission
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
    CertificateOut,
    CertificateListResponse,
    SpotlightCreate,
    SpotlightUpdate,
    SpotlightOut,
    SpotlightListResponse,
)

sama_admin_router = APIRouter(prefix="/sama", tags=["Sama Veda Administration & CMS"])


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
    if "relation" in err_str or "does not exist" in err_str or "undefinedtable" in err_str or "undefined_table" in err_str:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{entity_name} database table is uninitialized or not migrated. Please verify database initialization.",
        )
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
            file=file.file,
            filename=file.filename or "bulletin.pdf",
            sub_dir="sama_veda/bulletins",
            allowed_types=["application/pdf"],
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
# 5. FELICITATION CERTIFICATES MANAGEMENT & REVOCATION
# ============================================================================

@sama_admin_router.get("/certificates", response_model=ApiResponse)
def list_admin_certificates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    bulletin_id: Optional[uuid.UUID] = None,
    author_id: Optional[uuid.UUID] = None,
    is_revoked: Optional[bool] = None,
    search: Optional[str] = None,
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
            file=file.file,
            filename=file.filename or "certificate.pdf",
            sub_dir="sama_veda/certificates",
            allowed_types=["application/pdf"],
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
    # Verify unique certificate number
    existing = sama_cms_service.get_certificate_by_number(db, payload.certificate_number)
    if existing:
        raise HTTPException(status_code=400, detail="Certificate number already exists.")

    # Verify bulletin and author exist
    bulletin = sama_cms_service.get_bulletin_by_id(db, payload.bulletin_id)
    if not bulletin:
        raise HTTPException(status_code=400, detail="Referenced bulletin does not exist.")
    author = sama_cms_service.get_author_by_id(db, payload.author_id)
    if not author:
        raise HTTPException(status_code=400, detail="Referenced author does not exist.")

    cert = sama_cms_service.issue_certificate(db, payload)

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


@sama_admin_router.get("/certificates/{certificate_id}/download")
def download_admin_certificate(
    certificate_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sama:read")),
):
    """
    Stream certificate PDF to authorized administrator.
    Validates storage key and streams file without static public file mounting.
    """
    cert = sama_cms_service.get_certificate_by_id(db, certificate_id)
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    try:
        file_path = storage_service.get_file_path(cert.file_storage_path)
    except StorageFileNotFoundError:
        raise HTTPException(status_code=404, detail="Certificate PDF file not found in storage.")
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    cert.download_count += 1
    db.commit()

    safe_name = cert.certificate_number.replace("/", "_") + ".pdf"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=safe_name,
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

