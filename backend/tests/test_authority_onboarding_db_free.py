"""
Hermetic Database-Free Integration & Security Test Suite for
Authority Onboarding, Temporary Password, First Login & Mandatory TOTP.

Enforces zero network, zero live database, fail-closed isolation.
All test cases run completely in-memory using project-standard mock sessions.
"""

import importlib.util
from pathlib import Path
import re
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import pytest
import pyotp
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_temporary_password,
)
from app.models.user import User
from app.models.role import Role
from app.models.two_factor import (
    UserTwoFactorAuth,
    TwoFactorRecoveryCode,
    AuthenticationChallenge,
    TwoFactorAttempt,
)
from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.services.admin_config_service import AdminConfigService
from app.services.two_factor_service import TwoFactorService
from app.api.dependencies import get_db, require_super_admin_user, get_current_user


def _get_err_msg(res) -> str:
    body = res.json()
    return (body.get("message") or body.get("detail") or str(body)).lower()


def _make_user(
    roles: list[str],
    email: str = "authority@csjmu.ac.in",
    is_active: bool = True,
    password: str = "Authority#2026",
    must_change_password: bool = False,
) -> User:
    u = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        first_name="Institutional",
        last_name="Authority",
        phone="+919876543210",
        is_active=is_active,
        is_verified=True,
        must_change_password=must_change_password,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    u.roles = [
        Role(
            id=uuid.uuid4(),
            name=r,
            description=f"{r} role",
            is_system=True,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            permissions=[],
        )
        for r in roles
    ]
    return u


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


@pytest.fixture
def client():
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


# =========================================================================
# 1. TEMPORARY PASSWORD GENERATION & REGISTRATION
# =========================================================================

def test_temporary_password_generation_complexity():
    """Verify backend temporary password generator produces cryptographically strong credentials."""
    for _ in range(25):
        pwd = generate_temporary_password(16)
        assert len(pwd) >= 16
        assert re.search(r"[A-Z]", pwd), "Missing uppercase letter"
        assert re.search(r"[a-z]", pwd), "Missing lowercase letter"
        assert re.search(r"\d", pwd), "Missing digit"
        assert re.search(r"[!@#$%^&*()-_=+]", pwd), "Missing special symbol"


def test_super_admin_create_authority_generates_temp_password_and_hashes():
    """
    Test that Super Admin registering a new authority:
    1. Generates a temporary password.
    2. Stores ONLY the PBKDF2 hash.
    3. Sets must_change_password=True.
    4. Attaches temporary_password transiently for initial response.
    5. Does not log plaintext password.
    """
    mock_db = MagicMock()
    mock_db.scalar.return_value = None  # No existing authority or user
    added_objs = []
    mock_db.add.side_effect = lambda obj: added_objs.append(obj)

    admin_id = uuid.uuid4()
    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Dr. New Authority",
        email="new.authority@csjmu.ac.in",
        role=NivaranRole.ASSISTANT_DEAN,
        designation="Assistant Professor",
        department="School of Engineering",
        phone="9876543210",
        actor_user_id=admin_id,
    )

    # Authority and transient password
    assert auth.name_snapshot == "Dr. New Authority"
    assert auth.email_snapshot == "new.authority@csjmu.ac.in"
    assert hasattr(auth, "temporary_password")
    assert auth.temporary_password is not None
    assert len(auth.temporary_password) >= 16

    # Verify user record created
    users = [o for o in added_objs if isinstance(o, User)]
    assert len(users) == 1
    new_user = users[0]
    assert new_user.email == "new.authority@csjmu.ac.in"
    assert new_user.must_change_password is True
    # Plaintext password is NEVER stored; only PBKDF2 hash is stored
    assert new_user.password_hash.startswith("pbkdf2_sha256$")
    assert verify_password(auth.temporary_password, new_user.password_hash) is True

    # Audit log check: password must not appear in details
    audits = [o for o in added_objs if isinstance(o, AuditLog)]
    assert len(audits) == 1
    audit_details = audits[0].details
    assert "password" not in str(audit_details).lower() or audit_details.get("must_change_password") is True
    assert auth.temporary_password not in str(audit_details)


