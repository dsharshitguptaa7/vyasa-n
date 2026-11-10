import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
import pytest
from starlette.testclient import TestClient
import pyotp

from app.main import app
from app.api.dependencies import get_db
from app.models.user import User
from app.models.role import Role
from app.models.two_factor import (
    UserTwoFactorAuth,
    TwoFactorRecoveryCode,
    AuthenticationChallenge,
    TwoFactorAttempt,
)
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.services.two_factor_service import TwoFactorService
from scripts.reset_single_account_2fa import reset_single_account_2fa


@pytest.fixture
def client():
    return TestClient(app)


def _make_user(email="research@csjmu.ac.in"):
    u = User(
        id=uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080"),
        email=email,
        first_name="Namita",
        last_name="Tiwari",
        is_active=True,
        is_verified=True,
        password_hash="mock_hash_unaltered",
        created_at=datetime.now(timezone.utc),
    )
    role = Role(id=uuid.uuid4(), name="authority")
    u.roles = [role]
    return u


def test_reset_identifies_and_modifies_only_target_account():
    """
    Verify that single-account reset targets only the specified user UUID,
    marking is_enabled=False, clearing old ciphertext, and preserving other users.
    """
    target_id = uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080")
    other_id = uuid.uuid4()

    mock_db = MagicMock()

    user = _make_user()
    tfa_target = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=target_id,
        totp_secret_encrypted="old_historical_ciphertext",
        is_enabled=True,
        enabled_at=datetime.now(timezone.utc),
        last_verified_at=datetime.now(timezone.utc),
        last_verified_timestep=12345,
        last_verified_code_hash="old_hash",
    )
    tfa_other = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=other_id,
        totp_secret_encrypted="other_user_valid_ciphertext",
        is_enabled=True,
    )

    auth = NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=target_id,
        role=NivaranRole.DEAN,
        name_snapshot="Prof. Namita Tiwari",
        is_active=True,
    )

    def query_mock(model):
        m_query = MagicMock()
        if model == User:
            m_query.filter.return_value.first.return_value = user
        elif model == NivaranAuthority:
            m_query.filter.return_value.all.return_value = [auth]
        elif model == UserTwoFactorAuth:
            def filter_mock(*args, **kwargs):
                f_obj = MagicMock()
                f_obj.all.return_value = [tfa_target]
                f_obj.count.return_value = 5  # other users
                return f_obj
            m_query.filter = filter_mock
        elif model == TwoFactorRecoveryCode:
            m_query.filter.return_value.all.return_value = []
        elif model == AuthenticationChallenge:
            m_query.filter.return_value.all.return_value = []
        return m_query

    mock_db.query = query_mock

    with patch("scripts.reset_single_account_2fa.SessionLocal", return_value=mock_db):
        plan = reset_single_account_2fa(target_id, dry_run=False)

    assert plan["target_user_id"] == str(target_id)
    assert tfa_target.is_enabled is False
    assert tfa_target.totp_secret_encrypted == "PENDING_RE_ENROLLMENT"
    assert tfa_target.enabled_at is None
    assert tfa_target.last_verified_at is None
    assert tfa_target.last_verified_timestep is None
    assert tfa_target.last_verified_code_hash is None

    # Other user must remain untouched
    assert tfa_other.is_enabled is True
    assert tfa_other.totp_secret_encrypted == "other_user_valid_ciphertext"

    # Database commit called
    assert mock_db.commit.called


def test_dry_run_mode_does_not_modify_database():
    """
    Verify that dry-run mode executes zero database commits.
    """
    target_id = uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080")
    mock_db = MagicMock()
    user = _make_user()
    tfa_target = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=target_id,
        totp_secret_encrypted="old_ciphertext",
        is_enabled=True,
    )

    def query_mock(model):
        m = MagicMock()
        if model == User:
            m.filter.return_value.first.return_value = user
        elif model == NivaranAuthority:
            m.filter.return_value.all.return_value = []
        elif model == UserTwoFactorAuth:
            f = MagicMock()
            f.all.return_value = [tfa_target]
            f.count.return_value = 5
            m.filter = lambda *args, **kwargs: f
        elif model in (TwoFactorRecoveryCode, AuthenticationChallenge):
            m.filter.return_value.all.return_value = []
        return m

    mock_db.query = query_mock

    with patch("scripts.reset_single_account_2fa.SessionLocal", return_value=mock_db):
        plan = reset_single_account_2fa(target_id, dry_run=True)

    assert plan["dry_run"] is True
    assert not mock_db.commit.called
    assert tfa_target.is_enabled is True
    assert tfa_target.totp_secret_encrypted == "old_ciphertext"


