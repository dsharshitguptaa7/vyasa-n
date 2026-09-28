"""
Tests validating Institutional Authority Identity Seeding Foundation for VYASA Core.

Governing Rule:
"VYASA owns institutional identity. Pillars own domain roles."

Requirements covered:
1. Successful authority seed with test configuration (16 slots)
2. Idempotent rerun without duplicate users or role assignments
3. Stable UUID preservation
4. Duplicate email rejection
5. Duplicate UUID rejection
6. Missing required configuration rejection (fields and slots)
7. Generic 'authority' role assignment
8. No NIVARAN-specific roles allowed
9. Unrelated existing users remain untouched
10. Password hashing uses existing VYASA PBKDF2 implementation
11. Environment-driven manifest loading
12. Example template validation (16 slots)
"""

import json
import uuid
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.models.role import Role
from app.models.user import User
from app.services.authority_seed_service import (
    AuthoritySeedConflictError,
    AuthoritySeedValidationError,
    AuthoritySlotSpec,
    EXPECTED_AUTHORITY_SLOTS,
    load_manifest_from_dict,
    load_manifest_from_env,
    load_manifest_from_file,
    parse_and_validate_manifest,
    seed_institutional_authorities,
)
from app.services.seed_service import seed_roles_and_permissions


def _generate_valid_16_manifest() -> dict:
    """Generate a clean 16-slot test manifest with unique UUIDs and emails."""
    manifest = {}
    for i, slot in enumerate(EXPECTED_AUTHORITY_SLOTS, start=1):
        manifest[slot] = {
            "id": str(uuid.UUID(f"20000000-0000-0000-0000-{i:012d}")),
            "email": f"auth.{i:02d}.test@institution.ac.in",
            "first_name": f"TestFirst{i}",
            "last_name": f"TestLast{i}",
            "password": f"InitialPassword!{i}",
        }
    return manifest


# ---------------------------------------------------------------------------
# Test Data Cleanup Fixture
# ---------------------------------------------------------------------------

def _cleanup_test_users(db: Session) -> None:
    try:
        stmt = select(User).where(
            User.email.like("%@institution.ac.in") | User.email.like("%@university.ac.in")
        )
        users = db.execute(stmt).scalars().all()
        for u in users:
            u.roles.clear()
            db.delete(u)
        db.commit()
    except Exception:
        db.rollback()


@pytest.fixture(autouse=True)
def cleanup_test_data(db_session: Session):
    _cleanup_test_users(db_session)
    yield
    _cleanup_test_users(db_session)


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_01_successful_authority_seed_with_valid_manifest(db_session: Session):
    """Requirement 1: Successful seed of 16 institutional authority identities."""
    seed_roles_and_permissions(db_session)
    raw_manifest = _generate_valid_16_manifest()
    specs = parse_and_validate_manifest(raw_manifest, strict_16_slots=True)

    result = seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    assert result["status"] == "success"
    assert result["total_configured"] == 16
    assert result["users_created"] == 16
    assert result["roles_assigned"] == 16

    # Verify every user in the database
    for spec in specs:
        user = db_session.execute(
            select(User).where(User.id == spec.id)
        ).unique().scalar_one_or_none()

        assert user is not None
        assert user.id == spec.id
        assert user.email == spec.email
        assert user.first_name == spec.first_name
        assert user.last_name == spec.last_name
        assert user.is_active is True
        assert user.is_verified is True
        assert len(user.roles) == 1
        assert user.roles[0].name == "authority"


def test_02_idempotent_rerun_does_not_duplicate(db_session: Session):
    """Requirement 2: Rerunning seed is idempotent; does not duplicate users or roles."""
    seed_roles_and_permissions(db_session)
    raw_manifest = _generate_valid_16_manifest()
    specs = parse_and_validate_manifest(raw_manifest, strict_16_slots=True)

    # First run
    seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    # Second run (exact same specs)
    rerun_result = seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    assert rerun_result["status"] == "success"
    assert rerun_result["users_created"] == 0
    assert rerun_result["users_updated"] == 16
    assert rerun_result["roles_assigned"] == 0

    # Ensure count of users is still exactly 16 for these emails
    emails = [s.email for s in specs]
    count = db_session.execute(
        select(func.count(User.id)).where(User.email.in_(emails))
    ).scalar_one()
    assert count == 16


