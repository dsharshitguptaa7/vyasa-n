import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.applicant_profile import ApplicantProfile
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    SubjectCluster,
    Subject,
    GrievanceCluster,
    Category,
)
from app.modules.atharva_veda.nivaran.models.enums import (
    NivaranRole,
    GrievanceStatus,
    GrievancePriority,
)
from app.modules.atharva_veda.nivaran.models.grievance import Grievance, StudentMasterRecord

client = TestClient(app)

NIVARAN_BASE = "/api/modules/atharva-veda/nivaran"
ADMIN_BASE = "/api/admin/atharva"


# ==========================================
# Helpers & Fixtures
# ==========================================

def get_or_create_user(db: Session, email: str, role_names: list[str]) -> tuple[User, str]:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(
            email=email,
            password_hash="hashed_pw",
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

        existing_link = db.execute(
            select(user_roles).where(user_roles.c.user_id == user.id, user_roles.c.role_id == role.id)
        ).first()
        if not existing_link:
            db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
            db.commit()

    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return user, token


def create_test_grievance(
    db: Session,
    applicant: User,
    subject: Subject,
    category: Category,
    title: str = "Boundary Test Grievance",
) -> Grievance:
    rec = StudentMasterRecord(
        student_vyasa_user_id=applicant.id,
        record_number=f"REC-{uuid.uuid4().hex[:8].upper()}",
        registration_number_snapshot=f"PHD-{uuid.uuid4().hex[:6].upper()}",
        full_name_snapshot=f"{applicant.first_name} {applicant.last_name}",
        email_snapshot=applicant.email,
        subject_id=subject.id,
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    g = Grievance(
        grievance_id=f"G-BND-{uuid.uuid4().hex[:6].upper()}",
        title=title,
        description="Testing strict authority boundary access control",
        applicant_vyasa_user_id=applicant.id,
        student_record_id=rec.id,
        subject_id=subject.id,
        category_id=category.id,
        status=GrievanceStatus.SUBMITTED,
        priority=GrievancePriority.MEDIUM,
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


# ==========================================
# Test Suite
# ==========================================

def test_applicant_boundary_access(db_session: Session):
    db = db_session
    """
    Applicant must be able to submit and view own grievances,
    but MUST be blocked (403) from manager, assistant dean, associate dean, dean, and admin endpoints.
    """
    subject = db.scalar(select(Subject).where(Subject.is_active.is_(True)))
    category = db.scalar(select(Category).where(Category.is_active.is_(True)))

    applicant_user, applicant_token = get_or_create_user(db, f"applicant_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"])
    profile = ApplicantProfile(
        user_id=applicant_user.id,
        phd_registration_number=f"PHD-{uuid.uuid4().hex[:6].upper()}",
        department="Computer Science",
        subject_id=subject.id,
        subject_name=subject.name,
    )
    db.add(profile)
    db.commit()

    headers = {"Authorization": f"Bearer {applicant_token}"}

    # 1. Applicant CAN submit
    res_submit = client.post(
        f"{NIVARAN_BASE}/grievances",
        json={"title": "PhD Fellowship Access", "description": "Need disbursement updates"},
        headers=headers,
    )
    assert res_submit.status_code == 201

    # 2. Applicant CAN view own grievances
    res_my = client.get(f"{NIVARAN_BASE}/grievances/my", headers=headers)
    assert res_my.status_code == 200

    # 3. Applicant CANNOT access Manager queue
    res_mgr = client.get(f"{NIVARAN_BASE}/manager/queue", headers=headers)
    assert res_mgr.status_code == 403

    # 4. Applicant CANNOT access Assistant Dean queue
    res_asst = client.get(f"{NIVARAN_BASE}/assistant-dean/cases", headers=headers)
    assert res_asst.status_code == 403

    # 5. Applicant CANNOT access Associate Dean queue
    res_assoc = client.get(f"{NIVARAN_BASE}/associate-dean/cases", headers=headers)
    assert res_assoc.status_code == 403

    # 6. Applicant CANNOT access Dean queue
    res_dean = client.get(f"{NIVARAN_BASE}/dean/cases", headers=headers)
    assert res_dean.status_code == 403

    # 7. Applicant CANNOT access Admin config
    res_admin = client.get(f"{ADMIN_BASE}/authorities", headers=headers)
    assert res_admin.status_code == 403


def test_manager_boundary_access(db_session: Session):
    db = db_session
    """
    Manager must be able to view triage queue,
    but MUST be blocked (403) from applicant submission, applicant list, other authority queues, and admin panel.
    """
    mgr_auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.role == NivaranRole.MANAGER))
    assert mgr_auth is not None
    mgr_user = db.scalar(select(User).where(User.id == mgr_auth.vyasa_user_id))
    mgr_token = create_access_token({"sub": str(mgr_user.id)})
    headers = {"Authorization": f"Bearer {mgr_token}"}

    # 1. Manager CAN access triage queue
    res_queue = client.get(f"{NIVARAN_BASE}/manager/queue", headers=headers)
    assert res_queue.status_code == 200

    # 2. Manager CANNOT submit grievance as applicant
    res_sub = client.post(
        f"{NIVARAN_BASE}/grievances",
        json={"title": "Manager Submission", "description": "Should fail"},
        headers=headers,
    )
    assert res_sub.status_code == 403

    # 3. Manager CANNOT view my grievances
    res_my = client.get(f"{NIVARAN_BASE}/grievances/my", headers=headers)
    assert res_my.status_code == 403

    # 4. Manager CANNOT access Assistant Dean queue
    res_asst = client.get(f"{NIVARAN_BASE}/assistant-dean/cases", headers=headers)
    assert res_asst.status_code == 403

    # 5. Manager CANNOT access Associate Dean queue
    res_assoc = client.get(f"{NIVARAN_BASE}/associate-dean/cases", headers=headers)
    assert res_assoc.status_code == 403

    # 6. Manager CANNOT access Dean queue
    res_dean = client.get(f"{NIVARAN_BASE}/dean/cases", headers=headers)
    assert res_dean.status_code == 403

    # 7. Manager CANNOT access Admin config
    res_admin = client.get(f"{ADMIN_BASE}/authorities", headers=headers)
    assert res_admin.status_code == 403


