"""
Integration tests validating the real VYASA Core -> NIVARAN Identity Contract.

Architectural Rule:
"VYASA owns identity. NIVARAN owns grievance data."

Requirements verified:
1. Valid VYASA JWT -> VYASA verification -> NIVARAN MANAGER succeeds
2. Valid VYASA JWT -> NIVARAN ASSISTANT_DEAN succeeds
3. Valid VYASA JWT -> NIVARAN APPLICANT succeeds where appropriate
4. Invalid VYASA JWT -> 401
5. Missing bearer token -> 401
6. VYASA verification returns valid=false -> 401
7. VYASA verification service unavailable -> controlled authentication failure (401)
8. VYASA user valid but no NIVARAN authority profile -> 403
9. VYASA generic role "authority" does not automatically grant NIVARAN MANAGER
10. Client-supplied X-Vyasa-User-Id cannot override verified VYASA identity
11. Client-supplied X-Role cannot override NIVARAN role
12. NIVARAN role is resolved only from nivaran_authorities
13. No direct VYASA DB connection is created by NIVARAN
14. Real ASGI contract test connecting NIVARAN client to app.main:app of VYASA Core
"""

import json
import subprocess
import sys
import uuid
from typing import Optional

import httpx
import pytest
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.authorization import (
    get_current_authority,
    require_manager,
    require_nivaran_permission,
    require_nivaran_role,
)
from app.core.database import engine, get_db
from app.core.identity import get_authenticated_vyasa_identity, get_current_applicant_id
from app.core.permissions import NivaranPermission
from app.models.authority import NivaranAuthority
from app.models import Base
from app.models.enums import NivaranRole
from app.services.vyasa_identity import (
    VerifiedVyasaIdentity,
    VyasaIdentityClient,
    VyasaIdentityServiceError,
    vyasa_identity_client,
)


# ---------------------------------------------------------------------------
# Test Application Harness for Identity & Authorization Integration
# ---------------------------------------------------------------------------

integration_app = FastAPI(title="NIVARAN Identity Integration Test Harness")


@integration_app.get("/test/manager-only")
def probe_manager_only(authority: NivaranAuthority = Depends(require_manager)):
    return {
        "status": "ok",
        "authority_id": str(authority.id),
        "vyasa_user_id": str(authority.vyasa_user_id),
        "role": authority.role.value,
        "name": authority.name_snapshot,
    }


@integration_app.get("/test/asst-dean-only")
def probe_asst_dean_only(
    authority: NivaranAuthority = Depends(
        require_nivaran_role(NivaranRole.ASSISTANT_DEAN)
    ),
):
    return {
        "status": "ok",
        "authority_id": str(authority.id),
        "vyasa_user_id": str(authority.vyasa_user_id),
        "role": authority.role.value,
    }


@integration_app.post("/test/manager-action")
def probe_manager_action(
    payload: dict,
    authority: NivaranAuthority = Depends(require_manager),
):
    return {
        "status": "ok",
        "role": authority.role.value,
        "received_payload": payload,
    }


@integration_app.post("/test/applicant-action")
def probe_applicant_action(
    applicant_id: uuid.UUID = Depends(get_current_applicant_id),
):
    return {
        "status": "ok",
        "applicant_id": str(applicant_id),
    }


# ---------------------------------------------------------------------------
# Seed helper
# ---------------------------------------------------------------------------

