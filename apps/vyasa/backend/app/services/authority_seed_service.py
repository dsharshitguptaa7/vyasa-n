"""
Institutional Authority Identity Seeding Foundation for VYASA Core.

Governing Rule:
"VYASA owns institutional identity. Pillars own domain roles."

Responsibilities:
- Provide an environment / manifest driven configuration mechanism with explicit slots:
  AUTHORITY_01 through AUTHORITY_16 (16 institutional authority identities).
- Assign ONLY the generic VYASA platform role: 'authority'.
- Strictly reject any NIVARAN domain roles (e.g. MANAGER, DEAN, ASSISTANT_DEAN, ASSOCIATE_DEAN, GUEST_MEMBER).
- Validate stable UUIDs, email formats, and required identity fields.
- Reject duplicate UUIDs and duplicate emails across slots.
- Fail safely before database mutation if any slot configuration is invalid or incomplete.
- Execute idempotently: repeated runs do not duplicate users or role assignments.
- Never destructively overwrite existing users or touch unrelated users.
- Hash passwords using the canonical VYASA PBKDF2-HMAC-SHA256 utility (app.core.security).
- Never commit passwords, institutional names, or real identities to source control.
"""

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger("vyasa.services.authority_seed")

# 16 explicit authority slots (AUTHORITY_01 to AUTHORITY_16)
EXPECTED_AUTHORITY_SLOTS: List[str] = [f"AUTHORITY_{i:02d}" for i in range(1, 17)]

# Prohibited pillar domain roles that must never be introduced into VYASA Core
FORBIDDEN_PILLAR_ROLES: Set[str] = {
    "MANAGER",
    "ASSISTANT_DEAN",
    "ASSOCIATE_DEAN",
    "DEAN",
    "GUEST_MEMBER",
}

GENERIC_AUTHORITY_ROLE = "authority"
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthoritySeedError(Exception):
    """Base exception for institutional authority seeding errors."""
    pass


class AuthoritySeedValidationError(AuthoritySeedError):
    """Raised when authority manifest or environment configuration fails validation."""
    pass


class AuthoritySeedConflictError(AuthoritySeedError):
    """Raised when an authority identity conflicts with existing database records."""
    pass


class AuthoritySlotSpec(BaseModel):
    """Specification for an institutional authority slot."""
    slot: str = Field(..., description="Slot identifier, e.g. AUTHORITY_01")
    id: uuid.UUID = Field(..., description="Stable, canonical UUID for the user identity")
    email: str = Field(..., description="Institutional email address")
    first_name: str = Field(..., min_length=1, description="First name")
    last_name: str = Field(..., min_length=1, description="Last name")
    password: Optional[str] = Field(default=None, description="Optional initial password (hashed upon seed)")

    @field_validator("slot")
    @classmethod
    def validate_slot(cls, v: str) -> str:
        cleaned = v.strip().upper()
        if cleaned not in EXPECTED_AUTHORITY_SLOTS:
            raise ValueError(f"Invalid slot '{v}'. Must be one of AUTHORITY_01 to AUTHORITY_16.")
        return cleaned

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if not EMAIL_REGEX.match(cleaned):
            raise ValueError(f"Invalid email format: '{v}'")
        return cleaned

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Name field cannot be empty or whitespace only.")
        return cleaned


def _check_forbidden_pillar_roles(raw_dict: Dict[str, Any]) -> None:
    """Inspect dictionary to ensure no NIVARAN domain roles are configured as roles."""
    for slot, slot_data in raw_dict.items():
        if not isinstance(slot_data, dict):
            continue
        for k, v in slot_data.items():
            if "role" in k.lower():
                val_str = str(v).upper()
                for forbidden in FORBIDDEN_PILLAR_ROLES:
                    if forbidden in val_str:
                        raise AuthoritySeedValidationError(
                            f"Prohibited NIVARAN domain role '{forbidden}' detected in configuration for slot '{slot}'. "
                            "VYASA Core assigns strictly the generic 'authority' role. "
                            "Pillars own domain roles; VYASA owns institutional identity."
                        )


