import sys
sys.path.insert(0, 'backend')
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models.user import User
from app.core.security import create_access_token

client = TestClient(app)
db = SessionLocal()
try:
    user = db.query(User).filter(User.email == 'sadmin@csjmu.ac.in').first()
    print('Testing with user:', user.email if user else 'No user found')
    token = create_access_token(data={'sub': str(user.id)}) if user else ''
    headers = {'Authorization': f'Bearer {token}'}

    for path in [
        '/api/admin/sama/certificates/stats',
        '/api/admin/sama/certificates',
        '/api/admin/sama/templates',
        '/api/admin/sama/signatories',
        '/api/admin/sama/authors',
        '/api/admin/sama/bulletins',
        '/api/admin/sama/publications',
    ]:
        resp = client.get(path, headers=headers)
        ct = resp.headers.get("content-type")
        print(f'{path} -> status: {resp.status_code}, content-type: {ct}')
        if resp.status_code != 200:
            print('  Error body:', resp.text[:300])
        else:
            try:
                data = resp.json()
                d = data.get('data')
                if isinstance(d, dict):
                    print(f'  Success: total={d.get("total")}, keys={list(d.keys())}')
                else:
                    print(f'  Success: data={d}')
            except Exception as e:
                print('  JSON parse error:', e, 'Body:', resp.text[:100])
finally:
    db.close()
