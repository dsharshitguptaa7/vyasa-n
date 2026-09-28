import sys
sys.path.insert(0, r"C:\Projects\VYASA\apps\vyasa\backend")
from app.core.config import settings as vyasa_settings
from sqlalchemy import create_engine, text

engine = create_engine(vyasa_settings.DATABASE_URL)
with engine.connect() as conn:
    tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).fetchall()
    print("Tables in VYASA:", [t[0] for t in tables])

    fks = conn.execute(text("""
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
        JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
        WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'users'
    """)).fetchall()
    print("Foreign keys pointing to users:", fks)

    for fk in fks:
        t_name, col_name = fk[0], fk[1]
        cnt = conn.execute(text(f"SELECT count(*) FROM {t_name}")).scalar()
        print(f"Count in {t_name}.{col_name}: {cnt}")