def test_api_super_admin_creates_authority_returns_temp_password_once(client, mock_db):
    """
    Test API endpoint POST /api/admin/atharva/authorities:
    - Returns temporary_password only in the 201 Created response.
    - Subsequent GET /api/admin/atharva/authorities NEVER reveals temporary_password.
    """
    super_admin = _make_user(["super_admin"], email="sadmin@csjmu.ac.in")
    app.dependency_overrides[require_super_admin_user] = lambda: super_admin
    app.dependency_overrides[get_db] = lambda: mock_db

    now = datetime.now(timezone.utc)
    mock_auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=uuid.uuid4(),
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. API Officer",
        email_snapshot="api.officer@csjmu.ac.in",
        designation="Assistant Dean",
        department="Computer Science",
        is_active=True,
        created_at=now,
        updated_at=now,
    )
    mock_auth.temporary_password = "SecureTemp#Pass2026"

    with patch.object(AdminConfigService, "create_authority", return_value=mock_auth):
        res = client.post(
            "/api/admin/atharva/authorities",
            json={
                "name": "Dr. API Officer",
                "email": "api.officer@csjmu.ac.in",
                "role": "ASSISTANT_DEAN",
                "designation": "Assistant Dean",
                "department": "Computer Science",
            },
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["temporary_password"] == "SecureTemp#Pass2026"
        assert data["onboarding_status"] == "PASSWORD_CHANGE_REQUIRED"

    # Now verify GET list authorities never returns temporary_password
    mock_db.execute.return_value.scalars.return_value.all.return_value = [mock_auth]
    res_list = client.get("/api/admin/atharva/authorities")
    assert res_list.status_code == 200
    authorities = res_list.json()["data"]["authorities"]
    assert len(authorities) == 1
    assert authorities[0]["temporary_password"] is None


def test_unauthorized_user_cannot_register_authority(client, mock_db):
    """Non-super-admin caller must be strictly forbidden (403 or 401)."""
    app.dependency_overrides[get_db] = lambda: mock_db
    # No auth header -> 401
    res = client.post(
        "/api/admin/atharva/authorities",
        json={"name": "Attacker", "email": "attacker@csjmu.ac.in", "role": "MANAGER"},
    )
    assert res.status_code in (401, 403)

    # Authority or Applicant caller -> 403
    applicant = _make_user(["applicant"], email="applicant@csjmu.ac.in")
    app.dependency_overrides[get_current_user] = lambda: applicant
    res_app = client.post(
        "/api/admin/atharva/authorities",
        json={"name": "Attacker", "email": "attacker@csjmu.ac.in", "role": "MANAGER"},
    )
    assert res_app.status_code == 403


# =========================================================================
# 2. FIRST-LOGIN AUTHENTICATION GATEWAY
# =========================================================================

def test_first_login_with_temp_password_issues_password_change_challenge_no_token(client, mock_db):
    """
    When an authority logs in with must_change_password=True:
    1. Validates temporary password.
    2. Detects must_change_password=True.
    3. Issues challenge with purpose PASSWORD_CHANGE_REQUIRED.
    4. NO full JWT access token is issued.
    """
    temp_pwd = "Temp#Password2026"
    authority = _make_user(
        ["authority"],
        email="new.dean@csjmu.ac.in",
        password=temp_pwd,
        must_change_password=True,
    )

    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = authority
    mock_db.scalar.side_effect = [
        0,  # is_rate_limited
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "new.dean@csjmu.ac.in", "password": temp_pwd},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_password_change"] is True
    assert data["requires_two_factor"] is False
    assert data["challenge_id"] is not None
    # CRITICAL: No access token is issued!
    assert data.get("access_token") is None
    assert data.get("user") is None


def test_onboarding_user_cannot_access_protected_apis_via_get_current_user(mock_db):
    """If must_change_password is True, get_current_user strictly raises 403 Forbidden."""
    uncompleted_user = _make_user(
        ["authority"],
        email="onboarding@csjmu.ac.in",
        must_change_password=True,
    )
    token = create_access_token({"sub": str(uncompleted_user.id), "email": uncompleted_user.email})

    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = uncompleted_user

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(authorization=f"Bearer {token}", db=mock_db)
    assert exc_info.value.status_code == 403
    assert "Password change required" in exc_info.value.detail


# =========================================================================
# 3. PERMANENT PASSWORD SETUP
# =========================================================================

def test_set_permanent_password_success_advances_to_mandatory_totp(client, mock_db):
    """
    Valid first-login challenge:
    1. Replaces temporary password hash.
    2. Clears must_change_password=False atomically.
    3. Consumes the first-login challenge.
    4. Automatically issues TWO_FACTOR_SETUP challenge (no full access token yet).
    """
    temp_pwd = "Temp#Password2026"
    permanent_pwd = "Permanent#Secret2026"
    user = _make_user(
        ["authority"],
        email="authority.firstlogin@csjmu.ac.in",
        password=temp_pwd,
        must_change_password=True,
    )

    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="PASSWORD_CHANGE_REQUIRED",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        created_at=datetime.now(timezone.utc),
    )

    mock_db.scalar.side_effect = [
        challenge,  # get_valid_challenge
        user,       # select user
        None,       # UserTwoFactorAuth (unenrolled)
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/first-login/set-password",
        json={
            "challenge_id": str(challenge_id),
            "new_password": permanent_pwd,
            "confirm_password": permanent_pwd,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_password_change"] is False
    assert data["requires_two_factor"] is True
    assert data["two_factor_setup_required"] is True
    assert data["challenge_id"] is not None
    # Still NO normal access token before TOTP verification!
    assert data.get("access_token") is None

    # Verify user state updated
    assert user.must_change_password is False
    assert verify_password(permanent_pwd, user.password_hash) is True
    assert verify_password(temp_pwd, user.password_hash) is False
    # Challenge consumed
    assert challenge.consumed_at is not None


def test_set_permanent_password_rejects_reusing_temporary_password(client, mock_db):
    """User cannot reuse their temporary password as their permanent password."""
    temp_pwd = "Temp#Password2026"
    user = _make_user(
        ["authority"],
        email="reuse@csjmu.ac.in",
        password=temp_pwd,
        must_change_password=True,
    )

    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="PASSWORD_CHANGE_REQUIRED",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        created_at=datetime.now(timezone.utc),
    )

    mock_db.scalar.side_effect = [
        challenge,  # get_valid_challenge
        user,       # select user
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/first-login/set-password",
        json={
            "challenge_id": str(challenge_id),
            "new_password": temp_pwd,
            "confirm_password": temp_pwd,
        },
    )
    assert res.status_code == 400
    assert "cannot be identical to the temporary password" in _get_err_msg(res)
    # must_change_password remains True
    assert user.must_change_password is True
    assert challenge.consumed_at is None


def test_set_permanent_password_rejects_expired_or_consumed_challenge(client, mock_db):
    """Challenge must be unconsumed and unexpired."""
    mock_db.scalar.return_value = None  # get_valid_challenge returns None (expired/consumed)
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/first-login/set-password",
        json={
            "challenge_id": str(uuid.uuid4()),
            "new_password": "Valid#Password2026",
            "confirm_password": "Valid#Password2026",
        },
    )
    assert res.status_code == 400
    assert "invalid or expired" in _get_err_msg(res)


