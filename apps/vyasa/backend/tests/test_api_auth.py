import uuid
from datetime import timedelta
import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, create_access_token, decode_access_token
from app.models.user import User
from app.models.role import Role


@pytest.fixture
def auth_user(db_session: Session):
    """Fixture providing an active test applicant user with roles."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"auth_test_{unique_suffix}@csjmu.ac.in"
    password = "CorrectPassword123!"

    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        first_name="Aryabhata",
        last_name="Scholar",
        phone="+919876543210",
        is_active=True,
        is_verified=True,
    )
    # Assign standard applicant role
    applicant_role = db_session.execute(
        select(Role).where(Role.name == "applicant")
    ).scalar_one_or_none()
    if applicant_role:
        user.roles.append(applicant_role)

    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    yield {"user": user, "password": password, "email": email}

    # Teardown
    db_user = db_session.get(User, user.id)
    if db_user:
        db_session.delete(db_user)
        db_session.commit()


@pytest.fixture
def inactive_user(db_session: Session):
    """Fixture providing a deactivated test user."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"inactive_{unique_suffix}@csjmu.ac.in"
    password = "CorrectPassword123!"

    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        first_name="Deactivated",
        last_name="User",
        is_active=False,
        is_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    yield {"user": user, "password": password, "email": email}

    db_user = db_session.get(User, user.id)
    if db_user:
        db_session.delete(db_user)
        db_session.commit()


def test_01_valid_login_succeeds(client, auth_user):
    """1. Valid login succeeds returning access_token and user profile."""
    res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0
    assert data["user"]["email"] == auth_user["email"]
    assert data["user"]["id"] == str(auth_user["user"].id)
    assert "applicant" in data["user"]["roles"]


def test_02_wrong_password_returns_401(client, auth_user):
    """2. Wrong password returns 401."""
    res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": "WrongPassword999!"},
    )
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["message"]


def test_03_unknown_email_returns_401(client):
    """3. Unknown email returns 401."""
    res = client.post(
        "/api/auth/login",
        json={"email": "nonexistent_scholar_9999@csjmu.ac.in", "password": "AnyPassword123!"},
    )
    assert res.status_code == 401
    assert "Invalid email or password" in res.json()["message"]


def test_04_inactive_user_cannot_login(client, inactive_user):
    """4. Inactive user cannot login (403)."""
    res = client.post(
        "/api/auth/login",
        json={"email": inactive_user["email"], "password": inactive_user["password"]},
    )
    assert res.status_code == 403
    assert "deactivated" in res.json()["message"].lower()


def test_05_jwt_contains_canonical_claims(client, auth_user):
    """5. JWT contains canonical claims: sub, email, roles, iss, exp."""
    res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]

    decoded = decode_access_token(token, verify_issuer=True)
    assert decoded is not None
    assert decoded["sub"] == str(auth_user["user"].id)
    assert decoded["email"] == auth_user["email"]
    assert decoded["roles"] == ["applicant"]
    assert decoded["iss"] == "vyasa-core-backend"
    assert "exp" in decoded
    assert "iat" in decoded


def test_06_api_auth_me_works_with_valid_token(client, auth_user):
    """6. /api/auth/me works with valid token."""
    login_res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    token = login_res.json()["access_token"]

    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(auth_user["user"].id)
    assert data["email"] == auth_user["email"]
    assert data["first_name"] == auth_user["user"].first_name
    assert data["last_name"] == auth_user["user"].last_name
    assert "applicant" in data["roles"]


def test_07_api_auth_me_rejects_missing_token(client):
    """7. /api/auth/me rejects missing token (401)."""
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "Missing or invalid Authorization header" in res.json()["message"]


def test_08_api_auth_me_rejects_invalid_token(client):
    """8. /api/auth/me rejects invalid token (401)."""
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.garbage"})
    assert res.status_code == 401
    assert "Invalid or expired access token" in res.json()["message"]


def test_09_api_auth_me_rejects_expired_token(client, auth_user):
    """9. /api/auth/me rejects expired token (401)."""
    expired_token = create_access_token(
        data={"sub": str(auth_user["user"].id), "email": auth_user["email"]},
        expires_delta=timedelta(seconds=-30),
    )
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401


def test_10_api_auth_me_rejects_nonexistent_user(client):
    """10. /api/auth/me rejects token for nonexistent user (401)."""
    nonexistent_user_id = str(uuid.uuid4())
    token = create_access_token(
        data={"sub": nonexistent_user_id, "email": "ghost@csjmu.ac.in"},
    )
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "does not exist" in res.json()["message"].lower()


