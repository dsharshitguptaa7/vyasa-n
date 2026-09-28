"""
Idempotent Master Data Seeder for NIVARAN Pillar.

Executes deterministic seeding for:
- Authority Profiles (linked to configured VYASA Core user identities)
- Subject Clusters & Subjects
- Grievance Clusters
- Grievance Categories with Tri-State Routing

Safe to run repeatedly in development, testing, and production.
"""

import logging
from typing import Any, Dict, List, Tuple

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.models.authority import NivaranAuthority
from app.models.taxonomy import Category, GrievanceCluster, Subject, SubjectCluster
from app.seed.authority_mappings import resolve_authority_vyasa_id
from app.seed.data import (
    AUTHORITIES_ROSTER,
    CATEGORIES_DATA,
    GRIEVANCE_CLUSTERS_DATA,
    SUBJECT_CLUSTERS_DATA,
    SUBJECTS_BY_CLUSTER,
)

logger = logging.getLogger("nivaran.seed")

REQUIRED_TABLES = [
    "nivaran_authorities",
    "subject_clusters",
    "subjects",
    "grievance_clusters",
    "categories",
]


def verify_tables_exist() -> None:
    """Verify that all required master data tables exist in the target database."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    missing_tables = [t for t in REQUIRED_TABLES if t not in existing_tables]
    if missing_tables:
        raise RuntimeError(
            f"Cannot seed master data: Missing required database tables: {missing_tables}. "
            "Please ensure Alembic migrations have been applied first (`alembic upgrade head`)."
        )


def seed_authorities(
    db: Session,
) -> Tuple[Dict[str, NivaranAuthority], List[Dict[str, Any]]]:
    """
    Seed/sync institutional authority profiles.
    Maps domain roles (Assistant Dean, Associate Dean) to configured VYASA user UUIDs.
    
    If an authority has no configured VYASA user ID:
    - Does NOT fabricate a fake UUID.
    - Does NOT create a dummy authentication record.
    - Records the authority as UNRESOLVED and reports it visibly.
    
    Returns:
        (resolved_authority_map, unresolved_authorities_list)
    """
    authority_map: Dict[str, NivaranAuthority] = {}
    unresolved_authorities: List[Dict[str, Any]] = []

    for auth_spec in AUTHORITIES_ROSTER:
        key = auth_spec["key"]
        email = auth_spec["email"]
        cluster_role = auth_spec.get("cluster_role")
        cluster_number = auth_spec.get("cluster_number")

        vyasa_user_id = resolve_authority_vyasa_id(key, cluster_role, cluster_number)

        if vyasa_user_id is None:
            logger.warning(
                "Authority '%s' (%s) has no configured VYASA user ID. Remaining UNRESOLVED.",
                auth_spec["name"],
                email,
            )
            unresolved_authorities.append(auth_spec)
            continue

        # Look up by email_snapshot or vyasa_user_id
        stmt = select(NivaranAuthority).where(
            (NivaranAuthority.email_snapshot == email) | (NivaranAuthority.vyasa_user_id == vyasa_user_id)
        )
        existing = db.execute(stmt).scalar_one_or_none()

        if existing:
            existing.name_snapshot = auth_spec["name"]
            existing.email_snapshot = email
            existing.role = auth_spec["role"]
            existing.designation = auth_spec["designation"]
            existing.department = auth_spec["department"]
            existing.is_active = True
            existing.vyasa_user_id = vyasa_user_id
            authority_map[key] = existing
        else:
            new_authority = NivaranAuthority(
                vyasa_user_id=vyasa_user_id,
                role=auth_spec["role"],
                name_snapshot=auth_spec["name"],
                email_snapshot=email,
                designation=auth_spec["designation"],
                department=auth_spec["department"],
                is_active=True,
            )
            db.add(new_authority)
            db.flush()
            authority_map[key] = new_authority

    return authority_map, unresolved_authorities


def seed_grievance_clusters(
    db: Session, authority_map: Dict[str, NivaranAuthority]
) -> Dict[int, GrievanceCluster]:
    """
    Seed/sync 3 institutional Grievance Clusters.
    Each cluster is uniquely associated 1:1 with an Associate Dean.
    Returns map of cluster_number -> GrievanceCluster.
    """
    clusters_map: Dict[int, GrievanceCluster] = {}

    for spec in GRIEVANCE_CLUSTERS_DATA:
        c_num = spec["cluster_number"]
        assoc_key = spec["associate_dean_key"]

        if assoc_key not in authority_map:
            logger.warning(
                "Skipping Grievance Cluster %d (%s): Associate Dean '%s' is not resolved in VYASA Core.",
                c_num,
                spec["name"],
                assoc_key,
            )
            continue

        assoc_dean = authority_map[assoc_key]

        stmt = select(GrievanceCluster).where(GrievanceCluster.cluster_number == c_num)
        existing = db.execute(stmt).scalar_one_or_none()

        if existing:
            existing.name = spec["name"]
            existing.associate_dean_id = assoc_dean.id
            existing.is_active = True
            clusters_map[c_num] = existing
        else:
            new_cluster = GrievanceCluster(
                cluster_number=c_num,
                name=spec["name"],
                associate_dean_id=assoc_dean.id,
                is_active=True,
            )
            db.add(new_cluster)
            db.flush()
            clusters_map[c_num] = new_cluster

    return clusters_map


def seed_subject_clusters(
    db: Session, authority_map: Dict[str, NivaranAuthority]
) -> Dict[int, SubjectCluster]:
    """
    Seed/sync 10 Subject Clusters.
    Each cluster is uniquely associated 1:1 with an Assistant Dean.
    Returns map of cluster_number -> SubjectCluster.
    """
    clusters_map: Dict[int, SubjectCluster] = {}

    for spec in SUBJECT_CLUSTERS_DATA:
        c_num = spec["cluster_number"]
        asst_key = spec["assistant_dean_key"]

        if asst_key not in authority_map:
            logger.warning(
                "Skipping Subject Cluster %d (%s): Assistant Dean '%s' is not resolved in VYASA Core.",
                c_num,
                spec["name"],
                asst_key,
            )
            continue

        asst_dean = authority_map[asst_key]

        stmt = select(SubjectCluster).where(SubjectCluster.cluster_number == c_num)
        existing = db.execute(stmt).scalar_one_or_none()

        if existing:
            existing.name = spec["name"]
            existing.assistant_dean_id = asst_dean.id
            existing.is_active = True
            clusters_map[c_num] = existing
        else:
            new_cluster = SubjectCluster(
                cluster_number=c_num,
                name=spec["name"],
                assistant_dean_id=asst_dean.id,
                is_active=True,
            )
            db.add(new_cluster)
            db.flush()
            clusters_map[c_num] = new_cluster

    return clusters_map


def seed_subjects(db: Session, subject_clusters_map: Dict[int, SubjectCluster]) -> int:
    """
    Seed/sync production subjects mapped to Subject Clusters.
    Returns total count of subjects seeded.
    """
    total_subjects = 0

    for c_num, subject_names in SUBJECTS_BY_CLUSTER.items():
        if c_num not in subject_clusters_map:
            logger.warning("Skipping subjects for Subject Cluster %d: cluster record not seeded.", c_num)
            continue

        cluster = subject_clusters_map[c_num]
        for name in subject_names:
            stmt = select(Subject).where(Subject.name == name)
            existing = db.execute(stmt).scalar_one_or_none()

            if existing:
                existing.subject_cluster_id = cluster.id
                existing.is_active = True
            else:
                new_subject = Subject(
                    name=name,
                    subject_cluster_id=cluster.id,
                    is_active=True,
                )
                db.add(new_subject)

            total_subjects += 1

    db.flush()
    return total_subjects


def seed_categories(
    db: Session,
    grievance_clusters_map: Dict[int, GrievanceCluster],
    authority_map: Dict[str, NivaranAuthority],
) -> int:
    """
    Seed/sync 16 grievance categories across the 3 routing types:
    - GRIEVANCE_CLUSTER -> points to GrievanceCluster
    - SUBJECT_ASSISTANT_DEAN -> dynamic routing at assignment time (both cluster/fixed FKs NULL)
    - FIXED_AUTHORITY -> points to designated NivaranAuthority
    Returns total count of categories seeded.
    """
    total_categories = 0

    for cat_spec in CATEGORIES_DATA:
        name = cat_spec["name"]
        routing_type = cat_spec["routing_type"]

        # Resolve foreign keys based on routing type
        g_cluster_id = None
        f_auth_id = None

        if cat_spec["grievance_cluster_number"] is not None:
            c_num = cat_spec["grievance_cluster_number"]
            if c_num in grievance_clusters_map:
                g_cluster_id = grievance_clusters_map[c_num].id
            else:
                logger.warning("Category '%s' references unseeded Grievance Cluster %d.", name, c_num)
                continue

        if cat_spec["fixed_authority_key"] is not None:
            f_key = cat_spec["fixed_authority_key"]
            if f_key in authority_map:
                f_auth_id = authority_map[f_key].id
            else:
                logger.warning("Category '%s' references unresolved fixed authority '%s'.", name, f_key)
                continue

        stmt = select(Category).where(Category.name == name)
        existing = db.execute(stmt).scalar_one_or_none()

        if existing:
            existing.routing_type = routing_type
            existing.grievance_cluster_id = g_cluster_id
            existing.fixed_authority_id = f_auth_id
            existing.description = cat_spec["description"]
            existing.is_active = True
        else:
            new_cat = Category(
                name=name,
                routing_type=routing_type,
                grievance_cluster_id=g_cluster_id,
                fixed_authority_id=f_auth_id,
                description=cat_spec["description"],
                is_active=True,
            )
            db.add(new_cat)

        total_categories += 1

    db.flush()
    return total_categories


def seed_master_data(session: Session | None = None) -> Dict[str, Any]:
    """
    Main entry point for idempotent master data seeding.
    Can accept an existing Session (e.g. from tests) or instantiate a new SessionLocal.
    """
    verify_tables_exist()

    close_session = False
    if session is None:
        db = SessionLocal()
        close_session = True
    else:
        db = session

    try:
        # 1. Authorities (13 profiles resolved from configuration/env)
        authority_map, unresolved_authorities = seed_authorities(db)

        # 2. Grievance Clusters (3 clusters)
        grievance_clusters_map = seed_grievance_clusters(db, authority_map)

        # 3. Subject Clusters (10 clusters)
        subject_clusters_map = seed_subject_clusters(db, authority_map)

        # 4. Subjects (56 academic subjects)
        total_subjects = seed_subjects(db, subject_clusters_map)

        # 5. Categories (16 grievance categories)
        total_categories = seed_categories(db, grievance_clusters_map, authority_map)

        db.commit()

        summary = {
            "subject_clusters": len(subject_clusters_map),
            "subjects": total_subjects,
            "grievance_clusters": len(grievance_clusters_map),
            "categories": total_categories,
            "resolved_authorities": len(authority_map),
            "unresolved_authorities": [
                f"{a['name']} ({a['email']}) [{a['role'].value}]"
                for a in unresolved_authorities
            ],
        }
        return summary

    except Exception:
        db.rollback()
        raise
    finally:
        if close_session:
            db.close()