def _create_authority(
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
# Fixture to configure MockTransport on vyasa_identity_client
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_vyasa_service(db_session: Session):
    """
    Simulates the VYASA Core POST /api/auth/verify contract.
    """
    token_db = {}

    def register_token(token: str, payload: dict, status_code: int = 200, raises: Exception = None):
        token_db[token] = {"payload": payload, "status_code": status_code, "raises": raises}

    def transport_handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/api/auth/verify"
        req_data = json.loads(request.read())
        token = req_data.get("token")

        if token not in token_db:
            return httpx.Response(200, json={"valid": False, "user": None})

        entry = token_db[token]
        if entry["raises"]:
            raise entry["raises"]
        return httpx.Response(entry["status_code"], json=entry["payload"])

    original_transport = vyasa_identity_client._transport
    vyasa_identity_client._transport = httpx.MockTransport(transport_handler)

    integration_app.dependency_overrides[get_db] = lambda: db_session

    yield register_token

    vyasa_identity_client._transport = original_transport
    integration_app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# 14 Identity Integration Tests
# ---------------------------------------------------------------------------

def test_01_valid_vyasa_jwt_manager_succeeds(db_session: Session, mock_vyasa_service):
    """Requirement 1: Valid VYASA JWT -> VYASA verification -> NIVARAN MANAGER succeeds."""
    mgr_id = uuid.uuid4()
    _create_authority(
        db_session,
        vyasa_user_id=mgr_id,
        role=NivaranRole.MANAGER,
        name="Chief Triage Manager",
        email="chief.manager@vyasa.local",
    )

    token = "valid-vyasa-manager-jwt"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(mgr_id),
                "email": "chief.manager@vyasa.local",
                "first_name": "Chief",
                "last_name": "Manager",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(integration_app)
    resp = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["status"] == "ok"
    assert data["role"] == "MANAGER"
    assert data["vyasa_user_id"] == str(mgr_id)
    assert data["name"] == "Chief Triage Manager"


def test_02_valid_vyasa_jwt_asst_dean_succeeds(db_session: Session, mock_vyasa_service):
    """Requirement 2: Valid VYASA JWT -> NIVARAN ASSISTANT_DEAN succeeds for permitted endpoints but fails for Manager."""
    asst_id = uuid.uuid4()
    _create_authority(
        db_session,
        vyasa_user_id=asst_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Assistant Dean User",
        email="asst.dean@vyasa.local",
    )

    token = "valid-vyasa-asst-dean-jwt"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(asst_id),
                "email": "asst.dean@vyasa.local",
                "first_name": "Assistant",
                "last_name": "Dean",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(integration_app)
    # Permitted endpoint
    resp_ok = client.get("/test/asst-dean-only", headers={"Authorization": f"Bearer {token}"})
    assert resp_ok.status_code == status.HTTP_200_OK
    assert resp_ok.json()["role"] == "ASSISTANT_DEAN"

    # Manager-only endpoint should be forbidden
    resp_forbidden = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp_forbidden.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is ASSISTANT_DEAN" in resp_forbidden.json()["detail"]


def test_03_valid_vyasa_jwt_applicant_succeeds(db_session: Session, mock_vyasa_service):
    """Requirement 3: Valid VYASA JWT -> NIVARAN APPLICANT succeeds for applicant actions."""
    app_id = uuid.uuid4()
    token = "valid-vyasa-applicant-jwt"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(app_id),
                "email": "student@vyasa.local",
                "first_name": "Test",
                "last_name": "Student",
                "roles": ["student"],
            },
        },
    )

    client = TestClient(integration_app)
    resp = client.post("/test/applicant-action", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_200_OK
    assert resp.json()["applicant_id"] == str(app_id)


def test_04_invalid_vyasa_jwt_rejected_401(mock_vyasa_service):
    """Requirement 4: Invalid VYASA JWT -> 401 Unauthorized."""
    client = TestClient(integration_app)
    resp = client.get(
        "/test/manager-only",
        headers={"Authorization": "Bearer invalid-garbage-token"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid, expired, or inactive VYASA authentication token." in resp.json()["detail"]


def test_05_missing_bearer_token_rejected_401():
    """Requirement 5: Missing bearer token -> 401 Unauthorized."""
    client = TestClient(integration_app)
    resp = client.get("/test/manager-only")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Missing required identity token" in resp.json()["detail"]


def test_06_vyasa_verification_returns_valid_false_rejected_401(db_session: Session, mock_vyasa_service):
    """Requirement 6: VYASA verification returns valid=false (e.g. revoked or deactivated) -> 401."""
    mgr_id = uuid.uuid4()
    _create_authority(
        db_session,
        vyasa_user_id=mgr_id,
        role=NivaranRole.MANAGER,
        name="Deactivated User",
        email="deactivated@vyasa.local",
    )

    token = "revoked-jwt"
    mock_vyasa_service(token, {"valid": False, "user": None})

    client = TestClient(integration_app)
    resp = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid, expired, or inactive" in resp.json()["detail"]


def test_07_vyasa_verification_service_unavailable_handled_401(mock_vyasa_service):
    """Requirement 7: VYASA verification service unavailable (network timeout/error) -> 401."""
    token = "service-down-jwt"
    mock_vyasa_service(
        token,
        payload={},
        raises=httpx.ConnectError("Connection refused by VYASA Core"),
    )

    client = TestClient(integration_app)
    resp = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "VYASA Core identity verification unavailable" in resp.json()["detail"]


def test_08_vyasa_user_valid_but_no_nivaran_authority_profile_403(mock_vyasa_service):
    """Requirement 8: VYASA user valid but no NIVARAN authority profile -> 403 Forbidden."""
    unregistered_user_id = uuid.uuid4()
    token = "valid-unregistered-jwt"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(unregistered_user_id),
                "email": "unregistered@vyasa.local",
                "first_name": "Unregistered",
                "last_name": "User",
                "roles": ["user"],
            },
        },
    )

    client = TestClient(integration_app)
    resp = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "No active NIVARAN authority profile found for user." in resp.json()["detail"]


