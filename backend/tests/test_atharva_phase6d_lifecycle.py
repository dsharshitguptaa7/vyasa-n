import hashlib
import os
import uuid
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.main import app
from app.models.applicant_profile import ApplicantProfile
from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.role import Role, user_roles
from app.models.user import User
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.efile import EFile, EFileDocument
from app.modules.atharva_veda.nivaran.models.enums import (
    EFileStatus,
    GrievancePriority,
    GrievanceStatus,
    NivaranRole,
    StudentRecordStatus,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceFeedback,
    GrievanceStatusHistory,
    StudentMasterRecord,
)
from app.modules.atharva_veda.nivaran.models.taxonomy import (
    Category,
    GrievanceCluster,
    Subject,
    SubjectCluster,
)

client = TestClient(app)


# ==========================================
# Helpers & Fixtures
# ==========================================

def create_user_with_role(db: Session, role_name: str, prefix: str = "user") -> User:
    role = db.execute(select(Role).where(Role.name == role_name)).scalar_one_or_none()
    if not role:
        role = Role(name=role_name, description=f"{role_name} role", is_system=True)
        db.add(role)
        db.commit()
        db.refresh(role)

    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"{prefix}_{uid}@csjmu.ac.in",
        password_hash="hashed_pw",
        first_name=prefix.capitalize(),
        last_name="Test",
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
    db.commit()
    db.refresh(user)
    return user


def create_test_applicant(db: Session, setup_data: dict, prefix: str = "scholar") -> tuple[User, str]:
    user = create_user_with_role(db, "applicant", prefix)
    reg_no = f"PHD-{uuid.uuid4().hex[:6].upper()}"
    profile = ApplicantProfile(
        user_id=user.id,
        phd_registration_number=reg_no,
        department="Computer Science",
        subject_id=setup_data["subject"].id,
        subject_name=setup_data["subject"].name,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    token = create_access_token({"sub": str(user.id)})
    return user, token


def setup_phase6d_environment(db: Session):
    subject_cluster = db.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == 1))
    asst_authority = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == subject_cluster.assistant_dean_id))

    grievance_cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.cluster_number == 1))
    assoc_authority = db.scalar(select(NivaranAuthority).where(NivaranAuthority.id == grievance_cluster.associate_dean_id))

    mgr_authority = db.scalar(select(NivaranAuthority).where(NivaranAuthority.role == NivaranRole.MANAGER))
    mgr_user = db.scalar(select(User).where(User.id == mgr_authority.vyasa_user_id))
    if mgr_user and not mgr_user.is_active:
        mgr_user.is_active = True
        db.commit()

    subject = db.scalar(select(Subject).where(Subject.subject_cluster_id == subject_cluster.id, Subject.is_active.is_(True)))
    cat_fee = db.scalar(select(Category).where(Category.name == "Fee"))

    asst_user = db.scalar(select(User).where(User.id == asst_authority.vyasa_user_id))
    if asst_user and not asst_user.is_active:
        asst_user.is_active = True
        db.commit()

    asst_token = create_access_token({"sub": str(asst_user.id)})
    mgr_token = create_access_token({"sub": str(mgr_user.id)})

    return {
        "asst_authority": asst_authority,
        "asst_user": asst_user,
        "asst_token": asst_token,
        "mgr_authority": mgr_authority,
        "mgr_user": mgr_user,
        "mgr_token": mgr_token,
        "subject": subject,
        "subject_cluster": subject_cluster,
        "cat_fee": cat_fee,
    }


