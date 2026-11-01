"""
Database-Free Tests for Subject Management in VYASA Super Admin Panel.
Tests AdminConfigService subject methods and Atharva Admin subject API routes:
- GET /api/admin/atharva/subjects (listing, search, cluster filter, status filter)
- POST /api/admin/atharva/subjects (creation, validation, duplicate prevention)
- PATCH /api/admin/atharva/subjects/{id} (updating name, code, cluster)
- PATCH /api/admin/atharva/subjects/{id}/status (activating/deactivating)
- PATCH /api/admin/atharva/subjects/{id}/cluster (re-mapping faculty cluster)
- DELETE /api/admin/atharva/subjects/{id} (unreferenced deletion, dependency conflicts)
- Authorization enforcement (401/403 for unauthenticated or non-admin users)
"""

import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.api.dependencies import require_super_admin_user, get_db
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject
from app.modules.atharva_veda.nivaran.services.admin_config_service import AdminConfigService


@pytest.fixture
def mock_admin_client():
    mock_admin = User(
        id=uuid.uuid4(),
        email="superadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
    )
    mock_db = MagicMock()

    app.dependency_overrides[require_super_admin_user] = lambda: mock_admin
    app.dependency_overrides[get_db] = lambda: mock_db

    client = TestClient(app)
    yield client, mock_db

    app.dependency_overrides.clear()


def make_subject(
    name: str = "Computer Science & Engineering",
    code: str = "CSE-101",
    is_active: bool = True,
    cluster_name: str = "Engineering & Technology",
    cluster_number: int = 1,
):
    sc_id = uuid.uuid4()
    sc = SubjectCluster(
        id=sc_id,
        cluster_number=cluster_number,
        name=cluster_name,
        is_active=True,
    )
    now = datetime.now(timezone.utc)
    s = Subject(
        id=uuid.uuid4(),
        name=name,
        code=code,
        subject_cluster_id=sc_id,
        is_active=is_active,
        created_at=now,
        updated_at=now,
    )
    s.cluster = sc
    return s


# =========================================================================
# 1. LIST SUBJECTS API
# =========================================================================

def test_api_list_subjects(mock_admin_client):
    client, mock_db = mock_admin_client
    s1 = make_subject("Artificial Intelligence", "AI-01")
    s2 = make_subject("Data Science", "DS-02")

    mock_execute = MagicMock()
    mock_execute.scalars.return_value.all.return_value = [s1, s2]
    mock_db.execute.return_value = mock_execute

    resp = client.get("/api/admin/atharva/subjects")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["data"]["subjects"]) == 2
    assert data["data"]["subjects"][0]["name"] == "Artificial Intelligence"
    assert data["data"]["subjects"][0]["code"] == "AI-01"
    assert data["data"]["subjects"][1]["name"] == "Data Science"


def test_api_list_subjects_with_filters(mock_admin_client):
    client, mock_db = mock_admin_client
    s1 = make_subject("Cyber Security", "CS-03", is_active=True)

    mock_execute = MagicMock()
    mock_execute.scalars.return_value.all.return_value = [s1]
    mock_db.execute.return_value = mock_execute

    cluster_id = uuid.uuid4()
    resp = client.get(
        f"/api/admin/atharva/subjects?subject_cluster_id={cluster_id}&is_active=true&search=Cyber"
    )
    assert resp.status_code == 200
    assert len(resp.json()["data"]["subjects"]) == 1
    assert resp.json()["data"]["subjects"][0]["name"] == "Cyber Security"


# =========================================================================
# 2. CREATE SUBJECT API
# =========================================================================