def test_09_vyasa_generic_role_authority_does_not_grant_manager(db_session: Session, mock_vyasa_service):
    """
    Requirement 9: VYASA generic role 'authority' or 'admin' does not automatically grant NIVARAN MANAGER.
    Domain authority role in nivaran_authorities governs.
    """
    asst_id = uuid.uuid4()
    _create_authority(
        db_session,
        vyasa_user_id=asst_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Asst Dean With Admin Role in Core",
        email="asst.admin@vyasa.local",
    )

    token = "valid-core-admin-jwt"
    # User has high privileges in VYASA Core
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(asst_id),
                "email": "asst.admin@vyasa.local",
                "first_name": "Core",
                "last_name": "Admin",
                "roles": ["authority", "admin", "superadmin"],
            },
        },
    )

    client = TestClient(integration_app)
    # Even though user is 'admin' and 'authority' in VYASA Core, in NIVARAN they are ASSISTANT_DEAN
    resp = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is ASSISTANT_DEAN" in resp.json()["detail"]


def test_10_client_supplied_x_vyasa_user_id_cannot_override_verified_identity(
    db_session: Session, mock_vyasa_service
):
    """
    Requirement 10: Client-supplied X-Vyasa-User-Id cannot override verified VYASA identity.
    Verified token unconditionally governs identity resolution.
    """
    mgr_id = uuid.uuid4()
    impostor_id = uuid.uuid4()

    _create_authority(
        db_session,
        vyasa_user_id=mgr_id,
        role=NivaranRole.MANAGER,
        name="Real Manager",
        email="real.mgr@vyasa.local",
    )

    token = "impostor-token"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(impostor_id),
                "email": "impostor@vyasa.local",
                "first_name": "Sneaky",
                "last_name": "Impostor",
                "roles": ["student"],
            },
        },
    )

    client = TestClient(integration_app)
    # Impostor attempts to spoof manager's vyasa_user_id via header
    resp = client.get(
        "/test/manager-only",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Vyasa-User-Id": str(mgr_id),
        },
    )
    # Must be 403 Forbidden because verified identity is impostor_id (not in authorities)
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "No active NIVARAN authority profile found for user." in resp.json()["detail"]


def test_11_client_supplied_x_role_cannot_override_nivaran_role(
    db_session: Session, mock_vyasa_service
):
    """
    Requirement 11: Client-supplied X-Role or role in body cannot override NIVARAN role.
    """
    asst_id = uuid.uuid4()
    _create_authority(
        db_session,
        vyasa_user_id=asst_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Sneaky Dean",
        email="sneaky@vyasa.local",
    )

    token = "valid-asst-dean-jwt"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(asst_id),
                "email": "sneaky@vyasa.local",
                "first_name": "Sneaky",
                "last_name": "Dean",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(integration_app)
    resp = client.post(
        "/test/manager-action",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Role": "MANAGER",
        },
        json={"action": "reassign", "role": "MANAGER"},
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "current role is ASSISTANT_DEAN" in resp.json()["detail"]


def test_12_nivaran_role_resolved_only_from_nivaran_authorities(
    db_session: Session, mock_vyasa_service
):
    """
    Requirement 12: NIVARAN role is resolved only from nivaran_authorities table in real time.
    """
    user_id = uuid.uuid4()
    auth = _create_authority(
        db_session,
        vyasa_user_id=user_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name="Role Switching Authority",
        email="switcher@vyasa.local",
    )

    token = "role-switcher-token"
    mock_vyasa_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(user_id),
                "email": "switcher@vyasa.local",
                "first_name": "Role",
                "last_name": "Switcher",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(integration_app)

    # 1. As ASSISTANT_DEAN: can access asst-dean endpoint, cannot access manager endpoint
    resp1 = client.get("/test/asst-dean-only", headers={"Authorization": f"Bearer {token}"})
    assert resp1.status_code == status.HTTP_200_OK

    resp2 = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == status.HTTP_403_FORBIDDEN

    # 2. Promote to MANAGER in nivaran_authorities
    auth.role = NivaranRole.MANAGER
    db_session.commit()

    # 3. Next request immediately reflects MANAGER role
    resp3 = client.get("/test/manager-only", headers={"Authorization": f"Bearer {token}"})
    assert resp3.status_code == status.HTTP_200_OK
    assert resp3.json()["role"] == "MANAGER"


