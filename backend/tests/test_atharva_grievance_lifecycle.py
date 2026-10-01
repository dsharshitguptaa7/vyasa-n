import uuid
import base64
import random
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.core.security import create_access_token
from app.models.user import User
from app.models.role import Role, user_roles
from app.models.audit import AuditLog
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
    CategoryRoutingType,
    GrievanceStatus,
    GrievancePriority,
)
from app.modules.atharva_veda.nivaran.models.grievance import (
    Grievance,
    GrievanceStatusHistory,
)
from app.modules.atharva_veda.nivaran.models.routing import Assignment
from app.modules.atharva_veda.nivaran.services.ai_classification_pipeline import ai_pipeline

client = TestClient(app)


# ==========================================
# Test Fixtures & Helpers
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
    """Creates an applicant user with a linked ApplicantProfile to test registered subject resolution."""
    user = create_user_with_role(db, "applicant", prefix)
    profile = ApplicantProfile(
        user_id=user.id,
        phd_registration_number=f"PHD-{uuid.uuid4().hex[:6].upper()}",
        department="Computer Science",
        subject_id=setup_data["subject"].id,
        subject_name=setup_data["subject"].name,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    token = create_access_token({"sub": str(user.id)})
    return user, token


def setup_taxonomy_and_authorities(db: Session):
    """
    Retrieves canonical academic and grievance taxonomy tree with authorities.
    """
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

    cat_subject_route = db.scalar(select(Category).where(Category.name == "Fee"))
    cat_cluster_route = db.scalar(select(Category).where(Category.name == "PhD_Admission"))

    return {
        "asst_authority": asst_authority,
        "assoc_authority": assoc_authority,
        "mgr_authority": mgr_authority,
        "mgr_user": mgr_user,
        "subject": subject,
        "subject_cluster": subject_cluster,
        "cat_subject_route": cat_subject_route,
        "cat_cluster_route": cat_cluster_route,
    }



# ==========================================
# Tests
# ==========================================

def test_taxonomy_endpoints(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)

    res = client.get("/api/modules/atharva-veda/nivaran/taxonomy/subjects")
    assert res.status_code == 200
    subjects = res.json()["data"]
    assert any(s["id"] == str(setup["subject"].id) for s in subjects)

    res = client.get("/api/modules/atharva-veda/nivaran/taxonomy/categories")
    assert res.status_code == 200
    categories = res.json()["data"]
    assert any(c["id"] == str(setup["cat_subject_route"].id) for c in categories)


def test_grievance_submission_lifecycle(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "scholar_life")
    headers = {"Authorization": f"Bearer {token}"}

    sample_doc_base64 = base64.b64encode(b"Dummy grievance evidence document content").decode("utf-8")

    # In NIVARAN reference: applicant provides ONLY title, description, and optional documents
    payload = {
        "title": "Unfair grading in Advanced Algorithms Coursework Exam",
        "description": "The evaluation criteria was not followed according to the course syllabus. Multiple questions were skipped in coursework exam.",
        "documents": [
            {
                "file_name": "midterm_exam_paper.pdf",
                "mime_type": "application/pdf",
                "file_size": 1024,
                "content_base64": sample_doc_base64,
                "document_type": "ATTACHMENT",
            }
        ],
    }

    res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()["data"]

    # Verify ID format and state
    assert data["grievance_id"].startswith("CSJMU-")
    assert data["status"] == "PENDING_REVIEW"
    assert data["priority"] == "MEDIUM"
    assert data["subject_id"] == str(setup["subject"].id)  # Auto-resolved from ApplicantProfile
    assert data["category_id"] is not None  # Auto-classified by AI
    assert data["ai_confidence"] is not None
    assert len(data["documents"]) == 1
    assert data["documents"][0]["file_name"] == "midterm_exam_paper.pdf"

    # Verify DB state & history
    grv_id = uuid.UUID(data["id"])
    grv = db_session.get(Grievance, grv_id)
    assert grv is not None
    assert grv.status == GrievanceStatus.PENDING_REVIEW

    # Check status history: SUBMITTED -> PENDING_REVIEW
    history = db_session.scalars(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == grv_id)
        .order_by(GrievanceStatusHistory.created_at.asc())
    ).all()
    assert len(history) == 2
    assert history[0].to_status == GrievanceStatus.SUBMITTED.value
    assert history[1].to_status == GrievanceStatus.PENDING_REVIEW.value

    # Check AuditLog
    audit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.entity_id == str(grv_id),
            AuditLog.action == "grievance.submitted",
        )
    )
    assert audit is not None
    assert audit.module == "atharva_veda"


