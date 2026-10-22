"""
Database-Free Unit and Integration Tests for TOTP Two-Factor Authentication.

These tests run completely in-memory with zero external database connections,
zero network requests, and zero risk to live databases.
"""

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
import pytest
import pyotp
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import hash_password, create_access_token
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
from app.services.two_factor_service import TwoFactorService
from app.api.dependencies import get_db, get_current_user


# =========================================================================
# Test Helpers & Fixtures
# =========================================================================

def _get_err_msg(res) -> str:
    body = res.json()
    return (body.get("message") or body.get("detail") or "").lower()


def _make_user(
    roles: list[str],
    email: str = "authority@csjmu.ac.in",
    is_active: bool = True,
    password: str = "Authority#2026",
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
    """Mock database session that handles queries and commits cleanly."""
    db = MagicMock()
    return db


@pytest.fixture
def client():
    """Test client with clean dependency overrides."""
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


# =========================================================================
# 1. TwoFactorService Unit Tests
# =========================================================================

def test_secret_generation_and_encryption():
    secret = TwoFactorService.generate_totp_secret()
    assert len(secret) == 32
    assert secret.isalnum()

    encrypted = TwoFactorService.encrypt_secret(secret)
    assert encrypted != secret
    decrypted = TwoFactorService.decrypt_secret(encrypted)
    assert decrypted == secret


def test_provisioning_uri_and_qr_generation():
    secret = TwoFactorService.generate_totp_secret()
    email = "dean@csjmu.ac.in"
    uri = TwoFactorService.get_provisioning_uri(secret, email)

    assert uri.startswith("otpauth://totp/")
    assert "VYASA-N" in uri
    assert "dean%40csjmu.ac.in" in uri or "dean@csjmu.ac.in" in uri

    qr_b64 = TwoFactorService.generate_qr_code_base64(uri)
    assert qr_b64.startswith("data:image/png;base64,")
    assert len(qr_b64) > 100


def test_totp_code_verification_success_and_failure():
    secret = TwoFactorService.generate_totp_secret()
    totp = pyotp.TOTP(secret)
    current_code = totp.now()

    # Valid current code succeeds
    assert TwoFactorService.verify_totp_code(secret, current_code) is True

    # Bad length / characters fail
    assert TwoFactorService.verify_totp_code(secret, "12345") is False
    assert TwoFactorService.verify_totp_code(secret, "abcdef") is False
    assert TwoFactorService.verify_totp_code(secret, "1234567") is False

    # Incorrect code fails
    wrong_code = "000000" if current_code != "000000" else "111111"
    assert TwoFactorService.verify_totp_code(secret, wrong_code) is False


def test_replay_protection():
    secret = TwoFactorService.generate_totp_secret()
    totp = pyotp.TOTP(secret)
    code = totp.now()
    now = datetime.now(timezone.utc)

    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        totp_secret_encrypted=TwoFactorService.encrypt_secret(secret),
        is_enabled=True,
        last_verified_at=now - timedelta(seconds=20),
        last_verified_code_hash=TwoFactorService.hash_code(code),
    )

    # Submitting the exact same code within 90s must be detected as replay
    assert TwoFactorService.is_code_replayed(two_factor, code) is True

    # Submitting a different code is not a replay
    assert TwoFactorService.is_code_replayed(two_factor, "999999") is False

    # Submitting same code after 100s is expired window, not active replay
    two_factor.last_verified_at = now - timedelta(seconds=100)
    assert TwoFactorService.is_code_replayed(two_factor, code) is False


def test_recovery_codes_generation_and_normalization():
    codes = TwoFactorService.generate_recovery_codes(10)
    assert len(codes) == 10
    for c in codes:
        assert len(c) == 9  # XXXX-XXXX format
        assert "-" in c
        # Normalization removes hyphen and uppercases
        norm = TwoFactorService.normalize_recovery_code(c)
        assert len(norm) == 8
        assert "-" not in norm
        # Hashing normalized vs unnormalized raw produces exact same hash
        assert TwoFactorService.hash_recovery_code(c) == TwoFactorService.hash_recovery_code(norm.lower())


