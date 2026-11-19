import os, sys, json
from dotenv import load_dotenv
load_dotenv('backend/.env')
sys.path.insert(0, 'backend')
from app.core.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
pubs = db.execute(text("""
    SELECT id, serial_no, title, author_display
    FROM sama_research_publications
    WHERE bulletin_id = '878181e5-d82b-4fff-8e21-9b18dc996884'
""")).fetchall()
db.close()

with open('scratch/deduped_incentive_inventory.json', encoding='utf-8') as f:
    certs = json.load(f)

# Normalize for matching
def norm(s):
    if not s: return ""
    return "".join(c for c in s.lower() if c.isalnum())

pub_norm = {norm(p[2]): p for p in pubs}
matches = []
for c in certs:
    cn = norm(c['title'])
    if cn in pub_norm:
        p = pub_norm[cn]
        matches.append({
            'cert_no': c['cert_no'],
            'recipient': c['recipient'],
            'cert_title': c['title'],
            'pub_serial': p[1],
            'pub_title': p[2],
            'pub_authors': p[3]
        })

print(f"Total current Issue 3 pubs: {len(pubs)}")
print(f"Total matching certs: {len(matches)}")
with open('scratch/pub_cert_matches.json', 'w', encoding='utf-8') as f:
    json.dump(matches, f, indent=2, ensure_ascii=False)

for m in matches[:15]:
    print(f"Cert {m['cert_no']} ({m['recipient']}) -> Pub #{m['pub_serial']} | {m['pub_title'][:50]}")
