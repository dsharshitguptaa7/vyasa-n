# -*- coding: utf-8 -*-
"""
Phase 6E: Dean Executive Command Center Test Suite.
Verifies complete institutional grievance oversight, KPIs, pipeline funnel,
bottlenecks, aging distributions, authority workloads, and security boundaries.
"""

import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
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
from app.modules.atharva_veda.nivaran.models.routing import (
    Assignment,
    ForwardingConfirmation,
)

client = TestClient(app)

DASHBOARD_URL = "/api/modules/atharva-veda/nivaran/dean/dashboard"
CASES_URL = "/api/modules/atharva-veda/nivaran/dean/dashboard/cases"


def get_or_create_user(db: Session, email: str, role_names: list[str]) -> tuple[User, str]:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            email=email,
            password_hash="hashed_test_pw",
            first_name=email.split("@")[0].capitalize(),
            last_name="ExecutiveTest",
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
    else:
        auth.role = role
        auth.is_active = True
        auth.designation = designation
        db.commit()
        db.refresh(auth)
    return user, auth, token


@pytest.fixture(scope="function")
def db_session():
    db = next(get_db())
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def dashboard_env(db_session: Session):
    """
    Initializes institutional environment with Dean, Associate Dean, Assistant Dean,
    Manager, Fixed Authority, and Applicant along with test taxonomy and sample grievances.
    """
    db = db_session
    now = datetime.now(timezone.utc)

    # 1. Dean
    u_dean, auth_dean, token_dean = get_or_create_authority(
        db, "dean_phase6e@csjmu.ac.in", NivaranRole.DEAN, "Dean of Research & Development"
    )

    # 2. Associate Dean
    u_assoc, auth_assoc, token_assoc = get_or_create_authority(
        db, "assoc_phase6e@csjmu.ac.in", NivaranRole.ASSOCIATE_DEAN, "Associate Dean Academic Affairs"
    )

    # 3. Assistant Dean
    u_asst, auth_asst, token_asst = get_or_create_authority(
        db, "asst_phase6e@csjmu.ac.in", NivaranRole.ASSISTANT_DEAN, "Assistant Dean Sciences"
    )

    # 4. Manager
    u_mgr, auth_mgr, token_mgr = get_or_create_authority(
        db, "mgr_phase6e@csjmu.ac.in", NivaranRole.MANAGER, "Central Grievance Manager"
    )

    # 5. Fixed Authority (Guest/Other role)
    u_fixed, auth_fixed, _ = get_or_create_authority(
        db, "fixed_phase6e@csjmu.ac.in", NivaranRole.GUEST_MEMBER, "Director of Fellowships"
    )

    # 6. Applicant
    u_app, token_app = get_or_create_user(db, "scholar_phase6e@csjmu.ac.in", ["applicant"])

    # 7. Taxonomy setup
    sub_cluster = db.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == 91))
    if not sub_cluster:
        sub_cluster = SubjectCluster(
            cluster_number=91,
            name="Physical Sciences Cluster 91",
            assistant_dean_id=auth_asst.id,
            is_active=True,
        )
        db.add(sub_cluster)
        db.commit()
        db.refresh(sub_cluster)
    else:
        sub_cluster.assistant_dean_id = auth_asst.id
        db.commit()

    subject = db.scalar(select(Subject).where(Subject.name == "Experimental Physics 91"))
    if not subject:
        subject = Subject(
            subject_cluster_id=sub_cluster.id,
            name="Experimental Physics 91",
            code="PHY91",
            is_active=True,
        )
        db.add(subject)
        db.commit()
        db.refresh(subject)

    grv_cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.cluster_number == 91))
    if not grv_cluster:
        grv_cluster = GrievanceCluster(
            cluster_number=91,
            name="Academic Discrepancy Cluster 91",
            associate_dean_id=auth_assoc.id,
            is_active=True,
        )
        db.add(grv_cluster)
        db.commit()
        db.refresh(grv_cluster)
    else:
        grv_cluster.associate_dean_id = auth_assoc.id
        db.commit()

    # Category 1: CLUSTER routing
    cat_cluster = db.scalar(select(Category).where(Category.name == "Coursework & Evaluation 91"))
    if not cat_cluster:
        cat_cluster = Category(
            name="Coursework & Evaluation 91",
            routing_type=CategoryRoutingType.CLUSTER,
            grievance_cluster_id=grv_cluster.id,
            is_active=True,
        )
        db.add(cat_cluster)
        db.commit()
        db.refresh(cat_cluster)

    # Category 2: FIXED_AUTHORITY routing
    cat_fixed = db.scalar(select(Category).where(Category.name == "Institutional Fellowship 91"))
    if not cat_fixed:
        cat_fixed = Category(
            name="Institutional Fellowship 91",
            routing_type=CategoryRoutingType.FIXED_AUTHORITY,
            fixed_authority_id=auth_fixed.id,
            is_active=True,
        )
        db.add(cat_fixed)
        db.commit()
        db.refresh(cat_fixed)

    # Student Master Record
    record = db.scalar(select(StudentMasterRecord).where(StudentMasterRecord.record_number == "REC-PHASE6E-001"))
    if not record:
        record = StudentMasterRecord(
            student_vyasa_user_id=u_app.id,
            record_number="REC-PHASE6E-001",
            registration_number_snapshot="PHD/2026/9101",
            enrollment_number_snapshot="ENR9101",
            full_name_snapshot="Aarav Sharma",
            email_snapshot=u_app.email,
            subject_id=subject.id,
        )
        db.add(record)
        db.commit()
        db.refresh(record)

    # Helper to create grievance
    def create_case(tracking_id: str, st: GrievanceStatus, pr: GrievancePriority, days_ago: int, assigned_auth: Optional[NivaranAuthority] = None, cat: Optional[Category] = None):
        g = db.scalar(select(Grievance).where(Grievance.grievance_id == tracking_id))
        created_time = now - timedelta(days=days_ago)
        if not g:
            g = Grievance(
                grievance_id=tracking_id,
                applicant_vyasa_user_id=u_app.id,
                student_record_id=record.id,
                subject_id=subject.id,
                category_id=(cat or cat_cluster).id,
                final_category_id=(cat or cat_cluster).id,
                status=st,
                priority=pr,
                title=f"Sample Test Case {tracking_id}",
                description=f"Detailed description for grievance {tracking_id}",
                assigned_authority_id=assigned_auth.id if assigned_auth else None,
                resolved_by_authority_id=assigned_auth.id if (assigned_auth and st in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}) else None,
                resolved_at=(now - timedelta(days=1)) if st in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED} else None,
                category_reviewed=True,
                category_overridden=False,
                ai_confidence=0.92,
                created_at=created_time,
                updated_at=now,
            )
            db.add(g)
            db.commit()
            db.refresh(g)

            if assigned_auth:
                assign = Assignment(
                    grievance_id=g.id,
                    authority_id=assigned_auth.id,
                    is_active=(st not in {GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED}),
                    assigned_at=created_time + timedelta(hours=2),
                )
                db.add(assign)

            hist = GrievanceStatusHistory(
                grievance_id=g.id,
                to_status=st.value,
                actor_authority_id=assigned_auth.id if assigned_auth else auth_mgr.id,
                remarks=f"Initialized test case {tracking_id}",
                created_at=created_time,
            )
            db.add(hist)
            db.commit()
            db.refresh(g)
        return g

    # Create cases across different lifecycle stages and authorities
    # 1. Pending at Manager (3 days old)
    g_mgr = create_case("CSJMU-2026-91001", GrievanceStatus.PENDING_REVIEW, GrievancePriority.MEDIUM, 3, auth_mgr)
    # 2. Active at Assistant Dean (8 days old)
    g_asst = create_case("CSJMU-2026-91002", GrievanceStatus.ASSIGNED, GrievancePriority.HIGH, 8, auth_asst)
    # 3. Active at Associate Dean (12 days old)
    g_assoc = create_case("CSJMU-2026-91003", GrievanceStatus.IN_PROGRESS, GrievancePriority.CRITICAL, 12, auth_assoc)
    # 4. Escalated to Dean (15 days old)
    g_dean = create_case("CSJMU-2026-91004", GrievanceStatus.ESCALATED, GrievancePriority.HIGH, 15, auth_dean)
    # 5. Resolved by Associate Dean (2 days old)
    g_res = create_case("CSJMU-2026-91005", GrievanceStatus.RESOLVED, GrievancePriority.MEDIUM, 4, auth_assoc)
    # 6. Active at Fixed Authority (5 days old)
    g_fix = create_case("CSJMU-2026-91006", GrievanceStatus.ASSIGNED, GrievancePriority.LOW, 5, auth_fixed, cat_fixed)

    return {
        "dean": (u_dean, auth_dean, token_dean),
        "assoc": (u_assoc, auth_assoc, token_assoc),
        "asst": (u_asst, auth_asst, token_asst),
        "mgr": (u_mgr, auth_mgr, token_mgr),
        "applicant": (u_app, token_app),
        "cases": [g_mgr, g_asst, g_assoc, g_dean, g_res, g_fix],
        "sub_cluster": sub_cluster,
        "grv_cluster": grv_cluster,
        "cat_cluster": cat_cluster,
        "cat_fixed": cat_fixed,
    }