def parse_and_validate_manifest(
    raw_manifest: Dict[str, Any],
    strict_16_slots: bool = True,
    strict_15_slots: Optional[bool] = None,
) -> List[AuthoritySlotSpec]:
    """
    Validate and parse a dictionary of authority slots.
    Enforces:
    - No NIVARAN domain roles
    - Valid slot names (AUTHORITY_01 to AUTHORITY_16)
    - Complete 16 slots if strict_16_slots=True
    - Required fields: id, email, first_name, last_name
    - No duplicate UUIDs
    - No duplicate emails
    """
    if strict_15_slots is not None:
        strict_16_slots = strict_15_slots

    if not isinstance(raw_manifest, dict):
        raise AuthoritySeedValidationError("Authority manifest must be a dictionary keyed by slot name.")

    _check_forbidden_pillar_roles(raw_manifest)

    # Check for empty manifest
    if not raw_manifest:
        raise AuthoritySeedValidationError("Authority manifest is empty.")

    # Normalize slot keys
    normalized_manifest: Dict[str, Dict[str, Any]] = {}
    for k, v in raw_manifest.items():
        if k.startswith("_"):
            continue
        slot_key = k.strip().upper()
        if slot_key not in EXPECTED_AUTHORITY_SLOTS:
            raise AuthoritySeedValidationError(
                f"Unknown authority slot '{k}'. Expected slots are AUTHORITY_01 through AUTHORITY_16."
            )
        if not isinstance(v, dict):
            raise AuthoritySeedValidationError(f"Configuration for slot '{slot_key}' must be a dictionary.")
        normalized_manifest[slot_key] = v

    # If strict 16 slots required, ensure all are present
    if strict_16_slots:
        missing_slots = [slot for slot in EXPECTED_AUTHORITY_SLOTS if slot not in normalized_manifest]
        if missing_slots:
            raise AuthoritySeedValidationError(
                f"Incomplete authority manifest: expected all 16 slots (AUTHORITY_01 to AUTHORITY_16). "
                f"Missing slots: {missing_slots}"
            )

    specs: List[AuthoritySlotSpec] = []
    seen_uuids: Dict[uuid.UUID, str] = {}
    seen_emails: Dict[str, str] = {}

    for slot in sorted(normalized_manifest.keys()):
        slot_data = normalized_manifest[slot]

        # Verify any explicit role field
        explicit_role = slot_data.get("role") or slot_data.get("roles")
        if explicit_role:
            role_val = explicit_role if isinstance(explicit_role, str) else str(explicit_role)
            if role_val.strip().lower() not in (GENERIC_AUTHORITY_ROLE, f"['{GENERIC_AUTHORITY_ROLE}']", f'["{GENERIC_AUTHORITY_ROLE}"]'):
                raise AuthoritySeedValidationError(
                    f"Slot '{slot}' specifies invalid role '{explicit_role}'. "
                    f"Only the generic VYASA role '{GENERIC_AUTHORITY_ROLE}' is permitted."
                )

        try:
            raw_id = slot_data.get("id") or slot_data.get("uuid")
            if not raw_id:
                raise ValueError("Missing required 'id' / 'uuid' field.")
            user_uuid = uuid.UUID(str(raw_id).strip())

            raw_email = slot_data.get("email")
            if not raw_email:
                raise ValueError("Missing required 'email' field.")

            raw_first_name = slot_data.get("first_name")
            if not raw_first_name:
                raise ValueError("Missing required 'first_name' field.")

            raw_last_name = slot_data.get("last_name")
            if not raw_last_name:
                raise ValueError("Missing required 'last_name' field.")

            raw_password = slot_data.get("password")
            if raw_password is not None and not str(raw_password).strip():
                raw_password = None

            spec = AuthoritySlotSpec(
                slot=slot,
                id=user_uuid,
                email=str(raw_email),
                first_name=str(raw_first_name),
                last_name=str(raw_last_name),
                password=str(raw_password) if raw_password else None,
            )
        except Exception as exc:
            raise AuthoritySeedValidationError(f"Invalid configuration in slot '{slot}': {str(exc)}") from exc

        # Duplicate UUID check
        if spec.id in seen_uuids:
            raise AuthoritySeedValidationError(
                f"Duplicate UUID '{spec.id}' detected in slots '{seen_uuids[spec.id]}' and '{slot}'."
            )
        seen_uuids[spec.id] = slot

        # Duplicate Email check (case-insensitive)
        if spec.email in seen_emails:
            raise AuthoritySeedValidationError(
                f"Duplicate email '{spec.email}' detected in slots '{seen_emails[spec.email]}' and '{slot}'."
            )
        seen_emails[spec.email] = slot

        specs.append(spec)

    return specs


