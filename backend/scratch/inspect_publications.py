import os, sys
from dotenv import load_dotenv
load_dotenv('backend/.env')
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
print('=== PUBLICATIONS BY BULLETIN ===')
counts = db.execute(text("""
    SELECT bulletin_id, COUNT(*), MIN(created_at), MAX(created_at)
    FROM sama_research_publications
    GROUP BY bulletin_id
""")).fetchall()
for c in counts:
    print(f'Bulletin ID: {c[0]} | Count: {c[1]} | Min created: {c[2]} | Max created: {c[3]}')

print('\n=== ALL PUBLICATIONS IN ISSUE 3 ===')
# Issue 3 bulletin_id = 878181e5-d82b-4fff-8e21-9b18dc996884
pubs = db.execute(text("""
    SELECT id, serial_no, title, source_journal, author_display, status, created_at, updated_at
    FROM sama_research_publications
    WHERE bulletin_id = '878181e5-d82b-4fff-8e21-9b18dc996884'
    ORDER BY serial_no ASC
""")).fetchall()
print(f'Total in Issue 3: {len(pubs)}')
for p in pubs:
    print(f'  #{p[1]} | ID: {p[0]} | Title: {p[2]} | Authors: {p[4]} | Journal: {p[3]} | Status: {p[5]} | Created: {p[6]}')

print('\n=== CERTIFICATES LINKED TO PUBLICATIONS ===')
certs = db.execute(text("""
    SELECT c.certificate_number, c.status, c.research_title, c.publication_id, c.bulletin_id, p.serial_no, p.title
    FROM sama_felicitation_certificates c
    LEFT JOIN sama_research_publications p ON c.publication_id = p.id
    ORDER BY c.certificate_number
""")).fetchall()
for c in certs:
    print(f'Cert: {c[0]} ({c[1]}) | Cert Research: {c[2]} | PubID: {c[3]} | Pub Serial: {c[5]} | Pub Title: {c[6]}')

db.close()
