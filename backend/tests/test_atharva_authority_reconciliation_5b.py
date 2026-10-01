"""
Comprehensive Tests for Phase 5B: Canonical Nivaran Authority Reconciliation & Safe Cleanup.
Verifies all 15 Phase 5B deliverables and invariants against the live PostgreSQL database.
"""

import uuid
import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import CategoryRoutingType, NivaranRole
from app.modules.atharva_veda.nivaran.models.taxonomy import Category, GrievanceCluster, SubjectCluster, Subject

client = TestClient(app)


@pytest.fixture(scope="module")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def admin_token(db_session: Session):
    admin = db_session.execute(select(User).where(User.email == "admin@csjmu.ac.in")).scalar_one_or_none()
    assert admin is not None, "Admin user admin@csjmu.ac.in must exist"
    return create_access_token(data={"sub": str(admin.id), "email": admin.email, "role": "administrator"})


def test_01_canonical_authorities_count_and_roles(db_session: Session):
    """Verify exactly 15 active canonical authorities exist with exact role breakdown."""
    auths = db_session.scalars(select(NivaranAuthority)).all()
    assert len(auths) == 15
    assert all(a.is_active for a in auths)

    role_counts = {}
    for a in auths:
        role_counts[a.role.value] = role_counts.get(a.role.value, 0) + 1

    expected_roles = {
        "DEAN": 1,
        "MANAGER": 1,
        "ASSISTANT_DEAN": 10,
        "ASSOCIATE_DEAN": 3,
    }
    assert role_counts == expected_roles


def test_02_canonical_users_activation_and_linkage(db_session: Session):
    """Verify all 15 authorities link to the 15 canonical active users."""
    expected_emails = {
        "research@csjmu.ac.in",
        "rdmmanager@csjmu.ac.in",
        "assistantdean1@csjmu.ac.in",
        "assistantdean2@csjmu.ac.in",
        "assistantdean3@csjmu.ac.in",
        "assistantdean4@csjmu.ac.in",
        "assistantdean5@csjmu.ac.in",
        "assistantdean6@csjmu.ac.in",
        "assistantdean7@csjmu.ac.in",
        "assistantdean9@csjmu.ac.in",
        "assistantdean10@csjmu.ac.in",
        "assistantdean11@csjmu.ac.in",
        "associatedean1@csjmu.ac.in",
        "associatedean2@csjmu.ac.in",
        "associatedean3@csjmu.ac.in",
    }

    auths = db_session.scalars(select(NivaranAuthority)).all()
    auth_emails = {a.email_snapshot for a in auths}
    assert auth_emails == expected_emails

    for a in auths:
        user = db_session.scalar(select(User).where(User.id == a.vyasa_user_id))
        assert user is not None
        assert user.is_active is True
        assert user.email == a.email_snapshot


def test_03_subject_clusters_mapped_to_assistant_deans(db_session: Session):
    """Verify all 10 subject clusters are active and bound to canonical Assistant Deans."""
    scs = db_session.scalars(select(SubjectCluster).order_by(SubjectCluster.cluster_number)).all()
    assert len(scs) == 10

    expected_mappings = {
        1: "assistantdean1@csjmu.ac.in",
        2: "assistantdean2@csjmu.ac.in",
        3: "assistantdean3@csjmu.ac.in",
        4: "assistantdean4@csjmu.ac.in",
        5: "assistantdean5@csjmu.ac.in",
        6: "assistantdean6@csjmu.ac.in",
        7: "assistantdean7@csjmu.ac.in",
        8: "assistantdean9@csjmu.ac.in",
        9: "assistantdean10@csjmu.ac.in",
        10: "assistantdean11@csjmu.ac.in",
    }

    for sc in scs:
        assert sc.is_active is True
        assert sc.assistant_dean_id is not None
        asst = db_session.scalar(select(NivaranAuthority).where(NivaranAuthority.id == sc.assistant_dean_id))
        assert asst is not None
        assert asst.role == NivaranRole.ASSISTANT_DEAN
        assert asst.email_snapshot == expected_mappings[sc.cluster_number]


def test_04_grievance_clusters_mapped_to_associate_deans(db_session: Session):
    """Verify exactly 3 grievance clusters exist and are bound to canonical Associate Deans."""
    gcs = db_session.scalars(select(GrievanceCluster).order_by(GrievanceCluster.cluster_number)).all()
    assert len(gcs) == 3

    expected_mappings = {
        1: "associatedean2@csjmu.ac.in",
        2: "associatedean3@csjmu.ac.in",
        3: "associatedean1@csjmu.ac.in",
    }

    for gc in gcs:
        assert gc.is_active is True
        assert gc.associate_dean_id is not None
        assoc = db_session.scalar(select(NivaranAuthority).where(NivaranAuthority.id == gc.associate_dean_id))
        assert assoc is not None
        assert assoc.role == NivaranRole.ASSOCIATE_DEAN
        assert assoc.email_snapshot == expected_mappings[gc.cluster_number]


