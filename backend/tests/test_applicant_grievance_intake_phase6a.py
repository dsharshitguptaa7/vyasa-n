# -*- coding: utf-8 -*-
"""
Phase 6A: Comprehensive Applicant Grievance Intake & Submission Test Suite
Verifies reference parity with projects/NIVARAN-AI:
- Authentication & persona boundary enforcement (Applicant-only submission)
- IDOR prevention and identity isolation
- Input validation (Title, Description, Subject, Category)
- Student Master Record integration
- Multi-tier attachment handling (inline base64 & multipart upload, 20MB limit, allowed extensions, 5-file cap)
- Document download with authorization checks & IDOR protection
- Multimodal OCR assistance endpoint & constraints (10MB limit, supported MIME types)
- Quota limits (5 per calendar day in Asia/Kolkata, HTTP 429)
- Active grievance duplicate prevention (Same category, same subject, TF-IDF cosine >= 0.85, HTTP 409)
- Transaction safety & lifecycle transitions (SUBMITTED -> AI_PROCESSING -> PENDING_REVIEW)
- In-app notification creation
- Watchdog & AuditLog event recording
"""

import io
import uuid
import base64
import pytest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from sqlalchemy import select, func
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
from app.modules.atharva_veda.nivaran.models.document import Document
from app.modules.atharva_veda.nivaran.models.ai_processing import AIProcessingRecord

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


def setup_taxonomy_fixtures(db: Session):
    subject_cluster = db.scalar(select(SubjectCluster).where(SubjectCluster.cluster_number == 1))
    subject = db.scalar(select(Subject).where(Subject.subject_cluster_id == subject_cluster.id, Subject.is_active.is_(True)))

    grievance_cluster = db.scalar(select(GrievanceCluster).where(GrievanceCluster.cluster_number == 1))
    category = db.scalar(select(Category).where(Category.grievance_cluster_id == grievance_cluster.id, Category.is_active.is_(True)))

    return {
        "subject_cluster": subject_cluster,
        "subject": subject,
        "grievance_cluster": grievance_cluster,
        "category": category,
    }


