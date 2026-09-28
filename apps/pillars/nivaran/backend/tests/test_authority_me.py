"""
Tests for NIVARAN Authority Session Endpoint: GET /api/v1/authority/me.

Verifies:
1. Valid VYASA JWT for Manager resolves to MANAGER domain role.
2. Valid VYASA JWT for Assistant Dean resolves to ASSISTANT_DEAN domain role.
3. User with applicant role rejected with 403 (role check).
4. Valid VYASA authority without NIVARAN record rejected with 403.
5. Missing token rejected with 401.
6. Invalid/expired token rejected with 401.
7. VYASA verification service unreachable handled safely with 401.
"""

import json
import uuid
import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db
from app.models.authority import NivaranAuthority
from app.models.enums import NivaranRole
from app.services.vyasa_identity import vyasa_identity_client


@pytest.fixture
def mock_vyasa_auth_service(db_session: Session):
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

    app.dependency_overrides[get_db] = lambda: db_session

    yield register_token

    vyasa_identity_client._transport = original_transport
    app.dependency_overrides.clear()


def test_01_valid_vyasa_jwt_manager_resolves_manager_workspace(
    db_session: Session, mock_vyasa_auth_service
):
    # Manager: Mr. Ashfaq Ansari
    mgr_vyasa_id = uuid.UUID("73fd427c-30c5-54d7-ba9a-4101620815f8")

    # Ensure authority exists in test DB
    auth = db_session.query(NivaranAuthority).filter_by(vyasa_user_id=mgr_vyasa_id).first()
    if not auth:
        auth = NivaranAuthority(
            id=uuid.uuid4(),
            vyasa_user_id=mgr_vyasa_id,
            role=NivaranRole.MANAGER,
            name_snapshot="Mr. Ashfaq Ansari",
            email_snapshot="rdmmanager@csjmu.ac.in",
            designation="Manager",
            department="Triage",
            is_active=True,
        )
        db_session.add(auth)
        db_session.commit()

    token = "test-manager-token"
    mock_vyasa_auth_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(mgr_vyasa_id),
                "email": "rdmmanager@csjmu.ac.in",
                "first_name": "Mr. Ashfaq",
                "last_name": "Ansari",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(app)
    resp = client.get("/api/v1/authority/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["success"] is True
    assert data["vyasa_identity"]["id"] == str(mgr_vyasa_id)
    assert data["vyasa_identity"]["email"] == "rdmmanager@csjmu.ac.in"
    assert data["vyasa_identity"]["roles"] == ["authority"]
    assert data["nivaran_authority"]["role"] == "MANAGER"
    assert data["nivaran_authority"]["vyasa_user_id"] == str(mgr_vyasa_id)
    assert "Ashfaq Ansari" in data["nivaran_authority"]["name"]


def test_02_valid_vyasa_jwt_assistant_dean_resolves_role(
    db_session: Session, mock_vyasa_auth_service
):
    asst_id = uuid.uuid4()
    auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=asst_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Assistant Dean",
        email_snapshot="asst.dean@csjmu.ac.in",
        designation="Assistant Dean",
        department="Academic Affairs",
        is_active=True,
    )
    db_session.add(auth)
    db_session.commit()

    token = "test-asst-dean-token"
    mock_vyasa_auth_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(asst_id),
                "email": "asst.dean@csjmu.ac.in",
                "first_name": "Assistant",
                "last_name": "Dean",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(app)
    resp = client.get("/api/v1/authority/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == status.HTTP_200_OK
    data = resp.json()
    assert data["nivaran_authority"]["role"] == "ASSISTANT_DEAN"


def test_03_vyasa_user_with_applicant_role_rejected(
    db_session: Session, mock_vyasa_auth_service
):
    app_id = uuid.uuid4()
    token = "test-applicant-token"
    mock_vyasa_auth_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(app_id),
                "email": "student@csjmu.ac.in",
                "first_name": "Student",
                "last_name": "User",
                "roles": ["applicant"],
            },
        },
    )

    client = TestClient(app)
    resp = client.get("/api/v1/authority/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "does not have the 'authority' ecosystem role" in resp.json()["detail"]


def test_04_vyasa_authority_without_nivaran_mapping_rejected(
    db_session: Session, mock_vyasa_auth_service
):
    unmapped_id = uuid.uuid4()
    token = "test-unmapped-token"
    mock_vyasa_auth_service(
        token,
        {
            "valid": True,
            "user": {
                "id": str(unmapped_id),
                "email": "unmapped@csjmu.ac.in",
                "first_name": "Unmapped",
                "last_name": "Officer",
                "roles": ["authority"],
            },
        },
    )

    client = TestClient(app)
    resp = client.get("/api/v1/authority/me", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "no NIVARAN authority profile is assigned" in resp.json()["detail"]


def test_05_missing_token_rejected_401(mock_vyasa_auth_service):
    client = TestClient(app)
    resp = client.get("/api/v1/authority/me")
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Missing required identity token" in resp.json()["detail"]


def test_06_invalid_token_rejected_401(mock_vyasa_auth_service):
    client = TestClient(app)
    resp = client.get(
        "/api/v1/authority/me",
        headers={"Authorization": "Bearer invalid-junk-token"},
    )
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Invalid, expired, or inactive" in resp.json()["detail"]


def test_07_vyasa_service_unreachable_rejected_401(mock_vyasa_auth_service):
    token = "service-error-token"
    mock_vyasa_auth_service(
        token,
        payload={},
        raises=httpx.ConnectError("Connection refused by VYASA Core"),
    )

    client = TestClient(app)
    resp = client.get("/api/v1/authority/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "VYASA Core identity verification unavailable" in resp.json()["detail"]
