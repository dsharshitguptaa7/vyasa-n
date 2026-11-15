import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv(backend_dir / '.env')

from sqlalchemy import text
from app.core.database import SessionLocal

def inspect():
    db = SessionLocal()
    try:
        r1 = db.execute(text("SELECT count(*) FROM sama_research_authors WHERE department ILIKE '%department of research%'")).scalar()
        print(f"sama_research_authors with Department of Research: {r1}")

        r2 = db.execute(text("SELECT count(*) FROM sama_certificate_authors WHERE department_snapshot ILIKE '%department of research%'")).scalar()
        print(f"sama_certificate_authors with Department of Research: {r2}")

        rows = db.execute(text("SELECT id, certificate_id, author_name_snapshot, department_snapshot, designation_snapshot FROM sama_certificate_authors")).fetchall()
        print(f"Total certificate authors: {len(rows)}")
        for r in rows:
            print(f"  CertAuthor ID: {r[0]}, Name: {r[2]}, DeptSnapshot: {r[3]}, DesigSnapshot: {r[4]}")

        certs = db.execute(text("SELECT id, certificate_number, bulletin_id, bulletin_volume_snapshot, bulletin_issue_snapshot, bulletin_period_snapshot FROM sama_felicitation_certificates")).fetchall()
        print(f"\nTotal certificates: {len(certs)}")
        for c in certs:
            print(f"  Cert: {c[1]}, Bulletin ID: {c[2]}, VolSnapshot: {c[3]}, IssueSnapshot: {c[4]}, PeriodSnapshot: {c[5]}")

    finally:
        db.close()

if __name__ == '__main__':
    inspect()
