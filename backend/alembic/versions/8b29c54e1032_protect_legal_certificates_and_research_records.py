"""protect_legal_certificates_and_research_records

Revision ID: 8b29c54e1032
Revises: 8b29c54e1031
Create Date: 2026-11-20 18:45:00.000000+00:00

Phase 2A Data Safety & Persistence Safeguards:
1. Replaces destructive CASCADE foreign keys on critical institutional records with RESTRICT:
   - sama_research_publications.bulletin_id: Prevents silent bulk deletion of research publications when a bulletin edition is removed.
   - sama_felicitation_certificates.bulletin_id: Prevents silent destruction of legally verifiable certificates when a bulletin edition is removed.
   - sama_felicitation_certificates.author_id: Prevents destruction of issued certificates, verification tokens, and SHA-256 hashes when an author profile is removed.
2. Fully reversible upgrade and downgrade paths.
3. Safe for existing data (no rows dropped or modified).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8b29c54e1032'
down_revision: Union[str, None] = '8b29c54e1031'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Update sama_research_publications.bulletin_id FK
    fks_pub = insp.get_foreign_keys('sama_research_publications')
    for fk in fks_pub:
        if 'bulletin_id' in fk.get('constrained_columns', []):
            fk_name = fk.get('name')
            if fk_name:
                op.drop_constraint(fk_name, 'sama_research_publications', type_='foreignkey')
            break
    op.create_foreign_key(
        'fk_sama_pub_bulletin_restrict',
        'sama_research_publications',
        'sama_research_bulletins',
        ['bulletin_id'],
        ['id'],
        ondelete='RESTRICT',
    )

    # 2. Update sama_felicitation_certificates.bulletin_id and author_id FKs
    fks_cert = insp.get_foreign_keys('sama_felicitation_certificates')
    for fk in fks_cert:
        cols = fk.get('constrained_columns', [])
        fk_name = fk.get('name')
        if 'bulletin_id' in cols and fk_name:
            op.drop_constraint(fk_name, 'sama_felicitation_certificates', type_='foreignkey')
        elif 'author_id' in cols and fk_name:
            op.drop_constraint(fk_name, 'sama_felicitation_certificates', type_='foreignkey')

    op.create_foreign_key(
        'fk_sama_cert_bulletin_restrict',
        'sama_felicitation_certificates',
        'sama_research_bulletins',
        ['bulletin_id'],
        ['id'],
        ondelete='RESTRICT',
    )
    op.create_foreign_key(
        'fk_sama_cert_author_restrict',
        'sama_felicitation_certificates',
        'sama_research_authors',
        ['author_id'],
        ['id'],
        ondelete='RESTRICT',
    )


def downgrade() -> None:
    # Revert to CASCADE
    op.drop_constraint('fk_sama_pub_bulletin_restrict', 'sama_research_publications', type_='foreignkey')
    op.create_foreign_key(
        'sama_research_publications_bulletin_id_fkey',
        'sama_research_publications',
        'sama_research_bulletins',
        ['bulletin_id'],
        ['id'],
        ondelete='CASCADE',
    )

    op.drop_constraint('fk_sama_cert_bulletin_restrict', 'sama_felicitation_certificates', type_='foreignkey')
    op.drop_constraint('fk_sama_cert_author_restrict', 'sama_felicitation_certificates', type_='foreignkey')
    op.create_foreign_key(
        'sama_felicitation_certificates_bulletin_id_fkey',
        'sama_felicitation_certificates',
        'sama_research_bulletins',
        ['bulletin_id'],
        ['id'],
        ondelete='CASCADE',
    )
    op.create_foreign_key(
        'sama_felicitation_certificates_author_id_fkey',
        'sama_felicitation_certificates',
        'sama_research_authors',
        ['author_id'],
        ['id'],
        ondelete='CASCADE',
    )