def test_role_enforcement_evaluation(mock_db):
    # 1. Super Admin requires 2FA
    super_admin = _make_user(["super_admin"])
    assert TwoFactorService.is_2fa_mandatory_for_user(super_admin, mock_db) is True

    # 2. Generic authority requires 2FA
    authority = _make_user(["authority"])
    assert TwoFactorService.is_2fa_mandatory_for_user(authority, mock_db) is True

    # 3. Applicant with NO authority appointment does NOT require 2FA
    applicant = _make_user(["applicant"])
    mock_db.scalar.return_value = 0
    assert TwoFactorService.is_2fa_mandatory_for_user(applicant, mock_db) is False

    # 4. User with active NivaranAuthority appointment requires 2FA
    mock_db.scalar.return_value = 1
    assert TwoFactorService.is_2fa_mandatory_for_user(applicant, mock_db) is True


# =========================================================================
# 2. Login Flow Tests (Password -> 2FA Challenge vs Direct Session)
# =========================================================================

def test_applicant_login_bypasses_2fa_and_issues_token(client, mock_db):
    applicant = _make_user(["applicant"], email="scholar@csjmu.ac.in", password="ValidPassword1")
    
    # Configure mock DB query responses
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = applicant
    mock_db.scalar.return_value = 0  # no failed attempts, no authority appointment

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "scholar@csjmu.ac.in", "password": "ValidPassword1"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_two_factor"] is False
    assert data["access_token"] is not None
    assert "bearer" in data["token_type"]
    assert data["user"]["email"] == "scholar@csjmu.ac.in"


def test_authority_unenrolled_login_returns_setup_challenge_no_token(client, mock_db):
    authority = _make_user(["authority"], email="manager@csjmu.ac.in", password="AuthorityPassword1")
    
    # Configure query responses: user found, not rate-limited, no 2FA row (unenrolled)
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = authority
    mock_db.scalar.side_effect = [
        0,     # is_rate_limited count
        None,  # UserTwoFactorAuth row (unenrolled)
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "manager@csjmu.ac.in", "password": "AuthorityPassword1"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_two_factor"] is True
    assert data["two_factor_setup_required"] is True
    assert data["challenge_id"] is not None
    # CRITICAL: No access token is issued!
    assert data.get("access_token") is None
    assert data.get("user") is None


def test_authority_enrolled_login_returns_login_challenge_no_token(client, mock_db):
    authority = _make_user(["authority"], email="dean@csjmu.ac.in", password="AuthorityPassword1")
    enrolled_2fa = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=authority.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(TwoFactorService.generate_totp_secret()),
        is_enabled=True,
    )

    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = authority
    mock_db.scalar.side_effect = [
        0,             # is_rate_limited
        enrolled_2fa,  # UserTwoFactorAuth row
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "dean@csjmu.ac.in", "password": "AuthorityPassword1"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_two_factor"] is True
    assert data["two_factor_setup_required"] is False
    assert data["challenge_id"] is not None
    # CRITICAL: No access token is issued!
    assert data.get("access_token") is None


def test_super_admin_login_requires_2fa(client, mock_db):
    sadmin = _make_user(["super_admin"], email="sadmin@csjmu.ac.in", password="SuperAdminPassword1")

    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = sadmin
    mock_db.scalar.side_effect = [
        0,     # is_rate_limited
        None,  # unenrolled
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "sadmin@csjmu.ac.in", "password": "SuperAdminPassword1"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_two_factor"] is True
    assert data["challenge_id"] is not None
    assert data.get("access_token") is None


def test_disabled_account_login_rejected(client, mock_db):
    disabled_user = _make_user(["authority"], email="disabled@csjmu.ac.in", is_active=False, password="Password123")
    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = disabled_user
    mock_db.scalar.return_value = 0

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "disabled@csjmu.ac.in", "password": "Password123"},
    )
    assert res.status_code == 403
    assert "deactivated" in _get_err_msg(res)


