from typing import List, Dict, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.core.database import SessionLocal
from app.models.role import Role
from app.models.permission import Permission

INITIAL_PERMISSIONS: List[Dict[str, str]] = [
    # User & Identity domain
    {"name": "users:read", "resource": "users", "action": "read", "description": "View user profiles and accounts"},
    {"name": "users:manage", "resource": "users", "action": "manage", "description": "Create, edit, or deactivate user accounts"},
    
    # Roles & RBAC domain
    {"name": "roles:read", "resource": "roles", "action": "read", "description": "View system roles and permission matrices"},
    {"name": "roles:manage", "resource": "roles", "action": "manage", "description": "Assign or modify role definitions"},
    
    # Pillar Registry domain
    {"name": "pillars:read", "resource": "pillars", "action": "read", "description": "Discover registered ecosystem pillars"},
    {"name": "pillars:manage", "resource": "pillars", "action": "manage", "description": "Register, configure, or toggle pillar status"},
    
    # Governance & Institutional Review domain
    {"name": "governance:access", "resource": "governance", "action": "access", "description": "Access institutional governance console"},
    {"name": "governance:review", "resource": "governance", "action": "review", "description": "Review and adjudicate submissions"},
    
    # Applicant domain
    {"name": "applications:submit", "resource": "applications", "action": "submit", "description": "Submit applications and requests"},
    {"name": "applications:read", "resource": "applications", "action": "read", "description": "View submitted application statuses"},
    
    # Notifications domain
    {"name": "notifications:read", "resource": "notifications", "action": "read", "description": "View platform notifications"},
    {"name": "notifications:manage", "resource": "notifications", "action": "manage", "description": "Dispatch or manage notifications"},
]

INITIAL_ROLES: List[Dict[str, str]] = [
    {
        "name": "administrator",
        "description": "Ecosystem administrator with full platform governance and configuration rights",
        "is_system": True,
    },
    {
        "name": "authority",
        "description": "Institutional authority with governance adjudication and review privileges",
        "is_system": True,
    },
    {
        "name": "applicant",
        "description": "Student, scholar, or applicant accessing ecosystem services and tracking submissions",
        "is_system": True,
    },
]

ROLE_PERMISSION_MAP: Dict[str, List[str]] = {
    "administrator": [p["name"] for p in INITIAL_PERMISSIONS],
    "authority": [
        "pillars:read",
        "governance:access",
        "governance:review",
        "applications:read",
        "notifications:read",
    ],
    "applicant": [
        "pillars:read",
        "applications:submit",
        "applications:read",
        "notifications:read",
    ],
}


INITIAL_PILLARS: List[Dict[str, Any]] = [
    {
        "pillar_key": "pillar-1",
        "name": "Pillar 1",
        "description": "Foundational academic subsystem designed to interface with core governance services through standardized institutional contracts.",
        "status": "scheduled",
        "version": "0.1.0",
        "is_enabled": True,
        "metadata_json": {
            "subtitle": "Modular Ecosystem Subsystem",
            "icon": "academic",
            "route": "/pillars/pillar-1",
            "badgeLabel": "Scheduled",
            "badgeVariant": "gold",
            "requiredRoles": [],
        },
    },
    {
        "pillar_key": "pillar-2",
        "name": "Pillar 2",
        "description": "Dedicated research and scholarship subsystem establishing independent workflows with ecosystem-wide single sign-on and verification.",
        "status": "scheduled",
        "version": "0.1.0",
        "is_enabled": True,
        "metadata_json": {
            "subtitle": "Modular Ecosystem Subsystem",
            "icon": "research",
            "route": "/pillars/pillar-2",
            "badgeLabel": "Scheduled",
            "badgeVariant": "gold",
            "requiredRoles": [],
        },
    },
    {
        "pillar_key": "pillar-3",
        "name": "Pillar 3",
        "description": "Institutional operations and evaluation subsystem integrating with central policy repositories and administrative registries.",
        "status": "scheduled",
        "version": "0.1.0",
        "is_enabled": True,
        "metadata_json": {
            "subtitle": "Modular Ecosystem Subsystem",
            "icon": "operations",
            "route": "/pillars/pillar-3",
            "badgeLabel": "Scheduled",
            "badgeVariant": "gold",
            "requiredRoles": [],
        },
    },
    {
        "pillar_key": "nivaran",
        "name": "NIVARAN",
        "description": "Intelligent university grievance redressal and resolution platform, featuring AI-assisted ticket triage, transparent escalations, and automated tracking.",
        "status": "development",
        "version": "0.1.0",
        "is_enabled": True,
        "metadata_json": {
            "subtitle": "AI-Assisted Grievance Redressal",
            "icon": "shield",
            "route": "/pillars/nivaran",
            "badgeLabel": "In Development",
            "badgeVariant": "saffron",
            "requiredRoles": [],
        },
    },
]


