import hashlib
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.applicant_profile import ApplicantProfile
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.document import Document
from app.modules.atharva_veda.nivaran.models.efile import EFile, EFileDocument
from app.modules.atharva_veda.nivaran.models.enums import (
    EFileStatus,
    GrievanceStatus,
    NivaranRole,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceFeedback,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, SubjectCluster
from app.modules.atharva_veda.nivaran.services.efile_pdf_generator import create_efile_pdf
from app.modules.atharva_veda.nivaran.services.student_master_record_service import (
    StudentMasterRecordService,
)

logger = logging.getLogger("vyasa.atharva.nivaran.services.efile")

STORAGE_DIR = Path("storage/efiles")


class EFileService:
    @staticmethod
    def generate_sequential_efile_number(db: Session) -> str:
        """
        Generates next sequential human-readable E-File Number:
        Format: NVR/EF/{YYYY}/{SEQUENCE:06d} (e.g. NVR/EF/2026/000001)
        """
        current_year = datetime.now(timezone.utc).year
        prefix = f"NVR/EF/{current_year}/"

        latest_efile = db.scalar(
            select(EFile.e_file_number)
            .where(EFile.e_file_number.like(f"{prefix}%"))
            .order_by(EFile.e_file_number.desc())
        )

        if latest_efile:
            try:
                seq_part = latest_efile.split("/")[-1]
                next_seq = int(seq_part) + 1
            except Exception:
                count = db.scalar(
                    select(func.count(EFile.id)).where(EFile.e_file_number.like(f"{prefix}%"))
                ) or 0
                next_seq = count + 1
        else:
            next_seq = 1

        return f"{prefix}{next_seq:06d}"

    @classmethod
    def compile_case_snapshot(
        cls,
        db: Session,
        grievance: Grievance,
        e_file_number: str,
        closure_remarks: Optional[str] = None,
        sealed_by_authority: Optional[NivaranAuthority] = None,
    ) -> Dict[str, Any]:
        """
        Compiles an exhaustive, sanitized point-in-time snapshot of the grievance dossier.
        """
        applicant = grievance.applicant
        profile = db.scalar(
            select(ApplicantProfile).where(ApplicantProfile.user_id == grievance.applicant_vyasa_user_id)
        )

        feedback = db.scalar(
            select(GrievanceFeedback).where(GrievanceFeedback.grievance_id == grievance.id)
        )

        history_rows = db.scalars(
            select(GrievanceStatusHistory)
            .where(GrievanceStatusHistory.grievance_id == grievance.id)
            .order_by(GrievanceStatusHistory.created_at.asc())
        ).all()

        docs = db.scalars(
            select(Document).where(Document.grievance_id == grievance.id)
        ).all()

        now = datetime.now(timezone.utc)

        snapshot = {
            "efile_metadata": {
                "e_file_number": e_file_number,
                "compiled_at": now.isoformat(),
                "sealed_by": sealed_by_authority.user.full_name if sealed_by_authority and sealed_by_authority.user else "System / Manager",
            },
            "grievance": {
                "id": str(grievance.id),
                "grievance_id": grievance.grievance_id,
                "title": grievance.title,
                "description": grievance.description,
                "status": grievance.status.value,
                "priority": grievance.priority.value,
                "subject_name": grievance.subject.name if grievance.subject else "Unknown",
                "category_name": grievance.category.name if grievance.category else "Unknown",
                "created_at": grievance.created_at.isoformat() if grievance.created_at else None,
                "resolved_at": grievance.resolved_at.isoformat() if grievance.resolved_at else None,
                "closed_at": grievance.closed_at.isoformat() if grievance.closed_at else now.isoformat(),
            },
            "applicant": {
                "user_id": str(applicant.id) if applicant else None,
                "full_name": applicant.full_name if applicant else "Scholar",
                "email": applicant.email if applicant else None,
                "registration_number": profile.phd_registration_number if profile else None,
                "department": getattr(profile, "department", None) or "General",
            },
            "resolution": {
                "resolved_by_name": grievance.resolved_by.user.full_name if grievance.resolved_by and grievance.resolved_by.user else "Institutional Authority",
                "resolved_at": grievance.resolved_at.isoformat() if grievance.resolved_at else None,
                "resolution_summary": grievance.resolution_summary,
            },
            "feedback": {
                "rating": feedback.rating if feedback else None,
                "timeliness_rating": feedback.timeliness_rating if feedback else None,
                "fairness_rating": feedback.fairness_rating if feedback else None,
                "feedback_text": feedback.feedback_text if feedback else None,
                "created_at": feedback.created_at.isoformat() if feedback and feedback.created_at else None,
            } if feedback else None,
            "closure": {
                "closed_by_name": sealed_by_authority.user.full_name if sealed_by_authority and sealed_by_authority.user else "Manager",
                "closed_at": now.isoformat(),
                "closure_remarks": closure_remarks or "Resolution verified and case formally closed.",
            },
            "history": [
                {
                    "from_status": h.from_status,
                    "to_status": h.to_status,
                    "actor_type": h.actor_type.value,
                    "remarks": h.remarks,
                    "created_at": h.created_at.isoformat() if h.created_at else None,
                }
                for h in history_rows
            ],
            "documents": [
                {
                    "id": str(d.id),
                    "file_name": d.file_name,
                    "file_size": d.file_size,
                    "content_hash": d.content_hash,
                }
                for d in docs
            ],
        }

        return snapshot

    @classmethod
    def generate_efile_dossier(
        cls,
        db: Session,
        grievance: Grievance,
        sealed_by_authority: Optional[NivaranAuthority] = None,
        closure_remarks: Optional[str] = None,
    ) -> EFile:
        """
        Atomically generates, compiles, seals, and links the institutional E-File dossier.
        Guarantees idempotency: returns existing E-File if already generated for this grievance.
        """
        # 1. Idempotency check: Return existing E-File if present
        existing_efile = db.scalar(
            select(EFile).where(EFile.grievance_id == grievance.id)
        )
        if existing_efile:
            logger.info(f"[EFILE] Returning existing E-File {existing_efile.e_file_number} for grievance {grievance.grievance_id}")
            return existing_efile

        now = datetime.now(timezone.utc)
        year = now.year

        # 2. Sequential E-File Number
        e_file_number = cls.generate_sequential_efile_number(db)

        # 3. Ensure StudentMasterRecord exists and is linked
        smr = StudentMasterRecordService.get_or_create_for_user(
            db=db,
            user_id=grievance.applicant_vyasa_user_id,
            subject_id=grievance.subject_id,
        )
        grievance.student_record_id = smr.id

        # 4. Compile snapshot data
        snapshot = cls.compile_case_snapshot(
            db=db,
            grievance=grievance,
            e_file_number=e_file_number,
            closure_remarks=closure_remarks,
            sealed_by_authority=sealed_by_authority,
        )

        # 5. Generate PDF file
        clean_num = e_file_number.replace("/", "_")
        pdf_dir = STORAGE_DIR / str(year)
        pdf_dir.mkdir(parents=True, exist_ok=True)
        pdf_filename = f"{clean_num}.pdf"
        pdf_path = pdf_dir / pdf_filename

        page_count = create_efile_pdf(snapshot=snapshot, output_path=str(pdf_path))

        # 6. Calculate SHA-256 cryptographic digest of the compiled dossier
        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        content_hash = hashlib.sha256(pdf_bytes).hexdigest()

        # 7. Persist EFile record
        efile = EFile(
            id=uuid.uuid4(),
            e_file_number=e_file_number,
            grievance_id=grievance.id,
            applicant_vyasa_user_id=grievance.applicant_vyasa_user_id,
            student_record_id=smr.id,
            status=EFileStatus.FINALIZED,
            file_path=str(pdf_path).replace("\\", "/"),
            content_hash=content_hash,
            page_count=page_count,
            is_sealed=True,
            sealed_at=now,
            sealed_by_authority_id=sealed_by_authority.id if sealed_by_authority else None,
            created_at=now,
        )
        db.add(efile)
        db.flush()

        # 8. Populate nivaran_efile_documents for evidence attachments
        docs = db.scalars(
            select(Document).where(Document.grievance_id == grievance.id).order_by(Document.created_at.asc())
        ).all()

        for idx, doc in enumerate(docs, start=1):
            doc_hash = doc.content_hash or hashlib.sha256(doc.file_name.encode("utf-8")).hexdigest()
            ef_doc = EFileDocument(
                id=uuid.uuid4(),
                efile_id=efile.id,
                document_id=doc.id,
                document_sha256_snapshot=doc_hash,
                section_order=idx,
            )
            db.add(ef_doc)

        # 9. AuditLog entry
        audit_entry = AuditLog(
            id=uuid.uuid4(),
            user_id=sealed_by_authority.vyasa_user_id if sealed_by_authority else None,
            module="atharva_veda",
            action="EFILE_GENERATED",
            entity_name="EFile",
            entity_id=str(efile.id),
            details={
                "e_file_number": efile.e_file_number,
                "grievance_id": grievance.grievance_id,
                "content_hash": content_hash,
                "page_count": page_count,
                "is_sealed": True,
            },
            created_at=now,
        )
        db.add(audit_entry)

        # 10. In-App Notification to applicant
        notif = Notification(
            id=uuid.uuid4(),
            user_id=grievance.applicant_vyasa_user_id,
            title="Official E-File Generated",
            message=(
                f"Official E-File {efile.e_file_number} has been generated and sealed for grievance "
                f"{grievance.grievance_id}. You can now view and download your sealed dossier."
            ),
            type="workflow",
            metadata_json={
                "module": "atharva_veda",
                "event": "EFILE_GENERATED",
                "efile_id": str(efile.id),
                "e_file_number": efile.e_file_number,
                "grievance_id": str(grievance.id),
            },
            created_at=now,
        )
        db.add(notif)

        return efile

    @classmethod
    def verify_efile_integrity(cls, db: Session, efile_id: uuid.UUID) -> Dict[str, Any]:
        """
        Cryptographically verifies SHA-256 integrity seal against the stored physical PDF dossier.
        """
        efile = db.get(EFile, efile_id)
        if not efile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="E-File not found",
            )

        if not efile.file_path or not os.path.exists(efile.file_path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="E-File physical PDF dossier document not found on storage disk",
            )

        with open(efile.file_path, "rb") as f:
            pdf_bytes = f.read()

        calculated_hash = hashlib.sha256(pdf_bytes).hexdigest()
        is_valid = (calculated_hash.lower() == (efile.content_hash or "").lower())

        return {
            "e_file_number": efile.e_file_number,
            "is_valid": is_valid,
            "calculated_hash": calculated_hash,
            "stored_hash": efile.content_hash,
            "is_sealed": efile.is_sealed,
            "sealed_at": efile.sealed_at,
            "algorithm": "SHA-256",
        }

    @classmethod
    def get_my_efiles(cls, db: Session, current_user: User) -> List[Dict[str, Any]]:
        """
        Returns all E-Files owned by the authenticated scholar.
        """
        efiles = db.scalars(
            select(EFile)
            .where(EFile.applicant_vyasa_user_id == current_user.id)
            .order_by(EFile.created_at.desc())
        ).all()

        results = []
        for ef in efiles:
            results.append({
                "id": ef.id,
                "e_file_number": ef.e_file_number,
                "grievance_id": ef.grievance_id,
                "grievance_ref": ef.grievance.grievance_id if ef.grievance else "Unknown",
                "applicant_vyasa_user_id": ef.applicant_vyasa_user_id,
                "applicant_name": ef.applicant.full_name if ef.applicant else "Scholar",
                "student_record_id": ef.student_record_id,
                "student_record_number": ef.student_record.record_number if ef.student_record else None,
                "status": ef.status.value,
                "file_path": ef.file_path,
                "content_hash": ef.content_hash,
                "page_count": ef.page_count,
                "is_sealed": ef.is_sealed,
                "sealed_at": ef.sealed_at,
                "sealed_by_authority_name": ef.sealed_by.user.full_name if ef.sealed_by and ef.sealed_by.user else "System",
                "created_at": ef.created_at,
                "documents": [
                    {
                        "id": d.id,
                        "document_id": d.document_id,
                        "file_name": d.document.file_name if d.document else "Attachment",
                        "document_sha256_snapshot": d.document_sha256_snapshot,
                        "section_order": d.section_order,
                    }
                    for d in ef.documents
                ],
            })
        return results

    @classmethod
    def list_efiles(
        cls,
        db: Session,
        current_authority: NivaranAuthority,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 15,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Authority listing and searching of institutional E-Files.
        Enforces role-based jurisdiction filtering:
        - Manager & Dean: All university E-Files.
        - Assistant Dean: Only E-Files within their subject cluster jurisdiction.
        - Associate Dean: Permitted cluster E-Files.
        """
        stmt = (
            select(EFile)
            .join(Grievance, EFile.grievance_id == Grievance.id)
            .outerjoin(Subject, Grievance.subject_id == Subject.id)
            .outerjoin(StudentMasterRecord, EFile.student_record_id == StudentMasterRecord.id)
        )

        if current_authority.role == NivaranRole.ASSISTANT_DEAN:
            cluster = db.scalar(
                select(SubjectCluster).where(SubjectCluster.assistant_dean_id == current_authority.id)
            )
            if not cluster:
                return [], 0
            stmt = stmt.where(Subject.subject_cluster_id == cluster.id)

        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    EFile.e_file_number.ilike(q),
                    Grievance.grievance_id.ilike(q),
                    Grievance.title.ilike(q),
                    StudentMasterRecord.registration_number_snapshot.ilike(q),
                    StudentMasterRecord.full_name_snapshot.ilike(q),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.scalar(count_stmt) or 0

        offset = (page - 1) * page_size
        efiles = db.scalars(
            stmt.order_by(EFile.created_at.desc()).offset(offset).limit(page_size)
        ).all()

        results = []
        for ef in efiles:
            results.append({
                "id": ef.id,
                "e_file_number": ef.e_file_number,
                "grievance_id": ef.grievance_id,
                "grievance_ref": ef.grievance.grievance_id if ef.grievance else "Unknown",
                "grievance_title": ef.grievance.title if ef.grievance else None,
                "applicant_vyasa_user_id": ef.applicant_vyasa_user_id,
                "applicant_name": ef.applicant.full_name if ef.applicant else "Scholar",
                "student_record_id": ef.student_record_id,
                "student_record_number": ef.student_record.record_number if ef.student_record else None,
                "status": ef.status.value,
                "file_path": ef.file_path,
                "content_hash": ef.content_hash,
                "page_count": ef.page_count,
                "is_sealed": ef.is_sealed,
                "sealed_at": ef.sealed_at,
                "sealed_by_authority_name": ef.sealed_by.user.full_name if ef.sealed_by and ef.sealed_by.user else "System",
                "created_at": ef.created_at,
                "documents": [
                    {
                        "id": d.id,
                        "document_id": d.document_id,
                        "file_name": d.document.file_name if d.document else "Attachment",
                        "document_sha256_snapshot": d.document_sha256_snapshot,
                        "section_order": d.section_order,
                    }
                    for d in ef.documents
                ],
            })
        return results, total

    @classmethod
    def get_efile_detail(
        cls,
        db: Session,
        efile_id: uuid.UUID,
        current_user: User,
        current_authority: Optional[NivaranAuthority] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves E-File detail with strict IDOR access control.
        """
        efile = db.get(EFile, efile_id)
        if not efile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="E-File not found",
            )

        # IDOR check:
        is_owner = (efile.applicant_vyasa_user_id == current_user.id)
        if not is_owner:
            if not current_authority:
                current_authority = db.scalar(
                    select(NivaranAuthority).where(
                        NivaranAuthority.vyasa_user_id == current_user.id,
                        NivaranAuthority.is_active.is_(True),
                    )
                )
            if not current_authority:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not authorized to view this E-File",
                )

            # Jurisdiction check
            if current_authority.role == NivaranRole.ASSISTANT_DEAN:
                cluster = db.scalar(
                    select(SubjectCluster).where(SubjectCluster.assistant_dean_id == current_authority.id)
                )
                if not cluster or not efile.grievance or not efile.grievance.subject or efile.grievance.subject.subject_cluster_id != cluster.id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="E-File falls outside your subject cluster jurisdiction",
                    )

        return {
            "id": efile.id,
            "e_file_number": efile.e_file_number,
            "grievance_id": efile.grievance_id,
            "grievance_ref": efile.grievance.grievance_id if efile.grievance else "Unknown",
            "applicant_vyasa_user_id": efile.applicant_vyasa_user_id,
            "applicant_name": efile.applicant.full_name if efile.applicant else "Scholar",
            "student_record_id": efile.student_record_id,
            "student_record_number": efile.student_record.record_number if efile.student_record else None,
            "status": efile.status.value,
            "file_path": efile.file_path,
            "content_hash": efile.content_hash,
            "page_count": efile.page_count,
            "is_sealed": efile.is_sealed,
            "sealed_at": efile.sealed_at,
            "sealed_by_authority_name": efile.sealed_by.user.full_name if efile.sealed_by and efile.sealed_by.user else "System",
            "created_at": efile.created_at,
            "documents": [
                {
                    "id": d.id,
                    "document_id": d.document_id,
                    "file_name": d.document.file_name if d.document else "Attachment",
                    "document_sha256_snapshot": d.document_sha256_snapshot,
                    "section_order": d.section_order,
                }
                for d in efile.documents
            ],
        }

    @classmethod
    def get_efile_pdf_path(
        cls,
        db: Session,
        efile_id: uuid.UUID,
        current_user: User,
        current_authority: Optional[NivaranAuthority] = None,
    ) -> str:
        """
        Retrieves disk path to PDF dossier for download after verifying permissions.
        """
        detail = cls.get_efile_detail(db, efile_id, current_user, current_authority)
        path = detail.get("file_path")
        if not path or not os.path.exists(path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="E-File physical PDF file not found on disk",
            )
        return path
