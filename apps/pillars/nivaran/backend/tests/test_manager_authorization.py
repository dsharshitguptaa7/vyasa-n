"""
Tests validating Manager Identity and RBAC Foundation (Implementation Phase 5A).

Proves:
1. Applicant identity cannot satisfy Manager authorization.
2. Authority with ASSISTANT_DEAN role cannot satisfy Manager authorization.
3. Authority with ASSOCIATE_DEAN role cannot satisfy Manager authorization.
4. Authority with DEAN role cannot satisfy Manager authorization.
5. Authority with GUEST_MEMBER role cannot satisfy Manager authorization.
6. Authority with MANAGER identity satisfies Manager authorization.
7. Unknown/nonexistent VYASA user cannot satisfy Manager authorization.
8. Missing or inactive NIVARAN authority profile cannot satisfy Manager authorization.
9. Authorization strictly uses vyasa_user_id; client-provided role fields/headers are ignored.
10. No local password or JWT is introduced in NIVARAN.
11. Fine-grained domain permission checks: Manager possesses all 24 domain capabilities.
"""

import uuid
from typing import Optional
import pytest
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect, select
from sqlalchemy.orm import Session

from app.core.authorization import (
    get_current_authority,
    require_manager,
    require_nivaran_permission,
    require_nivaran_role,
)
from app.core.database import get_db
from app.core.permissions import NivaranPermission, ROLE_PERMISSIONS
from app.models.authority import NivaranAuthority
from app.models.enums import NivaranRole
from app.core.identity import get_authenticated_vyasa_identity
from app.seed.data import AUTHORITIES_ROSTER
from app.services.authorization import AuthorityAuthorizationService
from app.services.vyasa_identity import VerifiedVyasaIdentity


# ---------------------------------------------------------------------------
# Test Application Harness (named auth_test_app to avoid pytest collection)
# ---------------------------------------------------------------------------

auth_test_app = FastAPI()

def mock_get_authenticated_vyasa_identity(
    authorization: Optional[str] = Header(None),
    x_vyasa_user_id: Optional[str] = Header(None, alias="X-Vyasa-User-Id"),
) -> VerifiedVyasaIdentity:
    if not authorization and not x_vyasa_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required identity token or header.",
        )
    user_id_str = x_vyasa_user_id
    if authorization and authorization.startswith("Bearer "):
        user_id_str = authorization.split("Bearer ", 1)[1].strip()

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid identity format.",
        )
    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID format in token or header.",
        )

    return VerifiedVyasaIdentity(
        id=user_uuid,
        email="test@vyasa.local",
        first_name="Test",
        last_name="User",
        roles=["user"],
    )

auth_test_app.dependency_overrides[get_authenticated_vyasa_identity] = mock_get_authenticated_vyasa_identity

@auth_test_app.get("/test/manager-only")
def probe_manager_only(authority: NivaranAuthority = Depends(require_manager)):
    return {
        "status": "ok",
        "authority_id": str(authority.id),
        "vyasa_user_id": str(authority.vyasa_user_id),
        "role": authority.role.value,
        "name": authority.name_snapshot,
    }


@auth_test_app.post("/test/manager-action")
def probe_manager_action(
    payload: dict,
    authority: NivaranAuthority = Depends(require_manager),
):
    return {
        "status": "ok",
        "role": authority.role.value,
        "received_payload": payload,
    }


@auth_test_app.get("/test/perm/view-all-grievances")
def probe_perm_view_all(
    authority: NivaranAuthority = Depends(
        require_nivaran_permission(NivaranPermission.VIEW_ALL_GRIEVANCES)
    ),
):
    return {"status": "ok", "permission": "VIEW_ALL_GRIEVANCES", "role": authority.role.value}


@auth_test_app.get("/test/perm/generate-efile")
def probe_perm_efile(
    authority: NivaranAuthority = Depends(
        require_nivaran_permission(NivaranPermission.GENERATE_E_FILE)
    ),
):
    return {"status": "ok", "permission": "GENERATE_E_FILE", "role": authority.role.value}