load_manifest_from_dict = parse_and_validate_manifest


def load_manifest_from_file(
    file_path: str,
    strict_16_slots: bool = True,
    strict_15_slots: Optional[bool] = None,
) -> List[AuthoritySlotSpec]:
    """Load and validate authority manifest from a JSON file."""
    if strict_15_slots is not None:
        strict_16_slots = strict_15_slots

    if not os.path.exists(file_path):
        raise AuthoritySeedValidationError(f"Authority manifest file not found: {file_path}")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        raise AuthoritySeedValidationError(f"Failed to parse manifest JSON file: {str(exc)}") from exc

    return parse_and_validate_manifest(data, strict_16_slots=strict_16_slots)


def load_manifest_from_env(
    strict_16_slots: bool = True,
    strict_15_slots: Optional[bool] = None,
) -> Optional[List[AuthoritySlotSpec]]:
    """
    Load authority manifest from environment configuration:
    1. AUTHORITIES_MANIFEST_PATH or VYASA_AUTHORITY_MANIFEST_PATH
    2. AUTHORITIES_MANIFEST_JSON or VYASA_AUTHORITIES_MANIFEST_JSON
    3. Individual slot environment variables:
       (VYASA_)AUTHORITY_01_ID, (VYASA_)AUTHORITY_01_EMAIL, etc.
    Returns None if no authority configuration is found in the environment.
    """
    if strict_15_slots is not None:
        strict_16_slots = strict_15_slots

    # 1. File path
    path = (
        os.environ.get("AUTHORITIES_MANIFEST_PATH")
        or os.environ.get("VYASA_AUTHORITY_MANIFEST_PATH")
        or settings.AUTHORITIES_MANIFEST_PATH
    )
    if path:
        return load_manifest_from_file(path, strict_16_slots=strict_16_slots)

    # 2. JSON string
    json_str = (
        os.environ.get("AUTHORITIES_MANIFEST_JSON")
        or os.environ.get("VYASA_AUTHORITIES_MANIFEST_JSON")
        or settings.AUTHORITIES_MANIFEST_JSON
    )
    if json_str:
        try:
            data = json.loads(json_str)
        except Exception as exc:
            raise AuthoritySeedValidationError(f"Invalid JSON in AUTHORITIES_MANIFEST_JSON: {str(exc)}") from exc
        return parse_and_validate_manifest(data, strict_16_slots=strict_16_slots)

    # 3. Slot-based environment variables
    slot_dict: Dict[str, Dict[str, Any]] = {}
    for slot in EXPECTED_AUTHORITY_SLOTS:
        slot_id = (
            os.environ.get(f"{slot}_ID")
            or os.environ.get(f"VYASA_{slot}_ID")
            or os.environ.get(f"{slot}_UUID")
            or os.environ.get(f"VYASA_{slot}_UUID")
        )
        slot_email = os.environ.get(f"{slot}_EMAIL") or os.environ.get(f"VYASA_{slot}_EMAIL")
        slot_first_name = os.environ.get(f"{slot}_FIRST_NAME") or os.environ.get(f"VYASA_{slot}_FIRST_NAME")
        slot_last_name = os.environ.get(f"{slot}_LAST_NAME") or os.environ.get(f"VYASA_{slot}_LAST_NAME")
        slot_password = os.environ.get(f"{slot}_PASSWORD") or os.environ.get(f"VYASA_{slot}_PASSWORD")

        if any([slot_id, slot_email, slot_first_name, slot_last_name, slot_password]):
            slot_dict[slot] = {
                "id": slot_id,
                "email": slot_email,
                "first_name": slot_first_name,
                "last_name": slot_last_name,
                "password": slot_password,
            }

    if not slot_dict:
        return None

    return parse_and_validate_manifest(slot_dict, strict_16_slots=strict_16_slots)


