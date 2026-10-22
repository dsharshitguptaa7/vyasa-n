"""backfill_notification_source_branding

Revision ID: 8b29c54e1008
Revises: 8b29c54e1007
Create Date: 2026-10-13 19:50:00.000000+00:00

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8b29c54e1008'
down_revision: Union[str, None] = '8b29c54e1007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Remove generic server default 'VYASA_CORE' from source_pillar column
    op.alter_column('notifications', 'source_pillar', server_default=None)

    # 2. Auditable backfill: Migrate verifiably grievance-related records from 'VYASA_CORE' to 'NIVARAN'
    # Preserves recipient user_id, timestamps, read/unread states, and existing data integrity.
    # Genuine platform announcements and non-grievance events remain completely untouched.
    op.execute(
        sa.text("""
        UPDATE notifications
        SET source_pillar = 'NIVARAN',
            event_type = CASE
                WHEN type = 'GRIEVANCE_SUBMITTED' THEN 'grievance.submitted'
                WHEN type = 'GRIEVANCE_ASSIGNED' THEN 'authority.case_assigned'
                WHEN type = 'GRIEVANCE_STATUS_CHANGED' THEN 'grievance.status_changed'
                WHEN type = 'GRIEVANCE_RESOLVED' THEN 'grievance.resolved'
                WHEN type = 'GRIEVANCE_ESCALATED' THEN 'authority.escalated'
                WHEN type = 'GRIEVANCE_FORWARDED' THEN 'authority.case_forwarded'
                WHEN type IN ('DOCUMENT_REQUEST', 'DOCUMENT_REQUESTED') THEN 'grievance.document_requested'
                WHEN type = 'COMMITTEE_REQUEST_RECEIVED' THEN 'committee.formation_requested'
                WHEN type = 'workflow' AND title ILIKE '%Feedback%' THEN 'manager.feedback_received'
                WHEN type = 'workflow' AND title ILIKE '%Closed%' THEN 'grievance.closed'
                WHEN type = 'workflow' AND title ILIKE '%E-File%' THEN 'grievance.efile_generated'
                ELSE event_type
            END,
            entity_type = COALESCE(entity_type, 'grievance'),
            action_required = CASE
                WHEN type IN ('DOCUMENT_REQUEST', 'DOCUMENT_REQUESTED', 'COMMITTEE_REQUEST_RECEIVED') THEN true
                WHEN type = 'workflow' AND title ILIKE '%Feedback%' THEN true
                WHEN type = 'GRIEVANCE_ASSIGNED' THEN true
                ELSE action_required
            END
        WHERE source_pillar = 'VYASA_CORE'
          AND (
              type IN (
                  'GRIEVANCE_SUBMITTED', 'GRIEVANCE_ASSIGNED', 'GRIEVANCE_STATUS_CHANGED',
                  'GRIEVANCE_RESOLVED', 'GRIEVANCE_ESCALATED', 'GRIEVANCE_FORWARDED',
                  'DOCUMENT_REQUEST', 'DOCUMENT_REQUESTED', 'COMMITTEE_REQUEST_RECEIVED'
              )
              OR (type = 'workflow' AND (
                  title ILIKE '%Feedback%' OR title ILIKE '%Closed%' OR title ILIKE '%E-File%'
                  OR title ILIKE '%Grievance%'
              ))
          );
        """)
    )


def downgrade() -> None:
    # Reinstate server default
    op.alter_column('notifications', 'source_pillar', server_default='VYASA_CORE')
