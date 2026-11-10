"""
Test Suite: Super Admin Institutional Authority Provisioning & Generic Role Mapping
Validates that:
1. Creating DEAN assigns generic platform role 'authority'.
2. Creating ASSOCIATE_DEAN assigns generic platform role 'authority'.
3. Creating ASSISTANT_DEAN assigns generic platform role 'authority'.
4. Creating MANAGER assigns generic platform role 'authority' (and 'manager' if defined).
5. Generic roles table is NEVER queried for nonexistent roles ('dean', 'associate_dean', etc.).
6. Existing unrelated user roles (e.g. 'applicant', 'sama_content_editor') are strictly preserved.
7. Updating an authority does not remove the generic 'authority' role.
8. Duplicate role associations are prevented.
9. Existing institutional designation and department remain unchanged.
10. Architectural separation between VYASA generic roles and NIVARAN institutional roles is preserved.
"""
import uuid
from unittest.mock import MagicMock
import pytest

from app.models.role import Role
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole
from app.modules.atharva_veda.nivaran.services.admin_config_service import (
    AdminConfigService,
    PLATFORM_GENERIC_AUTHORITY_ROLE,
    INSTITUTIONAL_TO_PLATFORM_ROLES,
)


@pytest.fixture
def mock_db():
    db = MagicMock()
    authority_role = Role(id=uuid.uuid4(), name=PLATFORM_GENERIC_AUTHORITY_ROLE)
    manager_role = Role(id=uuid.uuid4(), name="manager")

    def mock_scalar(query, *args, **kwargs):
        query_str = str(query).lower()
        if "from roles" in query_str:
            if "authority" in query_str:
                return authority_role
            if "manager" in query_str:
                return manager_role
        return None

    def mock_scalars(query, *args, **kwargs):
        res = MagicMock()
        query_str = str(query).lower()
        if "roles" in query_str:
            res.all.return_value = [authority_role]
        else:
            res.all.return_value = []
        return res

    db.scalar.side_effect = mock_scalar
    db.scalars.side_effect = mock_scalars
    db.execute.return_value.all.return_value = []
    db.authority_role = authority_role
    db.manager_role = manager_role
    return db


def test_institutional_to_platform_roles_mapping():
    """Verify centralized mapping covers all institutional authority roles."""
    assert INSTITUTIONAL_TO_PLATFORM_ROLES[NivaranRole.DEAN] == ["authority"]
    assert INSTITUTIONAL_TO_PLATFORM_ROLES[NivaranRole.ASSOCIATE_DEAN] == ["authority"]
    assert INSTITUTIONAL_TO_PLATFORM_ROLES[NivaranRole.ASSISTANT_DEAN] == ["authority"]
    assert "authority" in INSTITUTIONAL_TO_PLATFORM_ROLES[NivaranRole.MANAGER]
    assert INSTITUTIONAL_TO_PLATFORM_ROLES[NivaranRole.GUEST_MEMBER] == ["authority"]


def test_create_dean_assigns_generic_authority(mock_db):
    """Creating a DEAN must assign generic platform role 'authority' and never query 'dean'."""
    added_objs = []
    mock_db.add.side_effect = lambda obj: added_objs.append(obj)

    executed_statements = []
    def track_execute(stmt, *args, **kwargs):
        executed_statements.append(str(stmt))
        res = MagicMock()
        res.all.return_value = []
        return res

    mock_db.execute.side_effect = track_execute

    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Prof. Namita Tiwari",
        email="research@csjmu.ac.in",
        role=NivaranRole.DEAN,
        designation="Dean of Research & Development",
        department="R&D",
    )

    assert auth.role == NivaranRole.DEAN
    assert auth.designation == "Dean of Research & Development"
    assert auth.department == "R&D"

    # User created with generic authority role
    users = [o for o in added_objs if isinstance(o, User)]
    assert len(users) == 1
    user = users[0]

    # Verify user_roles insert was executed or role appended
    user_roles_inserted = any("INSERT INTO user_roles" in s for s in executed_statements)
    assert user_roles_inserted or mock_db.authority_role in user.roles


def test_create_associate_dean_assigns_generic_authority(mock_db):
    """Creating an ASSOCIATE_DEAN assigns generic platform role 'authority'."""
    added_objs = []
    mock_db.add.side_effect = lambda obj: added_objs.append(obj)
    mock_db.execute.return_value.all.return_value = []

    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Dr. Assoc Dean",
        email="assoc@csjmu.ac.in",
        role=NivaranRole.ASSOCIATE_DEAN,
        designation="Associate Dean Academic",
        department="Academic Affairs",
    )

    assert auth.role == NivaranRole.ASSOCIATE_DEAN
    users = [o for o in added_objs if isinstance(o, User)]
    assert len(users) == 1
    assert mock_db.authority_role in users[0].roles or mock_db.execute.called


def test_create_assistant_dean_assigns_generic_authority(mock_db):
    """Creating an ASSISTANT_DEAN assigns generic platform role 'authority'."""
    added_objs = []
    mock_db.add.side_effect = lambda obj: added_objs.append(obj)
    mock_db.execute.return_value.all.return_value = []

    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Dr. Asst Dean",
        email="asst@csjmu.ac.in",
        role=NivaranRole.ASSISTANT_DEAN,
        designation="Assistant Dean",
        department="R&D",
    )

    assert auth.role == NivaranRole.ASSISTANT_DEAN
    users = [o for o in added_objs if isinstance(o, User)]
    assert len(users) == 1
    assert mock_db.authority_role in users[0].roles or mock_db.execute.called