def seed_institutional_authorities(
    db: Session,
    specs: Optional[List[AuthoritySlotSpec]] = None,
    strict_16_slots: bool = True,
    strict_15_slots: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Idempotent seeding of institutional authority identities in VYASA Core.

    Invariants:
    - Atomicity: validations run before any DB mutations.
    - Idempotency: re-running does not duplicate users or role assignments.
    - Stable UUID: user UUID is preserved exactly as configured.
    - Role constraint: assigns only generic 'authority' role.
    - Non-destructive: existing unrelated users are untouched.
    """
    if strict_15_slots is not None:
        strict_16_slots = strict_15_slots

    if specs is None:
        specs = load_manifest_from_env(strict_16_slots=strict_16_slots)
        if specs is None:
            logger.info("Authority identity seeding skipped: no authority manifest or environment configured.")
            return {
                "status": "skipped",
                "message": "No authority configuration provided",
                "total_configured": 0,
                "users_created": 0,
                "users_updated": 0,
                "roles_assigned": 0,
            }

    # 1. Retrieve the generic 'authority' role
    role_stmt = select(Role).where(Role.name == GENERIC_AUTHORITY_ROLE)
    authority_role = db.execute(role_stmt).scalar_one_or_none()
    if not authority_role:
        raise AuthoritySeedError(
            f"Core system role '{GENERIC_AUTHORITY_ROLE}' not found in database. "
            "Execute seed_roles_and_permissions first."
        )

    # 2. Pre-seed conflict check against existing DB users (fail safely)
    for spec in specs:
        email_stmt = select(User).where(func.lower(User.email) == spec.email)
        existing_by_email = db.execute(email_stmt).scalar_one_or_none()
        if existing_by_email and existing_by_email.id != spec.id:
            raise AuthoritySeedConflictError(
                f"Email '{spec.email}' in slot '{spec.slot}' is already registered with a different user ID "
                f"'{existing_by_email.id}' (expected '{spec.id}')."
            )

    # 3. Execute atomic user creation/updates
    users_created = 0
    users_updated = 0
    roles_assigned = 0

    for spec in specs:
        user_stmt = select(User).options(joinedload(User.roles)).where(User.id == spec.id)
        user = db.execute(user_stmt).unique().scalar_one_or_none()

        if not user:
            user = User(
                id=spec.id,
                email=spec.email,
                first_name=spec.first_name,
                last_name=spec.last_name,
                password_hash=hash_password(spec.password) if spec.password else None,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            db.flush()
            users_created += 1
            logger.info("Created authority identity [%s]: %s (%s)", spec.slot, spec.email, spec.id)
        else:
            user.email = spec.email
            user.first_name = spec.first_name
            user.last_name = spec.last_name
            user.is_active = True
            user.is_verified = True
            if spec.password:
                user.password_hash = hash_password(spec.password)
            users_updated += 1
            logger.info("Updated existing authority identity [%s]: %s (%s)", spec.slot, spec.email, spec.id)

        # 4. Assign generic 'authority' role if not already assigned
        existing_role_ids = {r.id for r in user.roles}
        if authority_role.id not in existing_role_ids:
            user.roles.append(authority_role)
            roles_assigned += 1
            logger.info("Assigned generic 'authority' role to user: %s", spec.id)

    db.commit()

    return {
        "status": "success",
        "total_configured": len(specs),
        "users_created": users_created,
        "users_updated": users_updated,
        "roles_assigned": roles_assigned,
    }


if __name__ == "__main__":
    import argparse
    from app.core.database import SessionLocal
    from app.services.seed_service import seed_roles_and_permissions

    parser = argparse.ArgumentParser(description="VYASA Institutional Authority Identity Seeder")
    parser.add_argument("--manifest", type=str, help="Path to authority manifest JSON file")
    parser.add_argument("--non-strict", action="store_true", help="Allow fewer than 16 slots (for testing/partial runs)")
    args = parser.parse_args()

    strict = not args.non_strict

    with SessionLocal() as session:
        seed_roles_and_permissions(session)

        if args.manifest:
            manifest_specs = load_manifest_from_file(args.manifest, strict_16_slots=strict)
            result = seed_institutional_authorities(session, specs=manifest_specs, strict_16_slots=strict)
        else:
            result = seed_institutional_authorities(session, strict_16_slots=strict)

        print(f"Authority seeding completed: {result}")