def create_and_resolve_grievance(db: Session, setup: dict, prefix: str = "sch_res"):
    """Creates a grievance and walks it to RESOLVED status by Assistant Dean."""
    applicant, app_token = create_test_applicant(db, setup, prefix)
    app_headers = {"Authorization": f"Bearer {app_token}"}
    asst_headers = {"Authorization": f"Bearer {setup['asst_token']}"}
    mgr_headers = {"Authorization": f"Bearer {setup['mgr_token']}"}

    # 1. Submit
    payload = {
        "title": "PhD Fellowship Stipend Delay Grievance",
        "description": "Fellowship stipend for the current semester has been delayed pending financial cell reconciliation.",
    }
    sub_res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers=app_headers)
    assert sub_res.status_code == 201
    grv_id = sub_res.json()["data"]["id"]

    # 2. Manager triage
    review_payload = {
        "confirm_category": True,
        "priority": "HIGH",
        "remarks": "Confirmed. Forwarding to Assistant Dean.",
    }
    client.post(f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/review", json=review_payload, headers=mgr_headers)

    # 3. Assistant Dean resolves
    resolve_payload = {
        "resolution_notes": "Disbursement authorized by Dean of R&D. Funds scheduled for direct account transfer.",
    }
    res_res = client.post(f"/api/modules/atharva-veda/nivaran/assistant-dean/grievances/{grv_id}/resolve", json=resolve_payload, headers=asst_headers)
    assert res_res.status_code == 200

    return grv_id, applicant, app_token


# ==========================================
# Phase 6D Tests
# ==========================================

def test_applicant_feedback_flow_and_guards(db_session: Session):
    setup = setup_phase6d_environment(db_session)
    grv_id, applicant, app_token = create_and_resolve_grievance(db_session, setup, "sch_fb1")
    other_app, other_token = create_test_applicant(db_session, setup, "sch_other")

    # 1. Other applicant cannot submit feedback (403 Forbidden)
    fb_payload = {
        "rating": 5,
        "timeliness_rating": 4,
        "fairness_rating": 5,
        "feedback_text": "Excellent resolution by the university.",
    }
    res_unauth = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json=fb_payload,
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_unauth.status_code == 403

    # 2. Invalid rating bounds (< 1 or > 5) rejected
    res_invalid = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json={"rating": 6, "timeliness_rating": 4, "fairness_rating": 5},
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_invalid.status_code == 422

    # 3. Valid feedback submission by owner
    res_valid = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json=fb_payload,
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_valid.status_code == 201
    data = res_valid.json()["data"]
    assert data["rating"] == 5
    assert data["timeliness_rating"] == 4
    assert data["fairness_rating"] == 5

    # 4. Duplicate submission rejected (409 Conflict)
    res_dup = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json=fb_payload,
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_dup.status_code == 409

    # 5. Fetch feedback
    res_get = client.get(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_get.status_code == 200
    assert res_get.json()["data"]["rating"] == 5

    # 6. Verify audit log entry
    audit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.entity_id == str(grv_id),
            AuditLog.action == "FEEDBACK_SUBMITTED",
        )
    )
    assert audit is not None


def test_public_feedback_summary(db_session: Session):
    res = client.get("/api/modules/atharva-veda/nivaran/public/feedback-summary")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "average_rating" in data
    assert "total_feedback" in data