def seed_roles_and_permissions(db: Session) -> Tuple[int, int]:
    """
    Idempotent seeding mechanism for core VYASA roles and permissions.
    Safe to execute repeatedly without duplicating entries.
    Returns (roles_seeded_count, permissions_seeded_count).
    """
    # 1. Seed Permissions
    permissions_map: Dict[str, Permission] = {}
    for perm_data in INITIAL_PERMISSIONS:
        stmt = select(Permission).where(Permission.name == perm_data["name"])
        existing = db.execute(stmt).scalar_one_or_none()
        if not existing:
            perm = Permission(
                name=perm_data["name"],
                resource=perm_data["resource"],
                action=perm_data["action"],
                description=perm_data["description"],
            )
            db.add(perm)
            db.flush()
            permissions_map[perm.name] = perm
        else:
            permissions_map[existing.name] = existing

    # 2. Seed Roles
    roles_map: Dict[str, Role] = {}
    for role_data in INITIAL_ROLES:
        stmt = select(Role).where(Role.name == role_data["name"])
        existing = db.execute(stmt).scalar_one_or_none()
        if not existing:
            role = Role(
                name=role_data["name"],
                description=role_data["description"],
                is_system=role_data["is_system"],
            )
            db.add(role)
            db.flush()
            roles_map[role.name] = role
        else:
            roles_map[existing.name] = existing

    # 3. Associate Permissions to Roles idempotently
    for role_name, perm_names in ROLE_PERMISSION_MAP.items():
        role = roles_map.get(role_name)
        if not role:
            continue
        
        current_perm_names = {p.name for p in role.permissions}
        for p_name in perm_names:
            if p_name not in current_perm_names and p_name in permissions_map:
                role.permissions.append(permissions_map[p_name])

    db.commit()
    return len(roles_map), len(permissions_map)


def seed_default_pillars(db: Session) -> int:
    """
    Idempotent seeding mechanism for initial VYASA ecosystem pillars in pillar_registry.
    """
    from app.models.pillar import PillarRegistry
    seeded_count = 0
    for pillar_data in INITIAL_PILLARS:
        stmt = select(PillarRegistry).where(PillarRegistry.pillar_key == pillar_data["pillar_key"])
        existing = db.execute(stmt).scalar_one_or_none()
        if not existing:
            pillar = PillarRegistry(
                pillar_key=pillar_data["pillar_key"],
                name=pillar_data["name"],
                description=pillar_data["description"],
                status=pillar_data["status"],
                version=pillar_data["version"],
                is_enabled=pillar_data["is_enabled"],
                metadata_json=pillar_data["metadata_json"],
            )
            db.add(pillar)
            seeded_count += 1
    db.commit()
    return seeded_count


def seed_all(db: Session, seed_authorities: bool = True) -> Dict[str, Any]:
    r_count, p_count = seed_roles_and_permissions(db)
    pillars_seeded = seed_default_pillars(db)
    results: Dict[str, Any] = {
        "roles": r_count,
        "permissions": p_count,
        "pillars_seeded": pillars_seeded,
    }
    if seed_authorities:
        from app.services.authority_seed_service import seed_institutional_authorities
        auth_results = seed_institutional_authorities(db, strict_15_slots=False)
        results["authorities"] = auth_results
    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="VYASA Core Database Seeder")
    parser.add_argument("--authorities", action="store_true", help="Seed institutional authorities from env/manifest")
    parser.add_argument("--manifest", type=str, help="Path to authority manifest JSON file")
    parser.add_argument("--non-strict", action="store_true", help="Allow partial authority manifest for testing")
    args = parser.parse_args()

    with SessionLocal() as session:
        if args.manifest:
            from app.services.authority_seed_service import load_manifest_from_file, seed_institutional_authorities
            seed_roles_and_permissions(session)
            seed_default_pillars(session)
            specs = load_manifest_from_file(args.manifest, strict_15_slots=not args.non_strict)
            res = seed_institutional_authorities(session, specs=specs, strict_15_slots=not args.non_strict)
            print(f"Seed with manifest completed successfully: {res}")
        elif args.authorities:
            from app.services.authority_seed_service import seed_institutional_authorities
            seed_roles_and_permissions(session)
            seed_default_pillars(session)
            res = seed_institutional_authorities(session, strict_15_slots=not args.non_strict)
            print(f"Authority seed completed successfully: {res}")
        else:
            results = seed_all(session)
            print(f"Seed completed successfully: {results}")