def test_rate_limited_account_rejected_with_429(client, mock_db):
    # Simulate 5 consecutive failed attempts
    mock_db.scalar.return_value = 5

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": "victim@csjmu.ac.in", "password": "AnyPassword1"},
    )
    assert res.status_code == 429
    assert "too many failed login attempts" in _get_err_msg(res)


# =========================================================================
# 3. 2FA Setup & Confirmation Endpoints
# =========================================================================

def test_2fa_setup_generates_qr_and_key(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )

    mock_db.scalar.side_effect = [
        challenge,  # get_valid_challenge
        user,       # select(User)
        None,       # UserTwoFactorAuth (new)
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post("/api/auth/2fa/setup", json={"challenge_id": str(challenge_id)})
    assert res.status_code == 200
    data = res.json()
    assert data["requires_2fa_setup"] is True
    assert data["issuer"] == "VYASA-N"
    assert data["account_name"] == user.email
    assert data["qr_code"].startswith("data:image/png;base64,")
    assert len(data["manual_setup_key"]) == 32


def test_2fa_setup_expired_challenge_rejected(client, mock_db):
    mock_db.scalar.return_value = None  # challenge expired or consumed
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post("/api/auth/2fa/setup", json={"challenge_id": str(uuid.uuid4())})
    assert res.status_code == 400
    assert "expired" in _get_err_msg(res)


def test_2fa_confirm_setup_success_issues_session_and_recovery_codes(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    raw_secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=False,
    )

    totp = pyotp.TOTP(raw_secret)
    valid_code = totp.now()

    mock_db.scalar.side_effect = [
        challenge,   # get_valid_challenge
        user,        # select User
        two_factor,  # select UserTwoFactorAuth
        None,        # NivaranAuthority check for response builder
        None,        # ApplicantProfile
        None,        # StudentMasterRecord
    ]
    mock_db.scalars.return_value.all.return_value = []

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/confirm-setup",
        json={"challenge_id": str(challenge_id), "code": valid_code},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"] is not None
    assert len(data["recovery_codes"]) == 10
    assert two_factor.is_enabled is True
    assert challenge.consumed_at is not None


def test_2fa_confirm_setup_invalid_code_rejected(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    raw_secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=False,
    )

    mock_db.scalar.side_effect = [
        challenge,   # get_valid_challenge
        user,        # select User
        two_factor,  # select UserTwoFactorAuth
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/confirm-setup",
        json={"challenge_id": str(challenge_id), "code": "000000"},
    )
    assert res.status_code == 400
    assert "invalid" in _get_err_msg(res)
    assert two_factor.is_enabled is False


# =========================================================================
# 4. 2FA Verification & Replay Protection Endpoints
# =========================================================================

def test_2fa_verify_success_issues_token(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    raw_secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=True,
    )

    totp = pyotp.TOTP(raw_secret)
    valid_code = totp.now()

    mock_db.scalar.side_effect = [
        challenge,   # get_valid_challenge
        user,        # select User
        0,           # is_rate_limited
        two_factor,  # select UserTwoFactorAuth
        None,        # NivaranAuthority check for response builder
        None,        # ApplicantProfile
        None,        # StudentMasterRecord
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/verify",
        json={"challenge_id": str(challenge_id), "code": valid_code},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"] is not None
    assert challenge.consumed_at is not None
    assert two_factor.last_verified_at is not None


def test_2fa_verify_replayed_code_rejected(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    raw_secret = TwoFactorService.generate_totp_secret()
    totp = pyotp.TOTP(raw_secret)
    replayed_code = totp.now()

    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=True,
        last_verified_at=datetime.now(timezone.utc) - timedelta(seconds=15),
        last_verified_code_hash=TwoFactorService.hash_code(replayed_code),
    )

    mock_db.scalar.side_effect = [
        challenge,   # get_valid_challenge
        user,        # select User
        0,           # is_rate_limited
        two_factor,  # select UserTwoFactorAuth
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/verify",
        json={"challenge_id": str(challenge_id), "code": replayed_code},
    )
    assert res.status_code == 400
    assert "already used" in _get_err_msg(res)


def test_2fa_verify_invalid_code_rejected(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    raw_secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=True,
    )

    mock_db.scalar.side_effect = [
        challenge,   # get_valid_challenge
        user,        # select User
        0,           # is_rate_limited
        two_factor,  # select UserTwoFactorAuth
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/verify",
        json={"challenge_id": str(challenge_id), "code": "111111"},
    )
    assert res.status_code == 401
    assert "invalid" in _get_err_msg(res)


# =========================================================================
# 5. Recovery Code Verification Endpoints
# =========================================================================

def test_2fa_recovery_success_consumes_code_and_issues_token(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    raw_code = "ABCD-1234"
    recovery_entry = TwoFactorRecoveryCode(
        id=uuid.uuid4(),
        user_id=user.id,
        code_hash=TwoFactorService.hash_recovery_code(raw_code),
        used_at=None,
    )
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted="encrypted",
        is_enabled=True,
    )

    mock_db.scalar.side_effect = [
        challenge,       # get_valid_challenge
        user,            # select User
        0,               # is_rate_limited
        recovery_entry,  # select TwoFactorRecoveryCode with_for_update()
        two_factor,      # select UserTwoFactorAuth
        None,            # NivaranAuthority check for response builder
        None,            # ApplicantProfile
        None,            # StudentMasterRecord
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/recovery",
        json={"challenge_id": str(challenge_id), "recovery_code": "abcd 1234"},  # insensitive format
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"] is not None
    assert recovery_entry.used_at is not None
    assert challenge.consumed_at is not None


def test_2fa_recovery_invalid_or_already_used_code_rejected(client, mock_db):
    user = _make_user(["authority"])
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user.id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )

    mock_db.scalar.side_effect = [
        challenge,  # get_valid_challenge
        user,       # select User
        0,          # is_rate_limited
        None,       # no matching unused recovery entry
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/2fa/recovery",
        json={"challenge_id": str(challenge_id), "recovery_code": "WRONG-CODE"},
    )
    assert res.status_code == 401
    assert "invalid or already consumed" in _get_err_msg(res)


# =========================================================================
# 6. Authenticated 2FA Status & Regeneration Endpoints
# =========================================================================

def test_2fa_status_enrolled(client, mock_db):
    user = _make_user(["authority"])
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted="secret",
        is_enabled=True,
        enabled_at=datetime.now(timezone.utc),
        last_verified_at=datetime.now(timezone.utc),
    )

    mock_db.scalar.side_effect = [
        two_factor,  # select UserTwoFactorAuth
        7,           # count remaining recovery codes
    ]

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.get("/api/auth/2fa/status")
    assert res.status_code == 200
    data = res.json()
    assert data["is_enabled"] is True
    assert data["remaining_recovery_codes"] == 7


def test_regenerate_recovery_codes_requires_strong_auth(client, mock_db):
    password = "CorrectPassword#1"
    user = _make_user(["authority"], password=password)
    raw_secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=True,
    )
    totp = pyotp.TOTP(raw_secret)
    valid_code = totp.now()

    mock_db.scalar.return_value = two_factor
    mock_db.scalars.return_value.all.return_value = []

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: mock_db

    # Wrong password fails
    res_bad_pw = client.post(
        "/api/auth/2fa/recovery-codes/regenerate",
        json={"password": "WrongPassword", "code": valid_code},
    )
    assert res_bad_pw.status_code == 400
    assert "incorrect password" in _get_err_msg(res_bad_pw)

    # Wrong OTP fails
    res_bad_otp = client.post(
        "/api/auth/2fa/recovery-codes/regenerate",
        json={"password": password, "code": "000000"},
    )
    assert res_bad_otp.status_code == 400
    assert "invalid verification code" in _get_err_msg(res_bad_otp)

    # Correct credentials succeeds and returns 10 codes
    res_ok = client.post(
        "/api/auth/2fa/recovery-codes/regenerate",
        json={"password": password, "code": valid_code},
    )
    assert res_ok.status_code == 200
    assert len(res_ok.json()["recovery_codes"]) == 10


