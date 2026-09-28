"""
Tests validating the NIVARAN institutional master data layer and seeding.

Validates the 15 core requirements:
1. Exactly 10 Subject Cluster numbers are supported.
2. Subject Cluster numbers are 1..10.
3. Subject Cluster numbers are unique.
4. Each seeded subject belongs to exactly one Subject Cluster.
5. No duplicate subjects.
6. Exactly 3 Grievance Clusters.
7. Exactly 16 Categories.
8. Every category has one valid routing type.
9. GRIEVANCE_CLUSTER categories reference the correct Grievance Cluster.
10. FIXED_AUTHORITY categories reference the correct configured authority.
11. SUBJECT_ASSISTANT_DEAN categories have no Grievance Cluster mapping.
12. Running the seed twice creates no duplicates (idempotency).
13. No fake VYASA user IDs are generated (deterministic non-random IDs).
14. No VYASA Core database tables are created in NIVARAN.
15. The frozen 40-table schema remains unchanged.
"""

import uuid
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import engine
from app.models.authority import NivaranAuthority
from app.models.base import Base
from app.models.enums import CategoryRoutingType, NivaranRole
from app.models.taxonomy import Category, GrievanceCluster, Subject, SubjectCluster
from app.seed.authority_mappings import (
    PROVISIONED_AUTHORITY_VYASA_MAP,
    resolve_authority_vyasa_id,
)
from app.seed.data import (
    AUTHORITIES_ROSTER,
    CATEGORIES_DATA,
    GRIEVANCE_CLUSTERS_DATA,
    SUBJECT_CLUSTERS_DATA,
    SUBJECTS_BY_CLUSTER,
)
from app.seed.seeder import seed_master_data


def test_ten_subject_clusters_exist(db_session: Session) -> None:
    """Requirement 1, 2 & 3: Exactly 10 Subject Clusters exist with unique numbers 1-10."""
    clusters = db_session.execute(
        select(SubjectCluster).order_by(SubjectCluster.cluster_number)
    ).scalars().all()

    assert len(clusters) == 10
    cluster_numbers = [c.cluster_number for c in clusters]
    assert cluster_numbers == list(range(1, 11))

    # Unique assistant deans
    assistant_dean_ids = [c.assistant_dean_id for c in clusters]
    assert len(set(assistant_dean_ids)) == 10
    for aid in assistant_dean_ids:
        assert aid is not None


def test_subject_to_cluster_mapping_no_duplicates(db_session: Session) -> None:
    """Requirement 4 & 5: Subject -> Subject Cluster mappings contain no duplicate subjects."""
    subjects = db_session.execute(select(Subject)).scalars().all()
    assert len(subjects) == 56

    subject_names = [s.name for s in subjects]
    assert len(set(subject_names)) == 56, "Duplicate subjects detected in database"

    # Verify each subject is linked to exactly one valid subject cluster
    cluster_ids = set(
        db_session.execute(select(SubjectCluster.id)).scalars().all()
    )
    for s in subjects:
        assert s.subject_cluster_id in cluster_ids


def test_three_grievance_clusters_exist(db_session: Session) -> None:
    """Requirement 6: Exactly 3 Grievance Clusters exist after seed."""
    g_clusters = db_session.execute(
        select(GrievanceCluster).order_by(GrievanceCluster.cluster_number)
    ).scalars().all()

    assert len(g_clusters) == 3
    assert [gc.cluster_number for gc in g_clusters] == [1, 2, 3]

    # Verify associate deans
    associate_dean_ids = [gc.associate_dean_id for gc in g_clusters]
    assert len(set(associate_dean_ids)) == 3
    for ad_id in associate_dean_ids:
        assert ad_id is not None
        ad = db_session.get(NivaranAuthority, ad_id)
        assert ad is not None
        assert ad.role == NivaranRole.ASSOCIATE_DEAN


