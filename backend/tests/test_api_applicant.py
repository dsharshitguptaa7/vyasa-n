import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token, hash_password
from app.core.subjects import CANONICAL_SUBJECTS
from app.models.applicant_profile import ApplicantProfile
from app.models.role import Role
from app.models.user import User


@pytest.fixture
def applicant_test_user(db_session: Session):
    """Fixture creating an applicant user with linked ApplicantProfile."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"app_dash_{unique_suffix}@csjmu.ac.in"
    user_id = uuid.uuid4()
    subject = CANONICAL_SUBJECTS[2]  # Agriculture Entomology

    applicant_role = db_session.execute(
        select(Role).where(Role.name == "applicant")
    ).scalar_one_or_none()

    user = User(
        id=user_id,
        email=email,
        password_hash=hash_password("Password123!"),
        first_name="Rohan",
        last_name="Verma",
        phone="+919876543210",
        is_active=True,
        is_verified=True,
    )
    if applicant_role:
        user.roles.append(applicant_role)
    db_session.add(user)
    db_session.flush()

    profile = ApplicantProfile(
        id=uuid.uuid4(),
        user_id=user.id,
        phd_registration_number=f"PHD/2026/{unique_suffix}",
        department="Entomology Department",
        subject_id=uuid.UUID(subject["id"]),
        subject_name=subject["name"],
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email, "roles": ["applicant"]})

    yield {"user": user, "profile": profile, "token": token}

    # Cleanup
    db_u = db_session.get(User, user.id)
    if db_u:
        db_session.delete(db_u)
        db_session.commit()


@pytest.fixture
def authority_test_user(db_session: Session):
    """Fixture creating an authority user without applicant role."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"auth_user_{unique_suffix}@vyasa.local"
    user_id = uuid.uuid4()

    authority_role = db_session.execute(
        select(Role).where(Role.name == "authority")
    ).scalar_one_or_none()

    user = User(
        id=user_id,
        email=email,
        password_hash=hash_password("Password123!"),
        first_name="Institutional",
        last_name="Dean",
        is_active=True,
        is_verified=True,
    )
    if authority_role:
        user.roles.append(authority_role)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email, "roles": ["authority"]})

    yield {"user": user, "token": token}

    db_u = db_session.get(User, user.id)
    if db_u:
        db_session.delete(db_u)
        db_session.commit()


def test_authenticated_applicant_can_access_profile(client: TestClient, applicant_test_user) -> None:
    """Requirement 1: Authenticated applicant can retrieve their own profile."""
    headers = {"Authorization": f"Bearer {applicant_test_user['token']}"}
    response = client.get("/api/applicant/profile", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["user_id"] == str(applicant_test_user["user"].id)
    assert data["email"] == applicant_test_user["user"].email
    assert data["first_name"] == "Rohan"
    assert data["last_name"] == "Verma"
    assert data["full_name"] == "Rohan Verma"
    assert data["roles"] == ["applicant"]
    assert data["is_active"] is True
    assert data["is_verified"] is True
    assert data["phone"] == "+919876543210"
    assert data["phd_registration_number"] == applicant_test_user["profile"].phd_registration_number
    assert data["department"] == "Entomology Department"
    assert data["subject_id"] == str(applicant_test_user["profile"].subject_id)
    assert data["subject_name"] == applicant_test_user["profile"].subject_name


def test_unauthenticated_request_rejected_with_401(client: TestClient) -> None:
    """Requirement 2: Unauthenticated request to /api/applicant/profile returns 401."""
    response = client.get("/api/applicant/profile")
    assert response.status_code == 401


def test_authority_user_cannot_access_applicant_profile_returns_403(
    client: TestClient, authority_test_user
) -> None:
    """Requirement 3: An authority user without applicant role is denied access (403 Forbidden)."""
    headers = {"Authorization": f"Bearer {authority_test_user['token']}"}
    response = client.get("/api/applicant/profile", headers=headers)
    assert response.status_code == 403
    err_msg = response.json().get("message") or response.json().get("detail", "")
    assert "applicants only" in err_msg.lower()


def test_profile_endpoint_ignores_foreign_query_param_strictly_scoped(
    client: TestClient, applicant_test_user
) -> None:
    """Requirement 4: Endpoint operates strictly on the token identity and ignores foreign user_id."""
    foreign_uuid = str(uuid.uuid4())
    headers = {"Authorization": f"Bearer {applicant_test_user['token']}"}
    response = client.get(f"/api/applicant/profile?user_id={foreign_uuid}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    # It must return the authenticated user's ID, NOT the foreign ID
    assert data["user_id"] == str(applicant_test_user["user"].id)
    assert data["user_id"] != foreign_uuid


def test_profile_response_never_leaks_secrets_or_password_hashes(
    client: TestClient, applicant_test_user
) -> None:
    """Requirement 6: Profile response never leaks password hashes, salt, or secrets."""
    headers = {"Authorization": f"Bearer {applicant_test_user['token']}"}
    response = client.get("/api/applicant/profile", headers=headers)
    assert response.status_code == 200
    content = response.text.lower()

    assert "password" not in content
    assert "hash" not in content
    assert "secret" not in content


def test_pillar_registry_accessible_for_applicant(client: TestClient, applicant_test_user) -> None:
    """Requirement 7: Pillar registry is accessible to applicants and lists NIVARAN."""
    headers = {
        "Authorization": f"Bearer {applicant_test_user['token']}",
        "X-User-Roles": "applicant",
    }
    response = client.get("/api/pillars", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    pillars = data["data"]["pillars"]
    slugs = [p["slug"] for p in pillars]
    assert "nivaran" in slugs
