"""
Pure Database-Free Unit Tests for Super Admin Password Reset Utility
(backend/scripts/reset_super_admin_password.py).

These tests run completely in-memory with zero network or database dependencies.
Tests cover:
    1. Fixed target constants and enforcement.
    2. Refusal to modify any account other than sadmin@csjmu.ac.in.
    3. Database target identity matching and mismatch refusal (with zero secret leakage).
    4. Password complexity validation.
    5. Interactive masked prompt & confirmation behavior.
    6. Non-existent account refusal.
    7. Inactive account refusal.
    8. Missing 'super_admin' role refusal.
    9. Default dry-run behavior (no mutations, commit is never called).
    10. Confirmed execution: canonical PBKDF2 hashing, user password update,
        audit log creation without credential leakage, and single-role preservation.
    11. Atomic transaction rollback on database error.
"""

import uuid
import pytest
from unittest.mock import MagicMock, patch

from app.core.security import verify_password
from app.models.user import User
from app.models.role import Role
from app.models.audit import AuditLog
from scripts.reset_super_admin_password import (
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_ROLE,
    validate_password_strength,
    verify_database_target,
    prompt_for_new_password,
    run_super_admin_password_reset,
)


# =========================================================================
# 1. Target Account and Role Constants
# =========================================================================

def test_fixed_target_constants():
    assert SUPER_ADMIN_EMAIL == "sadmin@csjmu.ac.in"
    assert SUPER_ADMIN_ROLE == "super_admin"


# =========================================================================
# 2. Strict Refusal to Modify Other Accounts
# =========================================================================

def test_refuse_arbitrary_email_targets():
    for arbitrary_email in [
        "dean@csjmu.ac.in",
        "admin@csjmu.ac.in",
        "hacker@csjmu.ac.in",
        "sadmin_fake@csjmu.ac.in",
        "student@csjmu.ac.in",
    ]:
        exit_code = run_super_admin_password_reset(
            target_email=arbitrary_email,
            confirm_reset=False,
            expected_database="neondb",
        )
        assert exit_code == 1, f"Expected refusal for email: {arbitrary_email}"


# =========================================================================
# 3. Database Target Verification
# =========================================================================