def test_sixteen_categories_exist(db_session: Session) -> None:
    """Requirement 7: Exactly 16 grievance categories exist after seed."""
    categories = db_session.execute(select(Category)).scalars().all()
    assert len(categories) == 16

    expected_names = {cat["name"] for cat in CATEGORIES_DATA}
    actual_names = {c.name for c in categories}
    assert actual_names == expected_names


def test_category_routing_types_valid(db_session: Session) -> None:
    """Requirement 8: Every category has one valid routing type."""
    categories = db_session.execute(select(Category)).scalars().all()
    for cat in categories:
        assert isinstance(cat.routing_type, CategoryRoutingType)
        assert cat.routing_type in [
            CategoryRoutingType.GRIEVANCE_CLUSTER,
            CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
            CategoryRoutingType.FIXED_AUTHORITY,
        ]


def test_grievance_cluster_categories_point_to_correct_cluster(db_session: Session) -> None:
    """Requirement 9: GRIEVANCE_CLUSTER categories reference the correct Grievance Cluster."""
    cluster_map = {
        gc.cluster_number: gc.id
        for gc in db_session.execute(select(GrievanceCluster)).scalars().all()
    }

    expected_cluster_1 = {"PhD_Admission", "Registration", "Supervisor_Related"}
    expected_cluster_2 = {"Course_Work", "RAC", "RDC", "FT_PT_Conversion"}
    expected_cluster_3 = {"Publication_Verification", "Thesis_Submission", "Thesis_Evaluation"}

    categories = db_session.execute(
        select(Category).where(Category.routing_type == CategoryRoutingType.GRIEVANCE_CLUSTER)
    ).scalars().all()

    assert len(categories) == 10

    for cat in categories:
        assert cat.fixed_authority_id is None, f"{cat.name} should not have fixed_authority_id"
        assert cat.grievance_cluster_id is not None, f"{cat.name} must have grievance_cluster_id"

        if cat.name in expected_cluster_1:
            assert cat.grievance_cluster_id == cluster_map[1]
        elif cat.name in expected_cluster_2:
            assert cat.grievance_cluster_id == cluster_map[2]
        elif cat.name in expected_cluster_3:
            assert cat.grievance_cluster_id == cluster_map[3]
        else:
            raise AssertionError(f"Unexpected GRIEVANCE_CLUSTER category: {cat.name}")


def test_fixed_authority_categories(db_session: Session) -> None:
    """Requirement 10: FIXED_AUTHORITY categories reference the correct configured authority."""
    fixed_cats = db_session.execute(
        select(Category).where(Category.routing_type == CategoryRoutingType.FIXED_AUTHORITY)
    ).scalars().all()

    assert len(fixed_cats) == 2
    cat_by_name = {c.name: c for c in fixed_cats}

    # Fellowship -> Dr. Dipesh Kumar Verma
    fellowship = cat_by_name["Fellowship"]
    assert fellowship.grievance_cluster_id is None
    assert fellowship.fixed_authority_id is not None
    auth_fellowship = db_session.get(NivaranAuthority, fellowship.fixed_authority_id)
    assert auth_fellowship is not None
    assert auth_fellowship.name_snapshot == "Dr. Dipesh Kumar Verma"
    assert auth_fellowship.email_snapshot == "dipesh.verma@nivaran.local"

    # RTI_IIGRS -> Dr. Samiuddin
    rti = cat_by_name["RTI_IIGRS"]
    assert rti.grievance_cluster_id is None
    assert rti.fixed_authority_id is not None
    auth_rti = db_session.get(NivaranAuthority, rti.fixed_authority_id)
    assert auth_rti is not None
    assert auth_rti.name_snapshot == "Dr. Samiuddin"
    assert auth_rti.email_snapshot == "samiuddin@nivaran.local"


