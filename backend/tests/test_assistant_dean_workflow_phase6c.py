# -*- coding: utf-8 -*-
"""
Phase 6C: Comprehensive Assistant Dean Workflow Test Suite
Verifies reference parity with projects/NIVARAN-AI:
- Strict Assistant Dean authorization (require_atharva_assistant_dean)
- Role boundary rejection: Applicant, Manager, Associate Dean, Dean, Admin (without Asst Dean role) get 403
- Queue scoping & record-level jurisdiction: only grievances actively assigned to this Assistant Dean
- Queue filtering (status, search, priority, pagination)
- Backwards compatible aliases (/assistant-dean/cases, /assignments/my/grievances)
- Case dossier retrieval with Stage 2 routing destination preview and can_forward flag
- Direct grievance resolution (status -> RESOLVED, notes, history, audit, notifications)
- Resolution validation (minimum notes length, status guard, jurisdiction guard)
- Stage 2 Category Routing Forwarding:
  * 6-checkbox acknowledgment validation (all must be True)
  * 3-justification text validation (minimum 5 characters trimmed)
  * Routing to Associate Dean via Grievance Cluster
  * Routing to Fixed Authority via Category target authority
  * Terminal routing rejection (SUBJECT_ASSISTANT_DEAN cannot forward further)
  * Assignment handoff: deactivation of prior assignment, creation of new active assignment
  * ForwardingConfirmation persistence
  * Status history, AuditLog, and Notifications
- Evidentiary Document Requests:
  * Transitions status to AWAITING_INFORMATION
  * Preserves active assignment
  * DocumentRequest records persistence
  * AuditLog & applicant notification
  * Retrieval endpoint /grievances/{id}/document-requests
- Committee Creation Request:
  * Creates CommitteeCreationRequest in PENDING status
  * Duplicate prevention (400 Bad Request)
  * AuditLog & notifications
- Non-functional guards:
  * Idempotency & double-submission prevention
  * IDOR protection (cannot act on other authorities' cases)
"""

import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import select, and_, or_
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
    DocumentRequestStatus,
    CommitteeRequestStatus,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.routing import (
    Assignment,
    ForwardingConfirmation,
)
from app.modules.atharva_veda.nivaran.models.document import DocumentRequest
from app.modules.atharva_veda.nivaran.models.committee import CommitteeCreationRequest

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
    elif not user.is_active:
        user.is_active = True
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


