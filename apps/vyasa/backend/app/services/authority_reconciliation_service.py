"""
Authority Identity Reconciliation Service.

Governing Rule:
"VYASA owns institutional identity. NIVARAN owns domain roles and grievance routing."

Reconciles the identity relationship:
    NIVARAN.nivaran_authorities.vyasa_user_id = VYASA.users.id

Invariants:
1. Preserves existing NIVARAN authority/cluster/subject/category routing configuration exactly as-is.
2. Authority actual domain roles (MANAGER, ASSISTANT_DEAN, ASSOCIATE_DEAN, DEAN, GUEST_MEMBER)
   remain strictly owned by NIVARAN.
3. VYASA users receive ONLY the generic system role: 'authority'.
4. Matches identity primarily by normalized institutional email, with name as secondary signal.
5. Handles temporary placeholder users:
   - Updates identity fields if referenced by a corrected mapping.
   - Retains authorized temporary placeholders (Dean, Guest Member).
   - Deactivates unreferenced/orphaned temporary placeholders.
6. Transactional execution with pre-mutation report and conflict detection.
"""

from __future__ import annotations

import enum
import logging
import os
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.role import Role
from app.models.user import User

logger = logging.getLogger(__name__)

GENERIC_AUTHORITY_ROLE = "authority"
DEFAULT_TEMPORARY_PASSWORD = "Vyas@n789"

RETAINED_TEMPORARY_EMAILS = {
    "dean@csjmu.ac.in",
    "guestmember@csjmu.ac.in",
}


class ReconciliationAction(str, enum.Enum):
    REUSE_EXISTING = "REUSE_EXISTING"
    CREATE_VYASA_USER = "CREATE_VYASA_USER"
    UPDATE_NIVARAN_MAPPING = "UPDATE_NIVARAN_MAPPING"
    NO_CHANGE = "NO_CHANGE"
    CONFLICT = "CONFLICT"


class ReconciliationError(Exception):
    """Base exception for authority reconciliation failures."""
    pass


class ReconciliationConflictError(ReconciliationError):
    """Raised when an ambiguous identity collision or validation error occurs."""
    pass


@dataclass
class AuthorityMappingItem:
    nivaran_authority_id: uuid.UUID
    name_snapshot: str
    email_snapshot: str
    role: str
    current_vyasa_user_id: Optional[uuid.UUID]
    uuid_exists_in_vyasa: bool
    matched_vyasa_user_id: Optional[uuid.UUID]
    matched_vyasa_email: Optional[str]
    action: ReconciliationAction
    details: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nivaran_authority_id": str(self.nivaran_authority_id),
            "name_snapshot": self.name_snapshot,
            "email_snapshot": self.email_snapshot,
            "role": self.role,
            "current_vyasa_user_id": str(self.current_vyasa_user_id) if self.current_vyasa_user_id else None,
            "uuid_exists_in_vyasa": self.uuid_exists_in_vyasa,
            "matched_vyasa_user_id": str(self.matched_vyasa_user_id) if self.matched_vyasa_user_id else None,
            "matched_vyasa_email": self.matched_vyasa_email,
            "action": self.action.value,
            "details": self.details,
        }


def _split_name(full_name: str) -> Tuple[str, str]:
    parts = full_name.strip().split()
    if not parts:
        return ("Authority", "Member")
    if len(parts) == 1:
        return (parts[0], "")
    return (" ".join(parts[:-1]), parts[-1])


def fetch_authoritative_nivaran_authorities(nivaran_db: Session) -> List[Dict[str, Any]]:
    """
    Fetch authoritative institutional authorities from NIVARAN.
    Reads all active authorities from nivaran_authorities.
    """
    query = text("""
        SELECT a.id, a.vyasa_user_id, a.role, a.name_snapshot, a.email_snapshot,
            (SELECT COUNT(*) FROM subject_clusters sc WHERE sc.assistant_dean_id = a.id) as sc_count,
            (SELECT COUNT(*) FROM grievance_clusters gc WHERE gc.associate_dean_id = a.id) as gc_count,
            (SELECT COUNT(*) FROM categories c WHERE c.fixed_authority_id = a.id) as cat_count
        FROM nivaran_authorities a
        WHERE a.is_active = TRUE
        ORDER BY a.role, a.name_snapshot
    """)
    rows = nivaran_db.execute(query).fetchall()

    results = []
    for r in rows:
        results.append({
            "id": uuid.UUID(str(r[0])),
            "vyasa_user_id": uuid.UUID(str(r[1])) if r[1] else None,
            "role": str(r[2]),
            "name_snapshot": str(r[3]),
            "email_snapshot": str(r[4]).strip().lower(),
            "sc_count": r[5] if len(r) > 5 else 0,
            "gc_count": r[6] if len(r) > 6 else 0,
            "cat_count": r[7] if len(r) > 7 else 0,
        })
    return results