def test_subject_assistant_dean_categories(db_session: Session) -> None:
    """Requirement 11: SUBJECT_ASSISTANT_DEAN categories have no Grievance Cluster mapping."""
    asst_cats = db_session.execute(
        select(Category).where(Category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN)
    ).scalars().all()

    assert len(asst_cats) == 4
    names = {c.name for c in asst_cats}
    assert names == {"Viva", "Fee", "Portal_Data_Correction", "Other"}

    for cat in asst_cats:
        assert cat.grievance_cluster_id is None
        assert cat.fixed_authority_id is None


def test_idempotency_running_seed_twice(db_session: Session) -> None:
    """Requirement 12: Running seed multiple times creates no duplicates."""
    count_sc_before = db_session.query(SubjectCluster).count()
    count_sub_before = db_session.query(Subject).count()
    count_gc_before = db_session.query(GrievanceCluster).count()
    count_cat_before = db_session.query(Category).count()
    count_auth_before = db_session.query(NivaranAuthority).count()

    # Re-run seed
    summary = seed_master_data(session=db_session)

    count_sc_after = db_session.query(SubjectCluster).count()
    count_sub_after = db_session.query(Subject).count()
    count_gc_after = db_session.query(GrievanceCluster).count()
    count_cat_after = db_session.query(Category).count()
    count_auth_after = db_session.query(NivaranAuthority).count()

    assert count_sc_before == count_sc_after == 10
    assert count_sub_before == count_sub_after == 56
    assert count_gc_before == count_gc_after == 3
    assert count_cat_before == count_cat_after == 16
    assert count_auth_before == count_auth_after == 13
    assert summary["resolved_authorities"] == 13
    assert len(summary["unresolved_authorities"]) == 0


def test_no_fake_vyasa_user_ids(db_session: Session) -> None:
    """Requirement 13: No random or fake UUIDs are generated; resolver returns None for unknown."""
    authorities = db_session.execute(select(NivaranAuthority)).scalars().all()
    assert len(authorities) == 13

    for auth in authorities:
        assert isinstance(auth.vyasa_user_id, uuid.UUID)

    # Verify deterministic reproducibility: calling resolve_authority_vyasa_id repeatedly produces identical UUIDs
    for spec in AUTHORITIES_ROSTER:
        uuid1 = resolve_authority_vyasa_id(spec["key"], spec.get("cluster_role"), spec.get("cluster_number"))
        uuid2 = resolve_authority_vyasa_id(spec["key"], spec.get("cluster_role"), spec.get("cluster_number"))
        assert uuid1 == uuid2, f"UUID for {spec['name']} is non-deterministic!"

        # Match with DB record
        db_auth = db_session.execute(
            select(NivaranAuthority).where(NivaranAuthority.email_snapshot == spec["email"])
        ).scalar_one()
        assert db_auth.vyasa_user_id == uuid1

    # Verify that an unprovisioned authority returns None (unresolved) rather than generating a fake UUID
    unresolved_result = resolve_authority_vyasa_id("unprovisioned_faculty_member")
    assert unresolved_result is None, "Unprovisioned authority must return None, not a fake UUID!"


def test_no_vyasa_core_tables_in_nivaran() -> None:
    """Requirement 14: No VYASA Core database tables are created in NIVARAN database."""
    inspector = inspect(engine)
    nivaran_tables = set(inspector.get_table_names())

    vyasa_core_only_tables = {
        "users",
        "roles",
        "permissions",
        "role_permissions",
        "user_roles",
        "pillars",
        "notifications",
    }

    overlapping = vyasa_core_only_tables.intersection(nivaran_tables)
    assert len(overlapping) == 0, f"VYASA Core tables unexpectedly found in NIVARAN: {overlapping}"


def test_forty_table_schema_remains_unchanged() -> None:
    """Requirement 15: Existing 40-table schema remains untouched."""
    metadata_tables = set(Base.metadata.tables.keys())
    assert len(metadata_tables) == 40

    inspector = inspect(engine)
    live_tables = set(t for t in inspector.get_table_names() if t != "alembic_version")
    assert len(live_tables) == 40
    assert metadata_tables == live_tables