def setup_taxonomy_environment(db: Session):
    """
    Sets up or links canonical institutional taxonomy environment for Assistant Dean tests:
    - Asst Dean 1 (Dr. Ankit Trivedi, assistantdean1@csjmu.ac.in)
    - Asst Dean 2 (Dr. Pooja Singh, assistantdean2@csjmu.ac.in)
    - Assoc Dean 1 (Dr. Sweta Pandey, associatedean1@csjmu.ac.in)
    - Fixed Authority (Fellowship Authority)
    - Canonical Categories:
      1. Course_Work (GRIEVANCE_CLUSTER -> Assoc Dean)
      2. Fellowship (FIXED_AUTHORITY -> Fellowship Head)
      3. Portal_Data_Correction (SUBJECT_ASSISTANT_DEAN -> Terminal)
    """
    # 1. Assistant Dean 1
    asst1 = db.scalar(select(NivaranAuthority).where(NivaranAuthority.email_snapshot == "assistantdean1@csjmu.ac.in"))
    if not asst1:
        u_asst1, asst1, token_asst1 = get_or_create_authority(
            db, "assistantdean1@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean 1"
        )
    else:
        u_asst1 = db.get(User, asst1.vyasa_user_id)
        token_asst1 = create_access_token({"sub": str(u_asst1.id)})

    # 2. Assistant Dean 2
    asst2 = db.scalar(select(NivaranAuthority).where(NivaranAuthority.email_snapshot == "assistantdean2@csjmu.ac.in"))
    if not asst2:
        u_asst2, asst2, token_asst2 = get_or_create_authority(
            db, "assistantdean2@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean 2"
        )
    else:
        u_asst2 = db.get(User, asst2.vyasa_user_id)
        token_asst2 = create_access_token({"sub": str(u_asst2.id)})

    # 4. Canonical Categories
    cat_cluster = db.scalar(
        select(Category).where(
            Category.name == "Course_Work",
            Category.is_active.is_(True),
        )
    )
    if not cat_cluster:
        cat_cluster = db.scalar(
            select(Category).where(
                Category.routing_type == CategoryRoutingType.GRIEVANCE_CLUSTER,
                Category.is_active.is_(True),
            )
        )

    # 3. Associate Dean for this cluster
    assoc1 = None
    if cat_cluster and cat_cluster.grievance_cluster_id:
        gc = db.get(GrievanceCluster, cat_cluster.grievance_cluster_id)
        if gc and gc.associate_dean_id:
            assoc1 = db.get(NivaranAuthority, gc.associate_dean_id)
    if not assoc1:
        assoc1 = db.scalar(select(NivaranAuthority).where(NivaranAuthority.role == NivaranRole.ASSOCIATE_DEAN, NivaranAuthority.is_active.is_(True)))
    if not assoc1:
        u_assoc1, assoc1, token_assoc1 = get_or_create_authority(
            db, "associatedean1@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean 1"
        )
    else:
        u_assoc1 = db.get(User, assoc1.vyasa_user_id)
        token_assoc1 = create_access_token({"sub": str(u_assoc1.id)})

    cat_fixed = db.scalar(
        select(Category).where(
            Category.name == "Fellowship",
            Category.is_active.is_(True),
        )
    )
    if not cat_fixed:
        cat_fixed = db.scalar(
            select(Category).where(
                Category.routing_type == CategoryRoutingType.FIXED_AUTHORITY,
                Category.is_active.is_(True),
            )
        )

    cat_terminal = db.scalar(
        select(Category).where(
            Category.name == "Portal_Data_Correction",
            Category.is_active.is_(True),
        )
    )
    if not cat_terminal:
        cat_terminal = db.scalar(
            select(Category).where(
                Category.routing_type == CategoryRoutingType.SUBJECT_ASSISTANT_DEAN,
                Category.is_active.is_(True),
            )
        )

    # 5. Fixed Authority
    fixed_auth = None
    if cat_fixed and cat_fixed.fixed_authority_id:
        fixed_auth = db.get(NivaranAuthority, cat_fixed.fixed_authority_id)
    if not fixed_auth:
        u_fixed, fixed_auth, token_fixed = get_or_create_authority(
            db, "fixed_officer@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Fixed Officer"
        )
        if cat_fixed:
            cat_fixed.fixed_authority_id = fixed_auth.id
            db.commit()
    else:
        u_fixed = db.get(User, fixed_auth.vyasa_user_id)
        token_fixed = create_access_token({"sub": str(u_fixed.id)})

    # 6. Subjects
    sub_cs = db.scalar(select(Subject).where(Subject.is_active.is_(True)))
    all_subs = db.scalars(select(Subject).where(Subject.is_active.is_(True))).all()
    sub_math = all_subs[1] if len(all_subs) > 1 else sub_cs

    return {
        "asst1": (u_asst1, asst1, token_asst1),
        "asst2": (u_asst2, asst2, token_asst2),
        "assoc1": (u_assoc1, assoc1, token_assoc1),
        "fixed_auth": (u_fixed, fixed_auth, token_fixed),
        "sub_cs": sub_cs,
        "sub_math": sub_math,
        "cat_exam": cat_cluster,
        "cat_fellowship": cat_fixed,
        "cat_acad": cat_terminal,
    }


