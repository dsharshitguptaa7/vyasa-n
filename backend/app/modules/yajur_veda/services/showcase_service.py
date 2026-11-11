"""
ANUDAAN (Yajur Veda) Showcase, Impact & Disbursement Service
Handles institutional impact metrics aggregation, controlled financial disbursements,
researcher recognition gallery management, and public display governance.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from sqlalchemy import desc, func, select, and_, or_
from sqlalchemy.orm import Session, joinedload

from app.core.logging import logger
from app.modules.yajur_veda.models.enums import AnudaanApplicationStatus
from app.modules.yajur_veda.models.anudaan import (
    AnudaanApplication,
    AnudaanPerson,
    AnudaanPublication,
    AnudaanPublicationAuthor,
)
from app.modules.yajur_veda.models.showcase import (
    AnudaanDisbursement,
    AnudaanGalleryItem,
    AnudaanGalleryImage,
    AnudaanPublicConfig,
    AnudaanSanctionEntry,
)
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanPublicImpactStats,
    AnudaanDisbursementCreate,
    AnudaanDisbursementOut,
    AnudaanGalleryItemCreate,
    AnudaanGalleryItemUpdate,
    AnudaanPublicConfigUpdate,
    AnudaanSanctionEntryCreate,
    AnudaanSanctionEntryUpdate,
)


class AnudaanShowcaseService:
    """Service encapsulating ANUDAAN impact analytics, disbursements, and recognition CMS."""

    # -------------------------------------------------------------------------
    # 1. Public Institutional Impact Statistics
    # -------------------------------------------------------------------------

    def get_public_impact_stats(
        self,
        db: Session,
        academic_year: Optional[str] = None,
    ) -> AnudaanPublicImpactStats:
        """
        Derives aggregated institutional metrics derived strictly from published sanction entries.
        Strictly prevents fabricated figures and excludes PII.
        """
        # Determine available academic years from published sanction entries
        years_query = (
            select(AnudaanSanctionEntry.academic_year)
            .where(AnudaanSanctionEntry.is_published.is_(True))
            .distinct()
            .order_by(desc(AnudaanSanctionEntry.academic_year))
        )
        available_years = [y for y in db.scalars(years_query).all() if y]
        if not available_years:
            available_years = ["2025-2026", "2026-2027"]

        # Base query for published sanctions
        sanctions_base = select(AnudaanSanctionEntry).where(
            AnudaanSanctionEntry.is_published.is_(True)
        )
        if academic_year and academic_year.upper() != "ALL":
            sanctions_base = sanctions_base.where(
                AnudaanSanctionEntry.academic_year == academic_year
            )

        # 1. Total Distinct Researchers Recognised
        researchers_recognised = db.scalar(
            select(func.count(func.lower(func.trim(AnudaanSanctionEntry.researcher_name)).distinct()))
            .select_from(sanctions_base.subquery())
        ) or 0

        # 2. Total Incentive Amount Sanctioned (INR)
        total_sanctioned = db.scalar(
            select(func.coalesce(func.sum(AnudaanSanctionEntry.sanctioned_amount), Decimal("0.00")))
            .select_from(sanctions_base.subquery())
        ) or Decimal("0.00")

        # 3. Total Sanction Entries
        total_entries = db.scalar(
            select(func.count(AnudaanSanctionEntry.id))
            .select_from(sanctions_base.subquery())
        ) or 0

        # 4. Quartile-wise Breakdown
        quartile_breakdown = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
        q_rows = db.execute(
            select(
                AnudaanSanctionEntry.quartile,
                func.count(AnudaanSanctionEntry.id),
            )
            .select_from(sanctions_base.subquery())
            .group_by(AnudaanSanctionEntry.quartile)
        ).all()
        for q, cnt in q_rows:
            if q in quartile_breakdown:
                quartile_breakdown[q] = cnt

        # Latest update timestamp
        latest_updated_at = db.scalar(
            select(func.max(AnudaanSanctionEntry.updated_at))
            .select_from(sanctions_base.subquery())
        )

        return AnudaanPublicImpactStats(
            reporting_academic_year=academic_year or "ALL",
            total_researchers_recognised=researchers_recognised,
            total_incentive_sanctioned_inr=Decimal(str(total_sanctioned)),
            total_sanction_entries=total_entries,
            quartile_breakdown=quartile_breakdown,
            academic_years_available=available_years,
            last_updated_at=latest_updated_at,
            # Backwards-compatibility mappings:
            total_claims_received=total_entries,
            claims_approved=total_entries,
            claims_under_review=0,
            claims_rejected=0,
            researchers_benefited=researchers_recognised,
            total_incentive_disbursed_inr=Decimal(str(total_sanctioned)),
            disbursement_status="SANCTIONED",
        )

    # -------------------------------------------------------------------------
    # 1.1 Simplified Sadmin Incentive Sanction Register Operations
    # -------------------------------------------------------------------------

    def create_sanction_entry(
        self,
        db: Session,
        payload: AnudaanSanctionEntryCreate,
        created_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanSanctionEntry:
        clean_name = payload.researcher_name.strip()
        clean_title = payload.publication_title.strip()
        clean_year = payload.academic_year.strip()

        # Prevent duplicate entry for same researcher, publication, and academic year
        existing = db.scalar(
            select(AnudaanSanctionEntry).where(
                func.lower(func.trim(AnudaanSanctionEntry.researcher_name)) == clean_name.lower(),
                func.lower(func.trim(AnudaanSanctionEntry.publication_title)) == clean_title.lower(),
                AnudaanSanctionEntry.academic_year == clean_year,
            )
        )
        if existing:
            raise ValueError(
                f"A sanction entry for researcher '{clean_name}' and publication '{clean_title}' already exists for academic year '{clean_year}'."
            )

        if payload.sanctioned_amount < 0:
            raise ValueError("Sanctioned amount must be non-negative")

        entry = AnudaanSanctionEntry(
            id=uuid.uuid4(),
            researcher_name=clean_name,
            department_name=payload.department_name.strip(),
            publication_title=clean_title,
            publication_doi=payload.publication_doi.strip() if payload.publication_doi else None,
            quartile=payload.quartile.upper().strip(),
            sanctioned_amount=payload.sanctioned_amount,
            academic_year=clean_year,
            sanction_date=payload.sanction_date,
            remarks=payload.remarks.strip() if payload.remarks else None,
            is_published=payload.is_published,
            application_id=payload.application_id,
            author_id=payload.author_id,
            created_by_id=created_by_id,
            updated_by_id=created_by_id,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    def update_sanction_entry(
        self,
        db: Session,
        sanction_id: uuid.UUID,
        payload: AnudaanSanctionEntryUpdate,
        updated_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanSanctionEntry:
        entry = db.get(AnudaanSanctionEntry, sanction_id)
        if not entry:
            raise KeyError("Sanction entry not found")

        if payload.researcher_name is not None:
            entry.researcher_name = payload.researcher_name.strip()
        if payload.department_name is not None:
            entry.department_name = payload.department_name.strip()
        if payload.publication_title is not None:
            entry.publication_title = payload.publication_title.strip()
        if payload.publication_doi is not None:
            entry.publication_doi = payload.publication_doi.strip() if payload.publication_doi else None
        if payload.quartile is not None:
            entry.quartile = payload.quartile.upper().strip()
        if payload.sanctioned_amount is not None:
            if payload.sanctioned_amount < 0:
                raise ValueError("Sanctioned amount must be non-negative")
            entry.sanctioned_amount = payload.sanctioned_amount
        if payload.academic_year is not None:
            entry.academic_year = payload.academic_year.strip()
        if payload.sanction_date is not None:
            entry.sanction_date = payload.sanction_date
        if payload.remarks is not None:
            entry.remarks = payload.remarks.strip() if payload.remarks else None
        if payload.is_published is not None:
            entry.is_published = payload.is_published
        if payload.application_id is not None:
            entry.application_id = payload.application_id
        if payload.author_id is not None:
            entry.author_id = payload.author_id

        entry.updated_by_id = updated_by_id
        db.commit()
        db.refresh(entry)
        return entry

    def delete_sanction_entry(
        self,
        db: Session,
        sanction_id: uuid.UUID,
    ) -> bool:
        entry = db.get(AnudaanSanctionEntry, sanction_id)
        if not entry:
            raise KeyError("Sanction entry not found")
        db.delete(entry)
        db.commit()
        return True

    def toggle_sanction_publication(
        self,
        db: Session,
        sanction_id: uuid.UUID,
        is_published: bool,
        updated_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanSanctionEntry:
        entry = db.get(AnudaanSanctionEntry, sanction_id)
        if not entry:
            raise KeyError("Sanction entry not found")
        entry.is_published = is_published
        entry.updated_by_id = updated_by_id
        db.commit()
        db.refresh(entry)
        return entry

    def get_sanction_entry(
        self,
        db: Session,
        sanction_id: uuid.UUID,
    ) -> Optional[AnudaanSanctionEntry]:
        return db.get(AnudaanSanctionEntry, sanction_id)

    def list_sanction_entries(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        academic_year: Optional[str] = None,
        quartile: Optional[str] = None,
        department: Optional[str] = None,
        is_published: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[AnudaanSanctionEntry], int, Decimal]:
        query = select(AnudaanSanctionEntry)
        if academic_year and academic_year.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.academic_year == academic_year)
        if quartile and quartile.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.quartile == quartile.upper())
        if department and department.upper() != "ALL":
            query = query.where(func.lower(AnudaanSanctionEntry.department_name) == department.lower().strip())
        if is_published is not None:
            query = query.where(AnudaanSanctionEntry.is_published.is_(is_published))
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AnudaanSanctionEntry.researcher_name).like(s),
                    func.lower(AnudaanSanctionEntry.publication_title).like(s),
                    func.lower(AnudaanSanctionEntry.department_name).like(s),
                )
            )

        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        total_amount = db.scalar(
            select(func.coalesce(func.sum(AnudaanSanctionEntry.sanctioned_amount), Decimal("0.00")))
            .select_from(query.subquery())
        ) or Decimal("0.00")

        items = db.scalars(
            query.order_by(desc(AnudaanSanctionEntry.sanction_date), desc(AnudaanSanctionEntry.created_at))
            .offset(skip)
            .limit(limit)
        ).all()
        return list(items), total, Decimal(str(total_amount))

    def get_public_sanction_entries(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        academic_year: Optional[str] = None,
        quartile: Optional[str] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[AnudaanSanctionEntry], int]:
        query = select(AnudaanSanctionEntry).where(AnudaanSanctionEntry.is_published.is_(True))
        if academic_year and academic_year.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.academic_year == academic_year)
        if quartile and quartile.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.quartile == quartile.upper())
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AnudaanSanctionEntry.researcher_name).like(s),
                    func.lower(AnudaanSanctionEntry.publication_title).like(s),
                    func.lower(AnudaanSanctionEntry.department_name).like(s),
                )
            )
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = db.scalars(
            query.order_by(desc(AnudaanSanctionEntry.sanction_date), desc(AnudaanSanctionEntry.created_at))
            .offset(skip)
            .limit(limit)
        ).all()
        return list(items), total

    def lookup_applications_for_sanction(
        self,
        db: Session,
        search: Optional[str] = None,
        limit: int = 20,
    ) -> List[dict]:
        query = (
            select(AnudaanApplication)
            .where(AnudaanApplication.status != AnudaanApplicationStatus.DRAFT)
            .options(
                joinedload(AnudaanApplication.publications).joinedload(AnudaanPublication.authors).joinedload(AnudaanPublicationAuthor.person)
            )
        )
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AnudaanApplication.full_name).like(s),
                    func.lower(AnudaanApplication.application_number).like(s),
                    func.lower(AnudaanApplication.department_name).like(s),
                )
            )
        apps = db.scalars(query.order_by(desc(AnudaanApplication.created_at)).limit(limit)).unique().all()
        results = []
        for app in apps:
            pub_title = None
            pub_doi = None
            quartile = None
            authors_list = []
            if app.publications:
                pub = app.publications[0]
                pub_title = pub.title
                pub_doi = pub.doi
                quartile = pub.journal_quartile.value if hasattr(pub.journal_quartile, "value") else str(pub.journal_quartile) if pub.journal_quartile else None
                for a in pub.authors:
                    authors_list.append({
                        "author_id": str(a.id),
                        "name": a.person.full_name if a.person else app.full_name,
                        "role": a.author_role.value if hasattr(a.author_role, "value") else str(a.author_role),
                        "is_payable": a.is_payable,
                    })
            results.append({
                "application_id": str(app.id),
                "application_number": app.application_number,
                "applicant_name": app.full_name,
                "department_name": app.department_name,
                "publication_title": pub_title,
                "publication_doi": pub_doi,
                "quartile": quartile or "Q1",
                "authors": authors_list,
            })
        return results

    # -------------------------------------------------------------------------
    # 2. Public Display Configuration
    # -------------------------------------------------------------------------

    def get_public_config(self, db: Session) -> AnudaanPublicConfig:
        """Retrieves or auto-creates singleton public display configuration."""
        stmt = select(AnudaanPublicConfig).where(AnudaanPublicConfig.config_key == "global_showcase")
        cfg = db.execute(stmt).scalar_one_or_none()
        if not cfg:
            cfg = AnudaanPublicConfig(
                config_key="global_showcase",
                impact_section_enabled=True,
                gallery_section_enabled=True,
                active_academic_year=None,
                custom_banner_note=None,
            )
            db.add(cfg)
            db.commit()
            db.refresh(cfg)
        return cfg

    def update_public_config(
        self,
        db: Session,
        payload: AnudaanPublicConfigUpdate,
        user_id: Optional[uuid.UUID] = None,
    ) -> AnudaanPublicConfig:
        """Updates public showcase display controls."""
        cfg = self.get_public_config(db)
        if payload.impact_section_enabled is not None:
            cfg.impact_section_enabled = payload.impact_section_enabled
        if payload.gallery_section_enabled is not None:
            cfg.gallery_section_enabled = payload.gallery_section_enabled
        if payload.active_academic_year is not None:
            cfg.active_academic_year = payload.active_academic_year.strip() or None
        if payload.custom_banner_note is not None:
            cfg.custom_banner_note = payload.custom_banner_note.strip() or None
        if user_id:
            cfg.updated_by_id = user_id
        cfg.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(cfg)
        return cfg

    # -------------------------------------------------------------------------
    # 3. Controlled Financial Disbursements Ledger (Sadmin)
    # -------------------------------------------------------------------------

    def list_disbursements(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        academic_year: Optional[str] = None,
        verification_status: Optional[str] = None,
    ) -> Tuple[int, List[AnudaanDisbursementOut], Decimal]:
        """Lists recorded disbursements with total summary."""
        stmt = select(AnudaanDisbursement).options(
            joinedload(AnudaanDisbursement.application),
            joinedload(AnudaanDisbursement.author).joinedload(AnudaanPublicationAuthor.person),
            joinedload(AnudaanDisbursement.recorded_by),
            joinedload(AnudaanDisbursement.verified_by),
        )

        if academic_year and academic_year.upper() != "ALL":
            stmt = stmt.where(AnudaanDisbursement.academic_year == academic_year)
        if verification_status:
            stmt = stmt.where(AnudaanDisbursement.verification_status == verification_status)

        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        total_amount = db.scalar(
            select(func.sum(AnudaanDisbursement.amount)).select_from(
                stmt.where(AnudaanDisbursement.verification_status != "REVERSED").subquery()
            )
        ) or Decimal("0.00")

        items = db.execute(
            stmt.order_by(desc(AnudaanDisbursement.disbursement_date)).offset(skip).limit(limit)
        ).scalars().all()

        results = []
        for d in items:
            results.append(
                AnudaanDisbursementOut(
                    id=d.id,
                    application_id=d.application_id,
                    application_number=d.application.application_number if d.application else "UNKNOWN",
                    applicant_name=d.application.full_name if d.application else "UNKNOWN",
                    author_id=d.author_id,
                    author_name=d.author.person.full_name if d.author and d.author.person else None,
                    disbursement_reference=d.disbursement_reference,
                    amount=d.amount,
                    disbursement_date=d.disbursement_date,
                    academic_year=d.academic_year,
                    payment_method=d.payment_method,
                    verification_status=d.verification_status,
                    reversal_reason=d.reversal_reason,
                    notes=d.notes,
                    recorded_by_email=d.recorded_by.email if d.recorded_by else None,
                    verified_by_email=d.verified_by.email if d.verified_by else None,
                    verified_at=d.verified_at,
                    created_at=d.created_at,
                )
            )

        return total, results, Decimal(str(total_amount))

    def create_disbursement(
        self,
        db: Session,
        payload: AnudaanDisbursementCreate,
        user_id: Optional[uuid.UUID] = None,
    ) -> AnudaanDisbursement:
        """Records a new incentive payout transaction."""
        # Verify parent application exists
        app = db.get(AnudaanApplication, payload.application_id)
        if not app:
            raise ValueError(f"Application with ID {payload.application_id} does not exist.")

        # Check duplicate active reference
        existing = db.execute(
            select(AnudaanDisbursement).where(
                AnudaanDisbursement.disbursement_reference == payload.disbursement_reference.strip(),
                AnudaanDisbursement.verification_status != "REVERSED",
            )
        ).scalar_one_or_none()
        if existing:
            raise ValueError(
                f"Active disbursement with reference '{payload.disbursement_reference}' already recorded (ID: {existing.id})."
            )

        disb = AnudaanDisbursement(
            application_id=payload.application_id,
            author_id=payload.author_id,
            disbursement_reference=payload.disbursement_reference.strip(),
            amount=payload.amount,
            disbursement_date=payload.disbursement_date,
            academic_year=payload.academic_year.strip(),
            payment_method=payload.payment_method.strip(),
            verification_status="RECORDED",
            notes=payload.notes,
            recorded_by_id=user_id,
        )
        db.add(disb)
        db.commit()
        db.refresh(disb)
        return disb

    def verify_disbursement(
        self,
        db: Session,
        disbursement_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        notes: Optional[str] = None,
    ) -> AnudaanDisbursement:
        """Confirms verification of a recorded disbursement against official bank records."""
        disb = db.get(AnudaanDisbursement, disbursement_id)
        if not disb:
            raise ValueError(f"Disbursement {disbursement_id} not found.")
        if disb.verification_status == "REVERSED":
            raise ValueError("Cannot verify a reversed disbursement transaction.")

        # Separation of Duties / Four-Eyes Principle:
        # A user cannot verify a disbursement transaction that they recorded themselves.
        if user_id and disb.recorded_by_id and str(user_id) == str(disb.recorded_by_id):
            raise ValueError(
                "Separation of duties violation: An administrator cannot verify a disbursement transaction they recorded themselves."
            )

        disb.verification_status = "VERIFIED"
        disb.verified_by_id = user_id
        disb.verified_at = datetime.now(timezone.utc)
        if notes:
            disb.notes = f"{disb.notes or ''}\n[Verification Note]: {notes}".strip()

        db.commit()
        db.refresh(disb)
        return disb

    def reverse_disbursement(
        self,
        db: Session,
        disbursement_id: uuid.UUID,
        reversal_reason: str,
        user_id: Optional[uuid.UUID] = None,
    ) -> AnudaanDisbursement:
        """Reverses an erroneous disbursement with mandatory audit justification."""
        if not reversal_reason or not reversal_reason.strip():
            raise ValueError("A non-empty justification is required to reverse a disbursement transaction.")

        disb = db.get(AnudaanDisbursement, disbursement_id)
        if not disb:
            raise ValueError(f"Disbursement {disbursement_id} not found.")
        if disb.verification_status == "REVERSED":
            raise ValueError("Disbursement is already marked as reversed.")

        disb.verification_status = "REVERSED"
        disb.reversal_reason = reversal_reason.strip()
        disb.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(disb)
        return disb

    # -------------------------------------------------------------------------
    # 4. Researcher Recognition Gallery CMS
    # -------------------------------------------------------------------------

    def list_public_gallery_items(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 20,
        academic_year: Optional[str] = None,
    ) -> Tuple[int, List[AnudaanGalleryItem]]:
        """Retrieves published gallery items with researcher consent for public display."""
        stmt = (
            select(AnudaanGalleryItem)
            .options(joinedload(AnudaanGalleryItem.images))
            .where(
                AnudaanGalleryItem.is_published.is_(True),
                AnudaanGalleryItem.has_consent.is_(True),
            )
        )
        if academic_year and academic_year.upper() != "ALL":
            stmt = stmt.where(AnudaanGalleryItem.academic_year == academic_year)

        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = db.execute(
            stmt.order_by(
                desc(AnudaanGalleryItem.is_featured),
                AnudaanGalleryItem.display_order.asc(),
                desc(AnudaanGalleryItem.event_date),
            )
            .offset(skip)
            .limit(limit)
        ).unique().scalars().all()

        return total, items

    def list_admin_gallery_items(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        academic_year: Optional[str] = None,
        is_published: Optional[bool] = None,
    ) -> Tuple[int, List[AnudaanGalleryItem]]:
        """Retrieves all gallery items for Sadmin management."""
        stmt = select(AnudaanGalleryItem).options(joinedload(AnudaanGalleryItem.images))
        if academic_year and academic_year.upper() != "ALL":
            stmt = stmt.where(AnudaanGalleryItem.academic_year == academic_year)
        if is_published is not None:
            stmt = stmt.where(AnudaanGalleryItem.is_published == is_published)

        total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
        items = db.execute(
            stmt.order_by(
                desc(AnudaanGalleryItem.is_featured),
                AnudaanGalleryItem.display_order.asc(),
                desc(AnudaanGalleryItem.event_date),
            )
            .offset(skip)
            .limit(limit)
        ).unique().scalars().all()

        return total, items

    def get_gallery_item_by_id(self, db: Session, item_id: uuid.UUID) -> Optional[AnudaanGalleryItem]:
        """Loads a single gallery item by UUID."""
        stmt = (
            select(AnudaanGalleryItem)
            .options(joinedload(AnudaanGalleryItem.images))
            .where(AnudaanGalleryItem.id == item_id)
        )
        return db.execute(stmt).unique().scalar_one_or_none()

    def create_gallery_item(
        self,
        db: Session,
        payload: AnudaanGalleryItemCreate,
        user_id: Optional[uuid.UUID] = None,
    ) -> AnudaanGalleryItem:
        """Creates a new ceremony or researcher recognition entry."""
        if payload.is_published and not payload.has_consent:
            raise ValueError("Institutional privacy violation: Cannot publish a ceremony gallery item without verified researcher consent.")

        item = AnudaanGalleryItem(
            title=payload.title.strip(),
            event_name=payload.event_name.strip(),
            event_date=payload.event_date,
            academic_year=payload.academic_year.strip(),
            description=payload.description.strip(),
            researcher_name=payload.researcher_name.strip() if payload.researcher_name else None,
            researcher_designation=payload.researcher_designation.strip() if payload.researcher_designation else None,
            department_name=payload.department_name.strip() if payload.department_name else None,
            has_consent=payload.has_consent,
            is_featured=payload.is_featured,
            is_published=payload.is_published,
            display_order=payload.display_order,
            created_by_id=user_id,
            updated_by_id=user_id,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def update_gallery_item(
        self,
        db: Session,
        item_id: uuid.UUID,
        payload: AnudaanGalleryItemUpdate,
        user_id: Optional[uuid.UUID] = None,
    ) -> AnudaanGalleryItem:
        """Updates gallery item properties."""
        item = self.get_gallery_item_by_id(db, item_id)
        if not item:
            raise ValueError(f"Gallery item {item_id} not found.")

        if payload.title is not None:
            item.title = payload.title.strip()
        if payload.event_name is not None:
            item.event_name = payload.event_name.strip()
        if payload.event_date is not None:
            item.event_date = payload.event_date
        if payload.academic_year is not None:
            item.academic_year = payload.academic_year.strip()
        if payload.description is not None:
            item.description = payload.description.strip()
        if payload.researcher_name is not None:
            item.researcher_name = payload.researcher_name.strip() or None
        if payload.researcher_designation is not None:
            item.researcher_designation = payload.researcher_designation.strip() or None
        if payload.department_name is not None:
            item.department_name = payload.department_name.strip() or None
        if payload.has_consent is not None:
            item.has_consent = payload.has_consent
            # Automatic consent withdrawal safeguard: if consent is removed, force unpublish
            if not payload.has_consent:
                item.is_published = False

        if payload.is_featured is not None:
            item.is_featured = payload.is_featured
        if payload.is_published is not None:
            if payload.is_published and not item.has_consent:
                raise ValueError("Institutional privacy violation: Cannot publish a ceremony gallery item without verified researcher consent.")
            item.is_published = payload.is_published
        if payload.display_order is not None:
            item.display_order = payload.display_order

        if user_id:
            item.updated_by_id = user_id
        item.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(item)
        return item

    def delete_gallery_item(self, db: Session, item_id: uuid.UUID) -> bool:
        """Deletes a gallery item and its images."""
        item = self.get_gallery_item_by_id(db, item_id)
        if not item:
            return False
        db.delete(item)
        db.commit()
        return True

    def add_gallery_image(
        self,
        db: Session,
        item_id: uuid.UUID,
        storage_key: str,
        filename: str,
        mime_type: str,
        file_size: int,
        caption: Optional[str] = None,
        is_cover: bool = False,
        display_order: int = 0,
    ) -> AnudaanGalleryImage:
        """Attaches an uploaded image to a gallery item."""
        item = self.get_gallery_item_by_id(db, item_id)
        if not item:
            raise ValueError(f"Gallery item {item_id} not found.")

        # If marking as cover, clear other cover images for this item
        if is_cover:
            for img in item.images:
                img.is_cover = False

        image = AnudaanGalleryImage(
            gallery_item_id=item_id,
            storage_key=storage_key,
            original_filename=filename,
            mime_type=mime_type,
            file_size_bytes=file_size,
            caption=caption.strip() if caption else None,
            is_cover=is_cover or (len(item.images) == 0),
            display_order=display_order,
        )
        db.add(image)
        db.commit()
        db.refresh(image)
        return image

    def remove_gallery_image(self, db: Session, image_id: uuid.UUID) -> bool:
        """Removes an image from a gallery item."""
        img = db.get(AnudaanGalleryImage, image_id)
        if not img:
            return False
        db.delete(img)
        db.commit()
        return True

    def set_cover_image(self, db: Session, item_id: uuid.UUID, image_id: uuid.UUID) -> bool:
        """Designates an image as the cover image for an entry."""
        item = self.get_gallery_item_by_id(db, item_id)
        if not item:
            return False
        found = False
        for img in item.images:
            if img.id == image_id:
                img.is_cover = True
                found = True
            else:
                img.is_cover = False
        if found:
            db.commit()
        return found


# Singleton export
anudaan_showcase_service = AnudaanShowcaseService()