def test_assistant_dean_boundary_and_cluster_scope(db_session: Session):
    db = db_session
    """
    Assistant Dean can access /assistant-dean/cases and view cases within their appointed SubjectCluster.
    Must be blocked from other queues, submit, and cases belonging to other subject clusters.
    """
    cluster1 = db.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == 1))
    cluster2 = db.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == 2))
    assert cluster1 and cluster2

    asst_auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == cluster1.assistant_dean_id))
    asst_user = db.scalar(select(User).where(User.id == asst_auth.vyasa_user_id))
    asst_token = create_access_token({"sub": str(asst_user.id)})
    headers = {"Authorization": f"Bearer {asst_token}"}

    # 1. CAN access Assistant Dean cases
    res_cases = client.get(f"{NIVARAN_BASE}/assistant-dean/cases", headers=headers)
    assert res_cases.status_code == 200

    # 2. CANNOT access other roles' queues
    assert client.get(f"{NIVARAN_BASE}/manager/queue", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/associate-dean/cases", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/dean/cases", headers=headers).status_code == 403
    assert client.get(f"{ADMIN_BASE}/authorities", headers=headers).status_code == 403

    # 3. Record-level scope check:
    # Subject in cluster 1
    sub_c1 = db.scalar(select(Subject).where(Subject.subject_cluster_id == cluster1.id, Subject.is_active.is_(True)))
    # Subject in cluster 2
    sub_c2 = db.scalar(select(Subject).where(Subject.subject_cluster_id == cluster2.id, Subject.is_active.is_(True)))
    cat = db.scalar(select(Category).where(Category.is_active.is_(True)))

    applicant, _ = get_or_create_user(db, f"applicant_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"])

    g_in_cluster = create_test_grievance(db, applicant, sub_c1, cat, "In Cluster 1 Case")
    g_out_cluster = create_test_grievance(db, applicant, sub_c2, cat, "Out of Cluster Case")

    # In-cluster case detail: ALLOWED
    res_in = client.get(f"{NIVARAN_BASE}/grievances/{g_in_cluster.id}", headers=headers)
    assert res_in.status_code == 200

    # Out-of-cluster case detail: FORBIDDEN (403)
    res_out = client.get(f"{NIVARAN_BASE}/grievances/{g_out_cluster.id}", headers=headers)
    assert res_out.status_code == 403


