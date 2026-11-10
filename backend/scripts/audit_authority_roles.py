import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.models.user import User

def audit():
    db = SessionLocal()
    try:
        authorities = db.query(NivaranAuthority).all()
        print(f"Total NivaranAuthority records found: {len(authorities)}")
        missing_authority_role = []
        for a in authorities:
            user = db.query(User).filter(User.id == a.vyasa_user_id).first()
            roles = [r.name for r in user.roles] if user else []
            has_auth = "authority" in roles
            print(f"- Email: {a.email_snapshot:<30} Role: {str(a.role):<18} Has 'authority': {has_auth:<5} Roles: {roles}")
            if not has_auth:
                missing_authority_role.append((a.email_snapshot, str(a.role), a.vyasa_user_id))
        print(f"\nTotal authorities missing generic 'authority' role: {len(missing_authority_role)}")
        for item in missing_authority_role:
            print(f"  * {item[0]} ({item[1]}) User ID: {item[2]}")
    finally:
        db.close()

if __name__ == "__main__":
    audit()
