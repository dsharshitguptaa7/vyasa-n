import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.core.subjects import CANONICAL_SUBJECTS
from app.models.applicant_profile import ApplicantProfile
from app.models.user import User


def test_get_subjects_returns_all_56_subjects(client: TestClient) -> None:
    """Verify GET /api/auth/subjects returns exactly 56 canonical subjects sorted by name."""
    response = client.get("/api/auth/subjects")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 56
    # Verify structure of each subject
    for item in data:
        assert "id" in item
        assert "name" in item
        uuid.UUID(item["id"])  # Must be valid UUID
        assert len(item["name"]) > 0

    # Verify alphabetical sorting
    names = [s["name"] for s in data]
    assert names == sorted(names)


def test_register_applicant_success_full_data(client: TestClient, db_session: Session) -> None:
    """Verify applicant registration with full details creates user and profile."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"applicant_{unique_suffix}@csjmu.ac.in"
    phd_reg = f"PHD/2026/{unique_suffix}"
    subject = CANONICAL_SUBJECTS[0]  # Agricultural Chemistry

    payload = {
        "full_name": "Rohan Kumar Sharma",
        "email": email,
        "password": "Password123",
        "phone": "+919876543210",
        "phd_registration_number": phd_reg,
        "department": "Department of Agriculture",
        "subject_id": subject["id"],
    }

    try:
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["message"] == "Registration successful"
        assert data["email"] == email.lower()
        assert data["full_name"] == "Rohan Kumar Sharma"
        assert data["role"] == "applicant"
        assert data["subject_id"] == subject["id"]
        assert data["subject_name"] == subject["name"]
        assert data["phd_registration_number"] == phd_reg

        # Verify DB User record
        user_uuid = uuid.UUID(data["user_id"])
        user = db_session.execute(select(User).where(User.id == user_uuid)).scalar_one_or_none()
        assert user is not None
        assert user.email == email.lower()
        assert user.first_name == "Rohan Kumar"
        assert user.last_name == "Sharma"
        assert user.phone == "+919876543210"
        assert user.is_active is True
        assert user.is_verified is False
        assert [r.name for r in user.roles] == ["applicant"]
        assert verify_password("Password123", user.password_hash)

        # Verify DB ApplicantProfile record
        profile = db_session.execute(
            select(ApplicantProfile).where(ApplicantProfile.user_id == user_uuid)
        ).scalar_one_or_none()
        assert profile is not None
        assert profile.phd_registration_number == phd_reg
        assert profile.department == "Department of Agriculture"
        assert str(profile.subject_id) == subject["id"]
        assert profile.subject_name == subject["name"]
    finally:
        # Cleanup
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_register_applicant_success_minimal_data(client: TestClient, db_session: Session) -> None:
    """Verify applicant registration succeeds with only mandatory fields."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"minimal_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[5]  # Biochemistry

    payload = {
        "full_name": "Pooja Verma",
        "email": email,
        "password": "Password123",
        "subject_id": subject["id"],
    }

    try:
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == email.lower()
        assert data["phd_registration_number"] is None

        user_uuid = uuid.UUID(data["user_id"])
        profile = db_session.execute(
            select(ApplicantProfile).where(ApplicantProfile.user_id == user_uuid)
        ).scalar_one_or_none()
        assert profile is not None
        assert profile.phd_registration_number is None
        assert profile.department is None
        assert str(profile.subject_id) == subject["id"]
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_registered_applicant_can_login_immediately(client: TestClient, db_session: Session) -> None:
    """Verify newly registered applicant can immediately authenticate via POST /api/auth/login."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"login_test_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[10]

    payload = {
        "full_name": "Test Login Applicant",
        "email": email,
        "password": "SecurePassword99",
        "subject_id": subject["id"],
    }

    try:
        reg_resp = client.post("/api/auth/register", json=payload)
        assert reg_resp.status_code == 201

        login_resp = client.post(
            "/api/auth/login",
            json={"email": email, "password": "SecurePassword99"},
        )
        assert login_resp.status_code == 200
        token_data = login_resp.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"
        assert token_data["user"]["email"] == email.lower()
        assert token_data["user"]["roles"] == ["applicant"]
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_registered_applicant_can_access_me_endpoint(client: TestClient, db_session: Session) -> None:
    """Verify newly registered applicant can access GET /api/auth/me with bearer token."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"me_test_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[12]

    payload = {
        "full_name": "Me Endpoint User",
        "email": email,
        "password": "SecurePassword99",
        "subject_id": subject["id"],
    }

    try:
        client.post("/api/auth/register", json=payload)
        login_resp = client.post(
            "/api/auth/login",
            json={"email": email, "password": "SecurePassword99"},
        )
        token = login_resp.json()["access_token"]

        me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["email"] == email.lower()
        assert me_data["roles"] == ["applicant"]
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_registered_applicant_token_verifies_successfully(client: TestClient, db_session: Session) -> None:
    """Verify token verify contract endpoint returns valid=True for registered applicant."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"verify_test_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[15]

    payload = {
        "full_name": "Verification Applicant",
        "email": email,
        "password": "SecurePassword99",
        "subject_id": subject["id"],
    }

    try:
        client.post("/api/auth/register", json=payload)
        login_resp = client.post(
            "/api/auth/login",
            json={"email": email, "password": "SecurePassword99"},
        )
        token = login_resp.json()["access_token"]

        verify_resp = client.post("/api/auth/verify", json={"token": token})
        assert verify_resp.status_code == 200
        verify_data = verify_resp.json()
        assert verify_data["valid"] is True
        assert verify_data["user"]["email"] == email.lower()
        assert verify_data["user"]["roles"] == ["applicant"]
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_duplicate_email_rejected_with_409(client: TestClient, db_session: Session) -> None:
    """Verify attempting to register with an existing email returns 409 Conflict."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"duplicate_email_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[0]

    payload = {
        "full_name": "Original User",
        "email": email,
        "password": "Password123",
        "subject_id": subject["id"],
    }

    try:
        res1 = client.post("/api/auth/register", json=payload)
        assert res1.status_code == 201

        # Second registration with uppercase variant
        payload2 = {
            "full_name": "Duplicate User",
            "email": email.upper(),
            "password": "Password123",
            "subject_id": subject["id"],
        }
        res2 = client.post("/api/auth/register", json=payload2)
        assert res2.status_code == 409
        err_msg = res2.json().get("message") or res2.json().get("detail", "")
        assert "already exists" in err_msg.lower()
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_duplicate_phd_reg_number_rejected_with_409(client: TestClient, db_session: Session) -> None:
    """Verify attempting to register with an existing PhD registration number returns 409 Conflict."""
    unique_suffix = uuid.uuid4().hex[:8]
    email1 = f"phd_orig_{unique_suffix}@csjmu.ac.in"
    email2 = f"phd_dup_{unique_suffix}@csjmu.ac.in"
    phd_reg = f"PHD-DUP-{unique_suffix}"
    subject = CANONICAL_SUBJECTS[1]

    payload1 = {
        "full_name": "First Candidate",
        "email": email1,
        "password": "Password123",
        "phd_registration_number": phd_reg,
        "subject_id": subject["id"],
    }
    payload2 = {
        "full_name": "Second Candidate",
        "email": email2,
        "password": "Password123",
        "phd_registration_number": phd_reg.lower(),
        "subject_id": subject["id"],
    }

    try:
        res1 = client.post("/api/auth/register", json=payload1)
        assert res1.status_code == 201

        res2 = client.post("/api/auth/register", json=payload2)
        assert res2.status_code == 409
        err_msg = res2.json().get("message") or res2.json().get("detail", "")
        assert "phd registration number already exists" in err_msg.lower()
    finally:
        for em in [email1, email2]:
            u = db_session.execute(select(User).where(User.email == em.lower())).scalar_one_or_none()
            if u:
                db_session.delete(u)
        db_session.commit()


