"""
Database-Free Unit Tests for Super Admin Setup Script (scripts.setup_super_admin).

These tests run entirely in-memory with zero network or database dependencies.
Tests cover target validation, dry-run safety, password complexity & prompting,
hashing, idempotency, duplicate refusal, role checks, audit logging, and rollback.
"""

import uuid
import pytest
from unittest.mock import MagicMock, patch

from app.core.security import verify_password
from app.models.user import User
from app.models.role import Role
from app.models.audit import AuditLog
from scripts.setup_super_admin import (
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_ROLE,
    validate_password_strength,
    verify_database_target,
    prompt_for_super_admin_password,
    run_super_admin_setup,
)


# =========================================================================
# 1. Target Email and Role Constants
# =========================================================================

def test_fixed_target_constants():
    assert SUPER_ADMIN_EMAIL == "sadmin@csjmu.ac.in"
    assert SUPER_ADMIN_ROLE == "super_admin"


# =========================================================================
# 2. Database Target Verification
# =========================================================================

@patch("scripts.setup_super_admin.settings")
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


@patch("scripts.setup_super_admin.settings")
def test_verify_database_target_mismatch(mock_settings):
    mock_settings.sync_database_url = "postgresql://user:pass@ep-ancient-hill-1234.neon.tech/neondb?sslmode=require"
    
    ok, msg = verify_database_target("production_primary")
    assert ok is False
    assert "Target mismatch" in msg
    # Confirms credentials/passwords are NOT leaked in mismatch message
    assert "pass" not in msg


def test_verify_database_target_missing():
    ok, msg = verify_database_target(None)
    assert ok is False
    assert "Missing required target confirmation" in msg


# =========================================================================
# 3. Password Validation and Prompting
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
    ok, msg = validate_password_strength("ValidP@ssw0rd2026")
    assert ok is True


def test_password_prompt_success():
    pw = prompt_for_super_admin_password(
        password_input_fn=lambda: "ValidSuperAdmin123!",
        confirm_input_fn=lambda: "ValidSuperAdmin123!",
    )
    assert pw == "ValidSuperAdmin123!"


def test_password_prompt_mismatch_raises():
    with pytest.raises(ValueError, match="do not match"):
        prompt_for_super_admin_password(
            password_input_fn=lambda: "ValidSuperAdmin123!",
            confirm_input_fn=lambda: "DifferentPassword456!",
        )


def test_password_prompt_blank_raises():
    with pytest.raises(ValueError, match="cannot be blank"):
        prompt_for_super_admin_password(
            password_input_fn=lambda: "",
            confirm_input_fn=lambda: "",
        )


# =========================================================================
# 4. Dry-Run Mode Safety (No Database Mutations)
# =========================================================================

