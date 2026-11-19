import csv
import io
import re
import uuid
import logging
import zipfile
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
    BulkCertificateUploadPayload,
    BulkCertificatePreviewResponse,
    BulkCertificatePreviewItem,
    BulkAuthorInput,
    AuthorMatchItem,
    AuthorCandidate,
    BulkCertificateGenerateRequest,
    BulkCertificateGenerateResponse,
    BulkCertificateGenerateResultItem,
    BulkApprovalResponse,
    BulkApprovalResultItem,
    BatchSummaryItem,
    BatchDetailResponse,
    ArchivedCertificateItem,
    CertificateOut,
    CertificateAuthorOut,
    CertificateApprovalOut,
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
    LegacyCertificateRegistry,
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
    @staticmethod
    def bulk_update_publication_status(
        db: Session,
        publication_ids: List[uuid.UUID],
        status: str,
    ) -> Tuple[List[uuid.UUID], List[Dict[str, Any]]]:
        if status not in {"draft", "in_review", "published", "archived"}:
            raise ValueError(f"Invalid lifecycle status: {status}")

        updated_ids: List[uuid.UUID] = []
        failed_items: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc)

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

                pub.status = status
                if status == "published" and not pub.published_at:
                    pub.published_at = now
                elif status == "archived":
                    pub.archived_at = now

                db.flush()
                updated_ids.append(pub_id)
            except Exception as e:
                failed_items.append({
                    "id": str(pub_id),
                    "reason": f"Status update error: {str(e)}",
                })

        db.commit()
        return updated_ids, failed_items

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
    def validate_manual_certificate_number(cert_number: Optional[str]) -> Optional[str]:
        """
        Validates an optional manually supplied certificate number.
        Returns:
            - None if input is None, empty, or whitespace-only (triggers automatic generation)
            - The exact trimmed valid certificate number string
        Raises:
            - ValueError if format, character set, or length constraints are violated
        """
        if cert_number is None:
            return None
        trimmed = str(cert_number).strip()
        if not trimmed:
            return None

        if len(trimmed) > 100:
            raise ValueError("Certificate number exceeds maximum allowed length of 100 characters.")
        if len(trimmed) < 3:
            raise ValueError("Certificate number must be at least 3 characters long.")

        # Reject path traversal, control characters, or unsafe characters
        if ".." in trimmed or "\\" in trimmed or any(ord(c) < 32 or ord(c) == 127 for c in trimmed):
            raise ValueError("Certificate number contains forbidden control or path traversal characters.")

        # Allowed characters: alphanumeric, forward slashes, hyphens, underscores, dots, spaces
        pattern = r"^[A-Za-z0-9][A-Za-z0-9\/\-_\. ]*[A-Za-z0-9]$"
        if not re.match(pattern, trimmed):
            raise ValueError(
                "Invalid certificate number format. Must start and end with an alphanumeric character and contain only alphanumeric characters, forward slashes (/), hyphens (-), underscores (_), and periods (.)."
            )

        return trimmed

    @staticmethod
    def validate_manual_verification_identifier(identifier: Optional[str]) -> Optional[str]:
        """
        Validates an optional manually supplied verification identifier (token).
        Supports extracting identifier from a full verification URL if provided.
        Returns:
            - None if input is None, empty, or whitespace-only (triggers automatic token generation)
            - The exact trimmed valid identifier string (e.g. hex token or UUID)
        Raises:
            - ValueError if URL format, character set, or length constraints are violated
        """
        if identifier is None:
            return None
        trimmed = str(identifier).strip()
        if not trimmed:
            return None

        # Support extracting identifier from full verification URL
        if "://" in trimmed or trimmed.startswith("/"):
            url_pattern = r'^(?:https?://[^/]+)?(?:/api)?(?:/modules/sama-veda)?/(?:certificates/)?verify/([a-zA-Z0-9_\-]+)/?$'
            m = re.match(url_pattern, trimmed, re.IGNORECASE)
            if not m:
                raise ValueError(
                    "Invalid verification URL format. Pasted URL must match the application's verification route: /verify/{identifier}."
                )
            trimmed = m.group(1).strip()

        if len(trimmed) > 64:
            raise ValueError("Verification identifier exceeds maximum allowed length of 64 characters.")
        if len(trimmed) < 4:
            raise ValueError("Verification identifier must be at least 4 characters long.")

        # Must be URL-safe identifier: alphanumeric, hyphens, underscores
        pattern = r"^[A-Za-z0-9_\-]+$"
        if not re.match(pattern, trimmed):
            raise ValueError(
                "Invalid verification identifier format. Only alphanumeric characters, hyphens (-), and underscores (_) are allowed."
            )

        return trimmed

    @classmethod
    def format_legacy_certificate_out(cls, legacy: LegacyCertificateRegistry, db: Optional[Session] = None) -> CertificateOut:
        meta = legacy.recovery_metadata or {}
        author_out = CertificateAuthorOut(
            id=legacy.id,
            certificate_id=legacy.id,
            researcher_id=None,
            author_name_snapshot=legacy.recipient_name,
            academic_title_snapshot=None,
            scopus_id_snapshot=meta.get("scopus_id"),
            affiliation_snapshot="Chhatrapati Shahu Ji Maharaj University, Kanpur",
            department_snapshot=meta.get("department", "Department of Research & Innovation"),
            designation_snapshot=None,
            author_order=1,
            author_role="CORRESPONDING_AUTHOR",
            created_at=legacy.created_at,
        )

        has_collision = False
        collision_info = None
        if db:
            active_cert = db.scalars(
                select(FelicitationCertificate).where(
                    FelicitationCertificate.certificate_number == legacy.certificate_number
                )
            ).first()
            if active_cert and active_cert.verification_token != legacy.verification_token:
                has_collision = True
                active_author = (
                    active_cert.authors[0].author_name_snapshot
                    if active_cert.authors
                    else "Active Digital Recipient"
                )
                collision_info = {
                    "colliding_serial": legacy.certificate_number,
                    "active_id": str(active_cert.id),
                    "active_recipient": active_author,
                    "active_token": active_cert.verification_token,
                    "notice": f"Notice: Serial {legacy.certificate_number} is actively held by digital certificate issued to {active_author}."
                }

        return CertificateOut(
            id=legacy.id,
            certificate_number=legacy.certificate_number,
            certificate_type=legacy.certificate_type,
            status="REVOKED" if legacy.is_revoked else "HISTORICAL",
            template_id=None,
            template_version=1,
            title=(
                "Certificate of Appreciation for Research Publication"
                if legacy.certificate_type == "INCENTIVE_AWARD"
                else "Certificate of Appreciation & Research Excellence"
            ),
            presentation_statement="This certificate is proudly awarded to",
            research_contribution_statement="in recognition of distinguished research productivity and scholarly impact under the University Publication Incentive Policy",
            research_title=legacy.research_title,
            congratulatory_statement="The University acknowledges the distinguished scholarly dedication and meritorious contribution to academic research.",
            publication_details={
                "incentive_amount": legacy.sanction_amount,
                "issue_reference": legacy.issue_reference or "Volume 2, Issue 3 (July - September 2026)",
                "recovery_source": legacy.recovery_source,
                "is_historical_archive": True,
            },
            verification_token=legacy.verification_token,
            verification_url=f"/verify/{legacy.verification_token}",
            bulletin_id=None,
            bulletin_volume_snapshot=2,
            bulletin_issue_snapshot=3,
            bulletin_period_snapshot="July - September 2026",
            author_id=None,
            publication_id=None,
            file_storage_path=legacy.source_pdf_reference,
            checksum_sha256=legacy.source_sha256 or "",
            download_count=0,
            scheduled_issue_date=None,
            activated_at=legacy.created_at,
            is_scheduled=False,
            time_until_activation_seconds=None,
            issued_at=legacy.created_at,
            approved_at=None,
            is_revoked=legacy.is_revoked,
            revoked_at=legacy.revoked_at,
            revocation_reason=legacy.revocation_reason,
            rejection_reason=None,
            reissued_from_id=None,
            reissued_reason=None,
            created_at=legacy.created_at,
            authors=[author_out],
            approvals=[],
            is_legacy=True,
            recovery_source=legacy.recovery_source,
            issue_reference=legacy.issue_reference,
            sanction_amount=legacy.sanction_amount,
            has_legacy_collision=has_collision,
            legacy_collision_info=collision_info,
        )

    @classmethod
    def format_active_certificate_out(cls, cert: FelicitationCertificate, db: Optional[Session] = None) -> CertificateOut:
        out = CertificateOut.model_validate(cert)
        if db:
            legacy_coll = db.scalars(
                select(LegacyCertificateRegistry).where(
                    LegacyCertificateRegistry.certificate_number == cert.certificate_number,
                    LegacyCertificateRegistry.is_legacy == True,
                )
            ).first()
            if legacy_coll and legacy_coll.verification_token != cert.verification_token:
                out.has_legacy_collision = True
                out.legacy_collision_info = {
                    "colliding_serial": cert.certificate_number,
                    "legacy_id": str(legacy_coll.id),
                    "legacy_recipient": legacy_coll.recipient_name,
                    "legacy_token": legacy_coll.verification_token,
                    "notice": f"Notice: Certificate serial number {cert.certificate_number} is also held by a historical printed certificate ({legacy_coll.recipient_name})."
                }
        return out

    @classmethod
    def list_certificates(
        cls,
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
        origin: Optional[str] = None,
    ) -> Tuple[int, List[CertificateOut]]:
        scope_norm = (scope or "").strip().lower()
        status_norm = (status or "").strip().upper()
        origin_norm = (origin or "").strip().lower()

        # Origin routing
        if status_norm in ["HISTORICAL", "RECOVERED", "LEGACY"]:
            origin_norm = "historical"
        elif scope_norm == "approvals" or status_norm in ["PENDING", "PENDING_APPROVAL", "APPROVAL_QUEUE", "DRAFT", "SCHEDULED", "SUPERSEDED", "ARCHIVED"]:
            origin_norm = "active"
        elif not origin_norm:
            if status_norm == "ISSUED" and not origin:
                origin_norm = "active"
            else:
                origin_norm = "all"

        # 1. Prepare Active Query
        active_query = select(FelicitationCertificate).options(
            selectinload(FelicitationCertificate.authors),
            selectinload(FelicitationCertificate.approvals),
        )
        active_filters = []

        if bulletin_id:
            active_filters.append(FelicitationCertificate.bulletin_id == bulletin_id)
        if author_id:
            active_filters.append(
                or_(
                    FelicitationCertificate.author_id == author_id,
                    FelicitationCertificate.authors.any(CertificateAuthor.researcher_id == author_id),
                )
            )
        if certificate_type:
            active_filters.append(FelicitationCertificate.certificate_type == certificate_type.strip().upper())

        if scope_norm == "ledger" or status_norm in ["ISSUED_LEDGER", "LEDGER"]:
            ledger_base_cond = and_(
                or_(
                    FelicitationCertificate.status.in_(["ISSUED", "REVOKED", "SUPERSEDED"]),
                    FelicitationCertificate.is_revoked == True,
                ),
                FelicitationCertificate.status.notin_(["DRAFT", "SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]),
            )
            if status_norm == "ISSUED":
                active_filters.append(and_(FelicitationCertificate.status == "ISSUED", FelicitationCertificate.is_revoked == False))
            elif status_norm == "REVOKED" or is_revoked is True:
                active_filters.append(or_(FelicitationCertificate.is_revoked == True, FelicitationCertificate.status == "REVOKED"))
            elif status_norm == "SUPERSEDED":
                active_filters.append(FelicitationCertificate.status == "SUPERSEDED")
            elif status_norm == "SCHEDULED":
                active_filters.append(and_(FelicitationCertificate.status == "SCHEDULED", FelicitationCertificate.is_revoked == False))
            else:
                active_filters.append(ledger_base_cond)
                active_filters.append(FelicitationCertificate.status != "SCHEDULED")
                active_filters.append(FelicitationCertificate.status != "ARCHIVED")
        elif scope_norm == "approvals" or status_norm in ["PENDING", "PENDING_APPROVAL", "APPROVAL_QUEUE"]:
            active_filters.append(FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]))
            active_filters.append(FelicitationCertificate.is_revoked == False)

            stage_norm = (approval_stage or status or "").strip().upper()
            if stage_norm in ["DEAN", "DEAN_RD", "PENDING_DEAN_APPROVAL"]:
                active_filters.append(FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL"]))
            elif stage_norm in ["VC", "VICE_CHANCELLOR", "PENDING_VC_APPROVAL"]:
                active_filters.append(FelicitationCertificate.status == "PENDING_VC_APPROVAL")
        else:
            if is_revoked is not None:
                active_filters.append(FelicitationCertificate.is_revoked == is_revoked)

            if status:
                if "," in status:
                    statuses = [s.strip().upper() for s in status.split(",") if s.strip()]
                    active_filters.append(FelicitationCertificate.status.in_(statuses))
                elif status_norm in ["PENDING", "PENDING_APPROVAL"]:
                    active_filters.append(and_(
                        FelicitationCertificate.status.in_(["SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL"]),
                        FelicitationCertificate.is_revoked == False,
                    ))
                elif status_norm == "ISSUED_ACTIVE":
                    active_filters.append(and_(FelicitationCertificate.status == "ISSUED", FelicitationCertificate.is_revoked == False))
                elif status_norm in ["HISTORICAL", "RECOVERED", "LEGACY"]:
                    # When specifically filtering for historical, active query matches nothing
                    active_filters.append(FelicitationCertificate.id == None)
                else:
                    active_filters.append(FelicitationCertificate.status == status_norm)
            else:
                active_filters.append(FelicitationCertificate.status != "ARCHIVED")

        if search:
            search_pattern = f"%{search.strip()}%"
            active_filters.append(
                or_(
                    FelicitationCertificate.certificate_number.ilike(search_pattern),
                    FelicitationCertificate.title.ilike(search_pattern),
                    FelicitationCertificate.research_title.ilike(search_pattern),
                    FelicitationCertificate.authors.any(CertificateAuthor.author_name_snapshot.ilike(search_pattern)),
                    FelicitationCertificate.authors.any(CertificateAuthor.scopus_id_snapshot.ilike(search_pattern)),
                    FelicitationCertificate.verification_token.ilike(search_pattern),
                )
            )

        # 2. Prepare Legacy Query
        legacy_filters = [LegacyCertificateRegistry.is_legacy == True]
        if is_revoked is not None:
            legacy_filters.append(LegacyCertificateRegistry.is_revoked == is_revoked)
        if certificate_type:
            legacy_filters.append(LegacyCertificateRegistry.certificate_type == certificate_type.strip().upper())
        if search:
            search_pattern = f"%{search.strip()}%"
            legacy_filters.append(
                or_(
                    LegacyCertificateRegistry.certificate_number.ilike(search_pattern),
                    LegacyCertificateRegistry.recipient_name.ilike(search_pattern),
                    LegacyCertificateRegistry.research_title.ilike(search_pattern),
                    LegacyCertificateRegistry.verification_token.ilike(search_pattern),
                )
            )
        if bulletin_id or author_id or scope_norm == "approvals":
            legacy_filters.append(LegacyCertificateRegistry.id == None)

        # 3. Execution based on origin_norm
        if origin_norm == "historical":
            count_stmt = select(func.count(LegacyCertificateRegistry.id))
            if legacy_filters:
                count_stmt = count_stmt.where(*legacy_filters)
            legacy_total = db.scalar(count_stmt) or 0

            legacy_query = (
                select(LegacyCertificateRegistry)
                .where(*legacy_filters)
                .order_by(LegacyCertificateRegistry.certificate_number.asc())
                .offset(skip)
                .limit(limit)
            )
            legacy_records = db.scalars(legacy_query).all()
            return legacy_total, [cls.format_legacy_certificate_out(r, db) for r in legacy_records]

        elif origin_norm == "active":
            count_stmt = select(func.count(FelicitationCertificate.id))
            if active_filters:
                active_query = active_query.where(*active_filters)
                count_stmt = count_stmt.where(*active_filters)
            active_total = db.scalar(count_stmt) or 0

            active_records = db.scalars(
                active_query.order_by(FelicitationCertificate.created_at.desc())
                .offset(skip)
                .limit(limit)
            ).all()
            return active_total, [cls.format_active_certificate_out(c, db) for c in active_records]

        else:
            # origin_norm == "all"
            active_count_stmt = select(func.count(FelicitationCertificate.id))
            if active_filters:
                active_query = active_query.where(*active_filters)
                active_count_stmt = active_count_stmt.where(*active_filters)
            active_total = db.scalar(active_count_stmt) or 0

            legacy_count_stmt = select(func.count(LegacyCertificateRegistry.id))
            if legacy_filters:
                legacy_count_stmt = legacy_count_stmt.where(*legacy_filters)
            legacy_total = db.scalar(legacy_count_stmt) or 0

            combined_total = active_total + legacy_total
            result_items: List[CertificateOut] = []

            if skip < active_total:
                active_fetch_limit = min(limit, active_total - skip)
                active_records = db.scalars(
                    active_query.order_by(FelicitationCertificate.created_at.desc())
                    .offset(skip)
                    .limit(active_fetch_limit)
                ).all()
                result_items.extend([cls.format_active_certificate_out(c, db) for c in active_records])

                remaining_needed = limit - len(result_items)
                if remaining_needed > 0 and legacy_total > 0:
                    legacy_query = (
                        select(LegacyCertificateRegistry)
                        .where(*legacy_filters)
                        .order_by(LegacyCertificateRegistry.certificate_number.asc())
                        .offset(0)
                        .limit(remaining_needed)
                    )
                    legacy_records = db.scalars(legacy_query).all()
                    result_items.extend([cls.format_legacy_certificate_out(r, db) for r in legacy_records])
            else:
                legacy_skip = skip - active_total
                legacy_query = (
                    select(LegacyCertificateRegistry)
                    .where(*legacy_filters)
                    .order_by(LegacyCertificateRegistry.certificate_number.asc())
                    .offset(legacy_skip)
                    .limit(limit)
                )
                legacy_records = db.scalars(legacy_query).all()
                result_items.extend([cls.format_legacy_certificate_out(r, db) for r in legacy_records])

            return combined_total, result_items

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
            func.count(case((FelicitationCertificate.status != "ARCHIVED", FelicitationCertificate.id))).label("total"),
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

        historical_count = 0
        try:
            historical_count = db.scalar(
                select(func.count(LegacyCertificateRegistry.id)).where(LegacyCertificateRegistry.is_legacy == True)
            ) or 0
        except Exception:
            historical_count = 0

        return {
            "total_certificates": (row.total or 0) + historical_count,
            "total_issued": total_issued,
            "draft_certificates": row.drafts or 0,
            "pending_approvals": row.pending or 0,
            "scheduled_certificates": row.scheduled or 0,
            "issued_certificates": issued_active,
            "revoked_certificates": revoked,
            "reissued_certificates": superseded,
            "total_researchers_linked": total_authors,
            "historical_certificates": historical_count,
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
        clean_cert_num = SamaCmsService.validate_manual_certificate_number(data.certificate_number)
        manual_token = SamaCmsService.validate_manual_verification_identifier(
            getattr(data, "verification_identifier", None) or getattr(data, "verification_token", None)
        )

        if clean_cert_num:
            existing_c = SamaCmsService.get_certificate_by_number(db, clean_cert_num)
            if existing_c:
                raise ValueError(f"Certificate number '{clean_cert_num}' is already assigned to another certificate.")
            existing_tok = SamaCmsService.get_certificate_by_token(db, clean_cert_num)
            if existing_tok:
                raise ValueError(f"Certificate number '{clean_cert_num}' conflicts with an existing verification identifier.")
            cert_num = clean_cert_num
        else:
            cert_num = SamaCmsService.generate_unique_certificate_number(db)

        if manual_token:
            existing_tok = SamaCmsService.get_certificate_by_token(db, manual_token)
            if existing_tok:
                raise ValueError(f"Verification identifier '{manual_token}' is already assigned to another certificate.")
            existing_num = SamaCmsService.get_certificate_by_number(db, manual_token)
            if existing_num:
                raise ValueError(f"Verification identifier '{manual_token}' conflicts with an existing certificate number.")
            token = manual_token
        else:
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

    @staticmethod
    def bulk_delete_certificates(
        db: Session,
        *,
        certificate_ids: List[uuid.UUID],
        reason: str,
        actor_user_id: uuid.UUID,
    ) -> Tuple[str, List[str], List[Dict[str, str]]]:
        """
        Safely bulk deletes / archives certificates while protecting institutional provenance.
        Enforces:
        - Active issued certificates must undergo formal revocation or reissuance before archival.
        - Preserves cryptographic hashes, signatures, verification tokens, and approval ledgers.
        - Records archival metadata and provenance in publication_details["archival"].
        - Safely transitions eligible certificates to ARCHIVED status.
        """
        clean_reason = reason.strip() if reason else ""
        if not clean_reason:
            raise ValueError("Mandatory institutional deletion reason is required.")

        operation_id = str(uuid.uuid4())
        deleted_ids: List[str] = []
        failed_items: List[Dict[str, str]] = []

        # Deduplicate requested IDs while preserving input order
        unique_ids = list(dict.fromkeys(certificate_ids))

        # Query all requested certificates in a single batch
        stmt = (
            select(FelicitationCertificate)
            .where(FelicitationCertificate.id.in_(unique_ids))
        )
        certs = db.scalars(stmt).all()
        cert_map = {c.id: c for c in certs}

        for cid in unique_ids:
            cert = cert_map.get(cid)
            if not cert:
                failed_items.append({
                    "id": str(cid),
                    "reason": "Certificate record not found in system.",
                })
                continue

            if cert.status == "ARCHIVED":
                failed_items.append({
                    "id": str(cid),
                    "reason": "Certificate is already archived/deleted.",
                })
                continue

            # Active certificates cannot be archived without prior revocation or reissuance
            if cert.status == "ISSUED" and not cert.is_revoked:
                failed_items.append({
                    "id": str(cid),
                    "reason": "Active certificate must be formally revoked or reissued before it can be archived.",
                })
                continue

            # Record archival metadata into publication_details JSONB
            pub_details = dict(cert.publication_details or {})
            archival_info = dict(pub_details.get("archival") or {})
            history = list(archival_info.get("history") or [])
            history.append({
                "action": "ARCHIVED",
                "previous_status": cert.status,
                "operation_id": operation_id,
                "archived_at": datetime.now(timezone.utc).isoformat(),
                "archived_by_user_id": str(actor_user_id),
                "archival_reason": clean_reason,
            })
            archival_info["is_archived"] = True
            archival_info["previous_status"] = cert.status
            archival_info["archived_at"] = datetime.now(timezone.utc).isoformat()
            archival_info["archived_by_user_id"] = str(actor_user_id)
            archival_info["archival_reason"] = clean_reason
            archival_info["history"] = history
            pub_details["archival"] = archival_info
            cert.publication_details = pub_details

            cert.status = "ARCHIVED"
            cert.rejection_reason = f"[DELETED via Bulk Operation {operation_id[:8]}] Rationale: {clean_reason}"
            deleted_ids.append(str(cid))

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Failed to commit bulk certificate deletion: %s", exc)
            raise ValueError(f"Database error during bulk deletion: {exc}")

        return operation_id, deleted_ids, failed_items

    @staticmethod
    def delete_certificate(
        db: Session,
        *,
        certificate_id: uuid.UUID,
        reason: str,
        actor_user_id: uuid.UUID,
    ) -> FelicitationCertificate:
        """
        Safely soft-deletes / archives a single certificate with mandatory reason.
        Enforces that active certificates must be formally revoked or reissued before archival.
        """
        clean_reason = reason.strip() if reason else ""
        if not clean_reason:
            raise ValueError("Mandatory institutional deletion reason is required.")

        cert = db.get(FelicitationCertificate, certificate_id)
        if not cert:
            raise ValueError("Certificate record not found.")

        if cert.status == "ARCHIVED":
            raise ValueError("Certificate is already archived/deleted.")

        # Active certificates cannot be archived without prior revocation or reissuance
        if cert.status == "ISSUED" and not cert.is_revoked:
            raise ValueError("Active issued certificates must be formally revoked or reissued before archival. They cannot be archived directly.")

        pub_details = dict(cert.publication_details or {})
        archival_info = dict(pub_details.get("archival") or {})
        history = list(archival_info.get("history") or [])
        history.append({
            "action": "ARCHIVED",
            "previous_status": cert.status,
            "archived_at": datetime.now(timezone.utc).isoformat(),
            "archived_by_user_id": str(actor_user_id),
            "archival_reason": clean_reason,
        })
        archival_info["is_archived"] = True
        archival_info["previous_status"] = cert.status
        archival_info["archived_at"] = datetime.now(timezone.utc).isoformat()
        archival_info["archived_by_user_id"] = str(actor_user_id)
        archival_info["archival_reason"] = clean_reason
        archival_info["history"] = history
        pub_details["archival"] = archival_info
        cert.publication_details = pub_details

        cert.status = "ARCHIVED"
        cert.rejection_reason = f"[DELETED by Admin] Rationale: {clean_reason}"
        db.commit()
        db.refresh(cert)
        return cert

    @staticmethod
    def restore_certificate(
        db: Session,
        *,
        certificate_id: uuid.UUID,
        reason: str,
        actor_user_id: uuid.UUID,
    ) -> Tuple[FelicitationCertificate, str]:
        """
        Restores an archived certificate to its previous lifecycle state.
        Restoration state mapping:
        - If previously REVOKED (or is_revoked is True): returns strictly to REVOKED. Never reactivates.
        - If previously SUPERSEDED: returns strictly to SUPERSEDED.
        - If previously REJECTED: returns strictly to REJECTED.
        - If previously PENDING_DEAN_APPROVAL: returns to PENDING_DEAN_APPROVAL.
        - If previously PENDING_VC_APPROVAL: returns to PENDING_VC_APPROVAL.
        - If previously APPROVED: returns to APPROVED.
        - If previously SCHEDULED: returns to SCHEDULED.
        - If previously DRAFT: returns to DRAFT.
        - If previously ISSUED: returns to REVOKED if revoked, else ISSUED.
        """
        clean_reason = reason.strip() if reason else ""
        if not clean_reason:
            raise ValueError("Mandatory institutional restoration reason is required.")

        cert = db.get(FelicitationCertificate, certificate_id)
        if not cert:
            raise ValueError("Certificate record not found.")

        if cert.status != "ARCHIVED":
            raise ValueError(f"Certificate is in '{cert.status}' state and is not archived.")

        pub_details = dict(cert.publication_details or {})
        archival_info = dict(pub_details.get("archival") or {})
        prev_st = archival_info.get("previous_status")

        # Complete restoration state mapping
        if cert.is_revoked or prev_st == "REVOKED":
            target_status = "REVOKED"
        elif prev_st == "SUPERSEDED":
            target_status = "SUPERSEDED"
        elif prev_st == "REJECTED":
            target_status = "REJECTED"
        elif prev_st == "PENDING_DEAN_APPROVAL":
            target_status = "PENDING_DEAN_APPROVAL"
        elif prev_st == "PENDING_VC_APPROVAL":
            target_status = "PENDING_VC_APPROVAL"
        elif prev_st == "APPROVED":
            target_status = "APPROVED"
        elif prev_st == "SCHEDULED":
            target_status = "SCHEDULED"
        elif prev_st == "DRAFT":
            target_status = "DRAFT"
        elif prev_st == "ISSUED":
            target_status = "REVOKED" if cert.is_revoked else "ISSUED"
        else:
            target_status = "REVOKED" if cert.is_revoked else "DRAFT"

        # Record restoration history
        history = list(archival_info.get("history") or [])
        history.append({
            "action": "RESTORED",
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "restored_by_user_id": str(actor_user_id),
            "restore_reason": clean_reason,
            "restored_to_status": target_status,
            "previous_archived_reason": cert.rejection_reason,
        })
        archival_info["is_archived"] = False
        archival_info["last_restored_at"] = datetime.now(timezone.utc).isoformat()
        archival_info["last_restored_by_user_id"] = str(actor_user_id)
        archival_info["last_restore_reason"] = clean_reason
        archival_info["history"] = history
        pub_details["archival"] = archival_info
        cert.publication_details = pub_details

        cert.status = target_status
        if target_status not in ["REJECTED", "REVOKED"]:
            cert.rejection_reason = None

        db.commit()
        db.refresh(cert)
        return cert, target_status

    @staticmethod
    def bulk_restore_certificates(
        db: Session,
        *,
        certificate_ids: List[uuid.UUID],
        reason: str,
        actor_user_id: uuid.UUID,
    ) -> Tuple[str, List[Dict[str, str]], List[Dict[str, str]]]:
        """
        Safely bulk restores archived certificates to their previous lifecycle states.
        Supports partial failures, idempotent retries, and returns per-record results.
        """
        clean_reason = reason.strip() if reason else ""
        if not clean_reason:
            raise ValueError("Mandatory institutional restoration reason is required.")

        operation_id = str(uuid.uuid4())
        restored_items: List[Dict[str, str]] = []
        failed_items: List[Dict[str, str]] = []

        unique_ids = list(dict.fromkeys(certificate_ids))

        stmt = (
            select(FelicitationCertificate)
            .where(FelicitationCertificate.id.in_(unique_ids))
        )
        certs = db.scalars(stmt).all()
        cert_map = {c.id: c for c in certs}

        for cid in unique_ids:
            cert = cert_map.get(cid)
            if not cert:
                failed_items.append({
                    "id": str(cid),
                    "reason": "Certificate record not found in system.",
                })
                continue

            if cert.status != "ARCHIVED":
                failed_items.append({
                    "id": str(cid),
                    "reason": f"Certificate is in '{cert.status}' state and is not archived.",
                })
                continue

            pub_details = dict(cert.publication_details or {})
            archival_info = dict(pub_details.get("archival") or {})
            prev_st = archival_info.get("previous_status")

            if cert.is_revoked or prev_st == "REVOKED":
                target_status = "REVOKED"
            elif prev_st == "SUPERSEDED":
                target_status = "SUPERSEDED"
            elif prev_st == "REJECTED":
                target_status = "REJECTED"
            elif prev_st == "PENDING_DEAN_APPROVAL":
                target_status = "PENDING_DEAN_APPROVAL"
            elif prev_st == "PENDING_VC_APPROVAL":
                target_status = "PENDING_VC_APPROVAL"
            elif prev_st == "APPROVED":
                target_status = "APPROVED"
            elif prev_st == "SCHEDULED":
                target_status = "SCHEDULED"
            elif prev_st == "DRAFT":
                target_status = "DRAFT"
            elif prev_st == "ISSUED":
                target_status = "REVOKED" if cert.is_revoked else "ISSUED"
            else:
                target_status = "REVOKED" if cert.is_revoked else "DRAFT"

            history = list(archival_info.get("history") or [])
            history.append({
                "action": "RESTORED",
                "operation_id": operation_id,
                "restored_at": datetime.now(timezone.utc).isoformat(),
                "restored_by_user_id": str(actor_user_id),
                "restore_reason": clean_reason,
                "restored_to_status": target_status,
                "previous_archived_reason": cert.rejection_reason,
            })
            archival_info["is_archived"] = False
            archival_info["last_restored_at"] = datetime.now(timezone.utc).isoformat()
            archival_info["last_restored_by_user_id"] = str(actor_user_id)
            archival_info["last_restore_reason"] = clean_reason
            archival_info["history"] = history
            pub_details["archival"] = archival_info
            cert.publication_details = pub_details

            cert.status = target_status
            if target_status not in ["REJECTED", "REVOKED"]:
                cert.rejection_reason = None

            restored_items.append({
                "id": str(cid),
                "certificate_number": cert.certificate_number,
                "restored_to_status": target_status,
            })

        try:
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error("Failed to commit bulk certificate restoration: %s", exc)
            raise ValueError(f"Database error during bulk restoration: {exc}")

        return operation_id, restored_items, failed_items

    @staticmethod
    def list_archived_certificates(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[int, List[ArchivedCertificateItem]]:
        """
        Retrieves a paginated list of archived certificates for administrative recovery.
        """
        count_stmt = (
            select(func.count(FelicitationCertificate.id))
            .where(FelicitationCertificate.status == "ARCHIVED")
        )
        total = db.scalar(count_stmt) or 0

        stmt = (
            select(FelicitationCertificate)
            .options(
                joinedload(FelicitationCertificate.authors),
                joinedload(FelicitationCertificate.author),
            )
            .where(FelicitationCertificate.status == "ARCHIVED")
            .order_by(FelicitationCertificate.updated_at.desc())
            .offset(skip)
            .limit(limit)
        )
        certs = db.scalars(stmt).unique().all()

        items: List[ArchivedCertificateItem] = []
        for c in certs:
            arch_info = (c.publication_details or {}).get("archival", {})
            prev_st = arch_info.get("previous_status") or ("REVOKED" if c.is_revoked else "UNKNOWN")
            arch_at = arch_info.get("archived_at") or (c.updated_at.isoformat() if c.updated_at else None)
            arch_by = arch_info.get("archived_by_user_id")
            arch_reason = arch_info.get("archival_reason") or c.rejection_reason
            primary_recip = c.authors[0].author_name_snapshot if c.authors else (c.author.full_name if c.author else None)

            items.append(
                ArchivedCertificateItem(
                    id=c.id,
                    certificate_number=c.certificate_number,
                    title=c.title,
                    certificate_type=c.certificate_type or "RESEARCH_PUBLICATION",
                    research_title=c.research_title,
                    primary_recipient=primary_recip,
                    previous_status=prev_st,
                    archived_at=arch_at,
                    archived_by_user_id=arch_by,
                    archival_reason=arch_reason,
                    is_revoked=c.is_revoked,
                    verification_token=c.verification_token,
                )
            )

        return total, items

    @staticmethod
    def bulk_verify_certificates(
        db: Session,
        *,
        certificate_numbers: Optional[List[str]] = None,
        raw_text: Optional[str] = None,
        is_admin: bool = True,
    ) -> Dict[str, Any]:
        """
        Bulk verification engine that verifies certificates independently using existing
        lifecycle rules, prevents N+1 queries, respects scheduled certificate privacy,
        and validates batch limits.
        """
        raw_candidates: List[str] = []

        if certificate_numbers:
            for n in certificate_numbers:
                if n and isinstance(n, str) and n.strip():
                    raw_candidates.append(n.strip())

        if raw_text:
            lines = raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
            for line in lines:
                line_str = line.strip()
                if not line_str:
                    continue
                if "," in line_str:
                    parts = [p.strip().strip('"').strip("'") for p in line_str.split(",") if p.strip()]
                    if parts and parts[0].lower() in ["certificate_number", "cert_number", "cert_no", "certificate", "number", "id"]:
                        continue
                    if len(parts) >= 1 and ("CSJMU" in parts[0] or "CERT" in parts[0] or "/" in parts[0]):
                        raw_candidates.append(parts[0])
                    else:
                        for p in parts:
                            if p and p.lower() not in ["certificate_number", "status", "name", "date"]:
                                raw_candidates.append(p)
                else:
                    if line_str.lower() not in ["certificate_number", "cert_number", "cert_no", "certificate", "number", "id"]:
                        raw_candidates.append(line_str)

        if not raw_candidates:
            return {
                "total_submitted": 0,
                "valid_count": 0,
                "scheduled_count": 0,
                "revoked_count": 0,
                "superseded_count": 0,
                "not_found_count": 0,
                "invalid_count": 0,
                "duplicate_count": 0,
                "results": [],
            }

        MAX_BATCH_LIMIT = 250
        if len(raw_candidates) > MAX_BATCH_LIMIT:
            raise ValueError(f"Batch size limit exceeded. Maximum {MAX_BATCH_LIMIT} certificates allowed per verification request (received {len(raw_candidates)}).")

        seen_numbers = set()
        cleaned_valid_set = set()
        items_prep: List[Dict[str, Any]] = []

        for item in raw_candidates:
            clean_item = item.strip().strip('"').strip("'")
            is_dup = clean_item.upper() in seen_numbers
            seen_numbers.add(clean_item.upper())

            is_malformed = (
                len(clean_item) < 3
                or len(clean_item) > 100
                or any(ch in clean_item for ch in ["<", ">", ";", "{", "}", "\0", "`"])
            )

            if is_malformed:
                items_prep.append({
                    "input_text": clean_item,
                    "clean_number": clean_item,
                    "is_malformed": True,
                    "is_duplicate": is_dup,
                })
            else:
                items_prep.append({
                    "input_text": clean_item,
                    "clean_number": clean_item,
                    "is_malformed": False,
                    "is_duplicate": is_dup,
                })
                cleaned_valid_set.add(clean_item)

        cert_map: Dict[str, FelicitationCertificate] = {}
        token_map: Dict[str, FelicitationCertificate] = {}
        replacements_map: Dict[uuid.UUID, str] = {}

        if cleaned_valid_set:
            valid_list = list(cleaned_valid_set)
            stmt = (
                select(FelicitationCertificate)
                .options(
                    selectinload(FelicitationCertificate.authors),
                    joinedload(FelicitationCertificate.author),
                    joinedload(FelicitationCertificate.publication),
                    joinedload(FelicitationCertificate.bulletin),
                )
                .where(
                    or_(
                        FelicitationCertificate.certificate_number.in_(valid_list),
                        FelicitationCertificate.verification_token.in_(valid_list),
                    )
                )
            )
            found_certs = db.scalars(stmt).unique().all()
            for fc in found_certs:
                if fc.certificate_number:
                    cert_map[fc.certificate_number.strip().upper()] = fc
                if fc.verification_token:
                    token_map[fc.verification_token.strip().upper()] = fc

            superseded_ids = [fc.id for fc in found_certs if fc.status == "SUPERSEDED"]
            if superseded_ids:
                rep_stmt = (
                    select(FelicitationCertificate.reissued_from_id, FelicitationCertificate.certificate_number)
                    .where(
                        FelicitationCertificate.reissued_from_id.in_(superseded_ids),
                        FelicitationCertificate.status != "REVOKED",
                    )
                )
                for parent_id, rep_no in db.execute(rep_stmt).all():
                    if parent_id and parent_id not in replacements_map:
                        replacements_map[parent_id] = rep_no

        results: List[Dict[str, Any]] = []
        valid_cnt = 0
        scheduled_cnt = 0
        revoked_cnt = 0
        superseded_cnt = 0
        not_found_cnt = 0
        invalid_cnt = 0
        duplicate_cnt = 0

        for prep in items_prep:
            if prep["is_duplicate"]:
                duplicate_cnt += 1

            if prep["is_malformed"]:
                invalid_cnt += 1
                results.append({
                    "input_text": prep["input_text"],
                    "certificate_number": prep["input_text"],
                    "status": "INVALID",
                    "is_valid": False,
                    "is_duplicate": prep["is_duplicate"],
                    "error_message": "Malformed certificate number format.",
                })
                continue

            query_key = prep["clean_number"].upper()
            cert = cert_map.get(query_key) or token_map.get(query_key)

            if not cert or cert.status == "ARCHIVED":
                not_found_cnt += 1
                results.append({
                    "input_text": prep["input_text"],
                    "certificate_number": prep["clean_number"],
                    "status": "NOT FOUND",
                    "is_valid": False,
                    "is_duplicate": prep["is_duplicate"],
                    "error_message": "Certificate number does not exist in SAMIKSHA ledger.",
                })
                continue

            author_names = []
            if cert.authors:
                for a in cert.authors:
                    if a.author_name_snapshot:
                        author_names.append(a.author_name_snapshot)
            elif cert.author and cert.author.full_name:
                author_names.append(cert.author.full_name)
            recipient_str = ", ".join(author_names) if author_names else "Distinguished Scholar"

            effective_res_title = cert.research_title or (cert.publication.title if cert.publication else None)

            if cert.is_revoked or cert.status == "REVOKED":
                revoked_cnt += 1
                results.append({
                    "input_text": prep["input_text"],
                    "certificate_number": cert.certificate_number,
                    "certificate_id": str(cert.id),
                    "title": cert.title,
                    "certificate_type": cert.certificate_type,
                    "recipient_name": recipient_str,
                    "research_title": effective_res_title,
                    "status": "REVOKED",
                    "is_valid": False,
                    "is_revoked": True,
                    "is_duplicate": prep["is_duplicate"],
                    "revocation_reason": cert.revocation_reason or "Institutional revocation",
                    "revoked_at": cert.revoked_at.isoformat() if cert.revoked_at else None,
                    "sha256_checksum": cert.checksum_sha256,
                    "error_message": f"Certificate revoked: {cert.revocation_reason or 'Institutional revocation'}",
                })
            elif cert.status == "SUPERSEDED":
                superseded_cnt += 1
                rep_no = replacements_map.get(cert.id)
                results.append({
                    "input_text": prep["input_text"],
                    "certificate_number": cert.certificate_number,
                    "certificate_id": str(cert.id),
                    "title": cert.title,
                    "certificate_type": cert.certificate_type,
                    "recipient_name": recipient_str,
                    "research_title": effective_res_title,
                    "status": "SUPERSEDED",
                    "is_valid": False,
                    "is_superseded": True,
                    "is_duplicate": prep["is_duplicate"],
                    "replacement_certificate_number": rep_no,
                    "reissued_reason": cert.reissued_reason,
                    "sha256_checksum": cert.checksum_sha256,
                    "error_message": f"Certificate superseded by replacement: {rep_no or 'See updated issuance'}",
                })
            elif cert.status == "SCHEDULED":
                if not is_admin:
                    not_found_cnt += 1
                    results.append({
                        "input_text": prep["input_text"],
                        "certificate_number": prep["clean_number"],
                        "status": "NOT FOUND",
                        "is_valid": False,
                        "is_duplicate": prep["is_duplicate"],
                        "error_message": "Certificate number does not exist.",
                    })
                else:
                    scheduled_cnt += 1
                    results.append({
                        "input_text": prep["input_text"],
                        "certificate_number": cert.certificate_number,
                        "certificate_id": str(cert.id),
                        "title": cert.title,
                        "certificate_type": cert.certificate_type,
                        "recipient_name": recipient_str,
                        "research_title": effective_res_title,
                        "status": "SCHEDULED",
                        "is_valid": False,
                        "is_scheduled": True,
                        "is_duplicate": prep["is_duplicate"],
                        "scheduled_issue_date": cert.scheduled_issue_date.isoformat() if cert.scheduled_issue_date else None,
                        "verification_token": cert.verification_token,
                        "sha256_checksum": cert.checksum_sha256,
                        "error_message": f"Certificate scheduled for activation on {cert.scheduled_issue_date or 'future date'}.",
                    })
            elif cert.status == "ISSUED":
                valid_cnt += 1
                results.append({
                    "input_text": prep["input_text"],
                    "certificate_number": cert.certificate_number,
                    "certificate_id": str(cert.id),
                    "title": cert.title,
                    "certificate_type": cert.certificate_type,
                    "recipient_name": recipient_str,
                    "research_title": effective_res_title,
                    "status": "VALID / ISSUED",
                    "is_valid": True,
                    "is_duplicate": prep["is_duplicate"],
                    "issue_date": cert.scheduled_issue_date.isoformat() if cert.scheduled_issue_date else (cert.issued_at.strftime("%Y-%m-%d") if cert.issued_at else None),
                    "verification_token": cert.verification_token,
                    "sha256_checksum": cert.checksum_sha256,
                })
            else:
                if is_admin:
                    results.append({
                        "input_text": prep["input_text"],
                        "certificate_number": cert.certificate_number,
                        "certificate_id": str(cert.id),
                        "status": f"PENDING ({cert.status})",
                        "is_valid": False,
                        "is_duplicate": prep["is_duplicate"],
                        "error_message": f"Certificate not finalized (Status: {cert.status}).",
                    })
                else:
                    not_found_cnt += 1
                    results.append({
                        "input_text": prep["input_text"],
                        "certificate_number": prep["clean_number"],
                        "status": "NOT FOUND",
                        "is_valid": False,
                        "is_duplicate": prep["is_duplicate"],
                        "error_message": "Certificate number does not exist.",
                    })

        return {
            "total_submitted": len(raw_candidates),
            "valid_count": valid_cnt,
            "scheduled_count": scheduled_cnt,
            "revoked_count": revoked_cnt,
            "superseded_count": superseded_cnt,
            "not_found_count": not_found_cnt,
            "invalid_count": invalid_cnt,
            "duplicate_count": duplicate_cnt,
            "results": results,
        }

    # ========================================================================
    # 5B. BULK CERTIFICATE GENERATION & DUAL-AUTHORITY WORKFLOW SUBSYSTEM
    # ========================================================================

    @staticmethod
    def normalize_researcher_name(name: str) -> str:
        """
        Normalizes researcher names by removing honorifics, titles, and extra whitespace.
        Used for resilient author matching against the SAMIKSHA Researcher Repository.
        """
        if not name:
            return ""
        cleaned = name.strip()
        prefixes = [
            "prof. dr.", "prof dr", "prof.", "prof", "dr.", "dr",
            "mr.", "mr", "mrs.", "mrs", "ms.", "ms", "er.", "er"
        ]
        lower_cleaned = cleaned.lower()
        for p in prefixes:
            if lower_cleaned.startswith(p + " ") or lower_cleaned.startswith(p + "."):
                cleaned = cleaned[len(p):].lstrip(" .")
                lower_cleaned = cleaned.lower()
                break

        normalized = re.sub(r'[^a-zA-Z0-9\s]', ' ', cleaned)
        normalized = re.sub(r'\s+', ' ', normalized).strip().lower()
        return normalized

    @staticmethod
    def match_author_against_repository(
        db: Session, author_in: BulkAuthorInput
    ) -> AuthorMatchItem:
        """
        Matches an author against the canonical SAMIKSHA Researcher Repository (ResearchAuthor).
        3-Tier Priority:
        1. Exact researcher_id (UUID match)
        2. Exact scopus_id (Case-insensitive exact match)
        3. Normalized full_name + department / affiliation match.
        CRITICAL TITLE RULE: academic_title_snapshot is strictly derived from author_in.certificate_title
        (or None) and NEVER copied from the researcher profile.
        """
        raw_res = author_in.researcher
        title_snapshot = author_in.certificate_title.strip() if author_in.certificate_title else None

        # Priority 1: Exact researcher_id (UUID)
        if raw_res.researcher_id:
            cand = db.get(ResearchAuthor, raw_res.researcher_id)
            if cand:
                return AuthorMatchItem(
                    input_full_name=raw_res.full_name,
                    input_scopus_id=raw_res.scopus_id,
                    input_department=raw_res.department,
                    certificate_title=title_snapshot,
                    author_role=author_in.author_role,
                    status="MATCHED",
                    matched_author_id=str(cand.id),
                    matched_author_name=cand.full_name,
                    matched_by="UUID",
                    candidates=[
                        AuthorCandidate(
                            id=str(cand.id),
                            full_name=cand.full_name,
                            scopus_id=cand.scopus_id,
                            department=cand.department,
                            institutional_affiliation=cand.institutional_affiliation,
                            is_verified=cand.is_verified,
                        )
                    ],
                )

        # Priority 2: Exact scopus_id match
        if raw_res.scopus_id and raw_res.scopus_id.strip():
            clean_scopus = raw_res.scopus_id.strip()
            stmt = select(ResearchAuthor).where(
                func.lower(func.trim(ResearchAuthor.scopus_id)) == clean_scopus.lower()
            )
            scopus_matches = db.scalars(stmt).all()
            if len(scopus_matches) == 1:
                cand = scopus_matches[0]
                return AuthorMatchItem(
                    input_full_name=raw_res.full_name,
                    input_scopus_id=raw_res.scopus_id,
                    input_department=raw_res.department,
                    certificate_title=title_snapshot,
                    author_role=author_in.author_role,
                    status="MATCHED",
                    matched_author_id=str(cand.id),
                    matched_author_name=cand.full_name,
                    matched_by="SCOPUS_ID",
                    candidates=[
                        AuthorCandidate(
                            id=str(cand.id),
                            full_name=cand.full_name,
                            scopus_id=cand.scopus_id,
                            department=cand.department,
                            institutional_affiliation=cand.institutional_affiliation,
                            is_verified=cand.is_verified,
                        )
                    ],
                )
            elif len(scopus_matches) > 1:
                candidates_out = [
                    AuthorCandidate(
                        id=str(m.id),
                        full_name=m.full_name,
                        scopus_id=m.scopus_id,
                        department=m.department,
                        institutional_affiliation=m.institutional_affiliation,
                        is_verified=m.is_verified,
                    )
                    for m in scopus_matches
                ]
                return AuthorMatchItem(
                    input_full_name=raw_res.full_name,
                    input_scopus_id=raw_res.scopus_id,
                    input_department=raw_res.department,
                    certificate_title=title_snapshot,
                    author_role=author_in.author_role,
                    status="AMBIGUOUS",
                    candidates=candidates_out,
                )

        # Priority 3: Normalized name + department
        norm_input = SamaCmsService.normalize_researcher_name(raw_res.full_name)
        if not norm_input:
            return AuthorMatchItem(
                input_full_name=raw_res.full_name,
                input_scopus_id=raw_res.scopus_id,
                input_department=raw_res.department,
                certificate_title=title_snapshot,
                author_role=author_in.author_role,
                status="NOT_FOUND",
                candidates=[],
            )

        # Query all authors and match normalized names
        all_authors = db.scalars(select(ResearchAuthor)).all()
        candidate_records = []
        for author in all_authors:
            norm_db_name = SamaCmsService.normalize_researcher_name(author.full_name)
            if norm_db_name == norm_input:
                candidate_records.append(author)

        if not candidate_records:
            return AuthorMatchItem(
                input_full_name=raw_res.full_name,
                input_scopus_id=raw_res.scopus_id,
                input_department=raw_res.department,
                certificate_title=title_snapshot,
                author_role=author_in.author_role,
                status="NOT_FOUND",
                candidates=[],
            )

        candidates_out = [
            AuthorCandidate(
                id=str(m.id),
                full_name=m.full_name,
                scopus_id=m.scopus_id,
                department=m.department,
                institutional_affiliation=m.institutional_affiliation,
                is_verified=m.is_verified,
            )
            for m in candidate_records
        ]

        if len(candidate_records) == 1:
            cand = candidate_records[0]
            return AuthorMatchItem(
                input_full_name=raw_res.full_name,
                input_scopus_id=raw_res.scopus_id,
                input_department=raw_res.department,
                certificate_title=title_snapshot,
                author_role=author_in.author_role,
                status="MATCHED",
                matched_author_id=str(cand.id),
                matched_author_name=cand.full_name,
                matched_by="NORMALIZED_NAME",
                candidates=candidates_out,
            )

        # If multiple candidates, try disambiguating with department
        if raw_res.department and raw_res.department.strip():
            dept_input = raw_res.department.strip().lower()
            dept_filtered = [
                c for c in candidate_records
                if c.department and dept_input in c.department.lower()
            ]
            if len(dept_filtered) == 1:
                cand = dept_filtered[0]
                return AuthorMatchItem(
                    input_full_name=raw_res.full_name,
                    input_scopus_id=raw_res.scopus_id,
                    input_department=raw_res.department,
                    certificate_title=title_snapshot,
                    author_role=author_in.author_role,
                    status="MATCHED",
                    matched_author_id=str(cand.id),
                    matched_author_name=cand.full_name,
                    matched_by="NORMALIZED_NAME",
                    candidates=candidates_out,
                )

        return AuthorMatchItem(
            input_full_name=raw_res.full_name,
            input_scopus_id=raw_res.scopus_id,
            input_department=raw_res.department,
            certificate_title=title_snapshot,
            author_role=author_in.author_role,
            status="AMBIGUOUS",
            candidates=candidates_out,
        )

    @staticmethod
    def preview_bulk_certificate_upload(
        db: Session, payload: BulkCertificateUploadPayload
    ) -> BulkCertificatePreviewResponse:
        """
        Validates bulk certificate JSON upload, performs researcher repository matching,
        and generates a detailed interactive preview before certificates are created.
        """
        preview_items: List[BulkCertificatePreviewItem] = []
        valid_certs = 0
        invalid_certs = 0
        total_authors = 0
        matched_authors = 0
        ambiguous_authors = 0
        not_found_authors = 0

        for idx, cert_item in enumerate(payload.certificates):
            errors = []
            if not cert_item.research_title or len(cert_item.research_title.strip()) < 3:
                errors.append("Research title is required (at least 3 characters).")
            if not cert_item.authors:
                errors.append("At least one author must be specified.")

            author_matches: List[AuthorMatchItem] = []
            for a_in in cert_item.authors:
                total_authors += 1
                match_res = SamaCmsService.match_author_against_repository(db, a_in)
                author_matches.append(match_res)
                if match_res.status == "MATCHED":
                    matched_authors += 1
                elif match_res.status == "AMBIGUOUS":
                    ambiguous_authors += 1
                else:
                    not_found_authors += 1

            if payload.batch.certificate_type == "INCENTIVE_AWARD" and not cert_item.incentive_details:
                errors.append("Incentive award details are required for INCENTIVE_AWARD certificates.")

            is_valid = len(errors) == 0
            if is_valid:
                valid_certs += 1
            else:
                invalid_certs += 1

            preview_items.append(
                BulkCertificatePreviewItem(
                    index=idx,
                    research_title=cert_item.research_title,
                    certificate_type=payload.batch.certificate_type,
                    issue_date=payload.batch.issue_date.isoformat(),
                    is_valid=is_valid,
                    validation_errors=errors,
                    authors=author_matches,
                    publication_details=cert_item.publication_details,
                    incentive_details=cert_item.incentive_details,
                )
            )

        return BulkCertificatePreviewResponse(
            batch=payload.batch,
            total_certificates=len(payload.certificates),
            valid_certificates_count=valid_certs,
            invalid_certificates_count=invalid_certs,
            total_authors=total_authors,
            matched_authors_count=matched_authors,
            ambiguous_authors_count=ambiguous_authors,
            not_found_authors_count=not_found_authors,
            certificates=preview_items,
        )

    @staticmethod
    def generate_bulk_certificates(
        db: Session,
        payload: BulkCertificateGenerateRequest,
        actor_user_id: uuid.UUID,
    ) -> BulkCertificateGenerateResponse:
        """
        Creates certificates in PENDING_DEAN_APPROVAL status from a validated bulk batch.
        Associates batch metadata in publication_details["batch"] without requiring DDL migrations.
        Applies explicit certificate_title (NEVER copied from repository profile).
        Initializes approval ledger records for DEAN_RD and VICE_CHANCELLOR.
        """
        batch_id = uuid.uuid4()
        created_certs: List[BulkCertificateGenerateResultItem] = []
        failed_items: List[Dict[str, Any]] = []

        IST = ZoneInfo("Asia/Kolkata")
        today_ist = datetime.now(timezone.utc).astimezone(IST).date()
        sched_date = payload.batch.issue_date
        validate_issue_date(sched_date)

        # Build resolution map: cert_idx -> {author_idx: resolved_author_id}
        res_map: Dict[int, Dict[int, Optional[uuid.UUID]]] = {}
        if payload.resolutions:
            for c_res in payload.resolutions:
                if c_res.authors:
                    res_map[c_res.certificate_index] = {
                        a_res.author_index: a_res.resolved_author_id
                        for a_res in c_res.authors
                    }

        # Look up active signatories for initial approval entries
        dean_sig = SamaCmsService.get_active_signatory(db, "DEAN_RD")
        vc_sig = SamaCmsService.get_active_signatory(db, "VICE_CHANCELLOR")

        # Resolve bulletin metadata if supplied
        b_vol = payload.batch.bulletin.volume if payload.batch.bulletin else None
        b_issue = payload.batch.bulletin.issue if payload.batch.bulletin else None
        b_period = payload.batch.bulletin.period if payload.batch.bulletin else None

        batch_cert_numbers = set()
        batch_tokens = set()

        for idx, item in enumerate(payload.certificates):
            try:
                item_cert_num = None
                item_token = None

                # 1. Resolve & validate manual certificate number if supplied
                raw_c_num = getattr(item, "certificate_number", None)
                if raw_c_num and str(raw_c_num).strip():
                    try:
                        clean_c_num = SamaCmsService.validate_manual_certificate_number(raw_c_num)
                    except ValueError as val_err:
                        failed_items.append({"index": idx, "reason": str(val_err)})
                        continue

                    if clean_c_num in batch_cert_numbers:
                        failed_items.append({"index": idx, "reason": f"Duplicate certificate number '{clean_c_num}' within batch."})
                        continue
                    if SamaCmsService.get_certificate_by_number(db, clean_c_num) or SamaCmsService.get_certificate_by_token(db, clean_c_num):
                        failed_items.append({"index": idx, "reason": f"Certificate number '{clean_c_num}' already exists or conflicts with an existing token."})
                        continue
                    item_cert_num = clean_c_num
                    batch_cert_numbers.add(clean_c_num)
                else:
                    item_cert_num = SamaCmsService.generate_unique_certificate_number(db)
                    batch_cert_numbers.add(item_cert_num)

                # 2. Resolve & validate manual verification identifier if supplied
                raw_tok = getattr(item, "verification_identifier", None) or getattr(item, "verification_token", None)
                if raw_tok and str(raw_tok).strip():
                    try:
                        clean_tok = SamaCmsService.validate_manual_verification_identifier(raw_tok)
                    except ValueError as val_err:
                        failed_items.append({"index": idx, "reason": str(val_err)})
                        continue

                    if clean_tok in batch_tokens:
                        failed_items.append({"index": idx, "reason": f"Duplicate verification identifier '{clean_tok}' within batch."})
                        continue
                    if SamaCmsService.get_certificate_by_token(db, clean_tok) or SamaCmsService.get_certificate_by_number(db, clean_tok):
                        failed_items.append({"index": idx, "reason": f"Verification identifier '{clean_tok}' already exists or conflicts with an existing certificate number."})
                        continue
                    item_token = clean_tok
                    batch_tokens.add(clean_tok)
                else:
                    item_token = uuid.uuid4().hex
                    batch_tokens.add(item_token)

                cert_num = item_cert_num
                token = item_token

                # Default titles based on certificate type
                cert_title = (
                    "CERTIFICATE OF RESEARCH FELICITATION"
                    if payload.batch.certificate_type == "RESEARCH_PUBLICATION"
                    else "RESEARCH INCENTIVE CONFERMENT"
                )
                pres_stmt = (
                    "is proudly presented to"
                    if payload.batch.certificate_type == "RESEARCH_PUBLICATION"
                    else "is officially conferred upon"
                )

                # Persist batch metadata into publication_details JSONB
                pub_details = dict(item.publication_details or {})
                if item.incentive_details:
                    pub_details.update(item.incentive_details)
                pub_details["batch"] = {
                    "batch_id": str(batch_id),
                    "batch_name": payload.batch.batch_name,
                    "certificate_type": payload.batch.certificate_type,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }

                cert = FelicitationCertificate(
                    certificate_number=cert_num,
                    certificate_type=payload.batch.certificate_type,
                    status="PENDING_DEAN_APPROVAL",
                    title=cert_title,
                    presentation_statement=pres_stmt,
                    research_contribution_statement=item.research_contribution_statement,
                    research_title=item.research_title,
                    publication_details=pub_details,
                    verification_token=token,
                    bulletin_volume_snapshot=b_vol,
                    bulletin_issue_snapshot=b_issue,
                    bulletin_period_snapshot=b_period,
                    created_by_user_id=actor_user_id,
                    scheduled_issue_date=sched_date,
                    activated_at=None,
                    issued_at=None,
                )
                db.add(cert)
                db.flush()

                primary_author_id = None
                for a_idx, a_in in enumerate(item.authors):
                    # Check manual resolution first, then auto-match
                    resolved_id = None
                    if idx in res_map and a_idx in res_map[idx]:
                        resolved_id = res_map[idx][a_idx]
                    else:
                        match_res = SamaCmsService.match_author_against_repository(db, a_in)
                        if match_res.status == "MATCHED" and match_res.matched_author_id:
                            resolved_id = uuid.UUID(match_res.matched_author_id)

                    author_obj = db.get(ResearchAuthor, resolved_id) if resolved_id else None
                    if a_idx == 0 and author_obj:
                        primary_author_id = author_obj.id

                    dept_clean = author_obj.department if author_obj else a_in.researcher.department
                    if dept_clean and dept_clean.strip().lower() == "department of research":
                        dept_clean = None

                    # CRITICAL TITLE RULE: academic_title_snapshot is strictly taken from certificate_title
                    c_title = a_in.certificate_title.strip() if a_in.certificate_title else None

                    c_auth = CertificateAuthor(
                        certificate_id=cert.id,
                        researcher_id=author_obj.id if author_obj else None,
                        author_name_snapshot=a_in.researcher.full_name,
                        academic_title_snapshot=c_title,
                        scopus_id_snapshot=author_obj.scopus_id if author_obj else a_in.researcher.scopus_id,
                        department_snapshot=dept_clean,
                        designation_snapshot=None,
                        affiliation_snapshot=author_obj.institutional_affiliation if author_obj else (a_in.researcher.institutional_affiliation or "Chhatrapati Shahu Ji Maharaj University, Kanpur"),
                        author_order=a_idx + 1,
                        author_role=a_in.author_role or ("Lead Author" if a_idx == 0 else "Co-Author"),
                    )
                    db.add(c_auth)

                if primary_author_id:
                    cert.author_id = primary_author_id

                # Initialize dual authority approval records
                appr_dean = CertificateApproval(
                    certificate_id=cert.id,
                    authority_type="DEAN_RD",
                    signatory_id=dean_sig.id if dean_sig else None,
                    signatory_name_snapshot=dean_sig.signatory_name if dean_sig else "Dean – Research & Development",
                    designation_snapshot=dean_sig.designation if dean_sig else "Dean – Research & Development",
                    signature_image_path_snapshot=dean_sig.signature_image_path if dean_sig else None,
                    signature_asset_version_snapshot=dean_sig.signature_asset_version if dean_sig else 1,
                    status="PENDING",
                )
                db.add(appr_dean)

                appr_vc = CertificateApproval(
                    certificate_id=cert.id,
                    authority_type="VICE_CHANCELLOR",
                    signatory_id=vc_sig.id if vc_sig else None,
                    signatory_name_snapshot=vc_sig.signatory_name if vc_sig else "Vice Chancellor",
                    designation_snapshot=vc_sig.designation if vc_sig else "Vice Chancellor",
                    signature_image_path_snapshot=vc_sig.signature_image_path if vc_sig else None,
                    signature_asset_version_snapshot=vc_sig.signature_asset_version if vc_sig else 1,
                    status="PENDING",
                )
                db.add(appr_vc)

                db.flush()
                created_certs.append(
                    BulkCertificateGenerateResultItem(
                        index=idx,
                        certificate_id=str(cert.id),
                        certificate_number=cert.certificate_number,
                        research_title=cert.research_title,
                        status=cert.status,
                        authors_count=len(item.authors),
                    )
                )
            except Exception as exc:
                logger.error(f"Error creating batch certificate item {idx}: {exc}")
                failed_items.append({"index": idx, "research_title": item.research_title, "error": str(exc)})

        db.commit()

        return BulkCertificateGenerateResponse(
            batch_id=str(batch_id),
            batch_name=payload.batch.batch_name,
            certificate_type=payload.batch.certificate_type,
            total_requested=len(payload.certificates),
            created_count=len(created_certs),
            failed_count=len(failed_items),
            created_certificates=created_certs,
            failed_items=failed_items,
        )

    @staticmethod
    def bulk_submit_to_dean(
        db: Session,
        certificate_ids: List[uuid.UUID],
        actor_user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Submits selected certificates from a generated batch to the Dean approval queue.
        Transitions status to PENDING_DEAN_APPROVAL.
        """
        submitted_ids: List[str] = []
        failed_items: List[Dict[str, Any]] = []

        for cid in certificate_ids:
            cert = db.get(FelicitationCertificate, cid)
            if not cert:
                failed_items.append({"id": str(cid), "reason": "Certificate not found."})
                continue
            if cert.status in ["ISSUED", "SCHEDULED", "ARCHIVED", "REVOKED"]:
                failed_items.append({"id": str(cid), "reason": f"Cannot submit certificate in '{cert.status}' state."})
                continue

            cert.status = "PENDING_DEAN_APPROVAL"
            submitted_ids.append(str(cert.id))

        db.commit()
        return {
            "total_requested": len(certificate_ids),
            "submitted_count": len(submitted_ids),
            "failed_count": len(failed_items),
            "submitted_ids": submitted_ids,
            "failed_items": failed_items,
        }

    @staticmethod
    def bulk_forward_to_vc(
        db: Session,
        certificate_ids: List[uuid.UUID],
        actor_user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Forwards Dean-approved certificates to the Vice Chancellor approval queue.
        Validates that each certificate has received Dean approval.
        """
        forwarded_ids: List[str] = []
        failed_items: List[Dict[str, Any]] = []

        for cid in certificate_ids:
            cert = db.get(FelicitationCertificate, cid)
            if not cert:
                failed_items.append({"id": str(cid), "reason": "Certificate not found."})
                continue

            dean_appr = next((ap for ap in cert.approvals if ap.authority_type == "DEAN_RD"), None)
            if not dean_appr or dean_appr.status != "APPROVED":
                failed_items.append({
                    "id": str(cid),
                    "reason": "Certificate has not been approved by Dean – R&D yet."
                })
                continue

            cert.status = "PENDING_VC_APPROVAL"
            forwarded_ids.append(str(cert.id))

        db.commit()
        return {
            "total_requested": len(certificate_ids),
            "forwarded_count": len(forwarded_ids),
            "failed_count": len(failed_items),
            "forwarded_ids": forwarded_ids,
            "failed_items": failed_items,
        }

    @staticmethod
    def bulk_process_authority_approval(
        db: Session,
        certificate_ids: List[uuid.UUID],
        authority_type: str,
        action: str,
        remarks: Optional[str],
        actor_user_id: uuid.UUID,
        base_verification_url: str = "https://vyasa.csjmu.ac.in",
    ) -> BulkApprovalResponse:
        """
        Dual-authority bulk approval and rejection engine for Dean – R&D and Vice Chancellor.
        Enforces:
        - Dean approves PENDING_DEAN_APPROVAL -> PENDING_VC_APPROVAL.
        - VC approves PENDING_VC_APPROVAL -> Final cryptographic sealing and transition to ISSUED/SCHEDULED.
        - Rejection requires mandatory remarks and updates status to REJECTED.
        - Neither authority can impersonate or bypass the other.
        """
        op_id = str(uuid.uuid4())
        norm_auth = authority_type.strip().upper()
        norm_act = action.strip().upper()

        if norm_act == "REJECT" and (not remarks or not remarks.strip()):
            raise ValueError("Institutional rejection remarks are strictly mandatory.")

        results: List[BulkApprovalResultItem] = []
        success_count = 0
        failure_count = 0

        for cid in certificate_ids:
            cert = db.get(FelicitationCertificate, cid)
            if not cert:
                failure_count += 1
                results.append(
                    BulkApprovalResultItem(
                        certificate_id=str(cid),
                        certificate_number="UNKNOWN",
                        previous_status="UNKNOWN",
                        new_status="UNKNOWN",
                        authority=norm_auth,
                        action=norm_act,
                        success=False,
                        error="Certificate record not found.",
                    )
                )
                continue

            prev_status = cert.status

            # Enforce workflow stage prerequisites
            if norm_auth == "DEAN_RD":
                if cert.status not in ["PENDING_DEAN_APPROVAL", "DRAFT"]:
                    failure_count += 1
                    results.append(
                        BulkApprovalResultItem(
                            certificate_id=str(cert.id),
                            certificate_number=cert.certificate_number,
                            previous_status=prev_status,
                            new_status=prev_status,
                            authority=norm_auth,
                            action=norm_act,
                            success=False,
                            error=f"Certificate cannot be approved by Dean in '{prev_status}' status.",
                        )
                    )
                    continue
            elif norm_auth == "VICE_CHANCELLOR":
                # VC requires prior Dean approval
                dean_appr = next((ap for ap in cert.approvals if ap.authority_type == "DEAN_RD"), None)
                if not dean_appr or dean_appr.status != "APPROVED":
                    failure_count += 1
                    results.append(
                        BulkApprovalResultItem(
                            certificate_id=str(cert.id),
                            certificate_number=cert.certificate_number,
                            previous_status=prev_status,
                            new_status=prev_status,
                            authority=norm_auth,
                            action=norm_act,
                            success=False,
                            error="Certificate must be approved by Dean – R&D prior to Vice Chancellor review.",
                        )
                    )
                    continue

                if cert.status != "PENDING_VC_APPROVAL" and norm_act == "APPROVE":
                    failure_count += 1
                    results.append(
                        BulkApprovalResultItem(
                            certificate_id=str(cert.id),
                            certificate_number=cert.certificate_number,
                            previous_status=prev_status,
                            new_status=prev_status,
                            authority=norm_auth,
                            action=norm_act,
                            success=False,
                            error=f"Certificate is in '{prev_status}' status, expecting 'PENDING_VC_APPROVAL'.",
                        )
                    )
                    continue

            try:
                updated_cert = SamaCmsService.process_authority_approval(
                    db,
                    cert,
                    authority_type=norm_auth,
                    action=norm_act,
                    remarks=remarks,
                    user_id=actor_user_id,
                    base_verification_url=base_verification_url,
                )
                success_count += 1
                results.append(
                    BulkApprovalResultItem(
                        certificate_id=str(updated_cert.id),
                        certificate_number=updated_cert.certificate_number,
                        previous_status=prev_status,
                        new_status=updated_cert.status,
                        authority=norm_auth,
                        action=norm_act,
                        success=True,
                    )
                )
            except Exception as exc:
                failure_count += 1
                logger.error(f"Error processing bulk approval for cert {cert.certificate_number}: {exc}")
                results.append(
                    BulkApprovalResultItem(
                        certificate_id=str(cert.id),
                        certificate_number=cert.certificate_number,
                        previous_status=prev_status,
                        new_status=prev_status,
                        authority=norm_auth,
                        action=norm_act,
                        success=False,
                        error=str(exc),
                    )
                )

        return BulkApprovalResponse(
            operation_id=op_id,
            authority=norm_auth,
            action=norm_act,
            total_requested=len(certificate_ids),
            success_count=success_count,
            failure_count=failure_count,
            results=results,
        )

    @staticmethod
    def list_batches(
        db: Session,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[int, List[BatchSummaryItem]]:
        """
        Lists all bulk certificate batches grouped from certificate JSONB metadata.
        Compatible across both PostgreSQL and SQLite.
        """
        stmt = (
            select(FelicitationCertificate)
            .where(FelicitationCertificate.publication_details.is_not(None))
            .order_by(FelicitationCertificate.created_at.desc())
        )
        certs = db.scalars(stmt).all()

        batches_map: Dict[str, Dict[str, Any]] = {}
        for c in certs:
            pub_data = c.publication_details or {}
            b_info = pub_data.get("batch")
            if not b_info or not isinstance(b_info, dict) or "batch_id" not in b_info:
                continue

            bid = str(b_info["batch_id"])
            if bid not in batches_map:
                batches_map[bid] = {
                    "batch_id": bid,
                    "batch_name": b_info.get("batch_name", "Certificate Batch"),
                    "certificate_type": b_info.get("certificate_type", c.certificate_type or "RESEARCH_PUBLICATION"),
                    "created_at": b_info.get("created_at", c.created_at.isoformat() if c.created_at else datetime.now(timezone.utc).isoformat()),
                    "total_certificates": 0,
                    "pending_dean_count": 0,
                    "pending_vc_count": 0,
                    "issued_count": 0,
                    "scheduled_count": 0,
                    "rejected_count": 0,
                    "archived_count": 0,
                }

            b = batches_map[bid]
            b["total_certificates"] += 1
            st = c.status.upper() if c.status else ""
            if st in ["PENDING_DEAN_APPROVAL", "DRAFT"]:
                b["pending_dean_count"] += 1
            elif st == "PENDING_VC_APPROVAL":
                b["pending_vc_count"] += 1
            elif st == "ISSUED":
                b["issued_count"] += 1
            elif st == "SCHEDULED":
                b["scheduled_count"] += 1
            elif st == "REJECTED":
                b["rejected_count"] += 1
            elif st == "ARCHIVED":
                b["archived_count"] += 1

        total = len(batches_map)
        sorted_batches = sorted(
            batches_map.values(),
            key=lambda x: x["created_at"],
            reverse=True,
        )
        paginated = sorted_batches[skip : skip + limit]
        items = [BatchSummaryItem(**b) for b in paginated]
        return total, items

    @staticmethod
    def get_batch_detail(db: Session, batch_id: str) -> Optional[BatchDetailResponse]:
        """
        Retrieves detailed information and certificate items for a specific batch.
        """
        stmt = (
            select(FelicitationCertificate)
            .where(FelicitationCertificate.publication_details.is_not(None))
            .order_by(FelicitationCertificate.created_at.desc())
        )
        certs = db.scalars(stmt).all()

        matching_certs = []
        batch_meta: Optional[Dict[str, Any]] = None

        for c in certs:
            pub_data = c.publication_details or {}
            b_info = pub_data.get("batch")
            if b_info and isinstance(b_info, dict) and str(b_info.get("batch_id")) == str(batch_id):
                if not batch_meta:
                    batch_meta = b_info
                matching_certs.append(c)

        if not matching_certs or not batch_meta:
            return None

        status_counts: Dict[str, int] = {}
        cert_items: List[Dict[str, Any]] = []

        for c in matching_certs:
            st = c.status.upper() if c.status else "UNKNOWN"
            status_counts[st] = status_counts.get(st, 0) + 1

            first_author = c.authors[0].author_name_snapshot if c.authors else (c.author.full_name if c.author else "Distinguished Scholar")
            cert_items.append({
                "id": str(c.id),
                "certificate_number": c.certificate_number,
                "research_title": c.research_title,
                "certificate_type": c.certificate_type,
                "status": c.status,
                "primary_author": first_author,
                "authors_count": len(c.authors),
                "scheduled_issue_date": c.scheduled_issue_date.isoformat() if c.scheduled_issue_date else None,
                "verification_token": c.verification_token,
                "checksum_sha256": c.checksum_sha256,
            })

        return BatchDetailResponse(
            batch_id=str(batch_id),
            batch_name=batch_meta.get("batch_name", "Certificate Batch"),
            certificate_type=batch_meta.get("certificate_type", "RESEARCH_PUBLICATION"),
            created_at=batch_meta.get("created_at", datetime.now(timezone.utc).isoformat()),
            total_certificates=len(matching_certs),
            status_counts=status_counts,
            certificates=cert_items,
        )

    @staticmethod
    def export_batch_zip(db: Session, batch_id: str) -> bytes:
        """
        Exports a ZIP archive for a certificate batch containing:
        1. All generated vector PDFs (if rendered/issued/scheduled)
        2. A comprehensive CSV summary manifest.
        """
        stmt = (
            select(FelicitationCertificate)
            .where(FelicitationCertificate.publication_details.is_not(None))
            .order_by(FelicitationCertificate.certificate_number.asc())
        )
        certs = db.scalars(stmt).all()

        matching_certs: List[FelicitationCertificate] = []
        for c in certs:
            pub_data = c.publication_details or {}
            b_info = pub_data.get("batch")
            if b_info and isinstance(b_info, dict) and str(b_info.get("batch_id")) == str(batch_id):
                matching_certs.append(c)

        if not matching_certs:
            raise ValueError(f"No certificates found for batch '{batch_id}'.")

        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            # 1. Summary CSV Manifest
            csv_buffer = io.StringIO()
            writer = csv.writer(csv_buffer)
            writer.writerow([
                "Certificate Number",
                "Research Title",
                "Certificate Type",
                "Status",
                "Date of Issue",
                "Primary Recipient",
                "Scopus ID",
                "Department",
                "SHA-256 Checksum",
                "Verification Token",
            ])

            for c in matching_certs:
                first_auth = c.authors[0] if c.authors else None
                recip_name = first_auth.author_name_snapshot if first_auth else (c.author.full_name if c.author else "Distinguished Scholar")
                scopus = first_auth.scopus_id_snapshot if first_auth else (c.author.scopus_id if c.author else "")
                dept = first_auth.department_snapshot if first_auth else (c.author.department if c.author else "")
                issue_d = c.scheduled_issue_date.isoformat() if c.scheduled_issue_date else ""

                writer.writerow([
                    c.certificate_number,
                    c.research_title,
                    c.certificate_type,
                    c.status,
                    issue_d,
                    recip_name,
                    scopus,
                    dept,
                    c.checksum_sha256 or "",
                    c.verification_token or "",
                ])

                # 2. Add PDF file if available
                if c.file_storage_path:
                    try:
                        file_path = storage_service.get_file_path(c.file_storage_path)
                        if file_path and file_path.exists():
                            zip_file.writestr(
                                f"certificates/{c.certificate_number.replace('/', '_')}.pdf",
                                file_path.read_bytes(),
                            )
                    except Exception as err:
                        logger.warning(f"Could not read PDF for {c.certificate_number} into ZIP: {err}")

            zip_file.writestr("manifest_summary.csv", csv_buffer.getvalue())

        return zip_buffer.getvalue()

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
