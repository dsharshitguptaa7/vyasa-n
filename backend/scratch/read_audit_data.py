import os, sys, time, json
from dotenv import load_dotenv
load_dotenv('backend/.env')
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from sqlalchemy import text

for attempt in range(5):
    try:
        db = SessionLocal()
        
        print('=== 1. AUDIT LOGS FOR SAMA / CERTIFICATES ===')
        query = text("""
            SELECT id, action, module, entity_name, entity_id, user_id, created_at, details 
            FROM audit_logs 
            WHERE entity_name ILIKE '%cert%' 
               OR entity_name ILIKE '%sama%' 
               OR module ILIKE '%sama%'
               OR action ILIKE '%cert%' 
               OR action ILIKE '%bulletin%'
               OR action ILIKE '%delete%'
            ORDER BY created_at DESC LIMIT 100
        """)
        logs = db.execute(query).fetchall()
        print(f'Total matching audit logs: {len(logs)}')
        for l in logs:
            print(f'{l[6]} | Action: {l[1]} | Mod: {l[2]} | Entity: {l[3]} ({l[4]}) | Details: {json.dumps(l[7])[:160]}')

        print('\n=== 2. ALL RECENT AUDIT LOG ACTIONS (LAST 50) ===')
        query2 = text("""
            SELECT id, action, module, entity_name, entity_id, user_id, created_at, details 
            FROM audit_logs 
            ORDER BY created_at DESC LIMIT 50
        """)
        logs2 = db.execute(query2).fetchall()
        for l in logs2:
            print(f'{l[6]} | Action: {l[1]} | Mod: {l[2]} | Entity: {l[3]} ({l[4]}) | Details: {json.dumps(l[7])[:120]}')

        print('\n=== 3. SAMA IMPORT BATCHES DETAILS ===')
        batches = db.execute(text("""
            SELECT id, batch_number, entity_type, source_filename, mode, status, total_rows, created_count, reconciliation_report 
            FROM sama_import_batches 
            ORDER BY created_at DESC
        """)).fetchall()
        for b in batches:
            print(f"Batch: {b[1]} | Type: {b[2]} | File: {b[3]} | Mode: {b[4]} | Status: {b[5]} | Total: {b[6]} | Created: {b[7]}")
            if b[8]:
                print(f"  Reconciliation summary: {str(b[8])[:300]}")

        print('\n=== 4. CURRENT CERTIFICATES DETAILED ===')
        certs = db.execute(text("""
            SELECT id, certificate_number, certificate_type, status, title, research_title, 
                   bulletin_id, bulletin_volume_snapshot, bulletin_issue_snapshot,
                   verification_token, checksum_sha256, file_storage_path, publication_details,
                   is_revoked, scheduled_issue_date, issued_at, created_at, updated_at
            FROM sama_felicitation_certificates
            ORDER BY created_at ASC
        """)).fetchall()
        for c in certs:
            print(f"Cert: {c[1]} | ID: {c[0]} | Status: {c[3]} | Type: {c[2]}")
            print(f"  Research: {c[5]}")
            print(f"  Vol/Issue: {c[7]}/{c[8]} | Bulletin: {c[6]}")
            print(f"  Token: {c[9]}")
            print(f"  Sha256: {c[10]}")
            print(f"  Path: {c[11]}")
            print(f"  Details: {json.dumps(c[12])[:200] if c[12] else 'None'}")
            print(f"  Created: {c[16]} | Issued: {c[15]} | Revoked: {c[13]}")
            
            # Print authors for this cert
            authors = db.execute(text("""
                SELECT author_order, author_name_snapshot, department_snapshot, scopus_id_snapshot, author_role
                FROM sama_certificate_authors
                WHERE certificate_id = :cid
                ORDER BY author_order ASC
            """), {"cid": c[0]}).fetchall()
            for a in authors:
                print(f"    Author {a[0]}: {a[1]} | Dept: {a[2]} | Scopus: {a[3]} | Role: {a[4]}")

            # Print approvals for this cert
            approvals = db.execute(text("""
                SELECT authority_type, signatory_name_snapshot, status, decided_at
                FROM sama_certificate_approvals
                WHERE certificate_id = :cid
            """), {"cid": c[0]}).fetchall()
            for ap in approvals:
                print(f"    Approval {ap[0]}: {ap[1]} | Status: {ap[2]} | DecidedAt: {ap[3]}")

        print('\n=== 5. SAMA RESEARCH PUBLICATIONS IN ISSUE 3 ===')
        pubs = db.execute(text("""
            SELECT id, serial_no, title, journal_name, publication_date, scopus_indexed, bulletin_id, created_at
            FROM sama_research_publications
            WHERE bulletin_id = '878181e5-d82b-4fff-8e21-9b18dc996884'
            ORDER BY serial_no ASC
        """)).fetchall()
        print(f"Total publications in Issue 3: {len(pubs)}")
        for p in pubs[:10]:
            print(f"  Pub #{p[1]}: {p[2]} | Journal: {p[3]} | Date: {p[4]} | Created: {p[7]}")

        db.close()
        break
    except Exception as exc:
        print(f'Attempt {attempt+1} failed: {exc}')
        time.sleep(2)
