import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.modules.sama_veda.schemas.cms import (
    PublicationCreate,
    PublicationUpdate,
    AuthorCreate,
    AuthorUpdate,
    AuthorVerificationUpdate,
    BulletinCreate,
    BulletinUpdate,
    CamProjectCreate,
    CamProjectUpdate,
    CertificateIssueRequest,
    SpotlightCreate,
    SpotlightUpdate,
)
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.certificate import FelicitationCertificate
from app.modules.sama_veda.models.spotlight import ResearcherSpotlight


class SamaCmsService:
    """
    Business logic and transactional persistence for Sama Veda content management,
    including publications, author curation, research bulletins, CAM-AI schemes,
    felicitation certificates, and researcher spotlights.
    """

    # ========================================================================
    # 1. PUBLICATIONS
    # ========================================================================

    @staticmethod
    def list_publications(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        bulletin_id: Optional[uuid.UUID] = None,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        is_featured: Optional[bool] = None,
    ) -> Tuple[int, List[ResearchPublication]]:
        query = select(ResearchPublication).options(
            joinedload(ResearchPublication.author_links).joinedload(PublicationAuthor.author)
        )

        if bulletin_id:
            query = query.where(ResearchPublication.bulletin_id == bulletin_id)
        if category:
            query = query.where(ResearchPublication.category.ilike(category))
        if status:
            query = query.where(ResearchPublication.status == status)
        if is_featured is not None:
            query = query.where(ResearchPublication.is_featured == is_featured)
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    ResearchPublication.title.ilike(search_pattern),
                    ResearchPublication.slug.ilike(search_pattern),
                    ResearchPublication.source_journal.ilike(search_pattern),
                    ResearchPublication.author_display.ilike(search_pattern),
                )
            )

        # Count total matches
        count_stmt = select(func.count(ResearchPublication.id))
        if bulletin_id:
            count_stmt = count_stmt.where(ResearchPublication.bulletin_id == bulletin_id)
        if category:
            count_stmt = count_stmt.where(ResearchPublication.category.ilike(category))
        if status:
            count_stmt = count_stmt.where(ResearchPublication.status == status)
        if is_featured is not None:
            count_stmt = count_stmt.where(ResearchPublication.is_featured == is_featured)
        if search:
            search_pattern = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    ResearchPublication.title.ilike(search_pattern),
                    ResearchPublication.slug.ilike(search_pattern),
                    ResearchPublication.source_journal.ilike(search_pattern),
                    ResearchPublication.author_display.ilike(search_pattern),
                )
            )

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(ResearchPublication.serial_no.asc())
            .offset(skip)
            .limit(limit)
        ).unique().all()

        return total, list(items)

    @staticmethod
    def get_publication_by_id(db: Session, publication_id: uuid.UUID) -> Optional[ResearchPublication]:
        stmt = (
            select(ResearchPublication)
            .options(joinedload(ResearchPublication.author_links).joinedload(PublicationAuthor.author))
            .where(ResearchPublication.id == publication_id)
        )
        return db.scalar(stmt)

    @staticmethod
    def create_publication(db: Session, data: PublicationCreate) -> ResearchPublication:
        published_at = datetime.now(timezone.utc) if data.status == "published" else None
        publication = ResearchPublication(
            bulletin_id=data.bulletin_id,
            serial_no=data.serial_no,
            slug=data.slug,
            title=data.title,
            source_journal=data.source_journal,
            category=data.category,
            doi=data.doi,
            author_display=data.author_display,
            authors_complete=data.authors_complete,
            status=data.status,
            abstract=data.abstract,
            external_url=data.external_url,
            is_featured=data.is_featured,
            published_at=published_at,
        )
        db.add(publication)
        db.flush()

        # Link authors if provided
        if data.author_links:
            for link in data.author_links:
                pa = PublicationAuthor(
                    publication_id=publication.id,
                    author_id=link.author_id,
                    author_order=link.author_order,
                    is_corresponding=link.is_corresponding,
                )
                db.add(pa)
            db.flush()

        db.commit()
        db.refresh(publication)
        return publication

    @staticmethod
    def update_publication(
        db: Session, publication: ResearchPublication, data: PublicationUpdate
    ) -> ResearchPublication:
        update_dict = data.model_dump(exclude_unset=True)
        author_links_data = update_dict.pop("author_links", None)

        if "status" in update_dict and update_dict["status"] != publication.status:
            if update_dict["status"] == "published" and not publication.published_at:
                publication.published_at = datetime.now(timezone.utc)
            elif update_dict["status"] == "archived":
                publication.archived_at = datetime.now(timezone.utc)

        for key, value in update_dict.items():
            setattr(publication, key, value)

        if author_links_data is not None:
            # Replace existing author links
            db.query(PublicationAuthor).filter(PublicationAuthor.publication_id == publication.id).delete()
            for link in author_links_data:
                pa = PublicationAuthor(
                    publication_id=publication.id,
                    author_id=link["author_id"],
                    author_order=link.get("author_order", 1),
                    is_corresponding=link.get("is_corresponding", False),
                )
                db.add(pa)

        db.commit()
        db.refresh(publication)
        return publication

    @staticmethod
    def update_publication_status(
        db: Session, publication: ResearchPublication, status: str
    ) -> ResearchPublication:
        publication.status = status
        if status == "published" and not publication.published_at:
            publication.published_at = datetime.now(timezone.utc)
        elif status == "archived":
            publication.archived_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(publication)
        return publication

    @staticmethod
    def delete_publication(db: Session, publication: ResearchPublication) -> None:
        db.delete(publication)
        db.commit()

    # ========================================================================
    # 2. AUTHORS
    # ========================================================================

    @staticmethod
    def list_authors(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        is_verified: Optional[bool] = None,
        department: Optional[str] = None,
    ) -> Tuple[int, List[ResearchAuthor]]:
        query = select(ResearchAuthor)

        if is_verified is not None:
            query = query.where(ResearchAuthor.is_verified == is_verified)
        if department:
            query = query.where(ResearchAuthor.department.ilike(f"%{department.strip()}%"))
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    ResearchAuthor.full_name.ilike(search_pattern),
                    ResearchAuthor.scopus_id.ilike(search_pattern),
                    ResearchAuthor.department.ilike(search_pattern),
                )
            )

        count_stmt = select(func.count(ResearchAuthor.id))
        if is_verified is not None:
            count_stmt = count_stmt.where(ResearchAuthor.is_verified == is_verified)
        if department:
            count_stmt = count_stmt.where(ResearchAuthor.department.ilike(f"%{department.strip()}%"))
        if search:
            search_pattern = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    ResearchAuthor.full_name.ilike(search_pattern),
                    ResearchAuthor.scopus_id.ilike(search_pattern),
                    ResearchAuthor.department.ilike(search_pattern),
                )
            )

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(ResearchAuthor.full_name.asc())
            .offset(skip)
            .limit(limit)
        ).all()

        return total, list(items)

    @staticmethod
    def get_author_by_id(db: Session, author_id: uuid.UUID) -> Optional[ResearchAuthor]:
        return db.get(ResearchAuthor, author_id)

    @staticmethod
    def create_author(db: Session, data: AuthorCreate) -> ResearchAuthor:
        author = ResearchAuthor(
            full_name=data.full_name,
            scopus_id=data.scopus_id,
            department=data.department,
            institutional_affiliation=data.institutional_affiliation,
            user_id=data.user_id,
            is_verified=data.is_verified,
            verification_notes=data.verification_notes,
        )
        db.add(author)
        db.commit()
        db.refresh(author)
        return author

    @staticmethod
    def update_author(db: Session, author: ResearchAuthor, data: AuthorUpdate) -> ResearchAuthor:
        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(author, key, value)
        db.commit()
        db.refresh(author)
        return author

    @staticmethod
    def verify_author(
        db: Session, author: ResearchAuthor, data: AuthorVerificationUpdate
    ) -> ResearchAuthor:
        author.is_verified = data.is_verified
        if data.scopus_id is not None:
            author.scopus_id = data.scopus_id
        if data.verification_notes is not None:
            author.verification_notes = data.verification_notes
        db.commit()
        db.refresh(author)
        return author

    @staticmethod
    def delete_author(db: Session, author: ResearchAuthor) -> None:
        db.delete(author)
        db.commit()

    # ========================================================================
    # 3. RESEARCH BULLETINS
    # ========================================================================

    @staticmethod
    def list_bulletins(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> Tuple[int, List[ResearchBulletin]]:
        query = select(ResearchBulletin)

        if status:
            query = query.where(ResearchBulletin.status == status)
        if is_active is not None:
            query = query.where(ResearchBulletin.is_active == is_active)

        count_stmt = select(func.count(ResearchBulletin.id))
        if status:
            count_stmt = count_stmt.where(ResearchBulletin.status == status)
        if is_active is not None:
            count_stmt = count_stmt.where(ResearchBulletin.is_active == is_active)

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(ResearchBulletin.volume_number.desc(), ResearchBulletin.issue_number.desc())
            .offset(skip)
            .limit(limit)
        ).all()

        return total, list(items)

    @staticmethod
    def get_bulletin_by_id(db: Session, bulletin_id: uuid.UUID) -> Optional[ResearchBulletin]:
        return db.get(ResearchBulletin, bulletin_id)

    @staticmethod
    def create_bulletin(db: Session, data: BulletinCreate) -> ResearchBulletin:
        published_at = datetime.now(timezone.utc) if data.status == "published" else None
        bulletin = ResearchBulletin(
            volume_number=data.volume_number,
            issue_number=data.issue_number,
            title=data.title,
            publication_period=data.publication_period,
            file_path=data.file_path,
            file_size_bytes=data.file_size_bytes,
            checksum_sha256=data.checksum_sha256,
            publication_count=data.publication_count,
            is_active=data.is_active,
            status=data.status,
            published_at=published_at,
        )
        db.add(bulletin)
        db.commit()
        db.refresh(bulletin)
        return bulletin

    @staticmethod
    def update_bulletin(
        db: Session, bulletin: ResearchBulletin, data: BulletinUpdate
    ) -> ResearchBulletin:
        update_dict = data.model_dump(exclude_unset=True)
        if "status" in update_dict and update_dict["status"] != bulletin.status:
            if update_dict["status"] == "published" and not bulletin.published_at:
                bulletin.published_at = datetime.now(timezone.utc)
            elif update_dict["status"] == "archived":
                bulletin.archived_at = datetime.now(timezone.utc)

        for key, value in update_dict.items():
            setattr(bulletin, key, value)
        db.commit()
        db.refresh(bulletin)
        return bulletin

    @staticmethod
    def update_bulletin_status(
        db: Session, bulletin: ResearchBulletin, status: str, is_active: Optional[bool] = None
    ) -> ResearchBulletin:
        bulletin.status = status
        if is_active is not None:
            bulletin.is_active = is_active
        if status == "published" and not bulletin.published_at:
            bulletin.published_at = datetime.now(timezone.utc)
        elif status == "archived":
            bulletin.archived_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(bulletin)
        return bulletin

    @staticmethod
    def delete_bulletin(db: Session, bulletin: ResearchBulletin) -> None:
        db.delete(bulletin)
        db.commit()

    # ========================================================================
    # 4. CAM-AI PROJECTS
    # ========================================================================

    @staticmethod
    def list_cam_projects(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        category: Optional[str] = None,
        domain: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[int, List[CamAiProject]]:
        query = select(CamAiProject)

        if category:
            query = query.where(CamAiProject.category.ilike(category))
        if domain:
            query = query.where(CamAiProject.domain.ilike(f"%{domain.strip()}%"))
        if status:
            query = query.where(CamAiProject.status == status)
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.where(
                or_(
                    CamAiProject.title.ilike(search_pattern),
                    CamAiProject.domain.ilike(search_pattern),
                )
            )

        count_stmt = select(func.count(CamAiProject.id))
        if category:
            count_stmt = count_stmt.where(CamAiProject.category.ilike(category))
        if domain:
            count_stmt = count_stmt.where(CamAiProject.domain.ilike(f"%{domain.strip()}%"))
        if status:
            count_stmt = count_stmt.where(CamAiProject.status == status)
        if search:
            search_pattern = f"%{search.strip()}%"
            count_stmt = count_stmt.where(
                or_(
                    CamAiProject.title.ilike(search_pattern),
                    CamAiProject.domain.ilike(search_pattern),
                )
            )

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(CamAiProject.created_at.desc())
            .offset(skip)
            .limit(limit)
        ).all()

        return total, list(items)

    @staticmethod
    def get_cam_project_by_id(db: Session, project_id: uuid.UUID) -> Optional[CamAiProject]:
        return db.get(CamAiProject, project_id)

    @staticmethod
    def create_cam_project(db: Session, data: CamProjectCreate) -> CamAiProject:
        project = CamAiProject(
            legacy_project_id=data.legacy_project_id,
            category=data.category,
            domain=data.domain,
            title=data.title,
            funding_amount_inr=data.funding_amount_inr,
            funding_display=data.funding_display,
            status=data.status,
            principal_investigators=data.principal_investigators,
            co_investigators=data.co_investigators,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def update_cam_project(
        db: Session, project: CamAiProject, data: CamProjectUpdate
    ) -> CamAiProject:
        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(project, key, value)
        db.commit()
        db.refresh(project)
        return project

    @staticmethod
    def delete_cam_project(db: Session, project: CamAiProject) -> None:
        db.delete(project)
        db.commit()

    # ========================================================================
    # 5. FELICITATION CERTIFICATES
    # ========================================================================

    @staticmethod
    def list_certificates(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        bulletin_id: Optional[uuid.UUID] = None,
        author_id: Optional[uuid.UUID] = None,
        is_revoked: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[int, List[FelicitationCertificate]]:
        query = select(FelicitationCertificate)

        if bulletin_id:
            query = query.where(FelicitationCertificate.bulletin_id == bulletin_id)
        if author_id:
            query = query.where(FelicitationCertificate.author_id == author_id)
        if is_revoked is not None:
            query = query.where(FelicitationCertificate.is_revoked == is_revoked)
        if search:
            search_pattern = f"%{search.strip()}%"
            query = query.where(FelicitationCertificate.certificate_number.ilike(search_pattern))

        count_stmt = select(func.count(FelicitationCertificate.id))
        if bulletin_id:
            count_stmt = count_stmt.where(FelicitationCertificate.bulletin_id == bulletin_id)
        if author_id:
            count_stmt = count_stmt.where(FelicitationCertificate.author_id == author_id)
        if is_revoked is not None:
            count_stmt = count_stmt.where(FelicitationCertificate.is_revoked == is_revoked)
        if search:
            search_pattern = f"%{search.strip()}%"
            count_stmt = count_stmt.where(FelicitationCertificate.certificate_number.ilike(search_pattern))

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(FelicitationCertificate.issued_at.desc())
            .offset(skip)
            .limit(limit)
        ).all()

        return total, list(items)

    @staticmethod
    def get_certificate_by_id(db: Session, certificate_id: uuid.UUID) -> Optional[FelicitationCertificate]:
        return db.get(FelicitationCertificate, certificate_id)

    @staticmethod
    def get_certificate_by_number(db: Session, certificate_number: str) -> Optional[FelicitationCertificate]:
        stmt = select(FelicitationCertificate).where(
            FelicitationCertificate.certificate_number == certificate_number.strip()
        )
        return db.scalar(stmt)

    @staticmethod
    def issue_certificate(db: Session, data: CertificateIssueRequest) -> FelicitationCertificate:
        certificate = FelicitationCertificate(
            certificate_number=data.certificate_number,
            bulletin_id=data.bulletin_id,
            author_id=data.author_id,
            publication_id=data.publication_id,
            file_storage_path=data.file_storage_path,
            checksum_sha256=data.checksum_sha256,
        )
        db.add(certificate)
        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def revoke_certificate(
        db: Session, certificate: FelicitationCertificate, reason: str
    ) -> FelicitationCertificate:
        certificate.is_revoked = True
        certificate.revoked_at = datetime.now(timezone.utc)
        certificate.revocation_reason = reason
        db.commit()
        db.refresh(certificate)
        return certificate

    # ========================================================================
    # 6. RESEARCHER SPOTLIGHTS
    # ========================================================================

    @staticmethod
    def list_spotlights(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        is_active: Optional[bool] = None,
    ) -> Tuple[int, List[ResearcherSpotlight]]:
        query = select(ResearcherSpotlight)

        if is_active is not None:
            query = query.where(ResearcherSpotlight.is_active == is_active)

        count_stmt = select(func.count(ResearcherSpotlight.id))
        if is_active is not None:
            count_stmt = count_stmt.where(ResearcherSpotlight.is_active == is_active)

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(ResearcherSpotlight.display_order.asc(), ResearcherSpotlight.created_at.desc())
            .offset(skip)
            .limit(limit)
        ).all()

        return total, list(items)

    @staticmethod
    def get_spotlight_by_id(db: Session, spotlight_id: uuid.UUID) -> Optional[ResearcherSpotlight]:
        return db.get(ResearcherSpotlight, spotlight_id)

    @staticmethod
    def create_spotlight(db: Session, data: SpotlightCreate) -> ResearcherSpotlight:
        spotlight = ResearcherSpotlight(
            author_id=data.author_id,
            headline=data.headline,
            summary=data.summary,
            media_type=data.media_type,
            media_url=data.media_url,
            video_embed_url=data.video_embed_url,
            display_order=data.display_order,
            is_active=data.is_active,
        )
        db.add(spotlight)
        db.commit()
        db.refresh(spotlight)
        return spotlight

    @staticmethod
    def update_spotlight(
        db: Session, spotlight: ResearcherSpotlight, data: SpotlightUpdate
    ) -> ResearcherSpotlight:
        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(spotlight, key, value)
        db.commit()
        db.refresh(spotlight)
        return spotlight

    @staticmethod
    def delete_spotlight(db: Session, spotlight: ResearcherSpotlight) -> None:
        db.delete(spotlight)
        db.commit()


sama_cms_service = SamaCmsService()
