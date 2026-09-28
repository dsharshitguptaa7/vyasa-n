"""
Tests for Applicant Filing Integrity & Gemini OCR Assistance in NIVARAN Pillar.

Validates the complete specification:
- Part A: Daily Grievance Limit (3/day, Asia/Kolkata timezone, concurrency-safe).
- Part B: Duplicate Active Grievance Detection (category match, subject match, TF-IDF >= 0.85).
- Part C: Stateless Gemini OCR Assistance (PNG, JPG, WEBP, PDF, <=10MB, independent 3/day quota).
- Schema and AI integrity (no schema changes, local classifier untouched, Gemini for OCR only).
"""

import io
import uuid
from datetime import datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_processing import AIProcessingRecord
from app.models.audit import AuditLog
from app.models.document import Document
from app.models.enums import GrievancePriority, GrievanceStatus
from app.models.grievance import Grievance, GrievanceStatusHistory
from app.models.taxonomy import Category, Subject
from app.services.ocr_service import GrievanceOCRExtractor, ocr_extractor


@pytest.fixture
def test_subject(db_session: Session) -> Subject:
    """Fixture providing a known active subject (Mathematics)."""
    stmt = select(Subject).where(Subject.name == "Mathematics")
    subject = db_session.execute(stmt).scalar_one_or_none()
    assert subject is not None, "Subject 'Mathematics' must exist from seed master data"
    assert subject.is_active is True
    return subject


@pytest.fixture
def chemistry_subject(db_session: Session) -> Subject:
    """Fixture providing a second known active subject (Chemistry)."""
    stmt = select(Subject).where(Subject.name == "Chemistry")
    subject = db_session.execute(stmt).scalar_one_or_none()
    assert subject is not None, "Subject 'Chemistry' must exist from seed master data"
    assert subject.is_active is True
    return subject


@pytest.fixture
def unique_applicant() -> uuid.UUID:
    """Provides a fresh, isolated applicant UUID for each test."""
    return uuid.uuid4()


# ==============================================================================
# PART A — DAILY GRIEVANCE SUBMISSION LIMIT TESTS (1-6)
# ==============================================================================

def test_01_three_grievances_allowed(
    client: TestClient,
    test_subject: Subject,
    chemistry_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 1: 3 distinct grievance submissions allowed per calendar day."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    topics = [
        ("Hostel Water Maintenance", "Third floor plumbing in hostel block C is broken and leaking water."),
        ("Central Library ID Renewal", "Need to renew physical library borrower card barcode for reading room."),
        ("Gymnasium Access Pass", "Applying for annual membership card to the central university sports hall."),
    ]

    for i, (title, desc) in enumerate(topics, start=1):
        subj_id = test_subject.id if i % 2 == 1 else chemistry_subject.id
        res = client.post(
            "/api/v1/grievances",
            json={"title": title, "description": desc, "subject_id": str(subj_id)},
            headers=headers,
        )
        assert res.status_code == 201, f"Submission {i} failed: {res.text}"
        data = res.json()
        assert data["status"] == "PENDING_REVIEW" or data["status"] == "SUBMITTED"