def test_03_stable_uuid_preservation(db_session: Session):
    """Requirement 3: Deterministic/stable UUIDs are preserved across runs and updates."""
    seed_roles_and_permissions(db_session)
    raw_manifest = _generate_valid_16_manifest()
    specs = parse_and_validate_manifest(raw_manifest, strict_16_slots=True)

    seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    # Update names in manifest but preserve UUIDs
    updated_manifest = _generate_valid_16_manifest()
    updated_manifest["AUTHORITY_01"]["first_name"] = "UpdatedFirst"
    updated_specs = parse_and_validate_manifest(updated_manifest, strict_16_slots=True)

    seed_institutional_authorities(db_session, specs=updated_specs, strict_16_slots=True)

    user1 = db_session.execute(
        select(User).where(User.id == updated_specs[0].id)
    ).unique().scalar_one_or_none()
    assert user1 is not None
    assert user1.id == updated_specs[0].id
    assert user1.first_name == "UpdatedFirst"


def test_04_duplicate_email_rejected(db_session: Session):
    """Requirement 4: Duplicate emails across slots must be rejected before DB mutation."""
    raw = _generate_valid_16_manifest()
    raw["AUTHORITY_02"]["email"] = raw["AUTHORITY_01"]["email"]

    with pytest.raises(AuthoritySeedValidationError) as exc_info:
        parse_and_validate_manifest(raw, strict_16_slots=True)

    assert "Duplicate email" in str(exc_info.value)
    assert raw["AUTHORITY_01"]["email"] in str(exc_info.value)


def test_05_duplicate_uuid_rejected(db_session: Session):
    """Requirement 5: Duplicate UUIDs across slots must be rejected before DB mutation."""
    raw = _generate_valid_16_manifest()
    raw["AUTHORITY_03"]["id"] = raw["AUTHORITY_01"]["id"]

    with pytest.raises(AuthoritySeedValidationError) as exc_info:
        parse_and_validate_manifest(raw, strict_16_slots=True)

    assert "Duplicate UUID" in str(exc_info.value)


def test_06_missing_required_configuration_rejected():
    """Requirement 6: Missing required fields or incomplete slot sets are rejected."""
    # Case A: Missing email
    raw_no_email = _generate_valid_16_manifest()
    del raw_no_email["AUTHORITY_01"]["email"]
    with pytest.raises(AuthoritySeedValidationError) as exc:
        parse_and_validate_manifest(raw_no_email, strict_16_slots=True)
    assert "Missing required 'email' field" in str(exc.value)

    # Case B: Missing first_name
    raw_no_fn = _generate_valid_16_manifest()
    del raw_no_fn["AUTHORITY_02"]["first_name"]
    with pytest.raises(AuthoritySeedValidationError) as exc:
        parse_and_validate_manifest(raw_no_fn, strict_16_slots=True)
    assert "Missing required 'first_name' field" in str(exc.value)

    # Case C: Missing UUID
    raw_no_id = _generate_valid_16_manifest()
    del raw_no_id["AUTHORITY_03"]["id"]
    with pytest.raises(AuthoritySeedValidationError) as exc:
        parse_and_validate_manifest(raw_no_id, strict_16_slots=True)
    assert "Missing required 'id' / 'uuid' field" in str(exc.value)

    # Case D: Incomplete slots (e.g. 15 slots in strict 16-slot mode)
    raw_incomplete = _generate_valid_16_manifest()
    del raw_incomplete["AUTHORITY_16"]
    with pytest.raises(AuthoritySeedValidationError) as exc:
        parse_and_validate_manifest(raw_incomplete, strict_16_slots=True)
    assert "Incomplete authority manifest" in str(exc.value)
    assert "AUTHORITY_16" in str(exc.value)


def test_07_generic_authority_role_assignment(db_session: Session):
    """Requirement 7: Every configured identity receives ONLY the generic 'authority' role."""
    seed_roles_and_permissions(db_session)
    raw = _generate_valid_16_manifest()
    specs = parse_and_validate_manifest(raw, strict_16_slots=True)

    seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    for spec in specs:
        user = db_session.execute(
            select(User).where(User.id == spec.id)
        ).unique().scalar_one()

        role_names = [r.name for r in user.roles]
        assert role_names == ["authority"], f"Expected ['authority'], got {role_names}"