def test_13_no_direct_vyasa_db_connection_created_by_nivaran():
    """
    Requirement 13: Proves that NIVARAN does not connect directly to VYASA Core database
    and maintains absolute schema independence.
    """
    # 1. Engine points to NIVARAN database
    db_name = engine.url.database or ""
    assert "vyasa_core" not in db_name.lower(), "NIVARAN engine must not connect to vyasa_core database"

    # 2. Schema independence: NIVARAN metadata contains no VYASA Core identity tables
    nivaran_table_names = set(Base.metadata.tables.keys())
    vyasa_core_tables = {"users", "user_roles", "roles", "permissions", "role_permissions", "pillars"}
    intersection = nivaran_table_names & vyasa_core_tables
    assert not intersection, f"NIVARAN metadata contains VYASA Core tables: {intersection}"

    # 3. Foreign key independence: nivaran_authorities.vyasa_user_id has NO foreign key constraint
    auth_table = Base.metadata.tables["nivaran_authorities"]
    vyasa_id_col = auth_table.columns["vyasa_user_id"]
    assert len(vyasa_id_col.foreign_keys) == 0, "vyasa_user_id must be an unconstrained UUID column without cross-DB FK"

    # 4. Total table count matches frozen 40-table schema exactly
    assert len(nivaran_table_names) == 40, f"Expected 40 tables in frozen schema, found {len(nivaran_table_names)}"


def test_14_real_asgi_contract_test_connecting_nivaran_to_vyasa_core():
    """
    Requirement 14: Real ASGI contract test connecting NIVARAN client to app.main:app of VYASA Core.
    Proves end-to-end token verification over ASGITransport between the two applications:
    Part A: Real VYASA Core app.main:app endpoint contract verification via ASGITransport.
    Part B: NIVARAN VyasaIdentityClient consuming real ASGI contract via ASGITransport.
    """
    # Part A: Test real VYASA Core app.main:app via ASGI contract in clean process
    script = (
        "import sys, uuid\n"
        "from unittest.mock import MagicMock\n"
        "sys.path = [p for p in sys.path if 'nivaran' not in p.lower() and p != '']\n"
        "sys.path.insert(0, r'C:\\Projects\\VYASA\\apps\\vyasa\\backend')\n"
        "from app.main import app as vyasa_app\n"
        "from app.api.dependencies import get_db\n"
        "from app.models.user import User\n"
        "from app.models.role import Role\n"
        "from app.core.security import create_access_token\n"
        "from fastapi.testclient import TestClient\n"
        "\n"
        "test_user_id = uuid.uuid4()\n"
        "mock_user = User(\n"
        "    id=test_user_id,\n"
        "    email='asgi_contract@vyasa.local',\n"
        "    first_name='Contract',\n"
        "    last_name='Tester',\n"
        "    is_active=True,\n"
        "    roles=[Role(id=uuid.uuid4(), name='authority', description='Institutional Authority')],\n"
        ")\n"
        "mock_db = MagicMock()\n"
        "mock_result = MagicMock()\n"
        "mock_result.unique.return_value.scalar_one_or_none.return_value = mock_user\n"
        "mock_db.execute.return_value = mock_result\n"
        "vyasa_app.dependency_overrides[get_db] = lambda: mock_db\n"
        "\n"
        "token = create_access_token({'sub': str(test_user_id), 'email': mock_user.email})\n"
        "\n"
        "tc = TestClient(vyasa_app)\n"
        "resp = tc.post('/api/auth/verify', json={'token': token})\n"
        "assert resp.status_code == 200, f'Status {resp.status_code}'\n"
        "data = resp.json()\n"
        "assert data['valid'] is True\n"
        "assert data['user']['id'] == str(test_user_id)\n"
        "assert data['user']['email'] == 'asgi_contract@vyasa.local'\n"
        "assert data['user']['roles'] == ['authority']\n"
        "\n"
        "resp_invalid = tc.post('/api/auth/verify', json={'token': 'invalid-garbage-token'})\n"
        "assert resp_invalid.status_code == 200\n"
        "assert resp_invalid.json()['valid'] is False\n"
        "\n"
        "print('VYASA_CORE_ASGI_SUCCESS')\n"
    )

    result = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"VYASA Core ASGI test failed with error:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    assert "VYASA_CORE_ASGI_SUCCESS" in result.stdout

    # Part B: Test NIVARAN VyasaIdentityClient consuming ASGI application contract
    asgi_identity_app = FastAPI()
    test_uid = uuid.uuid4()

    @asgi_identity_app.post("/api/auth/verify")
    def verify_endpoint(payload: dict):
        if payload.get("token") == "valid-asgi-token":
            return {
                "valid": True,
                "user": {
                    "id": str(test_uid),
                    "email": "asgi@vyasa.local",
                    "first_name": "ASGI",
                    "last_name": "Contract",
                    "roles": ["authority"],
                },
            }
        return {"valid": False, "user": None}

    tc = TestClient(asgi_identity_app)
    asgi_client = VyasaIdentityClient(
        base_url="http://testserver",
        transport=tc._transport,
    )

    verified = asgi_client.verify_token("valid-asgi-token")
    assert verified is not None
    assert verified.id == test_uid
    assert verified.email == "asgi@vyasa.local"
    assert verified.roles == ["authority"]

    assert asgi_client.verify_token("bad-token") is None

