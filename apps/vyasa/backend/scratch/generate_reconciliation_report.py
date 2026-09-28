import os
import sys
import uuid
import importlib.util
from typing import Dict, Any, List, Optional
from sqlalchemy import create_engine, text

def load_settings(path: str, module_name: str, env_path: str):
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    # Instantiate with explicit _env_file
    return mod.Settings(_env_file=env_path)

def get_url(secret_or_str):
    if hasattr(secret_or_str, "get_secret_value"):
        return secret_or_str.get_secret_value()
    return str(secret_or_str)

def generate_reconciliation_plan():
    vyasa_settings = load_settings(
        r"C:\Projects\VYASA\apps\vyasa\backend\app\core\config.py",
        "vyasa_config",
        r"C:\Projects\VYASA\apps\vyasa\backend\.env"
    )
    nivaran_settings = load_settings(
        r"C:\Projects\VYASA\apps\pillars\nivaran\backend\app\core\config.py",
        "nivaran_config",
        r"C:\Projects\VYASA\apps\pillars\nivaran\backend\.env"
    )

    vyasa_url = get_url(vyasa_settings.DATABASE_URL)
    nivaran_url = get_url(nivaran_settings.DATABASE_URL)

    vyasa_engine = create_engine(vyasa_url)
    nivaran_engine = create_engine(nivaran_url)

    with nivaran_engine.connect() as n_conn:
        nivaran_authorities = n_conn.execute(
            text("SELECT id, vyasa_user_id, role, name_snapshot, email_snapshot FROM nivaran_authorities ORDER BY id")
        ).fetchall()

    with vyasa_engine.connect() as v_conn:
        vyasa_users = v_conn.execute(
            text("SELECT id, email, first_name, last_name, is_active FROM users")
        ).fetchall()

    vyasa_by_email = {u[1].lower().strip(): u for u in vyasa_users}
    vyasa_by_id = {uuid.UUID(str(u[0])): u for u in vyasa_users}

    report = []

    for auth in nivaran_authorities:
        auth_id = uuid.UUID(str(auth[0]))
        curr_vyasa_id = uuid.UUID(str(auth[1])) if auth[1] else None
        role = auth[2]
        name = auth[3]
        email = auth[4].lower().strip() if auth[4] else ""

        uuid_exists_in_vyasa = curr_vyasa_id in vyasa_by_id if curr_vyasa_id else False

        matched_user_by_email = vyasa_by_email.get(email)
        matched_user_by_uuid = vyasa_by_id.get(curr_vyasa_id) if curr_vyasa_id else None

        # Determine action
        if matched_user_by_email:
            matched_id = uuid.UUID(str(matched_user_by_email[0]))
            matched_email = matched_user_by_email[1]
            if curr_vyasa_id == matched_id:
                action = "NO_CHANGE"
            else:
                action = "UPDATE_NIVARAN_MAPPING"
        elif matched_user_by_uuid:
            matched_id = uuid.UUID(str(matched_user_by_uuid[0]))
            matched_email = matched_user_by_uuid[1]
            action = "REUSE_EXISTING" # Referenced by UUID -> update placeholder fields
        else:
            matched_id = curr_vyasa_id
            matched_email = email
            action = "CREATE_VYASA_USER"

        report.append({
            "nivaran_auth_id": str(auth_id),
            "name_snapshot": name,
            "email_snapshot": email,
            "role": role,
            "current_vyasa_user_id": str(curr_vyasa_id) if curr_vyasa_id else "None",
            "uuid_exists_in_vyasa": uuid_exists_in_vyasa,
            "matched_vyasa_id": str(matched_id) if matched_id else "None",
            "matched_vyasa_email": matched_email if matched_email else "None",
            "action": action
        })

    print(f"Total authorities evaluated: {len(report)}")
    print(f"{'Name':<28} | {'Role':<15} | {'NIVARAN vyasa_user_id':<36} | {'In VYASA?':<9} | {'Action':<22}")
    print("-" * 120)
    for r in report:
        print(f"{r['name_snapshot']:<28} | {r['role']:<15} | {r['current_vyasa_user_id']:<36} | {str(r['uuid_exists_in_vyasa']):<9} | {r['action']:<22}")

if __name__ == "__main__":
    generate_reconciliation_plan()
