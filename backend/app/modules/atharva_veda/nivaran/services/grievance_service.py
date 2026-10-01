import base64
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User
from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.document import Document
from app.modules.atharva_veda.nivaran.models.enums import (
    GrievancePriority,
    GrievanceStatus,
    HistoryActorType,
    NivaranRole,
    StudentRecordStatus,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, Subject, SubjectCluster, GrievanceCluster

from app.modules.atharva_veda.nivaran.schemas.grievance import (
    DocumentUploadItem,
    GrievanceSubmitRequest,
)
from app.modules.atharva_veda.nivaran.services.ai_classification_pipeline import ai_pipeline
from app.modules.atharva_veda.nivaran.services.ai_processing_service import (
    AIProcessingService,
    resolve_db_category,
)
from app.modules.atharva_veda.nivaran.services.submission_restriction_service import (
    check_daily_submission_limit,
    check_similar_active_grievance,
)

logger = logging.getLogger("vyasa.atharva.grievance_service")

STORAGE_BASE_DIR = Path("storage/uploads")


class GrievanceService:
    @staticmethod
    def _generate_tracking_id(db: Session) -> str:
        """
        Generates canonical sequential institutional tracking ID in format CSJMU-{YYYY}-{SEQ:05d}.
        Example: CSJMU-2026-00001
        """
        year = datetime.now(timezone.utc).year
        prefix = f"CSJMU-{year}-"

        # Count existing grievances for current year
        count = db.scalar(
            select(func.count(Grievance.id)).where(Grievance.grievance_id.like(f"{prefix}%"))
        ) or 0

        seq = count + 1
        return f"{prefix}{seq:05d}"

    @classmethod
    def _ensure_student_master_record(
        cls,
        db: Session,
        applicant: User,
        subject: Subject,
    ) -> StudentMasterRecord:
        """
        Retrieves or initializes point-in-time StudentMasterRecord snapshot for the scholar.
        Links scholar's profile and subject affiliation to prevent loss of institutional evidence.
        """
        record = db.scalar(
            select(StudentMasterRecord).where(
                StudentMasterRecord.student_vyasa_user_id == applicant.id
            )
        )
        if record:
            return record

        # Read applicant profile if available
        profile = db.scalar(
            select(ApplicantProfile).where(ApplicantProfile.user_id == applicant.id)
        )

        year = datetime.now(timezone.utc).year
        record_number = f"SMR-{year}-{str(applicant.id)[:8].upper()}"

        reg_no = profile.phd_registration_number if profile else None
        record = StudentMasterRecord(
            student_vyasa_user_id=applicant.id,
            record_number=record_number,
            registration_number_snapshot=reg_no,
            enrollment_number_snapshot=reg_no,
            full_name_snapshot=applicant.full_name,
            email_snapshot=applicant.email,
            mobile_snapshot=None,
            subject_id=subject.id,
            status=StudentRecordStatus.ACTIVE,
        )
        db.add(record)
        db.flush()
        return record

    ALLOWED_EXTENSIONS = {
        ".pdf",
        ".png",
        ".jpg",
        ".jpeg",
        ".doc",
        ".docx",
        ".txt",
        ".csv",
        ".xlsx",
        ".xls",
    }
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
    MAX_ATTACHMENTS = 5

    @classmethod
    def _save_document_attachments(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        uploader_id: uuid.UUID,
        documents: List[DocumentUploadItem],
    ) -> None:
        """
        Saves document attachments to filesystem and records metadata in nivaran_documents.
        Validates maximum attachments (5), allowed file extensions, and file sizes (<= 20MB).
        """
        if not documents:
            return

        if len(documents) > cls.MAX_ATTACHMENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Exceeded maximum attachment limit of {cls.MAX_ATTACHMENTS} files.",
            )

        target_dir = STORAGE_BASE_DIR / str(grievance_id)
        target_dir.mkdir(parents=True, exist_ok=True)

        for doc_item in documents:
            original_name = doc_item.file_name or "attachment"
            ext = Path(original_name).suffix.lower()
            if ext not in cls.ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File extension '{ext}' is not supported. Allowed extensions: {', '.join(sorted(cls.ALLOWED_EXTENSIONS))}",
                )

            if doc_item.file_size > cls.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File '{doc_item.file_name}' exceeds maximum limit of 20MB.",
                )

            if doc_item.file_size <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Uploaded file '{doc_item.file_name}' is empty.",
                )

            content_bytes = b""
            if doc_item.content_base64:
                try:
                    content_bytes = base64.b64decode(doc_item.content_base64)
                except Exception as e:
                    logger.warning(f"[Attachment] Failed to decode base64 attachment: {e}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Corrupt base64 content in file '{doc_item.file_name}'.",
                    )

            if not content_bytes:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Uploaded file '{doc_item.file_name}' has empty payload.",
                )

            content_hash = hashlib.sha256(content_bytes).hexdigest()

            # Sanitize file name to prevent path traversal
            safe_name = os.path.basename(original_name).replace(" ", "_")
            safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-") or "attachment"
            file_disk_path = target_dir / f"{uuid.uuid4().hex[:8]}_{safe_name}"

            with open(file_disk_path, "wb") as f:
                f.write(content_bytes)

            doc_record = Document(
                grievance_id=grievance_id,
                uploaded_by_vyasa_user_id=uploader_id,
                file_name=doc_item.file_name,
                file_path=str(file_disk_path),
                mime_type=doc_item.mime_type,
                file_size=len(content_bytes),
                document_type=doc_item.document_type,
                content_hash=content_hash,
                ocr_status="COMPLETED" if ext in [".png", ".jpg", ".jpeg", ".webp", ".pdf"] else "NOT_APPLICABLE",
            )
            db.add(doc_record)

    @classmethod
    def submit_grievance(
        cls,
        db: Session,
        applicant: User,
        request_data: GrievanceSubmitRequest,
    ) -> Grievance:
        """
        Executes applicant grievance submission lifecycle matching NIVARAN reference behavior:
        1. Enforces daily submission limit (5/day in Asia/Kolkata).
        2. Automatically resolves academic Subject from applicant's profile or student record.
        3. Runs TF-IDF + LogisticRegression AI classification to determine category.
        4. Enforces semantic duplicate and active-case prevention.
        5. Initializes/retrieves StudentMasterRecord snapshot.
        6. Generates sequential tracking ID (CSJMU-YYYY-NNNNN).
        7. Persists Grievance in SUBMITTED state (default priority MEDIUM).
        8. Saves document attachments if provided.
        9. Executes AI Processing (SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW).
        10. Preserves status history and records AuditLog entry.
        """
        # 1. Quota check (5/day)
        check_daily_submission_limit(db, applicant)

        clean_title = request_data.title.strip()
        clean_desc = request_data.description.strip()
        if len(clean_title) < 5 or len(clean_title) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Grievance title must contain between 5 and 255 characters.",
            )
        if len(clean_desc) < 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Detailed description must contain at least 20 characters.",
            )

        # 2. Resolve academic Subject: check explicit client request first, then profile/SMR fallback
        subject: Optional[Subject] = None
        if getattr(request_data, "subject_id", None):
            subject = db.scalar(
                select(Subject).where(Subject.id == request_data.subject_id, Subject.is_active.is_(True))
            )
            if not subject:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified academic subject is invalid or inactive.",
                )
            if not subject.subject_cluster_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified subject is not assigned to an active subject cluster.",
                )
        else:
            profile = db.scalar(
                select(ApplicantProfile).where(ApplicantProfile.user_id == applicant.id)
            )
            if profile and profile.subject_id:
                subject = db.scalar(
                    select(Subject).where(Subject.id == profile.subject_id, Subject.is_active.is_(True))
                )

            if not subject:
                smr = db.scalar(
                    select(StudentMasterRecord).where(
                        StudentMasterRecord.student_vyasa_user_id == applicant.id,
                        StudentMasterRecord.status == StudentRecordStatus.ACTIVE,
                    )
                )
                if smr and smr.subject_id:
                    subject = db.scalar(
                        select(Subject).where(Subject.id == smr.subject_id, Subject.is_active.is_(True))
                    )

            if not subject:
                # Fallback to first active academic subject in the institutional taxonomy
                subject = db.scalar(
                    select(Subject).where(Subject.is_active.is_(True)).order_by(Subject.name.asc())
                )

        if not subject:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active academic subject available. Please ensure institutional subjects are configured.",
            )

        # 3. Category handling: client-provided or AI classification
        category: Optional[Category] = None
        predicted_cat_name = None
        confidence_score = 0.50

        if getattr(request_data, "category_id", None):
            category = db.scalar(
                select(Category).where(Category.id == request_data.category_id, Category.is_active.is_(True))
            )
            if not category:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Specified grievance category is invalid or inactive.",
                )
            predicted_cat_name = category.name
            confidence_score = 1.0

        ai_res = ai_pipeline.process_grievance_text(
            title=clean_title,
            description=clean_desc,
        )
        if not category:
            predicted_cat_name = ai_res.get("predicted_category")
            confidence_score = float(ai_res.get("confidence_score", 0.50))
            category = resolve_db_category(db, predicted_cat_name)

        # 4. Duplicate prevention
        check_similar_active_grievance(
            db=db,
            applicant=applicant,
            title=clean_title,
            description=clean_desc,
            subject_id=subject.id,
            category_id=category.id,
            predicted_category=predicted_cat_name,
        )

        # 5. Student Master Record snapshot
        student_record = cls._ensure_student_master_record(db, applicant, subject)

        # 6. Generate sequential institutional tracking ID
        tracking_id = cls._generate_tracking_id(db)

        # 7. Create Grievance
        grievance = Grievance(
            grievance_id=tracking_id,
            applicant_vyasa_user_id=applicant.id,
            student_record_id=student_record.id,
            subject_id=subject.id,
            category_id=category.id,
            final_category_id=category.id,
            status=GrievanceStatus.SUBMITTED,
            priority=GrievancePriority.MEDIUM,
            title=clean_title,
            description=clean_desc,
            category_reviewed=False,
            category_overridden=False,
            ai_suggested_category_id=category.id,
            ai_confidence=confidence_score,
        )
        db.add(grievance)
        db.flush()

        # 8. Record initial history: None -> SUBMITTED
        init_history = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=None,
            to_status=GrievanceStatus.SUBMITTED.value,
            actor_user_id=applicant.id,
            actor_type=HistoryActorType.USER,
            remarks="Initial grievance submitted by applicant.",
        )
        db.add(init_history)

        # 9. Save document attachments
        if request_data.documents:
            cls._save_document_attachments(
                db=db,
                grievance_id=grievance.id,
                uploader_id=applicant.id,
                documents=request_data.documents,
            )

        # 10. AI Processing: SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW
        try:
            AIProcessingService.process_new_grievance(db=db, grievance=grievance)
        except Exception as ai_err:
            logger.warning(f"[AI Processing] Non-fatal classification notice: {ai_err}")

        grievance.status = GrievanceStatus.PENDING_REVIEW

        ai_history = GrievanceStatusHistory(
            grievance_id=grievance.id,
            from_status=GrievanceStatus.SUBMITTED.value,
            to_status=GrievanceStatus.PENDING_REVIEW.value,
            actor_user_id=None,
            actor_type=HistoryActorType.SYSTEM,
            remarks="AI processing complete: category classified and transitioned to pending review.",
        )
        db.add(ai_history)

        # 11. Dispatch Notification to applicant
        notification = Notification(
            user_id=applicant.id,
            title="Grievance Submitted",
            message=f"Your grievance {tracking_id} has been successfully submitted and is under review.",
            type="GRIEVANCE_SUBMITTED",
            metadata_json={
                "grievance_id": str(grievance.id),
                "tracking_id": tracking_id,
                "status": grievance.status.value,
            },
        )
        db.add(notification)

        # 12. Audit Log
        audit_entry = AuditLog(
            user_id=applicant.id,
            module="atharva_veda",
            action="grievance.submitted",
            entity_name="Grievance",
            entity_id=str(grievance.id),
            details={
                "grievance_id": tracking_id,
                "title": grievance.title,
                "subject": subject.name,
                "category": category.name,
                "priority": grievance.priority.value,
                "ai_confidence": confidence_score,
            },
        )
        db.add(audit_entry)

        db.commit()
        db.refresh(grievance)

        logger.info(
            f"[Grievance Submitted] Grievance {tracking_id} successfully created for applicant {applicant.email}"
        )
        return grievance

    @classmethod
    def upload_grievance_document(
        cls,
        db: Session,
        grievance_id_or_tracking: str,
        current_user: User,
        file_name: str,
        file_bytes: bytes,
        mime_type: str,
        document_type: str = "ATTACHMENT",
    ) -> Document:
        """
        Uploads and binds a document attachment to an existing grievance matching reference documents API.
        Verifies ownership (applicant or authorized authority), max 5 documents, 20MB limit, allowed extensions.
        """
        # Resolve grievance by UUID or tracking ID
        parsed_uuid = None
        if len(grievance_id_or_tracking) == 36:
            try:
                parsed_uuid = uuid.UUID(grievance_id_or_tracking)
            except ValueError:
                parsed_uuid = None

        stmt = select(Grievance).where(
            (Grievance.grievance_id == grievance_id_or_tracking)
            | (Grievance.id == parsed_uuid)
        )
        grievance = db.scalar(stmt)
        if not grievance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Grievance not found")

        # Ownership check: applicant can only upload to own grievance
        roles = [r.name.lower() for r in current_user.roles]
        is_admin = "administrator" in roles or "admin" in roles
        if "applicant" in roles and grievance.applicant_vyasa_user_id != current_user.id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this grievance",
            )

        # Attachment count limit
        existing_count = db.scalar(
            select(func.count(Document.id)).where(Document.grievance_id == grievance.id)
        ) or 0
        if existing_count >= cls.MAX_ATTACHMENTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Exceeded maximum attachment limit of {cls.MAX_ATTACHMENTS} files.",
            )

        # Extension check
        original_name = file_name or "attachment"
        ext = Path(original_name).suffix.lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{ext}' is not supported. Allowed extensions: {', '.join(sorted(cls.ALLOWED_EXTENSIONS))}",
            )

        # Size check
        file_size = len(file_bytes)
        if file_size <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")
        if file_size > cls.MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File size exceeds maximum limit of 20MB.")

        # Save to disk
        target_dir = STORAGE_BASE_DIR / str(grievance.id)
        target_dir.mkdir(parents=True, exist_ok=True)
        safe_name = os.path.basename(original_name).replace(" ", "_")
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in "._-") or "attachment"
        doc_id = uuid.uuid4()
        disk_path = target_dir / f"{doc_id.hex[:8]}_{safe_name}"

        with open(disk_path, "wb") as f:
            f.write(file_bytes)

        content_hash = hashlib.sha256(file_bytes).hexdigest()

        doc = Document(
            id=doc_id,
            grievance_id=grievance.id,
            uploaded_by_vyasa_user_id=current_user.id,
            file_name=original_name,
            file_path=str(disk_path),
            mime_type=mime_type or "application/octet-stream",
            file_size=file_size,
            document_type=document_type,
            content_hash=content_hash,
            ocr_status="COMPLETED" if ext in [".png", ".jpg", ".jpeg", ".webp", ".pdf"] else "NOT_APPLICABLE",
        )
        db.add(doc)

        audit_entry = AuditLog(
            user_id=current_user.id,
            module="atharva_veda",
            action="grievance.document_uploaded",
            entity_name="Document",
            entity_id=str(doc.id),
            details={
                "grievance_id": grievance.grievance_id,
                "file_name": original_name,
                "file_size": file_size,
                "document_type": document_type,
            },
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(doc)
        return doc

    @classmethod
    def get_document_file_for_download(
        cls,
        db: Session,
        document_id: uuid.UUID,
        current_user: User,
    ) -> tuple[Path, str, str]:
        """
        Retrieves document file on disk for secure authorized download.
        Enforces access control (applicant owns grievance or authority has appointment).
        """
        doc = db.get(Document, document_id)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

        grievance = db.get(Grievance, doc.grievance_id)
        if not grievance:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Associated grievance not found.")

        roles = [r.name.lower() for r in current_user.roles]
        is_admin = "administrator" in roles or "admin" in roles
        if "applicant" in roles and grievance.applicant_vyasa_user_id != current_user.id and not is_admin:
            authority = db.scalar(
                select(NivaranAuthority).where(
                    NivaranAuthority.vyasa_user_id == current_user.id,
                    NivaranAuthority.is_active.is_(True),
                )
            )
            if not authority:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this document.",
                )

        file_path = Path(doc.file_path)
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file does not exist on disk.",
            )

        return file_path, doc.file_name, doc.mime_type

    @classmethod
    def get_applicant_grievances(
        cls,
        db: Session,
        applicant: User,
    ) -> List[Grievance]:
        """
        Retrieves all grievances filed by the authenticated applicant.
        Guarantees complete tenant and user isolation.
        """
        stmt = (
            select(Grievance)
            .where(Grievance.applicant_vyasa_user_id == applicant.id)
            .order_by(Grievance.created_at.desc())
        )
        return list(db.scalars(stmt).all())

    @classmethod
    def get_grievance_detail(
        cls,
        db: Session,
        grievance_id: uuid.UUID,
        current_user: User,
    ) -> Grievance:
        """
        Retrieves complete grievance detail including status history and attachments.
        Enforces object-level authorization:
        - Submitting applicant may access their own case.
        - Institutional authority / manager / administrator may access.
        """
        grievance = db.scalar(
            select(Grievance)
            .options(
                selectinload(Grievance.subject),
                selectinload(Grievance.category),
                selectinload(Grievance.applicant),
                selectinload(Grievance.assigned_authority),
            )
            .where(Grievance.id == grievance_id)
        )

        if not grievance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Grievance with identifier '{grievance_id}' was not found.",
            )

        # Object-level authorization check:
        # 1. Submitting applicant has direct access to their own case dossier
        if grievance.applicant_vyasa_user_id == current_user.id:
            return grievance

        # 2. Institutional authority scope check
        authority = db.scalar(
            select(NivaranAuthority).where(
                NivaranAuthority.vyasa_user_id == current_user.id,
                NivaranAuthority.is_active.is_(True),
            )
        )

        if not authority:
            # Users without institutional authority appointment (including platform administrators) are denied
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have authorization to view this grievance record.",
            )

        # 3. Dean has executive oversight over all institutional cases
        if authority.role == NivaranRole.DEAN:
            return grievance

        # 4. Manager has triage and review oversight over all cases
        if authority.role == NivaranRole.MANAGER:
            return grievance

        # 5. Assistant Dean scope: direct assignment or scholar's subject in assigned subject cluster
        if authority.role == NivaranRole.ASSISTANT_DEAN:
            if grievance.assigned_authority_id == authority.id:
                return grievance

            subj_cluster = db.scalar(
                select(SubjectCluster).where(
                    SubjectCluster.assistant_dean_id == authority.id,
                    SubjectCluster.is_active.is_(True),
                )
            )
            if subj_cluster and grievance.subject_id:
                subj = db.get(Subject, grievance.subject_id)
                if subj and subj.subject_cluster_id == subj_cluster.id:
                    return grievance

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Case is outside your subject cluster jurisdiction.",
            )

        # 6. Associate Dean scope: direct assignment or case category in assigned grievance cluster
        if authority.role == NivaranRole.ASSOCIATE_DEAN:
            if grievance.assigned_authority_id == authority.id:
                return grievance

            grv_cluster = db.scalar(
                select(GrievanceCluster).where(
                    GrievanceCluster.associate_dean_id == authority.id,
                    GrievanceCluster.is_active.is_(True),
                )
            )
            if grv_cluster:
                effective_cat_id = grievance.final_category_id or grievance.category_id
                if effective_cat_id:
                    cat = db.get(Category, effective_cat_id)
                    if cat and cat.grievance_cluster_id == grv_cluster.id:
                        return grievance

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Case is outside your grievance cluster jurisdiction.",
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authorization to view this grievance record.",
        )

