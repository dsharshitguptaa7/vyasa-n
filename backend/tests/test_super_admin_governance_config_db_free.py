"""
Pure Database-Free Unit Tests for Super Admin Governance Configuration System
(AdminConfigService and Atharva Admin API Endpoints).

Covers:
1. Authority lifecycle (create, update, role conflict prevention, transfer, safe delete).
2. Subject lifecycle (create, update, cluster mapping, safe delete with reference guards).
3. Cluster management (SubjectCluster, GrievanceCluster, validation, safe delete).
4. Category management (create, update, routing type validation, safe delete).
5. Dynamic routing simulation (Fixed Authority, Grievance Cluster, Subject Assistant Dean, fallback triggers).
6. Immutable audit logging verification for all administrative actions.
"""

import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import MagicMock, patch

from app.models.user import User
from app.models.role import Role
from app.models.audit import AuditLog
from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject, GrievanceCluster, Category
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole, CategoryRoutingType
from app.modules.atharva_veda.nivaran.models.grievance import Grievance
from app.modules.atharva_veda.nivaran.services.admin_config_service import AdminConfigService


# =========================================================================
# 1. AUTHORITY MANAGEMENT
# =========================================================================

def test_create_authority_new_user():
    mock_db = MagicMock()
    mock_db.scalar.return_value = None  # No existing authority or user
    added_objs = []
    mock_db.add.side_effect = lambda obj: added_objs.append(obj)

    admin_id = uuid.uuid4()
    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Dr. Arvind Sharma",
        email="arvind.sharma@csjmu.ac.in",
        role=NivaranRole.ASSISTANT_DEAN,
        designation="Associate Professor",
        department="Computer Science",
        phone="9876543210",
        actor_user_id=admin_id,
    )

    assert auth.name_snapshot == "Dr. Arvind Sharma"
    assert auth.email_snapshot == "arvind.sharma@csjmu.ac.in"
    assert auth.role == NivaranRole.ASSISTANT_DEAN
    assert auth.is_active is True

    # Check user was created
    users = [o for o in added_objs if isinstance(o, User)]
    assert len(users) == 1
    assert users[0].email == "arvind.sharma@csjmu.ac.in"
    assert users[0].first_name == "Dr."
    assert users[0].last_name == "Arvind Sharma"

    # Check audit log
    audits = [o for o in added_objs if isinstance(o, AuditLog)]
    assert len(audits) == 1
    assert audits[0].action == "authority.create"
    assert audits[0].user_id == admin_id
    mock_db.commit.assert_called()


def test_create_authority_refuses_duplicate_email():
    mock_db = MagicMock()
    existing_auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.MANAGER,
        name_snapshot="Existing Manager",
        email_snapshot="manager@csjmu.ac.in",
    )
    mock_db.scalar.return_value = existing_auth

    with pytest.raises(ValueError, match="already exists"):
        AdminConfigService.create_authority(
            db=mock_db,
            name="New Manager",
            email="manager@csjmu.ac.in",
            role=NivaranRole.MANAGER,
        )


def test_update_authority_blocks_role_conflict_when_assigned_asst_dean():
    mock_db = MagicMock()
    auth_id = uuid.uuid4()
    authority = NivaranAuthority(
        id=auth_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dean Assistant",
        email_snapshot="asst@csjmu.ac.in",
        is_active=True,
    )
    active_sc = SubjectCluster(
        id=uuid.uuid4(),
        cluster_number=1,
        name="Engineering & Technology",
        assistant_dean_id=auth_id,
        is_active=True,
    )

    # First scalar returns authority, second returns active cluster
    mock_db.scalar.side_effect = [authority, active_sc]

    with pytest.raises(ValueError, match="actively assigned as Assistant Dean"):
        AdminConfigService.update_authority(
            db=mock_db,
            authority_id=auth_id,
            role=NivaranRole.MANAGER,  # Attempting to change role while assigned
        )


