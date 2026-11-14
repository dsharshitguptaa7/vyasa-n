import os
import sys

# Load env from backend/.env
env_file = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
if os.path.isfile(env_file):
    with open(env_file) as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k, v)

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.database import SessionLocal
from app.modules.sama_veda.models import CertificateSignatory

db = SessionLocal()
try:
    sigs = db.query(CertificateSignatory).all()
    print(f"Total Signatories in DB: {len(sigs)}")
    for s in sigs:
        print(f"- [{s.authority_type}] {s.signatory_name} ({s.designation}) | sig: {s.signature_image_path} | active: {s.is_active}")
finally:
    db.close()