def test_associate_dean_boundary_and_category_cluster_scope(db_session: Session):
    db = db_session
    """
    Associate Dean can access /associate-dean/cases and view cases within their appointed GrievanceCluster.
    Must be blocked from other queues, submit, and cases belonging to categories in other grievance clusters.
    """
    g_cluster1 = db.scalar(select(GrievanceCluster).where(GrievanceCluster.cluster_number == 1))
    g_cluster2 = db.scalar(select(GrievanceCluster).where(GrievanceCluster.cluster_number == 2))
    assert g_cluster1 and g_cluster2

    assoc_auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == g_cluster1.associate_dean_id))
    assoc_user = db.scalar(select(User).where(User.id == assoc_auth.vyasa_user_id))
    assoc_token = create_access_token({"sub": str(assoc_user.id)})
    headers = {"Authorization": f"Bearer {assoc_token}"}

    # 1. CAN access Associate Dean cases
    res_cases = client.get(f"{NIVARAN_BASE}/associate-dean/cases", headers=headers)
    assert res_cases.status_code == 200

    # 2. CANNOT access other roles' queues
    assert client.get(f"{NIVARAN_BASE}/manager/queue", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/assistant-dean/cases", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/dean/cases", headers=headers).status_code == 403
    assert client.get(f"{ADMIN_BASE}/authorities", headers=headers).status_code == 403

    # 3. Record-level scope check:
    cat_c1 = db.scalar(select(Category).where(Category.grievance_cluster_id == g_cluster1.id, Category.is_active.is_(True)))
    cat_c2 = db.scalar(select(Category).where(Category.grievance_cluster_id == g_cluster2.id, Category.is_active.is_(True)))
    sub = db.scalar(select(Subject).where(Subject.is_active.is_(True)))

    applicant, _ = get_or_create_user(db, f"applicant_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"])

    g_in_cluster = create_test_grievance(db, applicant, sub, cat_c1, "In Grievance Cluster 1 Case")
    g_out_cluster = create_test_grievance(db, applicant, sub, cat_c2, "In Grievance Cluster 2 Case")

    # In-cluster case detail: ALLOWED
    res_in = client.get(f"{NIVARAN_BASE}/grievances/{g_in_cluster.id}", headers=headers)
    assert res_in.status_code == 200

    # Out-of-cluster case detail: FORBIDDEN (403)
    res_out = client.get(f"{NIVARAN_BASE}/grievances/{g_out_cluster.id}", headers=headers)
    assert res_out.status_code == 403


def test_dean_boundary_access(db_session: Session):
    db = db_session
    """
    Dean of Academic Affairs can access /dean/cases and has university-wide scope for case dossiers.
    Must be blocked from applicant submission, applicant list, manager queue, and admin control plane.
    """
    dean_auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.role == NivaranRole.DEAN))
    assert dean_auth is not None
    dean_user = db.scalar(select(User).where(User.id == dean_auth.vyasa_user_id))
    dean_token = create_access_token({"sub": str(dean_user.id)})
    headers = {"Authorization": f"Bearer {dean_token}"}

    # 1. Dean CAN access executive cases
    res_cases = client.get(f"{NIVARAN_BASE}/dean/cases", headers=headers)
    assert res_cases.status_code == 200

    # 2. Dean CAN view any case detail
    sub = db.scalar(select(Subject).where(Subject.is_active.is_(True)))
    cat = db.scalar(select(Category).where(Category.is_active.is_(True)))
    applicant, _ = get_or_create_user(db, f"applicant_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"])
    g = create_test_grievance(db, applicant, sub, cat, "Executive Review Case")
    res_detail = client.get(f"{NIVARAN_BASE}/grievances/{g.id}", headers=headers)
    assert res_detail.status_code == 200

    # 3. Dean CANNOT submit grievance as applicant
    assert client.post(f"{NIVARAN_BASE}/grievances", json={"title": "X", "description": "Y"}, headers=headers).status_code == 403

    # 4. Dean CANNOT access manager queue or admin config
    assert client.get(f"{NIVARAN_BASE}/manager/queue", headers=headers).status_code == 403
    assert client.get(f"{ADMIN_BASE}/authorities", headers=headers).status_code == 403


