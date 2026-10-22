"""
Database-Free Unit Tests for Super Admin Promotion Utility (scripts.promote_super_admin).

These tests run completely in-memory with zero network or database dependencies.
Mocks SessionLocal to test all safety validations and elevation execution paths.
"""

import sys
import uuid
import pytest
from unittest.mock import MagicMock, patch

from app.models.user import User
from app.models.role import Role
from app.models.audit import AuditLog
from scripts.promote_super_admin import promote_user_to_super_admin


def test_promote_aborts_without_confirm_flag():
    """Verify elevation strictly exits if confirmed is False."""
    with pytest.raises(SystemExit) as exc_info:
        promote_user_to_super_admin("target@csjmu.ac.in", confirmed=False)
    assert exc_info.value.code == 1


@patch("scripts.promote_super_admin.SessionLocal")
def test_promote_user_not_found_exits(mock_session_cls):
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session
    mock_session.execute.return_value.scalar_one_or_none.return_value = None

    with pytest.raises(SystemExit) as exc_info:
        promote_user_to_super_admin("nonexistent@csjmu.ac.in", confirmed=True)
    assert exc_info.value.code == 1
    mock_session.rollback.assert_not_called()
    mock_session.close.assert_called_once()


@patch("scripts.promote_super_admin.SessionLocal")
def test_promote_inactive_user_exits(mock_session_cls):
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session
    inactive_user = User(
        id=uuid.uuid4(),
        email="inactive@csjmu.ac.in",
        is_active=False,
    )
    mock_session.execute.return_value.scalar_one_or_none.return_value = inactive_user

    with pytest.raises(SystemExit) as exc_info:
        promote_user_to_super_admin("inactive@csjmu.ac.in", confirmed=True)
    assert exc_info.value.code == 1
    mock_session.close.assert_called_once()


@patch("scripts.promote_super_admin.SessionLocal")
def test_promote_missing_super_admin_role_exits(mock_session_cls):
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session
    active_user = User(
        id=uuid.uuid4(),
        email="active@csjmu.ac.in",
        is_active=True,
    )
    # First query returns user; second query (Role) returns None
    mock_session.execute.return_value.scalar_one_or_none.side_effect = [active_user, None]

    with pytest.raises(SystemExit) as exc_info:
        promote_user_to_super_admin("active@csjmu.ac.in", confirmed=True)
    assert exc_info.value.code == 1
    mock_session.close.assert_called_once()


@patch("scripts.promote_super_admin.SessionLocal")
def test_promote_user_already_has_role_noops(mock_session_cls):
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session

    role_id = uuid.uuid4()
    super_admin_role = Role(
        id=role_id,
        name="super_admin",
        is_system=True,
    )
    user = User(
        id=uuid.uuid4(),
        email="existing_admin@csjmu.ac.in",
        is_active=True,
    )
    user.roles = [super_admin_role]

    mock_session.execute.return_value.scalar_one_or_none.side_effect = [user, super_admin_role]

    # Should exit cleanly without calling session.commit() or adding audit log
    promote_user_to_super_admin("existing_admin@csjmu.ac.in", confirmed=True)
    mock_session.add.assert_not_called()
    mock_session.commit.assert_not_called()
    mock_session.close.assert_called_once()


@patch("scripts.promote_super_admin.SessionLocal")
def test_promote_user_success(mock_session_cls):
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session

    role_id = uuid.uuid4()
    user_id = uuid.uuid4()
    super_admin_role = Role(
        id=role_id,
        name="super_admin",
        is_system=True,
    )
    user = User(
        id=user_id,
        email="to_promote@csjmu.ac.in",
        is_active=True,
    )
    user.roles = []

    mock_session.execute.return_value.scalar_one_or_none.side_effect = [user, super_admin_role]

    promote_user_to_super_admin("to_promote@csjmu.ac.in", confirmed=True)

    # 1. user_roles insert was executed
    assert mock_session.execute.call_count >= 3

    # 2. AuditLog was added with valid non-null entity_name and entity_id
    mock_session.add.assert_called_once()
    added_obj = mock_session.add.call_args[0][0]
    assert isinstance(added_obj, AuditLog)
    assert added_obj.user_id == user_id
    assert added_obj.action == "PROMOTE_SUPER_ADMIN"
    assert added_obj.module == "governance_identity"
    assert added_obj.entity_name == "User"
    assert added_obj.entity_id == str(user_id)
    assert added_obj.details["role_promoted"] == "super_admin"

    # 3. Transaction committed and session closed
    mock_session.commit.assert_called_once()
    mock_session.close.assert_called_once()


@patch("scripts.promote_super_admin.SessionLocal")
def test_promote_user_rolls_back_on_commit_error(mock_session_cls):
    mock_session = MagicMock()
    mock_session_cls.return_value = mock_session

    role_id = uuid.uuid4()
    user_id = uuid.uuid4()
    super_admin_role = Role(id=role_id, name="super_admin", is_system=True)
    user = User(id=user_id, email="fail_target@csjmu.ac.in", is_active=True)
    user.roles = []

    mock_session.execute.return_value.scalar_one_or_none.side_effect = [user, super_admin_role]
    mock_session.commit.side_effect = RuntimeError("Database write failure")

    with pytest.raises(SystemExit) as exc_info:
        promote_user_to_super_admin("fail_target@csjmu.ac.in", confirmed=True)
    assert exc_info.value.code == 1
    mock_session.rollback.assert_called_once()
    mock_session.close.assert_called_once()