def test_grievance_submission_daily_quota_limit(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "quota_user")
    headers = {"Authorization": f"Bearer {token}"}

    # 5 distinct topics matching 5 canonical categories (TF-IDF + LR pipeline)
    topics = [

        (
            "Fellowship Monthly Stipend Disbursement Delay",
            "My fellowship monthly stipend disbursement has been delayed by three months without institutional explanation.",
        ),
        (
            "Thesis Synopsis Submission Delay",
            "My PhD thesis synopsis submission documents are pending Dean approval for six weeks past the scheduled deadline.",
        ),
        (
            "Supervisor Co-supervisor Consultation Guidance",
            "Requesting change of supervisor guide consultation due to extended medical leave of current academic advisor.",
        ),
        (
            "Fee Challan Payment Accounting Dues",
            "The semester tuition fee challan payment was debited from bank account but marked as unpaid dues on university portal.",
        ),
        (
            "Viva Defense Oral Exam Scheduling",
            "My final doctoral viva defense oral exam committee scheduling has been delayed past the academic semester timeline.",
        ),
    ]

    # Submit 5 grievances (the maximum daily limit in Asia/Kolkata)
    for i in range(5):
        payload = {
            "title": topics[i][0],
            "description": topics[i][1],
        }
        res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers=headers)
        assert res.status_code == 201, f"Submission {i+1} failed: {res.text}"

    # 6th grievance submission must be rejected with 429 Too Many Requests
    payload_6 = {
        "title": "PhD Admission RET Entrance Form",
        "description": "PhD admission entrance exam RET admit card contains typographical errors in registration number.",
    }
    res_6 = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload_6, headers=headers)
    assert res_6.status_code == 429
    assert "Daily grievance submission limit reached" in res_6.json()["message"]


def test_grievance_submission_deduplication(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "dedup_user")
    headers = {"Authorization": f"Bearer {token}"}

    # First submission: Coursework topic
    payload_1 = {
        "title": "Coursework Evaluation Grade Card Discrepancy",
        "description": "The coursework examination grade was not computed properly according to the course syllabus.",
    }
    res_1 = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload_1, headers=headers)
    assert res_1.status_code == 201

    # Duplicate submission under same active category (Course_Work)
    payload_2 = {
        "title": "Coursework Exam Marksheet Omission",
        "description": "Another coursework examination grade was omitted from semester marksheet.",
    }
    res_2 = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload_2, headers=headers)
    assert res_2.status_code == 409
    assert "already have an active grievance" in res_2.json()["message"]


