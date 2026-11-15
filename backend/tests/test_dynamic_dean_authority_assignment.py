# -*- coding: utf-8 -*-
"""
Dynamic Dean Authority Assignment & Dashboard Authorization Test Suite
Verifies:
1. Assign DEAN to User A -> Dashboard accessible.
2. Assign DEAN to User B -> Dashboard accessible for User B too (no code changes).
3. Revoke User A's DEAN assignment -> Access denied immediately.
4. Assign DEAN to User C -> User C gains access dynamically.
5. Assign another authority role to User D (Assistant Dean, Associate Dean, Manager) -> Dean dashboard denied.
6. Institutional jurisdiction isolation enforced (external domains rejected).
7. Both dashboard and cases endpoints share the exact same centralized authorization dependency.
8. Super Admin without DEAN authority assignment is denied access.
9. No hardcoded account, email, user ID, or designation dependency.
10. Dynamic authority transfer / reassignment seamlessly transitions access.
"""

import uuid
import pytest
from unittest.mock import MagicMock
from fastapi import HTTPException

from app.models.user import User
from app.models.role import Role
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.dependencies import (
    require_atharva_dean,
    is_authorized_dean,
    resolve_authority_institutional_jurisdiction,
    CANONICAL_DEAN_DESIGNATION,
)
from app.modules.atharva_veda.nivaran.router import router


def _create_test_user(
    email: str,
    first_name: str = "Test",
    last_name: str = "User",
    is_active: bool = True,
    user_id: uuid.UUID = None,
    roles: list[str] = None,
) -> User:
    u = MagicMock(spec=User)
    u.id = user_id or uuid.uuid4()
    u.email = email
    u.first_name = first_name
    u.last_name = last_name
    u.is_active = is_active
    u.is_verified = True
    u.roles = []
    for r in (roles or ["authority"]):
        mock_r = MagicMock(spec=Role)
        mock_r.name = r
        u.roles.append(mock_r)
    return u


def _create_authority_assignment(
    user_id: uuid.UUID,
    email: str,
    name: str = "Test Authority",
    role: NivaranRole = NivaranRole.DEAN,
    designation: str = "Dean",
    department: str = "Office of the Dean",
    is_active: bool = True,
    auth_id: uuid.UUID = None,
) -> NivaranAuthority:
    a = MagicMock(spec=NivaranAuthority)
    a.id = auth_id or uuid.uuid4()
    a.vyasa_user_id = user_id
    a.role = role
    a.name_snapshot = name
    a.email_snapshot = email
    a.designation = designation
    a.department = department
    a.is_active = is_active
    return a


