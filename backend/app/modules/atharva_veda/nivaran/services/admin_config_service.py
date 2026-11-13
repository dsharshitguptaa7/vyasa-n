"""
Admin Configuration Service for Atharva Veda (NIVARAN) Master Data & Routing

Enables authorized administrators to dynamically configure institutional taxonomy,
authorities, academic and grievance clusters, categories, and routing rules.
Every modification generates an immutable record in Core audit_logs.
"""
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func, or_, update

from app.core.config import settings
from app.core.security import hash_password, generate_temporary_password
from app.models.audit import AuditLog
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.applicant_profile import ApplicantProfile
from app.models.two_factor import AuthenticationChallenge
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject, GrievanceCluster, Category
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole, CategoryRoutingType
from app.modules.atharva_veda.nivaran.models.grievance import Grievance, StudentMasterRecord
from app.services.notifications.email_service import email_sender_service, sanitize_email_error
from app.services.notifications.email_templates import build_authority_temporary_password_reissued_email


class PasswordReissueRateLimitError(ValueError):
    """Raised when temporary password reissuance exceeds rate limits for an authority."""
    pass



# Centralized Mapping: Institutional Authority Roles -> Platform Generic Roles
PLATFORM_GENERIC_AUTHORITY_ROLE = "authority"

INSTITUTIONAL_TO_PLATFORM_ROLES: Dict[NivaranRole, List[str]] = {
    NivaranRole.DEAN: [PLATFORM_GENERIC_AUTHORITY_ROLE],
    NivaranRole.ASSOCIATE_DEAN: [PLATFORM_GENERIC_AUTHORITY_ROLE],
    NivaranRole.ASSISTANT_DEAN: [PLATFORM_GENERIC_AUTHORITY_ROLE],
    NivaranRole.MANAGER: [PLATFORM_GENERIC_AUTHORITY_ROLE, "manager"],
    NivaranRole.GUEST_MEMBER: [PLATFORM_GENERIC_AUTHORITY_ROLE],
}