def test_grievance_isolation_and_detail(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant_a, token_a = create_test_applicant(db_session, setup, "scholar_a")
    applicant_b, token_b = create_test_applicant(db_session, setup, "scholar_b")

    # Applicant A submits
    payload = {
        "title": "Scholar A Confidential Coursework Grievance",
        "description": "Scholar A statement of facts regarding supervisory conduct and lab allocation in coursework.",
    }
    res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers={"Authorization": f"Bearer {token_a}"})
    assert res.status_code == 201
    grv_id = res.json()["data"]["id"]

    # Applicant A can access their own grievance
    res_a = client.get(f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert res_a.status_code == 200
    assert res_a.json()["data"]["id"] == grv_id

    # Applicant A gets their own list
    res_my = client.get("/api/modules/atharva-veda/nivaran/grievances/my", headers={"Authorization": f"Bearer {token_a}"})
    assert res_my.status_code == 200
    assert len(res_my.json()["data"]) >= 1

    # Applicant B cannot access Applicant A's grievance (HTTP 403 Forbidden)
    res_b = client.get(f"/api/modules/atharva-veda/nivaran/grievances/{grv_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert res_b.status_code == 403


def test_manager_triage_queue_and_preview(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, app_token = create_test_applicant(db_session, setup, "scholar_c")
    mgr_token = create_access_token({"sub": str(setup["mgr_user"].id)})

    # Submit a Fee case (classifies into Fee -> routes to Assistant Dean)
    payload = {
        "title": "Fee Challan Payment Accounting Dues",
        "description": "The semester tuition fee challan payment was debited from bank account but marked as unpaid dues on university portal.",
    }
    submit_res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers={"Authorization": f"Bearer {app_token}"})
    assert submit_res.status_code == 201
    grv_id = submit_res.json()["data"]["id"]

    # Applicant cannot access manager queue (HTTP 403)
    res_app = client.get("/api/modules/atharva-veda/nivaran/manager/queue", headers={"Authorization": f"Bearer {app_token}"})
    assert res_app.status_code == 403

    # Manager can access queue
    res_mgr = client.get("/api/modules/atharva-veda/nivaran/manager/queue", headers={"Authorization": f"Bearer {mgr_token}"})
    assert res_mgr.status_code == 200
    queue = res_mgr.json()["data"]
    assert any(item["id"] == grv_id for item in queue)

    # Manager previews routing: Fee category -> routes to Assistant Dean of applicant's subject cluster
    prev_res = client.get(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/preview-routing",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert prev_res.status_code == 200
    prev_data = prev_res.json()["data"]
    assert prev_data["target_authority_id"] == str(setup["asst_authority"].id)
    assert prev_data["target_authority_role"] == "ASSISTANT_DEAN"


def test_manager_review_confirm_category_and_assignment(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, app_token = create_test_applicant(db_session, setup, "scholar_d")
    mgr_token = create_access_token({"sub": str(setup["mgr_user"].id)})

    # Submit Fee case
    payload = {
        "title": "Semester Tuition Fee Receipt Discrepancy",
        "description": "Fee payment challan was submitted to finance department but pending verification in portal records.",
    }
    submit_res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers={"Authorization": f"Bearer {app_token}"})
    assert submit_res.status_code == 201
    grv_id = submit_res.json()["data"]["id"]

    # Manager reviews and confirms category
    review_payload = {
        "confirm_category": True,
        "priority": "HIGH",
        "remarks": "Confirmed academic fee matter. Route to Assistant Dean for review.",
    }
    rev_res = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/review",
        json=review_payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert rev_res.status_code == 200
    data = rev_res.json()["data"]

    # Grievance status transitioned to ASSIGNED
    assert data["status"] == "ASSIGNED"
    assert data["category_reviewed"] is True
    assert data["category_overridden"] is False
    assert data["assigned_authority_id"] == str(setup["asst_authority"].id)

    # Active assignment verified in DB
    assignments = db_session.scalars(
        select(Assignment).where(
            Assignment.grievance_id == uuid.UUID(grv_id),
            Assignment.is_active.is_(True),
        )
    ).all()
    assert len(assignments) == 1
    assert assignments[0].authority_id == setup["asst_authority"].id

    # Check status history
    history = db_session.scalars(
        select(GrievanceStatusHistory)
        .where(GrievanceStatusHistory.grievance_id == uuid.UUID(grv_id))
        .order_by(GrievanceStatusHistory.created_at.asc())
    ).all()
    assert history[-1].to_status == GrievanceStatus.ASSIGNED.value

    # Check AuditLog
    audit = db_session.scalar(
        select(AuditLog).where(
            AuditLog.entity_id == grv_id,
            AuditLog.action == "grievance.assigned",
        )
    )
    assert audit is not None


def test_manager_review_override_category_and_historical_assignment(db_session: Session):
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, app_token = create_test_applicant(db_session, setup, "scholar_e")
    mgr_token = create_access_token({"sub": str(setup["mgr_user"].id)})

    # Submit Fee case
    payload = {
        "title": "Semester Tuition Fee Receipt Discrepancy",
        "description": "Fee payment challan was submitted to finance department but pending verification in portal records.",
    }
    submit_res = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload, headers={"Authorization": f"Bearer {app_token}"})
    assert submit_res.status_code == 201
    grv_id = submit_res.json()["data"]["id"]

    # Manager overrides category to cat_cluster_route (routes to Associate Dean)
    override_payload = {
        "confirm_category": False,
        "override_category_id": str(setup["cat_cluster_route"].id),
        "override_reason": "Applicant issue concerns PhD Admission cluster jurisdiction.",
        "remarks": "Re-routed to Associate Dean Administrative for admission cluster jurisdiction.",
    }
    rev_res = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/review",
        json=override_payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert rev_res.status_code == 200
    data = rev_res.json()["data"]

    # Overridden category verified
    assert data["status"] == "ASSIGNED"
    assert data["category_reviewed"] is True
    assert data["category_overridden"] is True
    assert data["final_category_id"] == str(setup["cat_cluster_route"].id)
    # Under NIVARAN-AI sequential routing, Manager assignment routes to Stage 1: Assistant Dean
    assert data["assigned_authority_id"] == str(setup["asst_authority"].id)
    assert data["assigned_authority_role"] == "ASSISTANT_DEAN"

    # Verify historical assignment preservation on reassignment
    reassign_payload = {
        "confirm_category": False,
        "override_category_id": str(setup["cat_subject_route"].id),
        "override_reason": "Executive correction re-routing back to academic jurisdiction.",
        "remarks": "Reassigned.",
    }
    # Reset status to PENDING_REVIEW in db to simulate re-triage
    grv = db_session.get(Grievance, uuid.UUID(grv_id))
    grv.status = GrievanceStatus.PENDING_REVIEW
    db_session.commit()

    rev_res2 = client.post(
        f"/api/modules/atharva-veda/nivaran/manager/grievances/{grv_id}/review",
        json=reassign_payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert rev_res2.status_code == 200

    # Verify assignments in DB: 1 active, 1 deactivated
    all_assignments = db_session.scalars(
        select(Assignment).where(Assignment.grievance_id == uuid.UUID(grv_id))
    ).all()
    assert len(all_assignments) == 2
    active_assignments = [a for a in all_assignments if a.is_active]
    inactive_assignments = [a for a in all_assignments if not a.is_active]
    assert len(active_assignments) == 1
    assert len(inactive_assignments) == 1
    assert inactive_assignments[0].unassigned_at is not None


# ==========================================
# OCR & AI Parity Tests
# ==========================================

def test_ocr_extract_unauthenticated():
    """Unauthenticated requests to OCR extract must be rejected with 401."""
    res = client.post(
        "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
        files={"file": ("application.png", b"dummy png content", "image/png")},
    )
    assert res.status_code == 401


def test_ocr_extract_invalid_mimetype(db_session: Session):
    """Unsupported MIME types (e.g. .exe, .zip) must be rejected with 400."""
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "ocr_mime_user")

    res = client.post(
        "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("malicious.exe", b"binary content", "application/x-msdownload")},
    )
    assert res.status_code == 400
    msg = res.json().get("message") or res.json().get("detail") or ""
    assert "Unsupported file format" in msg


def test_ocr_extract_empty_file(db_session: Session):
    """Empty files must be rejected with 400."""
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "ocr_empty_user")

    res = client.post(
        "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("empty.png", b"", "image/png")},
    )
    assert res.status_code == 400
    msg = res.json().get("message") or res.json().get("detail") or ""
    assert "empty" in msg.lower()


def test_ocr_extract_oversized_file(db_session: Session):
    """Files exceeding 10MB must be rejected with 400."""
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "ocr_size_user")

    oversized_data = b"X" * (10 * 1024 * 1024 + 1)
    res = client.post(
        "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("large.png", oversized_data, "image/png")},
    )
    assert res.status_code == 400
    msg = res.json().get("message") or res.json().get("detail") or ""
    assert "10MB" in msg