def test_set_permanent_password_enforces_complexity_and_matching(client, mock_db):
    """Rejects passwords that fail complexity or confirmation mismatch."""
    app.dependency_overrides[get_db] = lambda: mock_db

    # Mismatch
    res_mismatch = client.post(
        "/api/auth/first-login/set-password",
        json={
            "challenge_id": str(uuid.uuid4()),
            "new_password": "Password#1234",
            "confirm_password": "Different#Password1234",
        },
    )
    assert res_mismatch.status_code == 400
    assert "do not match" in _get_err_msg(res_mismatch)

    # Weak (no uppercase)
    res_weak = client.post(
        "/api/auth/first-login/set-password",
        json={
            "challenge_id": str(uuid.uuid4()),
            "new_password": "password1234",
            "confirm_password": "password1234",
        },
    )
    assert res_weak.status_code in (400, 422)


# =========================================================================
# 4. MANDATORY TOTP ENROLLMENT FOR ONBOARDING AUTHORITY
# =========================================================================

def test_authority_cannot_bypass_totp_to_get_session(client, mock_db):
    """
    Attempting to confirm TOTP while must_change_password is True is rejected with 403.
    """
    user = _make_user(["authority"], email="bypass@csjmu.ac.in", must_change_password=True)
    challenge = AuthenticationChallenge(
        id=uuid.uuid4(),
        user_id=user.id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        created_at=datetime.now(timezone.utc),
    )

    mock_db.scalar.side_effect = [
        challenge,  # get_valid_challenge
        user,       # select user (must_change_password=True)
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/confirm-setup",
        json={"challenge_id": str(challenge.id), "code": "123456"},
    )
    assert res.status_code == 403
    assert "permanent password change required" in _get_err_msg(res)