def test_manager_closure_queue_and_detail(db_session: Session):
    setup = setup_phase6d_environment(db_session)
    grv_id, applicant, app_token = create_and_resolve_grievance(db_session, setup, "sch_cq")

    # Before feedback: not in closure queue
    res_q_before = client.get(
        "/api/modules/atharva-veda/nivaran/manager/closure-queue",
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_q_before.status_code == 200
    assert not any(item["id"] == str(grv_id) for item in res_q_before.json()["data"]["items"])

    # Applicant submits feedback
    client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json={"rating": 4, "timeliness_rating": 4, "fairness_rating": 4, "feedback_text": "Satisfied."},
        headers={"Authorization": f"Bearer {app_token}"},
    )

    # After feedback: appears in closure queue
    res_q_after = client.get(
        "/api/modules/atharva-veda/nivaran/manager/closure-queue",
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_q_after.status_code == 200
    queue_items = res_q_after.json()["data"]["items"]
    assert any(item["id"] == str(grv_id) for item in queue_items)

    # Manager inspects closure detail
    res_det = client.get(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/closure-detail",
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_det.status_code == 200
    det = res_det.json()["data"]
    assert det["closure_eligibility"]["can_finalize"] is True
    assert det["feedback"]["rating"] == 4


def test_manager_final_closure_and_automatic_efile(db_session: Session):
    setup = setup_phase6d_environment(db_session)
    grv_id, applicant, app_token = create_and_resolve_grievance(db_session, setup, "sch_close")

    # 1. Attempt closure before feedback -> 400 Bad Request
    res_premature = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/finalize-closure",
        json={"closure_notes": "Premature closure attempt"},
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_premature.status_code == 400

    # 2. Submit applicant feedback
    client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json={"rating": 5, "timeliness_rating": 5, "fairness_rating": 5, "feedback_text": "Complete and prompt."},
        headers={"Authorization": f"Bearer {app_token}"},
    )

    # 3. Unauthorized user cannot close (403 Forbidden)
    res_unauth = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/finalize-closure",
        json={"closure_notes": "Hacker attempt"},
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_unauth.status_code == 403

    # 4. Manager finalizes closure
    res_close = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/finalize-closure",
        json={"closure_notes": "All claims satisfied. Official case formally closed."},
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_close.status_code == 200
    close_data = res_close.json()["data"]
    assert close_data["status"] == "CLOSED"
    assert "e_file_number" in close_data
    assert close_data["e_file_number"].startswith("NVR/EF/")
    assert len(close_data["content_hash"]) == 64

    # 5. Concurrency / Duplicate closure rejection (409 Conflict)
    res_dup_close = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/finalize-closure",
        json={"closure_notes": "Second attempt"},
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_dup_close.status_code == 409

    # 6. Verify E-File in database
    efile = db_session.scalar(select(EFile).where(EFile.grievance_id == uuid.UUID(str(grv_id))))
    assert efile is not None
    assert efile.status == EFileStatus.FINALIZED
    assert efile.is_sealed is True
    assert efile.content_hash == close_data["content_hash"]
    assert os.path.exists(efile.file_path)

    # 7. Verify StudentMasterRecord linkage
    smr = db_session.get(StudentMasterRecord, efile.student_record_id)
    assert smr is not None
    assert smr.student_vyasa_user_id == applicant.id


def test_efile_api_and_cryptographic_verification(db_session: Session):
    setup = setup_phase6d_environment(db_session)
    grv_id, applicant, app_token = create_and_resolve_grievance(db_session, setup, "sch_efile_api")
    other_app, other_token = create_test_applicant(db_session, setup, "sch_other_ef")

    # Submit feedback & finalize closure
    client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}/feedback",
        json={"rating": 5, "timeliness_rating": 4, "fairness_rating": 5},
        headers={"Authorization": f"Bearer {app_token}"},
    )
    close_res = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/finalize-closure",
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    efile_id = close_res.json()["data"]["e_file_id"]

    # 1. Applicant retrieves own E-Files
    res_my = client.get(
        "/api/modules/atharva-veda/nivaran/e-files/my",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_my.status_code == 200
    my_efiles = res_my.json()["data"]
    assert any(ef["id"] == str(efile_id) for ef in my_efiles)

    # 2. Other applicant cannot access E-File (403 Forbidden)
    res_other = client.get(
        f"/api/modules/atharva-veda/nivaran/e-files/{efile_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_other.status_code == 403

    # 3. PDF Download works
    res_down = client.get(
        f"/api/modules/atharva-veda/nivaran/e-files/{efile_id}/download",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_down.status_code == 200
    assert res_down.headers["content-type"] == "application/pdf"

    # 4. Cryptographic Integrity Verification passes
    res_ver = client.get(
        f"/api/modules/atharva-veda/nivaran/e-files/{efile_id}/verify",
    )
    assert res_ver.status_code == 200
    ver_data = res_ver.json()["data"]
    assert ver_data["is_valid"] is True
    assert ver_data["is_sealed"] is True
    assert ver_data["calculated_hash"] == ver_data["stored_hash"]


def test_student_master_record_access_and_search(db_session: Session):
    setup = setup_phase6d_environment(db_session)
    applicant, app_token = create_test_applicant(db_session, setup, "sch_smr")
    other_app, other_token = create_test_applicant(db_session, setup, "sch_smr_other")

    # 1. Applicant gets own SMR
    res_me = client.get(
        "/api/modules/atharva-veda/nivaran/student-records/me",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_me.status_code == 200
    smr_id = res_me.json()["data"]["id"]
    reg_num = res_me.json()["data"]["registration_number_snapshot"]

    # 2. Other applicant cannot access another's SMR (403 Forbidden)
    res_idor = client.get(
        f"/api/modules/atharva-veda/nivaran/student-records/{smr_id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_idor.status_code == 403

    # 3. Manager searches SMR by registration number
    res_search_reg = client.get(
        f"/api/modules/atharva-veda/nivaran/student-records/search?registration_number={reg_num}",
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_search_reg.status_code == 200
    assert res_search_reg.json()["data"]["total"] >= 1
    assert any(item["registration_number_snapshot"] == reg_num for item in res_search_reg.json()["data"]["items"])

    # 4. Manager searches SMR by name
    res_search_name = client.get(
        f"/api/modules/atharva-veda/nivaran/student-records/search?query=sch_smr",
        headers={"Authorization": f"Bearer {setup['mgr_token']}"},
    )
    assert res_search_name.status_code == 200
    assert res_search_name.json()["data"]["total"] >= 1

    # 5. Non-authority (applicant) cannot search directory (403 Forbidden)
    res_search_app = client.get(
        "/api/modules/atharva-veda/nivaran/student-records/search?query=test",
        headers={"Authorization": f"Bearer {app_token}"},
    )
    assert res_search_app.status_code == 403
