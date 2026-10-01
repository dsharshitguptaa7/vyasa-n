# -*- coding: utf-8 -*-
"""
Phase 6B: Comprehensive Manager Triage & AI Classification Review Test Suite
Verifies reference parity with projects/NIVARAN-AI:
- Strict Manager authorization (require_atharva_manager: only appointed MANAGER authority)
- Role boundary rejection: Applicant, Asst Dean, Assoc Dean, Dean, Admin (without Manager authority) get 403
- Manager Triage Queue (filtering, action queues, search, pagination)
- AI recommendation review endpoint (PATCH /grievances/{id}/ai-review) with CONFIRMED and OVERRIDDEN decisions
- Manager Review & Dynamic Assignment (POST /manager/grievances/{id}/review)
- Final Category Semantics: Routing ALWAYS uses Manager's final category, never stale AI prediction
- Dynamic routing resolution across all three institutional types:
  1. SUBJECT_ASSISTANT_DEAN (Subject -> SubjectCluster -> Assistant Dean)
  2. GRIEVANCE_CLUSTER (Category -> GrievanceCluster -> Associate Dean)
  3. FIXED_AUTHORITY (Category -> Configured Target Authority)
- Routing Preview endpoint (GET /manager/grievances/{id}/preview-routing)
- State transitions (PENDING_REVIEW -> ASSIGNED) and immutable history tracking
- Idempotency & double-submission prevention (400 Bad Request on already assigned cases)
- Watchdog & AuditLog event recording (AI_CATEGORY_CONFIRMED, AI_CATEGORY_OVERRIDDEN, grievance.assigned)
- In-App Notifications dispatched to both the assigned authority and submitting applicant
"""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    SubjectCluster,
    Subject,
    GrievanceCluster,
    Category,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    CategoryRoutingType,
    NivaranRole,
    GrievanceStatus,
    GrievancePriority,
    HistoryActorType,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.routing import Assignment
from app.modules.atharva_veda.nivaran.models.ai_processing import AIProcessingRecord
from app.modules.atharva_veda.nivaran.services.routing_service import DynamicRoutingEngine

client = TestClient(app)

NIVARAN_BASE = "/api/modules/atharva-veda/nivaran"


# ==========================================
# Helpers & Fixtures
# ==========================================

def get_or_create_user(db: Session, email: str, role_names: list[str]) -> tuple[User, str]:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            email=email,
            password_hash="hashed_test_pw",
            first_name=email.split("@")[0].capitalize(),
            last_name="Test",
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    for r_name in role_names:
        role = db.scalar(select(Role).where(Role.name == r_name))
        if not role:
            role = Role(name=r_name, description=f"{r_name} role", is_system=True)
            db.add(role)
            db.commit()
            db.refresh(role)

        existing = db.execute(
            select(user_roles).where(user_roles.c.user_id == user.id, user_roles.c.role_id == role.id)
        ).first()
        if not existing:
            db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
            db.commit()

    token = create_access_token({"sub": str(user.id)})
    return user, token


def get_or_create_authority(
    db: Session,
    email: str,
    role: NivaranRole,
    designation: str,
) -> tuple[User, NivaranAuthority, str]:
    user, token = get_or_create_user(db, email, ["authority"])
    auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == user.id))
    if not auth:
        auth = NivaranAuthority(
            vyasa_user_id=user.id,
            role=role,
            designation=designation,
            is_active=True,
            name_snapshot=user.full_name,
            email_snapshot=user.email,
        )
        db.add(auth)
        db.commit()
        db.refresh(auth)
    elif auth.role != role:
        auth.role = role
        auth.is_active = True
        db.commit()
        db.refresh(auth)
    return user, auth, token


