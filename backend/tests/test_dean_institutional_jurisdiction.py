# -*- coding: utf-8 -*-
"""
Test Suite: Dean Institutional Jurisdiction & Scope Validation
Validates:
1. Correctly assigned Dean can access the dashboard with canonical designation "Dean".
2. Dean with legacy designations (Dean of Research & Development, Dean of Academic Affairs) is granted access.
3. A Dean from another institution cannot access this dashboard.
4. An unassigned DEAN without active authority record cannot access the dashboard.
5. Other NIVARAN authority roles (Assistant Dean, Associate Dean, Manager) are rejected.
6. Canonical designation and legacy formatting variations resolve consistently.
7. Inactive authority profile is rejected.
8. Dean with various department designations is granted access under the unified DEAN authority.
9. Dean with mismatched institutional domain is rejected with Institutional Jurisdiction Restricted.
10. Super Admin without an appointed DEAN profile cannot access Dean command center.
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
    is_authorized_dean_of_rd,
    CANONICAL_DEAN_DESIGNATION,
)


def _make_user(
    email: str = "research@csjmu.ac.in",
    roles: list[str] = None,
    user_id: uuid.UUID = None,
) -> User:
    u = MagicMock(spec=User)
    u.id = user_id or uuid.uuid4()
    u.email = email
    u.first_name = "Prof. Namita"
    u.last_name = "Tiwari"
    u.is_active = True
    u.is_verified = True
    u.roles = []
    for r in (roles or ["authority"]):
        mock_r = MagicMock(spec=Role)
        mock_r.name = r
        u.roles.append(mock_r)
    return u


def _make_authority(
    user_id: uuid.UUID,
    role: NivaranRole = NivaranRole.DEAN,
    designation: str = "Dean",
    department: str = "Office of the Dean",
    email: str = "research@csjmu.ac.in",
    is_active: bool = True,
) -> NivaranAuthority:
    a = MagicMock(spec=NivaranAuthority)
    a.id = uuid.uuid4()
    a.vyasa_user_id = user_id
    a.role = role
    a.designation = designation
    a.department = department
    a.email_snapshot = email
    a.is_active = is_active
    return a


class TestDeanInstitutionalJurisdiction:

    def test_01_correctly_assigned_dean_access_granted(self):
        """1. Correctly assigned Dean with canonical designation can access the dashboard."""
        user = _make_user("research@csjmu.ac.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation=CANONICAL_DEAN_DESIGNATION,
            department="Office of the Dean",
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = authority

        validated_user = require_atharva_dean(current_user=user, db=mock_db)
        assert validated_user == user
        assert is_authorized_dean(authority, user) is True
        assert is_authorized_dean_of_rd(authority, user) is True

    def test_02_dean_with_legacy_designations_access_granted(self):
        """2. Existing Dean accounts with legacy designations (e.g. Dean of R&D, Dean of Academic Affairs) are granted access."""
        legacy_designations = [
            "Dean of Research & Development",
            "Dean of Academic Affairs",
            "Dean, Research & Development",
            "Dean (R&D)",
            "Dean of R&D",
        ]

        user = _make_user("research@csjmu.ac.in")
        for legacy_desig in legacy_designations:
            authority = _make_authority(
                user_id=user.id,
                role=NivaranRole.DEAN,
                designation=legacy_desig,
                department="University Administration",
                email="research@csjmu.ac.in",
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            validated_user = require_atharva_dean(current_user=user, db=mock_db)
            assert validated_user == user
            assert is_authorized_dean(authority, user) is True

    def test_03_dean_from_another_institution_rejected(self):
        """3. A Dean from another institution cannot access this dashboard."""
        user = _make_user("dean@otheruniversity.edu.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation="Dean",
            department="Office of the Dean",
            email="dean@otheruniversity.edu.in",
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = authority

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Institutional Jurisdiction Restricted: Authorized Dean Required." in exc_info.value.detail
        assert is_authorized_dean(authority, user) is False

    def test_04_unassigned_dean_rejected(self):
        """4. An unassigned DEAN without an active NivaranAuthority record cannot access the dashboard."""
        user = _make_user("unassigned.dean@csjmu.ac.in", roles=["authority"])

        mock_db = MagicMock()
        mock_db.scalar.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

    def test_05_other_nivaran_authority_roles_rejected(self):
        """5. Other NIVARAN authority roles (Assistant Dean, Associate Dean, Manager) are rejected."""
        user = _make_user("asstdean@csjmu.ac.in")

        for non_dean_role in [NivaranRole.ASSISTANT_DEAN, NivaranRole.ASSOCIATE_DEAN, NivaranRole.MANAGER]:
            authority = _make_authority(
                user_id=user.id,
                role=non_dean_role,
                designation="Institutional Officer",
                department="Academics",
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            with pytest.raises(HTTPException) as exc_info:
                require_atharva_dean(current_user=user, db=mock_db)

            assert exc_info.value.status_code == 403
            assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

    def test_06_canonical_and_formatting_variations_accepted(self):
        """6. Canonical designation and various formatting variations are recognized."""
        user = _make_user("research@csjmu.ac.in")

        accepted_designations = [
            "Dean",
            "dean",
            "DEAN",
            "Dean of Research & Development",
            "Dean, Research & Development",
            "Dean of Research and Development",
            "Dean of Academic Affairs",
            "Dean (R&D)",
            "Dean of R&D",
            None,
        ]

        for desig in accepted_designations:
            authority = _make_authority(
                user_id=user.id,
                role=NivaranRole.DEAN,
                designation=desig,
                department="Administration",
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            validated = require_atharva_dean(current_user=user, db=mock_db)
            assert validated == user, f"Failed for designation: {desig}"
            assert is_authorized_dean(authority, user) is True

    def test_07_inactive_dean_authority_rejected(self):
        """7. Inactive authority profile is rejected."""
        user = _make_user("research@csjmu.ac.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation="Dean",
            department="Office of the Dean",
            is_active=False,
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

    def test_08_dean_role_with_department_variations_granted(self):
        """8. Appointed Dean with department variations is granted access under the canonical DEAN authority."""
        user = _make_user("dean.office@csjmu.ac.in")

        test_variations = [
            ("Dean", "R&D"),
            ("Dean", "Research and Development"),
            ("Dean", None),
            ("Dean", "Dean Office"),
            ("Dean", "University Administration"),
            ("Dean", "Academic Affairs"),
            (None, None),
        ]

        for desig, dept in test_variations:
            authority = _make_authority(
                user_id=user.id,
                role=NivaranRole.DEAN,
                designation=desig,
                department=dept,
                email="dean.office@csjmu.ac.in",
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            validated = require_atharva_dean(current_user=user, db=mock_db)
            assert validated == user, f"Failed for designation '{desig}' and department '{dept}'"
            assert is_authorized_dean(authority, user) is True

    def test_09_institutional_domain_mismatch_rejected(self):
        """9. Dean user with email from untrusted/external domain is rejected with institutional jurisdiction error."""
        external_emails = [
            "dean@gmail.com",
            "dean@yahoo.com",
            "dean@harvard.edu",
            "intruder@external-org.net",
        ]

        for ext_email in external_emails:
            user = _make_user(ext_email)
            authority = _make_authority(
                user_id=user.id,
                role=NivaranRole.DEAN,
                designation="Dean",
                department="Office of the Dean",
                email=ext_email,
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            with pytest.raises(HTTPException) as exc_info:
                require_atharva_dean(current_user=user, db=mock_db)

            assert exc_info.value.status_code == 403
            assert "Institutional Jurisdiction Restricted: Authorized Dean Required." in exc_info.value.detail
            assert is_authorized_dean(authority, user) is False

    def test_10_super_admin_without_dean_appointment_rejected(self):
        """10. Super Admin without an appointed NivaranAuthority DEAN profile cannot access Dean command center."""
        user = _make_user("superadmin@csjmu.ac.in", roles=["super_admin"])

        mock_db = MagicMock()
        mock_db.scalar.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail
