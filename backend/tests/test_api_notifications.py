import uuid
from app.models.user import User
from app.models.notification import Notification


def test_notification_flow(client, db_session):
    # Create test user for notification target
    test_email = f"notif_user_{uuid.uuid4().hex[:8]}@csjmu.ac.in"
    user = User(
        email=test_email,
        password_hash="fakehash",
        first_name="Notif",
        last_name="Target",
    )
    db_session.add(user)
    db_session.commit()

    # 1. Dispatch notification
    create_payload = {
        "user_id": str(user.id),
        "title": "Welcome to VYASA",
        "message": "Your platform identity has been established.",
        "type": "info",
        "metadata_json": {"source": "core_onboarding"},
    }
    create_res = client.post("/api/notifications", json=create_payload)
    assert create_res.status_code == 201
    created_body = create_res.json()
    assert created_body["success"] is True
    assert created_body["data"]["title"] == "Welcome to VYASA"
    assert created_body["data"]["is_read"] is False
    notif_id = created_body["data"]["id"]

    # 2. List notifications for user
    list_res = client.get(f"/api/notifications?user_id={user.id}")
    assert list_res.status_code == 200
    list_body = list_res.json()
    assert list_body["success"] is True
    assert list_body["data"]["count"] >= 1

    # 3. Mark notification as read
    read_res = client.patch(f"/api/notifications/{notif_id}/read")
    assert read_res.status_code == 200
    read_body = read_res.json()
    assert read_body["success"] is True
    assert read_body["data"]["is_read"] is True
    assert read_body["data"]["read_at"] is not None

    # Cleanup
    db_notif = db_session.get(Notification, uuid.UUID(notif_id))
    if db_notif:
        db_session.delete(db_notif)
    db_session.delete(user)
    db_session.commit()