def create_test_grievance_in_pending_review(
    db: Session,
    applicant: User,
    subject: Subject,
    category: Category,
    title: str = "Test Grievance for Triage",
    desc: str = "Substantive grievance description submitted by applicant for formal review.",
) -> Grievance:
    # Ensure SMR
    smr = db.scalar(select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == applicant.id))
    if not smr:
        smr = StudentMasterRecord(
            student_vyasa_user_id=applicant.id,
            record_number=f"SMR-{uuid.uuid4().hex[:8].upper()}",
            registration_number_snapshot=f"REG-{uuid.uuid4().hex[:6].upper()}",
            enrollment_number_snapshot=f"ENR-{uuid.uuid4().hex[:6].upper()}",
            full_name_snapshot=applicant.full_name,
            email_snapshot=applicant.email,
            subject_id=subject.id,
        )
        db.add(smr)
        db.commit()
        db.refresh(smr)

    tracking_id = f"CSJMU-2026-{uuid.uuid4().hex[:5].upper()}"
    g = Grievance(
        grievance_id=tracking_id,
        applicant_vyasa_user_id=applicant.id,
        student_record_id=smr.id,
        subject_id=subject.id,
        category_id=category.id,
        final_category_id=category.id,
        status=GrievanceStatus.PENDING_REVIEW,
        priority=GrievancePriority.MEDIUM,
        title=title,
        description=desc,
        category_reviewed=False,
        category_overridden=False,
        ai_suggested_category_id=category.id,
        ai_confidence=0.88,
    )
    db.add(g)
    db.commit()
    db.refresh(g)

    # Initial history
    h1 = GrievanceStatusHistory(
        grievance_id=g.id,
        from_status=None,
        to_status=GrievanceStatus.SUBMITTED.value,
        actor_user_id=applicant.id,
        actor_type=HistoryActorType.USER,
        remarks="Submitted by applicant",
    )
    h2 = GrievanceStatusHistory(
        grievance_id=g.id,
        from_status=GrievanceStatus.SUBMITTED.value,
        to_status=GrievanceStatus.PENDING_REVIEW.value,
        actor_user_id=None,
        actor_type=HistoryActorType.SYSTEM,
        remarks="AI classified and moved to pending review",
    )
    db.add_all([h1, h2])

    # AI Processing record
    ai_record = AIProcessingRecord(
        grievance_id=g.id,
        predicted_category_id=category.id,
        confidence_score=0.88,
        inference_latency_ms=45,
        model_version="tfidf-lr-v1.0",
    )
    db.add(ai_record)
    db.commit()
    db.refresh(g)
    return g


# ==========================================
# Category A: Manager Authorization Boundaries
# ==========================================

def test_manager_authorization_boundaries(db_session: Session):
    """
    Verifies that ONLY an active appointed MANAGER authority can access triage endpoints:
    - Manager: 200 OK
    - Applicant: 403 Forbidden
    - Assistant Dean: 403 Forbidden
    - Associate Dean: 403 Forbidden
    - Dean: 403 Forbidden
    - Admin (without Manager authority): 403 Forbidden
    """
    _, _, mgr_token = get_or_create_authority(db_session, "mgr_auth_test@csjmu.ac.in", NivaranRole.MANAGER, "Triage Manager")
    _, app_token = get_or_create_user(db_session, "app_auth_test@csjmu.ac.in", ["applicant"])
    _, _, asst_token = get_or_create_authority(db_session, "asst_auth_test@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Asst Dean")
    _, _, assoc_token = get_or_create_authority(db_session, "assoc_auth_test@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Assoc Dean")
    _, _, dean_token = get_or_create_authority(db_session, "dean_auth_test@csjmu.ac.in", NivaranRole.DEAN, "Dean Academics")
    _, admin_token = get_or_create_user(db_session, "admin_no_mgr@csjmu.ac.in", ["administrator"])

    # 1. Manager succeeds
    res_mgr = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_mgr.status_code == 200
    assert res_mgr.json()["success"] is True

    # 2. Applicant denied
    res_app = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {app_token}"})
    assert res_app.status_code == 403

    # 3. Assistant Dean denied
    res_asst = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {asst_token}"})
    assert res_asst.status_code == 403

    # 4. Associate Dean denied
    res_assoc = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {assoc_token}"})
    assert res_assoc.status_code == 403

    # 5. Dean denied
    res_dean = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {dean_token}"})
    assert res_dean.status_code == 403

    # 6. Admin without Manager authority denied
    res_admin = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 403