def test_admin_csjmu_boundary_separation(db_session: Session):
    db = db_session
    """
    admin@csjmu.ac.in possesses administrator + authority roles for platform maintenance,
    but has NO record in nivaran_authorities.
    Must be able to manage admin config (/api/admin/atharva/*),
    but CANNOT submit grievances, view my-grievances, view manager/dean queues, or view case dossiers.
    """
    admin_user = db.scalar(select(User).where(User.email == "admin@csjmu.ac.in"))
    assert admin_user is not None

    admin_token = create_access_token({"sub": str(admin_user.id)})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Admin CAN access platform control plane
    res_auths = client.get(f"{ADMIN_BASE}/authorities", headers=headers)
    assert res_auths.status_code == 200
    res_summary = client.get(f"{ADMIN_BASE}/summary", headers=headers)
    assert res_summary.status_code == 200

    # 2. Admin CANNOT submit grievance
    res_sub = client.post(
        f"{NIVARAN_BASE}/grievances",
        json={"title": "Admin Test", "description": "Should fail"},
        headers=headers,
    )
    assert res_sub.status_code == 403

    # 3. Admin CANNOT access my grievances
    assert client.get(f"{NIVARAN_BASE}/grievances/my", headers=headers).status_code == 403

    # 4. Admin CANNOT access judicial queues
    assert client.get(f"{NIVARAN_BASE}/manager/queue", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/assistant-dean/cases", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/associate-dean/cases", headers=headers).status_code == 403
    assert client.get(f"{NIVARAN_BASE}/dean/cases", headers=headers).status_code == 403

    # 5. Admin CANNOT view grievance dossier (Admin is control-plane, not judicial authority)
    sub = db.scalar(select(Subject).where(Subject.is_active.is_(True)))
    cat = db.scalar(select(Category).where(Category.is_active.is_(True)))
    applicant, _ = get_or_create_user(db, f"applicant_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"])
    g = create_test_grievance(db, applicant, sub, cat, "Admin Isolation Case")

    assert client.get(f"{NIVARAN_BASE}/grievances/{g.id}", headers=headers).status_code == 403


def test_workspace_persona_resolution(db_session: Session):
    db = db_session
    """
    GET /modules/atharva-veda/nivaran/workspace resolves the correct authoritative persona.
    """
    # 1. Applicant persona
    applicant, app_token = get_or_create_user(db, f"applicant_{uuid.uuid4().hex[:6]}@csjmu.ac.in", ["applicant"])
    res_app = client.get(f"{NIVARAN_BASE}/workspace", headers={"Authorization": f"Bearer {app_token}"})
    assert res_app.status_code == 200
    assert res_app.json()["data"]["persona"] == "applicant"
    assert res_app.json()["data"]["is_applicant"] is True

    # 2. Manager persona
    mgr_auth = db.scalar(select(NivaranAuthority).where(NivaranAuthority.role == NivaranRole.MANAGER))
    mgr_user = db.scalar(select(User).where(User.id == mgr_auth.vyasa_user_id))
    res_mgr = client.get(f"{NIVARAN_BASE}/workspace", headers={"Authorization": f"Bearer {create_access_token({'sub': str(mgr_user.id)})}"})
    assert res_mgr.status_code == 200
    assert res_mgr.json()["data"]["persona"] == "manager"
    assert res_mgr.json()["data"]["authority_role"] == "MANAGER"

    # 3. Admin persona
    admin_user = db.scalar(select(User).where(User.email == "admin@csjmu.ac.in"))
    res_admin = client.get(f"{NIVARAN_BASE}/workspace", headers={"Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"})
    assert res_admin.status_code == 200
    assert res_admin.json()["data"]["persona"] == "admin"
    assert res_admin.json()["data"]["is_admin"] is True
    assert res_admin.json()["data"]["authority_role"] is None
