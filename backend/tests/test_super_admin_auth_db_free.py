"""
Database-Free Unit Tests for Super Admin Authorization and Route Protection.

These tests run entirely in-memory with zero database dependencies, zero network
connections, and zero risk of connecting to any external environment.
"""

import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.user import User
from app.models.role import Role
from app.api.dependencies import (
    require_super_admin_user,
    require_admin_user,
    get_current_user,
    get_db,
)
from app.core.database import get_db as core_get_db


from datetime import datetime, timezone


def _make_dummy_user(role_names: list[str]) -> User:
    u = User(
        id=uuid.uuid4(),
        email=f"user_{'_'.join(role_names) or 'norole'}@csjmu.ac.in",
        first_name="Test",
        last_name="Subject",
        phone="+919876543210",
        is_active=True,
        is_verified=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    u.roles = [
        Role(
            id=uuid.uuid4(),
            name=rn,
            description=f"{rn} role",
            is_system=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            permissions=[],
        )
        for rn in role_names
    ]
    return u


# =========================================================================
# 1. Direct Dependency Unit Tests
# =========================================================================

def test_require_super_admin_user_success():
    super_admin_user = _make_dummy_user(["super_admin"])
    resolved = require_super_admin_user(current_user=super_admin_user)
    assert resolved == super_admin_user


@pytest.mark.parametrize("disallowed_roles", [
    ["administrator"],
    ["admin"],
    ["applicant"],
    ["manager"],
    ["assistant_dean"],
    ["associate_dean"],
    ["dean"],
    ["authority"],
    [],
    ["administrator", "manager"],
])
def test_require_super_admin_user_strictly_rejects_non_super_admins(disallowed_roles):
    user = _make_dummy_user(disallowed_roles)
    with pytest.raises(HTTPException) as exc_info:
        require_super_admin_user(current_user=user)
    assert exc_info.value.status_code == 403
    assert "Super Admin" in exc_info.value.detail


def test_require_admin_user_delegates_to_super_admin():
    # Legacy administrator must be rejected by require_admin_user
    legacy_admin = _make_dummy_user(["administrator"])
    with pytest.raises(HTTPException) as exc_info:
        require_admin_user(current_user=require_super_admin_user(legacy_admin))
    assert exc_info.value.status_code == 403

    # Only super_admin passes
    super_admin = _make_dummy_user(["super_admin"])
    assert require_admin_user(current_user=require_super_admin_user(super_admin)) == super_admin


# =========================================================================
# 2. Route Protection Unit Tests via TestClient with Overrides
# =========================================================================

@pytest.fixture
def mock_client():
    """Client configured with clean dependency overrides and no DB connection."""
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_admin_status_unauthenticated_rejected(mock_client):
    res = mock_client.get("/api/admin/status")
    assert res.status_code == 401


def test_admin_status_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/admin/status")
    assert res.status_code == 403
    assert "Super Admin" in res.json()["message"]


def test_admin_modules_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/admin/modules")
    assert res.status_code == 403
    assert "Super Admin" in res.json()["message"]


def test_admin_modules_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    app.dependency_overrides[get_current_user] = lambda: super_admin
    res = mock_client.get("/api/admin/modules")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_watchdog_metrics_unauthenticated_rejected(mock_client):
    res = mock_client.get("/api/watchdog/metrics")
    assert res.status_code == 401


def test_watchdog_metrics_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/watchdog/metrics")
    assert res.status_code == 403


def test_watchdog_metrics_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    app.dependency_overrides[get_current_user] = lambda: super_admin
    res = mock_client.get("/api/watchdog/metrics")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_users_list_unauthenticated_rejected(mock_client):
    res = mock_client.get("/api/users")
    assert res.status_code == 401


def test_users_list_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/users")
    assert res.status_code == 403


def test_roles_list_unauthenticated_rejected(mock_client):
    res = mock_client.get("/api/roles")
    assert res.status_code == 401


def test_roles_list_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/roles")
    assert res.status_code == 403


def test_permissions_list_unauthenticated_rejected(mock_client):
    res = mock_client.get("/api/permissions")
    assert res.status_code == 401


def test_permissions_list_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/permissions")
    assert res.status_code == 403


# =========================================================================
# 3. Subject Registration Validation Tests (Database-Free)
# =========================================================================

from unittest.mock import MagicMock
from app.modules.atharva_veda.nivaran.models.taxonomy import Subject


def test_registration_empty_taxonomy_returns_503(mock_client):
    """Ensure registration fails-closed with 503 when institutional taxonomy has 0 active subjects."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=lambda: None), # existing_user_stmt
    ]
    mock_db.scalar.return_value = 0 # active_subjects_count == 0

    app.dependency_overrides[get_db] = lambda: mock_db

    payload = {
        "full_name": "Scholar Applicant",
        "email": "applicant_test@csjmu.ac.in",
        "password": "Password123!",
        "subject_id": str(uuid.uuid4()),
    }

    res = mock_client.post("/api/auth/register", json=payload)
    assert res.status_code == 503
    assert "not initialized" in res.json()["message"]


def test_get_subjects_empty_taxonomy_returns_empty_list(mock_client):
    """Ensure GET /api/auth/subjects returns empty list when taxonomy is uninitialized."""
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    app.dependency_overrides[get_db] = lambda: mock_db

    res = mock_client.get("/api/auth/subjects")
    assert res.status_code == 200
    assert res.json() == []


def test_get_subjects_active_taxonomy_returns_db_subjects(mock_client):
    """Ensure GET /api/auth/subjects returns active database subjects."""
    mock_db = MagicMock()
    subj = Subject(
        id=uuid.uuid4(),
        subject_cluster_id=uuid.uuid4(),
        name="Computer Science & Engineering",
        is_active=True,
    )
    mock_db.execute.return_value.scalars.return_value.all.return_value = [subj]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = mock_client.get("/api/auth/subjects")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["name"] == "Computer Science & Engineering"
    assert data[0]["id"] == str(subj.id)


def test_registration_active_subject_succeeds(mock_client):
    """Ensure registration succeeds when subject is active in database."""
    mock_db = MagicMock()
    subj = Subject(
        id=uuid.uuid4(),
        subject_cluster_id=uuid.uuid4(),
        name="Computer Science & Engineering",
        is_active=True,
    )
    mock_applicant_role = Role(
        id=uuid.uuid4(),
        name="applicant",
        description="Applicant Role",
        is_system=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    def _set_id(obj):
        if hasattr(obj, "id") and not obj.id:
            obj.id = uuid.uuid4()
    mock_db.add.side_effect = _set_id

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=lambda: None), # existing_user_stmt
        MagicMock(scalar_one_or_none=lambda: subj), # db_subject
        MagicMock(scalar_one_or_none=lambda: mock_applicant_role), # applicant_role
    ]
    mock_db.scalar.return_value = 1 # active_subjects_count > 0

    app.dependency_overrides[get_db] = lambda: mock_db

    payload = {
        "full_name": "Scholar Applicant",
        "email": "applicant_test@csjmu.ac.in",
        "password": "Password123!",
        "subject_id": str(subj.id),
    }

    res = mock_client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    assert res.json()["message"] == "Registration successful"
    assert res.json()["subject_name"] == "Computer Science & Engineering"


def test_registration_rejects_inactive_subject(mock_client):
    """Ensure registration rejects inactive database subjects."""
    mock_db = MagicMock()
    inactive_subj = Subject(
        id=uuid.uuid4(),
        subject_cluster_id=uuid.uuid4(),
        name="Inactive Nuclear Science",
        is_active=False,
    )

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=lambda: None), # existing_user_stmt
        MagicMock(scalar_one_or_none=lambda: inactive_subj), # db_subject
    ]
    mock_db.scalar.return_value = 1 # active_subjects_count > 0

    app.dependency_overrides[get_db] = lambda: mock_db

    payload = {
        "full_name": "Scholar Applicant",
        "email": "applicant_test@csjmu.ac.in",
        "password": "Password123!",
        "subject_id": str(inactive_subj.id),
    }

    res = mock_client.post("/api/auth/register", json=payload)
    assert res.status_code == 400
    assert "inactive" in res.json()["message"]


def test_registration_rejects_missing_subject(mock_client):
    """Ensure registration rejects missing subject when DB taxonomy is configured."""
    mock_db = MagicMock()
    missing_id = uuid.uuid4()

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=lambda: None), # existing_user_stmt
        MagicMock(scalar_one_or_none=lambda: None), # db_subject not found
    ]
    mock_db.scalar.return_value = 56 # active_subjects_count > 0

    app.dependency_overrides[get_db] = lambda: mock_db

    payload = {
        "full_name": "Scholar Applicant",
        "email": "applicant_test@csjmu.ac.in",
        "password": "Password123!",
        "subject_id": str(missing_id),
    }

    res = mock_client.post("/api/auth/register", json=payload)
    assert res.status_code == 400
    assert "Invalid subject ID" in res.json()["message"]


# =========================================================================
# 4. Sensitive Endpoint 4-Quadrant Role Matrix Tests
# =========================================================================

def test_admin_status_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/admin/status")
    assert res.status_code == 403


def test_admin_status_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    mock_db = MagicMock()
    mock_db.scalar.return_value = 10
    app.dependency_overrides[get_current_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    res = mock_client.get("/api/admin/status")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_admin_modules_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/admin/modules")
    assert res.status_code == 403


def test_watchdog_metrics_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/watchdog/metrics")
    assert res.status_code == 403


def test_users_list_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/users")
    assert res.status_code == 403


def test_users_list_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    mock_db = MagicMock()
    mock_db.execute.return_value.unique.return_value.scalars.return_value.all.return_value = [super_admin]
    app.dependency_overrides[get_current_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    res = mock_client.get("/api/users")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_users_create_unauthenticated_rejected(mock_client):
    res = mock_client.post("/api/users", json={"email": "a@csjmu.ac.in", "password": "Pass", "first_name": "A", "last_name": "B"})
    assert res.status_code == 401


def test_users_create_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.post("/api/users", json={"email": "a@csjmu.ac.in", "password": "Pass", "first_name": "A", "last_name": "B"})
    assert res.status_code == 403


def test_users_create_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.post("/api/users", json={"email": "a@csjmu.ac.in", "password": "Pass", "first_name": "A", "last_name": "B"})
    assert res.status_code == 403


def test_users_get_self_allowed(mock_client):
    applicant = _make_dummy_user(["applicant"])
    mock_db = MagicMock()
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = applicant
    app.dependency_overrides[get_current_user] = lambda: applicant
    app.dependency_overrides[get_db] = lambda: mock_db
    res = mock_client.get(f"/api/users/{applicant.id}")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_users_get_other_user_as_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    other_user_id = uuid.uuid4()
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get(f"/api/users/{other_user_id}")
    assert res.status_code == 403
    assert "Access denied" in res.json()["message"]


def test_users_get_other_user_as_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    other_user = _make_dummy_user(["applicant"])
    mock_db = MagicMock()
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = other_user
    app.dependency_overrides[get_current_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    res = mock_client.get(f"/api/users/{other_user.id}")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_roles_list_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/roles")
    assert res.status_code == 403


def test_roles_list_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    mock_db = MagicMock()
    mock_role = Role(
        id=uuid.uuid4(),
        name="super_admin",
        description="Super Admin",
        is_system=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        permissions=[],
    )
    mock_db.execute.return_value.unique.return_value.scalars.return_value.all.return_value = [mock_role]
    app.dependency_overrides[get_current_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    res = mock_client.get("/api/roles")
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_roles_get_unauthenticated_rejected(mock_client):
    res = mock_client.get("/api/roles/super_admin")
    assert res.status_code == 401


def test_roles_get_legacy_admin_forbidden(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    app.dependency_overrides[get_current_user] = lambda: legacy_admin
    res = mock_client.get("/api/roles/super_admin")
    assert res.status_code == 403


def test_roles_get_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/roles/super_admin")
    assert res.status_code == 403


def test_permissions_list_applicant_forbidden(mock_client):
    applicant = _make_dummy_user(["applicant"])
    app.dependency_overrides[get_current_user] = lambda: applicant
    res = mock_client.get("/api/permissions")
    assert res.status_code == 403


def test_permissions_list_super_admin_allowed(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    mock_db = MagicMock()
    mock_db.execute.return_value.scalars.return_value.all.return_value = []
    app.dependency_overrides[get_current_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    res = mock_client.get("/api/permissions")
    assert res.status_code == 200
    assert res.json()["success"] is True


# =========================================================================
# 5. Role Consistency & Telemetry Tests (/api/modules/atharva-veda/nivaran/me)
# =========================================================================

from app.modules.atharva_veda.nivaran.dependencies import get_current_atharva_user


def test_nivaran_me_telemetry_super_admin(mock_client):
    super_admin = _make_dummy_user(["super_admin"])
    mock_db = MagicMock()
    mock_db.scalar.return_value = None  # No authority record
    app.dependency_overrides[get_current_atharva_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[core_get_db] = lambda: mock_db

    res = mock_client.get("/api/modules/atharva-veda/nivaran/me")
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["persona"] == "admin"
    assert body["is_admin"] is True
    assert body["is_super_admin"] is True


def test_nivaran_me_telemetry_legacy_admin(mock_client):
    legacy_admin = _make_dummy_user(["administrator"])
    mock_db = MagicMock()
    mock_db.scalar.return_value = None
    app.dependency_overrides[get_current_atharva_user] = lambda: legacy_admin
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[core_get_db] = lambda: mock_db

    res = mock_client.get("/api/modules/atharva-veda/nivaran/me")
    assert res.status_code == 200
    body = res.json()["data"]
    # Legacy administrator without super_admin role does not receive admin persona or is_admin flag
    assert body["persona"] == "guest"
    assert body["is_admin"] is False
    assert body["is_super_admin"] is False


def test_nivaran_me_telemetry_applicant(mock_client):
    applicant = _make_dummy_user(["applicant"])
    mock_db = MagicMock()
    mock_db.scalar.return_value = None
    app.dependency_overrides[get_current_atharva_user] = lambda: applicant
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[core_get_db] = lambda: mock_db

    res = mock_client.get("/api/modules/atharva-veda/nivaran/me")
    assert res.status_code == 200
    body = res.json()["data"]
    assert body["persona"] == "applicant"
    assert body["is_applicant"] is True
    assert body["is_admin"] is False
    assert body["is_super_admin"] is False



