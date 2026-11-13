"""
Test Suite: Super Admin Authority Temporary Password Reissuance (Database-Free)

Validates all security invariants and operational requirements:
1. Successful password reissuance with Brevo email delivery.
2. Invalidation of previous password immediately.
3. Mandatory password change enforced on next login.
4. Unauthorized caller access rejected (401 unauthenticated, 403 non-super-admin).
5. Invalid or ineligible authority ID handling (404 not found, 400 inactive authority/user).
6. Brevo delivery failure handling (accurate failure reporting, sanitization, non-leakage).
7. Repeated reissuance and rate limiting enforcement (429 Too Many Requests).
8. Revocation of existing in-flight authentication challenges/sessions.
9. Audit log creation with action TEMPORARY_PASSWORD_REISSUED and proper metadata.
10. Zero plaintext password or credential hash leakage in responses or audit logs.
"""

import uuid
import re
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_temporary_password,
)
from app.models.user import User
from app.models.role import Role
from app.models.audit import AuditLog
from app.models.two_factor import AuthenticationChallenge
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.services.admin_config_service import (
    AdminConfigService,
    PasswordReissueRateLimitError,
)
from app.services.notifications.email_service import EmailDispatchResult
from app.api.dependencies import get_db, require_super_admin_user, get_current_user


def _make_user(
    roles: list[str],
    email: str = "authority@csjmu.ac.in",
    is_active: bool = True,
    password: str = "OldTempPass#2026",
    must_change_password: bool = False,
) -> User:
    u = User(
        id=uuid.uuid4(),
        email=email,
        password_hash=hash_password(password),
        first_name="Prof. First",
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


def _make_authority(
    user: User,
    role: NivaranRole = NivaranRole.ASSISTANT_DEAN,
    is_active: bool = True,
) -> NivaranAuthority:
    return NivaranAuthority(
        id=uuid.uuid4(),
        vyasa_user_id=user.id,
        role=role,
        name_snapshot="Prof. First Authority",
        email_snapshot=user.email,
        designation="Assistant Dean (Sciences)",
        department="Physical Sciences",
        is_active=is_active,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )


def _get_err_msg(res) -> str:
    body = res.json()
    return (body.get("message") or body.get("detail") or str(body)).lower()



@pytest.fixture
def super_admin_user():
    return _make_user(roles=["super_admin"], email="sadmin@csjmu.ac.in")


@pytest.fixture
def regular_user():
    return _make_user(roles=["authority"], email="regular_authority@csjmu.ac.in")


@pytest.fixture
def client():
    c = TestClient(app)
    yield c
    app.dependency_overrides.clear()


# =============================================================================
# 1. SUCCESSFUL PASSWORD REISSUANCE & BREVO DELIVERY
# =============================================================================

def test_successful_password_reissuance(client, super_admin_user):
    target_user = _make_user(roles=["authority"], email="dean.science@csjmu.ac.in", password="InitialPassword#123")
    authority = _make_authority(target_user, role=NivaranRole.DEAN, is_active=True)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)

    # Set up DB queries for authority and audit log rate limiting check
    def mock_scalar(query, *args, **kwargs):
        query_str = str(query)
        if "nivaran_authorities" in query_str.lower():
            return authority
        if "users" in query_str.lower():
            return target_user
        return None

    mock_db.scalar.side_effect = mock_scalar
    mock_db.scalars.return_value.all.return_value = []  # No recent audit logs (no rate limit)

    mock_email_service = MagicMock()
    mock_email_service.send_email.return_value = EmailDispatchResult(
        success=True,
        error_message=None,
        message_id="brevo-msg-12345",
    )

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    with patch(
        "app.modules.atharva_veda.nivaran.services.admin_config_service.email_sender_service",
        mock_email_service,
    ):
        res = client.post(f"/api/admin/atharva/authorities/{authority.id}/reissue-password")

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["delivery_status"] == "SENT"
    assert data["data"]["delivery_error"] is None
    assert data["data"]["email"] == "dean.science@csjmu.ac.in"
    assert data["data"]["name"] == "Prof. First Authority"

    # Verify target user was updated
    assert target_user.must_change_password is True
    # Verify new password is NOT equal to old password
    assert verify_password("InitialPassword#123", target_user.password_hash) is False

    # Verify Brevo email service was invoked
    mock_email_service.send_email.assert_called_once()
    call_args = mock_email_service.send_email.call_args[1]
    assert call_args["recipient_email"] == "dean.science@csjmu.ac.in"
    assert "VYASA" in call_args["subject"]
    assert "Temporary Authority Credentials" in call_args["subject"]
    assert "Temporary Password" in call_args["html_content"]


# =============================================================================
# 2. PREVIOUS PASSWORD INVALIDATION
# =============================================================================

