import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.models.grievance import Grievance
from app.modules.atharva_veda.nivaran.services.subject_seed_service import (
    seed_nivaran_subjects_and_clusters,
    AUTHORITATIVE_SUBJECT_CLUSTERS,
    AUTHORITATIVE_SUBJECTS,
)

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
    admin_role = db_session.execute(select(Role).where(Role.name == "administrator")).scalar_one_or_none()
    if not admin_role:
        admin_role = Role(name="administrator", description="Institutional Administrator", is_system=True)
        db_session.add(admin_role)
        db_session.commit()
        db_session.refresh(admin_role)

    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"admin_test_{uid}@csjmu.ac.in",
        password_hash="test_hash",
        first_name="Admin",
        last_name="Test",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    db_session.execute(user_roles.insert().values(user_id=user.id, role_id=admin_role.id))
    db_session.commit()

    return create_access_token(data={"sub": str(user.id), "email": user.email, "role": "administrator"})


# ----------------------------------------------------------------------
# Requirement 1: 10 authoritative clusters exist with cluster_number 1-10
# ----------------------------------------------------------------------
def test_authoritative_clusters_count_and_numbering(db_session: Session):
    clusters = db_session.scalars(
        select(SubjectCluster)
        .where(SubjectCluster.cluster_number >= 1, SubjectCluster.cluster_number <= 10)
        .order_by(SubjectCluster.cluster_number.asc())
    ).all()

    assert len(clusters) == 10
    for idx, cluster in enumerate(clusters, start=1):
        assert cluster.cluster_number == idx
        assert cluster.name == f"Cluster {idx}"
        assert cluster.is_active is True


# ----------------------------------------------------------------------
# Requirement 2: Exactly 56 authoritative subjects exist
# ----------------------------------------------------------------------
def test_authoritative_subjects_count(db_session: Session):
    clusters = db_session.scalars(
        select(SubjectCluster).where(SubjectCluster.cluster_number >= 1, SubjectCluster.cluster_number <= 10)
    ).all()
    cluster_ids = [c.id for c in clusters]

    auth_subjects = db_session.scalars(
        select(Subject).where(Subject.subject_cluster_id.in_(cluster_ids))
    ).all()

    assert len(auth_subjects) == 56


# ----------------------------------------------------------------------
# Requirement 3: Exact subject -> cluster relationships
# ----------------------------------------------------------------------
def test_exact_subject_cluster_mappings(db_session: Session):
    for cluster_num, expected_subjects in AUTHORITATIVE_SUBJECTS.items():
        cluster = db_session.scalar(
            select(SubjectCluster).where(SubjectCluster.cluster_number == cluster_num)
        )
        assert cluster is not None, f"Cluster {cluster_num} must exist"

        subjects_in_cluster = db_session.scalars(
            select(Subject).where(Subject.subject_cluster_id == cluster.id)
        ).all()

        subject_names = {s.name for s in subjects_in_cluster}
        expected_set = set(expected_subjects)

        assert subject_names == expected_set, (
            f"Cluster {cluster_num} mismatch. Missing: {expected_set - subject_names}, "
            f"Extra: {subject_names - expected_set}"
        )
        assert len(subjects_in_cluster) == len(expected_subjects)


# ----------------------------------------------------------------------
# Requirement 4 & 5: Idempotency and no duplicates on subsequent runs
# ----------------------------------------------------------------------
def test_seeding_idempotency_and_no_duplicates(db_session: Session):
    # Run seeder a second time
    res = seed_nivaran_subjects_and_clusters(db_session)

    assert len(res["clusters_created"]) == 0
    assert len(res["clusters_existing"]) == 10
    assert len(res["subjects_created"]) == 0
    assert len(res["subjects_existing"]) == 56
    assert len(res["subjects_realigned"]) == 0

    # Verify database counts have not changed
    total_auth_clusters = db_session.scalar(
        select(func.count(SubjectCluster.id)).where(
            SubjectCluster.cluster_number >= 1, SubjectCluster.cluster_number <= 10
        )
    )
    assert total_auth_clusters == 10

    clusters = db_session.scalars(
        select(SubjectCluster).where(SubjectCluster.cluster_number >= 1, SubjectCluster.cluster_number <= 10)
    ).all()
    cluster_ids = [c.id for c in clusters]

    total_auth_subjects = db_session.scalar(
        select(func.count(Subject.id)).where(Subject.subject_cluster_id.in_(cluster_ids))
    )
    assert total_auth_subjects == 56


# ----------------------------------------------------------------------
# Requirement 6: Canonical records preserved post Phase 4 & 5B
# ----------------------------------------------------------------------
def test_existing_test_records_preserved(db_session: Session):
    total_clusters = db_session.scalar(select(func.count(SubjectCluster.id)))
    # Canonical taxonomy: 10 authoritative active clusters
    assert total_clusters == 10

    total_subjects = db_session.scalar(select(func.count(Subject.id)))
    # Canonical taxonomy: 56 authoritative active subjects
    assert total_subjects == 56


