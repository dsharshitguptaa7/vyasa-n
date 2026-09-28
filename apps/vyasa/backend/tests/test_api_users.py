import uuid
from app.models.user import User


def test_create_and_get_user(client, db_session):
    test_email = f"api_user_{uuid.uuid4().hex[:8]}@csjmu.ac.in"
    create_payload = {
        "email": test_email,
        "password": "StrongPassword123!",
        "first_name": "Radhakrishnan",
        "last_name": "Scholar",
        "phone": "+919876543210",
        "role_names": ["applicant"],
    }

    # 1. Create user
    res = client.post("/api/users", json=create_payload)
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert body["data"]["email"] == test_email
    assert body["data"]["is_active"] is True
    assert body["data"]["is_verified"] is False
    assert len(body["data"]["roles"]) >= 1
    user_id = body["data"]["id"]

    # 2. Get user by ID
    get_res = client.get(f"/api/users/{user_id}")
    assert get_res.status_code == 200
    get_body = get_res.json()
    assert get_body["success"] is True
    assert get_body["data"]["id"] == user_id
    assert get_body["data"]["email"] == test_email

    # 3. Duplicate email check
    dup_res = client.post("/api/users", json=create_payload)
    assert dup_res.status_code == 409
    assert dup_res.json()["success"] is False

    # Cleanup created test user
    db_user = db_session.get(User, uuid.UUID(user_id))
    if db_user:
        db_session.delete(db_user)
        db_session.commit()


def test_list_users(client):
    res = client.get("/api/users?skip=0&limit=10")
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "users" in body["data"]
    assert "count" in body["data"]


def test_get_nonexistent_user(client):
    fake_id = str(uuid.uuid4())
    res = client.get(f"/api/users/{fake_id}")
    assert res.status_code == 404
    assert res.json()["success"] is False