# ---------------------------------------------------------------------------
# Fixture to guarantee test database purity (clean up non-seeded authorities)
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def cleanup_test_authorities(db_session: Session):
    yield
    valid_emails = {s["email"] for s in AUTHORITIES_ROSTER}
    db_session.execute(
        delete(NivaranAuthority).where(NivaranAuthority.email_snapshot.not_in(valid_emails))
    )
    db_session.commit()


# ---------------------------------------------------------------------------
# Helper to seed or retrieve test authorities
# ---------------------------------------------------------------------------

def _get_or_create_authority(
    db: Session,
    vyasa_user_id: uuid.UUID,
    role: NivaranRole,
    name: str,
    email: str,
    is_active: bool = True,
) -> NivaranAuthority:
    existing = db.execute(
        select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == vyasa_user_id)
    ).scalar_one_or_none()
    if existing:
        existing.role = role
        existing.name_snapshot = name
        existing.email_snapshot = email
        existing.is_active = is_active
        db.commit()
        return existing

    new_auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=vyasa_user_id,
        role=role,
        name_snapshot=name,
        email_snapshot=email,
        designation=f"Test {role.value}",
        department="Test Department",
        is_active=is_active,
    )
    db.add(new_auth)
    db.commit()
    db.refresh(new_auth)
    return new_auth


# ---------------------------------------------------------------------------
# 10 Identity Boundary & RBAC Test Cases
# ---------------------------------------------------------------------------

def test_01_applicant_cannot_satisfy_manager_authorization(db_session: Session) -> None:
    """Requirement 1: Applicant identity cannot satisfy Manager authorization."""
    applicant_vyasa_id = uuid.uuid4()
    # Applicant is not in nivaran_authorities table
    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(applicant_vyasa_id)},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "No active NIVARAN authority profile found" in response.json()["detail"]