@patch("scripts.setup_super_admin.verify_database_target", return_value=(True, "Target confirmed"))
def test_setup_dry_run_mode_performs_zero_writes(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session

    super_admin_role = Role(id=uuid.uuid4(), name="super_admin", is_system=True)
    mock_session.execute.return_value.scalar.return_value = "neondb"
    # First query (User) returns None; second query (Role) returns role
    mock_session.execute.return_value.scalar_one_or_none.side_effect = [None, super_admin_role]

    exit_code = run_super_admin_setup(
        confirm_create=False, # Dry run
        expected_database="neondb",
        password_input_fn=lambda: "ValidSuperAdmin123!",
        confirm_input_fn=lambda: "ValidSuperAdmin123!",
        session_factory=mock_session_factory,
    )

    assert exit_code == 0
    # In dry-run, session.add and session.commit MUST NOT be called
    mock_session.add.assert_not_called()
    mock_session.commit.assert_not_called()
    mock_session.close.assert_called_once()


# =========================================================================
# 5. Duplicate Email and Missing Role Refusals
# =========================================================================

@patch("scripts.setup_super_admin.verify_database_target", return_value=(True, "Target confirmed"))
def test_setup_refuses_duplicate_account(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session
    mock_session.execute.return_value.scalar.return_value = "neondb"

    existing_user = User(
        id=uuid.uuid4(),
        email=SUPER_ADMIN_EMAIL,
        first_name="Existing",
        last_name="Admin",
        is_active=True,
    )
    mock_session.execute.return_value.scalar_one_or_none.return_value = existing_user

    exit_code = run_super_admin_setup(
        confirm_create=True,
        expected_database="neondb",
        session_factory=mock_session_factory,
    )

    assert exit_code == 1
    mock_session.add.assert_not_called()
    mock_session.commit.assert_not_called()
    mock_session.close.assert_called_once()


@patch("scripts.setup_super_admin.verify_database_target", return_value=(True, "Target confirmed"))
def test_setup_refuses_missing_super_admin_role(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session
    mock_session.execute.return_value.scalar.return_value = "neondb"

    # User does not exist, but super_admin Role also does not exist
    mock_session.execute.return_value.scalar_one_or_none.side_effect = [None, None]

    exit_code = run_super_admin_setup(
        confirm_create=True,
        expected_database="neondb",
        session_factory=mock_session_factory,
    )

    assert exit_code == 1
    mock_session.add.assert_not_called()
    mock_session.commit.assert_not_called()
    mock_session.close.assert_called_once()


@patch("scripts.setup_super_admin.verify_database_target", return_value=(True, "Target confirmed"))
def test_setup_refuses_connected_server_database_mismatch(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session
    # Server reports a different database name than expected
    mock_session.execute.return_value.scalar.return_value = "production_live_db"

    exit_code = run_super_admin_setup(
        confirm_create=True,
        expected_database="staging_db",
        session_factory=mock_session_factory,
    )

    assert exit_code == 1
    mock_session.add.assert_not_called()
    mock_session.commit.assert_not_called()
    mock_session.close.assert_called_once()


# =========================================================================
# 6. Target Mismatch Refusal
# =========================================================================

@patch("scripts.setup_super_admin.verify_database_target", return_value=(False, "Target mismatch"))
def test_setup_refuses_target_mismatch(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session

    exit_code = run_super_admin_setup(
        confirm_create=True,
        expected_database="wrong_database",
        session_factory=mock_session_factory,
    )

    assert exit_code == 1
    # Does not even open session on target mismatch
    mock_session.execute.assert_not_called()


# =========================================================================
# 7. Successful Account Creation Pipeline
# =========================================================================

@patch("scripts.setup_super_admin.verify_database_target", return_value=(True, "Target confirmed"))
def test_setup_creates_account_with_hashing_and_audit(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session

    super_admin_role = Role(id=uuid.uuid4(), name="super_admin", is_system=True)
    mock_session.execute.return_value.scalar.return_value = "neondb"
    mock_session.execute.return_value.scalar_one_or_none.side_effect = [None, super_admin_role]

    raw_password = "StrictP@ssword2026!"
    exit_code = run_super_admin_setup(
        confirm_create=True,
        expected_database="neondb",
        password_input_fn=lambda: raw_password,
        confirm_input_fn=lambda: raw_password,
        session_factory=mock_session_factory,
    )

    assert exit_code == 0
    # Verify User and AuditLog were added
    assert mock_session.add.call_count == 2
    added_user = mock_session.add.call_args_list[0][0][0]
    added_audit = mock_session.add.call_args_list[1][0][0]

    # Check User attributes
    assert isinstance(added_user, User)
    assert added_user.email == SUPER_ADMIN_EMAIL
    assert added_user.first_name == "Super"
    assert added_user.last_name == "Admin"
    assert added_user.is_active is True
    assert added_user.is_verified is True
    # Verify password hash using the app's verify_password
    assert verify_password(raw_password, added_user.password_hash) is True

    # Check AuditLog attributes
    assert isinstance(added_audit, AuditLog)
    assert added_audit.user_id == added_user.id
    assert added_audit.action == "CREATE_SUPER_ADMIN"
    assert added_audit.module == "governance_identity"
    assert added_audit.entity_name == "User"
    assert added_audit.entity_id == str(added_user.id)
    assert added_audit.details["email"] == SUPER_ADMIN_EMAIL
    assert added_audit.details["role"] == SUPER_ADMIN_ROLE

    # Verify session commit
    mock_session.commit.assert_called_once()
    mock_session.close.assert_called_once()


# =========================================================================
# 8. Rollback on Failure
# =========================================================================

@patch("scripts.setup_super_admin.verify_database_target", return_value=(True, "Target confirmed"))
def test_setup_rolls_back_on_commit_error(mock_target):
    mock_session = MagicMock()
    mock_session_factory = lambda: mock_session
    mock_session.execute.return_value.scalar.return_value = "neondb"

    super_admin_role = Role(id=uuid.uuid4(), name="super_admin", is_system=True)
    mock_session.execute.return_value.scalar_one_or_none.side_effect = [None, super_admin_role]
    mock_session.commit.side_effect = RuntimeError("DB write failed")

    raw_password = "StrictP@ssword2026!"
    exit_code = run_super_admin_setup(
        confirm_create=True,
        expected_database="neondb",
        password_input_fn=lambda: raw_password,
        confirm_input_fn=lambda: raw_password,
        session_factory=mock_session_factory,
    )

    assert exit_code == 1
    mock_session.rollback.assert_called_once()
    mock_session.close.assert_called_once()