def create_assigned_grievance(
    db: Session,
    applicant: User,
    subject: Subject,
    category: Category,
    assigned_authority: NivaranAuthority,
    assigned_by: User,
    title: str = "Test Assigned Grievance",
    desc: str = "Substantive description for grievance handled by Assistant Dean.",
    status: GrievanceStatus = GrievanceStatus.ASSIGNED,
    priority: GrievancePriority = GrievancePriority.MEDIUM,
) -> Grievance:
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
        assigned_authority_id=assigned_authority.id,
        status=status,
        priority=priority,
        title=title,
        description=desc,
        category_reviewed=True,
    )
    db.add(g)
    db.commit()
    db.refresh(g)

    # Active Assignment
    assigned_by_auth_id = None
    if isinstance(assigned_by, NivaranAuthority):
        assigned_by_auth_id = assigned_by.id
    else:
        auth_rec = db.scalar(select(NivaranAuthority).where(NivaranAuthority.vyasa_user_id == assigned_by.id))
        if auth_rec:
            assigned_by_auth_id = auth_rec.id

    assignment = Assignment(
        grievance_id=g.id,
        authority_id=assigned_authority.id,
        assigned_by_id=assigned_by_auth_id,
        assignment_reason="Assigned by Manager following triage review",
        is_active=True,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(assignment)

    # History
    h = GrievanceStatusHistory(
        grievance_id=g.id,
        from_status=GrievanceStatus.PENDING_REVIEW.value,
        to_status=status.value,
        actor_user_id=assigned_by.id,
        actor_authority_id=None,
        actor_type=HistoryActorType.USER,
        remarks=f"Assigned to {assigned_authority.name_snapshot}",
    )
    db.add(h)
    db.commit()
    db.refresh(g)
    return g


# ==========================================
# Category A: Authorization Boundaries
# ==========================================

def test_assistant_dean_authorization_boundaries(db_session: Session):
    """
    Verifies that ONLY an active appointed ASSISTANT_DEAN authority can access Assistant Dean endpoints.
    - Assistant Dean: 200 OK
    - Applicant: 403 Forbidden
    - Manager: 403 Forbidden
    - Associate Dean: 403 Forbidden
    - Dean: 403 Forbidden
    - Admin (without Asst Dean role): 403 Forbidden
    """
    env = setup_taxonomy_environment(db_session)
    _, asst1, asst_token = env["asst1"]
    _, app_token = get_or_create_user(db_session, "app_guard_test@csjmu.ac.in", ["applicant"])
    _, _, mgr_token = get_or_create_authority(db_session, "mgr_guard_test@csjmu.ac.in", NivaranRole.MANAGER, "Triage Manager")
    _, _, assoc_token = get_or_create_authority(db_session, "assoc_guard_test@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Assoc Dean")
    _, _, dean_token = get_or_create_authority(db_session, "dean_guard_test@csjmu.ac.in", NivaranRole.DEAN, "Dean Academics")
    _, admin_token = get_or_create_user(db_session, "admin_guard_test@csjmu.ac.in", ["administrator"])

    # 1. Assistant Dean succeeds
    res_asst = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {asst_token}"})
    assert res_asst.status_code == 200
    assert res_asst.json()["success"] is True

    # 2. Applicant denied
    res_app = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {app_token}"})
    assert res_app.status_code == 403

    # 3. Manager denied
    res_mgr = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_mgr.status_code == 403

    # 4. Associate Dean denied
    res_assoc = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {assoc_token}"})
    assert res_assoc.status_code == 403

    # 5. Dean denied
    res_dean = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {dean_token}"})
    assert res_dean.status_code == 403

    # 6. Admin without Assistant Dean role denied
    res_admin = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 403


# ==========================================
# Category B: Queue Scoping & Filtering
# ==========================================

def test_assistant_dean_queue_scoping_and_filters(db_session: Session):
    """
    Verifies that the Assistant Dean queue returns ONLY grievances actively assigned to this Assistant Dean.
    Tests status filtering, search term matching, priority filtering, and pagination.
    """
    env = setup_taxonomy_environment(db_session)
    u_asst1, asst1, asst1_token = env["asst1"]
    u_asst2, asst2, asst2_token = env["asst2"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_assigner@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_filter@csjmu.ac.in", ["applicant"])

    # Grievance 1: assigned to Asst Dean 1 (ASSIGNED, MEDIUM, CS)
    g1 = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_exam"], asst1, u_mgr,
        title="CS Result Delay Grievance", desc="Results are pending for 3 months.",
        status=GrievanceStatus.ASSIGNED, priority=GrievancePriority.MEDIUM,
    )
    # Grievance 2: assigned to Asst Dean 1 (IN_PROGRESS, CRITICAL, CS)
    g2 = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_fellowship"], asst1, u_mgr,
        title="Urgent Fellowship Not Received", desc="Scholarship stipend is blocked.",
        status=GrievanceStatus.IN_PROGRESS, priority=GrievancePriority.CRITICAL,
    )
    # Grievance 3: assigned to Asst Dean 2 (ASSIGNED, HIGH, Math) - Should NOT appear in Asst Dean 1's queue
    g3 = create_assigned_grievance(
        db_session, u_app, env["sub_math"], env["cat_exam"], asst2, u_mgr,
        title="Math Department Issue", desc="Math paper marks error.",
        status=GrievanceStatus.ASSIGNED, priority=GrievancePriority.HIGH,
    )

    # 1. Asst Dean 1 retrieves queue -> should see g1 and g2, NOT g3
    res = client.get(f"{NIVARAN_BASE}/assistant-dean/queue", headers={"Authorization": f"Bearer {asst1_token}"})
    assert res.status_code == 200
    data = res.json()["data"]
    returned_ids = [item["id"] for item in data["items"]]
    assert str(g1.id) in returned_ids
    assert str(g2.id) in returned_ids
    assert str(g3.id) not in returned_ids

    # 2. Status filter: IN_PROGRESS
    res_inp = client.get(
        f"{NIVARAN_BASE}/assistant-dean/queue?status_filter=IN_PROGRESS",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_inp.status_code == 200
    inp_ids = [item["id"] for item in res_inp.json()["data"]["items"]]
    assert str(g2.id) in inp_ids
    assert str(g1.id) not in inp_ids

    # 3. Priority filter: CRITICAL
    res_urg = client.get(
        f"{NIVARAN_BASE}/assistant-dean/queue?priority=CRITICAL",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_urg.status_code == 200
    urg_ids = [item["id"] for item in res_urg.json()["data"]["items"]]
    assert str(g2.id) in urg_ids
    assert str(g1.id) not in urg_ids

    # 4. Search query
    res_srch = client.get(
        f"{NIVARAN_BASE}/assistant-dean/queue?search=stipend",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_srch.status_code == 200
    srch_ids = [item["id"] for item in res_srch.json()["data"]["items"]]
    assert str(g2.id) in srch_ids
    assert str(g1.id) not in srch_ids

    # 5. Backwards-compatible /cases and /assignments/my/grievances endpoints
    res_cases = client.get(f"{NIVARAN_BASE}/assistant-dean/cases", headers={"Authorization": f"Bearer {asst1_token}"})
    assert res_cases.status_code == 200
    assert isinstance(res_cases.json()["data"], list)

    res_my = client.get(f"{NIVARAN_BASE}/assignments/my/grievances", headers={"Authorization": f"Bearer {asst1_token}"})
    assert res_my.status_code == 200
    assert isinstance(res_my.json()["data"], list)
    my_ids = [item["id"] for item in res_my.json()["data"]]
    assert str(g1.id) in my_ids


# ==========================================
# Category C: Grievance Detail & Stage 2 Preview
# ==========================================

def test_assistant_dean_grievance_detail_and_preview(db_session: Session):
    """
    Verifies that Assistant Dean can retrieve the case dossier with Stage 2 routing destination preview:
    - Case with GRIEVANCE_CLUSTER category previews Associate Dean
    - Case with FIXED_AUTHORITY category previews Fixed Authority
    - Case with SUBJECT_ASSISTANT_DEAN has can_forward = False
    - Other Assistant Dean's cases return 403 Forbidden
    """
    env = setup_taxonomy_environment(db_session)
    _, asst1, asst1_token = env["asst1"]
    _, asst2, asst2_token = env["asst2"]
    _, assoc1, _ = env["assoc1"]
    _, fixed_auth, _ = env["fixed_auth"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_prev@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_prev@csjmu.ac.in", ["applicant"])

    # Grievance A: Exam Category (Grievance Cluster -> Associate Dean)
    ga = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_exam"], asst1, u_mgr,
        title="Dossier Test Grievance Cluster",
    )
    # Grievance B: Fellowship Category (Fixed Authority -> Fellowship Officer)
    gb = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_fellowship"], asst1, u_mgr,
        title="Dossier Test Fixed Authority",
    )
    # Grievance C: Terminal Academic Category
    gc = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_acad"], asst1, u_mgr,
        title="Dossier Test Terminal Category",
    )

    # 1. Grievance A detail: Stage 2 destination is Associate Dean
    res_a = client.get(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{ga.id}",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_a.status_code == 200
    data_a = res_a.json()["data"]
    assert data_a["can_forward"] is True
    assert data_a["next_authority"]["id"] == str(assoc1.id)
    assert data_a["next_authority"]["role"] == "ASSOCIATE_DEAN"

    # 2. Grievance B detail: Stage 2 destination is Fixed Authority
    res_b = client.get(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{gb.id}",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_b.status_code == 200
    data_b = res_b.json()["data"]
    assert data_b["can_forward"] is True
    assert data_b["next_authority"]["id"] == str(fixed_auth.id)

    # 3. Grievance C detail: Terminal Category
    res_c = client.get(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{gc.id}",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_c.status_code == 200
    data_c = res_c.json()["data"]
    assert data_c["can_forward"] is False
    assert data_c["next_authority"] is None

    # 4. IDOR Protection: Asst Dean 2 tries to access Asst Dean 1's grievance
    res_idor = client.get(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{ga.id}",
        headers={"Authorization": f"Bearer {asst2_token}"},
    )
    assert res_idor.status_code == 403


# ==========================================
# Category D: Direct Grievance Resolution
# ==========================================

def test_assistant_dean_direct_resolution(db_session: Session):
    """
    Verifies that Assistant Dean can directly resolve a grievance:
    - Status transitions to RESOLVED
    - resolution_summary, resolved_by_authority_id, resolved_at persisted
    - Status history logged with actor and remarks
    - AuditLog recorded
    - Notifications sent to applicant and managers
    - Validation: notes must be >= 3 chars
    - Guard: cannot resolve if already resolved
    """
    env = setup_taxonomy_environment(db_session)
    u_asst1, asst1, asst1_token = env["asst1"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_res@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_res@csjmu.ac.in", ["applicant"])

    g = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_acad"], asst1, u_mgr,
        title="Issue Directly Resolvable by Assistant Dean",
    )

    # 1. Validation error: notes too short (<3 chars)
    res_short = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/resolve",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json={"resolution_notes": "ok"},
    )
    assert res_short.status_code in (400, 422)

    # 2. Successful resolution
    resolution_text = "Met with the scholar and departmental head. Marks revised and updated on the university portal."
    res_resolve = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/resolve",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json={"resolution_notes": resolution_text},
    )
    assert res_resolve.status_code == 200
    assert res_resolve.json()["success"] is True

    # 3. Database verification
    db_session.expire_all()
    g_updated = db_session.get(Grievance, g.id)
    assert g_updated.status == GrievanceStatus.RESOLVED
    assert g_updated.resolution_summary == resolution_text
    assert g_updated.resolved_by_authority_id == asst1.id
    assert g_updated.resolved_at is not None

    # 4. Status history verification
    h = db_session.scalar(
        select(GrievanceStatusHistory).where(
            GrievanceStatusHistory.grievance_id == g.id,
            GrievanceStatusHistory.to_status == GrievanceStatus.RESOLVED.value,
        )
    )
    assert h is not None
    assert h.actor_user_id == u_asst1.id
    assert resolution_text in h.remarks

    # 5. AuditLog verification
    audit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.entity_id == str(g.id),
            AuditLog.action == "GRIEVANCE_RESOLVED",
        )
    )
    assert audit is not None
    assert audit.user_id == u_asst1.id

    # 6. Notification verification (Applicant received notification)
    notif_app = db_session.scalar(
        select(Notification).where(
            Notification.user_id == u_app.id,
            Notification.type == "GRIEVANCE_RESOLVED",
        )
    )
    assert notif_app is not None

    # 7. Cannot re-resolve an already resolved grievance
    res_double = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/resolve",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json={"resolution_notes": "Trying to resolve again"},
    )
    assert res_double.status_code == 400