def test_02_assistant_dean_cannot_satisfy_manager_authorization(db_session: Session) -> None:
    """Requirement 2: Authority with ASSISTANT_DEAN role cannot satisfy Manager authorization."""
    asst_dean_id = uuid.uuid4()
    _get_or_create_authority(
        db_session,
        vyasa_user_id=asst_dean_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Test Assistant Dean",
        email="asst.dean.test@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(asst_dean_id)},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is ASSISTANT_DEAN" in response.json()["detail"]


def test_03_associate_dean_cannot_satisfy_manager_authorization(db_session: Session) -> None:
    """Requirement 3: ASSOCIATE_DEAN cannot satisfy Manager authorization."""
    assoc_dean_id = uuid.uuid4()
    _get_or_create_authority(
        db_session,
        vyasa_user_id=assoc_dean_id,
        role=NivaranRole.ASSOCIATE_DEAN,
        name="Test Associate Dean",
        email="assoc.dean.test@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(assoc_dean_id)},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is ASSOCIATE_DEAN" in response.json()["detail"]


def test_04_dean_cannot_satisfy_manager_authorization(db_session: Session) -> None:
    """Requirement 4: DEAN cannot satisfy Manager authorization."""
    dean_id = uuid.uuid4()
    _get_or_create_authority(
        db_session,
        vyasa_user_id=dean_id,
        role=NivaranRole.DEAN,
        name="Test Dean",
        email="dean.test@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(dean_id)},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is DEAN" in response.json()["detail"]


def test_05_guest_member_cannot_satisfy_manager_authorization(db_session: Session) -> None:
    """Requirement 5: GUEST_MEMBER cannot satisfy Manager authorization."""
    guest_id = uuid.uuid4()
    _get_or_create_authority(
        db_session,
        vyasa_user_id=guest_id,
        role=NivaranRole.GUEST_MEMBER,
        name="Test Guest Member",
        email="guest.member.test@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(guest_id)},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is GUEST_MEMBER" in response.json()["detail"]


def test_06_manager_identity_can_satisfy_manager_authorization(db_session: Session) -> None:
    """Requirement 6: MANAGER identity can satisfy Manager authorization."""
    mgr_id = uuid.uuid4()
    mgr_auth = _get_or_create_authority(
        db_session,
        vyasa_user_id=mgr_id,
        role=NivaranRole.MANAGER,
        name="Chief Triage Manager",
        email="chief.manager@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(mgr_id)},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert data["role"] == "MANAGER"
    assert data["vyasa_user_id"] == str(mgr_id)
    assert data["name"] == "Chief Triage Manager"


def test_07_unknown_nonexistent_vyasa_user_rejected(db_session: Session) -> None:
    """Requirement 7: Unknown/nonexistent VYASA user cannot satisfy Manager authorization."""
    random_user_id = uuid.uuid4()

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    response = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(random_user_id)},
    )
    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert "No active NIVARAN authority profile found" in response.json()["detail"]


def test_08_missing_or_inactive_authority_rejected(db_session: Session) -> None:
    """Requirement 8: Missing header or inactive NIVARAN authority profile cannot satisfy Manager authorization."""
    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    # 1. Missing header -> HTTP 401
    resp_no_header = client.get("/test/manager-only")
    assert resp_no_header.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Inactive manager authority -> HTTP 403
    inactive_mgr_id = uuid.uuid4()
    _get_or_create_authority(
        db_session,
        vyasa_user_id=inactive_mgr_id,
        role=NivaranRole.MANAGER,
        name="Deactivated Manager",
        email="inactive.mgr@nivaran.local",
        is_active=False,
    )
    resp_inactive = client.get(
        "/test/manager-only",
        headers={"X-Vyasa-User-Id": str(inactive_mgr_id)},
    )
    assert resp_inactive.status_code == status.HTTP_403_FORBIDDEN
    assert "No active NIVARAN authority profile found" in resp_inactive.json()["detail"]


def test_09_authorization_uses_vyasa_user_id_and_ignores_client_role(db_session: Session) -> None:
    """
    Requirement 9: Authorization strictly uses vyasa_user_id.
    Client-provided role in body or headers is ignored and cannot elevate privileges.
    """
    applicant_id = uuid.uuid4()
    asst_dean_id = uuid.uuid4()
    _get_or_create_authority(
        db_session,
        vyasa_user_id=asst_dean_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Sneaky Asst Dean",
        email="sneaky.asst@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    # Case A: Applicant sends {"role": "MANAGER"} in payload
    resp_app_spoof = client.post(
        "/test/manager-action",
        headers={"X-Vyasa-User-Id": str(applicant_id), "X-Role": "MANAGER"},
        json={"action": "reassign", "role": "MANAGER"},
    )
    assert resp_app_spoof.status_code == status.HTTP_403_FORBIDDEN

    # Case B: Assistant Dean sends {"role": "MANAGER"} in payload
    resp_dean_spoof = client.post(
        "/test/manager-action",
        headers={"X-Vyasa-User-Id": str(asst_dean_id), "X-Role": "MANAGER"},
        json={"action": "reassign", "role": "MANAGER"},
    )
    assert resp_dean_spoof.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is ASSISTANT_DEAN" in resp_dean_spoof.json()["detail"]


def test_10_no_local_password_or_jwt_storage(db_session: Session) -> None:
    """
    Requirement 10: Proves that NIVARAN does not store local passwords,
    local credentials, or local JWT issuance tables.
    """
    mapper = inspect(NivaranAuthority)
    column_names = {c.key for c in mapper.columns}

    # Verify no password or credential columns exist
    forbidden_cols = {"password", "password_hash", "token", "jwt", "secret", "salt"}
    assert not (column_names & forbidden_cols), f"Forbidden auth columns found in NivaranAuthority: {column_names & forbidden_cols}"

    # Verify canonical columns exist
    expected_cols = {
        "id",
        "vyasa_user_id",
        "role",
        "name_snapshot",
        "email_snapshot",
        "designation",
        "department",
        "is_active",
        "created_at",
        "updated_at",
    }
    assert expected_cols.issubset(column_names)


# ---------------------------------------------------------------------------
# Fine-grained Permissions Tests
# ---------------------------------------------------------------------------

def test_11_manager_possesses_all_24_domain_permissions() -> None:
    """Verifies that Manager possesses all 24 domain capabilities derived from audit."""
    manager_perms = ROLE_PERMISSIONS[NivaranRole.MANAGER]
    expected_24_perms = {
        NivaranPermission.VIEW_ALL_GRIEVANCES,
        NivaranPermission.VIEW_GRIEVANCE,
        NivaranPermission.ASSIGN_GRIEVANCE,
        NivaranPermission.CHANGE_PRIORITY,
        NivaranPermission.CHANGE_STATUS,
        NivaranPermission.CLOSE_GRIEVANCE,
        NivaranPermission.REOPEN_GRIEVANCE,
        NivaranPermission.RESOLVE_GRIEVANCE,
        NivaranPermission.ADD_INTERNAL_COMMENT,
        NivaranPermission.VIEW_INTERNAL_COMMENTS,
        NivaranPermission.UPLOAD_ATTACHMENT,
        NivaranPermission.VIEW_ATTACHMENT,
        NivaranPermission.DELETE_ATTACHMENT,
        NivaranPermission.GENERATE_E_FILE,
        NivaranPermission.SEARCH_E_FILE_REPOSITORY,
        NivaranPermission.PREVIEW_E_FILE,
        NivaranPermission.DOWNLOAD_E_FILE,
        NivaranPermission.VIEW_ANALYTICS,
        NivaranPermission.VIEW_ACTIVITY_LOGS,
        NivaranPermission.VIEW_AUDIT_LOGS,
        NivaranPermission.SIGN_DOCUMENT,
        NivaranPermission.VERIFY_SIGNATURE,
        NivaranPermission.VIEW_FEEDBACK,
        NivaranPermission.SUBMIT_FEEDBACK,
    }
    assert len(expected_24_perms) == 24
    assert manager_perms == expected_24_perms


def test_12_permission_enforcement_endpoint(db_session: Session) -> None:
    """Verifies that require_nivaran_permission correctly authorizes Manager and rejects unauthorized authorities."""
    mgr_id = uuid.uuid4()
    asst_dean_id = uuid.uuid4()

    _get_or_create_authority(
        db_session,
        vyasa_user_id=mgr_id,
        role=NivaranRole.MANAGER,
        name="Perm Manager",
        email="perm.manager@nivaran.local",
    )
    _get_or_create_authority(
        db_session,
        vyasa_user_id=asst_dean_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Perm Asst Dean",
        email="perm.asst@nivaran.local",
    )

    auth_test_app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(auth_test_app)

    # 1. Manager can access VIEW_ALL_GRIEVANCES
    resp_mgr_view = client.get(
        "/test/perm/view-all-grievances",
        headers={"X-Vyasa-User-Id": str(mgr_id)},
    )
    assert resp_mgr_view.status_code == status.HTTP_200_OK

    # 2. Assistant Dean CANNOT access VIEW_ALL_GRIEVANCES (only VIEW_GRIEVANCE)
    resp_asst_view = client.get(
        "/test/perm/view-all-grievances",
        headers={"X-Vyasa-User-Id": str(asst_dean_id)},
    )
    assert resp_asst_view.status_code == status.HTTP_403_FORBIDDEN
    assert "Insufficient privileges" in resp_asst_view.json()["detail"]

    # 3. Manager can access GENERATE_E_FILE
    resp_mgr_efile = client.get(
        "/test/perm/generate-efile",
        headers={"X-Vyasa-User-Id": str(mgr_id)},
    )
    assert resp_mgr_efile.status_code == status.HTTP_200_OK

    # 4. Assistant Dean CANNOT access GENERATE_E_FILE
    resp_asst_efile = client.get(
        "/test/perm/generate-efile",
        headers={"X-Vyasa-User-Id": str(asst_dean_id)},
    )
    assert resp_asst_efile.status_code == status.HTTP_403_FORBIDDEN