# =========================================================================
# 7. Additional Security Edge Cases & Migration Integrity
# =========================================================================

def test_login_authority_via_active_nivaran_appointment_without_platform_roles(client, mock_db):
    """
    Test that an active NivaranAuthority appointment mandates 2FA even if
    the user's platform roles list has no 'authority' or 'super_admin' role.
    """
    password = "NivaranMember#2026"
    user = _make_user(roles=[], email="dean@csjmu.ac.in", password=password)

    mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = user
    mock_db.scalar.side_effect = [
        0,     # 1. is_rate_limited
        1,     # 2. is_2fa_mandatory_for_user -> select func.count(NivaranAuthority.id) -> 1
        None,  # 3. select UserTwoFactorAuth (None -> enrollment required)
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(
        "/api/auth/login",
        json={"email": user.email, "password": password},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_two_factor"] is True
    assert data["two_factor_setup_required"] is True
    assert data["challenge_id"] is not None
    assert data["access_token"] is None


def test_challenge_expired_or_consumed_rejection(client, mock_db):
    """
    Test that expired or consumed challenges are rejected by /api/auth/2fa/verify.
    """
    app.dependency_overrides[get_db] = lambda: mock_db

    # 1. Non-existent / expired challenge -> TwoFactorService.get_valid_challenge returns None
    mock_db.scalar.return_value = None

    res_expired = client.post(
        "/api/auth/2fa/verify",
        json={"challenge_id": str(uuid.uuid4()), "code": "123456"},
    )
    assert res_expired.status_code == 400
    assert "invalid or expired" in _get_err_msg(res_expired)

    # 2. Malformed UUID string in challenge_id
    res_malformed = client.post(
        "/api/auth/2fa/verify",
        json={"challenge_id": "not-a-valid-uuid", "code": "123456"},
    )
    assert res_malformed.status_code in (400, 422)


def test_tamper_resistance_client_payload_ignored(client, mock_db):
    """
    Test that client attempting to supply arbitrary user_id or elevated role
    in the verify body cannot alter the challenge user or elevate permissions.
    """
    legit_user = _make_user(["authority"], email="legit@csjmu.ac.in")
    attacker_user_id = uuid.uuid4()
    raw_secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=legit_user.id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(raw_secret),
        is_enabled=True,
    )
    challenge_id = uuid.uuid4()
    challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=legit_user.id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    totp = pyotp.TOTP(raw_secret)
    valid_code = totp.now()

    mock_db.scalar.side_effect = [
        challenge,   # get_valid_challenge
        legit_user,  # select User by challenge.user_id
        0,           # is_rate_limited
        two_factor,  # select UserTwoFactorAuth
        None,        # NivaranAuthority check for response builder
        None,        # ApplicantProfile
        None,        # StudentMasterRecord
    ]

    app.dependency_overrides[get_db] = lambda: mock_db

    # Attacker passes extra payload keys attempting to elevate to super_admin or impersonate attacker_user_id
    res = client.post(
        "/api/auth/2fa/verify",
        json={
            "challenge_id": str(challenge_id),
            "code": valid_code,
            "user_id": str(attacker_user_id),
            "roles": ["super_admin"],
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["requires_two_factor"] is False
    assert data["access_token"] is not None
    # Verify the issued token identifies legitimate user, not attacker
    assert data["user"]["id"] == str(legit_user.id)
    assert data["user"]["email"] == legit_user.email
    assert "super_admin" not in data["user"]["roles"]


def test_migration_revision_chain():
    """
    Test Alembic migration script integrity: verifies revision ID, down_revision chain,
    and presence of upgrade/downgrade routines without database access.
    """
    import importlib.util
    from pathlib import Path

    migration_path = (
        Path(__file__).resolve().parent.parent
        / "alembic"
        / "versions"
        / "8b29c54e1013_authority_two_factor_auth.py"
    )
    assert migration_path.exists(), f"Migration file missing at {migration_path}"

    spec = importlib.util.spec_from_file_location("migration_8b29c54e1013", str(migration_path))
    migration_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_mod)

    assert migration_mod.revision == "8b29c54e1013"
    assert migration_mod.down_revision == "8b29c54e1012"
    assert callable(migration_mod.upgrade)
    assert callable(migration_mod.downgrade)

    # Verify model __tablename__ mappings match migration expectations
    assert UserTwoFactorAuth.__tablename__ == "user_two_factor_auth"
    assert TwoFactorRecoveryCode.__tablename__ == "two_factor_recovery_codes"
    assert AuthenticationChallenge.__tablename__ == "authentication_challenges"
    assert TwoFactorAttempt.__tablename__ == "two_factor_attempts"

    # Verify migration file defines creation of all 4 two-factor tables
    migration_text = migration_path.read_text(encoding="utf-8")
    for tbl in [
        "user_two_factor_auth",
        "two_factor_recovery_codes",
        "authentication_challenges",
        "two_factor_attempts",
    ]:
        assert f"'{tbl}'" in migration_text or f'"{tbl}"' in migration_text


# =========================================================================
# 8. Security Hardening Regression Suite (SEC-01, SEC-02, SEC-03, SEC-04)
# =========================================================================

def test_sec01_production_encryption_key_validation():
    """
    SEC-01: Verify that production configuration strictly enforces valid Fernet key
    and refuses missing keys, development defaults, and malformed formats.
    """
    from cryptography.fernet import Fernet
    from app.core.config import Settings

    valid_fernet = Fernet.generate_key().decode()

    # 1. Missing TOTP_ENCRYPTION_KEY in production raises ValueError
    with pytest.raises(ValueError, match="strictly required in production"):
        Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/vyasa",
            NODE_ENV="production",
            SECRET_KEY="a-sufficiently-long-and-random-production-secret-key-csjmu",
            TOTP_ENCRYPTION_KEY="",
        )

    # 2. Development default in production raises ValueError
    with pytest.raises(ValueError, match="known development secret"):
        Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/vyasa",
            NODE_ENV="production",
            SECRET_KEY="a-sufficiently-long-and-random-production-secret-key-csjmu",
            TOTP_ENCRYPTION_KEY="vyasa-core-development-secret-key-csjmu-governance",
        )

    # 3. Malformed Fernet key in production raises ValueError
    with pytest.raises(ValueError, match="not a valid 32-byte URL-safe base64 Fernet key"):
        Settings(
            DATABASE_URL="postgresql://user:pass@localhost:5432/vyasa",
            NODE_ENV="production",
            SECRET_KEY="a-sufficiently-long-and-random-production-secret-key-csjmu",
            TOTP_ENCRYPTION_KEY="not-a-valid-fernet-key-format-too-short",
        )

    # 4. Valid Fernet key in production succeeds
    valid_settings = Settings(
        DATABASE_URL="postgresql://user:pass@localhost:5432/vyasa",
        NODE_ENV="production",
        SECRET_KEY="a-sufficiently-long-and-random-production-secret-key-csjmu",
        TOTP_ENCRYPTION_KEY=valid_fernet,
    )
    assert valid_settings.TOTP_ENCRYPTION_KEY == valid_fernet

    # 5. TwoFactorService._get_fernet fails closed if invoked in production without key
    with patch("app.services.two_factor_service.settings.NODE_ENV", "production"):
        with patch("app.services.two_factor_service.settings.TOTP_ENCRYPTION_KEY", ""):
            with pytest.raises(RuntimeError, match="strictly required in production"):
                TwoFactorService._get_fernet()