# ==============================================================================
# 1. Dean Authorization & Role Boundary Separation
# ==============================================================================

def test_dean_dashboard_authorization_dean_passes(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert "kpis" in res_data["data"]
    assert "workflow_pipeline" in res_data["data"]
    assert "bottlenecks" in res_data["data"]


def test_dean_dashboard_authorization_non_dean_rejected(dashboard_env):
    """
    Guarantees strict 403 Forbidden for Applicant, Manager, Assistant Dean, Associate Dean.
    """
    _, token_app = dashboard_env["applicant"]
    _, _, token_mgr = dashboard_env["mgr"]
    _, _, token_asst = dashboard_env["asst"]
    _, _, token_assoc = dashboard_env["assoc"]

    for token, role_name in [
        (token_app, "Applicant"),
        (token_mgr, "Manager"),
        (token_asst, "Assistant Dean"),
        (token_assoc, "Associate Dean"),
    ]:
        headers = {"Authorization": f"Bearer {token}"}
        resp = client.get(DASHBOARD_URL, headers=headers)
        assert resp.status_code == 403, f"{role_name} should receive 403 Forbidden on Dean dashboard"


# ==============================================================================
# 2. Executive KPIs & Real Data Calculation
# ==============================================================================

def test_dean_dashboard_kpis_and_resolution_rate(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    kpis = response.json()["data"]["kpis"]

    assert kpis["total_cases"] >= 6
    assert kpis["active_cases"] >= 5  # mgr, asst, assoc, dean, fixed are active
    assert kpis["resolved_cases"] >= 1
    assert kpis["escalated_cases"] >= 1
    assert kpis["critical_urgent_cases"] >= 3  # High and Critical cases
    assert kpis["resolution_rate"] > 0.0
    assert kpis["ai_prediction_accuracy"] > 0.0


# ==============================================================================
# 3. Workflow Pipeline / Funnel
# ==============================================================================

def test_dean_dashboard_workflow_pipeline_distribution(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    pipeline = response.json()["data"]["workflow_pipeline"]

    stage_keys = [s["stage_key"] for s in pipeline]
    assert "APPLICANT" in stage_keys
    assert "MANAGER" in stage_keys
    assert "ASSISTANT_DEAN" in stage_keys
    assert "ASSOCIATE_DEAN" in stage_keys
    assert "FIXED_AUTHORITY" in stage_keys
    assert "DEAN" in stage_keys
    assert "RESOLVED" in stage_keys

    # Check that counts reflect active assignment locations
    mgr_stage = next(s for s in pipeline if s["stage_key"] == "MANAGER")
    asst_stage = next(s for s in pipeline if s["stage_key"] == "ASSISTANT_DEAN")
    assoc_stage = next(s for s in pipeline if s["stage_key"] == "ASSOCIATE_DEAN")
    dean_stage = next(s for s in pipeline if s["stage_key"] == "DEAN")
    fixed_stage = next(s for s in pipeline if s["stage_key"] == "FIXED_AUTHORITY")

    assert mgr_stage["current_count"] >= 1
    assert asst_stage["current_count"] >= 1
    assert assoc_stage["current_count"] >= 1
    assert dean_stage["current_count"] >= 1
    assert fixed_stage["current_count"] >= 1


# ==============================================================================
# 4. Bottleneck Analysis ("Where are cases stuck?")
# ==============================================================================

def test_dean_dashboard_bottlenecks(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    bottlenecks = response.json()["data"]["bottlenecks"]

    levels = [b["level"] for b in bottlenecks]
    assert "MANAGER" in levels
    assert "ASSISTANT_DEAN" in levels
    assert "ASSOCIATE_DEAN" in levels
    assert "DEAN" in levels

    for b in bottlenecks:
        if b["total_pending"] > 0:
            assert b["oldest_case_tracking_id"] is not None
            assert b["oldest_case_age_hours"] > 0.0
            assert b["avg_stage_age_hours"] > 0.0
            assert b["max_stage_age_hours"] >= b["avg_stage_age_hours"]


# ==============================================================================
# 5. Aging Distribution Buckets
# ==============================================================================

def test_dean_dashboard_aging_distribution(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    aging = response.json()["data"]["aging_distribution"]

    bucket_keys = [b["bucket_key"] for b in aging]
    assert "<24h" in bucket_keys
    assert "1-3d" in bucket_keys
    assert "4-7d" in bucket_keys
    assert "8-14d" in bucket_keys
    assert "15-30d" in bucket_keys
    assert "30+d" in bucket_keys

    # Confirm by_level breakdown exists
    for b in aging:
        assert isinstance(b["by_level"], dict)


# ==============================================================================
# 6. Authority Workload Matrix & Specialized Panels
# ==============================================================================

def test_dean_dashboard_authority_workloads(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    workloads = response.json()["data"]["authority_workloads"]

    roles = [w["role"] for w in workloads]
    assert "DEAN" in roles
    assert "ASSOCIATE_DEAN" in roles
    assert "ASSISTANT_DEAN" in roles
    assert "MANAGER" in roles

    # Assistant Dean Panel
    asst_panel = response.json()["data"]["assistant_dean_panel"]
    assert len(asst_panel) >= 1
    assert asst_panel[0]["subject_cluster_name"] != ""

    # Associate Dean Panel
    assoc_panel = response.json()["data"]["associate_dean_panel"]
    assert len(assoc_panel) >= 1
    assert assoc_panel[0]["grievance_cluster_name"] != ""

    # Manager Triage Panel
    mgr_panel = response.json()["data"]["manager_triage"]
    assert "awaiting_ai_review" in mgr_panel
    assert "unresolved_manager_queue" in mgr_panel


# ==============================================================================
# 7. Category, Cluster & Subject Analytics
# ==============================================================================

def test_dean_dashboard_category_and_cluster_analytics(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]

    # Categories
    categories = data["category_analytics"]
    assert len(categories) >= 2
    cat_names = [c["category_name"] for c in categories]
    assert "Coursework & Evaluation 91" in cat_names
    assert "Institutional Fellowship 91" in cat_names

    # Grievance Clusters
    grv_clusters = data["grievance_cluster_analytics"]
    assert len(grv_clusters) >= 1

    # Subject Clusters & Subject Hierarchy
    sub_clusters = data["subject_cluster_analytics"]
    assert len(sub_clusters) >= 1
    cluster_91 = next((sc for sc in sub_clusters if sc["cluster_number"] == 91), None)
    assert cluster_91 is not None
    assert any(s["subject_name"] == "Experimental Physics 91" for s in cluster_91["subjects"])


# ==============================================================================
# 8. Oldest Cases & Attention Required Panels
# ==============================================================================

def test_dean_dashboard_oldest_cases_and_attention(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]

    # Oldest cases sorted by total age descending
    oldest = data["oldest_cases"]
    assert len(oldest) >= 1
    for i in range(len(oldest) - 1):
        assert oldest[i]["total_age_hours"] >= oldest[i + 1]["total_age_hours"]

    # Attention items
    attention = data["attention_items"]
    assert len(attention) >= 1
    # Check that escalated or aging case triggered attention
    urgency_reasons = [a["urgency_reason"] for a in attention]
    assert any("Escalated" in r or "aging" in r or "priority" in r for r in urgency_reasons)


# ==============================================================================
# 9. Time Trend, Routing Analytics & Routing Health
# ==============================================================================

def test_dean_dashboard_trends_routing_and_health(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}
    response = client.get(DASHBOARD_URL, headers=headers)
    assert response.status_code == 200
    data = response.json()["data"]

    # Time trends
    trends = data["time_trends"]
    assert len(trends) >= 14
    assert "submitted_count" in trends[0]
    assert "resolved_count" in trends[0]
    assert "active_backlog" in trends[0]

    # Routing analytics
    routing = data["routing_analytics"]
    assert len(routing["by_routing_type"]) >= 1

    # Routing health
    health = data["routing_health"]
    assert "grievances_with_active_assignment" in health
    assert "is_healthy" in health


# ==============================================================================
# 10. Global Filters & Cross-Filtering
# ==============================================================================

def test_dean_dashboard_filtering_by_status_and_priority(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}

    # Filter by ESCALATED
    resp_esc = client.get(f"{DASHBOARD_URL}?status=ESCALATED", headers=headers)
    assert resp_esc.status_code == 200
    kpis_esc = resp_esc.json()["data"]["kpis"]
    assert kpis_esc["total_cases"] >= 1
    assert kpis_esc["resolved_cases"] == 0

    # Filter by CRITICAL priority
    resp_crit = client.get(f"{DASHBOARD_URL}?priority=CRITICAL", headers=headers)
    assert resp_crit.status_code == 200
    kpis_crit = resp_crit.json()["data"]["kpis"]
    assert kpis_crit["total_cases"] >= 1


# ==============================================================================
# 11. Executive Grievance Ledger Endpoint (/dean/dashboard/cases)
# ==============================================================================

def test_dean_dashboard_cases_ledger_pagination_and_search(dashboard_env):
    _, _, token_dean = dashboard_env["dean"]
    headers = {"Authorization": f"Bearer {token_dean}"}

    # 1. Base ledger call
    resp = client.get(f"{CASES_URL}?page=1&page_size=10", headers=headers)
    assert resp.status_code == 200
    ledger = resp.json()["data"]
    assert ledger["total"] >= 6
    assert len(ledger["items"]) >= 6
    assert ledger["page"] == 1

    # Verify columns in row
    first = ledger["items"][0]
    assert "tracking_id" in first
    assert "title" in first
    assert "total_age_hours" in first
    assert "current_stage_age_hours" in first
    assert "current_level" in first
    assert "current_authority_name" in first

    # 2. Search filter
    resp_search = client.get(f"{CASES_URL}?search=91004", headers=headers)
    assert resp_search.status_code == 200
    search_res = resp_search.json()["data"]
    assert search_res["total"] == 1
    assert search_res["items"][0]["tracking_id"] == "CSJMU-2026-91004"

    # 3. Non-dean gets 403 on cases endpoint
    _, token_app = dashboard_env["applicant"]
    resp_forbidden = client.get(CASES_URL, headers={"Authorization": f"Bearer {token_app}"})
    assert resp_forbidden.status_code == 403
