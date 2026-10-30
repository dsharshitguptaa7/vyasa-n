"""
Database-Free Unit Tests for Granular Sama Veda Permissions & RBAC Enforcement.
Verifies:
1. Definition of the 6 new Sama Veda permissions in seed data.
2. Automatic inclusion in super_admin and administrator role-permission mappings.
3. Strict non-inclusion in authority and applicant roles.
4. Behavior of require_permission dependency:
   - Super admin bypasses all granular permission checks.
   - User whose role contains the granular permission is authorized.
   - User lacking the permission receives 403 Forbidden.
"""

from unittest.mock import MagicMock
import uuid
from fastapi import HTTPException
import pytest

from app.api.dependencies import require_permission
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.services.seed_service import INITIAL_PERMISSIONS, ROLE_PERMISSION_MAP


EXPECTED_SAMA_PERMISSIONS = {
    "sama:read",
    "sama:content:edit",
    "sama:content:publish",
    "sama:author:verify",
    "sama:certificate:manage",
    "sama:certificate:revoke",
}


def test_sama_permissions_registered_in_seed():
    """Verify all 6 granular Sama Veda permissions are registered in INITIAL_PERMISSIONS."""
    seed_permission_names = {p["name"] for p in INITIAL_PERMISSIONS}
    for perm in EXPECTED_SAMA_PERMISSIONS:
        assert perm in seed_permission_names, f"Permission '{perm}' is missing from INITIAL_PERMISSIONS"


def test_super_admin_receives_all_sama_permissions():
    """Verify super_admin receives all Sama Veda permissions via ROLE_PERMISSION_MAP."""
    super_admin_perms = set(ROLE_PERMISSION_MAP["super_admin"])
    for perm in EXPECTED_SAMA_PERMISSIONS:
        assert perm in super_admin_perms


def test_administrator_does_not_receive_certificate_revocation():
    """Verify general administrator is strictly excluded from certificate revocation."""
    admin_perms = set(ROLE_PERMISSION_MAP["administrator"])
    assert "sama:certificate:revoke" not in admin_perms
    assert "sama:content:edit" in admin_perms
    assert "sama:content:publish" in admin_perms


def test_delegated_sama_roles_permissions():
    """Verify delegated Sama Veda roles receive appropriate subsets."""
    content_admin_perms = set(ROLE_PERMISSION_MAP["sama_content_admin"])
    content_editor_perms = set(ROLE_PERMISSION_MAP["sama_content_editor"])

    # Content Admin
    assert "sama:read" in content_admin_perms
    assert "sama:content:edit" in content_admin_perms
    assert "sama:content:publish" in content_admin_perms
    assert "sama:author:verify" in content_admin_perms
    assert "sama:certificate:manage" in content_admin_perms
    assert "sama:certificate:revoke" not in content_admin_perms

    # Content Editor
    assert "sama:read" in content_editor_perms
    assert "sama:content:edit" in content_editor_perms
    assert "sama:content:publish" not in content_editor_perms
    assert "sama:author:verify" not in content_editor_perms
    assert "sama:certificate:manage" not in content_editor_perms
    assert "sama:certificate:revoke" not in content_editor_perms


def test_authority_and_applicant_do_not_receive_sama_permissions():
    """Verify standard authority and applicant roles are NOT granted Sama Veda CMS permissions."""
    authority_perms = set(ROLE_PERMISSION_MAP["authority"])
    applicant_perms = set(ROLE_PERMISSION_MAP["applicant"])

    for perm in EXPECTED_SAMA_PERMISSIONS:
        assert perm not in authority_perms, f"Authority was unexpectedly granted '{perm}'"
        assert perm not in applicant_perms, f"Applicant was unexpectedly granted '{perm}'"


def _build_test_user(role_name: str, permission_names: list[str]) -> User:
    role = Role(
        id=uuid.uuid4(),
        name=role_name,
        is_system=True,
    )
    role.permissions = [
        Permission(id=uuid.uuid4(), name=p, resource="sama_veda", action="action")
        for p in permission_names
    ]
    user = User(
        id=uuid.uuid4(),
        email=f"user_{role_name}@csjmu.ac.in",
        first_name="Test",
        last_name="User",
        is_active=True,
        is_verified=True,
    )
    user.roles = [role]
    return user


def test_require_permission_grants_access_to_super_admin():
    """Super admin is universally authorized regardless of granular permission list."""
    super_admin = _build_test_user("super_admin", [])
    guard = require_permission("sama:certificate:revoke")
    result = guard(current_user=super_admin)
    assert result is super_admin


def test_require_permission_grants_access_when_permission_present():
    """User possessing the explicit granular permission is granted access."""
    editor = _build_test_user("sama_editor", ["sama:content:edit", "sama:read"])
    guard = require_permission("sama:content:edit")
    result = guard(current_user=editor)
    assert result is editor


def test_require_permission_denies_access_when_permission_missing():
    """User lacking the explicit granular permission receives HTTP 403 Forbidden."""
    reader = _build_test_user("sama_reader", ["sama:read"])
    guard = require_permission("sama:content:publish")

    with pytest.raises(HTTPException) as exc_info:
        guard(current_user=reader)

    assert exc_info.value.status_code == 403
    assert "Missing required permission: 'sama:content:publish'" in str(exc_info.value.detail)
