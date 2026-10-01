"""
Dynamic Routing Engine for Atharva Veda (NIVARAN-AI)

Architectural Principle:
"Routing ENGINE is code. Routing CONFIGURATION is data."

The code defines the routing resolution algorithm.
The database defines the dynamic mappings (Subject -> Cluster -> Asst Dean; Category -> Cluster/Fixed -> Assoc Dean).
Zero hardcoded IDs, names, or counts.
"""
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.modules.atharva_veda.nivaran.models.taxonomy import Subject, SubjectCluster, Category, GrievanceCluster
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType, NivaranRole


class RoutingConfigurationError(ValueError):
    """Raised when institutional routing configuration is missing, incomplete, or invalid."""
    pass


class DynamicRoutingEngine:
    @staticmethod
    def resolve_subject_route(db: Session, subject_id: uuid.UUID) -> NivaranAuthority:
        """
        Dynamically resolves the accountable Assistant Dean for an academic subject.
        Resolution path: Subject -> Subject Cluster -> Configured Assistant Dean.
        """
        subject = db.execute(
            select(Subject).where(Subject.id == subject_id)
        ).scalar_one_or_none()

        if not subject:
            raise RoutingConfigurationError(f"Subject '{subject_id}' does not exist.")
        if not subject.is_active:
            raise RoutingConfigurationError(f"Subject '{subject.name}' is currently inactive.")

        cluster = db.execute(
            select(SubjectCluster).where(SubjectCluster.id == subject.subject_cluster_id)
        ).scalar_one_or_none()

        if not cluster:
            raise RoutingConfigurationError(f"Subject '{subject.name}' has no assigned subject cluster.")
        if not cluster.is_active:
            raise RoutingConfigurationError(f"Subject cluster '{cluster.name}' is currently inactive.")
        if not cluster.assistant_dean_id:
            raise RoutingConfigurationError(f"Subject cluster '{cluster.name}' has no configured Assistant Dean.")

        authority = db.execute(
            select(NivaranAuthority).where(NivaranAuthority.id == cluster.assistant_dean_id)
        ).scalar_one_or_none()

        if not authority:
            raise RoutingConfigurationError(f"Configured Assistant Dean authority record '{cluster.assistant_dean_id}' not found.")
        if not authority.is_active:
            raise RoutingConfigurationError(f"Configured Assistant Dean '{authority.name_snapshot}' is currently inactive.")

        return authority

    @staticmethod
    def resolve_category_route(
        db: Session,
        category_id: uuid.UUID,
        subject_id: Optional[uuid.UUID] = None,
    ) -> NivaranAuthority:
        """
        Dynamically resolves the handling authority for a grievance category based on its configured routing type:
        1. FIXED_AUTHORITY -> Resolves directly to configured authority FK.
        2. CLUSTER / GRIEVANCE_CLUSTER -> Resolves to configured Associate Dean for the grievance cluster.
        3. SUBJECT_ASSISTANT_DEAN -> Delegates to subject routing to resolve the Assistant Dean.
        """
        category = db.execute(
            select(Category).where(Category.id == category_id)
        ).scalar_one_or_none()

        if not category:
            raise RoutingConfigurationError(f"Category '{category_id}' does not exist.")
        if not category.is_active:
            raise RoutingConfigurationError(f"Category '{category.name}' is currently inactive.")

        if category.routing_type == CategoryRoutingType.FIXED_AUTHORITY:
            if not category.fixed_authority_id:
                raise RoutingConfigurationError(f"Fixed-authority category '{category.name}' has no configured target authority.")
            
            authority = db.execute(
                select(NivaranAuthority).where(NivaranAuthority.id == category.fixed_authority_id)
            ).scalar_one_or_none()

            if not authority:
                raise RoutingConfigurationError(f"Configured fixed authority record '{category.fixed_authority_id}' not found.")
            if not authority.is_active:
                raise RoutingConfigurationError(f"Configured fixed authority '{authority.name_snapshot}' is currently inactive.")
            return authority

        elif category.routing_type in (CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER):
            if not category.grievance_cluster_id:
                raise RoutingConfigurationError(f"Cluster-routed category '{category.name}' has no assigned grievance cluster.")

            cluster = db.execute(
                select(GrievanceCluster).where(GrievanceCluster.id == category.grievance_cluster_id)
            ).scalar_one_or_none()

            if not cluster:
                raise RoutingConfigurationError(f"Assigned grievance cluster '{category.grievance_cluster_id}' does not exist.")
            if not cluster.is_active:
                raise RoutingConfigurationError(f"Grievance cluster '{cluster.name}' is currently inactive.")
            if not cluster.associate_dean_id:
                raise RoutingConfigurationError(f"Grievance cluster '{cluster.name}' has no configured Associate Dean.")

            authority = db.execute(
                select(NivaranAuthority).where(NivaranAuthority.id == cluster.associate_dean_id)
            ).scalar_one_or_none()

            if not authority:
                raise RoutingConfigurationError(f"Configured Associate Dean record '{cluster.associate_dean_id}' not found.")
            if not authority.is_active:
                raise RoutingConfigurationError(f"Configured Associate Dean '{authority.name_snapshot}' is currently inactive.")
            return authority

        elif category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN:
            if not subject_id:
                raise RoutingConfigurationError(f"Category '{category.name}' routes by subject, but no subject_id was provided.")
            return DynamicRoutingEngine.resolve_subject_route(db, subject_id)

        else:
            raise RoutingConfigurationError(f"Unsupported category routing type: '{category.routing_type}'")

    @staticmethod
    def resolve_dean_route(db: Session) -> NivaranAuthority:
        """
        Dynamically resolves the institutional Dean (Executive Tier).
        Resolution path: Query active NivaranAuthority with role == DEAN.
        """
        authority = db.execute(
            select(NivaranAuthority).where(
                NivaranAuthority.role == NivaranRole.DEAN,
                NivaranAuthority.is_active.is_(True),
            )
        ).scalars().first()

        if not authority:
            raise RoutingConfigurationError("No active Dean authority record is configured in the system.")
        return authority