def test_05_category_routing_exact_match(db_session: Session):
    """Verify all 16 institutional categories have exact canonical routing."""
    cats = db_session.scalars(select(Category)).all()
    assert len(cats) == 16
    assert all(c.is_active for c in cats)

    gc_by_num = {
        gc.cluster_number: gc
        for gc in db_session.scalars(select(GrievanceCluster)).all()
    }

    expected_routing = {
        "PhD_Admission": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[1].id, None),
        "Registration": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[1].id, None),
        "Supervisor_Related": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[1].id, None),
        "Course_Work": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[2].id, None),
        "RAC": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[2].id, None),
        "RDC": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[2].id, None),
        "FT_PT_Conversion": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[2].id, None),
        "Publication_Verification": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[3].id, None),
        "Thesis_Submission": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[3].id, None),
        "Thesis_Evaluation": (CategoryRoutingType.GRIEVANCE_CLUSTER, gc_by_num[3].id, None),
        "Viva": (CategoryRoutingType.SUBJECT_ASSISTANT_DEAN, None, None),
        "Fee": (CategoryRoutingType.SUBJECT_ASSISTANT_DEAN, None, None),
        "Portal_Data_Correction": (CategoryRoutingType.SUBJECT_ASSISTANT_DEAN, None, None),
        "Other": (CategoryRoutingType.SUBJECT_ASSISTANT_DEAN, None, None),
    }

    cat_map = {c.name: c for c in cats}

    for name, (expected_type, expected_gc_id, expected_fixed) in expected_routing.items():
        cat = cat_map[name]
        assert cat.routing_type == expected_type
        assert cat.grievance_cluster_id == expected_gc_id
        assert cat.fixed_authority_id == expected_fixed

    # Fellowship -> Dr. Dipesh Kumar Verma (assistantdean4)
    fellowship = cat_map["Fellowship"]
    assert fellowship.routing_type == CategoryRoutingType.FIXED_AUTHORITY
    assert fellowship.grievance_cluster_id is None
    fellowship_auth = db_session.scalar(select(NivaranAuthority).where(NivaranAuthority.id == fellowship.fixed_authority_id))
    assert fellowship_auth is not None
    assert fellowship_auth.email_snapshot == "assistantdean4@csjmu.ac.in"

    # RTI_IIGRS -> Dr. Samiuddin (assistantdean11)
    rti = cat_map["RTI_IIGRS"]
    assert rti.routing_type == CategoryRoutingType.FIXED_AUTHORITY
    assert rti.grievance_cluster_id is None
    rti_auth = db_session.scalar(select(NivaranAuthority).where(NivaranAuthority.id == rti.fixed_authority_id))
    assert rti_auth is not None
    assert rti_auth.email_snapshot == "assistantdean11@csjmu.ac.in"


def test_06_zero_residue_and_orphan_fks(db_session: Session):
    """Verify zero test authorities, zero test clusters, zero test categories remain."""
    auth_count = db_session.scalar(select(func.count(NivaranAuthority.id)))
    assert auth_count == 15

    gc_count = db_session.scalar(select(func.count(GrievanceCluster.id)))
    assert gc_count == 3

    cat_count = db_session.scalar(select(func.count(Category.id)))
    assert cat_count == 16

    sc_count = db_session.scalar(select(func.count(SubjectCluster.id)))
    assert sc_count == 10

    subj_count = db_session.scalar(select(func.count(Subject.id)))
    assert subj_count == 56


def test_07_admin_summary_api_matches_canonical_state(admin_token: str):
    """Verify Admin Summary API endpoint returns exact canonical metrics."""
    headers = {"Authorization": f"Bearer {admin_token}"}
    res = client.get("/api/admin/atharva/summary", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]

    assert data["total_authorities"] == 15
    assert data["active_authorities"] == 15
    assert data["total_subject_clusters"] == 10
    assert data["active_subject_clusters"] == 10
    assert data["total_subjects"] == 56
    assert data["active_subjects"] == 56
    assert data["total_grievance_clusters"] == 3
    assert data["active_grievance_clusters"] == 3
    assert data["total_categories"] == 16
    assert data["active_categories"] == 16

    assert data["role_counts"] == {
        "ASSISTANT_DEAN": 10,
        "ASSOCIATE_DEAN": 3,
        "DEAN": 1,
        "MANAGER": 1,
    }
    assert data["categories_by_routing_type"] == {
        "FIXED_AUTHORITY": 2,
        "GRIEVANCE_CLUSTER": 10,
        "SUBJECT_ASSISTANT_DEAN": 4,
    }
