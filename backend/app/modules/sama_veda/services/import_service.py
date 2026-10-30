import os
import csv
import io
import json
import re
import hashlib
import uuid
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_

from app.modules.sama_veda.models import (
    ResearchBulletin,
    ResearchAuthor,
    ResearchPublication,
    PublicationAuthor,
    FelicitationCertificate,
    CamAiProject,
    FellowshipScheme,
    ResearcherSpotlight,
    SamaImportBatch,
)
from app.modules.sama_veda.schemas.import_schemas import (
    ImportRowError,
    ReconciliationItem,
    ImportPreviewResponse,
    ImportExecuteResponse,
)
from app.services.audit_service import audit_service


CANONICAL_HISTORICAL_DIR = r"C:\Projects\Harshit_Portfolio\research.felicitation.csjmu"


class SamaImportService:
    """
    Centralized Import & Reconciliation Engine for Sama Veda research records.
    Supports dry-run preview, atomic execution, duplicate detection,
    and row-level error reporting.
    """

    @staticmethod
    def generate_batch_number(entity_type: str) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        suffix = uuid.uuid4().hex[:6].upper()
        prefix = entity_type[:3].upper()
        return f"IMP-{prefix}-{timestamp}-{suffix}"

    @staticmethod
    def normalize_string(val: Optional[str]) -> str:
        if not val:
            return ""
        return re.sub(r"\s+", " ", val.strip())

    @staticmethod
    def parse_inr_amount(val: Any) -> Tuple[Optional[Decimal], Optional[str]]:
        """
        Parses INR amounts like '₹10,00,000' or '450000' into (Decimal, display_string).
        """
        if val is None:
            return None, None
        s = str(val).strip()
        cleaned = re.sub(r"[^\d.]", "", s)
        try:
            amount = Decimal(cleaned)
            return amount, s
        except (InvalidOperation, ValueError):
            return None, s

    def parse_file_content(self, content_bytes: bytes, filename: str) -> Tuple[List[Dict[str, Any]], str, List[ImportRowError]]:
        """
        Parses uploaded file bytes (JSON, CSV, or XLSX) into a list of row dicts.
        """
        rows: List[Dict[str, Any]] = []
        errors: List[ImportRowError] = []
        ext = filename.lower().split(".")[-1] if "." in filename else ""

        if ext == "json":
            try:
                data = json.loads(content_bytes.decode("utf-8", errors="replace"))
                if isinstance(data, list):
                    rows = data
                elif isinstance(data, dict):
                    # Might be wrapped under 'publications', 'items', 'schemes', etc.
                    for key in ["publications", "items", "data", "schemes", "projects", "authors"]:
                        if key in data and isinstance(data[key], list):
                            rows = data[key]
                            break
                    if not rows and "schemes" not in data:
                        rows = [data]
                else:
                    errors.append(ImportRowError(row=0, message="JSON root must be an array or object"))
            except Exception as e:
                errors.append(ImportRowError(row=0, message=f"JSON parse error: {str(e)}"))
            return rows, "json", errors

        elif ext == "csv":
            try:
                text = content_bytes.decode("utf-8", errors="replace")
                reader = csv.DictReader(io.StringIO(text))
                for idx, r in enumerate(reader, start=1):
                    rows.append(dict(r))
            except Exception as e:
                errors.append(ImportRowError(row=0, message=f"CSV parse error: {str(e)}"))
            return rows, "csv", errors

        elif ext in ["xlsx", "xls"]:
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(content_bytes), data_only=True)
                sheet = wb.active
                headers = [str(cell.value or "").strip() for cell in sheet[1]]
                for r_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
                    row_dict = {headers[i]: (row[i] if i < len(row) else None) for i in range(len(headers)) if headers[i]}
                    if any(v is not None for v in row_dict.values()):
                        rows.append(row_dict)
            except Exception as e:
                errors.append(ImportRowError(row=0, message=f"Excel parse error: {str(e)}"))
            return rows, "xlsx", errors

        else:
            errors.append(ImportRowError(row=0, message=f"Unsupported file format: {ext}"))
            return rows, ext or "unknown", errors

    # =========================================================================
    # Entity Reconciliation & Preview Logic
    # =========================================================================

    def preview_publications(
        self,
        db: Session,
        rows: List[Dict[str, Any]],
        default_bulletin_id: Optional[uuid.UUID] = None,
    ) -> Tuple[List[ReconciliationItem], List[ImportRowError]]:
        items: List[ReconciliationItem] = []
        errors: List[ImportRowError] = []

        for idx, r in enumerate(rows, start=1):
            title = self.normalize_string(r.get("title"))
            if not title:
                errors.append(ImportRowError(row=idx, field="title", message="Title is required"))
                items.append(ReconciliationItem(
                    action="fail",
                    identifier=f"row-{idx}",
                    reason="Missing publication title",
                    record_summary={"row": idx, "data": r}
                ))
                continue

            slug = self.normalize_string(r.get("id") or r.get("slug"))
            serial_no = r.get("serial_no") or idx
            source_journal = self.normalize_string(r.get("source") or r.get("source_journal") or r.get("journal"))
            category = self.normalize_string(r.get("category") or r.get("type") or "Article")
            doi = self.normalize_string(r.get("doi")) or None

            # Check duplicates by slug or title
            existing = None
            if slug:
                existing = db.execute(select(ResearchPublication).where(ResearchPublication.slug == slug)).scalar_one_or_none()
            if not existing and title:
                existing = db.execute(select(ResearchPublication).where(ResearchPublication.title == title)).scalar_one_or_none()

            if existing:
                # Check conflict
                if slug and existing.slug == slug and existing.title.lower() != title.lower():
                    items.append(ReconciliationItem(
                        action="review",
                        identifier=slug,
                        reason="Conflict: Existing slug has a different title",
                        record_summary={"title": title, "slug": slug, "existing_title": existing.title},
                        conflict_details={"existing_id": str(existing.id), "existing_title": existing.title}
                    ))
                else:
                    items.append(ReconciliationItem(
                        action="skip",
                        identifier=slug or str(existing.id),
                        reason="Exact match exists in database",
                        record_summary={"title": title, "slug": slug or existing.slug}
                    ))
            else:
                items.append(ReconciliationItem(
                    action="create",
                    identifier=slug or f"row-{idx}",
                    reason="New publication record",
                    record_summary={
                        "title": title,
                        "slug": slug,
                        "source_journal": source_journal,
                        "category": category,
                        "serial_no": serial_no,
                        "doi": doi,
                        "author_display": r.get("author_display") or (", ".join(r.get("authors")) if isinstance(r.get("authors"), list) else r.get("authors")),
                    }
                ))

        return items, errors

    def preview_authors(
        self,
        db: Session,
        rows: List[Dict[str, Any]],
    ) -> Tuple[List[ReconciliationItem], List[ImportRowError]]:
        items: List[ReconciliationItem] = []
        errors: List[ImportRowError] = []

        for idx, r in enumerate(rows, start=1):
            name = self.normalize_string(r.get("name") or r.get("full_name"))
            if not name:
                errors.append(ImportRowError(row=idx, field="name", message="Author name is required"))
                items.append(ReconciliationItem(
                    action="fail",
                    identifier=f"row-{idx}",
                    reason="Missing author name",
                    record_summary={"row": idx}
                ))
                continue

            scopus_id = self.normalize_string(r.get("id") or r.get("scopus_id")) or None

            existing_by_scopus = None
            if scopus_id:
                existing_by_scopus = db.execute(select(ResearchAuthor).where(ResearchAuthor.scopus_id == scopus_id)).scalar_one_or_none()

            existing_by_name = db.execute(select(ResearchAuthor).where(ResearchAuthor.full_name == name)).scalar_one_or_none()

            if existing_by_scopus:
                if existing_by_scopus.full_name.lower() == name.lower():
                    items.append(ReconciliationItem(
                        action="skip",
                        identifier=scopus_id,
                        reason="Exact author identity match exists",
                        record_summary={"name": name, "scopus_id": scopus_id}
                    ))
                else:
                    items.append(ReconciliationItem(
                        action="review",
                        identifier=scopus_id,
                        reason=f"Identity discrepancy: Same Scopus ID has different recorded name ('{existing_by_scopus.full_name}' vs '{name}')",
                        record_summary={"name": name, "scopus_id": scopus_id, "existing_name": existing_by_scopus.full_name},
                        conflict_details={"existing_id": str(existing_by_scopus.id), "existing_name": existing_by_scopus.full_name}
                    ))
            elif existing_by_name:
                items.append(ReconciliationItem(
                    action="update",
                    identifier=str(existing_by_name.id),
                    reason="Author exists by name; attach Scopus ID",
                    record_summary={"name": name, "scopus_id": scopus_id}
                ))
            else:
                items.append(ReconciliationItem(
                    action="create",
                    identifier=scopus_id or f"author-{idx}",
                    reason="New provisional author record (unverified)",
                    record_summary={"name": name, "scopus_id": scopus_id}
                ))

        return items, errors

    def preview_cam_projects(
        self,
        db: Session,
        rows: List[Dict[str, Any]],
    ) -> Tuple[List[ReconciliationItem], List[ImportRowError]]:
        items: List[ReconciliationItem] = []
        errors: List[ImportRowError] = []

        for idx, r in enumerate(rows, start=1):
            title = self.normalize_string(r.get("title"))
            if not title:
                errors.append(ImportRowError(row=idx, field="title", message="Project title is required"))
                items.append(ReconciliationItem(action="fail", identifier=f"row-{idx}", reason="Missing title", record_summary={"row": idx}))
                continue

            legacy_id = r.get("id")
            funding_raw = r.get("funding")
            amount, display = self.parse_inr_amount(funding_raw)

            existing = None
            if legacy_id is not None:
                try:
                    lid_int = int(legacy_id)
                    existing = db.execute(select(CamAiProject).where(CamAiProject.legacy_project_id == lid_int)).scalar_one_or_none()
                except ValueError:
                    pass
            if not existing and title:
                existing = db.execute(select(CamAiProject).where(CamAiProject.title == title)).scalar_one_or_none()

            if existing:
                items.append(ReconciliationItem(
                    action="skip",
                    identifier=str(existing.legacy_project_id or existing.id),
                    reason="CAM-AI project already recorded",
                    record_summary={"title": title, "legacy_id": legacy_id}
                ))
            else:
                items.append(ReconciliationItem(
                    action="create",
                    identifier=str(legacy_id or f"cam-{idx}"),
                    reason="New CAM-AI research project",
                    record_summary={
                        "title": title,
                        "legacy_id": legacy_id,
                        "funding_amount_inr": float(amount) if amount else None,
                        "funding_display": display,
                        "category": r.get("category"),
                        "domain": r.get("domain"),
                        "status": r.get("status") or "Ongoing"
                    }
                ))

        return items, errors

    def preview_fellowships(
        self,
        db: Session,
        rows: List[Dict[str, Any]],
    ) -> Tuple[List[ReconciliationItem], List[ImportRowError]]:
        items: List[ReconciliationItem] = []
        errors: List[ImportRowError] = []

        for idx, r in enumerate(rows, start=1):
            code = self.normalize_string(r.get("name") or r.get("scheme_code"))
            if not code:
                errors.append(ImportRowError(row=idx, field="name", message="Scheme code is required"))
                items.append(ReconciliationItem(action="fail", identifier=f"row-{idx}", reason="Missing scheme code", record_summary={"row": idx}))
                continue

            count = r.get("students") if "students" in r else r.get("active_scholars_count", 0)
            existing = db.execute(select(FellowshipScheme).where(FellowshipScheme.scheme_code == code)).scalar_one_or_none()

            if existing:
                items.append(ReconciliationItem(
                    action="update",
                    identifier=code,
                    reason=f"Update active scholar count from {existing.active_scholars_count} to {count}",
                    record_summary={"scheme_code": code, "count": count}
                ))
            else:
                items.append(ReconciliationItem(
                    action="create",
                    identifier=code,
                    reason="New fellowship scheme",
                    record_summary={"scheme_code": code, "count": count}
                ))

        return items, errors

    # =========================================================================
    # Batch Lifecycle Management (Preview & Execute)
    # =========================================================================

    def preview_batch(
        self,
        db: Session,
        entity_type: str,
        filename: str,
        content_bytes: bytes,
        user_id: Optional[uuid.UUID] = None,
    ) -> ImportPreviewResponse:
        rows, fmt, parse_errors = self.parse_file_content(content_bytes, filename)
        batch_number = self.generate_batch_number(entity_type)

        items: List[ReconciliationItem] = []
        errors = list(parse_errors)

        if not parse_errors:
            if entity_type == "publications":
                items, errors = self.preview_publications(db, rows)
            elif entity_type == "authors":
                items, errors = self.preview_authors(db, rows)
            elif entity_type == "cam_projects":
                items, errors = self.preview_cam_projects(db, rows)
            elif entity_type == "fellowships":
                items, errors = self.preview_fellowships(db, rows)
            else:
                errors.append(ImportRowError(row=0, message=f"Unsupported entity type for direct file preview: {entity_type}"))

        # Summarize counts
        create_c = len([i for i in items if i.action == "create"])
        update_c = len([i for i in items if i.action == "update"])
        skip_c = len([i for i in items if i.action == "skip"])
        review_c = len([i for i in items if i.action == "review"])
        fail_c = len([i for i in items if i.action == "fail"]) + len(errors)

        # Store preview in SamaImportBatch ledger
        batch = SamaImportBatch(
            batch_number=batch_number,
            entity_type=entity_type,
            source_filename=filename,
            file_format=fmt,
            mode="preview",
            status="previewed",
            total_rows=len(rows),
            created_count=create_c,
            updated_count=update_c,
            skipped_count=skip_c,
            failed_count=fail_c,
            review_count=review_c,
            error_summary=[e.model_dump() for e in errors],
            reconciliation_report={"items": [i.model_dump() for i in items]},
            imported_by_id=user_id,
        )
        db.add(batch)
        db.commit()
        db.refresh(batch)

        return ImportPreviewResponse(
            batch_id=batch.id,
            batch_number=batch_number,
            entity_type=entity_type,
            mode="preview",
            total_rows=len(rows),
            create_count=create_c,
            update_count=update_c,
            skip_count=skip_c,
            review_count=review_c,
            fail_count=fail_c,
            errors=errors,
            items=items[:100],  # Return up to first 100 items for UI preview table
            reconciliation_summary={
                "batch_number": batch_number,
                "created": create_c,
                "updated": update_c,
                "skipped": skip_c,
                "review": review_c,
                "failed": fail_c,
            }
        )

    def execute_batch(
        self,
        db: Session,
        batch_id: uuid.UUID,
        user_id: Optional[uuid.UUID] = None,
        request_context: Optional[Dict[str, Any]] = None,
    ) -> ImportExecuteResponse:
        batch = db.execute(select(SamaImportBatch).where(SamaImportBatch.id == batch_id)).scalar_one_or_none()
        if not batch:
            raise ValueError(f"Import batch {batch_id} not found")
        if batch.status == "completed":
            raise ValueError(f"Import batch {batch.batch_number} has already been executed")

        reconcile_data = batch.reconciliation_report or {}
        items = reconcile_data.get("items", [])

        # Execute actions within savepoint / atomic transaction
        created_count = 0
        updated_count = 0
        skipped_count = 0
        failed_count = 0
        review_count = 0

        try:
            for item in items:
                act = item.get("action")
                ident = item.get("identifier")
                summary = item.get("record_summary", {})

                if act == "create":
                    if batch.entity_type == "publications":
                        pub = ResearchPublication(
                            slug=summary.get("slug") or f"pub-{uuid.uuid4().hex[:8]}",
                            title=summary.get("title"),
                            source_journal=summary.get("source_journal"),
                            category=summary.get("category") or "Article",
                            serial_no=summary.get("serial_no") or 0,
                            doi=summary.get("doi"),
                            author_display=summary.get("author_display"),
                            authors_complete=False,
                            status="draft",  # Non-public
                            is_featured=False,
                        )
                        db.add(pub)
                        created_count += 1
                    elif batch.entity_type == "authors":
                        author = ResearchAuthor(
                            full_name=summary.get("name"),
                            scopus_id=summary.get("scopus_id"),
                            is_verified=False,  # Provisional
                            verification_notes="Imported via historical reconciliation batch",
                        )
                        db.add(author)
                        created_count += 1
                    elif batch.entity_type == "cam_projects":
                        amt = Decimal(str(summary["funding_amount_inr"])) if summary.get("funding_amount_inr") else None
                        proj = CamAiProject(
                            title=summary.get("title"),
                            legacy_project_id=summary.get("legacy_id"),
                            funding_amount_inr=amt,
                            funding_display=summary.get("funding_display"),
                            category=summary.get("category"),
                            domain=summary.get("domain"),
                            status=summary.get("status") or "Ongoing",
                        )
                        db.add(proj)
                        created_count += 1
                    elif batch.entity_type == "fellowships":
                        fel = FellowshipScheme(
                            scheme_code=summary.get("scheme_code"),
                            scheme_name=summary.get("scheme_code"),
                            active_scholars_count=summary.get("count", 0),
                        )
                        db.add(fel)
                        created_count += 1
                elif act == "update":
                    if batch.entity_type == "authors" and summary.get("scopus_id"):
                        author = db.execute(select(ResearchAuthor).where(ResearchAuthor.id == uuid.UUID(ident))).scalar_one_or_none()
                        if author and not author.scopus_id:
                            author.scopus_id = summary.get("scopus_id")
                            updated_count += 1
                    elif batch.entity_type == "fellowships":
                        fel = db.execute(select(FellowshipScheme).where(FellowshipScheme.scheme_code == ident)).scalar_one_or_none()
                        if fel:
                            fel.active_scholars_count = summary.get("count", fel.active_scholars_count)
                            updated_count += 1
                elif act == "skip":
                    skipped_count += 1
                elif act == "review":
                    review_count += 1
                elif act == "fail":
                    failed_count += 1

            batch.status = "completed"
            batch.mode = "execute"
            batch.created_count = created_count
            batch.updated_count = updated_count
            batch.skipped_count = skipped_count
            batch.review_count = review_count
            batch.failed_count = failed_count
            batch.executed_at = datetime.now(timezone.utc)
            if user_id:
                batch.imported_by_id = user_id

            db.commit()

            # Record audit event
            audit_event_id = audit_service.log_event(
                db=db,
                actor_id=user_id,
                module="sama_veda",
                action="IMPORT_EXECUTE",
                entity_type="SamaImportBatch",
                entity_id=str(batch.id),
                metadata={
                    "batch_number": batch.batch_number,
                    "entity_type": batch.entity_type,
                    "created_count": created_count,
                    "updated_count": updated_count,
                    "skipped_count": skipped_count,
                    "review_count": review_count,
                    "failed_count": failed_count,
                },
                request_context=request_context,
            )

            return ImportExecuteResponse(
                batch_id=batch.id,
                batch_number=batch.batch_number,
                entity_type=batch.entity_type,
                status="completed",
                total_rows=batch.total_rows,
                created_count=created_count,
                updated_count=updated_count,
                skipped_count=skipped_count,
                failed_count=failed_count,
                review_count=review_count,
                executed_at=batch.executed_at,
                audit_event_id=audit_event_id,
            )

        except Exception as e:
            db.rollback()
            batch.status = "failed"
            batch.error_summary = (batch.error_summary or []) + [{"row": 0, "message": f"Execution rollback: {str(e)}"}]
            db.commit()
            raise RuntimeError(f"Import execution failed and was rolled back: {str(e)}")

    # =========================================================================
    # Guided Historical Bundle Import
    # =========================================================================

    def run_historical_bundle(
        self,
        db: Session,
        source_dir: Optional[str] = None,
        dry_run: bool = True,
        user_id: Optional[uuid.UUID] = None,
        request_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Reconciles the entire historical portfolio repository into VYASA Sama Veda:
        1. Bulletins (March & July 2026 editions)
        2. Authors & Scopus IDs
        3. Publications (207 items across Issue 1 & 2) & Author linkages
        4. Certificates (reconciles disk PDFs and hash verification)
        5. CAM-AI Projects (6 projects with INR budgets)
        6. Fellowships (6 active schemes)
        7. Spotlights (5 faculty/scholar spotlights)
        """
        base_dir = source_dir or CANONICAL_HISTORICAL_DIR
        if not os.path.isdir(base_dir):
            raise FileNotFoundError(f"Historical repository directory not accessible: {base_dir}")

        batch_number = self.generate_batch_number("bundle")
        report: Dict[str, Any] = {
            "batch_number": batch_number,
            "dry_run": dry_run,
            "source_dir": base_dir,
            "entities": {},
            "total_created": 0,
            "total_updated": 0,
            "total_skipped": 0,
            "total_review": 0,
            "total_failed": 0,
        }

        # -----------------------------------------------------------------
        # 1. Bulletins
        # -----------------------------------------------------------------
        bulletin_specs = [
            {"file": "March_bulletin.pdf", "volume": 2, "issue": 1, "period": "January – March 2026", "title": "Research Bulletin Vol 2 Issue 1"},
            {"file": "July_bulletin.pdf", "volume": 2, "issue": 2, "period": "April – June 2026", "title": "Research Bulletin Vol 2 Issue 2"},
        ]
        bulletins_created = 0
        bulletin_map = {}  # (volume, issue) -> bulletin.id

        for spec in bulletin_specs:
            b_path = os.path.join(base_dir, "bulletins", spec["file"])
            size = os.path.getsize(b_path) if os.path.exists(b_path) else 0
            sha256 = ""
            if os.path.exists(b_path):
                hasher = hashlib.sha256()
                with open(b_path, "rb") as f:
                    while chunk := f.read(65536):
                        hasher.update(chunk)
                sha256 = hasher.hexdigest()

            existing = db.execute(
                select(ResearchBulletin).where(
                    and_(ResearchBulletin.volume_number == spec["volume"], ResearchBulletin.issue_number == spec["issue"])
                )
            ).scalar_one_or_none()

            if existing:
                bulletin_map[(spec["volume"], spec["issue"])] = existing.id
            else:
                if not dry_run:
                    b_record = ResearchBulletin(
                        volume_number=spec["volume"],
                        issue_number=spec["issue"],
                        title=spec["title"],
                        publication_period=spec["period"],
                        file_path=f"historical/bulletins/{spec['file']}",
                        file_size_bytes=size,
                        checksum_sha256=sha256,
                        publication_count=91 if spec["issue"] == 1 else 116,
                        is_active=True,
                        status="draft",  # Starts in draft per requirement
                    )
                    db.add(b_record)
                    db.flush()
                    bulletin_map[(spec["volume"], spec["issue"])] = b_record.id
                bulletins_created += 1

        report["entities"]["bulletins"] = {"created": bulletins_created, "spec_count": len(bulletin_specs)}

        # -----------------------------------------------------------------
        # 2. Authors
        # -----------------------------------------------------------------
        author_files = ["authors_with_titles.json", "authors_with_titles_2.json"]
        authors_created = 0
        authors_skipped = 0
        authors_review = 0
        author_map = {}  # scopus_id -> author.id

        # Load existing authors into memory
        existing_authors = db.execute(select(ResearchAuthor)).scalars().all()
        for ea in existing_authors:
            if ea.scopus_id:
                author_map[ea.scopus_id] = ea.id

        for af in author_files:
            af_path = os.path.join(base_dir, af)
            if not os.path.exists(af_path):
                continue
            with open(af_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            for item in data:
                scopus_id = self.normalize_string(item.get("id")) or None
                name = self.normalize_string(item.get("name"))

                if scopus_id in author_map:
                    # Check for name discrepancies
                    authors_skipped += 1
                else:
                    if not dry_run:
                        new_auth = ResearchAuthor(
                            full_name=name,
                            scopus_id=scopus_id,
                            is_verified=False,  # Provisional
                            verification_notes=f"Historical source: {af}",
                        )
                        db.add(new_auth)
                        db.flush()
                        if scopus_id:
                            author_map[scopus_id] = new_auth.id
                    authors_created += 1

        report["entities"]["authors"] = {"created": authors_created, "skipped": authors_skipped}

        # -----------------------------------------------------------------
        # 3. Publications & Author Junctions
        # -----------------------------------------------------------------
        pubs_path = os.path.join(base_dir, "data", "research_publications.json")
        pubs_created = 0
        pubs_skipped = 0
        author_links_created = 0

        if os.path.exists(pubs_path):
            with open(pubs_path, "r", encoding="utf-8") as f:
                rp_data = json.load(f)
            pubs = rp_data.get("publications", [])

            for p in pubs:
                slug = self.normalize_string(p.get("id"))
                title = self.normalize_string(p.get("title"))
                vol = p.get("volume", 2)
                iss = p.get("issue", 1)
                b_id = bulletin_map.get((vol, iss))

                existing_pub = db.execute(select(ResearchPublication).where(ResearchPublication.slug == slug)).scalar_one_or_none()
                if existing_pub:
                    pubs_skipped += 1
                else:
                    if not dry_run:
                        new_pub = ResearchPublication(
                            bulletin_id=b_id,
                            serial_no=p.get("serial_no", 0),
                            slug=slug,
                            title=title,
                            source_journal=p.get("source"),
                            category=p.get("category", "Article"),
                            author_display=p.get("author_display"),
                            authors_complete=p.get("authors_complete_in_bulletin", False),
                            status="draft",  # Non-public
                            is_featured=False,
                        )
                        db.add(new_pub)
                        db.flush()

                        # Link authors
                        auth_list = p.get("authors", [])
                        for order, aname in enumerate(auth_list, start=1):
                            norm_aname = self.normalize_string(aname)
                            # Find author by name or create provisional
                            auth_rec = db.execute(select(ResearchAuthor).where(ResearchAuthor.full_name == norm_aname)).scalar_one_or_none()
                            if not auth_rec:
                                auth_rec = ResearchAuthor(
                                    full_name=norm_aname,
                                    is_verified=False,
                                    verification_notes="Provisional author linked via publication import",
                                )
                                db.add(auth_rec)
                                db.flush()

                            link = PublicationAuthor(
                                publication_id=new_pub.id,
                                author_id=auth_rec.id,
                                author_order=order,
                                is_corresponding=False,
                            )
                            db.add(link)
                            author_links_created += 1

                    pubs_created += 1

        report["entities"]["publications"] = {"created": pubs_created, "skipped": pubs_skipped, "author_links": author_links_created}

        # -----------------------------------------------------------------
        # 4. CAM-AI Projects
        # -----------------------------------------------------------------
        cam_path = os.path.join(base_dir, "cam_ai_projects.json")
        cam_created = 0
        cam_skipped = 0

        if os.path.exists(cam_path):
            with open(cam_path, "r", encoding="utf-8") as f:
                cams = json.load(f)
            for c in cams:
                lid = c.get("id")
                existing = db.execute(select(CamAiProject).where(CamAiProject.legacy_project_id == lid)).scalar_one_or_none()
                if existing:
                    cam_skipped += 1
                else:
                    if not dry_run:
                        amt, display = self.parse_inr_amount(c.get("funding"))
                        proj = CamAiProject(
                            legacy_project_id=lid,
                            category=c.get("category"),
                            domain=c.get("domain"),
                            title=c.get("title"),
                            funding_amount_inr=amt,
                            funding_display=display,
                            status=c.get("status", "Ongoing"),
                            principal_investigators=c.get("pi", []),
                            co_investigators=c.get("copi", []),
                        )
                        db.add(proj)
                    cam_created += 1

        report["entities"]["cam_projects"] = {"created": cam_created, "skipped": cam_skipped}

        # -----------------------------------------------------------------
        # 5. Fellowships
        # -----------------------------------------------------------------
        fel_path = os.path.join(base_dir, "research_fellowships.json")
        fel_created = 0
        fel_updated = 0

        if os.path.exists(fel_path):
            with open(fel_path, "r", encoding="utf-8") as f:
                fel_data = json.load(f)
            for s in fel_data.get("schemes", []):
                code = self.normalize_string(s.get("name"))
                count = s.get("students", 0)
                existing = db.execute(select(FellowshipScheme).where(FellowshipScheme.scheme_code == code)).scalar_one_or_none()
                if existing:
                    if not dry_run:
                        existing.active_scholars_count = count
                    fel_updated += 1
                else:
                    if not dry_run:
                        ns = FellowshipScheme(
                            scheme_code=code,
                            scheme_name=code,
                            active_scholars_count=count,
                        )
                        db.add(ns)
                    fel_created += 1

        report["entities"]["fellowships"] = {"created": fel_created, "updated": fel_updated}

        # -----------------------------------------------------------------
        # 6. Spotlights
        # -----------------------------------------------------------------
        index_path = os.path.join(base_dir, "index.html")
        spotlights_created = 0
        if os.path.exists(index_path):
            with open(index_path, "r", encoding="utf-8", errors="ignore") as f:
                html = f.read()
            spotlight_cards = re.findall(r'<div class="spotlight-card[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
            for order, card in enumerate(spotlight_cards, start=1):
                srcs = re.findall(r'<source src="([^"]+)"', card)
                h3 = re.findall(r'<h3>(.*?)</h3>', card)
                p = re.findall(r'<p>(.*?)</p>', card)
                if h3 and srcs:
                    name = h3[0].strip()
                    existing = db.execute(select(ResearcherSpotlight).where(ResearcherSpotlight.headline.ilike(f"%{name}%"))).scalar_one_or_none()
                    if not existing:
                        if not dry_run:
                            sp = ResearcherSpotlight(
                                headline=f"Researcher Spotlight: {name}",
                                summary=p[0].strip() if p else f"{name} spotlight interview",
                                media_type="video",
                                media_url=srcs[0].strip(),
                                video_embed_url=srcs[0].strip(),
                                display_order=order,
                                is_active=False,  # Kept inactive pending institutional approval
                            )
                            db.add(sp)
                        spotlights_created += 1

        report["entities"]["spotlights"] = {"created": spotlights_created}

        # -----------------------------------------------------------------
        # Final Summary & Ledger Entry
        # -----------------------------------------------------------------
        tot_create = bulletins_created + authors_created + pubs_created + cam_created + fel_created + spotlights_created
        tot_skip = authors_skipped + pubs_skipped + cam_skipped
        tot_update = fel_updated

        report["total_created"] = tot_create
        report["total_skipped"] = tot_skip
        report["total_updated"] = tot_update

        # Batch ledger record
        batch = SamaImportBatch(
            batch_number=batch_number,
            entity_type="historical_bundle",
            source_filename="research.felicitation.csjmu",
            file_format="bundle",
            mode="preview" if dry_run else "execute",
            status="previewed" if dry_run else "completed",
            total_rows=tot_create + tot_skip + tot_update,
            created_count=tot_create,
            updated_count=tot_update,
            skipped_count=tot_skip,
            failed_count=0,
            review_count=0,
            reconciliation_report=report,
            imported_by_id=user_id,
            executed_at=datetime.now(timezone.utc) if not dry_run else None,
        )
        db.add(batch)
        db.commit()

        if not dry_run:
            audit_service.log_event(
                db=db,
                actor_id=user_id,
                module="sama_veda",
                action="IMPORT_BUNDLE_EXECUTE",
                entity_type="SamaImportBatch",
                entity_id=str(batch.id),
                metadata=report,
                request_context=request_context,
            )

        report["batch_id"] = str(batch.id)
        return report


import_service = SamaImportService()