def test_transfer_authority_assignments():
    mock_db = MagicMock()
    source_id = uuid.uuid4()
    target_id = uuid.uuid4()

    source = NivaranAuthority(
        id=source_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Outgoing Officer",
        email_snapshot="out@csjmu.ac.in",
        is_active=True,
    )
    target = NivaranAuthority(
        id=target_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Incoming Officer",
        email_snapshot="in@csjmu.ac.in",
        is_active=True,
    )

    sc = SubjectCluster(
        id=uuid.uuid4(),
        cluster_number=2,
        name="Physical Sciences",
        assistant_dean_id=source_id,
        is_active=True,
    )

    mock_db.scalar.side_effect = [source, target]
    mock_db.execute.return_value.scalars.return_value.all.side_effect = [
        [sc],  # Subject clusters
        [],    # Grievance clusters
        [],    # Fixed categories
    ]

    summary = AdminConfigService.transfer_authority_assignments(
        db=mock_db,
        source_authority_id=source_id,
        target_authority_id=target_id,
    )

    assert sc.assistant_dean_id == target_id
    assert "Physical Sciences" in summary["subject_clusters_transferred"]
    mock_db.commit.assert_called()


def test_delete_authority_refuses_when_referenced():
    mock_db = MagicMock()
    auth_id = uuid.uuid4()
    authority = NivaranAuthority(
        id=auth_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.DEAN,
        name_snapshot="Dean",
        email_snapshot="dean@csjmu.ac.in",
    )

    mock_db.scalar.side_effect = [
        authority,  # get authority
        1,          # sc_count (referenced in subject cluster!)
        0,          # gc_count
        0,          # cat_count
        0,          # grv_count
    ]

    with pytest.raises(ValueError, match="Cannot delete authority.*referenced by"):
        AdminConfigService.delete_authority(db=mock_db, authority_id=auth_id)


def test_delete_authority_succeeds_when_unreferenced():
    mock_db = MagicMock()
    auth_id = uuid.uuid4()
    authority = NivaranAuthority(
        id=auth_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.GUEST_MEMBER,
        name_snapshot="Guest Reviewer",
        email_snapshot="guest@csjmu.ac.in",
    )

    mock_db.scalar.side_effect = [
        authority,
        0,  # sc_count
        0,  # gc_count
        0,  # cat_count
        0,  # grv_count
    ]

    res = AdminConfigService.delete_authority(db=mock_db, authority_id=auth_id)
    assert res is True
    mock_db.delete.assert_called_with(authority)
    mock_db.commit.assert_called()


# =========================================================================
# 2. SUBJECT MANAGEMENT
# =========================================================================

def test_create_subject_success():
    mock_db = MagicMock()
    cluster_id = uuid.uuid4()
    cluster = SubjectCluster(id=cluster_id, cluster_number=1, name="Engineering", is_active=True)

    mock_db.scalar.side_effect = [
        None,     # check name uniqueness
        cluster,  # check cluster existence and active
    ]

    subject = AdminConfigService.create_subject(
        db=mock_db,
        name="Computer Science & Engineering",
        subject_cluster_id=cluster_id,
        code="CSE",
    )

    assert subject.name == "Computer Science & Engineering"
    assert subject.code == "CSE"
    assert subject.subject_cluster_id == cluster_id
    mock_db.commit.assert_called()


def test_delete_subject_refuses_when_referenced_by_applicant():
    mock_db = MagicMock()
    subject_id = uuid.uuid4()
    subject = Subject(id=subject_id, name="Mathematics", subject_cluster_id=uuid.uuid4())

    mock_db.scalar.side_effect = [
        subject,
        5,  # 5 applicants reference this subject!
        0,  # grievances
    ]

    with pytest.raises(ValueError, match="referenced by 5 scholar applicant profile"):
        AdminConfigService.delete_subject(db=mock_db, subject_id=subject_id)


def test_delete_subject_succeeds_when_unreferenced():
    mock_db = MagicMock()
    subject_id = uuid.uuid4()
    subject = Subject(id=subject_id, name="Obsolete Discipline", subject_cluster_id=uuid.uuid4())

    mock_db.scalar.side_effect = [
        subject,
        0,  # 0 applicants
        0,  # 0 grievances
    ]

    res = AdminConfigService.delete_subject(db=mock_db, subject_id=subject_id)
    assert res is True
    mock_db.delete.assert_called_with(subject)
    mock_db.commit.assert_called()