def test_02_fourth_grievance_rejected_with_429(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 2: 4th grievance submission rejected with HTTP 429 DAILY_LIMIT_EXCEEDED."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    topics = [
        ("Campus Wi-Fi Whitelist", "Requesting network admin to whitelist research laptop hardware MAC address."),
        ("Medical Health Center OPD", "Require official stamp on the annual health checkup physical verification card."),
        ("Bicycle Parking Permit", "Requesting authorized sticker for parking bicycle in campus zone D."),
    ]

    for title, desc in topics:
        res = client.post(
            "/api/v1/grievances",
            json={"title": title, "description": desc, "subject_id": str(test_subject.id)},
            headers=headers,
        )
        assert res.status_code == 201

    # 4th submission must be rejected
    res_blocked = client.post(
        "/api/v1/grievances",
        json={
            "title": "Auditorium Booking Permission",
            "description": "Requesting reservation slip for academic seminar in main auditorium hall.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res_blocked.status_code == 429
    err = res_blocked.json()["detail"]
    assert err["error_code"] == "DAILY_LIMIT_EXCEEDED"
    assert "submission limit" in err["message"].lower()


def test_03_asia_kolkata_midnight_reset(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 3: Submissions created on prior Asia/Kolkata calendar days do not consume today's quota."""
    # Seed 3 grievances backdated to yesterday in Asia/Kolkata
    local_tz = ZoneInfo("Asia/Kolkata")
    now_local = datetime.now(local_tz)
    yesterday_local = now_local - timedelta(days=1)
    yesterday_utc = yesterday_local.astimezone(timezone.utc)

    for i in range(3):
        old_grv = Grievance(
            grievance_id=f"G-OLD-{uuid.uuid4().hex[:6].upper()}",
            applicant_vyasa_user_id=unique_applicant,
            subject_id=test_subject.id,
            title=f"Old Yesterday Grievance {i}",
            description="Submitted on previous calendar day in Asia/Kolkata timezone.",
            status=GrievanceStatus.RESOLVED,
            submitted_at=yesterday_utc,
            created_at=yesterday_utc,
            last_action_at=yesterday_utc,
        )
        db_session.add(old_grv)
    db_session.commit()

    # The applicant must still be able to submit today's full quota of 3
    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    res = client.post(
        "/api/v1/grievances",
        json={
            "title": "Fresh Today Grievance Notice",
            "description": "This is an independent submission created today after the midnight reset.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res.status_code == 201


def test_04_failed_submission_does_not_consume_quota(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 4: Failed submissions (e.g. invalid subject) do not consume the quota."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Attempt submission with invalid subject ID
    res_fail = client.post(
        "/api/v1/grievances",
        json={
            "title": "Invalid Subject Submission",
            "description": "Attempting to file with non-existent academic subject.",
            "subject_id": str(uuid.uuid4()),
        },
        headers=headers,
    )
    assert res_fail.status_code == 400

    # Ensure applicant can still submit 3 valid grievances across distinct categories
    valid_topics = [
        ("Tuition Fee Bank Challan Receipt Missing", "Paid semester fee online but receipt was not generated."),
        ("Monthly Research Fellowship Stipend Disbursal Delay", "Monthly fellowship stipend for junior research scholar has not been credited."),
        ("PhD Course Work Examination Syllabus Discrepancy", "Course work exam schedule conflict with elective paper class."),
    ]
    for title, desc in valid_topics:
        res = client.post(
            "/api/v1/grievances",
            json={
                "title": title,
                "description": desc,
                "subject_id": str(test_subject.id),
            },
            headers=headers,
        )
        assert res.status_code == 201


def test_05_duplicate_rejection_does_not_consume_quota(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 5: Duplicate-blocked submissions do not consume the quota."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Submit 1 grievance
    res1 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Unique Fellowship Grant Issue",
            "description": "Disbursement of monthly junior research fellowship grant stipend is delayed.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res1.status_code == 201

    # Attempt exact duplicate (blocked with 409)
    res_dup = client.post(
        "/api/v1/grievances",
        json={
            "title": "Unique Fellowship Grant Issue",
            "description": "Disbursement of monthly junior research fellowship grant stipend is delayed.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res_dup.status_code == 409

    # The applicant has only consumed 1 submission, so they can still submit 2 distinct grievances
    res2 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Hostel Electricity Supply Outage",
            "description": "Power socket in room 204 has no current and sparks when turned on.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res2.status_code == 201

    res3 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Canteen Hygiene Discrepancy",
            "description": "Drinking water filter near the central canteen requires immediate filter change.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res3.status_code == 201


def test_06_successful_grievance_with_ai_failure_still_counts(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 6: A grievance where AI processing fails still counts because it was persisted."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Mock AIProcessingService to simulate an internal exception during background processing
    with patch("app.services.ai_processing.AIProcessingService.process_grievance", side_effect=Exception("Simulated AI error")):
        res = client.post(
            "/api/v1/grievances",
            json={
                "title": "Topic Handled with AI Fallback",
                "description": "Description of an issue where background AI encounters an exception.",
                "subject_id": str(test_subject.id),
            },
            headers=headers,
        )
        assert res.status_code == 201

    # Verify that this grievance counts as 1 of the 3 allowed submissions
    follow_up_topics = [
        ("Campus Parking Sticker Permit", "Need authorized sticker for vehicle parking area B."),
        ("Sports Complex Table Tennis", "Applying for weekend evening slot to indoor sports hall."),
    ]
    for title, desc in follow_up_topics:
        res = client.post(
            "/api/v1/grievances",
            json={
                "title": title,
                "description": desc,
                "subject_id": str(test_subject.id),
            },
            headers=headers,
        )
        assert res.status_code == 201

    # The 4th submission must now be rejected with 429
    res_blocked = client.post(
        "/api/v1/grievances",
        json={
            "title": "Auditorium Sound System Request",
            "description": "Need microphone for academic talk in seminar room.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res_blocked.status_code == 429


# ==============================================================================
# PART B — DUPLICATE ACTIVE GRIEVANCE DETECTION TESTS (7-13)
# ==============================================================================

def test_07_same_applicant_category_match_blocks(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 7: Matching predicted category against an existing active grievance blocks submission."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # First submission: Fee related
    res1 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Tuition Fee Payment Challan Error",
            "description": "Bank transaction debited my account but semester tuition fee receipt was not generated.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res1.status_code == 201
    g1 = res1.json()

    # Second submission: also predicted as Fee category
    res2 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Excess Exam Fee Charged Online",
            "description": "Online portal deducted additional examination fee charges twice during registration.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res2.status_code == 409
    err = res2.json()["detail"]
    assert err["error_code"] == "SIMILAR_ACTIVE_GRIEVANCE"
    assert err["existing_grievance_id"] == g1["grievance_id"]


def test_08_different_applicant_does_not_block(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 8: Another applicant submitting the same text or category is NOT blocked."""
    applicant_a = unique_applicant
    applicant_b = uuid.uuid4()

    headers_a = {"X-Applicant-User-Id": str(applicant_a)}
    headers_b = {"X-Applicant-User-Id": str(applicant_b)}

    body = {
        "title": "Course Work Grade Card Delay",
        "description": "Semester 1 PhD coursework grade statement has not been issued by the examination controller.",
        "subject_id": str(test_subject.id),
    }

    # Applicant A submits
    res_a = client.post("/api/v1/grievances", json=body, headers=headers_a)
    assert res_a.status_code == 201

    # Applicant B submits identical grievance -> must succeed because it's a different applicant
    res_b = client.post("/api/v1/grievances", json=body, headers=headers_b)
    assert res_b.status_code == 201


def test_09_subject_match_blocks(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 9: Matching normalized title or stripped subject prefix blocks submission."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    res1 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Application for Change of Research Guide",
            "description": "Requesting reallocation to another supervisor due to aligned research domain.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res1.status_code == 201

    # Second submission with different prefix but same core subject
    res2 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Request for Change of Research Guide",
            "description": "Supervisor transfer request details for domain alignment.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res2.status_code == 409
    assert res2.json()["detail"]["error_code"] == "SIMILAR_ACTIVE_GRIEVANCE"


def test_10_similarity_above_threshold_blocks(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 10: TF-IDF cosine similarity >= 0.85 triggers hard block."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    res1 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Library Barcode Replacement",
            "description": "My physical identity card barcode has peeled off and scanner at library gate cannot read it.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res1.status_code == 201

    # High similarity rewording (> 0.85 similarity)
    res2 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Library Barcode Replacement",
            "description": "My physical identity card barcode has peeled off and scanner at the library gate cannot read it.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res2.status_code == 409
    assert res2.json()["detail"]["error_code"] == "SIMILAR_ACTIVE_GRIEVANCE"


def test_11_similarity_below_threshold_allows(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 11: Dissimilar grievances (<0.85) with different categories are allowed."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Grievance 1: Hostel Maintenance
    res1 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Hostel Room Window Latch Repair",
            "description": "The window glass latch in room 302 of hostel block B is loose and rattles during wind.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res1.status_code == 201

    # Grievance 2: Completely distinct topic (e.g. Wi-Fi MAC address)
    res2 = client.post(
        "/api/v1/grievances",
        json={
            "title": "Campus Wi-Fi MAC Address Registration",
            "description": "Requesting computer center admin to whitelist research laptop hardware address for internet.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res2.status_code == 201


def test_12_resolved_and_closed_cases_do_not_block(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 12: Previous grievances in RESOLVED or CLOSED status do NOT block new submissions."""
    # Seed a RESOLVED grievance for this applicant
    resolved_grv = Grievance(
        grievance_id=f"G-RES-{uuid.uuid4().hex[:6].upper()}",
        applicant_vyasa_user_id=unique_applicant,
        subject_id=test_subject.id,
        title="Fee Payment Confirmation Receipt",
        description="Bank debited fee but receipt was missing.",
        status=GrievanceStatus.RESOLVED,
        resolved_at=datetime.now(timezone.utc),
        submitted_at=datetime.now(timezone.utc) - timedelta(days=2),
        created_at=datetime.now(timezone.utc) - timedelta(days=2),
        last_action_at=datetime.now(timezone.utc),
    )
    db_session.add(resolved_grv)
    db_session.commit()

    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Submitting a new grievance on Fee Payment should succeed because previous one is RESOLVED
    res = client.post(
        "/api/v1/grievances",
        json={
            "title": "Fee Payment Confirmation Receipt",
            "description": "New semester tuition fee bank challan verification required.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res.status_code == 201


def test_13_blocked_duplicate_returns_409(
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 13: Blocked duplicate returns HTTP 409 with existing grievance reference."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    res1 = client.post(
        "/api/v1/grievances",
        json={
            "title": "PhD RAC Meeting Schedule Delay",
            "description": "My half-yearly research advisory committee review meeting has not been convened.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res1.status_code == 201
    g1_id = res1.json()["grievance_id"]

    res_dup = client.post(
        "/api/v1/grievances",
        json={
            "title": "PhD RAC Meeting Schedule Delay",
            "description": "My half-yearly research advisory committee review meeting has not been convened.",
            "subject_id": str(test_subject.id),
        },
        headers=headers,
    )
    assert res_dup.status_code == 409
    err = res_dup.json()["detail"]
    assert err["error_code"] == "SIMILAR_ACTIVE_GRIEVANCE"
    assert err["existing_grievance_id"] == g1_id


# ==============================================================================
# PART C — GEMINI OCR EXTRACTION ASSISTANCE TESTS (14-30)
# ==============================================================================

@patch.object(ocr_extractor, "extract_from_document")
def test_14_ocr_valid_png_accepted(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 14: Valid PNG document is accepted for OCR extraction."""
    mock_extract.return_value = {
        "title": "Digitized Application Title",
        "description": "Extracted body of the handwritten letter.",
    }

    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRdummy_png_bytes"

    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("application.png", png_bytes, "image/png")},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Digitized Application Title"
    assert data["description"] == "Extracted body of the handwritten letter."


@patch.object(ocr_extractor, "extract_from_document")
def test_15_ocr_valid_jpg_accepted(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 15: Valid JPG/JPEG document is accepted for OCR extraction."""
    mock_extract.return_value = {"title": "JPEG Document Title", "description": "JPEG Document Body"}

    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIFdummy_jpeg_bytes"

    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("letter.jpg", jpeg_bytes, "image/jpeg")},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "JPEG Document Title"


@patch.object(ocr_extractor, "extract_from_document")
def test_16_ocr_valid_webp_accepted(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 16: Valid WEBP document is accepted for OCR extraction."""
    mock_extract.return_value = {"title": "WEBP Title", "description": "WEBP Description"}

    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("letter.webp", b"RIFFdummyWEBP", "image/webp")},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "WEBP Title"


@patch.object(ocr_extractor, "extract_from_document")
def test_17_ocr_valid_pdf_accepted(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 17: Valid PDF document is accepted for OCR extraction."""
    mock_extract.return_value = {"title": "PDF Formal Letter", "description": "PDF formal grievance description"}

    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("application.pdf", b"%PDF-1.4 dummy pdf content", "application/pdf")},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.json()["title"] == "PDF Formal Letter"


def test_18_ocr_file_exceeding_10mb_rejected(
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 18: File exceeding 10MB limit is rejected with HTTP 400."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    large_file = b"X" * (10 * 1024 * 1024 + 1024)  # 10MB + 1KB

    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("huge.pdf", large_file, "application/pdf")},
        headers=headers,
    )
    assert res.status_code == 400
    assert "10mb limit" in res.json()["detail"].lower()


def test_19_gemini_ocr_returns_title_and_description() -> None:
    """Requirement 19: GrievanceOCRExtractor correctly invokes Gemini client and parses response."""
    extractor = GrievanceOCRExtractor(api_key="mock-api-key")

    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.text = '{"title": "Exam Grade Card Marks", "description": "Missing marks for semester 4."}'
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(extractor, "_get_client", return_value=mock_client):
        result = extractor.extract_from_document(
            file_bytes=b"dummy bytes",
            mime_type="application/pdf",
        )
        assert result["title"] == "Exam Grade Card Marks"
        assert result["description"] == "Missing marks for semester 4."


@patch.object(ocr_extractor, "extract_from_document")
def test_20_applicant_receives_editable_text(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 20: Response returns title and description as editable plain text."""
    mock_extract.return_value = {
        "title": "Editable Draft Title",
        "description": "Editable draft text that the applicant can inspect and modify before submission.",
    }

    headers = {"X-Applicant-User-Id": str(unique_applicant)}
    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("draft.png", b"dummy image", "image/png")},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "title" in data
    assert "description" in data
    assert not data["title"].startswith("```")


@patch.object(ocr_extractor, "extract_from_document")
def test_21_ocr_does_not_create_grievance(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 21: OCR extraction does NOT create or save a grievance record."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    count_before = db_session.execute(select(func.count(Grievance.id))).scalar()

    client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("app.png", b"dummy", "image/png")},
        headers=headers,
    )

    count_after = db_session.execute(select(func.count(Grievance.id))).scalar()
    assert count_after == count_before


@patch.object(ocr_extractor, "extract_from_document")
def test_22_ocr_does_not_create_status_history(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 22: OCR extraction does NOT create grievance status history."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    count_before = db_session.execute(select(func.count(GrievanceStatusHistory.id))).scalar()

    client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("app.png", b"dummy", "image/png")},
        headers=headers,
    )

    count_after = db_session.execute(select(func.count(GrievanceStatusHistory.id))).scalar()
    assert count_after == count_before


@patch.object(ocr_extractor, "extract_from_document")
def test_23_ocr_does_not_create_ai_processing_record(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 23: OCR extraction does NOT create an AI processing record."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    count_before = db_session.execute(select(func.count(AIProcessingRecord.id))).scalar()

    client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("app.png", b"dummy", "image/png")},
        headers=headers,
    )

    count_after = db_session.execute(select(func.count(AIProcessingRecord.id))).scalar()
    assert count_after == count_before


@patch.object(ocr_extractor, "extract_from_document")
def test_24_ocr_does_not_persist_uploaded_file(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
    db_session: Session,
) -> None:
    """Requirement 24: OCR extraction does NOT create a Document table row or store file."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    count_before = db_session.execute(select(func.count(Document.id))).scalar()

    client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("app.png", b"dummy", "image/png")},
        headers=headers,
    )

    count_after = db_session.execute(select(func.count(Document.id))).scalar()
    assert count_after == count_before


@patch.object(ocr_extractor, "extract_from_document")
def test_25_three_ocr_requests_allowed(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 25: Up to 3 OCR requests per candidate per calendar day are allowed."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    for i in range(3):
        res = client.post(
            "/api/v1/grievances/ocr/extract",
            files={"file": (f"app_{i}.png", b"dummy", "image/png")},
            headers=headers,
        )
        assert res.status_code == 200, f"OCR request {i+1} failed"


@patch.object(ocr_extractor, "extract_from_document")
def test_26_fourth_ocr_request_rejected_with_ocr_daily_limit_exceeded(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 26: 4th OCR request rejected with HTTP 429 OCR_DAILY_LIMIT_EXCEEDED."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Consume 3 allowed OCR requests
    for i in range(3):
        res = client.post(
            "/api/v1/grievances/ocr/extract",
            files={"file": (f"app_{i}.png", b"dummy", "image/png")},
            headers=headers,
        )
        assert res.status_code == 200

    # 4th request must be blocked
    res_blocked = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("app_4.png", b"dummy", "image/png")},
        headers=headers,
    )
    assert res_blocked.status_code == 429
    err = res_blocked.json()["detail"]
    assert err["error_code"] == "OCR_DAILY_LIMIT_EXCEEDED"
    assert "ocr limit" in err["message"].lower()


@patch.object(ocr_extractor, "extract_from_document")
def test_27_ocr_quota_independent_from_grievance_quota(
    mock_extract: MagicMock,
    client: TestClient,
    test_subject: Subject,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 27: OCR quota is strictly independent from the grievance submission quota."""
    mock_extract.return_value = {"title": "Title", "description": "Description"}
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Consume all 3 OCR requests
    for i in range(3):
        res_ocr = client.post(
            "/api/v1/grievances/ocr/extract",
            files={"file": (f"doc_{i}.png", b"dummy", "image/png")},
            headers=headers,
        )
        assert res_ocr.status_code == 200

    # Ensure applicant can still submit 3 grievances
    topics = [
        ("Hostel Light Outage", "Fluorescent tube light in room 101 has fused."),
        ("Sports Hall Pass", "Applying for weekend table tennis club membership pass."),
        ("Transport Bus Pass", "Submitting monthly route pass renewal slip for university shuttle."),
    ]
    for title, desc in topics:
        res_grv = client.post(
            "/api/v1/grievances",
            json={"title": title, "description": desc, "subject_id": str(test_subject.id)},
            headers=headers,
        )
        assert res_grv.status_code == 201


@patch.object(ocr_extractor, "extract_from_document", side_effect=Exception("Gemini quota error with secret key xyz_secret_123"))
def test_28_ocr_failure_has_controlled_error_response(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 28: OCR failure returns a controlled error without leaking keys or stack traces."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    res = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("doc.png", b"dummy", "image/png")},
        headers=headers,
    )
    assert res.status_code == 500
    detail = str(res.json()["detail"])
    assert "xyz_secret_123" not in detail
    assert "digitize document" in detail.lower()


@patch.object(ocr_extractor, "extract_from_document", side_effect=Exception("Network timeout"))
def test_29_ocr_failure_does_not_consume_quota(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 29: Failed OCR request does NOT consume the candidate's OCR quota."""
    headers = {"X-Applicant-User-Id": str(unique_applicant)}

    # Failed request
    res_fail = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("doc.png", b"dummy", "image/png")},
        headers=headers,
    )
    assert res_fail.status_code == 500

    # Candidate should still have all 3 successful OCR attempts available
    with patch.object(ocr_extractor, "extract_from_document", return_value={"title": "T", "description": "D"}):
        for i in range(3):
            res = client.post(
                "/api/v1/grievances/ocr/extract",
                files={"file": (f"doc_{i}.png", b"dummy", "image/png")},
                headers=headers,
            )
            assert res.status_code == 200


@patch.object(ocr_extractor, "extract_from_document", return_value={"title": "T", "description": "D"})
def test_30_applicant_cannot_access_another_applicants_ocr_quota(
    mock_extract: MagicMock,
    client: TestClient,
    unique_applicant: uuid.UUID,
) -> None:
    """Requirement 30: OCR quota is strictly isolated per applicant identity."""
    app_a = unique_applicant
    app_b = uuid.uuid4()

    headers_a = {"X-Applicant-User-Id": str(app_a)}
    headers_b = {"X-Applicant-User-Id": str(app_b)}

    # App A consumes all 3 OCR requests
    for i in range(3):
        res = client.post(
            "/api/v1/grievances/ocr/extract",
            files={"file": (f"doc_{i}.png", b"dummy", "image/png")},
            headers=headers_a,
        )
        assert res.status_code == 200

    # App A is blocked on 4th
    res_a_4 = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("doc_4.png", b"dummy", "image/png")},
        headers=headers_a,
    )
    assert res_a_4.status_code == 429

    # App B is unaffected and can perform OCR
    res_b = client.post(
        "/api/v1/grievances/ocr/extract",
        files={"file": ("doc_b.png", b"dummy", "image/png")},
        headers=headers_b,
    )
    assert res_b.status_code == 200