def test_full_onboarding_lifecycle_succeeds(client, mock_db):
    """
    Full end-to-end state machine verification:
    1. First login with temporary password -> PASSWORD_CHANGE_REQUIRED challenge.
    2. Set permanent password -> TWO_FACTOR_SETUP challenge.
    3. Request TOTP setup -> returns QR code & manual key.
    4. Confirm TOTP with valid 6-digit OTP -> full access token & recovery codes issued!
    """
    temp_pwd = "Initial#TempPass2026"
    permanent_pwd = "MyNewPermanent#Pass2026"
    user = _make_user(
        ["authority"],
        email="e2e.authority@csjmu.ac.in",
        password=temp_pwd,
        must_change_password=True,
    )

    # Step 1: Login with temporary password
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = user
    mock_db.scalar.side_effect = [0]  # rate limit check
    app.dependency_overrides[get_db] = lambda: mock_db

    res1 = client.post(
        "/api/auth/login",
        json={"email": user.email, "password": temp_pwd},
    )
    assert res1.status_code == 200
    assert res1.json()["requires_password_change"] is True
    first_login_cid = res1.json()["challenge_id"]

    # Step 2: Set Permanent Password
    pw_challenge = AuthenticationChallenge(
        id=uuid.UUID(first_login_cid),
        user_id=user.id,
        purpose="PASSWORD_CHANGE_REQUIRED",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        created_at=datetime.now(timezone.utc),
    )
    mock_db.scalar.side_effect = [
        pw_challenge,
        user,
        None,  # unenrolled 2FA
    ]

    res2 = client.post(
        "/api/auth/first-login/set-password",
        json={
            "challenge_id": first_login_cid,
            "new_password": permanent_pwd,
            "confirm_password": permanent_pwd,
        },
    )
    assert res2.status_code == 200
    assert res2.json()["requires_two_factor"] is True
    assert res2.json()["two_factor_setup_required"] is True
    totp_cid = res2.json()["challenge_id"]

    # Step 3: Get 2FA Setup QR / Key
    setup_challenge = AuthenticationChallenge(
        id=uuid.UUID(totp_cid),
        user_id=user.id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        created_at=datetime.now(timezone.utc),
    )
    mock_db.scalar.side_effect = [
        setup_challenge,
        user,
        None,  # 2fa row (created on the fly)
    ]

    res3 = client.post(
        "/api/auth/2fa/setup",
        json={"challenge_id": totp_cid},
    )
    assert res3.status_code == 200
    setup_data = res3.json()
    raw_secret = setup_data["manual_setup_key"]
    assert len(raw_secret) == 32

    # Step 4: Confirm 2FA Setup with valid current OTP
    totp = pyotp.TOTP(raw_secret)
    valid_code = totp.now()

    two_factor_entry = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=False,
    )
    mock_db.scalar.side_effect = [
        setup_challenge,
        user,
        two_factor_entry,
        None,  # NivaranAuthority
        None,  # ApplicantProfile
        None,  # StudentMasterRecord
    ]

    res4 = client.post(
        "/api/auth/2fa/confirm-setup",
        json={"challenge_id": totp_cid, "code": valid_code},
    )
    assert res4.status_code == 200
    final_data = res4.json()
    assert final_data.get("access_token") is not None
    assert final_data.get("token_type") == "bearer"
    assert len(final_data.get("recovery_codes")) == 10
    assert two_factor_entry.is_enabled is True