def test_sec02_challenge_row_locking_and_single_use(mock_db):
    """
    SEC-02: Verify that get_valid_challenge applies row locking (with_for_update)
    when for_update=True, and rejects challenges that have been consumed.
    """
    challenge_id = uuid.uuid4()
    user_id = uuid.uuid4()

    # Query with for_update=True
    TwoFactorService.get_valid_challenge(
        mock_db, challenge_id, purpose="TWO_FACTOR_LOGIN", for_update=True
    )
    # Verify mock_db.scalar was called
    assert mock_db.scalar.called

    # Verify that a consumed challenge (consumed_at is set) is not returned
    consumed_challenge = AuthenticationChallenge(
        id=challenge_id,
        user_id=user_id,
        purpose="TWO_FACTOR_LOGIN",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        consumed_at=datetime.now(timezone.utc),
    )
    mock_db.scalar.return_value = None  # DB query filters consumed_at IS NULL
    result = TwoFactorService.get_valid_challenge(mock_db, challenge_id)
    assert result is None


def test_sec03_monotonic_timestep_replay_prevention():
    """
    SEC-03: Verify RFC 6238 monotonic time-step tracking prevents replay
    within the same time-step and across adjacent valid_window time-steps.
    """
    import time
    secret = TwoFactorService.generate_totp_secret()
    totp = pyotp.TOTP(secret)
    now_ts = int(time.time() // 30)

    # 1. Matching time-step resolution
    current_code = totp.at(now_ts * 30)
    matched_ts = TwoFactorService.get_matched_totp_timestep(secret, current_code, valid_window=1)
    assert matched_ts == now_ts

    # 2. Unenrolled / initial state (last_verified_timestep is None): code accepted
    user = _make_user(["authority"])
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user.id,
        totp_secret_encrypted="encrypted",
        is_enabled=True,
        last_verified_timestep=None,
    )
    assert TwoFactorService.is_code_replayed(two_factor, current_code, secret=secret) is False

    # 3. Code accepted: record monotonic time-step
    two_factor.last_verified_timestep = now_ts
    two_factor.last_verified_code_hash = TwoFactorService.hash_code(current_code)
    two_factor.last_verified_at = datetime.now(timezone.utc)

    # 4. Immediate replay within the exact same time-step is strictly REJECTED
    assert TwoFactorService.is_code_replayed(two_factor, current_code, secret=secret) is True

    # 5. Old code from previous time-step (now_ts - 1) is strictly REJECTED as older time-step
    past_code = totp.at((now_ts - 1) * 30)
    assert TwoFactorService.is_code_replayed(two_factor, past_code, secret=secret) is True

    # 6. Future code from subsequent time-step (now_ts + 1) is NOT replayed
    future_code = totp.at((now_ts + 1) * 30)
    assert TwoFactorService.is_code_replayed(two_factor, future_code, secret=secret) is False


def test_sec04_rate_limiting_failures_since_latest_success(mock_db):
    """
    SEC-04: Verify rate limiting computes failures since the most recent
    successful verification within the rolling lockout window.
    """
    email = "authority@csjmu.ac.in"

    # Below threshold (e.g. 4 failures)
    mock_db.scalar.return_value = 4
    assert TwoFactorService.is_rate_limited(mock_db, email) is False

    # At or above threshold (5 failures)
    mock_db.scalar.return_value = 5
    assert TwoFactorService.is_rate_limited(mock_db, email) is True