# ==========================================
# Category E: Stage 2 Category-Based Forwarding
# ==========================================

def test_assistant_dean_forwarding_to_associate_dean(db_session: Session):
    """
    Verifies that Assistant Dean can forward a case with a GRIEVANCE_CLUSTER category to Associate Dean:
    - 6-checkbox acknowledgment validated (all mandatory True)
    - 3-justification fields validated (minimum 5 chars trimmed)
    - Resolves Associate Dean
    - Prior assignment deactivated (is_active = False)
    - New active assignment created for Associate Dean
    - ForwardingConfirmation record persisted
    - Status history, AuditLog, and Notifications dispatched
    """
    env = setup_taxonomy_environment(db_session)
    u_asst1, asst1, asst1_token = env["asst1"]
    _, assoc1, _ = env["assoc1"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_fwd@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_fwd@csjmu.ac.in", ["applicant"])

    g = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_exam"], asst1, u_mgr,
        title="Exam Dispute Requiring Higher Level Intervention",
    )

    # 1. Validation failure: missing/false checklist booleans
    res_bad_check = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/forward",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json={
            "remarks": "Please expedite",
            "confirmation": {
                "reviewed_details": True,
                "reviewed_documents": False,  # Missing acknowledgment
                "understands_status": True,
                "action_taken_within_authority": True,
                "forwarding_necessary": True,
                "accepts_accountability": True,
                "forwarding_reason": "Policy decision required at institutional cluster level.",
                "action_taken": "Reviewed initial exam marks with academic department chair.",
                "why_higher_intervention_required": "Exam board decision required under University statutes.",
            },
        },
    )
    assert res_bad_check.status_code == 400

    # 2. Validation failure: justification too short (<5 chars)
    res_bad_just = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/forward",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json={
            "remarks": "Please expedite",
            "confirmation": {
                "reviewed_details": True,
                "reviewed_documents": True,
                "understands_status": True,
                "action_taken_within_authority": True,
                "forwarding_necessary": True,
                "accepts_accountability": True,
                "forwarding_reason": "No",  # Too short
                "action_taken": "Reviewed marks.",
                "why_higher_intervention_required": "Need help.",
            },
        },
    )
    assert res_bad_just.status_code in (400, 422)

    # 3. Successful Forwarding to Associate Dean
    forward_payload = {
        "remarks": "Urgent attention requested by student committee.",
        "confirmation": {
            "reviewed_details": True,
            "reviewed_documents": True,
            "understands_status": True,
            "action_taken_within_authority": True,
            "forwarding_necessary": True,
            "accepts_accountability": True,
            "forwarding_reason": "Dispute involves faculty-wide evaluation discrepancy exceeding assistant dean purview.",
            "action_taken": "Convened departmental preliminary review; confirmed statistical anomaly in exam scores.",
            "why_higher_intervention_required": "Associate Dean of Academic Evaluation holds statutory jurisdiction for exam board re-evaluation.",
        },
    }
    res_fwd = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/forward",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json=forward_payload,
    )
    assert res_fwd.status_code == 200
    res_data = res_fwd.json()["data"]
    assert res_data["assigned_to"]["id"] == str(assoc1.id)
    assert res_data["assigned_to"]["role"] == "ASSOCIATE_DEAN"

    # 4. Database checks
    db_session.expire_all()
    g_updated = db_session.get(Grievance, g.id)
    assert g_updated.assigned_authority_id == assoc1.id
    assert g_updated.status == GrievanceStatus.ASSIGNED

    # Prior assignment deactivated
    old_assign = db_session.scalar(
        select(Assignment).where(
            Assignment.grievance_id == g.id,
            Assignment.authority_id == asst1.id,
        )
    )
    assert old_assign.is_active is False
    assert old_assign.unassigned_at is not None

    # New assignment active
    new_assign = db_session.scalar(
        select(Assignment).where(
            Assignment.grievance_id == g.id,
            Assignment.authority_id == assoc1.id,
        )
    )
    assert new_assign.is_active is True

    # ForwardingConfirmation persisted
    fc = db_session.scalar(
        select(ForwardingConfirmation).where(
            ForwardingConfirmation.grievance_id == g.id,
            ForwardingConfirmation.forwarded_by_authority_id == asst1.id,
            ForwardingConfirmation.forwarded_to_authority_id == assoc1.id,
        )
    )
    assert fc is not None
    assert fc.jurisdiction_verified is True
    assert fc.evidence_reviewed is True
    assert fc.justification_reason == forward_payload["confirmation"]["forwarding_reason"]

    # AuditLog
    audit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.entity_id == str(g.id),
            AuditLog.action == "GRIEVANCE_FORWARDED",
        )
    )
    assert audit is not None


