import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from sqlalchemy import func, or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.core.logging import logger
from app.api.dependencies import get_db
from app.core.registry import get_module_by_key
from app.schemas.response import ApiResponse
from app.core.storage import storage_service, StorageFileNotFoundError, StorageError
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.fellowship import FellowshipScheme
from app.modules.sama_veda.models.spotlight import ResearcherSpotlight
from app.modules.sama_veda.models.certificate import FelicitationCertificate, CertificateVerificationEvent
from app.modules.sama_veda.schemas.cms import (
    PublicationOut,
    PublicationAuthorOut,
    PublicationListResponse,
    BulletinOut,
    BulletinListResponse,
    CamProjectOut,
    CamProjectListResponse,
    SpotlightOut,
    SpotlightListResponse,
)

router = APIRouter(prefix="/modules/sama-veda", tags=["Sama Veda: Research Recognition & Communication"])


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


# ============================================================================
# 0. MODULE STATUS
# ============================================================================

@router.get("/status", response_model=ApiResponse)
def get_sama_veda_status():
    """
    Architectural boundary status endpoint for Sama Veda (Research Recognition & Communication).
    """
    module = get_module_by_key("sama_veda")
    return ApiResponse(
        success=True,
        message="Sama Veda module active and operational.",
        data=module.model_dump() if module else {"status": "active"},
    )


# ============================================================================
# 1. PUBLIC RESEARCH PUBLICATIONS
# ============================================================================

@router.get("/publications", response_model=ApiResponse)
def list_public_publications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    bulletin_id: Optional[uuid.UUID] = None,
    is_featured: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Public listing of verified CSJMU research publications.
    STRICT FILTER: ONLY records where status == 'published' are exposed.
    """
    query = (
        select(ResearchPublication)
        .options(joinedload(ResearchPublication.author_links).joinedload(PublicationAuthor.author))
        .where(ResearchPublication.status == "published")
    )
    count_stmt = select(func.count(ResearchPublication.id)).where(ResearchPublication.status == "published")

    if category:
        query = query.where(ResearchPublication.category.ilike(category))
        count_stmt = count_stmt.where(ResearchPublication.category.ilike(category))
    if bulletin_id:
        query = query.where(ResearchPublication.bulletin_id == bulletin_id)
        count_stmt = count_stmt.where(ResearchPublication.bulletin_id == bulletin_id)
    if is_featured is not None:
        query = query.where(ResearchPublication.is_featured == is_featured)
        count_stmt = count_stmt.where(ResearchPublication.is_featured == is_featured)
    if search:
        search_pattern = f"%{search.strip()}%"
        search_filter = or_(
            ResearchPublication.title.ilike(search_pattern),
            ResearchPublication.slug.ilike(search_pattern),
            ResearchPublication.source_journal.ilike(search_pattern),
            ResearchPublication.author_display.ilike(search_pattern),
        )
        query = query.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    try:
        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(ResearchPublication.serial_no.asc())
            .offset(skip)
            .limit(limit)
        ).unique().all()
        formatted_items = [_to_publication_out(p) for p in items]
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in list_public_publications: %s", exc)
        db.rollback()
        total = 0
        formatted_items = []

    return ApiResponse(
        success=True,
        message="Public research publications retrieved successfully.",
        data=PublicationListResponse(total=total, items=formatted_items, skip=skip, limit=limit).model_dump(),
    )


@router.get("/publications/{id_or_slug}", response_model=ApiResponse)
def get_public_publication(
    id_or_slug: str,
    db: Session = Depends(get_db),
):
    """
    Public lookup for a publication by UUID or slug.
    STRICT FILTER: Returns 404 if not found or status != 'published'.
    """
    query = (
        select(ResearchPublication)
        .options(joinedload(ResearchPublication.author_links).joinedload(PublicationAuthor.author))
        .where(ResearchPublication.status == "published")
    )

    try:
        val_uuid = uuid.UUID(id_or_slug)
        query = query.where(ResearchPublication.id == val_uuid)
    except ValueError:
        query = query.where(ResearchPublication.slug == id_or_slug)

    try:
        pub = db.scalar(query)
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in get_public_publication: %s", exc)
        db.rollback()
        raise HTTPException(status_code=404, detail="Publication not found or not currently published.")
    if not pub:
        raise HTTPException(status_code=404, detail="Publication not found or not currently published.")

    return ApiResponse(
        success=True,
        message="Publication retrieved successfully.",
        data=_to_publication_out(pub).model_dump(),
    )


# ============================================================================
# 2. PUBLIC RESEARCH BULLETINS
# ============================================================================

@router.get("/bulletins", response_model=ApiResponse)
def list_public_bulletins(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Official CSJMU Research Bulletins catalog.
    STRICT FILTER: ONLY status == 'published' AND is_active == True.
    """
    query = (
        select(ResearchBulletin)
        .where(ResearchBulletin.status == "published")
        .where(ResearchBulletin.is_active == True)
    )
    count_stmt = (
        select(func.count(ResearchBulletin.id))
        .where(ResearchBulletin.status == "published")
        .where(ResearchBulletin.is_active == True)
    )

    try:
        total = db.scalar(count_stmt) or 0
        bulletins = db.scalars(
            query.order_by(ResearchBulletin.volume_number.desc(), ResearchBulletin.issue_number.desc())
            .offset(skip)
            .limit(limit)
        ).all()
        items = [BulletinOut.model_validate(b) for b in bulletins]
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in list_public_bulletins: %s", exc)
        db.rollback()
        total = 0
        items = []

    return ApiResponse(
        success=True,
        message="Public research bulletins retrieved successfully.",
        data=BulletinListResponse(total=total, items=items).model_dump(),
    )