def test_11_api_auth_me_rejects_inactive_user(client, inactive_user):
    """11. /api/auth/me rejects token for inactive user (401)."""
    token = create_access_token(
        data={"sub": str(inactive_user["user"].id), "email": inactive_user["email"]},
    )
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401
    assert "deactivated" in res.json()["message"].lower()


def test_12_api_auth_verify_returns_valid_identity(client, auth_user):
    """12. /api/auth/verify returns valid identity for valid token."""
    login_res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    token = login_res.json()["access_token"]

    # Verify via JSON payload
    res = client.post("/api/auth/verify", json={"token": token})
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert data["user"]["id"] == str(auth_user["user"].id)
    assert data["user"]["email"] == auth_user["email"]
    assert "applicant" in data["user"]["roles"]

    # Also verify via Authorization header
    res_header = client.post("/api/auth/verify", headers={"Authorization": f"Bearer {token}"})
    assert res_header.status_code == 200
    assert res_header.json()["valid"] is True


def test_13_api_auth_verify_returns_false_for_invalid_token(client):
    """13. /api/auth/verify returns valid=false for invalid token."""
    res = client.post("/api/auth/verify", json={"token": "tampered.jwt.signature"})
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert data.get("user") is None


def test_14_api_auth_verify_does_not_expose_password_hash(client, auth_user):
    """14. /api/auth/verify does not expose password_hash or internal credentials."""
    login_res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    token = login_res.json()["access_token"]

    res = client.post("/api/auth/verify", json={"token": token})
    user_dict = res.json()["user"]
    assert "password_hash" not in user_dict
    assert "password" not in user_dict
    assert "salt" not in user_dict


def test_15_roles_come_dynamically_from_vyasa_db(client, auth_user, db_session):
    """15. Roles returned by /me and /verify come dynamically from VYASA DB."""
    # Add 'authority' role to user
    authority_role = db_session.execute(
        select(Role).where(Role.name == "authority")
    ).scalar_one_or_none()
    assert authority_role is not None

    db_user = db_session.get(User, auth_user["user"].id)
    db_user.roles.append(authority_role)
    db_session.commit()

    # Old token (created when user was only applicant)
    login_res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    token = login_res.json()["access_token"]

    # /api/auth/me resolves from DB
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    roles_me = res_me.json()["roles"]
    assert "authority" in roles_me
    assert "applicant" in roles_me

    # /api/auth/verify resolves from DB
    res_verify = client.post("/api/auth/verify", json={"token": token})
    assert res_verify.status_code == 200
    roles_verify = res_verify.json()["user"]["roles"]
    assert "authority" in roles_verify
    assert "applicant" in roles_verify


def test_16_client_cannot_inject_or_override_roles(client, auth_user):
    """16. Client cannot inject or override roles via request payload or headers."""
    # Attempt to inject administrator role in login body
    res_login = client.post(
        "/api/auth/login",
        json={
            "email": auth_user["email"],
            "password": auth_user["password"],
            "roles": ["administrator", "super_admin"],
        },
    )
    assert res_login.status_code == 200
    roles = res_login.json()["user"]["roles"]
    assert "administrator" not in roles
    assert "super_admin" not in roles

    token = res_login.json()["access_token"]

    # Attempt to spoof via headers on /me
    res_me = client.get(
        "/api/auth/me",
        headers={
            "Authorization": f"Bearer {token}",
            "X-User-Roles": "administrator",
            "X-Role": "administrator",
        },
    )
    assert res_me.status_code == 200
    assert "administrator" not in res_me.json()["roles"]


def test_17_no_nivaran_specific_roles_in_jwt(client, auth_user):
    """17. NIVARAN-specific role names do not appear in VYASA JWT generation."""
    res = client.post(
        "/api/auth/login",
        json={"email": auth_user["email"], "password": auth_user["password"]},
    )
    token = res.json()["access_token"]
    decoded = decode_access_token(token)

    nivaran_roles = {
        "MANAGER", "ASSISTANT_DEAN", "ASSOCIATE_DEAN", "DEAN", "GUEST_MEMBER"
    }
    token_roles = set(decoded.get("roles", []))
    assert not (token_roles & nivaran_roles), f"Found NIVARAN roles in VYASA token: {token_roles & nivaran_roles}"
