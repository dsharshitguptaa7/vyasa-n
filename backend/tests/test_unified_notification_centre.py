import uuid
import pytest
from app.models.user import User
from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationDelivery,
)
from app.services.notifications.engine import engine as notification_engine
from app.services.notifications.registry import registry
from app.services.notifications.contracts import (
    EventDefinition,
    TemplateDefinition,
    NotificationPriority,
)
from app.schemas.notification import NotificationEventPayload


def test_unified_notification_flow(client, db_session):
    # 1. Setup test users
    uid_str = uuid.uuid4().hex[:8]
    scholar = User(
        email=f"scholar_{uid_str}@csjmu.ac.in",
        password_hash="fakehash",
        first_name="Scholar",
        last_name="One",
    )
    manager = User(
        email=f"manager_{uid_str}@csjmu.ac.in",
        password_hash="fakehash",
        first_name="Manager",
        last_name="One",
    )
    db_session.add_all([scholar, manager])
    db_session.commit()

    # 2. Ingest NIVARAN event via Event Producer Endpoint
    event_payload = {
        "event_id": f"evt_submit_{uid_str}",
        "source_pillar": "NIVARAN",
        "event_type": "grievance.submitted",
        "entity_type": "grievance",
        "entity_id": f"CSJMU-2026-{uid_str}",
        "recipient_user_ids": [str(scholar.id)],
        "metadata": {
            "grievance_id": f"CSJMU-2026-{uid_str}",
            "title": "Stipend Delay Inquiry",
            "grievance_uuid": str(uuid.uuid4()),
        },
    }

    res = client.post("/api/notifications/events", json=event_payload)
    assert res.status_code == 201
    body = res.json()
    assert body["success"] is True
    assert len(body["data"]) == 1
    notif = body["data"][0]
    assert notif["source_pillar"] == "NIVARAN"
    assert notif["event_type"] == "grievance.submitted"
    assert notif["event_id"] == f"evt_submit_{uid_str}"
    assert "CSJMU-2026-" in notif["title"]
    assert notif["is_read"] is False
    assert notif["action_required"] is False
    notif_id = notif["id"]

    # 3. Test Idempotency: re-sending the same event_id must not create a duplicate
    res_retry = client.post("/api/notifications/events", json=event_payload)
    assert res_retry.status_code == 201
    retry_body = res_retry.json()
    assert len(retry_body["data"]) == 1
    assert retry_body["data"][0]["id"] == notif_id

    # 4. Ingest Action Required document request event
    doc_req_event = {
        "event_id": f"evt_doc_{uid_str}",
        "source_pillar": "NIVARAN",
        "event_type": "grievance.document_requested",
        "entity_type": "grievance",
        "entity_id": f"CSJMU-2026-{uid_str}",
        "recipient_user_ids": [str(scholar.id)],
        "metadata": {
            "grievance_id": f"CSJMU-2026-{uid_str}",
            "grievance_uuid": str(uuid.uuid4()),
        },
    }
    res_doc = client.post("/api/notifications/events", json=doc_req_event)
    assert res_doc.status_code == 201
    doc_notif = res_doc.json()["data"][0]
    assert doc_notif["action_required"] is True
    assert doc_notif["priority"] == "HIGH"

    # 5. List notifications with filters
    # A: All notifications for scholar
    res_list = client.get(f"/api/notifications?user_id={scholar.id}")
    assert res_list.status_code == 200
    list_data = res_list.json()["data"]
    assert list_data["count"] == 2
    assert list_data["unread_count"] == 2
    assert list_data["action_required_count"] == 1

    # B: Filter by Action Required
    res_act = client.get(f"/api/notifications?user_id={scholar.id}&action_required=true")
    assert res_act.status_code == 200
    assert len(res_act.json()["data"]["notifications"]) == 1
    assert res_act.json()["data"]["notifications"][0]["event_type"] == "grievance.document_requested"

    # C: Filter by Pillar
    res_pil = client.get(f"/api/notifications?user_id={scholar.id}&source_pillar=NIVARAN")
    assert res_pil.status_code == 200
    assert len(res_pil.json()["data"]["notifications"]) == 2

    # 6. Summary endpoint
    res_summary = client.get(f"/api/notifications/summary?user_id={scholar.id}")
    assert res_summary.status_code == 200
    sum_data = res_summary.json()["data"]
    assert sum_data["unread_count"] == 2
    assert sum_data["action_required_count"] == 1
    assert sum_data["by_pillar"].get("NIVARAN", 0) == 2

    # 7. Delivery logs created
    deliveries = db_session.query(NotificationDelivery).filter(
        NotificationDelivery.notification_id == uuid.UUID(notif_id)
    ).all()
    assert len(deliveries) >= 1
    channels = [d.channel for d in deliveries]
    assert "IN_APP" in channels

    # 8. Mark one notification as read
    res_read = client.patch(f"/api/notifications/{notif_id}/read?user_id={scholar.id}")
    assert res_read.status_code == 200
    assert res_read.json()["data"]["is_read"] is True

    # 9. Mark all remaining as read
    res_mark_all = client.post(f"/api/notifications/mark-all-read?user_id={scholar.id}")
    assert res_mark_all.status_code == 200
    assert res_mark_all.json()["data"]["updated_count"] == 1

    # Verify unread count is now 0
    res_summary2 = client.get(f"/api/notifications/summary?user_id={scholar.id}")
    assert res_summary2.json()["data"]["unread_count"] == 0

    # 10. Clean up
    db_session.query(NotificationDelivery).filter(
        NotificationDelivery.notification_id.in_([uuid.UUID(notif_id), uuid.UUID(doc_notif["id"])])
    ).delete()
    db_session.query(Notification).filter(Notification.user_id == scholar.id).delete()
    db_session.delete(scholar)
    db_session.delete(manager)
    db_session.commit()


