import os
import sys
from pathlib import Path
from dotenv import load_dotenv

backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(backend_dir / ".env")
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.certificate import FelicitationCertificate, CertificateAuthor, CertificateTemplate, CertificateSignatory
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from sqlalchemy import func

def main():
    db = SessionLocal()
    try:
        print("=== 1. AUTHORS AUDIT ===")
        total_authors = db.query(ResearchAuthor).count()
        dept_counts = db.query(ResearchAuthor.department, func.count(ResearchAuthor.id)).group_by(ResearchAuthor.department).order_by(func.count(ResearchAuthor.id).desc()).all()
        print(f"Total Authors in sama_authors: {total_authors}")
        print("Department breakdown:")
        for dept, count in dept_counts:
            print(f"  - {repr(dept)}: {count}")

        # Check for authors with Scopus ID
        with_scopus = db.query(ResearchAuthor).filter(ResearchAuthor.scopus_id.isnot(None), ResearchAuthor.scopus_id != "").count()
        print(f"Authors with Scopus ID: {with_scopus} / {total_authors}")

        print("\n=== 2. CERTIFICATES AUDIT ===")
        total_certs = db.query(FelicitationCertificate).count()
        print(f"Total Certificates: {total_certs}")
        certs = db.query(FelicitationCertificate).all()
        for c in certs:
            authors = db.query(CertificateAuthor).filter(CertificateAuthor.certificate_id == c.id).all()
            author_names = [f"{a.author_name_snapshot} (Scopus: {a.scopus_id_snapshot}, Dept: {a.department_snapshot})" for a in authors]
            print(f"  [{c.certificate_number}] status={c.status}, type={c.certificate_type}, bulletin_id={c.bulletin_id}")
            print(f"    Title: {c.title}")
            print(f"    Research: {c.research_title}")
            print(f"    Authors: {author_names}")
            print(f"    Checksum: {c.checksum_sha256[:16] if c.checksum_sha256 else 'None'}..., Token: {c.verification_token}")
            print(f"    Storage: {c.file_storage_path}")

        print("\n=== 3. RESEARCH BULLETINS AUDIT ===")
        total_bulletins = db.query(ResearchBulletin).count()
        print(f"Total Bulletins: {total_bulletins}")
        bulletins = db.query(ResearchBulletin).order_by(ResearchBulletin.volume_number, ResearchBulletin.issue_number).all()
        for b in bulletins:
            print(f"  ID: {b.id} | Vol {b.volume_number}, Issue {b.issue_number} | Period: {repr(b.publication_period)} | Title: {repr(b.title)} | Status: {b.status}")

        print("\n=== 4. CERTIFICATE TEMPLATES AUDIT ===")
        templates = db.query(CertificateTemplate).all()
        print(f"Total Templates: {len(templates)}")
        for t in templates:
            print(f"  Code: {t.code} | Name: {t.name} | Type: {t.certificate_type} | Default: {t.is_default}")

        print("\n=== 5. SIGNATORIES AUDIT ===")
        signatories = db.query(CertificateSignatory).all()
        print(f"Total Signatories: {len(signatories)}")
        for s in signatories:
            print(f"  ID: {s.id} | {s.signatory_name} ({s.designation}) | Role: {s.authority_type} | Active: {s.is_active} | Sig Path: {s.signature_image_path}")

    finally:
        db.close()

if __name__ == "__main__":
    main()