class TestDynamicDeanAuthorityAssignment:

    def test_01_assign_dean_to_user_a_dashboard_accessible(self):
        """1. When Super Admin assigns DEAN to User A, User A can access the Dean dashboard."""
        user_a = _create_test_user("user.a@csjmu.ac.in", first_name="User", last_name="A")
        auth_a = _create_authority_assignment(
            user_id=user_a.id,
            email=user_a.email,
            name="Prof. User A",
            role=NivaranRole.DEAN,
            is_active=True,
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = auth_a

        validated = require_atharva_dean(current_user=user_a, db=mock_db)
        assert validated == user_a
        assert getattr(validated, "active_authority", None) == auth_a
        assert validated.institutional_scope["institutional_domain"] == "csjmu.ac.in"
        assert validated.institutional_scope["role"] == "DEAN"
        assert is_authorized_dean(auth_a, user_a) is True

    def test_02_assign_dean_to_user_b_dashboard_accessible(self):
        """2. When Super Admin assigns DEAN to User B, User B gains access too without code modifications."""
        user_b = _create_test_user("user.b@csjmu.ac.in", first_name="User", last_name="B")
        auth_b = _create_authority_assignment(
            user_id=user_b.id,
            email=user_b.email,
            name="Prof. User B",
            role=NivaranRole.DEAN,
            is_active=True,
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = auth_b

        validated = require_atharva_dean(current_user=user_b, db=mock_db)
        assert validated == user_b
        assert getattr(validated, "active_authority", None) == auth_b
        assert is_authorized_dean(auth_b, user_b) is True

    def test_03_revoke_user_a_dean_assignment_access_denied(self):
        """3. When Super Admin revokes User A's DEAN assignment, dashboard access is immediately denied."""
        user_a = _create_test_user("user.a@csjmu.ac.in", first_name="User", last_name="A")
        
        # Scenario A: Assignment deactivated (is_active = False)
        auth_revoked = _create_authority_assignment(
            user_id=user_a.id,
            email=user_a.email,
            name="Prof. User A",
            role=NivaranRole.DEAN,
            is_active=False,
        )
        mock_db = MagicMock()
        mock_db.scalar.return_value = auth_revoked

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user_a, db=mock_db)
        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

        # Scenario B: Authority record deleted entirely
        mock_db.scalar.return_value = None
        with pytest.raises(HTTPException) as exc_info_del:
            require_atharva_dean(current_user=user_a, db=mock_db)
        assert exc_info_del.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info_del.value.detail

    def test_04_assign_dean_to_user_c_gains_access_dynamically(self):
        """4. When Super Admin assigns DEAN to User C, User C immediately gains access without code changes."""
        user_c = _create_test_user("user.c@csjmu.ac.in", first_name="User", last_name="C")
        auth_c = _create_authority_assignment(
            user_id=user_c.id,
            email=user_c.email,
            name="Prof. User C",
            role=NivaranRole.DEAN,
            designation="Dean",
            department="Office of the Dean",
            is_active=True,
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = auth_c

        validated = require_atharva_dean(current_user=user_c, db=mock_db)
        assert validated == user_c
        assert getattr(validated, "active_authority", None) == auth_c
        assert is_authorized_dean(auth_c, user_c) is True

    def test_05_assign_other_authority_role_to_user_d_access_denied(self):
        """5. Users assigned other authority roles (Assistant Dean, Associate Dean, Manager) cannot access Dean dashboard."""
        non_dean_roles = [
            (NivaranRole.ASSISTANT_DEAN, "Assistant Dean"),
            (NivaranRole.ASSOCIATE_DEAN, "Associate Dean"),
            (NivaranRole.MANAGER, "Grievance Manager"),
            (NivaranRole.GUEST_MEMBER, "Guest Expert"),
        ]

        for role_val, title in non_dean_roles:
            user_d = _create_test_user(f"user.{role_val.value.lower()}@csjmu.ac.in")
            auth_d = _create_authority_assignment(
                user_id=user_d.id,
                email=user_d.email,
                name=f"Officer {title}",
                role=role_val,
                designation=title,
                is_active=True,
            )

            mock_db = MagicMock()
            mock_db.scalar.return_value = auth_d

            with pytest.raises(HTTPException) as exc_info:
                require_atharva_dean(current_user=user_d, db=mock_db)
            assert exc_info.value.status_code == 403
            assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail
            assert is_authorized_dean(auth_d, user_d) is False

    def test_06_institutional_jurisdiction_isolation(self):
        """6. Institutional jurisdiction isolation: Dean from external domain is strictly rejected."""
        external_domains = [
            "dean@oxford.ac.uk",
            "dean@mit.edu",
            "dean@otheruniv.ac.in",
            "attacker@unauthorized.org",
        ]

        for ext_email in external_domains:
            ext_user = _create_test_user(ext_email)
            ext_auth = _create_authority_assignment(
                user_id=ext_user.id,
                email=ext_email,
                role=NivaranRole.DEAN,
                is_active=True,
            )

            mock_db = MagicMock()
            mock_db.scalar.return_value = ext_auth

            with pytest.raises(HTTPException) as exc_info:
                require_atharva_dean(current_user=ext_user, db=mock_db)
            assert exc_info.value.status_code == 403
            assert "Institutional Jurisdiction Restricted: Authorized Dean Required." in exc_info.value.detail
            assert is_authorized_dean(ext_auth, ext_user) is False

    def test_07_both_dashboard_and_cases_endpoints_use_same_dependency(self):
        """7. Verify both /dean/dashboard and /dean/dashboard/cases endpoints share require_atharva_dean."""
        import inspect

        routes_to_verify = [
            "/modules/atharva-veda/nivaran/dean/dashboard",
            "/modules/atharva-veda/nivaran/dean/dashboard/cases",
            "/modules/atharva-veda/nivaran/dean/cases",
        ]

        matched_routes = {}
        for r in router.routes:
            path = getattr(r, "path", None)
            if path in routes_to_verify:
                matched_routes[path] = r

        assert len(matched_routes) == len(routes_to_verify), f"Missing routes in Nivaran router: {routes_to_verify}"

        # Verify that require_atharva_dean is the dependency for all of them
        for path, route in matched_routes.items():
            sig = inspect.signature(route.endpoint)
            assert "user" in sig.parameters, f"Route {path} missing 'user' parameter"
            user_param = sig.parameters["user"]
            assert hasattr(user_param.default, "dependency"), f"Route {path} 'user' param is not a Depends()"
            assert user_param.default.dependency == require_atharva_dean, (
                f"Route {path} does not use require_atharva_dean dependency (uses {user_param.default.dependency})"
            )

    def test_08_super_admin_without_dean_assignment_denied(self):
        """8. Super Admin user without an appointed active DEAN authority assignment is denied access."""
        admin_user = _create_test_user("superadmin@csjmu.ac.in", roles=["super_admin", "admin"])
        
        mock_db = MagicMock()
        mock_db.scalar.return_value = None  # No NivaranAuthority DEAN profile

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=admin_user, db=mock_db)
        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

    def test_09_no_hardcoded_user_ids_or_emails(self):
        """9. Verifies that authorization does not depend on any specific hardcoded email or UUID."""
        random_uuids = [uuid.uuid4() for _ in range(3)]
        for test_uuid in random_uuids:
            arbitrary_email = f"dean_{test_uuid.hex[:8]}@csjmu.ac.in"
            dynamic_user = _create_test_user(arbitrary_email, user_id=test_uuid)
            dynamic_auth = _create_authority_assignment(
                user_id=test_uuid,
                email=arbitrary_email,
                name="Dynamically Appointed Dean",
                role=NivaranRole.DEAN,
                is_active=True,
            )

            mock_db = MagicMock()
            mock_db.scalar.return_value = dynamic_auth

            validated = require_atharva_dean(current_user=dynamic_user, db=mock_db)
            assert validated == dynamic_user
            assert is_authorized_dean(dynamic_auth, dynamic_user) is True

    def test_10_dynamic_reassignment_transitions_access(self):
        """10. Dynamic authority reassignment: Old Dean deactivated, New Dean activated -> Access flips."""
        old_dean = _create_test_user("old.dean@csjmu.ac.in")
        new_dean = _create_test_user("new.dean@csjmu.ac.in")

        old_auth = _create_authority_assignment(
            user_id=old_dean.id,
            email=old_dean.email,
            role=NivaranRole.DEAN,
            is_active=False,  # Reassigned / deactivated
        )
        new_auth = _create_authority_assignment(
            user_id=new_dean.id,
            email=new_dean.email,
            role=NivaranRole.DEAN,
            is_active=True,   # Newly assigned active Dean
        )

        mock_db = MagicMock()

        # Old Dean attempt -> Rejected
        mock_db.scalar.return_value = old_auth
        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=old_dean, db=mock_db)
        assert exc_info.value.status_code == 403

        # New Dean attempt -> Granted
        mock_db.scalar.return_value = new_auth
        validated = require_atharva_dean(current_user=new_dean, db=mock_db)
        assert validated == new_dean
        assert is_authorized_dean(new_auth, new_dean) is True