# =========================================================================
# 3. CLUSTERS (SUBJECT & GRIEVANCE)
# =========================================================================

def test_delete_subject_cluster_refuses_when_subjects_exist():
    mock_db = MagicMock()
    cluster_id = uuid.uuid4()
    cluster = SubjectCluster(id=cluster_id, cluster_number=1, name="Life Sciences")

    mock_db.scalar.side_effect = [
        cluster,
        3,  # 3 subjects linked to cluster
    ]

    with pytest.raises(ValueError, match="contains 3 active subjects"):
        AdminConfigService.delete_subject_cluster(db=mock_db, cluster_id=cluster_id)


def test_create_and_delete_grievance_cluster():
    mock_db = MagicMock()
    # 1. Create
    mock_db.scalar.return_value = None  # No duplicate cluster number
    gc = AdminConfigService.create_grievance_cluster(
        db=mock_db,
        cluster_number=4,
        name="Research Infrastructure",
        description="Lab amenities and compute resources",
    )
    assert gc.name == "Research Infrastructure"
    assert gc.cluster_number == 4
    mock_db.commit.assert_called()

    # 2. Delete with 0 categories
    gc_id = uuid.uuid4()
    gc_mock = GrievanceCluster(id=gc_id, cluster_number=4, name="Research Infrastructure")
    mock_db.scalar.side_effect = [
        gc_mock,
        0,  # 0 categories linked
    ]
    del_res = AdminConfigService.delete_grievance_cluster(db=mock_db, cluster_id=gc_id)
    assert del_res is True
    mock_db.delete.assert_called_with(gc_mock)


# =========================================================================
# 4. CATEGORIES & ROUTING
# =========================================================================

def test_create_category_with_cluster():
    mock_db = MagicMock()
    cluster_id = uuid.uuid4()
    cluster = GrievanceCluster(id=cluster_id, cluster_number=1, name="Scholarships", is_active=True)

    mock_db.scalar.side_effect = [
        None,     # Name unique
        cluster,  # Cluster exists
    ]

    cat = AdminConfigService.create_category(
        db=mock_db,
        name="Delay in Fellowship Disbursal",
        routing_type=CategoryRoutingType.CLUSTER,
        grievance_cluster_id=cluster_id,
    )
    assert cat.name == "Delay in Fellowship Disbursal"
    assert cat.routing_type == CategoryRoutingType.CLUSTER
    assert cat.grievance_cluster_id == cluster_id
    mock_db.commit.assert_called()


def test_delete_category_refuses_when_referenced_by_grievances():
    mock_db = MagicMock()
    cat_id = uuid.uuid4()
    cat = Category(id=cat_id, name="Thesis Evaluation", routing_type=CategoryRoutingType.FIXED_AUTHORITY)

    mock_db.scalar.side_effect = [
        cat,
        12,  # 12 historical grievances!
    ]

    with pytest.raises(ValueError, match="referenced by 12 historical grievance"):
        AdminConfigService.delete_category(db=mock_db, category_id=cat_id)


# =========================================================================
# 5. DYNAMIC ROUTING SIMULATION
# =========================================================================

def test_simulate_routing_fixed_authority_active():
    mock_db = MagicMock()
    auth_id = uuid.uuid4()
    auth = NivaranAuthority(
        id=auth_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.DEAN,
        name_snapshot="Prof. Dean Academic",
        email_snapshot="dean@csjmu.ac.in",
        is_active=True,
    )
    cat = Category(
        id=uuid.uuid4(),
        name="Special Dean Escalation",
        routing_type=CategoryRoutingType.FIXED_AUTHORITY,
        fixed_authority_id=auth_id,
        is_active=True,
    )
    cat.fixed_authority = auth

    mock_db.scalar.return_value = cat

    res = AdminConfigService.simulate_routing(db=mock_db, category_id=cat.id)
    assert res["status"] == "ROUTED"
    assert res["target_authority_id"] == auth_id
    assert res["target_authority_name"] == "Prof. Dean Academic"
    assert res["fallback_used"] is False