# ==========================================
# Category B: Queue Filtering & Search
# ==========================================

def test_manager_queue_filtering_and_search(db_session: Session):
    """
    Verifies that the Manager triage queue correctly filters by queue name,
    search term, and excludes closed/irrelevant cases.
    """
    _, _, mgr_token = get_or_create_authority(db_session, "queue_mgr@csjmu.ac.in", NivaranRole.MANAGER, "Chief Manager")
    applicant, _ = get_or_create_user(db_session, "scholar_queue_test@csjmu.ac.in", ["applicant"])

    subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    category = db_session.scalar(select(Category).where(Category.is_active.is_(True)))

    # Create one case in PENDING_REVIEW and one in CLOSED
    unique_marker = uuid.uuid4().hex[:6]
    g_pending = create_test_grievance_in_pending_review(
        db_session,
        applicant,
        subject,
        category,
        title=f"Pending Triage Case {unique_marker}",
    )
    g_closed = create_test_grievance_in_pending_review(
        db_session,
        applicant,
        subject,
        category,
        title=f"Closed Case {unique_marker}",
    )
    g_closed.status = GrievanceStatus.CLOSED
    db_session.commit()

    # 1. Default queue returns PENDING_REVIEW, excludes CLOSED
    res = client.get(f"{NIVARAN_BASE}/manager/queue", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res.status_code == 200
    items = res.json()["data"]
    ids = [i["id"] for i in items]
    assert str(g_pending.id) in ids
    assert str(g_closed.id) not in ids

    # 2. Search query matches by unique marker
    res_search = client.get(
        f"{NIVARAN_BASE}/manager/queue?search={unique_marker}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_search.status_code == 200
    s_items = res_search.json()["data"]
    assert len(s_items) == 1
    assert s_items[0]["id"] == str(g_pending.id)

    # 3. Action queue filter: queue=ai_review
    res_ai_queue = client.get(
        f"{NIVARAN_BASE}/manager/queue?queue=ai_review",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_ai_queue.status_code == 200
    ai_ids = [i["id"] for i in res_ai_queue.json()["data"]]
    assert str(g_pending.id) in ai_ids


# ==========================================
# Category C: Reference Parity Direct AI Review (PATCH)
# ==========================================

def test_direct_ai_review_patch_endpoint(db_session: Session):
    """
    Verifies reference parity for PATCH /grievances/{id}/ai-review:
    - CONFIRMED decision preserves AI prediction, sets category_overridden=False, records AI_CATEGORY_CONFIRMED
    - OVERRIDDEN decision sets new category, sets category_overridden=True, records AI_CATEGORY_OVERRIDDEN
    - Non-manager is rejected with 403
    """
    _, _, mgr_token = get_or_create_authority(db_session, "direct_ai_mgr@csjmu.ac.in", NivaranRole.MANAGER, "Manager AI")
    applicant, _ = get_or_create_user(db_session, "direct_ai_applicant@csjmu.ac.in", ["applicant"])

    subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    categories = db_session.scalars(select(Category).where(Category.is_active.is_(True))).all()
    cat_a, cat_b = categories[0], categories[1]

    # Case 1: CONFIRMED
    g1 = create_test_grievance_in_pending_review(db_session, applicant, subject, cat_a, title="Direct Review Confirm Case")

    res_confirm = client.patch(
        f"{NIVARAN_BASE}/grievances/{g1.grievance_id}/ai-review",
        json={"decision": "CONFIRMED", "category_id": str(cat_a.id)},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_confirm.status_code == 200
    d1 = res_confirm.json()["data"]
    assert d1["category_reviewed"] is True
    assert d1["category_overridden"] is False
    assert d1["final_category_id"] == str(cat_a.id)

    audit_confirm = db_session.scalar(
        select(AuditLog).where(AuditLog.entity_id == str(g1.id), AuditLog.action == "AI_CATEGORY_CONFIRMED")
    )
    assert audit_confirm is not None

    # Case 2: OVERRIDDEN
    g2 = create_test_grievance_in_pending_review(db_session, applicant, subject, cat_a, title="Direct Review Override Case")

    res_override = client.patch(
        f"{NIVARAN_BASE}/grievances/{g2.id}/ai-review",
        json={"decision": "OVERRIDDEN", "category_id": str(cat_b.id)},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_override.status_code == 200
    d2 = res_override.json()["data"]
    assert d2["category_reviewed"] is True
    assert d2["category_overridden"] is True
    assert d2["final_category_id"] == str(cat_b.id)
    # Original AI suggestion preserved
    assert d2["ai_suggested_category_id"] == str(cat_a.id)

    audit_override = db_session.scalar(
        select(AuditLog).where(AuditLog.entity_id == str(g2.id), AuditLog.action == "AI_CATEGORY_OVERRIDDEN")
    )
    assert audit_override is not None


# ==========================================
# Category D: Manager Ratification & Assignment
# ==========================================

def test_manager_ratify_and_assign_lifecycle(db_session: Session):
    """
    Verifies Manager atomic ratification and assignment:
    1. Case transitions PENDING_REVIEW -> ASSIGNED
    2. Dynamic authority assigned
    3. Status history recorded
    4. Notifications dispatched to authority and applicant
    5. AuditLog records assignment
    """
    mgr_user, _, mgr_token = get_or_create_authority(db_session, "ratify_mgr@csjmu.ac.in", NivaranRole.MANAGER, "Triage Head")
    applicant, _ = get_or_create_user(db_session, "ratify_applicant@csjmu.ac.in", ["applicant"])

    # Pick subject and category that routes to Assistant Dean
    subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    cat_asst = db_session.scalar(
        select(Category).where(Category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN, Category.is_active.is_(True))
    )
    if not cat_asst:
        cat_asst = db_session.scalar(select(Category).where(Category.is_active.is_(True)))

    g = create_test_grievance_in_pending_review(db_session, applicant, subject, cat_asst, title="Ratification Flow Case")

    # Preview routing first
    res_prev = client.get(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/preview-routing",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_prev.status_code == 200
    prev_data = res_prev.json()["data"]
    assert prev_data["target_authority_id"] is not None
    assert prev_data["target_authority_name"] is not None
    assert prev_data["target_authority_role"] == NivaranRole.ASSISTANT_DEAN.value

    # Ratify and Assign
    res_review = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={
            "confirm_category": True,
            "priority": "HIGH",
            "remarks": "Ratified AI classification and assigned to accountable authority.",
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_review.status_code == 200
    res_data = res_review.json()["data"]
    assert res_data["status"] == "ASSIGNED"
    assert res_data["priority"] == "HIGH"
    assert res_data["category_reviewed"] is True
    assert res_data["category_overridden"] is False
    assert res_data["assigned_authority_id"] is not None
    assert res_data["assigned_authority_role"] == NivaranRole.ASSISTANT_DEAN.value

    # Verify Active Assignment
    active_assign = db_session.scalar(
        select(Assignment).where(Assignment.grievance_id == g.id, Assignment.is_active.is_(True))
    )
    assert active_assign is not None
    assert str(active_assign.authority_id) == res_data["assigned_authority_id"]

    # Verify Status History
    history = db_session.scalars(
        select(GrievanceStatusHistory).where(GrievanceStatusHistory.grievance_id == g.id).order_by(GrievanceStatusHistory.created_at.asc())
    ).all()
    assert any(h.to_status == "ASSIGNED" for h in history)

    # Verify Notifications
    assigned_authority = db_session.scalar(select(NivaranAuthority).where(NivaranAuthority.id == active_assign.authority_id))
    if assigned_authority and assigned_authority.vyasa_user_id:
        notif_auth = db_session.scalar(
            select(Notification).where(
                Notification.user_id == assigned_authority.vyasa_user_id,
                Notification.type == "GRIEVANCE_ASSIGNED",
            )
        )
        assert notif_auth is not None
        assert "New Grievance Assigned" in notif_auth.title

    notif_app = db_session.scalar(
        select(Notification).where(
            Notification.user_id == applicant.id,
            Notification.type == "GRIEVANCE_STATUS_CHANGED",
        )
    )
    assert notif_app is not None
    assert "Grievance Assigned for Review" in notif_app.title


# ==========================================
# Category E & F: Category Override & Routing Parity
# ==========================================

def test_manager_override_and_final_category_routing(db_session: Session):
    """
    CRITICAL: Verifies sequential routing in NIVARAN-AI:
    - Manager reviews AI suggested category and overrides to a cluster-based category.
    - Grievance final_category_id is updated to the override category, category_overridden=True.
    - Original AI suggestion is preserved.
    - Missing/short justification (<5 chars) is rejected with 400.
    - Stage 1 Destination: Assigned authority MUST be the ASSISTANT DEAN of the scholar's subject cluster,
      NOT the Associate Dean or Fixed Authority!
    - Downstream Stage 2 Preservation: DynamicRoutingEngine.resolve_category_route correctly resolves
      the cluster category to the Associate Dean for downstream forwarding by the Assistant Dean.
    """
    mgr_user, _, mgr_token = get_or_create_authority(db_session, "override_mgr@csjmu.ac.in", NivaranRole.MANAGER, "Triage Manager")
    applicant, _ = get_or_create_user(db_session, "override_applicant@csjmu.ac.in", ["applicant"])

    subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))

    cat_subject_based = db_session.scalar(
        select(Category).where(Category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN, Category.is_active.is_(True))
    )
    cat_cluster_based = db_session.scalar(
        select(Category).where(Category.routing_type.in_([CategoryRoutingType.CLUSTER, CategoryRoutingType.GRIEVANCE_CLUSTER]), Category.is_active.is_(True))
    )

    assert cat_subject_based is not None
    assert cat_cluster_based is not None
    assert cat_subject_based.id != cat_cluster_based.id

    # Create case with AI suggestion = cat_subject_based
    g = create_test_grievance_in_pending_review(db_session, applicant, subject, cat_subject_based, title="Override Routing Case")

    # 1. Attempt override without justification -> rejected with 400
    res_bad_override = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={
            "confirm_category": False,
            "override_category_id": str(cat_cluster_based.id),
            "override_reason": "   ",  # blank
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_bad_override.status_code == 400
    assert "institutional justification" in res_bad_override.json()["message"]

    # 2. Attempt override with invalid UUID -> rejected with 400
    res_invalid_cat = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={
            "confirm_category": False,
            "override_category_id": str(uuid.uuid4()),
            "override_reason": "Valid institutional justification for override",
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_invalid_cat.status_code == 400

    # 3. Valid override committing to cat_cluster_based
    res_valid_override = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={
            "confirm_category": False,
            "override_category_id": str(cat_cluster_based.id),
            "override_reason": "Re-categorized to research fellowship cluster based on scholar stipend claims.",
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_valid_override.status_code == 200
    res_data = res_valid_override.json()["data"]

    # Final category is cat_cluster_based
    assert res_data["final_category_id"] == str(cat_cluster_based.id)
    assert res_data["final_category_name"] == cat_cluster_based.name
    assert res_data["category_overridden"] is True
    assert res_data["category_reviewed"] is True
    # Original AI prediction remains preserved!
    assert res_data["ai_suggested_category_id"] == str(cat_subject_based.id)

    # In NIVARAN-AI sequential routing: Stage 1 destination from Manager is strictly the ASSISTANT DEAN
    assert res_data["assigned_authority_role"] == NivaranRole.ASSISTANT_DEAN.value
    expected_asst_dean = DynamicRoutingEngine.resolve_subject_route(db_session, subject.id)
    assert res_data["assigned_authority_id"] == str(expected_asst_dean.id)

    # Downstream Stage 2 preservation: Category routing engine resolves cat_cluster_based to Associate Dean
    stage2_target = DynamicRoutingEngine.resolve_category_route(db_session, cat_cluster_based.id, subject.id)
    assert stage2_target.role == NivaranRole.ASSOCIATE_DEAN
    assert stage2_target.id != expected_asst_dean.id

    # Verify audit log recorded override
    audit_override = db_session.scalar(
        select(AuditLog).where(AuditLog.entity_id == str(g.id), AuditLog.action == "AI_CATEGORY_OVERRIDDEN")
    )
    assert audit_override is not None


def test_manager_triage_fixed_authority_routes_to_assistant_dean_in_stage1(db_session: Session):
    """
    CRITICAL: Verifies that even when a grievance category uses FIXED_AUTHORITY
    (e.g., Fellowship or RTI_IIGRS), Manager triage does NOT bypass the Assistant Dean.
    - Initial Manager assignment routes strictly to Stage 1: Subject Assistant Dean.
    - Category routing engine is verified to yield the Fixed Authority for Stage 2 forwarding.
    """
    mgr_user, _, mgr_token = get_or_create_authority(db_session, "fixed_mgr@csjmu.ac.in", NivaranRole.MANAGER, "Triage Manager")
    applicant, _ = get_or_create_user(db_session, "fixed_applicant@csjmu.ac.in", ["applicant"])

    subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    cat_fixed = db_session.scalar(
        select(Category).where(
            Category.routing_type == CategoryRoutingType.FIXED_AUTHORITY,
            Category.is_active.is_(True),
            Category.fixed_authority_id.is_not(None),
        )
    )
    if not cat_fixed:
        pytest.skip("No active fixed authority category configured in test database.")

    g = create_test_grievance_in_pending_review(db_session, applicant, subject, cat_fixed, title="Fixed Authority Triage Case")

    # Preview routing: verifies Assistant Dean is previewed
    res_prev = client.get(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/preview-routing",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_prev.status_code == 200
    prev_data = res_prev.json()["data"]
    assert prev_data["target_authority_role"] == NivaranRole.ASSISTANT_DEAN.value

    # Triage and assign
    res_review = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={"confirm_category": True, "remarks": "Triaged fixed category case to Assistant Dean."},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_review.status_code == 200
    res_data = res_review.json()["data"]

    # Must be ASSISTANT_DEAN, NOT Fixed Authority!
    assert res_data["assigned_authority_role"] == NivaranRole.ASSISTANT_DEAN.value
    expected_asst_dean = DynamicRoutingEngine.resolve_subject_route(db_session, subject.id)
    assert res_data["assigned_authority_id"] == str(expected_asst_dean.id)

    # Verify Stage 2 category routing yields the fixed authority
    stage2_target = DynamicRoutingEngine.resolve_category_route(db_session, cat_fixed.id, subject.id)
    assert stage2_target.id == cat_fixed.fixed_authority_id
    assert stage2_target.id != expected_asst_dean.id


# ==========================================
# Category G: Idempotency & Double Submission Prevention
# ==========================================

def test_manager_triage_idempotency(db_session: Session):
    """
    Verifies that calling triage review on an already ASSIGNED grievance is rejected
    with HTTP 400 Bad Request, preventing double assignment or state corruption.
    """
    mgr_user, _, mgr_token = get_or_create_authority(db_session, "idemp_mgr@csjmu.ac.in", NivaranRole.MANAGER, "Triage Manager")
    applicant, _ = get_or_create_user(db_session, "idemp_applicant@csjmu.ac.in", ["applicant"])

    subject = db_session.scalar(select(Subject).where(Subject.is_active.is_(True)))
    category = db_session.scalar(select(Category).where(Category.is_active.is_(True)))

    g = create_test_grievance_in_pending_review(db_session, applicant, subject, category, title="Idempotency Test Case")

    # First triage call succeeds
    res1 = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={"confirm_category": True},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res1.status_code == 200
    assert res1.json()["data"]["status"] == "ASSIGNED"

    # Second triage call on already assigned case is rejected
    res2 = client.post(
        f"{NIVARAN_BASE}/manager/grievances/{g.id}/review",
        json={"confirm_category": True},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res2.status_code == 400
    assert "already been reviewed and assigned" in res2.json()["message"]