def test_ocr_extract_success_mocked(db_session: Session):
    """Successful OCR extraction returns structured title and description without modifying DB."""
    setup = setup_taxonomy_and_authorities(db_session)
    applicant, token = create_test_applicant(db_session, setup, "ocr_success_user")

    initial_count = db_session.scalar(select(Grievance).where(Grievance.applicant_vyasa_user_id == applicant.id))
    assert initial_count is None

    mock_extracted = {
        "title": "Delayed Research Fellowship Disbursement Q3",
        "description": "My JRF fellowship installment for quarter three has not been credited to bank account.",
        "confidence_note": "Extracted via Gemini Multimodal. Please verify all details before submitting.",
    }

    with patch("app.modules.atharva_veda.nivaran.services.ocr_service.ocr_extractor.extract_from_document", return_value=mock_extracted):
        res = client.post(
            "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": ("handwritten_application.pdf", b"%PDF-1.4 dummy pdf bytes", "application/pdf")},
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["title"] == "Delayed Research Fellowship Disbursement Q3"
        assert "quarter three" in data["description"]
        assert data["confidence_note"] is not None

        # Verify zero DB side effects (input assistance only)
        after_count = db_session.scalar(select(Grievance).where(Grievance.applicant_vyasa_user_id == applicant.id))
        assert after_count is None


def test_ai_classification_pipeline_inference():
    """Verifies that the TF-IDF + LogisticRegression inference pipeline produces expected classifications."""
    # Fellowship topic
    f_cat, f_conf = ai_pipeline.predict_category("Fellowship payout delay", "Stipend disbursement was not credited")
    assert f_cat == "Fellowship"
    assert f_conf > 0.50

    # Coursework topic
    c_cat, c_conf = ai_pipeline.predict_category("Coursework exam evaluation", "Course work exam marksheet error")
    assert c_cat == "Course_Work"
    assert c_conf > 0.50

    # Fallback heuristic
    v_cat, v_conf = ai_pipeline.predict_category("Doctoral defense viva exam", "Viva defense oral exam schedule")
    assert v_cat == "Viva"
    assert v_conf >= 0.70