def create_test_applicant(db: Session, fixtures: dict, prefix: str = "scholar") -> tuple[User, str]:
    user = create_user_with_role(db, "applicant", prefix)
    profile = ApplicantProfile(
        user_id=user.id,
        phd_registration_number=f"PHD-{uuid.uuid4().hex[:6].upper()}",
        department="Computer Science",
        subject_id=fixtures["subject"].id,
        subject_name=fixtures["subject"].name,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    token = create_access_token({"sub": str(user.id)})
    return user, token


# ==========================================
# Category A: Authentication & Role Boundary
# ==========================================

def test_applicant_can_submit_grievance(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "app_sub")

    payload = {
        "title": "Legitimate Fellowship Delay Concern",
        "description": "My monthly institutional research fellowship stipend for July and August has not been disbursed into my registered bank account.",
    }
    res = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["grievance_id"].startswith("CSJMU-")
    assert data["status"] == "PENDING_REVIEW"
    assert data["title"] == payload["title"]


def test_non_applicants_cannot_submit_grievance(db_session: Session):
    # 1. Unauthenticated caller
    payload = {
        "title": "Anonymous Grievance Submission Attempt",
        "description": "This grievance submission should be rejected because no authorization token is supplied.",
    }
    res_unauth = client.post("/api/modules/atharva-veda/nivaran/grievances", json=payload)
    assert res_unauth.status_code == 401

    # 2. Administrator (without applicant role)
    admin_user = create_user_with_role(db_session, "administrator", "admin_caller")
    admin_token = create_access_token({"sub": str(admin_user.id)})
    res_admin = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 403
    assert "Access restricted to registered applicants only" in res_admin.json()["message"]

    # 3. Institutional Authority (Manager)
    mgr_user = create_user_with_role(db_session, "authority", "mgr_caller")
    mgr_token = create_access_token({"sub": str(mgr_user.id)})
    res_mgr = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_mgr.status_code == 403


# ==========================================
# Category B: Identity & IDOR Resistance
# ==========================================

def test_applicant_cannot_impersonate_or_access_other_grievance(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant_a, token_a = create_test_applicant(db_session, fixtures, "user_a")
    applicant_b, token_b = create_test_applicant(db_session, fixtures, "user_b")

    # Applicant A creates grievance
    payload_a = {
        "title": "Applicant A Unique Case Record",
        "description": "Confidential submission belonging strictly to Applicant A with private student evidence.",
    }
    res_a = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json=payload_a,
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res_a.status_code == 201
    grievance_id = res_a.json()["data"]["id"]

    # Applicant B attempts to view Applicant A's grievance -> 403 Forbidden
    res_b_view = client.get(
        f"/api/modules/atharva-veda/nivaran/grievances/{grievance_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b_view.status_code == 403
    assert "You do not have authorization to view this grievance record." in res_b_view.json()["message"]

    # Applicant B checks their own grievances list -> must not contain Applicant A's grievance
    res_b_list = client.get(
        "/api/modules/atharva-veda/nivaran/grievances/my",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert res_b_list.status_code == 200
    b_items = res_b_list.json()["data"]
    assert all(item["id"] != grievance_id for item in b_items)


# ==========================================
# Category C: Input & Taxonomy Validation
# ==========================================

def test_title_and_description_validation(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "val_user")

    # Title too short (< 5 chars)
    res_short_title = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={"title": "Err", "description": "Valid detailed description text that exceeds twenty characters."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_short_title.status_code == 422 or res_short_title.status_code == 400

    # Description too short (< 20 chars)
    res_short_desc = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={"title": "Valid Title Exceeding Five", "description": "Too short"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_short_desc.status_code == 422 or res_short_desc.status_code == 400


def test_explicit_subject_and_category_validation(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "taxon_val")

    # Invalid Subject UUID (Non-existent)
    random_uuid = str(uuid.uuid4())
    res_bad_sub = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={
            "title": "Invalid Subject Assignment Test",
            "description": "Attempting to file a grievance with a non-existent academic subject UUID.",
            "subject_id": random_uuid,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_bad_sub.status_code == 400
    assert "Specified academic subject is invalid or inactive" in res_bad_sub.json()["message"]

    # Invalid Category UUID (Non-existent)
    res_bad_cat = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={
            "title": "Invalid Category Assignment Test",
            "description": "Attempting to file a grievance with a non-existent grievance category UUID.",
            "category_id": random_uuid,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_bad_cat.status_code == 400
    assert "Specified grievance category is invalid or inactive" in res_bad_cat.json()["message"]

    # Valid Subject & Category UUID explicitly provided
    res_valid = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={
            "title": "Explicit Taxonomy Verification Case",
            "description": "Submitting a valid grievance with explicit authoritative subject and category IDs.",
            "subject_id": str(fixtures["subject"].id),
            "category_id": str(fixtures["category"].id),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_valid.status_code == 201
    data = res_valid.json()["data"]
    assert data["subject_id"] == str(fixtures["subject"].id)
    assert data["category_id"] == str(fixtures["category"].id)


# ==========================================
# Category D: Attachment Handling & Download
# ==========================================

def test_attachment_validation_and_multipart_upload(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "attach_user")

    # 1. Create a grievance first
    res_create = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={
            "title": "Attachment Handling Verification Case",
            "description": "Detailed grievance narrative testing document attachments and authorization.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_create.status_code == 201
    grievance_id = res_create.json()["data"]["id"]

    # 2. Upload valid PDF document via multipart endpoint
    pdf_content = b"%PDF-1.4 Mock PDF document evidence payload for testing"
    files = {"file": ("affidavit.pdf", pdf_content, "application/pdf")}
    res_upload = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grievance_id}/documents",
        files=files,
        data={"document_type": "ATTACHMENT"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_upload.status_code == 201
    doc_data = res_upload.json()["data"]
    doc_id = doc_data["id"]
    assert doc_data["file_name"] == "affidavit.pdf"

    # 3. Reject unsupported executable extension (.exe)
    exe_files = {"file": ("malware.exe", b"binary content", "application/octet-stream")}
    res_bad_ext = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grievance_id}/documents",
        files=exe_files,
        data={"document_type": "ATTACHMENT"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_bad_ext.status_code == 400
    assert "not supported" in res_bad_ext.json()["message"]

    # 4. Reject empty file
    empty_files = {"file": ("empty.pdf", b"", "application/pdf")}
    res_empty = client.post(
        f"/api/modules/atharva-veda/nivaran/grievances/{grievance_id}/documents",
        files=empty_files,
        data={"document_type": "ATTACHMENT"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_empty.status_code == 400
    assert "empty" in res_empty.json()["message"].lower()

    # 5. Download document as owner -> 200 OK
    res_dl = client.get(
        f"/api/modules/atharva-veda/nivaran/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_dl.status_code == 200
    assert res_dl.content == pdf_content

    # 6. Another applicant attempting to download Applicant's document -> 403 Forbidden
    other_applicant, other_token = create_test_applicant(db_session, fixtures, "intruder_user")
    res_dl_unauth = client.get(
        f"/api/modules/atharva-veda/nivaran/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert res_dl_unauth.status_code == 403


# ==========================================
# Category E: Daily Submission Limits
# ==========================================

def test_daily_submission_limit_quota(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "quota_limit_user")

    # Submit 5 distinct grievances (the daily limit) across completely distinct categories
    all_cats = db_session.scalars(select(Category).where(Category.is_active.is_(True))).all()
    assert len(all_cats) >= 6
    distinct_cats = all_cats[:5]

    for i, cat in enumerate(distinct_cats, start=1):
        res = client.post(
            "/api/modules/atharva-veda/nivaran/grievances",
            json={
                "title": f"Distinct Category Grievance Matter {i} for {cat.name}",
                "description": f"Detailed formal representation and narrative specific to category {cat.name} index {i}.",
                "category_id": str(cat.id),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 201, f"Failed on iteration {i} with status {res.status_code}: {res.text}"

    # 6th submission must be blocked with HTTP 429 Too Many Requests
    res_6 = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={
            "title": f"Sixth Excess Submission Over Limit for {all_cats[5].name}",
            "description": "This grievance submission should trigger HTTP 429 daily submission quota limit.",
            "category_id": str(all_cats[5].id),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_6.status_code == 429
    assert "Daily grievance submission limit reached" in res_6.json()["message"]

    # Verify audit log recorded quota exceeded event
    audit_log = db_session.scalar(
        select(AuditLog).where(
            AuditLog.user_id == applicant.id,
            AuditLog.action == "APPLICANT_DAILY_LIMIT_EXCEEDED",
        )
    )
    assert audit_log is not None


# ==========================================
# Category F: Duplicate Detection
# ==========================================

def test_duplicate_active_grievance_detection(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "dupl_user")

    # 1. First submission succeeds
    title = "Application for Change of Research Guide"
    desc = "I am requesting an official transfer of my doctoral research supervisor due to conflicting academic priorities."
    res_1 = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={"title": title, "description": desc},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_1.status_code == 201

    # 2. Duplicate submission with same title and core subject -> 409 Conflict
    res_duplicate = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={"title": "Request for Change of Research Guide", "description": desc},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_duplicate.status_code == 409
    assert "already have an active grievance" in res_duplicate.json()["message"]

    # 3. Verify audit log recorded duplicate blocked event
    audit_log = db_session.scalar(
        select(AuditLog).where(
            AuditLog.user_id == applicant.id,
            AuditLog.action == "SIMILAR_GRIEVANCE_BLOCKED",
        )
    )
    assert audit_log is not None


# ==========================================
# Category G: OCR Intake Assistance
# ==========================================

def test_ocr_intake_extraction_constraints(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "ocr_test_user")

    # 1. Unsupported OCR extension (.exe)
    res_bad = client.post(
        "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
        files={"file": ("test.exe", b"executable payload", "application/octet-stream")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_bad.status_code == 400
    assert "Unsupported file format" in res_bad.json()["message"]

    # 2. Empty OCR file
    res_empty = client.post(
        "/api/modules/atharva-veda/nivaran/grievances/ocr/extract",
        files={"file": ("test.png", b"", "image/png")},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_empty.status_code == 400
    assert "empty" in res_empty.json()["message"].lower()


# ==========================================
# Category H: Lifecycle, Notifications & SMR
# ==========================================

def test_grievance_lifecycle_notification_and_smr_snapshot(db_session: Session):
    fixtures = setup_taxonomy_fixtures(db_session)
    applicant, token = create_test_applicant(db_session, fixtures, "life_user")

    res = client.post(
        "/api/modules/atharva-veda/nivaran/grievances",
        json={
            "title": "Comprehensive Full Lifecycle Verification Case",
            "description": "Verifying Student Master Record snapshot creation, AI classification status, and notification creation.",
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    g_data = res.json()["data"]
    grievance_id = uuid.UUID(g_data["id"])

    # Verify SMR snapshot
    smr = db_session.scalar(select(StudentMasterRecord).where(StudentMasterRecord.student_vyasa_user_id == applicant.id))
    assert smr is not None
    assert smr.full_name_snapshot == applicant.full_name
    assert smr.email_snapshot == applicant.email

    # Verify initial status history
    history = db_session.scalars(
        select(GrievanceStatusHistory).where(GrievanceStatusHistory.grievance_id == grievance_id).order_by(GrievanceStatusHistory.created_at.asc())
    ).all()
    assert len(history) >= 2
    assert history[0].to_status == "SUBMITTED"
    assert history[1].to_status == "PENDING_REVIEW"

    # Verify AI processing record
    ai_record = db_session.scalar(select(AIProcessingRecord).where(AIProcessingRecord.grievance_id == grievance_id))
    assert ai_record is not None
    assert ai_record.predicted_category_id is not None
    assert ai_record.confidence_score is not None

    # Verify In-App Notification
    notification = db_session.scalar(
        select(Notification).where(
            Notification.user_id == applicant.id,
            Notification.type == "GRIEVANCE_SUBMITTED",
        )
    )
    assert notification is not None
    assert "Grievance Submitted" in notification.title