# =========================================================================
# 5. RETURNING AUTHORITY & EXISTING ACCOUNT REGRESSION TESTS
# =========================================================================

def test_returning_authority_follows_standard_totp_login_no_password_change(client, mock_db):
    """
    Returning authority with permanent password (must_change_password=False):
    Does NOT prompt for password change, directly enters standard TOTP login.
    """
    authority = _make_user(
        ["authority"],
        email="returning.dean@csjmu.ac.in",
        password="Permanent#Password2026",
        must_change_password=False,
    )
    enrolled_2fa = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=authority.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(TwoFactorService.generate_totp_secret()),
        is_enabled=True,
    )

    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = authority
    mock_db.scalar.side_effect = [
        0,             # is_rate_limited
        enrolled_2fa,  # enrolled
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": authority.email, "password": "Permanent#Password2026"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data.get("requires_password_change") is False
    assert data["requires_two_factor"] is True
    assert data["two_factor_setup_required"] is False
    assert data["challenge_id"] is not None


def test_existing_super_admin_unaffected(client, mock_db):
    """
    Existing Super Admin account retains exact existing login flow.
    Never prompted for first-login authority onboarding.
    """
    sadmin = _make_user(
        ["super_admin"],
        email="sadmin@csjmu.ac.in",
        password="SuperAdmin#Password2026",
        must_change_password=False,
    )
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = sadmin
    mock_db.scalar.side_effect = [
        0,     # rate limit
        None,  # unenrolled 2fa
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": sadmin.email, "password": "SuperAdmin#Password2026"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data.get("requires_password_change") is False
    assert data["requires_two_factor"] is True


def test_applicant_login_unaffected(client, mock_db):
    """
    Existing applicants bypass 2FA and authority onboarding completely, directly receiving session.
    """
    applicant = _make_user(
        ["applicant"],
        email="scholar@csjmu.ac.in",
        password="Scholar#Password2026",
        must_change_password=False,
    )
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = applicant
    mock_db.scalar.side_effect = [
        0,     # rate limit
        None,  # NivaranAuthority lookup (is_2fa_mandatory -> False)
        None,  # NivaranAuthority
        None,  # ApplicantProfile
        None,  # StudentMasterRecord
    ]
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": applicant.email, "password": "Scholar#Password2026"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data.get("requires_password_change") is False
    assert data.get("requires_two_factor") is False
    assert data.get("access_token") is not None


# =========================================================================
# 6. ALEMBIC MIGRATION INTEGRITY
# =========================================================================

def test_migration_revision_chain():
    """Verify migration 8b29c54e1017 correctly links to 8b29c54e1016."""
    migration_path = (
        Path(__file__).resolve().parent.parent
        / "alembic"
        / "versions"
        / "8b29c54e1017_add_must_change_password_to_users.py"
    )
    assert migration_path.exists(), f"Migration file missing at {migration_path}"

    spec = importlib.util.spec_from_file_location("migration_8b29c54e1017", str(migration_path))
    migration_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_mod)

    assert migration_mod.revision == "8b29c54e1017"
    assert migration_mod.down_revision == "8b29c54e1016"
    assert callable(migration_mod.upgrade)
    assert callable(migration_mod.downgrade)
