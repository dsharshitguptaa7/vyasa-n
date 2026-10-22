"""committee_management_workspace

Revision ID: 8b29c54e1010
Revises: 8b29c54e1009
Create Date: 2026-10-14 00:00:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '8b29c54e1010'
down_revision: Union[str, None] = '8b29c54e1009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Update nivaran_committees
    op.execute(sa.text("ALTER TABLE nivaran_committees ADD COLUMN IF NOT EXISTS dissolution_reason TEXT;"))
    op.execute(sa.text("ALTER TABLE nivaran_committees ADD COLUMN IF NOT EXISTS dissolved_by_id UUID REFERENCES nivaran_authorities(id) ON DELETE SET NULL;"))

    # 2. Update nivaran_committee_polls
    op.execute(sa.text("ALTER TABLE nivaran_committee_polls ADD COLUMN IF NOT EXISTS closing_time TIMESTAMP WITH TIME ZONE;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_polls ADD COLUMN IF NOT EXISTS results_visibility VARCHAR(50) DEFAULT 'ALWAYS_VISIBLE' NOT NULL;"))

    # 3. Update nivaran_committee_meetings
    op.execute(sa.text("ALTER TABLE nivaran_committee_meetings ADD COLUMN IF NOT EXISTS title VARCHAR(255) DEFAULT 'Committee Meeting' NOT NULL;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_meetings ADD COLUMN IF NOT EXISTS agenda TEXT;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_meetings ADD COLUMN IF NOT EXISTS notes TEXT;"))

    # 4. Update nivaran_committee_meeting_participants
    op.execute(sa.text("ALTER TABLE nivaran_committee_meeting_participants ADD COLUMN IF NOT EXISTS authority_id UUID REFERENCES nivaran_authorities(id) ON DELETE SET NULL;"))

    # 5. Create nivaran_committee_formal_decisions table
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS nivaran_committee_formal_decisions (
            id UUID PRIMARY KEY,
            committee_id UUID NOT NULL REFERENCES nivaran_committees(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            decision_type VARCHAR(50) DEFAULT 'FORMAL_DECISION' NOT NULL,
            outcome VARCHAR(100) DEFAULT 'APPROVED' NOT NULL,
            summary TEXT NOT NULL,
            meeting_id UUID REFERENCES nivaran_committee_meetings(id) ON DELETE SET NULL,
            poll_id UUID REFERENCES nivaran_committee_polls(id) ON DELETE SET NULL,
            participating_members_snapshot JSONB,
            supporting_document_url VARCHAR(500),
            recorded_by_authority_id UUID NOT NULL REFERENCES nivaran_authorities(id) ON DELETE RESTRICT,
            recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            is_final_institutional_order BOOLEAN DEFAULT false NOT NULL,
            institutional_order_ref VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        );
    """))

    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_nivaran_comm_formal_dec_committee_id ON nivaran_committee_formal_decisions(committee_id);"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_nivaran_comm_formal_dec_meeting_id ON nivaran_committee_formal_decisions(meeting_id);"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_nivaran_comm_formal_dec_poll_id ON nivaran_committee_formal_decisions(poll_id);"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_nivaran_comm_formal_dec_recorded_by ON nivaran_committee_formal_decisions(recorded_by_authority_id);"))


def downgrade() -> None:
    op.execute(sa.text("DROP TABLE IF EXISTS nivaran_committee_formal_decisions CASCADE;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_meeting_participants DROP COLUMN IF EXISTS authority_id;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_meetings DROP COLUMN IF EXISTS notes;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_meetings DROP COLUMN IF EXISTS agenda;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_meetings DROP COLUMN IF EXISTS title;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_polls DROP COLUMN IF EXISTS results_visibility;"))
    op.execute(sa.text("ALTER TABLE nivaran_committee_polls DROP COLUMN IF EXISTS closing_time;"))
    op.execute(sa.text("ALTER TABLE nivaran_committees DROP COLUMN IF EXISTS dissolved_by_id;"))
    op.execute(sa.text("ALTER TABLE nivaran_committees DROP COLUMN IF EXISTS dissolution_reason;"))
