"""
Applicant JIT Provisioning & Domain Profile Resolution Service for NIVARAN.

Architectural Guarantees:
1. "VYASA owns applicant identity. NIVARAN owns grievance data."
2. Canonical identity is strictly vyasa_user_id (verified UUID).
3. Missing domain record on first handoff is EXPECTED — not a verification failure.
4. Idempotent JIT Provisioning:
   - First-time: Creates StudentMasterRecord + emits APPLICANT_JIT_PROVISIONED + APPLICANT_SESSION_ESTABLISHED.
   - Subsequent: Reuses record, synchronizes permitted snapshots + emits APPLICANT_SESSION_ESTABLISHED.
5. Subject Reconciliation:
   - Reconciles subject strictly from verified VYASA profile against NIVARAN canonical subjects table.
   - Resolves subject -> subject_cluster -> Assistant Dean.
   - Fails safely with clear error if subject cannot be reconciled (zero partial records).
6. Transaction safety: Rollbacks on failure; operates strictly within the frozen 40-table schema.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.audit import AuditLog
from app.models.enums import StudentRecordStatus
from app.models.grievance import StudentMasterRecord
from app.models.taxonomy import Subject, SubjectCluster
from app.services.vyasa_identity import VerifiedVyasaIdentity, VyasaApplicantProfile

logger = logging.getLogger("nivaran.services.applicant_provisioning")


class ProvisioningError(Exception):
    """Raised when JIT provisioning or subject reconciliation fails."""

    def __init__(self, message: str, status_code: int = 422):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ApplicantProvisioningService:
    """Service handling JIT provisioning, synchronization, and taxonomy reconciliation for applicants."""

    @staticmethod
    def get_or_provision_student(
        db: Session,
        identity: VerifiedVyasaIdentity,
        profile: Optional[VyasaApplicantProfile] = None,
        ip_address: Optional[str] = None,
    ) -> Tuple[StudentMasterRecord, Subject, bool]:
        """
        Idempotently resolve or provision a StudentMasterRecord for the verified VYASA identity.
        
        Returns:
            Tuple[StudentMasterRecord, Subject, bool]:
            (student_record, reconciled_subject, is_new_registration)

        Raises:
            ProvisioningError: If profile is missing or subject cannot be reconciled.
        """
        now = datetime.now(timezone.utc)

        # 1. Profile retrieval prerequisite
        if not profile:
            logger.error("JIT provisioning attempted for VYASA user %s without authoritative profile", identity.id)
            raise ProvisioningError(
                "Authoritative applicant profile from VYASA Core is required for NIVARAN domain registration.",
                status_code=422,
            )

        # 2. Strict Subject Reconciliation against canonical NIVARAN taxonomy
        matched_subject: Optional[Subject] = None
        if profile.subject_id:
            matched_subject = db.scalar(
                select(Subject)
                .options(
                    joinedload(Subject.subject_cluster).joinedload(SubjectCluster.assistant_dean)
                )
                .where(Subject.id == profile.subject_id)
            )

        if not matched_subject and profile.subject_name:
            clean_name = profile.subject_name.strip()
            matched_subject = db.scalar(
                select(Subject)
                .options(
                    joinedload(Subject.subject_cluster).joinedload(SubjectCluster.assistant_dean)
                )
                .where(Subject.name.ilike(clean_name))
            )

        if not matched_subject:
            subject_ref = profile.subject_name or str(profile.subject_id) or "Unassigned"
            logger.error(
                "Failed to reconcile academic subject '%s' for VYASA user %s against NIVARAN taxonomy",
                subject_ref,
                identity.id,
            )
            raise ProvisioningError(
                f"Academic subject '{subject_ref}' could not be reconciled against NIVARAN master taxonomy. "
                "Contact university administration to confirm doctoral department mapping.",
                status_code=422,
            )

        # 3. Derive snapshot values from authoritative profile
        full_name = profile.full_name.strip() if profile.full_name else f"{identity.first_name} {identity.last_name}".strip()
        email = profile.email.strip() if profile.email else identity.email.strip()
        mobile = profile.phone.strip() if profile.phone else None
        registration_no = (
            profile.phd_registration_number.strip()
            if profile.phd_registration_number
            else None
        )
        department = profile.department.strip() if profile.department else None

        try:
            # 4. Lookup existing domain record by canonical vyasa_user_id
            stmt = select(StudentMasterRecord).where(
                StudentMasterRecord.student_vyasa_user_id == identity.id
            )
            record = db.scalar(stmt)

            if record:
                # ==========================================================
                # EXISTING APPLICANT: Synchronize snapshot fields & establish
                # ==========================================================
                if full_name:
                    record.full_name_snapshot = full_name
                if email:
                    record.email_snapshot = email
                if mobile:
                    record.mobile_snapshot = mobile
                if registration_no:
                    record.registration_number_snapshot = registration_no
                if department:
                    record.department_snapshot = department
                record.updated_at = now

                audit = AuditLog(
                    user_vyasa_id=identity.id,
                    action="APPLICANT_SESSION_ESTABLISHED",
                    entity_type="StudentMasterRecord",
                    entity_id=record.id,
                    description=(
                        f"Applicant session established for {record.full_name_snapshot or record.record_number}. "
                        f"Domain record synchronized with VYASA Core profile."
                    ),
                    ip_address=ip_address,
                    created_at=now,
                )
                db.add(audit)
                db.commit()
                db.refresh(record)
                logger.info("Synchronized existing StudentMasterRecord %s for VYASA user %s", record.id, identity.id)
                return record, matched_subject, False

            # ==============================================================
            # FIRST-TIME APPLICANT: JIT Provision new domain record
            # ==============================================================
            record_number = f"SMR-{identity.id.hex[:10].upper()}"

            record = StudentMasterRecord(
                id=uuid.uuid4(),
                student_vyasa_user_id=identity.id,
                record_number=record_number,
                registration_number_snapshot=registration_no,
                enrollment_number_snapshot=None,
                department_snapshot=department,
                program_name_snapshot="Ph.D.",
                full_name_snapshot=full_name,
                email_snapshot=email,
                mobile_snapshot=mobile,
                status=StudentRecordStatus.ACTIVE,
                created_at=now,
                updated_at=now,
            )
            db.add(record)
            db.flush()

            # Emit JIT provisioning audit log
            audit_jit = AuditLog(
                user_vyasa_id=identity.id,
                action="APPLICANT_JIT_PROVISIONED",
                entity_type="StudentMasterRecord",
                entity_id=record.id,
                description=(
                    f"Applicant JIT provisioned with record number {record.record_number} "
                    f"under subject '{matched_subject.name}' for VYASA user {identity.id} ({email})."
                ),
                ip_address=ip_address,
                created_at=now,
            )
            db.add(audit_jit)

            # Emit initial session established audit log
            audit_session = AuditLog(
                user_vyasa_id=identity.id,
                action="APPLICANT_SESSION_ESTABLISHED",
                entity_type="StudentMasterRecord",
                entity_id=record.id,
                description=(
                    f"Initial applicant workspace session established for {full_name} "
                    f"({record.record_number})."
                ),
                ip_address=ip_address,
                created_at=now,
            )
            db.add(audit_session)

            db.commit()
            db.refresh(record)

            logger.info(
                "JIT provisioned new StudentMasterRecord %s (%s) for VYASA user %s",
                record.id,
                record_number,
                identity.id,
            )
            return record, matched_subject, True

        except Exception as exc:
            db.rollback()
            logger.error("Database error during applicant JIT provisioning: %s", str(exc))
            raise