def test_previous_recovery_codes_and_challenges_invalidated():
    """
    Verify that all unused recovery codes and pending challenges for the target user
    are marked consumed/invalidated upon reset.
    """
    target_id = uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080")
    mock_db = MagicMock()
    user = _make_user()
    tfa_target = UserTwoFactorAuth(id=uuid.uuid4(), user_id=target_id, totp_secret_encrypted="c", is_enabled=True)

    code1 = TwoFactorRecoveryCode(id=uuid.uuid4(), user_id=target_id, code_hash="h1", used_at=None)
    code2 = TwoFactorRecoveryCode(id=uuid.uuid4(), user_id=target_id, code_hash="h2", used_at=None)
    ch1 = AuthenticationChallenge(id=uuid.uuid4(), user_id=target_id, purpose="TWO_FACTOR_LOGIN", consumed_at=None)

    def query_mock(model):
        m = MagicMock()
        if model == User:
            m.filter.return_value.first.return_value = user
        elif model == NivaranAuthority:
            m.filter.return_value.all.return_value = []
        elif model == UserTwoFactorAuth:
            f = MagicMock()
            f.all.return_value = [tfa_target]
            f.count.return_value = 5
            m.filter = lambda *args, **kwargs: f
        elif model == TwoFactorRecoveryCode:
            m.filter.return_value.all.return_value = [code1, code2]
        elif model == AuthenticationChallenge:
            m.filter.return_value.all.return_value = [ch1]
        return m

    mock_db.query = query_mock

    with patch("scripts.reset_single_account_2fa.SessionLocal", return_value=mock_db):
        plan = reset_single_account_2fa(target_id, dry_run=False)

    assert plan["invalidated_recovery_codes_count"] == 2
    assert plan["cancelled_challenges_count"] == 1
    assert code1.used_at is not None
    assert code2.used_at is not None
    assert ch1.consumed_at is not None


def test_native_reenrollment_generates_fresh_secret_and_confirms(client):
    """
    Verify the complete end-to-end native re-enrollment lifecycle:
    1. User with is_enabled=False triggers setup via /2fa/setup.
    2. Setup generates a fresh RFC 6238 secret encrypted with the current key (NOT reusing old secret).
    3. User confirms with valid 6-digit OTP code on /2fa/confirm-setup.
    4. is_enabled becomes True and 10 recovery codes are issued.
    """
    user_id = uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080")
    user = _make_user()
    setup_challenge_id = uuid.uuid4()

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user_id,
        totp_secret_encrypted="PENDING_RE_ENROLLMENT",
        is_enabled=False,
    )

    setup_challenge = AuthenticationChallenge(
        id=setup_challenge_id,
        user_id=user_id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        consumed_at=None,
    )

    def scalar_mock(query):
        q = str(query)
        if "authentication_challenges" in q:
            return setup_challenge
        if "user_two_factor_auth" in q:
            return two_factor
        if "users" in q:
            return user
        return None

    mock_db.scalar.side_effect = scalar_mock

    # Step 1: /2fa/setup
    res_setup = client.post(
        "/api/auth/2fa/setup",
        json={"challenge_id": str(setup_challenge_id)},
    )
    assert res_setup.status_code == 200
    data_setup = res_setup.json()
    assert data_setup["requires_2fa_setup"] is True
    fresh_raw_secret = data_setup["manual_setup_key"]
    assert len(fresh_raw_secret) == 32
    assert "qr_code" in data_setup

    # Verify that the new secret was encrypted under the current Fernet key
    assert two_factor.totp_secret_encrypted != "PENDING_RE_ENROLLMENT"
    decrypted_secret = TwoFactorService.decrypt_secret(two_factor.totp_secret_encrypted)
    assert decrypted_secret == fresh_raw_secret

    # Step 2: /2fa/confirm-setup with valid code
    totp = pyotp.TOTP(fresh_raw_secret)
    valid_code = totp.now()

    res_confirm = client.post(
        "/api/auth/2fa/confirm-setup",
        json={"challenge_id": str(setup_challenge_id), "code": valid_code},
    )
    assert res_confirm.status_code == 200
    data_confirm = res_confirm.json()
    assert "access_token" in data_confirm
    assert len(data_confirm["recovery_codes"]) == 10

    # Verify that 2FA is now activated
    assert two_factor.is_enabled is True
    assert two_factor.enabled_at is not None
    assert two_factor.last_verified_at is not None


def test_failed_enrollment_does_not_activate_2fa(client):
    """
    Verify that an invalid OTP code during confirm-setup fails with 400 Bad Request
    and does NOT activate 2FA (is_enabled remains False).
    """
    user_id = uuid.UUID("889e14ec-5411-5554-b8e3-2be991e64080")
    user = _make_user()
    setup_challenge_id = uuid.uuid4()

    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    secret = TwoFactorService.generate_totp_secret()
    two_factor = UserTwoFactorAuth(
        id=uuid.uuid4(),
        user_id=user_id,
        totp_secret_encrypted=TwoFactorService.encrypt_secret(secret),
        is_enabled=False,
    )

    setup_challenge = AuthenticationChallenge(
        id=setup_challenge_id,
        user_id=user_id,
        purpose="TWO_FACTOR_SETUP",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        consumed_at=None,
    )

    def scalar_mock(query):
        q = str(query)
        if "authentication_challenges" in q:
            return setup_challenge
        if "user_two_factor_auth" in q:
            return two_factor
        if "users" in q:
            return user
        return None

    mock_db.scalar.side_effect = scalar_mock

    res_fail = client.post(
        "/api/auth/2fa/confirm-setup",
        json={"challenge_id": str(setup_challenge_id), "code": "000000"},
    )
    assert res_fail.status_code == 400
    assert two_factor.is_enabled is False
    assert two_factor.enabled_at is None