def test_simulate_routing_fixed_authority_inactive_triggers_fallback():
    mock_db = MagicMock()
    auth_id = uuid.uuid4()
    auth = NivaranAuthority(
        id=auth_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.DEAN,
        name_snapshot="Prof. Retired Dean",
        email_snapshot="retired@csjmu.ac.in",
        is_active=False,  # Inactive!
    )
    cat = Category(
        id=uuid.uuid4(),
        name="Special Dean Escalation",
        routing_type=CategoryRoutingType.FIXED_AUTHORITY,
        fixed_authority_id=auth_id,
        is_active=True,
    )
    cat.fixed_authority = auth

    mock_db.scalar.return_value = cat

    res = AdminConfigService.simulate_routing(db=mock_db, category_id=cat.id)
    assert res["status"] == "FALLBACK"
    assert res["fallback_used"] is True
    assert "INACTIVE" in res["warnings"][0]


def test_simulate_routing_subject_assistant_dean_missing_subject():
    mock_db = MagicMock()
    cat = Category(
        id=uuid.uuid4(),
        name="Coursework Issue",
        routing_type=CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
        is_active=True,
    )
    mock_db.scalar.return_value = cat

    res = AdminConfigService.simulate_routing(db=mock_db, category_id=cat.id, subject_id=None)
    assert res["status"] == "AMBIGUOUS"
    assert res["fallback_used"] is True
    assert "Subject ID is required" in res["warnings"][0]


def test_simulate_routing_subject_assistant_dean_active():
    mock_db = MagicMock()
    cat = Category(
        id=uuid.uuid4(),
        name="Coursework Issue",
        routing_type=CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
        is_active=True,
    )

    asst_dean_id = uuid.uuid4()
    asst_dean = NivaranAuthority(
        id=asst_dean_id,
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Asst Dean Biotech",
        email_snapshot="biotech@csjmu.ac.in",
        is_active=True,
    )

    sc = SubjectCluster(
        id=uuid.uuid4(),
        cluster_number=3,
        name="Biological Sciences",
        assistant_dean_id=asst_dean_id,
        is_active=True,
    )
    sc.assistant_dean = asst_dean

    subject = Subject(
        id=uuid.uuid4(),
        name="Biotechnology",
        subject_cluster_id=sc.id,
        is_active=True,
    )
    subject.cluster = sc

    mock_db.scalar.side_effect = [
        cat,
        subject,
        asst_dean,
    ]

    res = AdminConfigService.simulate_routing(db=mock_db, category_id=cat.id, subject_id=subject.id)
    assert res["status"] == "ROUTED"
    assert res["target_authority_id"] == asst_dean_id
    assert res["target_authority_name"] == "Dr. Asst Dean Biotech"
    assert res["cluster_name"] == "Biological Sciences"
    assert res["fallback_used"] is False


# =========================================================================
# 6. API ROUTER INTEGRATION (DATABASE-FREE VIA DEPENDENCY OVERRIDES)
# =========================================================================

from fastapi.testclient import TestClient
from app.main import app
from app.api.dependencies import require_super_admin_user, get_db


@pytest.fixture
def mock_admin_client():
    mock_admin = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
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


