"""
Admin Configuration Service for Atharva Veda (NIVARAN) Master Data & Routing

Enables authorized administrators to dynamically update institutional taxonomy and routing mappings.
Every modification generates an immutable record in Core audit_logs.
"""
import uuid
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject, GrievanceCluster, Category
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType


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

    @staticmethod
    def update_subject_cluster_assistant_dean(
        db: Session,
        cluster_id: uuid.UUID,
        new_assistant_dean_id: Optional[uuid.UUID],
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> SubjectCluster:
        """
        Reconfigures the Assistant Dean mapped to a Subject Cluster.
        Affects all future subject routing for this cluster immediately without code changes.
        """
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
    def update_grievance_cluster_associate_dean(
        db: Session,
        cluster_id: uuid.UUID,
        new_associate_dean_id: Optional[uuid.UUID],
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> GrievanceCluster:
        """
        Reconfigures the Associate Dean mapped to a Grievance Cluster.
        Affects all future grievance category routing for this cluster immediately.
        """
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
    def update_category_routing(
        db: Session,
        category_id: uuid.UUID,
        routing_type: CategoryRoutingType,
        grievance_cluster_id: Optional[uuid.UUID] = None,
        fixed_authority_id: Optional[uuid.UUID] = None,
        actor_user_id: Optional[uuid.UUID] = None,
    ) -> Category:
        """
        Reconfigures category routing mode (CLUSTER vs FIXED_AUTHORITY).
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
        existing = db.scalar(
            select(Subject).where(func.lower(Subject.name) == name.strip().lower())
        )
        if existing:
            raise ValueError(f"Subject with name '{name.strip()}' already exists.")

        cluster = db.scalar(
            select(SubjectCluster).where(SubjectCluster.id == subject_cluster_id)
        )
        if not cluster:
            raise ValueError(f"SubjectCluster '{subject_cluster_id}' not found.")
        if not cluster.is_active:
            raise ValueError(f"SubjectCluster '{cluster.name}' is inactive.")

        subject = Subject(
            name=name.strip(),
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
        if name is not None and name.strip() != subject.name:
            existing = db.scalar(
                select(Subject).where(func.lower(Subject.name) == name.strip().lower())
            )
            if existing and existing.id != subject.id:
                raise ValueError(f"Subject with name '{name.strip()}' already exists.")
            changes["name"] = {"old": subject.name, "new": name.strip()}
            subject.name = name.strip()

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

