import uuid
from sqlalchemy import select
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.models.pillar import PillarRegistry
from app.models.notification import Notification


def test_user_creation_and_defaults(db_session):
    test_email = f"test_{uuid.uuid4().hex[:8]}@csjmu.ac.in"
    user = User(
        email=test_email,
        password_hash="argon2id_mock_hash",
        first_name="Aryabhata",
        last_name="Scholar",
    )
    db_session.add(user)
    db_session.commit()

    assert user.id is not None
    assert isinstance(user.id, uuid.UUID)
    assert user.is_active is True
    assert user.is_verified is False
    assert user.created_at is not None

    # Cleanup
    db_session.delete(user)
    db_session.commit()


def test_role_and_permission_models(db_session):
    stmt = select(Role).where(Role.name == "administrator")
    admin_role = db_session.execute(stmt).scalar_one_or_none()
    assert admin_role is not None
    assert admin_role.is_system is True
    assert len(admin_role.permissions) >= 10


def test_pillar_registry_model(db_session):
    stmt = select(PillarRegistry).where(PillarRegistry.pillar_key == "nivaran")
    nivaran = db_session.execute(stmt).scalar_one_or_none()
    assert nivaran is not None
    assert nivaran.name == "NIVARAN"
    assert nivaran.is_enabled is True
    assert isinstance(nivaran.metadata_json, dict)


def test_notification_model(db_session):
    test_email = f"notif_{uuid.uuid4().hex[:8]}@csjmu.ac.in"
    user = User(
        email=test_email,
        password_hash="argon2id_mock_hash",
        first_name="Test",
        last_name="Recipient",
    )
    db_session.add(user)
    db_session.commit()

    notif = Notification(
        user_id=user.id,
        title="Grievance Registered",
        message="Your submission has been queued.",
        type="grievance",
    )
    db_session.add(notif)
    db_session.commit()

    assert notif.id is not None
    assert notif.is_read is False
    assert notif.created_at is not None

    # Relationship verify
    assert len(user.notifications) == 1
    assert user.notifications[0].title == "Grievance Registered"

    # Cleanup
    db_session.delete(notif)
    db_session.delete(user)
    db_session.commit()