def test_future_pillar_dynamic_registration(client, db_session):
    # Test Section 5: Future pillar can register without hardcoded checks
    test_user = User(
        email=f"future_user_{uuid.uuid4().hex[:8]}@csjmu.ac.in",
        password_hash="pwd",
        first_name="Future",
        last_name="Scholar",
    )
    db_session.add(test_user)
    db_session.commit()

    # Register brand new future pillar
    registry.register_pillar(
        pillar_id="RESEARCH_GRANTS",
        display_name="VYASA-N | Research Grants",
        description="Autonomous grants and fellowship lifecycle",
        events={
            "grant.sanctioned": EventDefinition(
                event_type="grant.sanctioned",
                description="Grant application sanctioned by Academic Council",
                category="workflow",
                template=TemplateDefinition(
                    title_template="Research Grant Approved: {project_title}",
                    body_template="Grant sanction letter #{grant_ref} has been issued for INR {amount}.",
                    action_route_template="/modules/research-grants/{grant_ref}",
                    default_priority=NotificationPriority.HIGH,
                ),
            )
        },
    )

    # Ingest event from this new pillar
    grant_event = {
        "source_pillar": "RESEARCH_GRANTS",
        "event_type": "grant.sanctioned",
        "entity_type": "grant",
        "entity_id": "GR-2026-999",
        "recipient_user_ids": [str(test_user.id)],
        "metadata": {
            "project_title": "Quantum AI Material Synthesis",
            "grant_ref": "CSJMU-GR-999",
            "amount": "1,500,000",
        },
    }

    res = client.post("/api/notifications/events", json=grant_event)
    assert res.status_code == 201
    created = res.json()["data"][0]
    assert created["source_pillar"] == "RESEARCH_GRANTS"
    assert "Quantum AI Material Synthesis" in created["title"]
    assert "INR 1,500,000" in created["message"]
    assert created["action_route"] == "/modules/research-grants/CSJMU-GR-999"

    # Verify pillar listing endpoint returns the registered future pillar
    pil_res = client.get("/api/notifications/pillars")
    assert pil_res.status_code == 200
    pillar_ids = [p["pillar_id"] for p in pil_res.json()["data"]]
    assert "RESEARCH_GRANTS" in pillar_ids

    # Clean up
    db_session.query(NotificationDelivery).filter(
        NotificationDelivery.notification_id == uuid.UUID(created["id"])
    ).delete()
    db_session.query(Notification).filter(Notification.user_id == test_user.id).delete()
    db_session.delete(test_user)
    db_session.commit()


def test_user_notification_preferences(client, db_session):
    test_user = User(
        email=f"pref_user_{uuid.uuid4().hex[:8]}@csjmu.ac.in",
        password_hash="pwd",
        first_name="Pref",
        last_name="User",
    )
    db_session.add(test_user)
    db_session.commit()

    # 1. Update preference to disable email
    put_res = client.put(
        f"/api/notifications/preferences?user_id={test_user.id}",
        json={
            "source_pillar": "NIVARAN",
            "event_type": "*",
            "in_app_enabled": True,
            "email_enabled": False,
        },
    )
    assert put_res.status_code == 200
    assert put_res.json()["data"]["email_enabled"] is False

    # 2. Get preferences
    get_res = client.get(f"/api/notifications/preferences?user_id={test_user.id}")
    assert get_res.status_code == 200
    assert len(get_res.json()["data"]) >= 1

    # 3. Clean up
    db_session.query(NotificationPreference).filter(NotificationPreference.user_id == test_user.id).delete()
    db_session.delete(test_user)
    db_session.commit()