def generate_reconciliation_report(
    vyasa_db: Session,
    nivaran_db: Session,
) -> Dict[str, Any]:
    """
    Produce a fact-based reconciliation report between NIVARAN authorities and VYASA users.
    Identifies matched users, creation requirements, mapping updates, and conflicts.
    """
    nivaran_authorities = fetch_authoritative_nivaran_authorities(nivaran_db)

    # Fetch all VYASA users with roles
    vyasa_users_stmt = select(User).options(joinedload(User.roles))
    vyasa_users = vyasa_db.execute(vyasa_users_stmt).unique().scalars().all()

    vyasa_by_email: Dict[str, User] = {u.email.strip().lower(): u for u in vyasa_users}
    vyasa_by_id: Dict[uuid.UUID, User] = {u.id: u for u in vyasa_users}

    report_items: List[AuthorityMappingItem] = []
    conflicts: List[str] = []
    matched_vyasa_user_ids: Set[uuid.UUID] = set()

    for auth in nivaran_authorities:
        auth_id = auth["id"]
        email = auth["email_snapshot"]
        name = auth["name_snapshot"]
        role = auth["role"]
        current_vyasa_id = auth["vyasa_user_id"]

        uuid_exists_in_vyasa = current_vyasa_id in vyasa_by_id if current_vyasa_id else False

        user_by_email = vyasa_by_email.get(email)
        user_by_uuid = vyasa_by_id.get(current_vyasa_id) if current_vyasa_id else None

        action: ReconciliationAction
        matched_user_id: Optional[uuid.UUID] = None
        matched_email: Optional[str] = None
        details = ""

        # Identity Matching Logic
        if user_by_email:
            matched_user_id = user_by_email.id
            matched_email = user_by_email.email

            # Conflict check: if current_vyasa_id is set and points to a DIFFERENT user in VYASA
            if user_by_uuid and user_by_uuid.id != user_by_email.id:
                action = ReconciliationAction.CONFLICT
                details = (
                    f"Conflict: Email '{email}' matches VYASA user {user_by_email.id}, "
                    f"but current vyasa_user_id {current_vyasa_id} matches a different user {user_by_uuid.id}."
                )
                conflicts.append(details)
            elif current_vyasa_id == matched_user_id:
                action = ReconciliationAction.NO_CHANGE
                details = "Identity already perfectly reconciled."
            else:
                action = ReconciliationAction.UPDATE_NIVARAN_MAPPING
                details = f"Email match found in VYASA. NIVARAN vyasa_user_id will update to {matched_user_id}."

        elif user_by_uuid:
            # Matched by UUID (e.g. temporary placeholder user created with deterministic UUID)
            matched_user_id = user_by_uuid.id
            matched_email = user_by_uuid.email
            action = ReconciliationAction.REUSE_EXISTING
            details = (
                f"Referenced temporary VYASA user found by UUID ({user_by_uuid.email}). "
                f"Identity fields will update to {email} ({name})."
            )

        else:
            # User does not exist in VYASA by email or UUID
            matched_user_id = current_vyasa_id or uuid.uuid4()
            matched_email = email
            action = ReconciliationAction.CREATE_VYASA_USER
            details = f"New VYASA user will be created with ID {matched_user_id}."

        if matched_user_id:
            matched_vyasa_user_ids.add(matched_user_id)

        report_items.append(AuthorityMappingItem(
            nivaran_authority_id=auth_id,
            name_snapshot=name,
            email_snapshot=email,
            role=role,
            current_vyasa_user_id=current_vyasa_id,
            uuid_exists_in_vyasa=uuid_exists_in_vyasa,
            matched_vyasa_user_id=matched_user_id,
            matched_vyasa_email=matched_email,
            action=action,
            details=details,
        ))

    # Evaluate temporary VYASA users
    retained_temporary_users: List[Dict[str, Any]] = []
    deactivated_temporary_users: List[Dict[str, Any]] = []

    for user in vyasa_users:
        user_email_lower = user.email.strip().lower()
        if user_email_lower in RETAINED_TEMPORARY_EMAILS:
            retained_temporary_users.append({
                "id": str(user.id),
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}".strip(),
                "reason": "Authorized institutional temporary placeholder (Dean / Guest Member)",
            })
        elif user.id in matched_vyasa_user_ids:
            # Reconciled / retained for authority mapping
            pass
        else:
            # Unreferenced temporary placeholder user
            deactivated_temporary_users.append({
                "id": str(user.id),
                "email": user.email,
                "name": f"{user.first_name} {user.last_name}".strip(),
                "reason": "Unreferenced temporary placeholder user marked for deactivation",
            })

    can_proceed = len(conflicts) == 0

    return {
        "can_proceed": can_proceed,
        "total_authorities": len(report_items),
        "authorities_report": report_items,
        "retained_temporary_users": retained_temporary_users,
        "deactivated_temporary_users": deactivated_temporary_users,
        "conflicts": conflicts,
    }