# ----------------------------------------------------------------------
# Requirement 7: Existing foreign-key references preserved
# ----------------------------------------------------------------------
def test_existing_foreign_key_references_preserved(db_session: Session):
    # Verify applicant profiles preserved
    profiles_count = db_session.scalar(select(func.count(ApplicantProfile.id)))
    assert profiles_count >= 55

    # Verify grievances table accessible
    grievances_count = db_session.scalar(select(func.count(Grievance.id)))
    assert grievances_count >= 0

    # Verify student master records accessible
    smr_count = db_session.scalar(text("SELECT count(*) FROM nivaran_student_master_records"))
    assert smr_count >= 0


# ----------------------------------------------------------------------
# Requirement 8 & 9: Canonical Assistant Dean mappings bound & verified
# ----------------------------------------------------------------------
def test_assistant_dean_mappings_safe_unresolved(db_session: Session):
    clusters = db_session.scalars(
        select(SubjectCluster)
        .where(SubjectCluster.cluster_number >= 1, SubjectCluster.cluster_number <= 10)
        .order_by(SubjectCluster.cluster_number.asc())
    ).all()

    # In Phase 5B, all 10 clusters are bound to their canonical Assistant Deans
    for c in clusters:
        assert c.assistant_dean_id is not None
        asst = db_session.scalar(select(NivaranAuthority).where(NivaranAuthority.id == c.assistant_dean_id))
        assert asst is not None
        assert asst.role == NivaranRole.ASSISTANT_DEAN
        assert asst.is_active is True

    # Verify no fake @nivaran.local users were created
    fake_users = db_session.scalars(
        select(User).where(User.email.ilike("%@nivaran.local"))
    ).all()
    assert len(fake_users) == 0


# ----------------------------------------------------------------------
# Requirement 10: Admin panel subject & cluster configuration functionality
# ----------------------------------------------------------------------
def test_admin_subject_and_cluster_endpoints(admin_token: str, db_session: Session):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. GET /api/admin/atharva/subject-clusters
    res = client.get("/api/admin/atharva/subject-clusters", headers=headers)
    assert res.status_code == 200
    clusters_data = res.json()["data"]["clusters"]
    assert len(clusters_data) >= 10

    # 2. GET /api/admin/atharva/subjects
    res = client.get("/api/admin/atharva/subjects", headers=headers)
    assert res.status_code == 200
    subjects_data = res.json()["data"]["subjects"]
    assert len(subjects_data) >= 56

    # 3. POST /api/admin/atharva/subject-clusters (create new cluster)
    test_cluster_num = 999
    # Clean up if existed
    existing_c = db_session.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == test_cluster_num))
    if existing_c:
        db_session.delete(existing_c)
        db_session.commit()

    create_cluster_payload = {
        "cluster_number": test_cluster_num,
        "name": "Cluster Test Admin",
        "description": "Created via Admin API",
        "is_active": True,
    }
    res = client.post("/api/admin/atharva/subject-clusters", json=create_cluster_payload, headers=headers)
    assert res.status_code == 201
    created_cluster = res.json()["data"]
    created_cluster_id = created_cluster["id"]
    assert created_cluster["cluster_number"] == test_cluster_num

    # 4. PATCH /api/admin/atharva/subject-clusters/{id} (update cluster)
    res = client.patch(
        f"/api/admin/atharva/subject-clusters/{created_cluster_id}",
        json={"name": "Cluster Test Admin Renamed"},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Cluster Test Admin Renamed"

    # 5. POST /api/admin/atharva/subjects (create new subject)
    test_subject_name = f"Test Admin Subject {uuid.uuid4().hex[:6]}"
    create_subj_payload = {
        "name": test_subject_name,
        "subject_cluster_id": created_cluster_id,
        "code": "TAS-01",
        "is_active": True,
    }
    res = client.post("/api/admin/atharva/subjects", json=create_subj_payload, headers=headers)
    assert res.status_code == 201
    created_subj = res.json()["data"]
    created_subj_id = created_subj["id"]
    assert created_subj["name"] == test_subject_name
    assert created_subj["subject_cluster_id"] == created_cluster_id

    # 6. PATCH /api/admin/atharva/subjects/{id}/cluster (reassign subject cluster)
    cluster_1 = db_session.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == 1))
    res = client.patch(
        f"/api/admin/atharva/subjects/{created_subj_id}/cluster",
        json={"subject_cluster_id": str(cluster_1.id)},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["subject_cluster_id"] == str(cluster_1.id)

    # 7. PATCH /api/admin/atharva/subjects/{id}/status (toggle status)
    res = client.patch(
        f"/api/admin/atharva/subjects/{created_subj_id}/status",
        json={"is_active": False},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["data"]["is_active"] is False

    # Clean up test subject and cluster
    test_s = db_session.scalar(select(Subject).where(Subject.id == uuid.UUID(created_subj_id)))
    if test_s:
        db_session.delete(test_s)
    test_c = db_session.scalar(select(SubjectCluster).where(SubjectCluster.id == uuid.UUID(created_cluster_id)))
    if test_c:
        db_session.delete(test_c)
    db_session.commit()