def test_08_no_nivaran_specific_roles_allowed():
    """Requirement 8: NIVARAN domain roles must never be accepted in VYASA Core configuration."""
    forbidden_roles = ["MANAGER", "DEAN", "ASSISTANT_DEAN", "ASSOCIATE_DEAN", "GUEST_MEMBER"]

    for forbidden in forbidden_roles:
        raw = _generate_valid_16_manifest()
        raw["AUTHORITY_01"]["role"] = forbidden

        with pytest.raises(AuthoritySeedValidationError) as exc:
            parse_and_validate_manifest(raw, strict_16_slots=True)

        assert "Prohibited NIVARAN domain role" in str(exc.value) or "invalid role" in str(exc.value)


def test_09_unrelated_existing_users_remain_untouched(db_session: Session):
    """Requirement 9: Pre-existing unrelated users remain completely untouched."""
    seed_roles_and_permissions(db_session)

    applicant_role = db_session.execute(
        select(Role).where(Role.name == "applicant")
    ).scalar_one()

    student_id = uuid.uuid4()
    student = User(
        id=student_id,
        email="unrelated.student@university.ac.in",
        first_name="Arya",
        last_name="Scholar",
        is_active=True,
        is_verified=True,
    )
    student.roles.append(applicant_role)
    db_session.add(student)
    db_session.commit()

    # Now seed authorities
    raw = _generate_valid_16_manifest()
    specs = parse_and_validate_manifest(raw, strict_16_slots=True)
    seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    # Verify student is still untouched
    db_session.expire_all()
    preserved = db_session.execute(
        select(User).where(User.id == student_id)
    ).unique().scalar_one()

    assert preserved.email == "unrelated.student@university.ac.in"
    assert preserved.first_name == "Arya"
    assert [r.name for r in preserved.roles] == ["applicant"]


def test_10_password_hashing_uses_existing_vyasa_implementation(db_session: Session):
    """Requirement 10: Password hashing uses existing VYASA PBKDF2 implementation."""
    seed_roles_and_permissions(db_session)
    raw = _generate_valid_16_manifest()
    raw["AUTHORITY_01"]["password"] = "SuperSecretHashCheck123!"

    specs = parse_and_validate_manifest(raw, strict_16_slots=True)
    seed_institutional_authorities(db_session, specs=specs, strict_16_slots=True)

    user1 = db_session.execute(
        select(User).where(User.id == specs[0].id)
    ).unique().scalar_one()

    assert user1.password_hash is not None
    assert user1.password_hash.startswith("pbkdf2_sha256$100000$")
    assert "SuperSecretHashCheck123!" not in user1.password_hash

    assert verify_password("SuperSecretHashCheck123!", user1.password_hash) is True
    assert verify_password("WrongPassword!", user1.password_hash) is False


def test_11_env_driven_manifest_loading(monkeypatch):
    """Requirement 11: Loading manifest via AUTHORITIES_MANIFEST_JSON environment variable."""
    raw = _generate_valid_16_manifest()
    json_payload = json.dumps(raw)

    monkeypatch.setenv("AUTHORITIES_MANIFEST_JSON", json_payload)

    specs = load_manifest_from_env(strict_16_slots=True)
    assert specs is not None
    assert len(specs) == 16
    assert specs[0].slot == "AUTHORITY_01"
    assert specs[15].slot == "AUTHORITY_16"


def test_12_example_template_validation():
    """Requirement 12: Validate that config/authorities_manifest.example.json is structurally valid."""
    import os
    example_path = os.path.join(
        os.path.dirname(__file__), "..", "config", "authorities_manifest.example.json"
    )
    assert os.path.exists(example_path), f"Example manifest missing at: {example_path}"

    with open(example_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    clean_data = {k: v for k, v in data.items() if not k.startswith("_")}
    specs = parse_and_validate_manifest(clean_data, strict_16_slots=True)

    assert len(specs) == 16
    for i, spec in enumerate(specs, start=1):
        assert spec.slot == f"AUTHORITY_{i:02d}"