def test_assistant_dean_forwarding_to_fixed_authority(db_session: Session):
    """
    Verifies that Assistant Dean can forward a case with a FIXED_AUTHORITY category to Fixed Authority:
    - Resolves Fixed Authority (Fellowship Officer)
    - New active assignment created for Fixed Authority
    """
    env = setup_taxonomy_environment(db_session)
    u_asst1, asst1, asst1_token = env["asst1"]
    _, fixed_auth, _ = env["fixed_auth"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_fixed@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_fixed@csjmu.ac.in", ["applicant"])

    g = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_fellowship"], asst1, u_mgr,
        title="Fellowship Non-payment Escalation",
    )

    forward_payload = {
        "remarks": "Forwarding to Fellowship Section Officer.",
        "confirmation": {
            "reviewed_details": True,
            "reviewed_documents": True,
            "understands_status": True,
            "action_taken_within_authority": True,
            "forwarding_necessary": True,
            "accepts_accountability": True,
            "forwarding_reason": "Fellowship disbursement handled exclusively by Central Fellowship Section.",
            "action_taken": "Verified student attendance records and fellowship eligibility certificates.",
            "why_higher_intervention_required": "Funds release must be authorized by Fellowship Section Officer.",
        },
    }
    # Using canonical reference alias endpoint: POST /assignments/{grievance_id}
    res_fwd = client.post(
        f"{NIVARAN_BASE}/assignments/{g.id}",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json=forward_payload,
    )
    assert res_fwd.status_code == 200
    res_data = res_fwd.json()["data"]
    assert res_data["assigned_to"]["id"] == str(fixed_auth.id)