@patch("scripts.reset_super_admin_password.settings")
def test_verify_database_target_success(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-ancient-hill-1234.neon.tech/neondb?sslmode=require"

    # Matches database name
    ok, msg = verify_database_target("neondb")
    assert ok is True

    # Matches host
    ok, msg = verify_database_target("ep-ancient-hill-1234.neon.tech")
    assert ok is True

    # Matches host/db
    ok, msg = verify_database_target("ep-ancient-hill-1234.neon.tech/neondb")
    assert ok is True


@patch("scripts.reset_super_admin_password.settings")
def test_verify_database_target_mismatch(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-ancient-hill-1234.neon.tech/neondb?sslmode=require"

    ok, msg = verify_database_target("production_primary")
    assert ok is False
    assert "Target mismatch" in msg
    assert "pass" not in msg  # No password leakage


def test_verify_database_target_missing():
    ok, msg = verify_database_target(None)
    assert ok is False
    assert "Missing required target confirmation" in msg


# =========================================================================
# 4. Password Strength Validation
# =========================================================================

def test_password_strength_validation():
    # Too short
    ok, msg = validate_password_strength("Short1!")
    assert ok is False
    assert "at least 8" in msg

    # Missing uppercase
    ok, msg = validate_password_strength("lowercase1!")
    assert ok is False
    assert "uppercase" in msg

    # Missing lowercase
    ok, msg = validate_password_strength("UPPERCASE1!")
    assert ok is False
    assert "lowercase" in msg

    # Missing digit
    ok, msg = validate_password_strength("NoDigitsHere!")
    assert ok is False
    assert "number" in msg

    # Valid
    ok, msg = validate_password_strength("StrongP@ssw0rd2026")
    assert ok is True


# =========================================================================
# 5. Masked Input & Confirmation Prompting
# =========================================================================

def test_prompt_for_new_password_success():
    pw = prompt_for_new_password(
        password_input_fn=lambda: "ValidP@ssw0rd2026",
        confirm_input_fn=lambda: "ValidP@ssw0rd2026",
    )
    assert pw == "ValidP@ssw0rd2026"


def test_prompt_for_new_password_mismatch():
    with pytest.raises(ValueError, match="Passwords do not match"):
        prompt_for_new_password(
            password_input_fn=lambda: "ValidP@ssw0rd2026",
            confirm_input_fn=lambda: "DifferentP@ssw0rd2026",
        )


def test_prompt_for_new_password_blank():
    with pytest.raises(ValueError, match="Password cannot be blank"):
        prompt_for_new_password(
            password_input_fn=lambda: "",
            confirm_input_fn=lambda: "",
        )


def test_prompt_for_new_password_weak():
    with pytest.raises(ValueError, match="Password must be at least 8 characters"):
        prompt_for_new_password(
            password_input_fn=lambda: "short",
            confirm_input_fn=lambda: "short",
        )


# =========================================================================
# 6. Database Precondition Invariants & Refusals
# =========================================================================

@patch("scripts.reset_super_admin_password.settings")
def test_refuse_server_database_mismatch(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "staging_db"  # mismatch
    mock_session_factory = MagicMock(return_value=mock_session)

    exit_code = run_super_admin_password_reset(
        confirm_reset=False,
        expected_database="neondb",
        session_factory=mock_session_factory,
    )
    assert exit_code == 1
    mock_session.commit.assert_not_called()


@patch("scripts.reset_super_admin_password.settings")
def test_refuse_non_existent_account(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "neondb"
    mock_session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = None
    mock_session_factory = MagicMock(return_value=mock_session)

    exit_code = run_super_admin_password_reset(
        confirm_reset=False,
        expected_database="neondb",
        session_factory=mock_session_factory,
    )
    assert exit_code == 1
    mock_session.commit.assert_not_called()


@patch("scripts.reset_super_admin_password.settings")
def test_refuse_inactive_account(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "neondb"

    inactive_user = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=False,  # Inactive
    )
    mock_session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = inactive_user
    mock_session_factory = MagicMock(return_value=mock_session)

    exit_code = run_super_admin_password_reset(
        confirm_reset=False,
        expected_database="neondb",
        session_factory=mock_session_factory,
    )
    assert exit_code == 1
    mock_session.commit.assert_not_called()


@patch("scripts.reset_super_admin_password.settings")
def test_refuse_account_without_super_admin_role(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "neondb"

    user_without_super_admin = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
    )
    applicant_role = Role(id=uuid.uuid4(), name="applicant")
    user_without_super_admin.roles = [applicant_role]

    mock_session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = user_without_super_admin
    mock_session_factory = MagicMock(return_value=mock_session)

    exit_code = run_super_admin_password_reset(
        confirm_reset=False,
        expected_database="neondb",
        session_factory=mock_session_factory,
    )
    assert exit_code == 1
    mock_session.commit.assert_not_called()


# =========================================================================
# 7. Dry-Run Mode Safety Guarantee
# =========================================================================

@patch("scripts.reset_super_admin_password.settings")
def test_dry_run_performs_zero_database_mutations(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "neondb"

    original_hash = "pbkdf2_sha256$100000$salt$originaldigest"
    active_super_admin = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        password_hash=original_hash,
    )
    sa_role = Role(id=uuid.uuid4(), name="super_admin")
    active_super_admin.roles = [sa_role]

    mock_session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = active_super_admin
    mock_session_factory = MagicMock(return_value=mock_session)

    exit_code = run_super_admin_password_reset(
        confirm_reset=False,  # Dry run
        expected_database="neondb",
        password_input_fn=lambda: "NewValidPassword123!",
        confirm_input_fn=lambda: "NewValidPassword123!",
        session_factory=mock_session_factory,
    )

    assert exit_code == 0
    # User password hash must remain untouched
    assert active_super_admin.password_hash == original_hash
    # No session commit called
    mock_session.commit.assert_not_called()
    mock_session.add.assert_not_called()


# =========================================================================
# 8. Confirmed Password Reset Execution
# =========================================================================

@patch("scripts.reset_super_admin_password.settings")
def test_confirmed_password_reset_success(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "neondb"

    original_hash = "pbkdf2_sha256$100000$salt$originaldigest"
    user_id = uuid.uuid4()
    active_super_admin = User(
        id=user_id,
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        password_hash=original_hash,
    )
    sa_role = Role(id=uuid.uuid4(), name="super_admin")
    active_super_admin.roles = [sa_role]

    mock_session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = active_super_admin
    mock_session_factory = MagicMock(return_value=mock_session)

    added_objects = []
    mock_session.add.side_effect = lambda obj: added_objects.append(obj)

    new_plain_pw = "NewSecretP@ssw0rd2026"

    exit_code = run_super_admin_password_reset(
        confirm_reset=True,  # Confirmed write
        expected_database="neondb",
        password_input_fn=lambda: new_plain_pw,
        confirm_input_fn=lambda: new_plain_pw,
        session_factory=mock_session_factory,
    )

    assert exit_code == 0
    # Verify password was changed and hashed using PBKDF2
    assert active_super_admin.password_hash != original_hash
    assert active_super_admin.password_hash.startswith("pbkdf2_sha256$100000$")
    assert verify_password(new_plain_pw, active_super_admin.password_hash) is True
    assert verify_password("WrongPassword123!", active_super_admin.password_hash) is False

    # Verify single role remained untouched
    assert len(active_super_admin.roles) == 1
    assert active_super_admin.roles[0].name == "super_admin"

    # Verify audit log was recorded
    audit_logs = [obj for obj in added_objects if isinstance(obj, AuditLog)]
    assert len(audit_logs) == 1
    audit = audit_logs[0]
    assert audit.action == "RESET_SUPER_ADMIN_PASSWORD"
    assert audit.module == "governance_identity"
    assert audit.entity_name == "User"
    assert audit.entity_id == str(user_id)
    assert audit.user_id == user_id

    # Verify details do NOT contain sensitive password or hash
    assert audit.details["email"] == "sadmin@csjmu.ac.in"
    assert audit.details["role"] == "super_admin"
    assert "password" not in audit.details
    assert "password_hash" not in audit.details
    assert new_plain_pw not in str(audit.details)
    assert active_super_admin.password_hash not in str(audit.details)

    # Verify atomic commit was executed
    mock_session.commit.assert_called_once()


# =========================================================================
# 9. Atomic Rollback on Failure
# =========================================================================

@patch("scripts.reset_super_admin_password.settings")
def test_atomic_rollback_on_commit_error(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-test.neon.tech/neondb"

    mock_session = MagicMock()
    mock_session.execute.return_value.scalar.return_value = "neondb"

    active_super_admin = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        password_hash="pbkdf2_sha256$100000$salt$originaldigest",
    )
    sa_role = Role(id=uuid.uuid4(), name="super_admin")
    active_super_admin.roles = [sa_role]

    mock_session.execute.return_value.unique.return_value.scalar_one_or_none.return_value = active_super_admin
    mock_session.commit.side_effect = RuntimeError("Simulated DB connection drop")
    mock_session_factory = MagicMock(return_value=mock_session)

    exit_code = run_super_admin_password_reset(
        confirm_reset=True,
        expected_database="neondb",
        password_input_fn=lambda: "NewSecretP@ssw0rd2026",
        confirm_input_fn=lambda: "NewSecretP@ssw0rd2026",
        session_factory=mock_session_factory,
    )

    assert exit_code == 1
    mock_session.rollback.assert_called_once()
