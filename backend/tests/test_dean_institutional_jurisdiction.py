# -*- coding: utf-8 -*-
"""
Test Suite: Dean Institutional Jurisdiction & Scope Validation
Validates:
1. Correctly assigned Dean of Research & Development can access the dashboard.
2. A Dean from another department cannot access this dashboard.
3. A Dean from another institution cannot access this dashboard.
4. An unassigned DEAN cannot access the dashboard.
5. Other NIVARAN authority roles remain unaffected.
6. Canonical designation and legacy aliases resolve consistently.
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
    is_authorized_dean_of_rd,
    CANONICAL_DEAN_RD_DESIGNATION,
    DEAN_RD_DESIGNATION_ALIASES,
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
    designation: str = "Dean of Research & Development",
    department: str = "R&D",
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

    def test_01_correctly_assigned_dean_of_rd_access_granted(self):
        """1. Correctly assigned Dean of Research & Development can access the dashboard."""
        user = _make_user("research@csjmu.ac.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation="Dean of Research & Development",
            department="R&D",
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = authority

        # Should pass without error
        validated_user = require_atharva_dean(current_user=user, db=mock_db)
        assert validated_user == user
        assert is_authorized_dean_of_rd(authority, user) is True

    def test_02_dean_from_another_department_rejected(self):
        """2. A Dean from another department cannot access this dashboard."""
        user = _make_user("dean.academics@csjmu.ac.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation="Dean of Academic Affairs",
            department="Academics",
            email="dean.academics@csjmu.ac.in",
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = authority

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Institutional Jurisdiction Restricted: Dean of Research & Development Required" in exc_info.value.detail
        assert is_authorized_dean_of_rd(authority, user) is False

    def test_03_dean_from_another_institution_rejected(self):
        """3. A Dean from another institution cannot access this dashboard."""
        user = _make_user("dean@otheruniversity.edu.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation="Dean of Research & Development",
            department="R&D",
            email="dean@otheruniversity.edu.in",
        )

        mock_db = MagicMock()
        mock_db.scalar.return_value = authority

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Institutional Jurisdiction Restricted" in exc_info.value.detail
        assert is_authorized_dean_of_rd(authority, user) is False

    def test_04_unassigned_dean_rejected(self):
        """4. An unassigned DEAN cannot access the dashboard."""
        user = _make_user("unassigned.dean@csjmu.ac.in", roles=["authority"])

        mock_db = MagicMock()
        # No NivaranAuthority appointment in database
        mock_db.scalar.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

    def test_05_other_nivaran_authority_roles_unaffected(self):
        """5. Other NIVARAN authority roles (Assistant Dean, Associate Dean, Manager) are rejected."""
        user = _make_user("asstdean@csjmu.ac.in")

        for non_dean_role in [NivaranRole.ASSISTANT_DEAN, NivaranRole.ASSOCIATE_DEAN, NivaranRole.MANAGER]:
            authority = _make_authority(
                user_id=user.id,
                role=non_dean_role,
                designation="Institutional Officer",
                department="R&D",
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            with pytest.raises(HTTPException) as exc_info:
                require_atharva_dean(current_user=user, db=mock_db)

            assert exc_info.value.status_code == 403
            assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail

    def test_06_canonical_and_legacy_aliases_accepted(self):
        """6. Canonical designation and legacy aliases are consistently recognized."""
        user = _make_user("research@csjmu.ac.in")

        accepted_designations = [
            "Dean of Research & Development",
            "Dean, Research & Development",
            "Dean of Research and Development",
            "Dean, Research and Development",
            "Dean Research & Development",
            "Dean of R&D",
            "Dean, R&D",
            "Dean (R&D)",
            "Dean r&d",
            "Dean of Research",
        ]

        for desig in accepted_designations:
            authority = _make_authority(
                user_id=user.id,
                role=NivaranRole.DEAN,
                designation=desig,
                department="R&D",
            )
            mock_db = MagicMock()
            mock_db.scalar.return_value = authority

            # Must allow all valid aliases
            validated = require_atharva_dean(current_user=user, db=mock_db)
            assert validated == user
            assert is_authorized_dean_of_rd(authority, user) is True, f"Failed for designation alias: {desig}"

    def test_07_inactive_dean_authority_rejected(self):
        """7. Inactive authority profile is rejected."""
        user = _make_user("research@csjmu.ac.in")
        authority = _make_authority(
            user_id=user.id,
            role=NivaranRole.DEAN,
            designation="Dean of Research & Development",
            department="R&D",
            is_active=False,
        )

        mock_db = MagicMock()
        # db query filters by is_active.is_(True), returning None for inactive records
        mock_db.scalar.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            require_atharva_dean(current_user=user, db=mock_db)

        assert exc_info.value.status_code == 403
        assert "Access restricted to Atharva Veda Dean." in exc_info.value.detail