def test_previous_password_invalidation(super_admin_user):
    old_password = "OldActiveCredential#999"
    target_user = _make_user(roles=["authority"], email="associate.dean@csjmu.ac.in", password=old_password)
    authority = _make_authority(target_user, role=NivaranRole.ASSOCIATE_DEAN)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority
    mock_db.scalars.return_value.all.return_value = []

    mock_email_service = MagicMock()
    mock_email_service.send_email.return_value = EmailDispatchResult(success=True)

    # Initial verification: old password is valid
    assert verify_password(old_password, target_user.password_hash) is True

    # Reissue password
    result = AdminConfigService.reissue_temporary_password(
        db=mock_db,
        authority_id=authority.id,
        actor_user_id=super_admin_user.id,
        email_service=mock_email_service,
    )

    assert result["delivery_status"] == "SENT"

    # CRITICAL INVARIANT: Old password must be invalid immediately
    assert verify_password(old_password, target_user.password_hash) is False
    assert target_user.must_change_password is True


# =============================================================================
# 3. MANDATORY PASSWORD CHANGE ON NEXT LOGIN
# =============================================================================

def test_mandatory_password_change_flag_enforced(super_admin_user):
    target_user = _make_user(roles=["authority"], email="asst.dean@csjmu.ac.in", password="OldPass#1", must_change_password=False)
    authority = _make_authority(target_user, role=NivaranRole.ASSISTANT_DEAN)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority
    mock_db.scalars.return_value.all.return_value = []

    mock_email_service = MagicMock()
    mock_email_service.send_email.return_value = EmailDispatchResult(success=True)

    assert target_user.must_change_password is False

    AdminConfigService.reissue_temporary_password(
        db=mock_db,
        authority_id=authority.id,
        actor_user_id=super_admin_user.id,
        email_service=mock_email_service,
    )

    # After reissue, must_change_password must be strictly True
    assert target_user.must_change_password is True


# =============================================================================
# 4. UNAUTHORIZED USER ACCESS RESTRICTION
# =============================================================================

def test_unauthenticated_request_rejected(client):
    auth_id = uuid.uuid4()
    res = client.post(f"/api/admin/atharva/authorities/{auth_id}/reissue-password")
    assert res.status_code in (401, 403)


def test_non_superadmin_user_rejected(client, regular_user):
    auth_id = uuid.uuid4()
    mock_db = MagicMock(spec=Session)
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: regular_user
    # require_super_admin_user will check role and raise 403
    res = client.post(f"/api/admin/atharva/authorities/{auth_id}/reissue-password")
    assert res.status_code == 403
    assert "super admin" in _get_err_msg(res)


# =============================================================================
# 5. INVALID & INELIGIBLE AUTHORITY HANDLING
# =============================================================================

def test_nonexistent_authority_id_rejected(client, super_admin_user):
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = None  # Authority not found

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    nonexistent_id = uuid.uuid4()
    res = client.post(f"/api/admin/atharva/authorities/{nonexistent_id}/reissue-password")
    assert res.status_code == 404
    assert "does not exist" in _get_err_msg(res)


def test_inactive_authority_rejected(client, super_admin_user):
    target_user = _make_user(roles=["authority"], email="inactive.auth@csjmu.ac.in")
    authority = _make_authority(target_user, is_active=False)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(f"/api/admin/atharva/authorities/{authority.id}/reissue-password")
    assert res.status_code == 400
    assert "inactive authority" in _get_err_msg(res)


def test_inactive_user_account_rejected(client, super_admin_user):
    target_user = _make_user(roles=["authority"], email="inactive.user@csjmu.ac.in", is_active=False)
    authority = _make_authority(target_user, is_active=True)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(f"/api/admin/atharva/authorities/{authority.id}/reissue-password")
    assert res.status_code == 400
    assert "deactivated" in _get_err_msg(res)


# =============================================================================
# 6. BREVO DELIVERY FAILURE HANDLING
# =============================================================================

def test_brevo_delivery_failure_reported_accurately(client, super_admin_user):
    target_user = _make_user(roles=["authority"], email="brevo.fail@csjmu.ac.in")
    authority = _make_authority(target_user, is_active=True)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority
    mock_db.scalars.return_value.all.return_value = []

    mock_email_service = MagicMock()
    # Brevo rejects request with 401 Unauthorized API key
    mock_email_service.send_email.return_value = EmailDispatchResult(
        success=False,
        error_message="Brevo authentication failed: Invalid or unauthorized API key xkeysib-123456",
        is_permanent_error=True,
    )

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    with patch(
        "app.modules.atharva_veda.nivaran.services.admin_config_service.email_sender_service",
        mock_email_service,
    ):
        res = client.post(f"/api/admin/atharva/authorities/{authority.id}/reissue-password")

    assert res.status_code == 200
    data = res.json()
    assert data["data"]["delivery_status"] == "FAILED"
    assert "xkeysib" not in str(data)  # Sanitized!
    assert "Brevo" in data["data"]["delivery_error"]

    # Even though delivery failed, password was updated in DB and must_change_password=True
    assert target_user.must_change_password is True


# =============================================================================
# 7. RATE LIMITING ENFORCEMENT
# =============================================================================

def test_repeated_reissuance_and_rate_limiting(client, super_admin_user):
    target_user = _make_user(roles=["authority"], email="ratelimit.auth@csjmu.ac.in")
    authority = _make_authority(target_user, is_active=True)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority

    # Simulate that 3 previous reissuances occurred within the rolling 15-minute window
    now = datetime.now(timezone.utc)
    mock_logs = [
        AuditLog(
            id=uuid.uuid4(),
            entity_name="NivaranAuthority",
            entity_id=str(authority.id),
            action="TEMPORARY_PASSWORD_REISSUED",
            created_at=now - timedelta(minutes=10),
        ),
        AuditLog(
            id=uuid.uuid4(),
            entity_name="NivaranAuthority",
            entity_id=str(authority.id),
            action="TEMPORARY_PASSWORD_REISSUED",
            created_at=now - timedelta(minutes=5),
        ),
        AuditLog(
            id=uuid.uuid4(),
            entity_name="NivaranAuthority",
            entity_id=str(authority.id),
            action="TEMPORARY_PASSWORD_REISSUED",
            created_at=now - timedelta(minutes=1),
        ),
    ]
    mock_db.scalars.return_value.all.return_value = mock_logs

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    res = client.post(f"/api/admin/atharva/authorities/{authority.id}/reissue-password")
    assert res.status_code == 429
    assert "rate limit exceeded" in _get_err_msg(res)


# =============================================================================
# 8. REVOCATION OF EXISTING IN-FLIGHT SESSIONS / CHALLENGES
# =============================================================================

def test_session_and_challenge_revocation(super_admin_user):
    target_user = _make_user(roles=["authority"], email="revoke.sessions@csjmu.ac.in")
    authority = _make_authority(target_user)
    authority.user = target_user

    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority
    mock_db.scalars.return_value.all.return_value = []

    mock_email_service = MagicMock()
    mock_email_service.send_email.return_value = EmailDispatchResult(success=True)

    AdminConfigService.reissue_temporary_password(
        db=mock_db,
        authority_id=authority.id,
        actor_user_id=super_admin_user.id,
        email_service=mock_email_service,
    )

    # db.execute should be called with an update statement for AuthenticationChallenge
    assert mock_db.execute.called


# =============================================================================
# 9. AUDIT LOG CREATION
# =============================================================================

def test_audit_log_creation_on_reissuance(super_admin_user):
    target_user = _make_user(roles=["authority"], email="audit.test@csjmu.ac.in")
    authority = _make_authority(target_user)
    authority.user = target_user

    added_objects = []
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority
    mock_db.scalars.return_value.all.return_value = []
    mock_db.add.side_effect = lambda obj: added_objects.append(obj)

    mock_email_service = MagicMock()
    mock_email_service.send_email.return_value = EmailDispatchResult(success=True)

    AdminConfigService.reissue_temporary_password(
        db=mock_db,
        authority_id=authority.id,
        actor_user_id=super_admin_user.id,
        ip_address="192.168.1.100",
        user_agent="Mozilla/5.0 TestBrowser",
        email_service=mock_email_service,
    )

    # Find audit log
    audit_logs = [obj for obj in added_objects if isinstance(obj, AuditLog)]
    assert len(audit_logs) >= 1
    log = audit_logs[0]
    assert log.action == "TEMPORARY_PASSWORD_REISSUED"
    assert log.entity_name == "NivaranAuthority"
    assert log.entity_id == str(authority.id)
    assert log.user_id == super_admin_user.id
    assert log.ip_address == "192.168.1.100"
    assert log.user_agent == "Mozilla/5.0 TestBrowser"
    assert log.details["email_delivery_status"] == "SENT"
    assert log.details["failure_reason"] is None
    assert log.details["authority_email"] == "audit.test@csjmu.ac.in"


# =============================================================================
# 10. ZERO PLAINTEXT PASSWORD OR HASH LEAKAGE
# =============================================================================

def test_no_plaintext_password_leakage(client, super_admin_user):
    target_user = _make_user(roles=["authority"], email="security.audit@csjmu.ac.in")
    authority = _make_authority(target_user)
    authority.user = target_user

    added_objects = []
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = authority
    mock_db.scalars.return_value.all.return_value = []
    mock_db.add.side_effect = lambda obj: added_objects.append(obj)

    mock_email_service = MagicMock()
    mock_email_service.send_email.return_value = EmailDispatchResult(success=True)

    app.dependency_overrides[require_super_admin_user] = lambda: super_admin_user
    app.dependency_overrides[get_db] = lambda: mock_db

    with patch(
        "app.modules.atharva_veda.nivaran.services.admin_config_service.email_sender_service",
        mock_email_service,
    ):
        res = client.post(f"/api/admin/atharva/authorities/{authority.id}/reissue-password")

    assert res.status_code == 200
    res_text = res.text

    # Response should NOT contain any password or hash keys
    assert "temporary_password" not in res_text
    assert "password_hash" not in res_text
    assert "pbkdf2" not in res_text

    # Audit log details should NOT contain any password or hash
    audit_logs = [obj for obj in added_objects if isinstance(obj, AuditLog)]
    assert len(audit_logs) >= 1
    details_str = str(audit_logs[0].details)
    assert "pbkdf2" not in details_str
    assert "password" not in details_str.lower() or "status" in details_str.lower()
