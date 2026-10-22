import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationDelivery
from app.models.user import User
from app.schemas.notification import NotificationRead, NotificationCreate, NotificationEventPayload
from app.services.notifications.registry import registry
from app.services.notifications.engine import engine as notification_engine


@pytest.fixture(scope="function")
def db(db_session: Session):
    return db_session


@pytest.fixture(scope="function")
def test_user(db: Session):
    uid = uuid.uuid4()
    email = f"brand_test_{uid.hex[:8]}@csjmu.ac.in"
    user = User(
        id=uid,
        email=email,
        password_hash="mock_hash",
        first_name="Branding",
        last_name="Tester",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    yield user

    # Cleanup
    db.execute(select(Notification).where(Notification.user_id == user.id))
    db.delete(user)
    db.commit()


def test_registry_authoritative_display_name_resolution():
    """
    Verifies that the registry resolves display names authoritatively:
    - NIVARAN -> 'VYASA-N | NIVARAN'
    - VYASA_AI -> 'VYASA-N | VYASA AI'
    - VYASA_CORE / CORE -> 'VYASA-N | CORE'
    - Future / Unknown -> 'VYASA-N | [PILLAR]' (never defaulting to CORE)
    """
    assert registry.get_display_name("NIVARAN") == "VYASA-N | NIVARAN"
    assert registry.get_display_name("nivaran") == "VYASA-N | NIVARAN"
    assert registry.get_display_name("VYASA_AI") == "VYASA-N | VYASA AI"
    assert registry.get_display_name("VYASA_CORE") == "VYASA-N | CORE"
    assert registry.get_display_name("CORE") == "VYASA-N | CORE"
    assert registry.get_display_name("EXAM_CELL") == "VYASA-N | EXAM_CELL"
    assert registry.get_display_name("FUTURE_RESEARCH") == "VYASA-N | FUTURE_RESEARCH"
    # None/empty fallback
    assert registry.get_display_name(None) == "VYASA-N"
    assert registry.get_display_name("") == "VYASA-N"


def test_registry_event_pillar_resolution():
    """
    Verifies that the registry accurately resolves business event ownership:
    - Grievance events -> 'NIVARAN'
    - VYASA AI events -> 'VYASA_AI'
    - Platform events -> 'VYASA_CORE'
    - Unknown events with explicit pillar -> preserved as explicit pillar
    """
    # Grievance events
    assert registry.resolve_pillar_for_event("authority.case_assigned") == "NIVARAN"
    assert registry.resolve_pillar_for_event("grievance.submitted") == "NIVARAN"
    assert registry.resolve_pillar_for_event("grievance.document_requested") == "NIVARAN"
    assert registry.resolve_pillar_for_event("grievance.resolved") == "NIVARAN"
    assert registry.resolve_pillar_for_event("manager.feedback_received") == "NIVARAN"
    assert registry.resolve_pillar_for_event("grievance.closed") == "NIVARAN"
    assert registry.resolve_pillar_for_event("authority.escalated") == "NIVARAN"
    assert registry.resolve_pillar_for_event("committee.formation_requested") == "NIVARAN"

    # VYASA AI events
    assert registry.resolve_pillar_for_event("inquiry.answered") == "VYASA_AI"
    assert registry.resolve_pillar_for_event("guideline.updated") == "VYASA_AI"

    # Genuine platform core events
    assert registry.resolve_pillar_for_event("platform.onboarding") == "VYASA_CORE"
    assert registry.resolve_pillar_for_event("platform.announcement") == "VYASA_CORE"

    # Unknown events with explicit future pillar
    assert registry.resolve_pillar_for_event("defense.scheduled", explicit_pillar="EXAM_CELL") == "EXAM_CELL"
    assert registry.resolve_pillar_for_event("custom.alert", explicit_pillar="ADMISSIONS") == "ADMISSIONS"


def test_new_grievance_assigned_displays_nivaran(db, test_user):
    """
    Criterion 1: 'New Grievance Assigned' displays 'VYASA-N | NIVARAN'.
    """
    event = NotificationEventPayload(
        source_pillar="NIVARAN",
        event_type="authority.case_assigned",
        event_id=f"test_asgn_{uuid.uuid4().hex[:8]}",
        entity_type="grievance",
        entity_id="GRV-TEST-001",
        title="New Case Lodged — GRV-TEST-001",
        message="A new case has been assigned to your jurisdiction.",
        recipient_user_ids=[test_user.id],
    )
    created = notification_engine.process_event(db, event)
    db.commit()

    assert len(created) >= 1
    notif = created[0]
    assert notif.source_pillar == "NIVARAN"

    read_schema = NotificationRead.model_validate(notif)
    assert read_schema.source_pillar == "NIVARAN"
    assert read_schema.source_display_name == "VYASA-N | NIVARAN"


def test_all_grievance_lifecycle_events_display_nivaran(db, test_user):
    """
    Criterion 2: Document requests, resolutions, feedback, closures, and committee events
    display the NIVARAN identity.
    """
    events_to_test = [
        ("grievance.document_requested", "Action Required: Additional Information Requested"),
        ("grievance.resolved", "Grievance Resolved — GRV-TEST-002"),
        ("manager.feedback_received", "Applicant Feedback Received — GRV-TEST-002"),
        ("grievance.closed", "Grievance Formally Closed — GRV-TEST-002"),
        ("authority.escalated", "Priority Escalation: Case GRV-TEST-002"),
        ("committee.formation_requested", "Committee Formation Requested — GRV-TEST-002"),
    ]

    for evt_type, title in events_to_test:
        event = NotificationEventPayload(
            source_pillar="NIVARAN",
            event_type=evt_type,
            event_id=f"test_evt_{uuid.uuid4().hex[:8]}",
            entity_type="grievance",
            entity_id="GRV-TEST-002",
            title=title,
            message=f"Lifecycle notification test for {evt_type}",
            recipient_user_ids=[test_user.id],
        )
        created = notification_engine.process_event(db, event)
        db.commit()

        assert len(created) >= 1
        notif = created[0]
        assert notif.source_pillar == "NIVARAN", f"Event {evt_type} stored wrong pillar {notif.source_pillar}"

        schema = NotificationRead.model_validate(notif)
        assert schema.source_pillar == "NIVARAN"
        assert schema.source_display_name == "VYASA-N | NIVARAN", f"Event {evt_type} gave wrong display name {schema.source_display_name}"


def test_platform_wide_announcements_display_core(db, test_user):
    """
    Criterion 3: Genuine platform-wide announcements continue to display 'VYASA-N | CORE'.
    """
    event = NotificationEventPayload(
        source_pillar="VYASA_CORE",
        event_type="platform.announcement",
        event_id=f"test_core_{uuid.uuid4().hex[:8]}",
        entity_type="platform",
        entity_id="SYS-2026",
        title="Scheduled System Maintenance",
        message="Central VYASA services will undergo brief routine updates tonight.",
        recipient_user_ids=[test_user.id],
    )
    created = notification_engine.process_event(db, event)
    db.commit()

    assert len(created) >= 1
    notif = created[0]
    assert notif.source_pillar == "VYASA_CORE"

    schema = NotificationRead.model_validate(notif)
    assert schema.source_pillar == "VYASA_CORE"
    assert schema.source_display_name == "VYASA-N | CORE"


def test_other_pillars_retain_their_own_identities(db, test_user):
    """
    Criterion 4: Notifications from other pillars (e.g. VYASA_AI, future pillars)
    retain their registered identities.
    """
    # 1. VYASA_AI Pillar
    ai_event = NotificationEventPayload(
        source_pillar="VYASA_AI",
        event_type="inquiry.answered",
        event_id=f"test_ai_{uuid.uuid4().hex[:8]}",
        entity_type="inquiry",
        entity_id="INQ-001",
        title="VYASA AI Response: Ph.D. Admission Ordinance",
        message="Your doctoral regulations query has been processed.",
        recipient_user_ids=[test_user.id],
    )
    created_ai = notification_engine.process_event(db, ai_event)
    db.commit()
    schema_ai = NotificationRead.model_validate(created_ai[0])
    assert schema_ai.source_pillar == "VYASA_AI"
    assert schema_ai.source_display_name == "VYASA-N | VYASA AI"

    # 2. Future pillar (e.g. SAMHITAS_ARCHIVE)
    custom_event = NotificationEventPayload(
        source_pillar="SAMHITAS_ARCHIVE",
        event_type="archive.manuscript_digitized",
        event_id=f"test_cust_{uuid.uuid4().hex[:8]}",
        entity_type="manuscript",
        entity_id="MS-902",
        title="Rare Manuscript Digitized",
        message="New Vedic manuscript scan is now available in the archive.",
        recipient_user_ids=[test_user.id],
    )
    created_cust = notification_engine.process_event(db, custom_event)
    db.commit()
    schema_cust = NotificationRead.model_validate(created_cust[0])
    assert schema_cust.source_pillar == "SAMHITAS_ARCHIVE"
    assert schema_cust.source_display_name == "VYASA-N | SAMHITAS_ARCHIVE"


def test_existing_notifications_preserve_integrity_and_event_association(db):
    """
    Criterion 5: Existing notifications preserve their recipient, timestamp, read/unread state,
    and event association.
    """
    # Query backfilled records
    records = db.scalars(
        select(Notification).where(Notification.source_pillar == "NIVARAN").limit(20)
    ).all()
    assert len(records) > 0, "Expected backfilled records in database"

    for r in records:
        assert r.source_pillar == "NIVARAN"
        assert r.user_id is not None
        assert r.created_at is not None
        assert r.is_read in {True, False}
        assert r.event_type is not None

        # Schema output test
        read_obj = NotificationRead.model_validate(r)
        assert read_obj.source_display_name == "VYASA-N | NIVARAN"


def test_unknown_source_identifiers_handled_safely_without_defaulting_to_core():
    """
    Criterion 6: Unknown or unregistered source identifiers are handled safely
    without silently mislabelling them as CORE.
    """
    unknown_schema = NotificationRead(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        source_pillar="NON_EXISTENT_SUBMODULE",
        title="Unregistered Module Event",
        message="Message from unknown subsystem",
        type="info",
        is_read=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    # MUST NOT be silently converted to 'VYASA-N | CORE'
    assert unknown_schema.source_display_name == "VYASA-N | NON_EXISTENT_SUBMODULE"
    assert unknown_schema.source_display_name != "VYASA-N | CORE"
