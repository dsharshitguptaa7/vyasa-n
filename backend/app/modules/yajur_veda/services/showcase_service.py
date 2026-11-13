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
    AnudaanFelicitationCycle,
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
    AnudaanFelicitationCycleCreate,
    AnudaanFelicitationCycleUpdate,
    AnudaanFelicitationCycleOut,
    AnudaanPublicFelicitationCycleOut,
    AnudaanPublicShowcaseCyclesResponse,
    AnudaanPublicSanctionOut,
    AnudaanGalleryItemOut,
    AnudaanGalleryImageOut,
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
        volume_number: Optional[int] = None,
        issue_number: Optional[int] = None,
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
        if volume_number is not None or issue_number is not None:
            sanctions_base = sanctions_base.join(
                AnudaanFelicitationCycle,
                AnudaanSanctionEntry.felicitation_cycle_id == AnudaanFelicitationCycle.id,
            )
            if volume_number is not None:
                sanctions_base = sanctions_base.where(AnudaanFelicitationCycle.volume_number == volume_number)
            if issue_number is not None:
                sanctions_base = sanctions_base.where(AnudaanFelicitationCycle.issue_number == issue_number)

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

        # Validate felicitation cycle exists
        cycle = db.get(AnudaanFelicitationCycle, payload.felicitation_cycle_id)
        if not cycle:
            raise ValueError(f"Felicitation cycle with ID '{payload.felicitation_cycle_id}' does not exist.")

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
            department_name=payload.department_name.strip() if payload.department_name else None,
            project_title=payload.project_title.strip() if payload.project_title else None,
            publication_title=clean_title,
            publication_doi=payload.publication_doi.strip() if payload.publication_doi else None,
            quartile=payload.quartile.upper().strip(),
            sanctioned_amount=payload.sanctioned_amount,
            academic_year=clean_year,
            sanction_date=payload.sanction_date,
            felicitation_cycle_id=payload.felicitation_cycle_id,
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
            entry.department_name = payload.department_name.strip() if payload.department_name else None
        if payload.project_title is not None:
            entry.project_title = payload.project_title.strip() if payload.project_title else None
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
        if payload.felicitation_cycle_id is not None:
            cycle = db.get(AnudaanFelicitationCycle, payload.felicitation_cycle_id)
            if not cycle:
                raise ValueError(f"Felicitation cycle with ID '{payload.felicitation_cycle_id}' does not exist.")
            entry.felicitation_cycle_id = payload.felicitation_cycle_id
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
        cycle_id: Optional[uuid.UUID] = None,
        volume_number: Optional[int] = None,
        issue_number: Optional[int] = None,
        is_published: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[AnudaanSanctionEntry], int, Decimal]:
        query = select(AnudaanSanctionEntry).options(
            joinedload(AnudaanSanctionEntry.felicitation_cycle),
            joinedload(AnudaanSanctionEntry.application),
        )
        if academic_year and academic_year.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.academic_year == academic_year)
        if quartile and quartile.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.quartile == quartile.upper())
        if department and department.upper() != "ALL":
            query = query.where(func.lower(AnudaanSanctionEntry.department_name) == department.lower().strip())
        if cycle_id is not None:
            query = query.where(AnudaanSanctionEntry.felicitation_cycle_id == cycle_id)
        if volume_number is not None or issue_number is not None:
            query = query.join(
                AnudaanFelicitationCycle,
                AnudaanSanctionEntry.felicitation_cycle_id == AnudaanFelicitationCycle.id,
            )
            if volume_number is not None:
                query = query.where(AnudaanFelicitationCycle.volume_number == volume_number)
            if issue_number is not None:
                query = query.where(AnudaanFelicitationCycle.issue_number == issue_number)
        if is_published is not None:
            query = query.where(AnudaanSanctionEntry.is_published.is_(is_published))
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AnudaanSanctionEntry.researcher_name).like(s),
                    func.lower(AnudaanSanctionEntry.publication_title).like(s),
                    func.lower(func.coalesce(AnudaanSanctionEntry.department_name, "")).like(s),
                    func.lower(func.coalesce(AnudaanSanctionEntry.project_title, "")).like(s),
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
        ).unique().all()
        return list(items), total, Decimal(str(total_amount))

    def get_public_sanction_entries(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        academic_year: Optional[str] = None,
        quartile: Optional[str] = None,
        cycle_id: Optional[uuid.UUID] = None,
        volume_number: Optional[int] = None,
        issue_number: Optional[int] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[AnudaanSanctionEntry], int]:
        query = (
            select(AnudaanSanctionEntry)
            .options(joinedload(AnudaanSanctionEntry.felicitation_cycle))
            .where(AnudaanSanctionEntry.is_published.is_(True))
        )
        if academic_year and academic_year.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.academic_year == academic_year)
        if quartile and quartile.upper() != "ALL":
            query = query.where(AnudaanSanctionEntry.quartile == quartile.upper())
        if cycle_id is not None:
            query = query.where(AnudaanSanctionEntry.felicitation_cycle_id == cycle_id)
        if volume_number is not None or issue_number is not None:
            query = query.join(
                AnudaanFelicitationCycle,
                AnudaanSanctionEntry.felicitation_cycle_id == AnudaanFelicitationCycle.id,
            )
            if volume_number is not None:
                query = query.where(AnudaanFelicitationCycle.volume_number == volume_number)
            if issue_number is not None:
                query = query.where(AnudaanFelicitationCycle.issue_number == issue_number)
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AnudaanSanctionEntry.researcher_name).like(s),
                    func.lower(AnudaanSanctionEntry.publication_title).like(s),
                    func.lower(func.coalesce(AnudaanSanctionEntry.department_name, "")).like(s),
                    func.lower(func.coalesce(AnudaanSanctionEntry.project_title, "")).like(s),
                )
            )
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        items = db.scalars(
            query.order_by(desc(AnudaanSanctionEntry.sanction_date), desc(AnudaanSanctionEntry.created_at))
            .offset(skip)
            .limit(limit)
        ).unique().all()
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
    # 1.2 Felicitation / Recognition Cycle Management (Volume & Issue)
    # -------------------------------------------------------------------------

    def create_felicitation_cycle(
        self,
        db: Session,
        payload: AnudaanFelicitationCycleCreate,
        created_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanFelicitationCycle:
        """Creates a new institutional Volume & Issue felicitation cycle."""
        existing = db.scalar(
            select(AnudaanFelicitationCycle).where(
                AnudaanFelicitationCycle.volume_number == payload.volume_number,
                AnudaanFelicitationCycle.issue_number == payload.issue_number,
            )
        )
        if existing:
            raise ValueError(
                f"A felicitation cycle for Volume {payload.volume_number}, Issue {payload.issue_number} already exists."
            )

        cycle = AnudaanFelicitationCycle(
            id=uuid.uuid4(),
            volume_number=payload.volume_number,
            issue_number=payload.issue_number,
            display_title=payload.display_title.strip() if payload.display_title else None,
            status=payload.status.upper().strip(),
            felicitation_date=payload.felicitation_date,
            academic_year=payload.academic_year.strip() if payload.academic_year else None,
            description=payload.description.strip() if payload.description else None,
            is_published=payload.is_published,
            is_archived=payload.is_archived,
            created_by_id=created_by_id,
            updated_by_id=created_by_id,
        )
        db.add(cycle)
        db.commit()
        db.refresh(cycle)
        return cycle

    def update_felicitation_cycle(
        self,
        db: Session,
        cycle_id: uuid.UUID,
        payload: AnudaanFelicitationCycleUpdate,
        updated_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanFelicitationCycle:
        """Updates attributes of an existing felicitation cycle."""
        cycle = db.get(AnudaanFelicitationCycle, cycle_id)
        if not cycle:
            raise KeyError("Felicitation cycle not found")

        new_vol = payload.volume_number if payload.volume_number is not None else cycle.volume_number
        new_iss = payload.issue_number if payload.issue_number is not None else cycle.issue_number
        if new_vol != cycle.volume_number or new_iss != cycle.issue_number:
            conflict = db.scalar(
                select(AnudaanFelicitationCycle).where(
                    AnudaanFelicitationCycle.volume_number == new_vol,
                    AnudaanFelicitationCycle.issue_number == new_iss,
                    AnudaanFelicitationCycle.id != cycle_id,
                )
            )
            if conflict:
                raise ValueError(f"Volume {new_vol}, Issue {new_iss} already exists.")

        if payload.volume_number is not None:
            cycle.volume_number = payload.volume_number
        if payload.issue_number is not None:
            cycle.issue_number = payload.issue_number
        if payload.display_title is not None:
            cycle.display_title = payload.display_title.strip() if payload.display_title else None
        if payload.status is not None:
            cycle.status = payload.status.upper().strip()
        if payload.felicitation_date is not None:
            cycle.felicitation_date = payload.felicitation_date
        if payload.academic_year is not None:
            cycle.academic_year = payload.academic_year.strip() if payload.academic_year else None
        if payload.description is not None:
            cycle.description = payload.description.strip() if payload.description else None
        if payload.is_published is not None:
            cycle.is_published = payload.is_published
        if payload.is_archived is not None:
            cycle.is_archived = payload.is_archived

        cycle.updated_by_id = updated_by_id
        db.commit()
        db.refresh(cycle)
        return cycle

    def delete_felicitation_cycle(
        self,
        db: Session,
        cycle_id: uuid.UUID,
    ) -> bool:
        """Deletes a felicitation cycle."""
        cycle = db.get(AnudaanFelicitationCycle, cycle_id)
        if not cycle:
            raise KeyError("Felicitation cycle not found")
        db.delete(cycle)
        db.commit()
        return True

    def toggle_cycle_publication(
        self,
        db: Session,
        cycle_id: uuid.UUID,
        is_published: bool,
        updated_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanFelicitationCycle:
        cycle = db.get(AnudaanFelicitationCycle, cycle_id)
        if not cycle:
            raise KeyError("Felicitation cycle not found")
        cycle.is_published = is_published
        cycle.updated_by_id = updated_by_id
        db.commit()
        db.refresh(cycle)
        return cycle

    def toggle_cycle_archive(
        self,
        db: Session,
        cycle_id: uuid.UUID,
        is_archived: bool,
        updated_by_id: Optional[uuid.UUID] = None,
    ) -> AnudaanFelicitationCycle:
        cycle = db.get(AnudaanFelicitationCycle, cycle_id)
        if not cycle:
            raise KeyError("Felicitation cycle not found")
        cycle.is_archived = is_archived
        cycle.updated_by_id = updated_by_id
        db.commit()
        db.refresh(cycle)
        return cycle

    def get_felicitation_cycle(
        self,
        db: Session,
        cycle_id: uuid.UUID,
    ) -> Optional[dict]:
        cycle = db.get(AnudaanFelicitationCycle, cycle_id)
        if not cycle:
            return None
        s_count = db.scalar(
            select(func.count(AnudaanSanctionEntry.id)).where(
                AnudaanSanctionEntry.felicitation_cycle_id == cycle.id
            )
        ) or 0
        s_total = db.scalar(
            select(func.coalesce(func.sum(AnudaanSanctionEntry.sanctioned_amount), Decimal("0.00"))).where(
                AnudaanSanctionEntry.felicitation_cycle_id == cycle.id
            )
        ) or Decimal("0.00")
        return {
            "id": cycle.id,
            "volume_number": cycle.volume_number,
            "issue_number": cycle.issue_number,
            "display_title": cycle.display_title,
            "status": cycle.status,
            "felicitation_date": cycle.felicitation_date,
            "academic_year": cycle.academic_year,
            "description": cycle.description,
            "is_published": cycle.is_published,
            "is_archived": cycle.is_archived,
            "sanction_count": s_count,
            "total_sanctioned_amount": Decimal(str(s_total)),
            "created_at": cycle.created_at,
            "updated_at": cycle.updated_at,
        }

    def list_felicitation_cycles(
        self,
        db: Session,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        academic_year: Optional[str] = None,
        is_published: Optional[bool] = None,
        is_archived: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[dict], int]:
        """Lists cycles with computed sanction counts and total sanctioned INR."""
        query = select(AnudaanFelicitationCycle)
        if status and status.upper() != "ALL":
            query = query.where(AnudaanFelicitationCycle.status == status.upper().strip())
        if academic_year and academic_year.upper() != "ALL":
            query = query.where(AnudaanFelicitationCycle.academic_year == academic_year)
        if is_published is not None:
            query = query.where(AnudaanFelicitationCycle.is_published.is_(is_published))
        if is_archived is not None:
            query = query.where(AnudaanFelicitationCycle.is_archived.is_(is_archived))
        if search:
            s = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(AnudaanFelicitationCycle.display_title).like(s),
                    func.lower(AnudaanFelicitationCycle.description).like(s),
                )
            )

        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        cycles = db.scalars(
            query.order_by(
                desc(AnudaanFelicitationCycle.volume_number),
                desc(AnudaanFelicitationCycle.issue_number),
            )
            .offset(skip)
            .limit(limit)
        ).all()

        results = []
        for c in cycles:
            s_count = db.scalar(
                select(func.count(AnudaanSanctionEntry.id)).where(
                    AnudaanSanctionEntry.felicitation_cycle_id == c.id
                )
            ) or 0
            s_total = db.scalar(
                select(func.coalesce(func.sum(AnudaanSanctionEntry.sanctioned_amount), Decimal("0.00"))).where(
                    AnudaanSanctionEntry.felicitation_cycle_id == c.id
                )
            ) or Decimal("0.00")

            results.append({
                "id": c.id,
                "volume_number": c.volume_number,
                "issue_number": c.issue_number,
                "display_title": c.display_title,
                "status": c.status,
                "felicitation_date": c.felicitation_date,
                "academic_year": c.academic_year,
                "description": c.description,
                "is_published": c.is_published,
                "is_archived": c.is_archived,
                "sanction_count": s_count,
                "total_sanctioned_amount": Decimal(str(s_total)),
                "created_at": c.created_at,
                "updated_at": c.updated_at,
            })
        return results, total

    def get_public_showcase_cycles(
        self,
        db: Session,
        academic_year: Optional[str] = None,
    ) -> AnudaanPublicShowcaseCyclesResponse:
        """
        Organizes published sanction records by Volume and Issue for the public showcase.
        Separates completed cycles (with associated published sanction records and gallery items)
        from upcoming cycles (which display event metadata without fabricated amounts or records).
        """
        stmt = (
            select(AnudaanFelicitationCycle)
            .where(
                AnudaanFelicitationCycle.is_published.is_(True),
                AnudaanFelicitationCycle.is_archived.is_(False),
            )
            .order_by(
                desc(AnudaanFelicitationCycle.volume_number),
                desc(AnudaanFelicitationCycle.issue_number),
            )
        )
        if academic_year and academic_year.upper() != "ALL":
            stmt = stmt.where(AnudaanFelicitationCycle.academic_year == academic_year)

        cycles = db.scalars(stmt).all()

        completed_cycles = []
        upcoming_cycles = []

        for c in cycles:
            gal_items = db.scalars(
                select(AnudaanGalleryItem)
                .options(joinedload(AnudaanGalleryItem.images))
                .where(
                    AnudaanGalleryItem.felicitation_cycle_id == c.id,
                    AnudaanGalleryItem.is_published.is_(True),
                    AnudaanGalleryItem.has_consent.is_(True),
                )
                .order_by(AnudaanGalleryItem.display_order.asc())
            ).unique().all()

            gal_out = []
            for g in gal_items:
                gal_out.append(
                    AnudaanGalleryItemOut(
                        id=g.id,
                        title=g.title,
                        event_name=g.event_name,
                        event_date=g.event_date,
                        academic_year=g.academic_year,
                        description=g.description,
                        researcher_name=g.researcher_name,
                        researcher_designation=g.researcher_designation,
                        department_name=g.department_name,
                        has_consent=g.has_consent,
                        is_featured=g.is_featured,
                        is_published=g.is_published,
                        display_order=g.display_order,
                        felicitation_cycle_id=c.id,
                        felicitation_cycle_volume=c.volume_number,
                        felicitation_cycle_issue=c.issue_number,
                        images=[
                            AnudaanGalleryImageOut(
                                id=img.id,
                                gallery_item_id=img.gallery_item_id,
                                storage_key=img.storage_key,
                                original_filename=img.original_filename,
                                mime_type=img.mime_type,
                                file_size_bytes=img.file_size_bytes,
                                caption=img.caption,
                                is_cover=img.is_cover,
                                display_order=img.display_order,
                                created_at=img.created_at,
                            )
                            for img in g.images
                        ],
                        created_at=g.created_at,
                        updated_at=g.updated_at,
                    )
                )

            if c.status == "COMPLETED":
                sanctions = db.scalars(
                    select(AnudaanSanctionEntry)
                    .where(
                        AnudaanSanctionEntry.felicitation_cycle_id == c.id,
                        AnudaanSanctionEntry.is_published.is_(True),
                    )
                    .order_by(desc(AnudaanSanctionEntry.sanction_date))
                ).all()

                s_out = [
                    AnudaanPublicSanctionOut(
                        id=s.id,
                        researcher_name=s.researcher_name,
                        department_name=s.department_name,
                        project_title=s.project_title,
                        publication_title=s.publication_title,
                        quartile=s.quartile,
                        sanctioned_amount=s.sanctioned_amount,
                        academic_year=s.academic_year,
                        felicitation_cycle_id=c.id,
                        volume_number=c.volume_number,
                        issue_number=c.issue_number,
                        cycle_display_title=c.display_title,
                        cycle_status=c.status,
                        felicitation_date=c.felicitation_date,
                    )
                    for s in sanctions
                ]
                total_sanctioned = sum((s.sanctioned_amount for s in sanctions), Decimal("0.00"))
                distinct_researchers = len(set(s.researcher_name.lower().strip() for s in sanctions))

                completed_cycles.append(
                    AnudaanPublicFelicitationCycleOut(
                        id=c.id,
                        volume_number=c.volume_number,
                        issue_number=c.issue_number,
                        display_title=c.display_title,
                        status=c.status,
                        felicitation_date=c.felicitation_date,
                        academic_year=c.academic_year,
                        description=c.description,
                        sanctions=s_out,
                        total_sanctioned_amount=total_sanctioned,
                        total_researchers=distinct_researchers,
                        sanction_count=len(s_out),
                        gallery_items=gal_out,
                    )
                )
            else:
                upcoming_cycles.append(
                    AnudaanPublicFelicitationCycleOut(
                        id=c.id,
                        volume_number=c.volume_number,
                        issue_number=c.issue_number,
                        display_title=c.display_title,
                        status=c.status,
                        felicitation_date=c.felicitation_date,
                        academic_year=c.academic_year,
                        description=c.description,
                        sanctions=[],
                        total_sanctioned_amount=Decimal("0.00"),
                        total_researchers=0,
                        sanction_count=0,
                        gallery_items=gal_out,
                    )
                )

        return AnudaanPublicShowcaseCyclesResponse(
            total_cycles=len(completed_cycles) + len(upcoming_cycles),
            completed_cycles=completed_cycles,
            upcoming_cycles=upcoming_cycles,
        )

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
            felicitation_cycle_id=payload.felicitation_cycle_id,
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
        if payload.felicitation_cycle_id is not None:
            item.felicitation_cycle_id = payload.felicitation_cycle_id

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
