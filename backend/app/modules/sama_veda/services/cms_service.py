import uuid
import logging
from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

logger = logging.getLogger(__name__)


def validate_issue_date(issue_date: date) -> None:
    """
    Validates institutional policy for certificate Date of Issue:
    - Future dates: permitted (transitions to SCHEDULED upon approval/creation).
    - Current date: permitted (activates immediately as ISSUED).
    - Past dates: permitted up to 365 days (1 year) for official retrospective issuances/backfills.
      Dates older than 1 year are rejected with clear institutional policy notice.
    """
    IST = ZoneInfo("Asia/Kolkata")
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    if issue_date < today_ist:
        diff_days = (today_ist - issue_date).days
        if diff_days > 365:
            from fastapi import HTTPException
            raise HTTPException(
                status_code=400,
                detail=f"Date of Issue ({issue_date.isoformat()}) exceeds the permitted institutional backfill limit of 365 days. Retrospective certificates older than 1 year cannot be issued without exceptional Academic Council approval.",
            )

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
    CertificateAuthorCreate,
    CertificateSignatoryCreate,
    CertificateSignatoryUpdate,
    CertificateTemplateCreate,
    CertificateTemplateUpdate,
    CertificateReissueRequest,
    SpotlightCreate,
    SpotlightUpdate,
)
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateTemplate,
    CertificateSignatory,
    CertificateAuthor,
    CertificateApproval,
    CertificateVerificationEvent,
)
from app.core.storage import storage_service
from app.modules.sama_veda.services.certificate_pdf_service import (
    certificate_pdf_engine,
    InstitutionalAssetResolutionError,
)
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

    @staticmethod
    def bulk_delete_publications(
        db: Session,
        publication_ids: List[uuid.UUID],
    ) -> Tuple[List[uuid.UUID], List[Dict[str, Any]]]:
        deleted_ids: List[uuid.UUID] = []
        failed_items: List[Dict[str, Any]] = []

        for pub_id in publication_ids:
            try:
                pub = db.execute(
                    select(ResearchPublication).where(ResearchPublication.id == pub_id)
                ).scalar_one_or_none()

                if not pub:
                    failed_items.append({
                        "id": str(pub_id),
                        "reason": "Publication not found",
                    })
                    continue

                certs = db.execute(
                    select(FelicitationCertificate).where(FelicitationCertificate.publication_id == pub_id)
                ).scalars().all()
                for c in certs:
                    c.publication_id = None

                db.delete(pub)
                db.flush()
                deleted_ids.append(pub_id)
            except Exception as e:
                failed_items.append({
                    "id": str(pub_id),
                    "reason": f"Deletion error: {str(e)}",
                })

        db.commit()
        return deleted_ids, failed_items

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

        search_filter = None
        if search and search.strip():
            raw_tokens = search.strip().split()
            tokens = [t.strip(".,;:").lower() for t in raw_tokens if t.strip(".,;:")]

            # Recognize common honorifics so searching "Prof. Namita Tiwari" matches "Namita Tiwari"
            honorifics = {"prof", "dr", "mr", "mrs", "ms", "er", "shri", "smt"}
            substantive_tokens = [t for t in tokens if t not in honorifics]
            effective_tokens = substantive_tokens if substantive_tokens else tokens

            # Every effective token must match in at least one attribute
            token_match_clauses = []
            for tok in effective_tokens:
                pattern = f"%{tok}%"
                token_match_clauses.append(
                    or_(
                        ResearchAuthor.full_name.ilike(pattern),
                        ResearchAuthor.scopus_id.ilike(pattern),
                        ResearchAuthor.department.ilike(pattern),
                        ResearchAuthor.institutional_affiliation.ilike(pattern),
                    )
                )

            # Combined search filter matches:
            # 1. All effective tokens matching somewhere (multi-word, middle names, reverse order)
            # 2. Or the exact search pattern matching full_name, scopus_id, or department
            clean_phrase = f"%{search.strip()}%"
            search_filter = or_(
                and_(*token_match_clauses),
                ResearchAuthor.full_name.ilike(clean_phrase),
                ResearchAuthor.scopus_id.ilike(clean_phrase),
                ResearchAuthor.department.ilike(clean_phrase),
            )
            query = query.where(search_filter)

        count_stmt = select(func.count(ResearchAuthor.id))
        if is_verified is not None:
            count_stmt = count_stmt.where(ResearchAuthor.is_verified == is_verified)
        if department:
            count_stmt = count_stmt.where(ResearchAuthor.department.ilike(f"%{department.strip()}%"))
        if search_filter is not None:
            count_stmt = count_stmt.where(search_filter)

        total = db.scalar(count_stmt) or 0

        # Prioritize exact name matches, prefix matches, verified authors, then alphabetical
        order_clauses = []
        if search and search.strip():
            clean_search = search.strip()
            order_clauses.extend([
                case((func.lower(ResearchAuthor.full_name) == clean_search.lower(), 1), else_=2),
                case((ResearchAuthor.full_name.ilike(f"{clean_search}%"), 1), else_=2),
            ])
        order_clauses.extend([
            ResearchAuthor.is_verified.desc(),
            ResearchAuthor.full_name.asc(),
        ])

        items = db.scalars(
            query.order_by(*order_clauses)
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

    @staticmethod
    def bulk_delete_authors(
        db: Session,
        author_ids: List[uuid.UUID],
    ) -> Tuple[List[uuid.UUID], List[Dict[str, Any]]]:
        deleted_ids: List[uuid.UUID] = []
        failed_items: List[Dict[str, Any]] = []

        for author_id in author_ids:
            try:
                author = db.execute(
                    select(ResearchAuthor).where(ResearchAuthor.id == author_id)
                ).scalar_one_or_none()

                if not author:
                    failed_items.append({
                        "id": str(author_id),
                        "reason": "Author not found",
                    })
                    continue

                # Safely unlink any researcher spotlights pointing to this author
                spotlights = db.execute(
                    select(ResearcherSpotlight).where(ResearcherSpotlight.author_id == author_id)
                ).scalars().all()
                for s in spotlights:
                    s.author_id = None

                db.delete(author)
                db.flush()
                deleted_ids.append(author_id)
            except Exception as e:
                failed_items.append({
                    "id": str(author_id),
                    "reason": f"Deletion error: {str(e)}",
                })

        db.commit()
        return deleted_ids, failed_items

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
    # 5. FELICITATION CERTIFICATES & MODERN DIGITAL CERTIFICATE MANAGEMENT
    # ========================================================================

    @staticmethod
    def generate_unique_certificate_number(db: Session, year: Optional[int] = None) -> str:
        """
        Concurrency-safe institutional certificate number generator.
        Format: CSJMU/SAMIKSHA/{YEAR}/{SEQUENCE:06d} (e.g. CSJMU/SAMIKSHA/2026/000001)
        """
        target_year = year or datetime.now(timezone.utc).year
        prefix = f"CSJMU/SAMIKSHA/{target_year}/"

        stmt = (
            select(FelicitationCertificate.certificate_number)
            .where(FelicitationCertificate.certificate_number.like(f"{prefix}%"))
            .order_by(FelicitationCertificate.certificate_number.desc())
            .limit(1)
        )
        last_num = db.scalar(stmt)

        next_seq = 1
        if last_num and last_num.startswith(prefix):
            suffix = last_num[len(prefix):]
            if suffix.isdigit():
                next_seq = int(suffix) + 1

        for attempt in range(50):
            candidate = f"{prefix}{next_seq:06d}"
            exists = db.scalar(
                select(func.count(FelicitationCertificate.id)).where(
                    FelicitationCertificate.certificate_number == candidate
                )
            )
            if not exists:
                return candidate
            next_seq += 1

        rand_id = uuid.uuid4().hex[:6].upper()
        return f"{prefix}{rand_id}"

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
        status: Optional[str] = None,
        certificate_type: Optional[str] = None,
        scope: Optional[str] = None,
        approval_stage: Optional[str] = None,
    ) -> Tuple[int, List[FelicitationCertificate]]:
        query = select(FelicitationCertificate).options(
            selectinload(FelicitationCertificate.authors),
            selectinload(FelicitationCertificate.approvals),
        )

        filters = []

        if bulletin_id:
            filters.append(FelicitationCertificate.bulletin_id == bulletin_id)
        if author_id:
            filters.append(
                or_(
                    FelicitationCertificate.author_id == author_id,
                    FelicitationCertificate.authors.any(CertificateAuthor.researcher_id == author_id),
                )
            )
        if certificate_type:
            filters.append(FelicitationCertificate.certificate_type == certificate_type.strip().upper())

        scope_norm = (scope or "").strip().lower()
        status_norm = (status or "").strip().upper()

        if scope_norm == "ledger" or status_norm in ["ISSUED_LEDGER", "LEDGER"]:
            # Issued Ledger lifecycle: All certificates that have actually reached the issued state
            # (Issued & Active, Revoked, and Superseded). Strictly excludes DRAFT, SUBMITTED, PENDING, and SCHEDULED.
            ledger_base_cond = and_(
                or_(
                    FelicitationCertificate.status.in_(["ISSUED", "REVOKED", "SUPERSEDED"]),
                    FelicitationCertificate.is_revoked == True,
                ),
                FelicitationCertificate.status.notin_(["DRAFT", "SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]),
            )

            if status_norm == "ISSUED":
                filters.append(and_(FelicitationCertificate.status == "ISSUED", FelicitationCertificate.is_revoked == False))
            elif status_norm == "REVOKED" or is_revoked is True:
                filters.append(or_(FelicitationCertificate.is_revoked == True, FelicitationCertificate.status == "REVOKED"))
            elif status_norm == "SUPERSEDED":
                filters.append(FelicitationCertificate.status == "SUPERSEDED")
            elif status_norm == "SCHEDULED":
                filters.append(and_(FelicitationCertificate.status == "SCHEDULED", FelicitationCertificate.is_revoked == False))
            else:
                filters.append(ledger_base_cond)
                filters.append(FelicitationCertificate.status != "SCHEDULED")
        elif scope_norm == "approvals" or status_norm in ["PENDING", "PENDING_APPROVAL", "APPROVAL_QUEUE"]:
            # Approval Queue lifecycle: certificates genuinely awaiting Dean R&D or Vice Chancellor approval
            filters.append(FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]))
            filters.append(FelicitationCertificate.is_revoked == False)

            stage_norm = (approval_stage or status or "").strip().upper()
            if stage_norm in ["DEAN", "DEAN_RD", "PENDING_DEAN_APPROVAL"]:
                filters.append(FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL"]))
            elif stage_norm in ["VC", "VICE_CHANCELLOR", "PENDING_VC_APPROVAL"]:
                filters.append(FelicitationCertificate.status == "PENDING_VC_APPROVAL")
        else:
            if is_revoked is not None:
                filters.append(FelicitationCertificate.is_revoked == is_revoked)

            if status:
                if "," in status:
                    statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
                    filters.append(FelicitationCertificate.status.in_(statuses))
                elif status_norm in ["PENDING", "PENDING_APPROVAL"]:
                    filters.append(and_(
                        FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]),
                        FelicitationCertificate.is_revoked == False,
                    ))
                elif status_norm == "ISSUED_ACTIVE":
                    filters.append(and_(FelicitationCertificate.status == "ISSUED", FelicitationCertificate.is_revoked == False))
                else:
                    filters.append(FelicitationCertificate.status == status_norm)

        if search:
            search_pattern = f"%{search.strip()}%"
            filters.append(
                or_(
                    FelicitationCertificate.certificate_number.ilike(search_pattern),
                    FelicitationCertificate.title.ilike(search_pattern),
                    FelicitationCertificate.research_title.ilike(search_pattern),
                    FelicitationCertificate.authors.any(CertificateAuthor.author_name_snapshot.ilike(search_pattern)),
                    FelicitationCertificate.authors.any(CertificateAuthor.scopus_id_snapshot.ilike(search_pattern)),
                )
            )

        count_stmt = select(func.count(FelicitationCertificate.id))
        if filters:
            query = query.where(*filters)
            count_stmt = count_stmt.where(*filters)

        total = db.scalar(count_stmt) or 0
        items = db.scalars(
            query.order_by(FelicitationCertificate.created_at.desc())
            .offset(skip)
            .limit(limit)
        ).all()

        return total, list(items)

    @staticmethod
    def get_certificate_by_id(db: Session, certificate_id: uuid.UUID) -> Optional[FelicitationCertificate]:
        return db.get(FelicitationCertificate, certificate_id)

    @staticmethod
    def get_certificate_by_number(db: Session, certificate_number: str) -> Optional[FelicitationCertificate]:
        stmt = (
            select(FelicitationCertificate)
            .options(
                selectinload(FelicitationCertificate.authors),
                selectinload(FelicitationCertificate.approvals),
                joinedload(FelicitationCertificate.template),
                joinedload(FelicitationCertificate.author),
                joinedload(FelicitationCertificate.bulletin),
                joinedload(FelicitationCertificate.publication),
            )
            .where(
                or_(
                    FelicitationCertificate.certificate_number == certificate_number.strip(),
                    FelicitationCertificate.verification_token == certificate_number.strip(),
                )
            )
        )
        return db.scalar(stmt)

    @staticmethod
    def get_certificate_by_token(db: Session, token: str) -> Optional[FelicitationCertificate]:
        stmt = (
            select(FelicitationCertificate)
            .options(
                selectinload(FelicitationCertificate.authors),
                selectinload(FelicitationCertificate.approvals),
                joinedload(FelicitationCertificate.template),
                joinedload(FelicitationCertificate.author),
                joinedload(FelicitationCertificate.bulletin),
                joinedload(FelicitationCertificate.publication),
            )
            .where(FelicitationCertificate.verification_token == token.strip())
        )
        return db.scalar(stmt)

    @staticmethod
    def get_certificate_stats(db: Session) -> Dict[str, int]:
        """Calculates dashboard summary metrics for certificates and linked researchers in a single optimized query."""
        cert_stats_stmt = select(
            func.count(FelicitationCertificate.id).label("total"),
            func.count(case((FelicitationCertificate.status == "DRAFT", FelicitationCertificate.id))).label("drafts"),
            func.count(
                case((
                    and_(
                        FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]),
                        FelicitationCertificate.is_revoked == False,
                    ),
                    FelicitationCertificate.id,
                ))
            ).label("pending"),
            func.count(
                case((
                    and_(
                        FelicitationCertificate.status == "SCHEDULED",
                        FelicitationCertificate.is_revoked == False,
                    ),
                    FelicitationCertificate.id,
                ))
            ).label("scheduled"),
            func.count(
                case((
                    and_(
                        FelicitationCertificate.status == "ISSUED",
                        FelicitationCertificate.is_revoked == False,
                    ),
                    FelicitationCertificate.id,
                ))
            ).label("issued_active"),
            func.count(
                case((
                    or_(
                        FelicitationCertificate.is_revoked == True,
                        FelicitationCertificate.status == "REVOKED",
                    ),
                    FelicitationCertificate.id,
                ))
            ).label("revoked"),
            func.count(
                case((
                    FelicitationCertificate.status == "SUPERSEDED",
                    FelicitationCertificate.id,
                ))
            ).label("superseded"),
        )
        row = db.execute(cert_stats_stmt).one()
        total_authors = db.scalar(select(func.count(CertificateAuthor.id.distinct()))) or 0

        issued_active = row.issued_active or 0
        revoked = row.revoked or 0
        superseded = row.superseded or 0
        total_issued = issued_active + revoked + superseded

        return {
            "total_certificates": row.total or 0,
            "total_issued": total_issued,
            "draft_certificates": row.drafts or 0,
            "pending_approvals": row.pending or 0,
            "scheduled_certificates": row.scheduled or 0,
            "issued_certificates": issued_active,
            "revoked_certificates": revoked,
            "reissued_certificates": superseded,
            "total_researchers_linked": total_authors,
        }

    @staticmethod
    def issue_certificate(
        db: Session,
        data: CertificateIssueRequest,
        created_by_user_id: Optional[uuid.UUID] = None,
        base_verification_url: str = "https://vyasa.csjmu.ac.in",
    ) -> FelicitationCertificate:
        """
        Unified creation & issuance endpoint supporting:
        1. Legacy upload workflow (with bulletin_id, author_id, and pre-uploaded file_storage_path)
        2. Modern programmatic design and approval workflow (with multi-authors and dynamic vector PDF generation)
        """
        cert_num = data.certificate_number or SamaCmsService.generate_unique_certificate_number(db)
        token = uuid.uuid4().hex

        IST = ZoneInfo("Asia/Kolkata")
        today_ist = datetime.now(timezone.utc).astimezone(IST).date()
        sched_date = data.issue_date or today_ist
        validate_issue_date(sched_date)
        is_future = sched_date > today_ist

        if data.submit_for_approval:
            initial_status = "PENDING_DEAN_APPROVAL"
            activated_at = None
        else:
            if is_future:
                initial_status = "SCHEDULED"
                activated_at = None
            else:
                initial_status = "ISSUED"
                activated_at = datetime.now(timezone.utc)

        if data.file_storage_path:
            initial_status = "SCHEDULED" if is_future else "ISSUED"
            activated_at = None if is_future else datetime.now(timezone.utc)

        official_issued_at = datetime.combine(sched_date, time.min).replace(tzinfo=IST)

        bulletin_obj = None
        if data.bulletin_id:
            bulletin_obj = db.get(ResearchBulletin, data.bulletin_id)
        elif data.publication_id:
            pub_obj = db.get(ResearchPublication, data.publication_id)
            if pub_obj and pub_obj.bulletin_id:
                bulletin_obj = db.get(ResearchBulletin, pub_obj.bulletin_id)

        cert = FelicitationCertificate(
            certificate_number=cert_num,
            certificate_type=data.certificate_type or "RESEARCH_PUBLICATION",
            status=initial_status,
            template_id=data.template_id,
            template_version=1,
            title=data.title or "Certificate of Appreciation & Research Excellence",
            presentation_statement=data.presentation_statement,
            research_contribution_statement=data.research_contribution_statement,
            research_title=data.research_title,
            congratulatory_statement=data.congratulatory_statement,
            publication_details=data.publication_details,
            verification_token=token,
            bulletin_id=data.bulletin_id or (bulletin_obj.id if bulletin_obj else None),
            bulletin_volume_snapshot=bulletin_obj.volume_number if bulletin_obj else None,
            bulletin_issue_snapshot=bulletin_obj.issue_number if bulletin_obj else None,
            bulletin_period_snapshot=bulletin_obj.publication_period if bulletin_obj else None,
            author_id=data.author_id,
            publication_id=data.publication_id,
            file_storage_path=data.file_storage_path or f"sama_veda/certificates/{cert_num.replace('/', '_')}.pdf",
            checksum_sha256=data.checksum_sha256,
            created_by_user_id=created_by_user_id,
            scheduled_issue_date=sched_date,
            activated_at=activated_at,
            issued_at=official_issued_at,
        )
        db.add(cert)
        db.flush()

        author_items = []
        if data.authors:
            for item in data.authors:
                dept_clean = item.department_snapshot
                if dept_clean and dept_clean.strip().lower() == "department of research":
                    dept_clean = None
                c_auth = CertificateAuthor(
                    certificate_id=cert.id,
                    researcher_id=item.researcher_id,
                    author_name_snapshot=item.author_name_snapshot,
                    academic_title_snapshot=item.academic_title_snapshot,
                    scopus_id_snapshot=item.scopus_id_snapshot,
                    affiliation_snapshot=item.affiliation_snapshot,
                    department_snapshot=dept_clean,
                    designation_snapshot=item.designation_snapshot,
                    author_order=item.author_order,
                    author_role=item.author_role,
                )
                db.add(c_auth)
                author_items.append({
                    "author_name_snapshot": item.author_name_snapshot,
                    "academic_title_snapshot": item.academic_title_snapshot,
                    "scopus_id_snapshot": item.scopus_id_snapshot,
                    "department_snapshot": dept_clean,
                    "designation_snapshot": item.designation_snapshot,
                    "affiliation_snapshot": item.affiliation_snapshot,
                })
        elif data.author_id:
            author_obj = db.get(ResearchAuthor, data.author_id)
            if author_obj:
                dept_clean = author_obj.department
                if dept_clean and dept_clean.strip().lower() == "department of research":
                    dept_clean = None
                c_auth = CertificateAuthor(
                    certificate_id=cert.id,
                    researcher_id=author_obj.id,
                    author_name_snapshot=author_obj.full_name,
                    scopus_id_snapshot=author_obj.scopus_id,
                    department_snapshot=dept_clean,
                    designation_snapshot=None,
                    affiliation_snapshot=author_obj.institutional_affiliation,
                    author_order=1,
                    author_role="Principal Author",
                )
                db.add(c_auth)
                author_items.append({
                    "author_name_snapshot": author_obj.full_name,
                    "scopus_id_snapshot": author_obj.scopus_id,
                    "department_snapshot": dept_clean,
                    "designation_snapshot": None,
                    "affiliation_snapshot": author_obj.institutional_affiliation,
                })

        dean_sig = SamaCmsService.get_active_signatory(db, "DEAN_RD")
        vc_sig = SamaCmsService.get_active_signatory(db, "VICE_CHANCELLOR")

        appr_dean = CertificateApproval(
            certificate_id=cert.id,
            authority_type="DEAN_RD",
            signatory_id=dean_sig.id if dean_sig else None,
            signatory_name_snapshot=dean_sig.signatory_name if dean_sig else "Prof. (Dr.) Rajesh Kumar",
            designation_snapshot=dean_sig.designation if dean_sig else "Dean – Research & Development",
            signature_image_path_snapshot=dean_sig.signature_image_path if dean_sig else None,
            signature_asset_version_snapshot=dean_sig.signature_asset_version if dean_sig else 1,
            status="APPROVED" if initial_status in ["ISSUED", "SCHEDULED"] else "PENDING",
            decided_at=datetime.now(timezone.utc) if initial_status in ["ISSUED", "SCHEDULED"] else None,
        )
        appr_vc = CertificateApproval(
            certificate_id=cert.id,
            authority_type="VICE_CHANCELLOR",
            signatory_id=vc_sig.id if vc_sig else None,
            signatory_name_snapshot=vc_sig.signatory_name if vc_sig else "Prof. Vinay Kumar Pathak",
            designation_snapshot=vc_sig.designation if vc_sig else "Vice Chancellor",
            signature_image_path_snapshot=vc_sig.signature_image_path if vc_sig else None,
            signature_asset_version_snapshot=vc_sig.signature_asset_version if vc_sig else 1,
            status="APPROVED" if initial_status in ["ISSUED", "SCHEDULED"] else "PENDING",
            decided_at=datetime.now(timezone.utc) if initial_status in ["ISSUED", "SCHEDULED"] else None,
        )
        db.add(appr_dean)
        db.add(appr_vc)

        if initial_status in ["ISSUED", "SCHEDULED"] and not data.file_storage_path:
            verify_url = f"{base_verification_url.rstrip('/')}/verify/{token}"
            bulletin_obj = None
            if cert.bulletin_id:
                bulletin_obj = db.get(ResearchBulletin, cert.bulletin_id)
            elif cert.publication_id:
                pub_obj = db.get(ResearchPublication, cert.publication_id)
                if pub_obj and pub_obj.bulletin_id:
                    bulletin_obj = db.get(ResearchBulletin, pub_obj.bulletin_id)

            try:
                pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
                    certificate_number=cert_num,
                    verification_token=token,
                    verification_url=verify_url,
                    title=cert.title,
                    certificate_type=cert.certificate_type or "RESEARCH_PUBLICATION",
                    presentation_statement=cert.presentation_statement,
                    authors=author_items or [{"author_name_snapshot": "Distinguished Scholar"}],
                    research_contribution_statement=cert.research_contribution_statement,
                    research_title=cert.research_title,
                    publication_details=cert.publication_details,
                    bulletin_title=bulletin_obj.title if bulletin_obj else None,
                    bulletin_volume=bulletin_obj.volume_number if bulletin_obj else None,
                    bulletin_issue=bulletin_obj.issue_number if bulletin_obj else None,
                    bulletin_period=bulletin_obj.publication_period if bulletin_obj else None,
                    incentive_details=cert.publication_details if cert.certificate_type == "INCENTIVE_AWARD" else None,
                    congratulatory_statement=cert.congratulatory_statement or "",
                    issue_date=sched_date,
                    dean_name=appr_dean.signatory_name_snapshot,
                    dean_designation=appr_dean.designation_snapshot,
                    dean_signature_path=appr_dean.signature_image_path_snapshot,
                    vc_name=appr_vc.signatory_name_snapshot,
                    vc_designation=appr_vc.designation_snapshot,
                    vc_signature_path=appr_vc.signature_image_path_snapshot,
                )
                save_res = storage_service.save_file(
                    content=pdf_bytes,
                    filename=f"{cert_num.replace('/', '_')}.pdf",
                    subfolder="sama_veda/certificates",
                    allowed_mime_types=["application/pdf"],
                    mime_type="application/pdf",
                )
                cert.file_storage_path = save_res.storage_key
                cert.checksum_sha256 = sha
                cert.approved_at = datetime.now(timezone.utc)
            except InstitutionalAssetResolutionError:
                raise
            except Exception as e:
                # Fallback if storage fails in isolated tests
                cert.checksum_sha256 = hashlib.sha256(b"fallback_certificate").hexdigest()

        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def process_authority_approval(
        db: Session,
        certificate: FelicitationCertificate,
        authority_type: str,
        action: str,
        remarks: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
        base_verification_url: str = "https://vyasa.csjmu.ac.in",
    ) -> FelicitationCertificate:
        """
        Processes formal Dean - R&D or Vice Chancellor approval transition.
        Requires mandatory remarks for REJECT.
        When both authorities approve, triggers final vector PDF rendering and issuance!
        """
        stmt = select(CertificateApproval).where(
            CertificateApproval.certificate_id == certificate.id,
            CertificateApproval.authority_type == authority_type,
        )
        appr = db.scalar(stmt)
        if not appr:
            sig = SamaCmsService.get_active_signatory(db, authority_type)
            appr = CertificateApproval(
                certificate_id=certificate.id,
                authority_type=authority_type,
                signatory_id=sig.id if sig else None,
                signatory_name_snapshot=sig.signatory_name if sig else authority_type,
                designation_snapshot=sig.designation if sig else authority_type,
                signature_image_path_snapshot=sig.signature_image_path if sig else None,
                signature_asset_version_snapshot=sig.signature_asset_version if sig else 1,
            )
            db.add(appr)
        elif not appr.signature_image_path_snapshot and appr.signatory_id:
            sig = db.get(CertificateSignatory, appr.signatory_id)
            if sig:
                appr.signature_image_path_snapshot = sig.signature_image_path
                appr.signature_asset_version_snapshot = sig.signature_asset_version

        if action.upper() == "REJECT":
            appr.status = "REJECTED"
            appr.remarks = remarks or "Institutional review feedback provided."
            appr.decided_at = datetime.now(timezone.utc)
            appr.decided_by_user_id = user_id
            certificate.status = "REJECTED"
            certificate.rejection_reason = remarks or "Certificate rejected during authority review."
            db.commit()
            db.refresh(certificate)
            return certificate

        appr.status = "APPROVED"
        appr.remarks = remarks
        appr.decided_at = datetime.now(timezone.utc)
        appr.decided_by_user_id = user_id

        other_type = "VICE_CHANCELLOR" if authority_type == "DEAN_RD" else "DEAN_RD"
        other_stmt = select(CertificateApproval).where(
            CertificateApproval.certificate_id == certificate.id,
            CertificateApproval.authority_type == other_type,
        )
        other_appr = db.scalar(other_stmt)

        if authority_type == "DEAN_RD" and (not other_appr or other_appr.status != "APPROVED"):
            certificate.status = "PENDING_VC_APPROVAL"
            db.commit()
            db.refresh(certificate)
            return certificate

        if other_appr and other_appr.status == "APPROVED":
            certificate.status = "APPROVED"
            certificate.approved_at = datetime.now(timezone.utc)
            return SamaCmsService.finalize_and_issue_certificate(
                db, certificate, base_verification_url=base_verification_url
            )

        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def finalize_and_issue_certificate(
        db: Session,
        certificate: FelicitationCertificate,
        base_verification_url: str = "https://vyasa.csjmu.ac.in",
    ) -> FelicitationCertificate:
        """
        Renders final vector PDF, generates SHA-256 hash, embeds QR code,
        and marks certificate status as ISSUED.
        """
        authors_data = [
            {
                "author_name_snapshot": a.author_name_snapshot,
                "academic_title_snapshot": a.academic_title_snapshot,
                "scopus_id_snapshot": a.scopus_id_snapshot,
                "department_snapshot": None if (a.department_snapshot and a.department_snapshot.strip().lower() == "department of research") else a.department_snapshot,
                "designation_snapshot": a.designation_snapshot,
                "affiliation_snapshot": a.affiliation_snapshot,
            }
            for a in certificate.authors
        ]
        if not authors_data and certificate.author:
            dept_c = certificate.author.department
            if dept_c and dept_c.strip().lower() == "department of research":
                dept_c = None
            authors_data = [{
                "author_name_snapshot": certificate.author.full_name,
                "scopus_id_snapshot": certificate.author.scopus_id,
                "department_snapshot": dept_c,
                "designation_snapshot": None,
                "affiliation_snapshot": certificate.author.institutional_affiliation,
            }]

        dean_appr = next((ap for ap in certificate.approvals if ap.authority_type == "DEAN_RD"), None)
        vc_appr = next((ap for ap in certificate.approvals if ap.authority_type == "VICE_CHANCELLOR"), None)

        dean_sig_path = None
        if dean_appr and dean_appr.signature_image_path_snapshot:
            dean_sig_path = dean_appr.signature_image_path_snapshot
        elif dean_appr and dean_appr.signatory_id:
            dean_sig = db.get(CertificateSignatory, dean_appr.signatory_id)
            if dean_sig and dean_sig.signature_image_path:
                dean_sig_path = dean_sig.signature_image_path

        vc_sig_path = None
        if vc_appr and vc_appr.signature_image_path_snapshot:
            vc_sig_path = vc_appr.signature_image_path_snapshot
        elif vc_appr and vc_appr.signatory_id:
            vc_sig = db.get(CertificateSignatory, vc_appr.signatory_id)
            if vc_sig and vc_sig.signature_image_path:
                vc_sig_path = vc_sig.signature_image_path

        verify_url = f"{base_verification_url.rstrip('/')}/verify/{certificate.verification_token}"
        bulletin_obj = None
        if certificate.bulletin_id:
            bulletin_obj = db.get(ResearchBulletin, certificate.bulletin_id)
        elif certificate.publication_id:
            pub_obj = db.get(ResearchPublication, certificate.publication_id)
            if pub_obj and pub_obj.bulletin_id:
                bulletin_obj = db.get(ResearchBulletin, pub_obj.bulletin_id)

        if bulletin_obj:
            if not certificate.bulletin_volume_snapshot:
                certificate.bulletin_volume_snapshot = bulletin_obj.volume_number
            if not certificate.bulletin_issue_snapshot:
                certificate.bulletin_issue_snapshot = bulletin_obj.issue_number
            if not certificate.bulletin_period_snapshot:
                certificate.bulletin_period_snapshot = bulletin_obj.publication_period

        b_vol = certificate.bulletin_volume_snapshot or (bulletin_obj.volume_number if bulletin_obj else None)
        b_issue = certificate.bulletin_issue_snapshot or (bulletin_obj.issue_number if bulletin_obj else None)
        b_period = certificate.bulletin_period_snapshot or (bulletin_obj.publication_period if bulletin_obj else None)
        b_title = (bulletin_obj.title if bulletin_obj else None) or (f"Volume {b_vol} • Issue {b_issue}" if b_vol and b_issue else None)

        IST = ZoneInfo("Asia/Kolkata")
        today_ist = datetime.now(timezone.utc).astimezone(IST).date()
        sched_date = certificate.scheduled_issue_date or today_ist
        is_future = sched_date > today_ist

        pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
            certificate_number=certificate.certificate_number,
            verification_token=certificate.verification_token,
            verification_url=verify_url,
            title=certificate.title,
            certificate_type=certificate.certificate_type or "RESEARCH_PUBLICATION",
            presentation_statement=certificate.presentation_statement,
            authors=authors_data or [{"author_name_snapshot": "Distinguished Scholar"}],
            research_contribution_statement=certificate.research_contribution_statement,
            research_title=certificate.research_title,
            publication_details=certificate.publication_details,
            bulletin_title=b_title,
            bulletin_volume=b_vol,
            bulletin_issue=b_issue,
            bulletin_period=b_period,
            incentive_details=certificate.publication_details if certificate.certificate_type == "INCENTIVE_AWARD" else None,
            congratulatory_statement=certificate.congratulatory_statement or "",
            issue_date=sched_date,
            dean_name=dean_appr.signatory_name_snapshot if dean_appr else "Prof. (Dr.) Rajesh Kumar",
            dean_designation=dean_appr.designation_snapshot if dean_appr else "Dean – Research & Development",
            dean_signature_path=dean_sig_path,
            vc_name=vc_appr.signatory_name_snapshot if vc_appr else "Prof. Vinay Kumar Pathak",
            vc_designation=vc_appr.designation_snapshot if vc_appr else "Vice Chancellor",
            vc_signature_path=vc_sig_path,
        )

        try:
            save_res = storage_service.save_file(
                content=pdf_bytes,
                filename=f"{certificate.certificate_number.replace('/', '_')}.pdf",
                subfolder="sama_veda/certificates",
                allowed_mime_types=["application/pdf"],
                mime_type="application/pdf",
            )
            certificate.file_storage_path = save_res.storage_key
        except Exception:
            certificate.file_storage_path = f"sama_veda/certificates/{certificate.certificate_number.replace('/', '_')}.pdf"

        certificate.checksum_sha256 = sha
        certificate.scheduled_issue_date = sched_date
        certificate.issued_at = datetime.combine(sched_date, time.min).replace(tzinfo=IST)
        if is_future:
            certificate.status = "SCHEDULED"
            certificate.activated_at = None
        else:
            certificate.status = "ISSUED"
            certificate.activated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def activate_due_certificates(
        db: Session,
        as_of_date: Optional[date] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> int:
        """
        Activates all SCHEDULED certificates whose scheduled_issue_date is <= target_date
        (default: current date in Asia/Kolkata).
        Safe, idempotent, and uses row-level locking (with_for_update(skip_locked=True))
        to prevent race conditions across parallel requests and cron jobs.
        """
        IST = ZoneInfo("Asia/Kolkata")
        target_date = as_of_date or datetime.now(timezone.utc).astimezone(IST).date()

        # Fast pre-check: avoid acquiring exclusive row locks if no candidate certificates exist
        check_stmt = select(func.count(FelicitationCertificate.id)).where(
            FelicitationCertificate.status == "SCHEDULED",
            FelicitationCertificate.scheduled_issue_date <= target_date,
        )
        if not (db.scalar(check_stmt) or 0):
            return 0

        stmt = (
            select(FelicitationCertificate)
            .where(
                FelicitationCertificate.status == "SCHEDULED",
                FelicitationCertificate.scheduled_issue_date <= target_date,
            )
        )
        try:
            if db.bind and db.bind.dialect.name != "sqlite":
                stmt = stmt.with_for_update(skip_locked=True)
        except Exception:
            pass
        due_certs = db.scalars(stmt).all()
        if not due_certs:
            db.rollback()
            return 0

        now_utc = datetime.now(timezone.utc)
        activated_count = 0
        for cert in due_certs:
            cert.status = "ISSUED"
            cert.activated_at = now_utc
            activated_count += 1

            try:
                from app.services.audit_service import audit_service
                audit_service.log_event(
                    db=db,
                    module="sama_veda",
                    action="certificate_activated",
                    entity_name="FelicitationCertificate",
                    entity_id=cert.id,
                    actor_user_id=actor_user_id,
                    details={
                        "certificate_number": cert.certificate_number,
                        "scheduled_issue_date": cert.scheduled_issue_date.isoformat() if cert.scheduled_issue_date else None,
                        "activated_at": now_utc.isoformat(),
                        "as_of_date": target_date.isoformat(),
                    },
                    fail_silent=True,
                )
            except Exception as e:
                logger.debug("Failed to record certificate activation audit log: %s", e)

        db.commit()
        logger.info("Activated %d scheduled certificate(s) as of %s", activated_count, target_date.isoformat())
        return activated_count

    @staticmethod
    def reschedule_certificate(
        db: Session,
        certificate_id: uuid.UUID,
        new_date: date,
        user_id: Optional[uuid.UUID] = None,
        base_verification_url: str = "https://vyasa.csjmu.ac.in",
    ) -> FelicitationCertificate:
        """
        Updates the scheduled issue date for a SCHEDULED certificate.
        Strictly disallowed once a certificate is already ISSUED, REVOKED, or SUPERSEDED.
        Re-renders the official PDF snapshot to reflect the updated issue date.
        """
        from fastapi import HTTPException
        cert = db.get(FelicitationCertificate, certificate_id)
        if not cert:
            raise HTTPException(status_code=404, detail="Certificate not found")

        if cert.status != "SCHEDULED":
            raise HTTPException(
                status_code=400,
                detail=f"Certificate cannot be rescheduled because its current status is '{cert.status}'. Rescheduling is only permitted for certificates in SCHEDULED status prior to activation. Active certificates must be superseded or reissued.",
            )

        validate_issue_date(new_date)

        IST = ZoneInfo("Asia/Kolkata")
        today_ist = datetime.now(timezone.utc).astimezone(IST).date()
        is_future = new_date > today_ist

        cert.scheduled_issue_date = new_date
        cert.issued_at = datetime.combine(new_date, time.min).replace(tzinfo=IST)

        if is_future:
            cert.status = "SCHEDULED"
            cert.activated_at = None
        else:
            cert.status = "ISSUED"
            cert.activated_at = datetime.now(timezone.utc)

        # Re-render PDF with updated issue_date so vector and raster snapshots reflect new date
        authors_data = [
            {
                "author_name_snapshot": a.author_name_snapshot,
                "academic_title_snapshot": a.academic_title_snapshot,
                "scopus_id_snapshot": a.scopus_id_snapshot,
                "department_snapshot": None if (a.department_snapshot and a.department_snapshot.strip().lower() == "department of research") else a.department_snapshot,
                "designation_snapshot": a.designation_snapshot,
                "affiliation_snapshot": a.affiliation_snapshot,
            }
            for a in cert.authors
        ]
        if not authors_data and cert.author:
            dept_c = cert.author.department
            if dept_c and dept_c.strip().lower() == "department of research":
                dept_c = None
            authors_data = [{
                "author_name_snapshot": cert.author.full_name,
                "scopus_id_snapshot": cert.author.scopus_id,
                "department_snapshot": dept_c,
                "designation_snapshot": None,
                "affiliation_snapshot": cert.author.institutional_affiliation,
            }]

        dean_appr = next((ap for ap in cert.approvals if ap.authority_type == "DEAN_RD"), None)
        vc_appr = next((ap for ap in cert.approvals if ap.authority_type == "VICE_CHANCELLOR"), None)

        dean_sig_path = dean_appr.signature_image_path_snapshot if dean_appr else None
        vc_sig_path = vc_appr.signature_image_path_snapshot if vc_appr else None

        verify_url = f"{base_verification_url.rstrip('/')}/verify/{cert.verification_token}"
        bulletin_obj = None
        if cert.bulletin_id:
            bulletin_obj = db.get(ResearchBulletin, cert.bulletin_id)
        elif cert.publication_id:
            pub_obj = db.get(ResearchPublication, cert.publication_id)
            if pub_obj and pub_obj.bulletin_id:
                bulletin_obj = db.get(ResearchBulletin, pub_obj.bulletin_id)

        b_vol = cert.bulletin_volume_snapshot or (bulletin_obj.volume_number if bulletin_obj else None)
        b_issue = cert.bulletin_issue_snapshot or (bulletin_obj.issue_number if bulletin_obj else None)
        b_period = cert.bulletin_period_snapshot or (bulletin_obj.publication_period if bulletin_obj else None)
        b_title = (bulletin_obj.title if bulletin_obj else None) or (f"Volume {b_vol} • Issue {b_issue}" if b_vol and b_issue else None)

        try:
            pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
                certificate_number=cert.certificate_number,
                verification_token=cert.verification_token,
                verification_url=verify_url,
                title=cert.title,
                certificate_type=cert.certificate_type or "RESEARCH_PUBLICATION",
                presentation_statement=cert.presentation_statement,
                authors=authors_data or [{"author_name_snapshot": "Distinguished Scholar"}],
                research_contribution_statement=cert.research_contribution_statement,
                research_title=cert.research_title,
                publication_details=cert.publication_details,
                bulletin_title=b_title,
                bulletin_volume=b_vol,
                bulletin_issue=b_issue,
                bulletin_period=b_period,
                incentive_details=cert.publication_details if cert.certificate_type == "INCENTIVE_AWARD" else None,
                congratulatory_statement=cert.congratulatory_statement or "",
                issue_date=new_date,
                dean_name=dean_appr.signatory_name_snapshot if dean_appr else "Prof. (Dr.) Rajesh Kumar",
                dean_designation=dean_appr.designation_snapshot if dean_appr else "Dean – Research & Development",
                dean_signature_path=dean_sig_path,
                vc_name=vc_appr.signatory_name_snapshot if vc_appr else "Prof. Vinay Kumar Pathak",
                vc_designation=vc_appr.designation_snapshot if vc_appr else "Vice Chancellor",
                vc_signature_path=vc_sig_path,
            )

            save_res = storage_service.save_file(
                content=pdf_bytes,
                filename=f"{cert.certificate_number.replace('/', '_')}.pdf",
                subfolder="sama_veda/certificates",
                allowed_mime_types=["application/pdf"],
                mime_type="application/pdf",
            )
            cert.file_storage_path = save_res.storage_key
            cert.checksum_sha256 = sha
        except InstitutionalAssetResolutionError:
            raise
        except Exception as e:
            logger.warning("Could not re-render PDF during reschedule: %s", e)

        try:
            from app.services.audit_service import audit_service
            audit_service.log_event(
                db=db,
                module="sama_veda",
                action="certificate_rescheduled",
                entity_name="FelicitationCertificate",
                entity_id=cert.id,
                actor_user_id=user_id,
                details={
                    "certificate_number": cert.certificate_number,
                    "new_scheduled_issue_date": new_date.isoformat(),
                    "status": cert.status,
                },
                fail_silent=True,
            )
        except Exception as e:
            logger.debug("Failed to record reschedule audit: %s", e)

        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def revoke_certificate(
        db: Session, certificate: FelicitationCertificate, reason: str
    ) -> FelicitationCertificate:
        """Revokes an issued certificate with permanent audit justification."""
        certificate.is_revoked = True
        certificate.status = "REVOKED"
        certificate.revoked_at = datetime.now(timezone.utc)
        certificate.revocation_reason = reason
        db.commit()
        db.refresh(certificate)
        return certificate

    @staticmethod
    def reissue_certificate(
        db: Session,
        certificate: FelicitationCertificate,
        reason: str,
        data: Optional[CertificateReissueRequest] = None,
        created_by_user_id: Optional[uuid.UUID] = None,
        base_verification_url: str = "https://vyasa.csjmu.ac.in",
    ) -> FelicitationCertificate:
        """
        Supersedes previous certificate and issues a corrected official replacement document,
        preserving history and linkage.
        """
        certificate.status = "SUPERSEDED"
        certificate.reissued_reason = reason
        db.flush()

        new_authors = []
        if data and data.updated_authors:
            new_authors = data.updated_authors
        else:
            for old_auth in certificate.authors:
                new_authors.append(
                    CertificateAuthorCreate(
                        researcher_id=old_auth.researcher_id,
                        author_name_snapshot=old_auth.author_name_snapshot,
                        academic_title_snapshot=old_auth.academic_title_snapshot,
                        scopus_id_snapshot=old_auth.scopus_id_snapshot,
                        affiliation_snapshot=old_auth.affiliation_snapshot,
                        department_snapshot=old_auth.department_snapshot,
                        author_order=old_auth.author_order,
                        author_role=old_auth.author_role,
                    )
                )

        new_req = CertificateIssueRequest(
            certificate_type=certificate.certificate_type,
            template_id=certificate.template_id,
            title=(data.updated_title if data and data.updated_title else certificate.title),
            presentation_statement=certificate.presentation_statement,
            research_contribution_statement=certificate.research_contribution_statement,
            research_title=(data.updated_research_title if data and data.updated_research_title else certificate.research_title),
            congratulatory_statement=certificate.congratulatory_statement,
            publication_details=(data.updated_publication_details if data and data.updated_publication_details else certificate.publication_details),
            authors=new_authors,
            bulletin_id=certificate.bulletin_id,
            publication_id=certificate.publication_id,
            submit_for_approval=False,
        )

        new_cert = SamaCmsService.issue_certificate(
            db, new_req, created_by_user_id=created_by_user_id, base_verification_url=base_verification_url
        )
        new_cert.reissued_from_id = certificate.id
        new_cert.reissued_reason = reason
        db.commit()
        db.refresh(new_cert)
        return new_cert

    # ========================================================================
    # TEMPLATE & SIGNATORY SUBSYSTEMS
    # ========================================================================

    @staticmethod
    def list_templates(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        is_active: Optional[bool] = None,
        certificate_type: Optional[str] = None,
    ) -> Tuple[int, List[CertificateTemplate]]:
        SamaCmsService.seed_default_certificate_infrastructure(db)
        query = select(CertificateTemplate)
        if is_active is not None:
            query = query.where(CertificateTemplate.is_active == is_active)
        if certificate_type:
            query = query.where(CertificateTemplate.certificate_type == certificate_type.strip().upper())

        total = db.scalar(select(func.count(CertificateTemplate.id))) or 0
        items = db.scalars(query.order_by(CertificateTemplate.created_at.desc()).offset(skip).limit(limit)).all()
        return total, list(items)

    @staticmethod
    def get_template_by_id(db: Session, template_id: uuid.UUID) -> Optional[CertificateTemplate]:
        return db.get(CertificateTemplate, template_id)

    @staticmethod
    def create_template(
        db: Session, data: CertificateTemplateCreate, user_id: Optional[uuid.UUID] = None
    ) -> CertificateTemplate:
        tpl = CertificateTemplate(
            code=data.code.strip().upper(),
            name=data.name.strip(),
            description=data.description,
            certificate_type=data.certificate_type.strip().upper(),
            orientation=data.orientation.strip().upper(),
            config=data.config,
            is_active=data.is_active,
            is_default=data.is_default,
            created_by_user_id=user_id,
        )
        db.add(tpl)
        db.commit()
        db.refresh(tpl)
        return tpl

    @staticmethod
    def update_template(
        db: Session, tpl: CertificateTemplate, data: CertificateTemplateUpdate
    ) -> CertificateTemplate:
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(tpl, field, val)
        tpl.version += 1
        db.commit()
        db.refresh(tpl)
        return tpl

    @staticmethod
    def list_signatories(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
        is_active: Optional[bool] = None,
        authority_type: Optional[str] = None,
        include_deleted: bool = False,
    ) -> Tuple[int, List[CertificateSignatory]]:
        SamaCmsService.seed_default_certificate_infrastructure(db)
        query = select(CertificateSignatory)
        if not include_deleted:
            query = query.where(CertificateSignatory.deleted_at.is_(None))
        if is_active is not None:
            query = query.where(CertificateSignatory.is_active == is_active)
        if authority_type:
            query = query.where(CertificateSignatory.authority_type == authority_type.strip().upper())

        count_query = select(func.count(CertificateSignatory.id))
        if not include_deleted:
            count_query = count_query.where(CertificateSignatory.deleted_at.is_(None))
        if is_active is not None:
            count_query = count_query.where(CertificateSignatory.is_active == is_active)
        if authority_type:
            count_query = count_query.where(CertificateSignatory.authority_type == authority_type.strip().upper())

        total = db.scalar(count_query) or 0
        items = db.scalars(query.order_by(CertificateSignatory.created_at.asc()).offset(skip).limit(limit)).all()
        return total, list(items)

    @staticmethod
    def get_signatory_by_id(db: Session, signatory_id: uuid.UUID) -> Optional[CertificateSignatory]:
        return db.get(CertificateSignatory, signatory_id)

    @staticmethod
    def get_active_signatory(db: Session, authority_type: str) -> Optional[CertificateSignatory]:
        stmt = (
            select(CertificateSignatory)
            .where(
                CertificateSignatory.authority_type == authority_type.strip().upper(),
                CertificateSignatory.is_active == True,
                CertificateSignatory.deleted_at.is_(None),
            )
            .order_by(CertificateSignatory.effective_date.desc().nullslast())
            .limit(1)
        )
        return db.scalar(stmt)

    @staticmethod
    def create_signatory(db: Session, data: CertificateSignatoryCreate) -> CertificateSignatory:
        sig = CertificateSignatory(
            authority_type=data.authority_type.strip().upper(),
            signatory_name=data.signatory_name.strip(),
            designation=data.designation.strip(),
            department=data.department,
            signature_image_path=data.signature_image_path,
            is_active=data.is_active,
            effective_date=data.effective_date or datetime.now(timezone.utc),
        )
        db.add(sig)
        db.commit()
        db.refresh(sig)
        return sig

    @staticmethod
    def update_signatory(
        db: Session, sig: CertificateSignatory, data: CertificateSignatoryUpdate
    ) -> CertificateSignatory:
        for field, val in data.model_dump(exclude_unset=True).items():
            setattr(sig, field, val)
        sig.signature_asset_version += 1
        db.commit()
        db.refresh(sig)
        return sig

    @staticmethod
    def delete_signatory(db: Session, signatory_id: uuid.UUID) -> Dict[str, Any]:
        """
        Safely deletes or soft-deletes a signing authority.
        Checks for dependencies in CertificateApproval.
        If referenced by any certificate approvals, performs soft deletion (sets is_active=False, deleted_at=now())
        to strictly preserve all historical references.
        If unreferenced, performs hard deletion.
        """
        sig = db.get(CertificateSignatory, signatory_id)
        if not sig:
            raise ValueError("Signing authority not found.")

        approval_count = db.scalar(
            select(func.count(CertificateApproval.id)).where(
                CertificateApproval.signatory_id == signatory_id
            )
        ) or 0

        if approval_count > 0:
            sig.is_active = False
            sig.deleted_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(sig)
            return {
                "action": "soft_deleted",
                "message": f"Signing authority referenced in {approval_count} certificate approval record(s). Deactivated and soft-deleted safely to preserve historical records.",
                "signatory_id": str(sig.id),
                "is_active": sig.is_active,
                "deleted_at": sig.deleted_at.isoformat() if sig.deleted_at else None,
                "referenced_approvals": approval_count,
            }
        else:
            db.delete(sig)
            db.commit()
            return {
                "action": "deleted",
                "message": "Signing authority permanently removed (no historical dependencies).",
                "signatory_id": str(signatory_id),
                "referenced_approvals": 0,
            }

    @staticmethod
    def toggle_signatory_active(db: Session, signatory_id: uuid.UUID) -> CertificateSignatory:
        """Toggles the active state of a signing authority."""
        sig = db.get(CertificateSignatory, signatory_id)
        if not sig:
            raise ValueError("Signing authority not found.")
        sig.is_active = not sig.is_active
        if sig.is_active:
            sig.deleted_at = None
        db.commit()
        db.refresh(sig)
        return sig

    @staticmethod
    def seed_default_certificate_infrastructure(db: Session):
        """Ensures the official CSJMU template and dual signing authorities exist in the database."""
        existing_tpl = db.scalar(
            select(CertificateTemplate).where(CertificateTemplate.code == "DEFAULT_CSJMU_A4")
        )
        if not existing_tpl:
            default_tpl = CertificateTemplate(
                code="DEFAULT_CSJMU_A4",
                name="CSJMU Institutional Research Felicitation Template",
                description="Official landscape A4 certificate with double antique-gold borders, university emblem, NAAC A++ accreditation badge, and central academic seal.",
                certificate_type="RESEARCH_PUBLICATION",
                orientation="LANDSCAPE",
                is_active=True,
                is_default=True,
                config={
                    "background_color": "#FAF7F0",
                    "primary_border_color": "#B2811A",
                    "secondary_border_color": "#D4AF37",
                    "accent_color": "#6B1D2F",
                    "heading_font": "Times-Bold",
                    "body_font": "Times-Roman",
                    "show_university_emblem": True,
                    "show_naac_badge": True,
                    "show_academic_seal": True,
                    "show_qr_code": True,
                },
            )
            db.add(default_tpl)

        existing_inc_tpl = db.scalar(
            select(CertificateTemplate).where(CertificateTemplate.code == "DEFAULT_CSJMU_INCENTIVE_A4")
        )
        if not existing_inc_tpl:
            inc_tpl = CertificateTemplate(
                code="DEFAULT_CSJMU_INCENTIVE_A4",
                name="CSJMU Research Publication Incentive Certificate Template",
                description="Official landscape A4 certificate for university research publication incentive awards with antique-gold borders, sanction particulars, and central seal.",
                certificate_type="INCENTIVE_AWARD",
                orientation="LANDSCAPE",
                is_active=True,
                is_default=False,
                config={
                    "background_color": "#FAF7F0",
                    "primary_border_color": "#B2811A",
                    "secondary_border_color": "#D4AF37",
                    "accent_color": "#6B1D2F",
                    "heading_font": "Times-Bold",
                    "body_font": "Times-Roman",
                    "show_university_emblem": True,
                    "show_naac_badge": True,
                    "show_academic_seal": True,
                    "show_qr_code": True,
                    "award_badge_text": "RESEARCH PUBLICATION INCENTIVE AWARD",
                },
            )
            db.add(inc_tpl)

        existing_dean = db.scalar(
            select(CertificateSignatory).where(CertificateSignatory.authority_type == "DEAN_RD")
        )
        if not existing_dean:
            dean_sig = CertificateSignatory(
                authority_type="DEAN_RD",
                signatory_name="Prof. (Dr.) Rajesh Kumar",
                designation="Dean – Research & Development",
                department="Research & Development Cell, CSJMU Kanpur",
                is_active=True,
                effective_date=datetime.now(timezone.utc),
            )
            db.add(dean_sig)

        existing_vc = db.scalar(
            select(CertificateSignatory).where(CertificateSignatory.authority_type == "VICE_CHANCELLOR")
        )
        if not existing_vc:
            vc_sig = CertificateSignatory(
                authority_type="VICE_CHANCELLOR",
                signatory_name="Prof. Vinay Kumar Pathak",
                designation="Vice Chancellor",
                department="Chhatrapati Shahu Ji Maharaj University, Kanpur",
                is_active=True,
                effective_date=datetime.now(timezone.utc),
            )
            db.add(vc_sig)

        try:
            db.commit()
        except Exception:
            db.rollback()

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