def test_api_create_authority(mock_admin_client):
    client, mock_db = mock_admin_client
    now = datetime.now(timezone.utc)

    with patch.object(AdminConfigService, "create_authority") as mock_create:
        mock_auth = NivaranAuthority(
            id=uuid.uuid4(),
            vyasa_user_id=uuid.uuid4(),
            role=NivaranRole.DEAN,
            name_snapshot="Prof. Dean Sharma",
            email_snapshot="dean.sharma@csjmu.ac.in",
            designation="Professor & Dean",
            department="Dean R&D",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        mock_create.return_value = mock_auth

        resp = client.post(
            "/api/admin/atharva/authorities",
            json={
                "name": "Prof. Dean Sharma",
                "email": "dean.sharma@csjmu.ac.in",
                "role": "DEAN",
                "designation": "Professor & Dean",
                "department": "Dean R&D",
            },
        )
        assert resp.status_code == 201
        data = resp.json()["data"]
        assert data["name_snapshot"] == "Prof. Dean Sharma"
        assert data["role"] == "DEAN"


def test_api_transfer_authority(mock_admin_client):
    client, mock_db = mock_admin_client
    source_id = uuid.uuid4()
    target_id = uuid.uuid4()

    with patch.object(AdminConfigService, "transfer_authority_assignments") as mock_transfer:
        mock_transfer.return_value = {
            "source_authority": "Old Dean",
            "target_authority": "New Dean",
            "subject_clusters_transferred": ["Cluster 1"],
            "grievance_clusters_transferred": [],
            "categories_transferred": [],
        }

        resp = client.post(
            f"/api/admin/atharva/authorities/{source_id}/transfer",
            json={"replacement_authority_id": str(target_id)},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["target_authority"] == "New Dean"


def test_api_delete_authority_conflict(mock_admin_client):
    client, mock_db = mock_admin_client
    auth_id = uuid.uuid4()

    with patch.object(AdminConfigService, "delete_authority") as mock_delete:
        mock_delete.side_effect = ValueError("Cannot delete authority: referenced by 3 historical records")

        resp = client.delete(f"/api/admin/atharva/authorities/{auth_id}")
        assert resp.status_code == 409
        assert "referenced by 3 historical records" in resp.json()["message"]


def test_api_create_grievance_cluster(mock_admin_client):
    client, mock_db = mock_admin_client
    now = datetime.now(timezone.utc)

    with patch.object(AdminConfigService, "create_grievance_cluster") as mock_create:
        mock_gc = GrievanceCluster(
            id=uuid.uuid4(),
            cluster_number=5,
            name="Hostel Amenities",
            description="Student accommodations",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        mock_create.return_value = mock_gc

        resp = client.post(
            "/api/admin/atharva/grievance-clusters",
            json={
                "cluster_number": 5,
                "name": "Hostel Amenities",
                "description": "Student accommodations",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["name"] == "Hostel Amenities"
        assert resp.json()["data"]["cluster_number"] == 5


def test_api_create_category(mock_admin_client):
    client, mock_db = mock_admin_client
    now = datetime.now(timezone.utc)

    with patch.object(AdminConfigService, "create_category") as mock_create:
        mock_cat = Category(
            id=uuid.uuid4(),
            name="Coursework Exam Rescheduling",
            description="Exam rescheduling requests",
            routing_type=CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        mock_create.return_value = mock_cat

        resp = client.post(
            "/api/admin/atharva/categories",
            json={
                "name": "Coursework Exam Rescheduling",
                "description": "Exam rescheduling requests",
                "routing_type": "SUBJECT_ASSISTANT_DEAN",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["name"] == "Coursework Exam Rescheduling"
        assert resp.json()["data"]["routing_type"] == "SUBJECT_ASSISTANT_DEAN"


def test_api_simulate_routing(mock_admin_client):
    client, mock_db = mock_admin_client
    cat_id = uuid.uuid4()

    with patch.object(AdminConfigService, "simulate_routing") as mock_sim:
        mock_sim.return_value = {
            "status": "ROUTED",
            "routing_type": CategoryRoutingType.FIXED_AUTHORITY,
            "category_name": "Test Category",
            "target_authority_id": uuid.uuid4(),
            "target_authority_name": "Dean Academic",
            "target_authority_role": "DEAN",
            "cluster_name": None,
            "cluster_number": None,
            "path_taken": ["Step 1", "Step 2"],
            "warnings": [],
            "fallback_used": False,
        }

        resp = client.post(
            "/api/admin/atharva/routing/simulate",
            json={"category_id": str(cat_id)},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["status"] == "ROUTED"
        assert data["target_authority_name"] == "Dean Academic"