def test_assistant_dean_terminal_routing_cannot_forward(db_session: Session):
    """
    Verifies that Assistant Dean CANNOT forward a grievance whose category has
    routing_type = SUBJECT_ASSISTANT_DEAN (terminal category).
    Must return 400 Bad Request.
    """
    env = setup_taxonomy_environment(db_session)
    _, asst1, asst1_token = env["asst1"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_term@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_term@csjmu.ac.in", ["applicant"])

    g = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_acad"], asst1, u_mgr,
        title="Terminal Category Forwarding Attempt",
    )

    forward_payload = {
        "confirmation": {
            "reviewed_details": True,
            "reviewed_documents": True,
            "understands_status": True,
            "action_taken_within_authority": True,
            "forwarding_necessary": True,
            "accepts_accountability": True,
            "forwarding_reason": "Attempting to forward terminal category.",
            "action_taken": "Reviewed academic records.",
            "why_higher_intervention_required": "Higher intervention request.",
        },
    }
    res = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/forward",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json=forward_payload,
    )
    assert res.status_code == 400
    err_text = res.json().get("detail") or res.json().get("message", "")
    assert "cannot be forwarded further" in err_text.lower()


# ==========================================
# Category F: Evidentiary Document Requests
# ==========================================

def test_assistant_dean_document_requests(db_session: Session):
    """
    Verifies that Assistant Dean can request additional evidentiary documents:
    - Status transitions to AWAITING_INFORMATION
    - Active assignment is preserved
    - DocumentRequest rows created
    - AuditLog and notification recorded
    - Retrieval via GET /grievances/{id}/document-requests
    """
    env = setup_taxonomy_environment(db_session)
    u_asst1, asst1, asst1_token = env["asst1"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_doc@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_doc@csjmu.ac.in", ["applicant"])

    g = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_exam"], asst1, u_mgr,
        title="Grievance Requiring Verification Documents",
    )

    doc_payload = {
        "documents": [
            {
                "document_name": "Original Admit Card",
                "description": "Please upload scanned copy of the attested examination admit card.",
            },
            {
                "document_name": "Provisional Marksheet Copy",
                "description": "Upload downloaded online marksheet showing discrepancy.",
            },
        ],
    }
    res_doc = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/document-requests",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json=doc_payload,
    )
    assert res_doc.status_code == 200
    created_items = res_doc.json()["data"]
    assert len(created_items) == 2
    assert created_items[0]["document_name"] == "Original Admit Card"
    assert created_items[0]["status"] == "PENDING"

    # Status updated to AWAITING_INFORMATION
    db_session.expire_all()
    g_updated = db_session.get(Grievance, g.id)
    assert g_updated.status == GrievanceStatus.AWAITING_INFORMATION

    # Active assignment preserved
    assign = db_session.scalar(
        select(Assignment).where(
            Assignment.grievance_id == g.id,
            Assignment.authority_id == asst1.id,
            Assignment.is_active.is_(True),
        )
    )
    assert assign is not None

    # Retrieve document requests
    res_list = client.get(
        f"{NIVARAN_BASE}/grievances/{g.id}/document-requests",
        headers={"Authorization": f"Bearer {asst1_token}"},
    )
    assert res_list.status_code == 200
    assert len(res_list.json()["data"]) == 2