class AdminConfigService:
    @staticmethod
    def log_config_audit(
        db: Session,
        actor_user_id: Optional[uuid.UUID],
        action: str,
        entity_name: str,
        entity_id: str,
        details: Dict[str, Any],
        ip_address: Optional[str] = None,
    ) -> AuditLog:
        audit_entry = AuditLog(
            user_id=actor_user_id,
            module="atharva_veda",
            action=action,
            entity_name=entity_name,
            entity_id=str(entity_id),
            details=details,
            ip_address=ip_address,
        )
        db.add(audit_entry)
        return audit_entry

    # =========================================================================
    # 1. AUTHORITY MANAGEMENT & LIFECYCLE
    # =========================================================================

    @staticmethod
    def _ensure_user_platform_authority_roles(
        db: Session,
        user: Optional[User],
        institutional_role: NivaranRole,
    ) -> None:
        """
        Guarantees that a canonical User identity associated with an institutional authority
        receives the generic platform role 'authority' (and 'manager' for triage managers if defined).
        Never queries the generic roles table for domain roles like 'DEAN' or 'ASSOCIATE_DEAN'.
        Prevents duplicate entries and preserves existing unrelated user roles.
        """
        if not user or not getattr(user, "id", None):
            return

        required_role_names = INSTITUTIONAL_TO_PLATFORM_ROLES.get(
            institutional_role, [PLATFORM_GENERIC_AUTHORITY_ROLE]
        )

        role_records = []
        if hasattr(db, "scalars"):
            res = db.scalars(select(Role).where(func.lower(Role.name).in_([r.lower() for r in required_role_names])))
            if hasattr(res, "all"):
                role_records = res.all()
        if not role_records:
            auth_role = db.scalar(select(Role).where(func.lower(Role.name) == PLATFORM_GENERIC_AUTHORITY_ROLE))
            if auth_role:
                role_records = [auth_role]

        if getattr(user, "roles", None) is None:
            user.roles = []

        existing_role_ids = {r.id for r in user.roles if getattr(r, "id", None)}

        db_assigned_role_ids = set()
        try:
            if hasattr(db, "execute") and hasattr(user, "id") and user.id:
                db_assigned_role_ids = {
                    r[0] for r in db.execute(
                        select(user_roles.c.role_id).where(user_roles.c.user_id == user.id)
                    ).all()
                }
        except Exception:
            pass

        for role_rec in role_records:
            if not role_rec or not getattr(role_rec, "id", None):
                continue
            if role_rec.id in existing_role_ids:
                continue

            if role_rec.id in db_assigned_role_ids:
                # Role already persisted in DB association table; synchronize ORM collection
                try:
                    from sqlalchemy import inspect as sa_inspect
                    insp = sa_inspect(user, raise_errors=False)
                    if insp is not None and getattr(insp, "persistent", False) and hasattr(db, "refresh"):
                        db.refresh(user, attribute_names=["roles"])
                        existing_role_ids = {r.id for r in user.roles if getattr(r, "id", None)}
                        if role_rec.id in existing_role_ids:
                            continue
                except Exception:
                    pass

            # Safe ORM-level association: SQLAlchemy unit-of-work flushes to user_roles exactly once
            if hasattr(user, "roles") and hasattr(user.roles, "append"):
                user.roles.append(role_rec)
                existing_role_ids.add(role_rec.id)

    @staticmethod
    def create_authority(
        db: Session,
        name: str,
        email: str,
        role: NivaranRole,
        designation: Optional[str] = None,
        department: Optional[str] = None,
        phone: Optional[str] = None,
        is_active: bool = True,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> NivaranAuthority:
        """
        Provisions a new institutional authority.
        Synchronizes or provisions canonical Core User identity with the corresponding role.
        """
        clean_email = email.strip().lower()
        clean_name = name.strip()

        try:
            # Check existing authority by email snapshot
            existing_auth = db.scalar(
                select(NivaranAuthority).where(func.lower(NivaranAuthority.email_snapshot) == clean_email)
            )
            if existing_auth:
                raise ValueError(f"Authority with email '{clean_email}' already exists (ID: {existing_auth.id}).")

            # Resolve or create User account
            user = db.scalar(
                select(User).options(joinedload(User.roles)).where(func.lower(User.email) == clean_email)
            )

            if user:
                # Check if this user is already tied to another authority
                auth_by_user = db.scalar(
                    select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == user.id)
                )
                if auth_by_user:
                    raise ValueError(
                        f"User account '{clean_email}' is already associated with authority '{auth_by_user.name_snapshot}'."
                    )
                vyasa_user_id = user.id
                temp_password = None
            else:
                # Create user account with a secure generated temporary credential
                name_parts = clean_name.split()
                first_name = name_parts[0]
                last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else "-"

                temp_password = generate_temporary_password(16)
                new_user = User(
                    id=uuid.uuid4(),
                    email=clean_email,
                    first_name=first_name,
                    last_name=last_name,
                    phone=phone.strip() if phone else None,
                    password_hash=hash_password(temp_password),
                    is_active=True,
                    is_verified=True,
                    must_change_password=True,
                )
                db.add(new_user)
                db.flush()
                vyasa_user_id = new_user.id
                user = new_user

            # Ensure canonical user has generic platform role 'authority'
            AdminConfigService._ensure_user_platform_authority_roles(db, user, role)

            # Create NivaranAuthority
            authority = NivaranAuthority(
                id=uuid.uuid4(),
                vyasa_user_id=vyasa_user_id,
                role=role,
                name_snapshot=clean_name,
                email_snapshot=clean_email,
                designation=designation.strip() if designation else None,
                department=department.strip() if department else None,
                is_active=is_active,
            )
            db.add(authority)
            db.flush()

            AdminConfigService.log_config_audit(
                db=db,
                actor_user_id=actor_user_id,
                action="authority.create",
                entity_name="NivaranAuthority",
                entity_id=str(authority.id),
                details={
                    "name": authority.name_snapshot,
                    "email": authority.email_snapshot,
                    "role": str(authority.role),
                    "designation": authority.designation,
                    "department": authority.department,
                    "is_active": authority.is_active,
                    "must_change_password": True if temp_password else False,
                },
            )
            db.commit()
            db.refresh(authority)
            # Attach transient temporary password for one-time API exposure by caller
            authority.temporary_password = temp_password
            return authority
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def update_authority(
        db: Session,
        authority_id: uuid.UUID,
        name: Optional[str] = None,
        email: Optional[str] = None,
        role: Optional[NivaranRole] = None,
        designation: Optional[str] = None,
        department: Optional[str] = None,
        phone: Optional[str] = None,
        is_active: Optional[bool] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> NivaranAuthority:
        """
        Updates institutional authority attributes with conflict and jurisdiction validation.
        """
        try:
            authority = db.scalar(
                select(NivaranAuthority).where(NivaranAuthority.id == authority_id)
            )
            if not authority:
                raise ValueError(f"Authority '{authority_id}' not found.")

            changes: Dict[str, Any] = {}

            if email is not None:
                clean_email = email.strip().lower()
                if clean_email != authority.email_snapshot.lower():
                    existing = db.scalar(
                        select(NivaranAuthority).where(
                            func.lower(NivaranAuthority.email_snapshot) == clean_email,
                            NivaranAuthority.id != authority.id,
                        )
                    )
                    if existing:
                        raise ValueError(f"Email '{clean_email}' is already assigned to authority '{existing.name_snapshot}'.")
                    changes["email"] = {"old": authority.email_snapshot, "new": clean_email}
                    authority.email_snapshot = clean_email

            if name is not None and name.strip() != authority.name_snapshot:
                changes["name"] = {"old": authority.name_snapshot, "new": name.strip()}
                authority.name_snapshot = name.strip()

            if designation is not None and designation.strip() != (authority.designation or ""):
                changes["designation"] = {"old": authority.designation, "new": designation.strip() or None}
                authority.designation = designation.strip() or None

            if department is not None and department.strip() != (authority.department or ""):
                changes["department"] = {"old": authority.department, "new": department.strip() or None}
                authority.department = department.strip() or None

            if role is not None and role != authority.role:
                # Check jurisdiction conflict if changing role
                if authority.role == NivaranRole.ASSISTANT_DEAN:
                    active_sc = db.scalar(
                        select(SubjectCluster).where(
                            SubjectCluster.assistant_dean_id == authority.id,
                            SubjectCluster.is_active == True,
                        )
                    )
                    if active_sc:
                        raise ValueError(
                            f"Cannot change role of '{authority.name_snapshot}': actively assigned as Assistant Dean to Subject Cluster '{active_sc.name}'. Reassign cluster first."
                        )
                elif authority.role == NivaranRole.ASSOCIATE_DEAN:
                    active_gc = db.scalar(
                        select(GrievanceCluster).where(
                            GrievanceCluster.associate_dean_id == authority.id,
                            GrievanceCluster.is_active == True,
                        )
                    )
                    if active_gc:
                        raise ValueError(
                            f"Cannot change role of '{authority.name_snapshot}': actively assigned as Associate Dean to Grievance Cluster '{active_gc.name}'. Reassign cluster first."
                        )

                changes["role"] = {"old": str(authority.role), "new": str(role)}
                authority.role = role

            if is_active is not None and is_active != authority.is_active:
                changes["is_active"] = {"old": authority.is_active, "new": is_active}
                authority.is_active = is_active

            if changes:
                # Ensure canonical user preserves generic platform role 'authority'
                user = db.scalar(select(User).options(joinedload(User.roles)).where(User.id == authority.vyasa_user_id))
                if user:
                    AdminConfigService._ensure_user_platform_authority_roles(db, user, authority.role)

                AdminConfigService.log_config_audit(
                    db=db,
                    actor_user_id=actor_user_id,
                    action="authority.update",
                    entity_name="NivaranAuthority",
                    entity_id=str(authority.id),
                    details=changes,
                )
                db.commit()
                db.refresh(authority)
            return authority
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def reissue_temporary_password(
        db: Session,
        authority_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        email_service: Optional[Any] = None,
        rate_limit_max_attempts: int = 3,
        rate_limit_window_minutes: int = 15,
    ) -> Dict[str, Any]:
        """
        Reissues a secure temporary password for an eligible institutional authority.
        - Validates authority existence, active status, and active user account.
        - Enforces rate limiting against repeated password reissuance.
        - Generates a cryptographically secure random temporary password.
        - Hashes using PBKDF2 and updates the user credential.
        - Invalidates previous temporary password and pending pre-auth challenges immediately.
        - Sets must_change_password=True for mandatory password change upon next login.
        - Preserves authority roles, permissions, designation, department, and account status.
        - Dispatches the new temporary password to the authority's registered email via Brevo.
        - Records audit log with action TEMPORARY_PASSWORD_REISSUED without credential leakage.
        - Accurately tracks and reports email delivery status (SENT or FAILED).
        """
        authority = db.scalar(
            select(NivaranAuthority)
            .options(joinedload(NivaranAuthority.user))
            .where(NivaranAuthority.id == authority_id)
        )
        if not authority:
            raise ValueError(f"Authority with ID '{authority_id}' does not exist.")

        if not authority.is_active:
            raise ValueError(
                f"Cannot reissue temporary password for inactive authority '{authority.name_snapshot}'. "
                "Please activate the authority first."
            )

        user = getattr(authority, "user", None)
        if not user:
            user = db.scalar(select(User).where(User.id == authority.vyasa_user_id))
        if not user:
            raise ValueError(
                f"Associated user identity for authority '{authority.name_snapshot}' does not exist."
            )
        if not user.is_active:
            raise ValueError(
                f"Associated user account '{user.email}' is deactivated. Reissuance not permitted."
            )

        recipient_email = (authority.email_snapshot or user.email or "").strip().lower()
        if not recipient_email or "@" not in recipient_email:
            raise ValueError(
                f"Authority '{authority.name_snapshot}' does not have a valid registered email address."
            )

        # Rate limiting check against recent reissuance audit logs
        now_utc = datetime.now(timezone.utc)
        window_cutoff = now_utc - timedelta(minutes=rate_limit_window_minutes)

        recent_logs = []
        try:
            recent_logs = db.scalars(
                select(AuditLog)
                .where(
                    AuditLog.entity_name == "NivaranAuthority",
                    AuditLog.entity_id == str(authority.id),
                    AuditLog.action == "TEMPORARY_PASSWORD_REISSUED",
                    AuditLog.created_at >= window_cutoff,
                )
            ).all()
        except Exception:
            try:
                res = db.execute(
                    select(AuditLog).where(
                        AuditLog.entity_name == "NivaranAuthority",
                        AuditLog.entity_id == str(authority.id),
                        AuditLog.action == "TEMPORARY_PASSWORD_REISSUED",
                        AuditLog.created_at >= window_cutoff,
                    )
                )
                recent_logs = res.scalars().all() if hasattr(res, "scalars") else []
            except Exception:
                recent_logs = []

        if len(recent_logs) >= rate_limit_max_attempts:
            raise PasswordReissueRateLimitError(
                f"Password reissuance rate limit exceeded ({rate_limit_max_attempts} requests per "
                f"{rate_limit_window_minutes} minutes). Please wait before retrying."
            )

        # Generate new cryptographically secure temporary password (16 chars, meets complexity)
        new_temp_password = generate_temporary_password(16)

        # Hash and securely update the user credential
        user.password_hash = hash_password(new_temp_password)
        user.must_change_password = True

        # Invalidate any in-flight pre-authentication challenges / sessions
        try:
            db.execute(
                update(AuthenticationChallenge)
                .where(
                    AuthenticationChallenge.user_id == user.id,
                    AuthenticationChallenge.consumed_at.is_(None),
                )
                .values(consumed_at=func.now())
            )
        except Exception:
            pass

        # Persist credential update immediately to guarantee previous password cannot authenticate
        db.add(user)
        db.commit()
        if hasattr(db, "refresh"):
            try:
                db.refresh(user)
            except Exception:
                pass

        # Email dispatch via Brevo integration
        subject, html_body, text_body = build_authority_temporary_password_reissued_email(
            recipient_name=authority.name_snapshot,
            recipient_email=recipient_email,
            temporary_password=new_temp_password,
        )

        active_email_service = email_service or email_sender_service
        try:
            dispatch_res = active_email_service.send_email(
                recipient_email=recipient_email,
                subject=subject,
                html_content=html_body,
                text_content=text_body,
            )
            email_delivered = bool(dispatch_res.success)
            email_error = (
                sanitize_email_error(getattr(dispatch_res, "error_message", None))
                if not email_delivered
                else None
            )
        except Exception as exc:
            email_delivered = False
            email_error = sanitize_email_error(str(exc))

        delivery_status = "SENT" if email_delivered else "FAILED"

        # Record immutable audit log
        audit_entry = AuditLog(
            user_id=actor_user_id,
            module="atharva_veda",
            action="TEMPORARY_PASSWORD_REISSUED",
            entity_name="NivaranAuthority",
            entity_id=str(authority.id),
            details={
                "authority_id": str(authority.id),
                "authority_name": authority.name_snapshot,
                "authority_email": recipient_email,
                "email_delivery_status": delivery_status,
                "failure_reason": email_error,
                "actor_user_id": str(actor_user_id) if actor_user_id else None,
                "provider": getattr(settings, "EMAIL_PROVIDER", "brevo"),
            },
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(audit_entry)
        db.commit()

        return {
            "authority_id": authority.id,
            "name": authority.name_snapshot,
            "email": recipient_email,
            "delivery_status": delivery_status,
            "delivery_error": email_error,
            "message": (
                f"Temporary password reissued successfully and sent to {recipient_email}."
                if email_delivered
                else f"Temporary password was generated and updated, but email delivery via Brevo failed ({email_error}). Please retry delivery."
            ),
        }

    @staticmethod
    def transfer_authority_assignments(
        db: Session,
        source_authority_id: uuid.UUID,
        target_authority_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Safely transfers all cluster and category assignments from a source authority to an active replacement authority.
        """
        source = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == source_authority_id))
        if not source:
            raise ValueError(f"Source authority '{source_authority_id}' not found.")

        target = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == target_authority_id))
        if not target:
            raise ValueError(f"Target replacement authority '{target_authority_id}' not found.")

        if not target.is_active:
            raise ValueError(f"Target authority '{target.name_snapshot}' is inactive and cannot accept assignments.")

        transferred_subject_clusters = []
        transferred_grievance_clusters = []
        transferred_categories = []

        # 1. Subject Clusters (requires ASSISTANT_DEAN role)
        sc_list = db.execute(
            select(SubjectCluster).where(SubjectCluster.assistant_dean_id == source.id)
        ).scalars().all()
        if sc_list:
            if target.role != NivaranRole.ASSISTANT_DEAN:
                raise ValueError(
                    f"Target authority '{target.name_snapshot}' has role '{target.role}', but '{NivaranRole.ASSISTANT_DEAN}' is required to receive subject cluster assignments."
                )
            for sc in sc_list:
                sc.assistant_dean_id = target.id
                transferred_subject_clusters.append(sc.name)

        # 2. Grievance Clusters (requires ASSOCIATE_DEAN or DEAN role)
        gc_list = db.execute(
            select(GrievanceCluster).where(GrievanceCluster.associate_dean_id == source.id)
        ).scalars().all()
        if gc_list:
            if target.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
                raise ValueError(
                    f"Target authority '{target.name_snapshot}' has role '{target.role}', but Associate Dean role is required for grievance clusters."
                )
            for gc in gc_list:
                gc.associate_dean_id = target.id
                transferred_grievance_clusters.append(gc.name)

        # 3. Fixed Authority Categories
        cat_list = db.execute(
            select(Category).where(Category.fixed_authority_id == source.id)
        ).scalars().all()
        for cat in cat_list:
            cat.fixed_authority_id = target.id
            transferred_categories.append(cat.name)

        transfer_summary = {
            "source_authority": source.name_snapshot,
            "target_authority": target.name_snapshot,
            "subject_clusters_transferred": transferred_subject_clusters,
            "grievance_clusters_transferred": transferred_grievance_clusters,
            "categories_transferred": transferred_categories,
        }

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="authority.transfer_assignments",
            entity_name="NivaranAuthority",
            entity_id=str(source.id),
            details=transfer_summary,
        )
        db.commit()
        return transfer_summary

    @staticmethod
    def delete_authority(
        db: Session,
        authority_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Permanently deletes an unreferenced authority record.
        Strictly prevents deletion if referenced by clusters, categories, or historical grievances.
        """
        authority = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == authority_id))
        if not authority:
            raise ValueError(f"Authority '{authority_id}' not found.")

        # Reference Checks
        conflicts = []

        sc_count = db.scalar(
            select(func.count(SubjectCluster.id)).where(SubjectCluster.assistant_dean_id == authority.id)
        ) or 0
        if sc_count > 0:
            conflicts.append(f"{sc_count} Subject Cluster assignment(s)")

        gc_count = db.scalar(
            select(func.count(GrievanceCluster.id)).where(GrievanceCluster.associate_dean_id == authority.id)
        ) or 0
        if gc_count > 0:
            conflicts.append(f"{gc_count} Grievance Cluster assignment(s)")

        cat_count = db.scalar(
            select(func.count(Category.id)).where(Category.fixed_authority_id == authority.id)
        ) or 0
        if cat_count > 0:
            conflicts.append(f"{cat_count} Category routing rule(s)")

        grv_count = db.scalar(
            select(func.count(Grievance.id)).where(
                or_(
                    Grievance.assigned_authority_id == authority.id,
                    Grievance.resolved_by_authority_id == authority.id,
                    Grievance.closed_by_authority_id == authority.id,
                )
            )
        ) or 0
        if grv_count > 0:
            conflicts.append(f"{grv_count} historical Grievance record(s)")

        if conflicts:
            raise ValueError(
                f"Cannot delete authority '{authority.name_snapshot}': referenced by {', '.join(conflicts)}. Deactivate or transfer assignments instead."
            )

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="authority.delete",
            entity_name="NivaranAuthority",
            entity_id=str(authority.id),
            details={
                "deleted_authority_name": authority.name_snapshot,
                "role": str(authority.role),
                "email": authority.email_snapshot,
            },
        )
        db.delete(authority)
        db.commit()
        return True

    @staticmethod
    def set_authority_active_status(
        db: Session,
        authority_id: uuid.UUID,
        is_active: bool,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> NivaranAuthority:
        """
        Enables or disables an institutional authority.
        """
        authority = db.execute(
            select(NivaranAuthority).where(NivaranAuthority.id == authority_id)
        ).scalar_one_or_none()

        if not authority:
            raise ValueError(f"Authority '{authority_id}' not found.")

        old_status = authority.is_active
        authority.is_active = is_active

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="authority.update_active_status",
            entity_name="NivaranAuthority",
            entity_id=str(authority.id),
            details={
                "authority_name": authority.name_snapshot,
                "role": str(authority.role),
                "old_status": old_status,
                "new_status": is_active,
            },
        )
        db.commit()
        db.refresh(authority)
        return authority

    # =========================================================================
    # 2. ACADEMIC SUBJECT CLUSTERS
    # =========================================================================

    @staticmethod
    def update_subject_cluster_assistant_dean(
        db: Session,
        cluster_id: uuid.UUID,
        new_assistant_dean_id: Optional[uuid.UUID],
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> SubjectCluster:
        cluster = db.execute(
            select(SubjectCluster).where(SubjectCluster.id == cluster_id)
        ).scalar_one_or_none()

        if not cluster:
            raise ValueError(f"SubjectCluster '{cluster_id}' not found.")

        old_dean_id = cluster.assistant_dean_id

        if new_assistant_dean_id:
            authority = db.execute(
                select(NivaranAuthority).where(NivaranAuthority.id == new_assistant_dean_id)
            ).scalar_one_or_none()
            if not authority:
                raise ValueError(f"Authority '{new_assistant_dean_id}' not found.")
            if not authority.is_active:
                raise ValueError(f"Authority '{authority.name_snapshot}' is inactive and cannot be assigned to active routing.")
            if authority.role != NivaranRole.ASSISTANT_DEAN:
                raise ValueError(f"Authority '{authority.name_snapshot}' has role '{authority.role}', but '{NivaranRole.ASSISTANT_DEAN}' is required.")

        cluster.assistant_dean_id = new_assistant_dean_id

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_assistant_dean_mapping",
            entity_name="SubjectCluster",
            entity_id=str(cluster.id),
            details={
                "cluster_name": cluster.name,
                "old_assistant_dean_id": str(old_dean_id) if old_dean_id else None,
                "new_assistant_dean_id": str(new_assistant_dean_id) if new_assistant_dean_id else None,
            },
        )
        db.commit()
        db.refresh(cluster)
        return cluster

    @staticmethod
    def set_subject_cluster_active_status(
        db: Session,
        cluster_id: uuid.UUID,
        is_active: bool,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> SubjectCluster:
        cluster = db.execute(
            select(SubjectCluster).where(SubjectCluster.id == cluster_id)
        ).scalar_one_or_none()
        if not cluster:
            raise ValueError(f"SubjectCluster '{cluster_id}' not found.")
        old_status = cluster.is_active
        cluster.is_active = is_active
        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_subject_cluster_active_status",
            entity_name="SubjectCluster",
            entity_id=str(cluster.id),
            details={"cluster_name": cluster.name, "old_status": old_status, "new_status": is_active},
        )
        db.commit()
        db.refresh(cluster)
        return cluster

    @staticmethod
    def create_subject_cluster(
        db: Session,
        cluster_number: int,
        name: str,
        description: Optional[str] = None,
        assistant_dean_id: Optional[uuid.UUID] = None,
        is_active: bool = True,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> SubjectCluster:
        existing = db.scalar(
            select(SubjectCluster).where(SubjectCluster.cluster_number == cluster_number)
        )
        if existing:
            raise ValueError(f"Subject cluster with number {cluster_number} already exists.")

        if assistant_dean_id:
            auth = db.scalar(
                select(NivaranAuthority).where(NivaranAuthority.id == assistant_dean_id)
            )
            if not auth:
                raise ValueError(f"Authority '{assistant_dean_id}' not found.")
            if not auth.is_active:
                raise ValueError(f"Authority '{auth.name_snapshot}' is inactive.")
            if auth.role != NivaranRole.ASSISTANT_DEAN:
                raise ValueError(f"Authority '{auth.name_snapshot}' must have role ASSISTANT_DEAN.")

        cluster = SubjectCluster(
            cluster_number=cluster_number,
            name=name.strip(),
            description=description.strip() if description else None,
            assistant_dean_id=assistant_dean_id,
            is_active=is_active,
        )
        db.add(cluster)
        db.flush()

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.create_subject_cluster",
            entity_name="SubjectCluster",
            entity_id=str(cluster.id),
            details={
                "cluster_number": cluster_number,
                "name": cluster.name,
                "assistant_dean_id": str(assistant_dean_id) if assistant_dean_id else None,
            },
        )
        db.commit()
        db.refresh(cluster)
        return cluster

    @staticmethod
    def update_subject_cluster(
        db: Session,
        cluster_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        cluster_number: Optional[int] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> SubjectCluster:
        cluster = db.scalar(
            select(SubjectCluster).where(SubjectCluster.id == cluster_id)
        )
        if not cluster:
            raise ValueError(f"SubjectCluster '{cluster_id}' not found.")

        changes: Dict[str, Any] = {}
        if cluster_number is not None and cluster_number != cluster.cluster_number:
            existing_num = db.scalar(
                select(SubjectCluster).where(SubjectCluster.cluster_number == cluster_number)
            )
            if existing_num and existing_num.id != cluster.id:
                raise ValueError(f"Subject cluster with number {cluster_number} already exists.")
            changes["cluster_number"] = {"old": cluster.cluster_number, "new": cluster_number}
            cluster.cluster_number = cluster_number

        if name is not None and name.strip() != cluster.name:
            changes["name"] = {"old": cluster.name, "new": name.strip()}
            cluster.name = name.strip()

        if description is not None:
            changes["description"] = {"old": cluster.description, "new": description.strip() if description else None}
            cluster.description = description.strip() if description else None

        if changes:
            AdminConfigService.log_config_audit(
                db=db,
                actor_user_id=actor_user_id,
                action="taxonomy.update_subject_cluster",
                entity_name="SubjectCluster",
                entity_id=str(cluster.id),
                details=changes,
            )
            db.commit()
            db.refresh(cluster)
        return cluster

    @staticmethod
    def delete_subject_cluster(
        db: Session,
        cluster_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Deletes an academic subject cluster if it contains no linked subjects.
        """
        cluster = db.scalar(select(SubjectCluster).where(SubjectCluster.id == cluster_id))
        if not cluster:
            raise ValueError(f"SubjectCluster '{cluster_id}' not found.")

        subject_count = db.scalar(
            select(func.count(Subject.id)).where(Subject.subject_cluster_id == cluster.id)
        ) or 0
        if subject_count > 0:
            raise ValueError(
                f"Cannot delete Subject Cluster '{cluster.name}': contains {subject_count} active subjects. Re-map or delete subjects first."
            )

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.delete_subject_cluster",
            entity_name="SubjectCluster",
            entity_id=str(cluster.id),
            details={"name": cluster.name, "cluster_number": cluster.cluster_number},
        )
        db.delete(cluster)
        db.commit()
        return True

    # =========================================================================
    # 3. ACADEMIC SUBJECTS
    # =========================================================================

    @staticmethod
    def set_subject_active_status(
        db: Session,
        subject_id: uuid.UUID,
        is_active: bool,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Subject:
        subject = db.execute(
            select(Subject).where(Subject.id == subject_id)
        ).scalar_one_or_none()
        if not subject:
            raise ValueError(f"Subject '{subject_id}' not found.")
        old_status = subject.is_active
        subject.is_active = is_active
        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_subject_active_status",
            entity_name="Subject",
            entity_id=str(subject.id),
            details={"subject_name": subject.name, "old_status": old_status, "new_status": is_active},
        )
        db.commit()
        db.refresh(subject)
        return subject

    @staticmethod
    def update_subject_mapping(
        db: Session,
        subject_id: uuid.UUID,
        new_cluster_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Subject:
        subject = db.execute(
            select(Subject).where(Subject.id == subject_id)
        ).scalar_one_or_none()
        if not subject:
            raise ValueError(f"Subject '{subject_id}' not found.")
        cluster = db.execute(
            select(SubjectCluster).where(SubjectCluster.id == new_cluster_id)
        ).scalar_one_or_none()
        if not cluster:
            raise ValueError(f"SubjectCluster '{new_cluster_id}' not found.")
        if not cluster.is_active:
            raise ValueError(f"SubjectCluster '{cluster.name}' is inactive.")
        old_cluster_id = subject.subject_cluster_id
        subject.subject_cluster_id = new_cluster_id
        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_subject_mapping",
            entity_name="Subject",
            entity_id=str(subject.id),
            details={
                "subject_name": subject.name,
                "old_cluster_id": str(old_cluster_id) if old_cluster_id else None,
                "new_cluster_id": str(new_cluster_id),
            },
        )
        db.commit()
        db.refresh(subject)
        return subject

    @staticmethod
    def create_subject(
        db: Session,
        name: str,
        subject_cluster_id: uuid.UUID,
        code: Optional[str] = None,
        is_active: bool = True,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Subject:
        clean_name = name.strip()
        existing = db.scalar(
            select(Subject).where(func.lower(Subject.name) == clean_name.lower())
        )
        if existing:
            raise ValueError(f"Subject with name '{clean_name}' already exists.")

        cluster = db.scalar(
            select(SubjectCluster).where(SubjectCluster.id == subject_cluster_id)
        )
        if not cluster:
            raise ValueError(f"SubjectCluster '{subject_cluster_id}' not found.")
        if not cluster.is_active:
            raise ValueError(f"SubjectCluster '{cluster.name}' is inactive.")

        subject = Subject(
            name=clean_name,
            code=code.strip() if code else None,
            subject_cluster_id=subject_cluster_id,
            is_active=is_active,
        )
        db.add(subject)
        db.flush()

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.create_subject",
            entity_name="Subject",
            entity_id=str(subject.id),
            details={
                "name": subject.name,
                "code": subject.code,
                "subject_cluster_id": str(subject_cluster_id),
            },
        )
        db.commit()
        db.refresh(subject)
        return subject

    @staticmethod
    def update_subject(
        db: Session,
        subject_id: uuid.UUID,
        name: Optional[str] = None,
        code: Optional[str] = None,
        subject_cluster_id: Optional[uuid.UUID] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Subject:
        subject = db.scalar(
            select(Subject).where(Subject.id == subject_id)
        )
        if not subject:
            raise ValueError(f"Subject '{subject_id}' not found.")

        changes: Dict[str, Any] = {}
        if name is not None and name.strip().lower() != subject.name.lower():
            clean_name = name.strip()
            existing = db.scalar(
                select(Subject).where(func.lower(Subject.name) == clean_name.lower())
            )
            if existing and existing.id != subject.id:
                raise ValueError(f"Subject with name '{clean_name}' already exists.")
            changes["name"] = {"old": subject.name, "new": clean_name}
            subject.name = clean_name

        if code is not None:
            clean_code = code.strip() if code.strip() else None
            if clean_code != subject.code:
                changes["code"] = {"old": subject.code, "new": clean_code}
                subject.code = clean_code

        if subject_cluster_id is not None and subject_cluster_id != subject.subject_cluster_id:
            cluster = db.scalar(
                select(SubjectCluster).where(SubjectCluster.id == subject_cluster_id)
            )
            if not cluster:
                raise ValueError(f"SubjectCluster '{subject_cluster_id}' not found.")
            if not cluster.is_active:
                raise ValueError(f"SubjectCluster '{cluster.name}' is inactive.")
            changes["subject_cluster_id"] = {
                "old": str(subject.subject_cluster_id),
                "new": str(subject_cluster_id),
            }
            subject.subject_cluster_id = subject_cluster_id

        if changes:
            AdminConfigService.log_config_audit(
                db=db,
                actor_user_id=actor_user_id,
                action="taxonomy.update_subject",
                entity_name="Subject",
                entity_id=str(subject.id),
                details=changes,
            )
            db.commit()
            db.refresh(subject)
        return subject

    @staticmethod
    def delete_subject(
        db: Session,
        subject_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Safely deletes an unreferenced academic subject.
        Refuses deletion if referenced by existing applicants or historical grievances.
        """
        subject = db.scalar(select(Subject).where(Subject.id == subject_id))
        if not subject:
            raise ValueError(f"Subject '{subject_id}' not found.")

        conflicts = []
        app_count = db.scalar(
            select(func.count(ApplicantProfile.id)).where(ApplicantProfile.subject_id == subject.id)
        ) or 0
        if app_count > 0:
            conflicts.append(f"{app_count} scholar applicant profile(s)")

        grv_count = db.scalar(
            select(func.count(Grievance.id)).where(Grievance.subject_id == subject.id)
        ) or 0
        if grv_count > 0:
            conflicts.append(f"{grv_count} historical grievance case(s)")

        smr_count = db.scalar(
            select(func.count(StudentMasterRecord.id)).where(StudentMasterRecord.subject_id == subject.id)
        ) or 0
        if smr_count > 0:
            conflicts.append(f"{smr_count} student master record(s)")

        if conflicts:
            raise ValueError(
                f"Cannot delete subject '{subject.name}': referenced by {', '.join(conflicts)}. Deactivate instead to preserve historical records."
            )

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.delete_subject",
            entity_name="Subject",
            entity_id=str(subject.id),
            details={"name": subject.name, "code": subject.code},
        )
        db.delete(subject)
        db.commit()
        return True

    # =========================================================================
    # 4. GRIEVANCE FUNCTIONAL CLUSTERS
    # =========================================================================

    @staticmethod
    def update_grievance_cluster_associate_dean(
        db: Session,
        cluster_id: uuid.UUID,
        new_associate_dean_id: Optional[uuid.UUID],
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> GrievanceCluster:
        cluster = db.execute(
            select(GrievanceCluster).where(GrievanceCluster.id == cluster_id)
        ).scalar_one_or_none()

        if not cluster:
            raise ValueError(f"GrievanceCluster '{cluster_id}' not found.")

        old_dean_id = cluster.associate_dean_id

        if new_associate_dean_id:
            authority = db.execute(
                select(NivaranAuthority).where(NivaranAuthority.id == new_associate_dean_id)
            ).scalar_one_or_none()
            if not authority:
                raise ValueError(f"Authority '{new_associate_dean_id}' not found.")
            if not authority.is_active:
                raise ValueError(f"Authority '{authority.name_snapshot}' is inactive and cannot be assigned to active routing.")
            if authority.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
                raise ValueError(f"Authority '{authority.name_snapshot}' must have role ASSOCIATE_DEAN or DEAN.")

        cluster.associate_dean_id = new_associate_dean_id

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_associate_dean_mapping",
            entity_name="GrievanceCluster",
            entity_id=str(cluster.id),
            details={
                "cluster_name": cluster.name,
                "old_associate_dean_id": str(old_dean_id) if old_dean_id else None,
                "new_associate_dean_id": str(new_associate_dean_id) if new_associate_dean_id else None,
            },
        )
        db.commit()
        db.refresh(cluster)
        return cluster

    @staticmethod
    def set_grievance_cluster_active_status(
        db: Session,
        cluster_id: uuid.UUID,
        is_active: bool,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> GrievanceCluster:
        cluster = db.execute(
            select(GrievanceCluster).where(GrievanceCluster.id == cluster_id)
        ).scalar_one_or_none()
        if not cluster:
            raise ValueError(f"GrievanceCluster '{cluster_id}' not found.")
        old_status = cluster.is_active
        cluster.is_active = is_active
        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_grievance_cluster_active_status",
            entity_name="GrievanceCluster",
            entity_id=str(cluster.id),
            details={"cluster_name": cluster.name, "old_status": old_status, "new_status": is_active},
        )
        db.commit()
        db.refresh(cluster)
        return cluster

    @staticmethod
    def create_grievance_cluster(
        db: Session,
        cluster_number: int,
        name: str,
        description: Optional[str] = None,
        associate_dean_id: Optional[uuid.UUID] = None,
        is_active: bool = True,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> GrievanceCluster:
        existing = db.scalar(
            select(GrievanceCluster).where(GrievanceCluster.cluster_number == cluster_number)
        )
        if existing:
            raise ValueError(f"Grievance cluster with number {cluster_number} already exists.")

        if associate_dean_id:
            auth = db.scalar(
                select(NivaranAuthority).where(NivaranAuthority.id == associate_dean_id)
            )
            if not auth:
                raise ValueError(f"Authority '{associate_dean_id}' not found.")
            if not auth.is_active:
                raise ValueError(f"Authority '{auth.name_snapshot}' is inactive.")
            if auth.role not in (NivaranRole.ASSOCIATE_DEAN, NivaranRole.DEAN):
                raise ValueError(f"Authority '{auth.name_snapshot}' must have role ASSOCIATE_DEAN or DEAN.")

        cluster = GrievanceCluster(
            cluster_number=cluster_number,
            name=name.strip(),
            description=description.strip() if description else None,
            associate_dean_id=associate_dean_id,
            is_active=is_active,
        )
        db.add(cluster)
        db.flush()

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.create_grievance_cluster",
            entity_name="GrievanceCluster",
            entity_id=str(cluster.id),
            details={
                "cluster_number": cluster_number,
                "name": cluster.name,
                "associate_dean_id": str(associate_dean_id) if associate_dean_id else None,
            },
        )
        db.commit()
        db.refresh(cluster)
        return cluster

    @staticmethod
    def update_grievance_cluster(
        db: Session,
        cluster_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        cluster_number: Optional[int] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> GrievanceCluster:
        cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.id == cluster_id))
        if not cluster:
            raise ValueError(f"GrievanceCluster '{cluster_id}' not found.")

        changes: Dict[str, Any] = {}
        if cluster_number is not None and cluster_number != cluster.cluster_number:
            existing_num = db.scalar(
                select(GrievanceCluster).where(GrievanceCluster.cluster_number == cluster_number)
            )
            if existing_num and existing_num.id != cluster.id:
                raise ValueError(f"Grievance cluster with number {cluster_number} already exists.")
            changes["cluster_number"] = {"old": cluster.cluster_number, "new": cluster_number}
            cluster.cluster_number = cluster_number

        if name is not None and name.strip() != cluster.name:
            changes["name"] = {"old": cluster.name, "new": name.strip()}
            cluster.name = name.strip()

        if description is not None:
            changes["description"] = {"old": cluster.description, "new": description.strip() if description else None}
            cluster.description = description.strip() if description else None

        if changes:
            AdminConfigService.log_config_audit(
                db=db,
                actor_user_id=actor_user_id,
                action="taxonomy.update_grievance_cluster",
                entity_name="GrievanceCluster",
                entity_id=str(cluster.id),
                details=changes,
            )
            db.commit()
            db.refresh(cluster)
        return cluster

    @staticmethod
    def delete_grievance_cluster(
        db: Session,
        cluster_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Deletes a grievance cluster if it contains no linked categories.
        """
        cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.id == cluster_id))
        if not cluster:
            raise ValueError(f"GrievanceCluster '{cluster_id}' not found.")

        cat_count = db.scalar(
            select(func.count(Category.id)).where(Category.grievance_cluster_id == cluster.id)
        ) or 0
        if cat_count > 0:
            raise ValueError(
                f"Cannot delete Grievance Cluster '{cluster.name}': contains {cat_count} categories. Re-map or delete categories first."
            )

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.delete_grievance_cluster",
            entity_name="GrievanceCluster",
            entity_id=str(cluster.id),
            details={"name": cluster.name, "cluster_number": cluster.cluster_number},
        )
        db.delete(cluster)
        db.commit()
        return True

    # =========================================================================
    # 5. GRIEVANCE CATEGORIES & ROUTING
    # =========================================================================

    @staticmethod
    def create_category(
        db: Session,
        name: str,
        routing_type: CategoryRoutingType,
        description: Optional[str] = None,
        grievance_cluster_id: Optional[uuid.UUID] = None,
        fixed_authority_id: Optional[uuid.UUID] = None,
        is_active: bool = True,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Category:
        clean_name = name.strip()
        existing = db.scalar(
            select(Category).where(func.lower(Category.name) == clean_name.lower())
        )
        if existing:
            raise ValueError(f"Category '{clean_name}' already exists.")

        # Validate routing parameters
        if routing_type in (CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER):
            if not grievance_cluster_id:
                raise ValueError("grievance_cluster_id is required when routing_type is CLUSTER.")
            cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.id == grievance_cluster_id))
            if not cluster:
                raise ValueError(f"GrievanceCluster '{grievance_cluster_id}' not found.")
            fixed_authority_id = None
        elif routing_type == CategoryRoutingType.FIXED_AUTHORITY:
            if not fixed_authority_id:
                raise ValueError("fixed_authority_id is required when routing_type is FIXED_AUTHORITY.")
            auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == fixed_authority_id))
            if not auth:
                raise ValueError(f"Authority '{fixed_authority_id}' not found.")
            grievance_cluster_id = None
        elif routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
            grievance_cluster_id = None
            fixed_authority_id = None

        category = Category(
            name=clean_name,
            description=description.strip() if description else None,
            routing_type=routing_type,
            grievance_cluster_id=grievance_cluster_id,
            fixed_authority_id=fixed_authority_id,
            is_active=is_active,
        )
        db.add(category)
        db.flush()

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.create_category",
            entity_name="Category",
            entity_id=str(category.id),
            details={
                "name": category.name,
                "routing_type": str(category.routing_type),
                "grievance_cluster_id": str(grievance_cluster_id) if grievance_cluster_id else None,
                "fixed_authority_id": str(fixed_authority_id) if fixed_authority_id else None,
            },
        )
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def update_category(
        db: Session,
        category_id: uuid.UUID,
        name: Optional[str] = None,
        description: Optional[str] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Category:
        category = db.scalar(select(Category).where(Category.id == category_id))
        if not category:
            raise ValueError(f"Category '{category_id}' not found.")

        changes: Dict[str, Any] = {}
        if name is not None and name.strip().lower() != category.name.lower():
            clean_name = name.strip()
            existing = db.scalar(
                select(Category).where(func.lower(Category.name) == clean_name.lower())
            )
            if existing and existing.id != category.id:
                raise ValueError(f"Category with name '{clean_name}' already exists.")
            changes["name"] = {"old": category.name, "new": clean_name}
            category.name = clean_name

        if description is not None:
            changes["description"] = {"old": category.description, "new": description.strip() if description else None}
            category.description = description.strip() if description else None

        if changes:
            AdminConfigService.log_config_audit(
                db=db,
                actor_user_id=actor_user_id,
                action="taxonomy.update_category",
                entity_name="Category",
                entity_id=str(category.id),
                details=changes,
            )
            db.commit()
            db.refresh(category)
        return category

    @staticmethod
    def delete_category(
        db: Session,
        category_id: uuid.UUID,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Safely deletes a category if unreferenced by existing grievances.
        """
        category = db.scalar(select(Category).where(Category.id == category_id))
        if not category:
            raise ValueError(f"Category '{category_id}' not found.")

        grv_count = db.scalar(
            select(func.count(Grievance.id)).where(Grievance.category_id == category.id)
        ) or 0
        if grv_count > 0:
            raise ValueError(
                f"Cannot delete Category '{category.name}': referenced by {grv_count} historical grievance(s). Deactivate instead."
            )

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.delete_category",
            entity_name="Category",
            entity_id=str(category.id),
            details={"name": category.name, "routing_type": str(category.routing_type)},
        )
        db.delete(category)
        db.commit()
        return True

    @staticmethod
    def update_category_routing(
        db: Session,
        category_id: uuid.UUID,
        routing_type: CategoryRoutingType,
        grievance_cluster_id: Optional[uuid.UUID] = None,
        fixed_authority_id: Optional[uuid.UUID] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Category:
        """
        Reconfigures category routing mode (CLUSTER vs FIXED_AUTHORITY vs SUBJECT_ASSISTANT_DEAN).
        """
        category = db.execute(
            select(Category).where(Category.id == category_id)
        ).scalar_one_or_none()

        if not category:
            raise ValueError(f"Category '{category_id}' not found.")

        old_routing_type = category.routing_type
        old_cluster_id = category.grievance_cluster_id
        old_fixed_auth_id = category.fixed_authority_id

        if routing_type in (CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER):
            if not grievance_cluster_id:
                raise ValueError("grievance_cluster_id is required when routing_type is CLUSTER.")
            cluster = db.execute(
                select(GrievanceCluster).where(GrievanceCluster.id == grievance_cluster_id)
            ).scalar_one_or_none()
            if not cluster:
                raise ValueError(f"GrievanceCluster '{grievance_cluster_id}' not found.")
            if not cluster.is_active:
                raise ValueError(f"GrievanceCluster '{cluster.name}' is inactive and cannot be selected.")
            category.grievance_cluster_id = grievance_cluster_id
            category.fixed_authority_id = None
        elif routing_type == CategoryRoutingType.FIXED_AUTHORITY:
            if not fixed_authority_id:
                raise ValueError("fixed_authority_id is required when routing_type is FIXED_AUTHORITY.")
            auth = db.execute(
                select(NivaranAuthority).where(NivaranAuthority.id == fixed_authority_id)
            ).scalar_one_or_none()
            if not auth:
                raise ValueError(f"Authority '{fixed_authority_id}' not found.")
            if not auth.is_active:
                raise ValueError(f"Authority '{auth.name_snapshot}' is inactive and cannot be selected.")
            category.fixed_authority_id = fixed_authority_id
            category.grievance_cluster_id = None
        elif routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
            category.fixed_authority_id = None
            category.grievance_cluster_id = None
        else:
            raise ValueError(f"Unsupported routing type: {routing_type}")

        category.routing_type = routing_type

        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_category_routing",
            entity_name="Category",
            entity_id=str(category.id),
            details={
                "category_name": category.name,
                "old_routing_type": str(old_routing_type),
                "new_routing_type": str(routing_type),
                "old_cluster_id": str(old_cluster_id) if old_cluster_id else None,
                "new_cluster_id": str(grievance_cluster_id) if grievance_cluster_id else None,
                "old_fixed_authority_id": str(old_fixed_auth_id) if old_fixed_auth_id else None,
                "new_fixed_authority_id": str(fixed_authority_id) if fixed_authority_id else None,
            },
        )
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def set_category_active_status(
        db: Session,
        category_id: uuid.UUID,
        is_active: bool,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Category:
        category = db.execute(
            select(Category).where(Category.id == category_id)
        ).scalar_one_or_none()
        if not category:
            raise ValueError(f"Category '{category_id}' not found.")
        old_status = category.is_active
        category.is_active = is_active
        AdminConfigService.log_config_audit(
            db=db,
            actor_user_id=actor_user_id,
            action="taxonomy.update_category_active_status",
            entity_name="Category",
            entity_id=str(category.id),
            details={"category_name": category.name, "old_status": old_status, "new_status": is_active},
        )
        db.commit()
        db.refresh(category)
        return category

    # =========================================================================
    # 6. ROUTING SIMULATION & VALIDATION
    # =========================================================================

    @staticmethod
    def simulate_routing(
        db: Session,
        category_id: uuid.UUID,
        subject_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Simulates the end-to-end routing decision for a hypothetical grievance.
        Validates whether target authorities, clusters, and subject mappings resolve cleanly
        or hit ambiguity, missing configurations, inactive gates, or fallback queues.
        """
        category = db.scalar(
            select(Category)
            .options(
                joinedload(Category.grievance_cluster).joinedload(GrievanceCluster.associate_dean),
                joinedload(Category.fixed_authority),
            )
            .where(Category.id == category_id)
        )
        if not category:
            raise ValueError(f"Category '{category_id}' not found.")

        result: Dict[str, Any] = {
            "status": "UNRESOLVED",
            "routing_type": category.routing_type,
            "category_name": category.name,
            "target_authority_id": None,
            "target_authority_name": None,
            "target_authority_role": None,
            "cluster_name": None,
            "cluster_number": None,
            "path_taken": [f"Select Category '{category.name}' ({category.routing_type.value})"],
            "warnings": [],
            "fallback_used": False,
        }

        if not category.is_active:
            result["warnings"].append(f"Category '{category.name}' is currently INACTIVE. Grievance creation will fail.")

        # Case A: FIXED_AUTHORITY
        if category.routing_type == CategoryRoutingType.FIXED_AUTHORITY:
            auth = category.fixed_authority
            if not auth:
                result["status"] = "UNRESOLVED"
                result["warnings"].append("No fixed authority configured for this category.")
                result["path_taken"].append("Fallback -> Central Manager Triage Queue")
                result["fallback_used"] = True
            elif not auth.is_active:
                result["status"] = "FALLBACK"
                result["warnings"].append(f"Fixed authority '{auth.name_snapshot}' ({auth.role}) is INACTIVE.")
                result["path_taken"].append(f"Inactive Authority: {auth.name_snapshot} -> Fallback to Dean / Central Manager")
                result["fallback_used"] = True
            else:
                result["status"] = "ROUTED"
                result["target_authority_id"] = auth.id
                result["target_authority_name"] = auth.name_snapshot
                result["target_authority_role"] = auth.role.value
                result["path_taken"].append(f"Resolved Authority -> {auth.name_snapshot} ({auth.role.value})")

        # Case B: CLUSTER / GRIEVANCE_CLUSTER
        elif category.routing_type in (CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER):
            gc = category.grievance_cluster
            if not gc:
                result["status"] = "UNRESOLVED"
                result["warnings"].append("No grievance cluster mapped to this category.")
                result["path_taken"].append("Fallback -> Central Manager Triage Queue")
                result["fallback_used"] = True
            else:
                result["cluster_name"] = gc.name
                result["cluster_number"] = gc.cluster_number
                result["path_taken"].append(f"Mapped Grievance Cluster #{gc.cluster_number}: '{gc.name}'")

                if not gc.is_active:
                    result["status"] = "FALLBACK"
                    result["warnings"].append(f"Grievance Cluster '{gc.name}' is INACTIVE.")
                    result["path_taken"].append("Fallback -> Dean of R&D Queue")
                    result["fallback_used"] = True
                elif not gc.associate_dean:
                    result["status"] = "UNRESOLVED"
                    result["warnings"].append(f"No Associate Dean assigned to cluster '{gc.name}'.")
                    result["path_taken"].append("Fallback -> Central Manager Triage Queue")
                    result["fallback_used"] = True
                elif not gc.associate_dean.is_active:
                    result["status"] = "FALLBACK"
                    result["warnings"].append(f"Assigned Associate Dean '{gc.associate_dean.name_snapshot}' is INACTIVE.")
                    result["path_taken"].append("Fallback -> Dean of R&D Queue")
                    result["fallback_used"] = True
                else:
                    result["status"] = "ROUTED"
                    result["target_authority_id"] = gc.associate_dean.id
                    result["target_authority_name"] = gc.associate_dean.name_snapshot
                    result["target_authority_role"] = gc.associate_dean.role.value
                    result["path_taken"].append(f"Resolved Associate Dean -> {gc.associate_dean.name_snapshot}")

        # Case C: SUBJECT_ASSISTANT_DEAN
        elif category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
            result["path_taken"].append("Subject-based resolution required.")
            if not subject_id:
                result["status"] = "AMBIGUOUS"
                result["warnings"].append("Subject ID is required to resolve academic Assistant Dean routing.")
                result["path_taken"].append("Ambiguity: No subject provided -> Requires Central Manager Triage")
                result["fallback_used"] = True
            else:
                subject = db.scalar(
                    select(Subject)
                    .options(
                        joinedload(Subject.cluster).joinedload(SubjectCluster.assistant_dean)
                    )
                    .where(Subject.id == subject_id)
                )
                if not subject:
                    result["status"] = "UNRESOLVED"
                    result["warnings"].append(f"Subject '{subject_id}' does not exist.")
                    result["path_taken"].append("Invalid Subject -> Central Manager Fallback")
                    result["fallback_used"] = True
                else:
                    result["path_taken"].append(f"Resolved Academic Subject: '{subject.name}'")
                    if not subject.is_active:
                        result["warnings"].append(f"Subject '{subject.name}' is marked INACTIVE.")

                    sc = subject.cluster
                    if not sc:
                        result["status"] = "UNRESOLVED"
                        result["warnings"].append(f"Subject '{subject.name}' has no linked academic cluster.")
                        result["path_taken"].append("Unlinked Cluster -> Central Manager Triage")
                        result["fallback_used"] = True
                    else:
                        result["cluster_name"] = sc.name
                        result["cluster_number"] = sc.cluster_number
                        result["path_taken"].append(f"Resolved Academic Cluster #{sc.cluster_number}: '{sc.name}'")

                        if not sc.is_active:
                            result["status"] = "FALLBACK"
                            result["warnings"].append(f"Subject Cluster '{sc.name}' is INACTIVE.")
                            result["path_taken"].append("Inactive Cluster -> Dean of R&D Fallback")
                            result["fallback_used"] = True
                        elif not sc.assistant_dean:
                            result["status"] = "UNRESOLVED"
                            result["warnings"].append(f"No Assistant Dean mapped to Subject Cluster '{sc.name}'.")
                            result["path_taken"].append("Unassigned Dean -> Central Manager Triage")
                            result["fallback_used"] = True
                        elif not sc.assistant_dean.is_active:
                            result["status"] = "FALLBACK"
                            result["warnings"].append(f"Mapped Assistant Dean '{sc.assistant_dean.name_snapshot}' is INACTIVE.")
                            result["path_taken"].append("Inactive Assistant Dean -> Dean of R&D Fallback")
                            result["fallback_used"] = True
                        else:
                            result["status"] = "ROUTED"
                            result["target_authority_id"] = sc.assistant_dean.id
                            result["target_authority_name"] = sc.assistant_dean.name_snapshot
                            result["target_authority_role"] = sc.assistant_dean.role.value
                            result["path_taken"].append(f"Resolved Assistant Dean -> {sc.assistant_dean.name_snapshot}")

        return result