@router.get("/bulletins/{bulletin_id}", response_model=ApiResponse)
def get_public_bulletin(
    bulletin_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        bulletin = db.get(ResearchBulletin, bulletin_id)
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in get_public_bulletin: %s", exc)
        db.rollback()
        raise HTTPException(status_code=404, detail="Research bulletin not found or not published.")
    if not bulletin or bulletin.status != "published" or not bulletin.is_active:
        raise HTTPException(status_code=404, detail="Research bulletin not found or not published.")

    return ApiResponse(
        success=True,
        message="Research bulletin retrieved successfully.",
        data=BulletinOut.model_validate(bulletin).model_dump(),
    )


@router.get("/bulletins/{bulletin_id}/download")
def download_public_bulletin(
    bulletin_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """
    Stream full bulletin PDF to public researchers.
    STRICT FILTER: Only accessible if bulletin is published and active.
    """
    try:
        bulletin = db.get(ResearchBulletin, bulletin_id)
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in download_public_bulletin: %s", exc)
        db.rollback()
        raise HTTPException(status_code=404, detail="Research bulletin not found or not published.")
    if not bulletin or bulletin.status != "published" or not bulletin.is_active:
        raise HTTPException(status_code=404, detail="Research bulletin not found or not published.")

    try:
        file_path = storage_service.get_file_path(bulletin.file_path)
    except StorageFileNotFoundError:
        raise HTTPException(status_code=404, detail="Bulletin PDF not found in storage.")
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    safe_name = f"CSJMU_Research_Bulletin_Vol_{bulletin.volume_number}_Issue_{bulletin.issue_number}.pdf"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=safe_name,
    )


# ============================================================================
# 3. PUBLIC CAM-AI RESEARCH PROJECTS
# ============================================================================

@router.get("/cam-projects", response_model=ApiResponse)
def list_public_cam_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[str] = None,
    domain: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = select(CamAiProject)
    count_stmt = select(func.count(CamAiProject.id))

    if category:
        query = query.where(CamAiProject.category.ilike(category))
        count_stmt = count_stmt.where(CamAiProject.category.ilike(category))
    if domain:
        query = query.where(CamAiProject.domain.ilike(f"%{domain.strip()}%"))
        count_stmt = count_stmt.where(CamAiProject.domain.ilike(f"%{domain.strip()}%"))

    try:
        total = db.scalar(count_stmt) or 0
        projects = db.scalars(
            query.order_by(CamAiProject.created_at.desc())
            .offset(skip)
            .limit(limit)
        ).all()
        items = [CamProjectOut.model_validate(p) for p in projects]
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in list_public_cam_projects: %s", exc)
        db.rollback()
        total = 0
        items = []

    return ApiResponse(
        success=True,
        message="CAM-AI projects retrieved successfully.",
        data=CamProjectListResponse(total=total, items=items).model_dump(),
    )


@router.get("/cam-projects/{project_id}", response_model=ApiResponse)
def get_public_cam_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    try:
        project = db.get(CamAiProject, project_id)
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in get_public_cam_project: %s", exc)
        db.rollback()
        raise HTTPException(status_code=404, detail="CAM-AI project not found.")
    if not project:
        raise HTTPException(status_code=404, detail="CAM-AI project not found.")

    return ApiResponse(
        success=True,
        message="CAM-AI project retrieved successfully.",
        data=CamProjectOut.model_validate(project).model_dump(),
    )


# ============================================================================
# 4. PUBLIC RESEARCHER SPOTLIGHTS
# ============================================================================

@router.get("/spotlights", response_model=ApiResponse)
def list_public_spotlights(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Spotlights of distinguished researchers and research milestones.
    STRICT FILTER: ONLY is_active == True.
    """
    query = (
        select(ResearcherSpotlight)
        .where(ResearcherSpotlight.is_active == True)
        .order_by(ResearcherSpotlight.display_order.asc(), ResearcherSpotlight.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    count_stmt = (
        select(func.count(ResearcherSpotlight.id))
        .where(ResearcherSpotlight.is_active == True)
    )

    try:
        total = db.scalar(count_stmt) or 0
        spotlights = db.scalars(query).all()
        items = [SpotlightOut.model_validate(s) for s in spotlights]
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in list_public_spotlights: %s", exc)
        db.rollback()
        total = 0
        items = []

    return ApiResponse(
        success=True,
        message="Researcher spotlights retrieved successfully.",
        data=SpotlightListResponse(total=total, items=items).model_dump(),
    )


# ============================================================================
# 5. PUBLIC FELLOWSHIP SCHEMES
# ============================================================================

@router.get("/fellowships", response_model=ApiResponse)
def list_public_fellowships(
    db: Session = Depends(get_db),
):
    try:
        schemes = db.scalars(select(FellowshipScheme).order_by(FellowshipScheme.active_scholars_count.desc())).all()
        data = [
            {
                "id": str(s.id),
                "scheme_code": s.scheme_code,
                "scheme_name": s.scheme_name,
                "active_scholars_count": s.active_scholars_count,
            }
            for s in schemes
        ]
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in list_public_fellowships: %s", exc)
        db.rollback()
        data = []

    return ApiResponse(
        success=True,
        message="Research fellowship schemes retrieved successfully.",
        data={"total": len(data), "items": data},
    )


# ============================================================================
# 5b. PUBLIC RESEARCHER / AUTHOR DIRECTORY
# ============================================================================

@router.get("/authors", response_model=ApiResponse)
def list_public_authors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    department: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Public directory of institutional researchers and authors.
    Exposes only public directory profile attributes.
    """
    query = select(ResearchAuthor)
    if department:
        query = query.where(ResearchAuthor.department.ilike(f"%{department.strip()}%"))
    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                ResearchAuthor.full_name.ilike(search_pattern),
                ResearchAuthor.department.ilike(search_pattern),
                ResearchAuthor.scopus_id.ilike(search_pattern),
            )
        )

    try:
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        authors = db.execute(query.order_by(ResearchAuthor.full_name.asc()).offset(skip).limit(limit)).scalars().all()
        items = [
            {
                "id": str(a.id),
                "full_name": a.full_name,
                "department": a.department,
                "institutional_affiliation": a.institutional_affiliation,
                "scopus_id": a.scopus_id,
                "is_verified": a.is_verified,
            }
            for a in authors
        ]
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in list_public_authors: %s", exc)
        db.rollback()
        total = 0
        items = []

    return ApiResponse(
        success=True,
        message="Public researcher directory retrieved successfully.",
        data={"total": total, "items": items, "skip": skip, "limit": limit},
    )