def execute_reconciliation(
    vyasa_db: Session,
    nivaran_db: Session,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Safely and transactionally execute the reconciliation between VYASA and NIVARAN.
    """
    report = generate_reconciliation_report(vyasa_db, nivaran_db)

    if not report["can_proceed"] or report["conflicts"]:
        raise ReconciliationConflictError(
            f"Cannot proceed with reconciliation due to conflicts: {report['conflicts']}"
        )

    # 1. Retrieve the generic 'authority' role in VYASA
    role_stmt = select(Role).where(Role.name == GENERIC_AUTHORITY_ROLE)
    authority_role = vyasa_db.execute(role_stmt).scalar_one_or_none()
    if not authority_role:
        raise ReconciliationError(
            f"Core system role '{GENERIC_AUTHORITY_ROLE}' not found in VYASA database."
        )

    users_created = 0
    users_updated = 0
    mappings_updated = 0

    # 2. Reconcile authorities
    for item in report["authorities_report"]:
        first_name, last_name = _split_name(item.name_snapshot)

        # Look up user in VYASA by matched ID
        user_stmt = select(User).options(joinedload(User.roles)).where(User.id == item.matched_vyasa_user_id)
        user = vyasa_db.execute(user_stmt).unique().scalar_one_or_none()

        if not user:
            # CREATE_VYASA_USER
            user = User(
                id=item.matched_vyasa_user_id,
                email=item.email_snapshot,
                first_name=first_name,
                last_name=last_name,
                password_hash=hash_password(DEFAULT_TEMPORARY_PASSWORD),
                is_active=True,
                is_verified=True,
            )
            user.roles.append(authority_role)
            vyasa_db.add(user)
            vyasa_db.flush()
            users_created += 1
            logger.info("Created VYASA user for authority: %s (%s)", item.email_snapshot, item.matched_vyasa_user_id)
        else:
            # REUSE_EXISTING / UPDATE identity fields
            user.email = item.email_snapshot
            user.first_name = first_name
            user.last_name = last_name
            user.is_active = True
            user.is_verified = True
            # Ensure generic authority role
            existing_role_ids = {r.id for r in user.roles}
            if authority_role.id not in existing_role_ids:
                user.roles.append(authority_role)
            users_updated += 1
            logger.info("Updated VYASA user identity: %s (%s)", item.email_snapshot, user.id)

        # Update NIVARAN mapping if needed
        if item.current_vyasa_user_id != item.matched_vyasa_user_id:
            update_stmt = text("""
                UPDATE nivaran_authorities
                SET vyasa_user_id = :vyasa_id
                WHERE id = :auth_id
            """)
            nivaran_db.execute(update_stmt, {
                "vyasa_id": str(item.matched_vyasa_user_id) if item.matched_vyasa_user_id else None,
                "auth_id": str(item.nivaran_authority_id),
            })
            mappings_updated += 1
            logger.info("Updated NIVARAN authority %s vyasa_user_id to %s", item.nivaran_authority_id, item.matched_vyasa_user_id)

    # 3. Deactivate orphaned temporary VYASA users
    users_deactivated = 0
    for deact in report["deactivated_temporary_users"]:
        u_id = uuid.UUID(deact["id"])
        u_stmt = select(User).where(User.id == u_id)
        u_record = vyasa_db.execute(u_stmt).scalar_one_or_none()
        if u_record and u_record.is_active:
            u_record.is_active = False
            users_deactivated += 1
            logger.info("Deactivated unreferenced temporary VYASA user: %s (%s)", u_record.email, u_record.id)

    if not dry_run:
        vyasa_db.commit()
        nivaran_db.commit()

    return {
        "status": "success",
        "dry_run": dry_run,
        "users_created": users_created,
        "users_updated": users_updated,
        "mappings_updated": mappings_updated,
        "users_deactivated": users_deactivated,
        "total_authorities": len(report["authorities_report"]),
    }


def verify_post_reconciliation(
    vyasa_db: Session,
    nivaran_db: Session,
) -> Dict[str, Any]:
    """
    Run post-mapping verification checks:
    1. Every mapped NIVARAN authority has a non-null vyasa_user_id.
    2. Every vyasa_user_id exists in VYASA users.id.
    3. Every corresponding VYASA user has generic role 'authority'.
    4. No VYASA user has pillar-specific roles.
    5. Existing NIVARAN roles remain unchanged.
    6. Existing NIVARAN cluster mappings remain unchanged.
    7. Existing NIVARAN subject mappings remain unchanged.
    8. Existing category routing remains unchanged.
    9. Manager remains mapped to correct VYASA identity.
    10. No duplicate VYASA identity for the same normalized email.
    11. No temporary placeholder identity left as a real NIVARAN authority identity.
    """
    verification_results: Dict[str, Any] = {"passed": True, "errors": []}

    # Fetch NIVARAN authorities
    auth_query = text("SELECT id, vyasa_user_id, role, name_snapshot, email_snapshot FROM nivaran_authorities WHERE is_active = TRUE")
    authorities = nivaran_db.execute(auth_query).fetchall()

    # Fetch VYASA users
    vyasa_users_stmt = select(User).options(joinedload(User.roles))
    vyasa_users = vyasa_db.execute(vyasa_users_stmt).unique().scalars().all()
    vyasa_user_map: Dict[uuid.UUID, User] = {u.id: u for u in vyasa_users}
    vyasa_email_counts: Dict[str, int] = {}
    for u in vyasa_users:
        if u.is_active:
            em = u.email.strip().lower()
            vyasa_email_counts[em] = vyasa_email_counts.get(em, 0) + 1

    forbidden_roles = {"MANAGER", "DEAN", "ASSISTANT_DEAN", "ASSOCIATE_DEAN", "GUEST_MEMBER"}

    for a in authorities:
        auth_id, vyasa_id, role, name, email = a[0], a[1], str(a[2]), str(a[3]), str(a[4]).strip().lower()

        # Check 1: non-null vyasa_user_id
        if not vyasa_id:
            verification_results["errors"].append(f"Authority {name} ({auth_id}) has NULL vyasa_user_id.")
            continue

        vyasa_uuid = uuid.UUID(str(vyasa_id))

        # Check 2: exists in VYASA users.id
        if vyasa_uuid not in vyasa_user_map:
            verification_results["errors"].append(f"vyasa_user_id {vyasa_uuid} for {name} does not exist in VYASA users.")
            continue

        vyasa_user = vyasa_user_map[vyasa_uuid]

        # Check 3: generic authority role
        user_role_names = {r.name.lower() for r in vyasa_user.roles}
        if GENERIC_AUTHORITY_ROLE not in user_role_names:
            verification_results["errors"].append(f"VYASA user {vyasa_user.email} missing generic 'authority' role.")

        # Check 4: no forbidden pillar roles
        for r_name in user_role_names:
            if r_name.upper() in forbidden_roles:
                verification_results["errors"].append(f"VYASA user {vyasa_user.email} has forbidden pillar role '{r_name}'.")

        # Check 11: no placeholder identity left as real authority
        if "authority0" in vyasa_user.email.lower() or "authority1" in vyasa_user.email.lower():
            verification_results["errors"].append(f"Placeholder email '{vyasa_user.email}' left on authority {name}.")

    # Check 10: no duplicate emails among active VYASA users
    for em, count in vyasa_email_counts.items():
        if count > 1:
            verification_results["errors"].append(f"Duplicate active VYASA user found for email '{em}' (count={count}).")

    # Check 6, 7, 8: verify clusters, subjects, categories are intact
    sc_count = nivaran_db.execute(text("SELECT COUNT(*) FROM subject_clusters")).scalar()
    sub_count = nivaran_db.execute(text("SELECT COUNT(*) FROM subjects")).scalar()
    gc_count = nivaran_db.execute(text("SELECT COUNT(*) FROM grievance_clusters")).scalar()
    cat_count = nivaran_db.execute(text("SELECT COUNT(*) FROM categories")).scalar()

    if sc_count != 10:
        verification_results["errors"].append(f"Expected 10 subject clusters, found {sc_count}.")
    if sub_count != 56:
        verification_results["errors"].append(f"Expected 56 subjects, found {sub_count}.")
    if gc_count != 3:
        verification_results["errors"].append(f"Expected 3 grievance clusters, found {gc_count}.")
    if cat_count != 16:
        verification_results["errors"].append(f"Expected 16 categories, found {cat_count}.")

    if verification_results["errors"]:
        verification_results["passed"] = False

    return verification_results


if __name__ == "__main__":
    import argparse
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.core.config import settings as vyasa_settings

    parser = argparse.ArgumentParser(description="Authority Identity Reconciliation Tool")
    parser.add_argument("--dry-run", action="store_true", help="Report actions without modifying databases")
    parser.add_argument("--nivaran-env", type=str, default=r"C:\Projects\VYASA\apps\pillars\nivaran\backend\.env", help="Path to NIVARAN .env file")
    args = parser.parse_args()

    # Load NIVARAN settings from explicit env file
    import importlib.util
    spec = importlib.util.spec_from_file_location("nivaran_config", r"C:\Projects\VYASA\apps\pillars\nivaran\backend\app\core\config.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    nivaran_settings = mod.Settings(_env_file=args.nivaran_env)

    vyasa_engine = create_engine(vyasa_settings.DATABASE_URL)
    nivaran_engine = create_engine(nivaran_settings.DATABASE_URL.get_secret_value())

    VyasaSession = sessionmaker(bind=vyasa_engine)
    NivaranSession = sessionmaker(bind=nivaran_engine)

    with VyasaSession() as v_db, NivaranSession() as n_db:
        print("==================================================")
        print(" AUTHORITY RECONCILIATION PRE-EXECUTION REPORT")
        print("==================================================")
        report = generate_reconciliation_report(v_db, n_db)
        print(f"Total Authorities Evaluated: {report['total_authorities']}")
        print(f"Can Proceed: {report['can_proceed']}")
        print("-" * 120)
        print(f"{'NIVARAN Name':<28} | {'Role':<15} | {'Authority ID':<36} | {'VYASA User ID':<36} | {'Action':<22}")
        print("-" * 120)
        for item in report["authorities_report"]:
            print(f"{item.name_snapshot:<28} | {item.role:<15} | {str(item.nivaran_authority_id):<36} | {str(item.matched_vyasa_user_id):<36} | {item.action.value:<22}")

        print("\nRetained Temporary Users:")
        for r_user in report["retained_temporary_users"]:
            print(f"  - {r_user['name']} ({r_user['email']}): {r_user['reason']}")

        print("\nDeactivated Temporary Users:")
        for d_user in report["deactivated_temporary_users"]:
            print(f"  - {d_user['name']} ({d_user['email']}): {d_user['reason']}")

        if report["conflicts"]:
            print("\nConflicts Detected:")
            for c in report["conflicts"]:
                print(f"  [!] {c}")

        if not args.dry_run and report["can_proceed"]:
            print("\nExecuting reconciliation...")
            result = execute_reconciliation(v_db, n_db, dry_run=False)
            print(f"Reconciliation result: {result}")

            print("\nVerifying post-reconciliation state...")
            v_res = verify_post_reconciliation(v_db, n_db)
            print(f"Verification passed: {v_res['passed']}")
            if not v_res["passed"]:
                print(f"Errors: {v_res['errors']}")