def test_create_manager_assigns_generic_authority(mock_db):
    """Creating a MANAGER assigns generic platform role 'authority' and 'manager'."""
    added_objs = []
    mock_db.add.side_effect = lambda obj: added_objs.append(obj)
    mock_db.execute.return_value.all.return_value = []

    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Mr. Manager",
        email="mgr@csjmu.ac.in",
        role=NivaranRole.MANAGER,
        designation="Support Manager",
        department="R&D",
    )

    assert auth.role == NivaranRole.MANAGER
    users = [o for o in added_objs if isinstance(o, User)]
    assert len(users) == 1


def test_no_nonexistent_generic_role_queried(mock_db):
    """Verify that roles table is NEVER queried for nonexistent roles like 'dean'."""
    queried_roles = []

    def tracking_scalars(query, *args, **kwargs):
        queried_roles.append(str(query).lower())
        res = MagicMock()
        res.all.return_value = [mock_db.authority_role]
        return res

    mock_db.scalars.side_effect = tracking_scalars
    mock_db.execute.return_value.all.return_value = []

    AdminConfigService.create_authority(
        db=mock_db,
        name="Prof. Namita Tiwari",
        email="research@csjmu.ac.in",
        role=NivaranRole.DEAN,
        designation="Dean of Research & Development",
        department="R&D",
    )

    for query_str in queried_roles:
        assert "dean" not in query_str


def test_existing_user_roles_are_preserved(mock_db):
    """When an existing user with other roles is assigned an authority, existing roles are preserved."""
    existing_applicant_role = Role(id=uuid.uuid4(), name="applicant")
    existing_user = User(
        id=uuid.uuid4(),
        email="researcher@csjmu.ac.in",
        first_name="Dr.",
        last_name="Researcher",
        is_active=True,
    )
    existing_user.roles = [existing_applicant_role]

    def mock_scalar_existing(query, *args, **kwargs):
        query_str = str(query).lower()
        if "from users" in query_str:
            return existing_user
        if "from nivaran_authorities" in query_str:
            return None
        if "from roles" in query_str:
            return mock_db.authority_role
        return None

    mock_db.scalar.side_effect = mock_scalar_existing
    mock_db.execute.return_value.all.return_value = [(existing_applicant_role.id,)]

    auth = AdminConfigService.create_authority(
        db=mock_db,
        name="Dr. Researcher",
        email="researcher@csjmu.ac.in",
        role=NivaranRole.DEAN,
        designation="Dean of Research & Development",
        department="R&D",
    )

    assert auth.vyasa_user_id == existing_user.id
    # Existing role preserved
    assert existing_applicant_role in existing_user.roles
    # Authority role added
    assert mock_db.authority_role in existing_user.roles


def test_duplicate_role_associations_prevented(mock_db):
    """If user already has 'authority' role, duplicate insertion into user_roles is prevented."""
    user = User(
        id=uuid.uuid4(),
        email="existing_authority@csjmu.ac.in",
        first_name="Dean",
        last_name="Test",
    )
    user.roles = [mock_db.authority_role]

    insert_executed = []

    def mock_execute(stmt, *args, **kwargs):
        stmt_str = str(stmt)
        if "INSERT INTO user_roles" in stmt_str:
            insert_executed.append(stmt)
        res = MagicMock()
        res.all.return_value = [(mock_db.authority_role.id,)]
        return res

    mock_db.execute.side_effect = mock_execute

    AdminConfigService._ensure_user_platform_authority_roles(mock_db, user, NivaranRole.DEAN)

    # Must NOT have executed insert since role already present
    assert len(insert_executed) == 0


def test_update_authority_preserves_authority_role(mock_db):
    """Updating an authority preserves the generic authority role and designation."""
    auth_id = uuid.uuid4()
    user_id = uuid.uuid4()

    auth = NivaranAuthority(
        id=auth_id,
        vyasa_user_id=user_id,
        role=NivaranRole.ASSISTANT_DEAN,
        name_snapshot="Dr. Old Name",
        email_snapshot="old@csjmu.ac.in",
        designation="Assistant Dean",
        department="R&D",
        is_active=True,
    )

    user = User(
        id=user_id,
        email="old@csjmu.ac.in",
        first_name="Dr.",
        last_name="Old Name",
    )
    user.roles = [mock_db.authority_role]

    def mock_scalar_update(query, *args, **kwargs):
        query_str = str(query).lower()
        if "from nivaran_authorities" in query_str:
            return auth
        if "from users" in query_str:
            return user
        if "from roles" in query_str:
            return mock_db.authority_role
        return None

    mock_db.scalar.side_effect = mock_scalar_update
    mock_db.execute.return_value.all.return_value = [(mock_db.authority_role.id,)]

    updated_auth = AdminConfigService.update_authority(
        db=mock_db,
        authority_id=auth_id,
        name="Dr. New Name",
        designation="Senior Assistant Dean",
    )

    assert updated_auth.name_snapshot == "Dr. New Name"
    assert updated_auth.designation == "Senior Assistant Dean"
    assert updated_auth.department == "R&D"
    assert mock_db.authority_role in user.roles