def test_null_or_blank_phd_reg_numbers_allowed_multiple_times(client: TestClient, db_session: Session) -> None:
    """Verify multiple applicants can register with None or empty PhD registration numbers."""
    unique_suffix1 = uuid.uuid4().hex[:8]
    unique_suffix2 = uuid.uuid4().hex[:8]
    email1 = f"no_phd_1_{unique_suffix1}@csjmu.ac.in"
    email2 = f"no_phd_2_{unique_suffix2}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[2]

    try:
        res1 = client.post("/api/auth/register", json={
            "full_name": "Candidate One",
            "email": email1,
            "password": "Password123",
            "phd_registration_number": None,
            "subject_id": subject["id"],
        })
        assert res1.status_code == 201

        res2 = client.post("/api/auth/register", json={
            "full_name": "Candidate Two",
            "email": email2,
            "password": "Password123",
            "phd_registration_number": "   ",
            "subject_id": subject["id"],
        })
        assert res2.status_code == 201
    finally:
        for em in [email1, email2]:
            u = db_session.execute(select(User).where(User.email == em.lower())).scalar_one_or_none()
            if u:
                db_session.delete(u)
        db_session.commit()


def test_invalid_subject_id_rejected_with_400(client: TestClient) -> None:
    """Verify registration with a non-existent subject UUID returns 400 Bad Request."""
    fake_subject_id = str(uuid.uuid4())
    payload = {
        "full_name": "Invalid Subject Candidate",
        "email": f"bad_subject_{uuid.uuid4().hex[:6]}@csjmu.ac.in",
        "password": "Password123",
        "subject_id": fake_subject_id,
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 400
    err_msg = response.json().get("message") or response.json().get("detail", "")
    assert "invalid subject id" in err_msg.lower()


def test_invalid_email_format_rejected_with_422(client: TestClient) -> None:
    """Verify invalid email string returns 422 Unprocessable Entity."""
    payload = {
        "full_name": "Bad Email Candidate",
        "email": "not-a-valid-email",
        "password": "Password123",
        "subject_id": CANONICAL_SUBJECTS[0]["id"],
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


@pytest.mark.parametrize("weak_password", [
    "short1A",        # < 8 chars
    "lowercaseonly1", # No uppercase
    "UPPERCASEONLY1", # No lowercase
    "NoNumbersHere!", # No digit
])
def test_weak_password_rejected_with_422(client: TestClient, weak_password: str) -> None:
    """Verify passwords failing complexity checks return 422 Unprocessable Entity."""
    payload = {
        "full_name": "Weak Pass Candidate",
        "email": f"weak_pass_{uuid.uuid4().hex[:6]}@csjmu.ac.in",
        "password": weak_password,
        "subject_id": CANONICAL_SUBJECTS[0]["id"],
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 422


def test_full_name_single_word_handled_gracefully(client: TestClient, db_session: Session) -> None:
    """Verify single-word full name correctly sets first_name and last_name='-'."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"mononym_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[3]

    payload = {
        "full_name": "Aristotle",
        "email": email,
        "password": "Password123",
        "subject_id": subject["id"],
    }

    try:
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()

        user_uuid = uuid.UUID(data["user_id"])
        user = db_session.execute(select(User).where(User.id == user_uuid)).scalar_one_or_none()
        assert user is not None
        assert user.first_name == "Aristotle"
        assert user.last_name == "-"
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_full_name_multi_word_handled_properly(client: TestClient, db_session: Session) -> None:
    """Verify multi-word full name properly preserves compound first name and last name."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"multi_name_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[4]

    payload = {
        "full_name": "Dr. Ankit Kumar Trivedi",
        "email": email,
        "password": "Password123",
        "subject_id": subject["id"],
    }

    try:
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()

        user_uuid = uuid.UUID(data["user_id"])
        user = db_session.execute(select(User).where(User.id == user_uuid)).scalar_one_or_none()
        assert user is not None
        assert user.first_name == "Dr. Ankit Kumar"
        assert user.last_name == "Trivedi"
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_generic_role_only_applicant(client: TestClient, db_session: Session) -> None:
    """Verify applicant registration strictly assigns only the generic 'applicant' role."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"role_check_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[7]

    payload = {
        "full_name": "Role Check Candidate",
        "email": email,
        "password": "Password123",
        "subject_id": subject["id"],
    }

    try:
        response = client.post("/api/auth/register", json=payload)
        assert response.status_code == 201
        data = response.json()

        user_uuid = uuid.UUID(data["user_id"])
        user = db_session.execute(select(User).where(User.id == user_uuid)).scalar_one_or_none()
        assert user is not None
        assigned_roles = [r.name for r in user.roles]
        assert assigned_roles == ["applicant"]
        assert "authority" not in assigned_roles
        assert "administrator" not in assigned_roles
        assert "MANAGER" not in assigned_roles
        assert "DEAN" not in assigned_roles
    finally:
        db_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
        if db_user:
            db_session.delete(db_user)
            db_session.commit()


def test_registration_is_atomic_rollback_on_failure(client: TestClient, db_session: Session) -> None:
    """Verify that failure during profile insertion rolls back the user creation atomically."""
    from unittest.mock import patch
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"rollback_{unique_suffix}@csjmu.ac.in"
    subject = CANONICAL_SUBJECTS[8]

    payload = {
        "full_name": "Rollback Test Candidate",
        "email": email,
        "password": "Password123",
        "subject_id": subject["id"],
    }

    # Simulate an error during profile instantiation / DB add
    with patch("app.api.routes.auth.ApplicantProfile", side_effect=RuntimeError("Simulated profile insertion failure")):
        try:
            client.post("/api/auth/register", json=payload)
        except RuntimeError:
            pass

    # Verify user was NOT created in DB due to atomic rollback
    orphaned_user = db_session.execute(select(User).where(User.email == email.lower())).scalar_one_or_none()
    assert orphaned_user is None