def test_api_create_subject_success(mock_admin_client):
    client, mock_db = mock_admin_client
    now = datetime.now(timezone.utc)
    cluster_id = uuid.uuid4()

    with patch.object(AdminConfigService, "create_subject") as mock_create:
        mock_subject = Subject(
            id=uuid.uuid4(),
            name="Robotics & Automation",
            code="ROB-201",
            subject_cluster_id=cluster_id,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        mock_subject.cluster = SubjectCluster(
            id=cluster_id,
            cluster_number=2,
            name="Mechanical Sciences",
            is_active=True,
        )
        mock_create.return_value = mock_subject

        resp = client.post(
            "/api/admin/atharva/subjects",
            json={
                "name": "Robotics & Automation",
                "code": "ROB-201",
                "subject_cluster_id": str(cluster_id),
                "is_active": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["name"] == "Robotics & Automation"
        assert data["code"] == "ROB-201"
        assert data["cluster_name"] == "Mechanical Sciences"
        assert data["cluster_number"] == 2


def test_api_create_subject_duplicate_name_rejected(mock_admin_client):
    client, mock_db = mock_admin_client
    cluster_id = uuid.uuid4()

    with patch.object(AdminConfigService, "create_subject") as mock_create:
        mock_create.side_effect = ValueError("Subject with name 'Physics' already exists.")

        resp = client.post(
            "/api/admin/atharva/subjects",
            json={
                "name": "Physics",
                "code": "PHY-101",
                "subject_cluster_id": str(cluster_id),
            },
        )
        assert resp.status_code == 400
        assert "already exists" in resp.json()["message"]


def test_api_create_subject_inactive_cluster_rejected(mock_admin_client):
    client, mock_db = mock_admin_client
    cluster_id = uuid.uuid4()

    with patch.object(AdminConfigService, "create_subject") as mock_create:
        mock_create.side_effect = ValueError("SubjectCluster 'Discontinued Cluster' is inactive.")

        resp = client.post(
            "/api/admin/atharva/subjects",
            json={
                "name": "Old Studies",
                "code": "OLD-001",
                "subject_cluster_id": str(cluster_id),
            },
        )
        assert resp.status_code == 400
        assert "is inactive" in resp.json()["message"]


# =========================================================================
# 3. UPDATE SUBJECT API
# =========================================================================

def test_api_update_subject_success(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()
    cluster_id = uuid.uuid4()
    now = datetime.now(timezone.utc)

    with patch.object(AdminConfigService, "update_subject") as mock_update:
        mock_subject = Subject(
            id=subject_id,
            name="Quantum Computing",
            code="QC-901",
            subject_cluster_id=cluster_id,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        mock_subject.cluster = SubjectCluster(
            id=cluster_id,
            cluster_number=1,
            name="Physical Sciences",
            is_active=True,
        )
        mock_update.return_value = mock_subject

        resp = client.patch(
            f"/api/admin/atharva/subjects/{subject_id}",
            json={
                "name": "Quantum Computing",
                "code": "QC-901",
            },
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["name"] == "Quantum Computing"
        assert data["code"] == "QC-901"


def test_api_update_subject_not_found(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "update_subject") as mock_update:
        mock_update.side_effect = ValueError(f"Subject '{subject_id}' not found.")

        resp = client.patch(
            f"/api/admin/atharva/subjects/{subject_id}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 404
        assert "not found" in resp.json()["message"].lower()


# =========================================================================
# 4. UPDATE SUBJECT STATUS API (ACTIVATE / DEACTIVATE)
# =========================================================================

def test_api_update_subject_status(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "set_subject_active_status") as mock_status:
        mock_subject = Subject(
            id=subject_id,
            name="Bioinformatics",
            code="BIO-301",
            subject_cluster_id=uuid.uuid4(),
            is_active=False,
        )
        mock_status.return_value = mock_subject

        resp = client.patch(
            f"/api/admin/atharva/subjects/{subject_id}/status",
            json={"is_active": False},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["is_active"] is False


# =========================================================================
# 5. RE-MAP SUBJECT CLUSTER API
# =========================================================================

def test_api_update_subject_cluster_mapping(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()
    new_cluster_id = uuid.uuid4()

    with patch.object(AdminConfigService, "update_subject_mapping") as mock_map:
        mock_subject = Subject(
            id=subject_id,
            name="Biochemistry",
            code="BCH-101",
            subject_cluster_id=new_cluster_id,
            is_active=True,
        )
        mock_map.return_value = mock_subject

        resp = client.patch(
            f"/api/admin/atharva/subjects/{subject_id}/cluster",
            json={"subject_cluster_id": str(new_cluster_id)},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["subject_cluster_id"] == str(new_cluster_id)


# =========================================================================
# 6. DELETE SUBJECT API & CONFLICT PREVENTIONS
# =========================================================================

def test_api_delete_subject_success(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "delete_subject") as mock_delete:
        mock_delete.return_value = True

        resp = client.delete(f"/api/admin/atharva/subjects/{subject_id}")
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        assert resp.json()["data"]["id"] == str(subject_id)


def test_api_delete_subject_not_found(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "delete_subject") as mock_delete:
        mock_delete.side_effect = ValueError(f"Subject '{subject_id}' not found.")

        resp = client.delete(f"/api/admin/atharva/subjects/{subject_id}")
        assert resp.status_code == 404
        assert "not found" in resp.json()["message"].lower()


def test_api_delete_subject_conflict_applicant_profiles(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "delete_subject") as mock_delete:
        mock_delete.side_effect = ValueError(
            "Cannot delete subject 'Mathematics': referenced by 4 scholar applicant profile(s). Deactivate instead to preserve historical records."
        )

        resp = client.delete(f"/api/admin/atharva/subjects/{subject_id}")
        assert resp.status_code == 409
        assert "4 scholar applicant profile(s)" in resp.json()["message"]


def test_api_delete_subject_conflict_student_master_records(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "delete_subject") as mock_delete:
        mock_delete.side_effect = ValueError(
            "Cannot delete subject 'Civil Engineering': referenced by 2 student master record(s). Deactivate instead to preserve historical records."
        )

        resp = client.delete(f"/api/admin/atharva/subjects/{subject_id}")
        assert resp.status_code == 409
        assert "2 student master record(s)" in resp.json()["message"]


def test_api_delete_subject_conflict_grievance_cases(mock_admin_client):
    client, mock_db = mock_admin_client
    subject_id = uuid.uuid4()

    with patch.object(AdminConfigService, "delete_subject") as mock_delete:
        mock_delete.side_effect = ValueError(
            "Cannot delete subject 'Law': referenced by 3 historical grievance case(s). Deactivate instead to preserve historical records."
        )

        resp = client.delete(f"/api/admin/atharva/subjects/{subject_id}")
        assert resp.status_code == 409
        assert "3 historical grievance case(s)" in resp.json()["message"]


# =========================================================================
# 7. AUTHENTICATION & SUPER ADMIN AUTHORIZATION
# =========================================================================

def test_api_subjects_unauthenticated_rejected():
    # Fresh client without dependency overrides
    client = TestClient(app)
    resp = client.get("/api/admin/atharva/subjects")
    assert resp.status_code == 401

    resp_post = client.post("/api/admin/atharva/subjects", json={})
    assert resp_post.status_code == 401


def test_api_subjects_non_admin_forbidden():
    from fastapi import HTTPException, status

    def mock_applicant():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to institutional administrators (Super Admin).",
        )

    app.dependency_overrides[require_super_admin_user] = mock_applicant
    client = TestClient(app)

    resp = client.get("/api/admin/atharva/subjects")
    assert resp.status_code == 403
    assert "Access restricted" in resp.json()["message"]

    app.dependency_overrides.clear()