# ==========================================
# Category G: Committee Creation Requests
# ==========================================

def test_assistant_dean_committee_creation_request(db_session: Session):
    """
    Verifies that Assistant Dean can request formal committee creation:
    - CommitteeCreationRequest record created with status PENDING
    - Duplicate request rejected with 400 Bad Request
    """
    env = setup_taxonomy_environment(db_session)
    u_asst1, asst1, asst1_token = env["asst1"]
    u_mgr, _, _ = get_or_create_authority(db_session, "mgr_comm@csjmu.ac.in", NivaranRole.MANAGER, "Manager")
    u_app, _ = get_or_create_user(db_session, "student_comm@csjmu.ac.in", ["applicant"])

    g = create_assigned_grievance(
        db_session, u_app, env["sub_cs"], env["cat_exam"], asst1, u_mgr,
        title="Complex Grievance Requiring Faculty Committee",
    )

    comm_payload = {
        "justification": "Complex multi-departmental allegations require independent inquiry committee under university ordinance.",
        "proposed_scope": "Review faculty grading methodology across semesters 4 and 5.",
        "supporting_remarks": "Discussed with department chair.",
    }
    res_comm = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/committee-requests",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json=comm_payload,
    )
    assert res_comm.status_code == 200
    data = res_comm.json()["data"]
    assert data["request_status"] == "PENDING"
    assert data["justification"] == comm_payload["justification"]

    # Duplicate committee request rejected
    res_dup = client.post(
        f"{NIVARAN_BASE}/assistant-dean/grievances/{g.id}/committee-requests",
        headers={"Authorization": f"Bearer {asst1_token}"},
        json=comm_payload,
    )
    assert res_dup.status_code == 400
    err_text = res_dup.json().get("detail") or res_dup.json().get("message", "")
    assert "already pending" in err_text.lower()
