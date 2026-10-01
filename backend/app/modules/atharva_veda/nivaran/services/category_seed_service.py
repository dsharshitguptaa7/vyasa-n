import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.atharva_veda.nivaran.models.taxonomy import Category, GrievanceCluster
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType

logger = logging.getLogger("vyasa.atharva.category_seed")

# Authoritative 16 Approved NIVARAN Institutional Categories
# Sourced from projects/NIVARAN-AI/scripts/seed_categories.py & seed_category_routing.py
APPROVED_NIVARAN_CATEGORIES: List[Dict[str, Any]] = [
    {
        "name": "Supervisor_Related",
        "description": "Issues related to research supervisors or guides.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "PhD_Admission",
        "description": "Issues related to PhD admission and admission procedures.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Viva",
        "description": "Issues related to viva voce and viva procedures.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Thesis_Submission",
        "description": "Issues related to thesis submission and acknowledgement.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "RDC",
        "description": "Issues related to Research Degree Committee processes.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Fee",
        "description": "Issues related to fees, payments, and financial charges.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Portal_Data_Correction",
        "description": "Requests to correct incorrect information in the portal.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "RTI_IIGRS",
        "description": "Issues related to RTI and IIGRS matters.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Other",
        "description": "Grievances that do not fit into the defined categories.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "FT_PT_Conversion",
        "description": "Issues related to full-time and part-time research status conversion.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Thesis_Evaluation",
        "description": "Issues related to thesis evaluation and review.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Registration",
        "description": "Issues related to research registration.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "RAC",
        "description": "Issues related to Research Advisory Committee processes.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Fellowship",
        "description": "Issues related to research fellowship and scholarship payments.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
    {
        "name": "Course_Work",
        "description": "Issues related to coursework and academic course requirements.",
        "routing_type": CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
    },
    {
        "name": "Publication_Verification",
        "description": "Issues related to research publication verification.",
        "routing_type": CategoryRoutingType.GRIEVANCE_CLUSTER,
    },
]


def seed_nivaran_categories(
    db: Session,
    target_cluster: Optional[GrievanceCluster] = None,
) -> Dict[str, Any]:
    """
    Idempotently seeds and ratifies all 16 approved institutional categories in nivaran_categories.
    - If a category already exists: preserves its UUID, routing configuration, and active status.
      Populates description if absent.
    - If a category is missing: creates it cleanly under an active GrievanceCluster.
    - Avoids duplicates and never introduces unapproved/test categories.
    """
    # 1. Resolve fallback active GrievanceCluster if not provided
    if not target_cluster:
        target_cluster = db.scalar(
            select(GrievanceCluster)
            .where(
                GrievanceCluster.is_active.is_(True),
                GrievanceCluster.associate_dean_id.is_not(None),
            )
            .order_by(GrievanceCluster.cluster_number.asc())
        )

    cluster_id = target_cluster.id if target_cluster else None

    already_present: List[str] = []
    added: List[str] = []
    updated: List[str] = []

    for cat_spec in APPROVED_NIVARAN_CATEGORIES:
        name = cat_spec["name"]
        description = cat_spec["description"]
        routing_type = cat_spec["routing_type"]

        existing = db.scalar(select(Category).where(Category.name == name))

        if existing:
            already_present.append(name)
            # Update description if empty
            if not existing.description:
                existing.description = description
                updated.append(name)
            # If cluster is missing on a cluster-routed category, link it
            if existing.routing_type in (CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER):
                if not existing.grievance_cluster_id and cluster_id:
                    existing.grievance_cluster_id = cluster_id
                    updated.append(name)
        else:
            new_cat = Category(
                name=name,
                description=description,
                routing_type=routing_type,
                grievance_cluster_id=cluster_id if routing_type == CategoryRoutingType.GRIEVANCE_CLUSTER else None,
                is_active=True,
            )
            db.add(new_cat)
            added.append(name)

    db.commit()

    logger.info(
        f"[NIVARAN Category Seed] Approved 16 Check: {len(already_present)} existing, "
        f"{len(added)} added, {len(updated)} updated."
    )

    return {
        "total_approved": len(APPROVED_NIVARAN_CATEGORIES),
        "already_present": already_present,
        "added": added,
        "updated": updated,
        "cluster_linked": str(cluster_id) if cluster_id else None,
    }


if __name__ == "__main__":
    from app.core.database import SessionLocal

    with SessionLocal() as session:
        res = seed_nivaran_categories(session)
        print(f"Category Seeding Complete: {res}")
