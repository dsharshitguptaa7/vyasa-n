import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.applicant_profile import ApplicantProfile
from app.models.audit import AuditLog
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.efile import EFile
from app.modules.atharva_veda.nivaran.models.enums import (
    GrievanceStatus,
    NivaranRole,
    StudentRecordStatus,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, SubjectCluster

logger = logging.getLogger("vyasa.atharva.nivaran.services.student_master_record")


class StudentMasterRecordService:
    @classmethod
    def get_or_create_for_user(
        cls,
        db: Session,
        user_id: uuid.UUID,
        subject_id: Optional[uuid.UUID] = None,
    ) -> StudentMasterRecord:
        """
        Retrieves or initializes point-in-time StudentMasterRecord snapshot for a scholar.
        Maintains single canonical identity mapped 1:1 with users.id.
        """
        record = db.scalar(
            select(StudentMasterRecord).where(
                StudentMasterRecord.student_vyasa_user_id == user_id
            )
        )
        if record:
            return record

        user = db.get(User, user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found for Student Master Record creation",
            )

        profile = db.scalar(select(ApplicantProfile).where(ApplicantProfile.user_id == user_id))
        reg_no = profile.phd_registration_number if profile else None
        enrollment_no = getattr(profile, "enrollment_number", None) or reg_no

        # Resolve subject
        target_subject_id = subject_id
        if not target_subject_id and profile and profile.subject_id:
            target_subject_id = profile.subject_id
        if not target_subject_id:
            # Fallback to first active subject
            first_subj = db.scalar(select(Subject).where(Subject.is_active.is_(True)).order_by(Subject.name))
            if first_subj:
                target_subject_id = first_subj.id

        if not target_subject_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot initialize Student Master Record without a valid academic subject affiliation",
            )

        year = datetime.now(timezone.utc).year
        if reg_no:
            record_number = f"SERF-{reg_no}"
        else:
            record_number = f"SERF-{year}-{str(user_id)[:8].upper()}"

        # Ensure uniqueness of record_number
        existing_num = db.scalar(
            select(StudentMasterRecord).where(StudentMasterRecord.record_number == record_number)
        )
        if existing_num:
            record_number = f"SERF-{year}-{uuid.uuid4().hex[:6].upper()}"

        record = StudentMasterRecord(
            id=uuid.uuid4(),
            student_vyasa_user_id=user.id,
            record_number=record_number,
            registration_number_snapshot=reg_no,
            enrollment_number_snapshot=enrollment_no,
            full_name_snapshot=user.full_name or "Scholar",
            email_snapshot=user.email,
            mobile_snapshot=getattr(profile, "mobile_number", None),
            subject_id=target_subject_id,
            status=StudentRecordStatus.ACTIVE,
        )
        db.add(record)
        db.flush()

        # AuditLog entry
        audit = AuditLog(
            id=uuid.uuid4(),
            user_id=user.id,
            module="atharva_veda",
            action="STUDENT_MASTER_RECORD_CREATED",
            entity_name="StudentMasterRecord",
            entity_id=str(record.id),
            details={
                "record_number": record.record_number,
                "student_id": str(user.id),
                "registration_number": reg_no,
            },
        )
        db.add(audit)
        return record

    @classmethod
    def get_my_record(cls, db: Session, current_user: User) -> Dict[str, Any]:
        """
        Retrieves the authenticated scholar's own Master Digital E-Record.
        """
        record = cls.get_or_create_for_user(db, current_user.id)
        db.commit()
        return cls._build_record_detail(db, record)

    @classmethod
    def get_record_detail(
        cls,
        db: Session,
        record_id: uuid.UUID,
        current_user: User,
        current_authority: Optional[NivaranAuthority] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves complete SMR detail with strict IDOR access control:
        - Applicant: Only own record.
        - Manager / Dean: Institution-wide access.
        - Assistant Dean: Only scholars in their configured subject cluster.
        """
        record = db.get(StudentMasterRecord, record_id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student Master Record not found",
            )

        # 1. Applicant check
        if record.student_vyasa_user_id == current_user.id:
            return cls._build_record_detail(db, record)

        # 2. Authority check
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
                detail="You do not have authorization to view this Student Master Record",
            )

        # 3. Role jurisdiction check
        if current_authority.role in (NivaranRole.MANAGER, NivaranRole.DEAN):
            return cls._build_record_detail(db, record)

        if current_authority.role == NivaranRole.ASSISTANT_DEAN:
            # Check if subject is in assistant dean's cluster
            cluster = db.scalar(
                select(SubjectCluster).where(SubjectCluster.assistant_dean_id == current_authority.id)
            )
            if not cluster:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Assistant Dean is not assigned to an active Subject Cluster",
                )
            subj = db.get(Subject, record.subject_id)
            if not subj or subj.subject_cluster_id != cluster.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Record falls outside Assistant Dean's subject cluster jurisdiction",
                )
            return cls._build_record_detail(db, record)

        if current_authority.role == NivaranRole.ASSOCIATE_DEAN:
            # Associate Deans have cluster access
            return cls._build_record_detail(db, record)

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access Student Master Record",
        )

    @classmethod
    def search_records(
        cls,
        db: Session,
        current_authority: NivaranAuthority,
        query_str: Optional[str] = None,
        registration_number: Optional[str] = None,
        page: int = 1,
        page_size: int = 15,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Authority directory search for Student Master Records.
        Enforces role-based jurisdiction filtering:
        - Manager & Dean: All university records.
        - Assistant Dean: Only scholars affiliated with their cluster subjects.
        """
        stmt = select(StudentMasterRecord)

        # Jurisdiction filter for Assistant Dean
        if current_authority.role == NivaranRole.ASSISTANT_DEAN:
            cluster = db.scalar(
                select(SubjectCluster).where(SubjectCluster.assistant_dean_id == current_authority.id)
            )
            if not cluster:
                return [], 0
            stmt = stmt.join(Subject, StudentMasterRecord.subject_id == Subject.id).where(
                Subject.subject_cluster_id == cluster.id
            )

        # Exact registration number match preferred
        if registration_number:
            stmt = stmt.where(
                StudentMasterRecord.registration_number_snapshot == registration_number.strip()
            )
        elif query_str:
            q = f"%{query_str.strip()}%"
            stmt = stmt.where(
                or_(
                    StudentMasterRecord.registration_number_snapshot.ilike(q),
                    StudentMasterRecord.full_name_snapshot.ilike(q),
                    StudentMasterRecord.email_snapshot.ilike(q),
                    StudentMasterRecord.record_number.ilike(q),
                )
            )

        # Count total
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = db.scalar(count_stmt) or 0

        # Paginate
        offset = (page - 1) * page_size
        records = db.scalars(
            stmt.order_by(StudentMasterRecord.created_at.desc()).offset(offset).limit(page_size)
        ).all()

        results = []
        for rec in records:
            # Query counts
            total_grv = db.scalar(
                select(func.count(Grievance.id)).where(Grievance.applicant_vyasa_user_id == rec.student_vyasa_user_id)
            ) or 0
            open_grv = db.scalar(
                select(func.count(Grievance.id)).where(
                    Grievance.applicant_vyasa_user_id == rec.student_vyasa_user_id,
                    Grievance.status.in_([
                        GrievanceStatus.SUBMITTED,
                        GrievanceStatus.AI_PROCESSING,
                        GrievanceStatus.PENDING_REVIEW,
                        GrievanceStatus.ASSIGNED,
                        GrievanceStatus.IN_PROGRESS,
                        GrievanceStatus.AWAITING_INFORMATION,
                        GrievanceStatus.ESCALATED,
                    ]),
                )
            ) or 0
            res_grv = db.scalar(
                select(func.count(Grievance.id)).where(
                    Grievance.applicant_vyasa_user_id == rec.student_vyasa_user_id,
                    Grievance.status == GrievanceStatus.RESOLVED,
                )
            ) or 0
            closed_grv = db.scalar(
                select(func.count(Grievance.id)).where(
                    Grievance.applicant_vyasa_user_id == rec.student_vyasa_user_id,
                    Grievance.status == GrievanceStatus.CLOSED,
                )
            ) or 0
            efiles_count = db.scalar(
                select(func.count(EFile.id)).where(EFile.applicant_vyasa_user_id == rec.student_vyasa_user_id)
            ) or 0

            results.append({
                "id": rec.id,
                "record_number": rec.record_number,
                "student_vyasa_user_id": rec.student_vyasa_user_id,
                "full_name_snapshot": rec.full_name_snapshot,
                "email_snapshot": rec.email_snapshot,
                "mobile_snapshot": rec.mobile_snapshot,
                "registration_number_snapshot": rec.registration_number_snapshot,
                "enrollment_number_snapshot": rec.enrollment_number_snapshot,
                "subject_id": rec.subject_id,
                "subject_name": rec.subject.name if rec.subject else "Unknown",
                "status": rec.status.value,
                "total_grievances": total_grv,
                "open_grievances": open_grv,
                "resolved_grievances": res_grv,
                "closed_grievances": closed_grv,
                "total_efiles": efiles_count,
                "created_at": rec.created_at,
            })

        return results, total

    @classmethod
    def _build_record_detail(cls, db: Session, record: StudentMasterRecord) -> Dict[str, Any]:
        """Constructs detailed payload containing linked grievances and efiles."""
        grievances = db.scalars(
            select(Grievance)
            .where(Grievance.applicant_vyasa_user_id == record.student_vyasa_user_id)
            .order_by(Grievance.created_at.desc())
        ).all()

        efiles = db.scalars(
            select(EFile)
            .where(EFile.applicant_vyasa_user_id == record.student_vyasa_user_id)
            .order_by(EFile.created_at.desc())
        ).all()

        efile_by_grievance = {ef.grievance_id: ef for ef in efiles}

        grv_list = []
        for g in grievances:
            linked_ef = efile_by_grievance.get(g.id)
            grv_list.append({
                "id": g.id,
                "grievance_id": g.grievance_id,
                "title": g.title,
                "status": g.status.value,
                "priority": g.priority.value,
                "category_name": g.category.name if g.category else "Uncategorized",
                "created_at": g.created_at,
                "resolved_at": g.resolved_at,
                "closed_at": g.closed_at,
                "e_file_id": linked_ef.id if linked_ef else None,
                "e_file_number": linked_ef.e_file_number if linked_ef else None,
            })

        efile_list = []
        for ef in efiles:
            grv_ref = ef.grievance.grievance_id if ef.grievance else "Unknown"
            efile_list.append({
                "id": ef.id,
                "e_file_number": ef.e_file_number,
                "grievance_id": ef.grievance_id,
                "grievance_ref": grv_ref,
                "status": ef.status.value,
                "page_count": ef.page_count,
                "content_hash": ef.content_hash,
                "is_sealed": ef.is_sealed,
                "sealed_at": ef.sealed_at,
                "created_at": ef.created_at,
            })

        return {
            "id": record.id,
            "record_number": record.record_number,
            "student_vyasa_user_id": record.student_vyasa_user_id,
            "full_name_snapshot": record.full_name_snapshot,
            "email_snapshot": record.email_snapshot,
            "mobile_snapshot": record.mobile_snapshot,
            "registration_number_snapshot": record.registration_number_snapshot,
            "enrollment_number_snapshot": record.enrollment_number_snapshot,
            "subject_id": record.subject_id,
            "subject_name": record.subject.name if record.subject else "Unknown",
            "status": record.status.value,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
            "grievances": grv_list,
            "efiles": efile_list,
        }