# ============================================================================
# 6. PUBLIC CERTIFICATE VERIFICATION & DOWNLOAD
# ============================================================================

@router.get("/certificates/verify/{certificate_number:path}", response_model=ApiResponse)
def verify_certificate(
    certificate_number: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public verification endpoint for Research Appreciation & Felicitation Certificates.
    Records verification audit telemetry (IP, user agent, timestamp).
    Explicitly reports if a certificate has been revoked.
    """
    clean_number = certificate_number.strip()
    stmt = (
        select(FelicitationCertificate)
        .options(
            joinedload(FelicitationCertificate.author),
            joinedload(FelicitationCertificate.bulletin),
            joinedload(FelicitationCertificate.publication),
        )
        .where(FelicitationCertificate.certificate_number == clean_number)
    )
    try:
        cert = db.scalar(stmt)
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in verify_certificate: %s", exc)
        db.rollback()
        raise HTTPException(status_code=404, detail="Certificate not found or invalid certificate number.")

    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found or invalid certificate number.")

    # Record verification event telemetry
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    try:
        event = CertificateVerificationEvent(
            certificate_id=cert.id,
            verification_source="PORTAL",
            ip_address=client_ip,
            user_agent=user_agent[:500] if user_agent else None,
        )
        db.add(event)
        db.commit()
    except SQLAlchemyError as exc:
        logger.warning("Failed to record CertificateVerificationEvent: %s", exc)
        db.rollback()

    return ApiResponse(
        success=True,
        message="Certificate verified successfully." if not cert.is_revoked else "Certificate has been REVOKED.",
        data={
            "id": str(cert.id),
            "certificate_number": cert.certificate_number,
            "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
            "is_revoked": cert.is_revoked,
            "revoked_at": cert.revoked_at.isoformat() if cert.revoked_at else None,
            "revocation_reason": cert.revocation_reason if cert.is_revoked else None,
            "sha256_checksum": cert.checksum_sha256 or "",
            "is_download_allowed": not cert.is_revoked,
            "author": {
                "id": str(cert.author.id),
                "full_name": cert.author.full_name,
                "department": cert.author.department,
                "scopus_id": cert.author.scopus_id,
                "is_verified": cert.author.is_verified,
            } if cert.author else None,
            "bulletin": {
                "id": str(cert.bulletin.id),
                "title": cert.bulletin.title,
                "volume_number": cert.bulletin.volume_number,
                "issue_number": cert.bulletin.issue_number,
                "publication_period": cert.bulletin.publication_period,
            } if cert.bulletin else None,
            "publication": {
                "id": str(cert.publication.id),
                "title": cert.publication.title,
                "source_journal": cert.publication.source_journal,
                "category": cert.publication.category,
                "doi": cert.publication.doi,
            } if cert.publication else None,
        },
    )


@router.get("/certificates/download/{certificate_number:path}")
def download_public_certificate(
    certificate_number: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Public secure download of a verified felicitation certificate PDF.
    Blocked if the certificate is revoked.
    """
    clean_number = certificate_number.strip()
    stmt = select(FelicitationCertificate).where(
        FelicitationCertificate.certificate_number == clean_number
    )
    try:
        cert = db.scalar(stmt)
    except SQLAlchemyError as exc:
        logger.warning("Database query failed in download_public_certificate: %s", exc)
        db.rollback()
        raise HTTPException(status_code=404, detail="Certificate not found.")

    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found.")

    if cert.is_revoked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Certificate {clean_number} is REVOKED and cannot be downloaded. Reason: {cert.revocation_reason}",
        )

    try:
        file_path = storage_service.get_file_path(cert.file_storage_path)
    except StorageFileNotFoundError:
        raise HTTPException(status_code=404, detail="Certificate document not found in storage.")
    except StorageError as e:
        raise HTTPException(status_code=400, detail=str(e))

    cert.download_count += 1

    # Record telemetry
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    event = CertificateVerificationEvent(
        certificate_id=cert.id,
        verification_source="DOWNLOAD",
        ip_address=client_ip,
        user_agent=user_agent[:500] if user_agent else None,
    )
    db.add(event)
    db.commit()

    safe_name = cert.certificate_number.replace("/", "_") + ".pdf"
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=safe_name,
    )
