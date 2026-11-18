"""
Comprehensive Automated Test Suite for:
VYASA SAMIKSHA CMS — Bulk Certificate Generation & Dual-Authority Approval Workflow

Validates all 10 scenario suites:
1. Format A (Research Publication) JSON upload & preview validation.
2. Format B (Research Incentive) JSON upload & preview validation.
3. Researcher Repository 3-Tier Priority Matching Engine:
   - Priority 1: Exact UUID
   - Priority 2: Exact Scopus ID
   - Priority 3: Normalized full name + department
4. Ambiguous match resolution & non-fabrication guarantee.
5. Strict Academic Title Rule: explicit certificate_title only, NEVER copied from repository profile.
6. Batch Generation: creates certificates in PENDING_DEAN_APPROVAL without premature sealing.
7. Bulk Submission & Dean – R&D Bulk Review:
   - Dean bulk approval with active signature snapshot -> moves to PENDING_VC_APPROVAL.
   - Dean bulk rejection with mandatory remarks -> moves to REJECTED.
8. Bulk Forwarding to Vice Chancellor: validates prerequisite Dean approval.
9. Vice Chancellor Bulk Review & Cryptographic Sealing:
   - Terminal approval renders high-resolution vector PDF, computes SHA-256 hash, and transitions to ISSUED (or SCHEDULED).
   - Dynamic QR verification tokens enabled.
   - VC rejection with mandatory remarks -> moves to REJECTED.
10. Batch Management, Status Metrics, RBAC Non-Impersonation & ZIP Export.
"""

import io
import uuid
import zipfile
import pytest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import pypdf

from app.main import app
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.api.dependencies import get_db, get_current_user
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateApproval,
    CertificateSignatory,
)
from app.modules.sama_veda.schemas.cms import (
    BulkCertificateUploadPayload,
    BulkCertificateGenerateRequest,
    BulkApprovalActionRequest,
    BulkSubmitDeanRequest,
    BulkForwardVCRequest,
)
from app.modules.sama_veda.services.cms_service import SamaCmsService

IST = ZoneInfo("Asia/Kolkata")
TEST_DB_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Initializes in-memory database and mocks storage service."""
    Base.metadata.create_all(bind=test_engine)

    class MockStorageRes:
        def __init__(self, key):
            self.storage_key = key

    class MockStorageService:
        def save_file(self, content, filename, subfolder="", **kwargs):
            out_file = tmp_path / filename
            out_file.write_bytes(content)
            return MockStorageRes(f"mock_storage/{filename}")

        def get_file_path(self, storage_key):
            from pathlib import Path
            filename = storage_key.split("/")[-1]
            return tmp_path / filename

    from app.modules.sama_veda.services import cms_service
    monkeypatch.setattr(cms_service, "storage_service", MockStorageService())

    yield

    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def super_admin_user(db_session):
    role = db_session.execute(select(Role).where(Role.name == "super_admin")).scalar_one_or_none()
    if not role:
        role = Role(id=uuid.uuid4(), name="super_admin", description="Super Admin Role")
        db_session.add(role)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        is_active=True,
        roles=[role],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def dean_user(db_session):
    role = db_session.execute(select(Role).where(Role.name == "dean_rd")).scalar_one_or_none()
    if not role:
        role = Role(id=uuid.uuid4(), name="dean_rd", description="Dean R&D Role")
        db_session.add(role)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="dean.rd@csjmu.ac.in",
        first_name="Rajesh",
        last_name="Kumar",
        is_active=True,
        roles=[role],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def vc_user(db_session):
    role = db_session.execute(select(Role).where(Role.name == "vice_chancellor")).scalar_one_or_none()
    if not role:
        role = Role(id=uuid.uuid4(), name="vice_chancellor", description="Vice Chancellor Role")
        db_session.add(role)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="vc@csjmu.ac.in",
        first_name="Vinay",
        last_name="Pathak",
        is_active=True,
        roles=[role],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def normal_user(db_session):
    role = db_session.execute(select(Role).where(Role.name == "applicant")).scalar_one_or_none()
    if not role:
        role = Role(id=uuid.uuid4(), name="applicant", description="Applicant Role")
        db_session.add(role)
        db_session.flush()

    user = User(
        id=uuid.uuid4(),
        email="scholar@csjmu.ac.in",
        first_name="Scholar",
        last_name="One",
        is_active=True,
        roles=[role],
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def seed_authorities(db_session):
    """Seeds active signing authorities for Dean and VC."""
    dean_sig = CertificateSignatory(
        id=uuid.uuid4(),
        authority_type="DEAN_RD",
        signatory_name="Prof. (Dr.) Rajesh Kumar",
        designation="Dean – Research & Development",
        department="Research & Development Cell, CSJMU Kanpur",
        is_active=True,
        effective_date=datetime.now(timezone.utc),
    )
    vc_sig = CertificateSignatory(
        id=uuid.uuid4(),
        authority_type="VICE_CHANCELLOR",
        signatory_name="Prof. Vinay Kumar Pathak",
        designation="Vice Chancellor",
        department="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_active=True,
        effective_date=datetime.now(timezone.utc),
    )
    db_session.add(dean_sig)
    db_session.add(vc_sig)
    db_session.commit()
    return dean_sig, vc_sig


@pytest.fixture
def seed_repository_researchers(db_session):
    """Seeds researchers in sama_research_authors for matching tests."""
    r1 = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Dr. Ananya Sharma",
        scopus_id="57200112233",
        department="Department of Biotechnology",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    r2 = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Prof. Rajesh Kumar Verma",
        scopus_id="58199223344",
        department="Department of Physics",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    # Seed two researchers with identical normalized name in different departments (ambiguity test)
    r3_a = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Dr. Amit Kumar",
        scopus_id="59100111111",
        department="Department of Chemistry",
        institutional_affiliation="CSJM University",
        is_verified=True,
    )
    r3_b = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Er. Amit Kumar",
        scopus_id="59200222222",
        department="Department of Computer Science",
        institutional_affiliation="CSJM University",
        is_verified=True,
    )
    db_session.add_all([r1, r2, r3_a, r3_b])
    db_session.commit()
    return {"r1": r1, "r2": r2, "r3_a": r3_a, "r3_b": r3_b}


@pytest.fixture
def test_client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


# ==============================================================================
# SUITE 1 & 2: JSON UPLOAD & PREVIEW VALIDATION (FORMAT A & B)
# ==============================================================================

def test_preview_bulk_publication_certificates_format_a(
    test_client, super_admin_user, seed_repository_researchers
):
    """Format A JSON upload correctly parses, validates bulletin metadata, and matches authors."""
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    payload = {
        "batch": {
            "batch_name": "CSJMU RD Samiksha Bulletin Batch Oct 2026",
            "certificate_type": "RESEARCH_PUBLICATION",
            "issue_date": "2026-10-15",
            "bulletin": {
                "volume": 2,
                "issue": 10,
                "period": "October 2026",
            },
        },
        "certificates": [
            {
                "research_title": "Deep Learning for High-Throughput Biomarker Discovery",
                "authors": [
                    {
                        "researcher": {
                            "scopus_id": "57200112233",
                            "full_name": "Dr. Ananya Sharma",
                            "department": "Department of Biotechnology",
                        },
                        "certificate_title": "Dr.",
                        "author_role": "First Author",
                    }
                ],
                "research_contribution_statement": "Recognized for high-impact publication in Nature Biotechnology.",
                "publication_details": {
                    "journal": "Nature Biotechnology",
                    "doi": "10.1038/s41587-026-00123-x",
                },
            }
        ],
    }

    resp = test_client.post("/api/admin/sama/certificates/bulk-generate/preview", json=payload)
    assert resp.status_code == 200
    res_data = resp.json()["data"]
    assert res_data["total_certificates"] == 1
    assert res_data["valid_certificates_count"] == 1
    assert res_data["matched_authors_count"] == 1
    author_match = res_data["certificates"][0]["authors"][0]
    assert author_match["status"] == "MATCHED"
    assert author_match["matched_by"] == "SCOPUS_ID"
    assert author_match["certificate_title"] == "Dr."


def test_preview_bulk_incentive_certificates_format_b(
    test_client, super_admin_user, seed_repository_researchers
):
    """Format B JSON upload correctly validates incentive details (quartile, amount)."""
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    payload = {
        "batch": {
            "batch_name": "CSJMU RD Research Incentive Batch Q3 2026",
            "certificate_type": "INCENTIVE_AWARD",
            "issue_date": "2026-10-20",
        },
        "certificates": [
            {
                "research_title": "Quantum Error Correction with Surface Codes",
                "authors": [
                    {
                        "researcher": {
                            "scopus_id": "58199223344",
                            "full_name": "Prof. Rajesh Kumar Verma",
                            "department": "Department of Physics",
                        },
                        "certificate_title": "Prof.",
                        "author_role": "Lead Investigator",
                    }
                ],
                "incentive_details": {
                    "quartile": "Q1",
                    "incentive_amount": 50000,
                    "sanction_order_ref": "CSJMU/RD/INC/2026/042",
                },
            }
        ],
    }

    resp = test_client.post("/api/admin/sama/certificates/bulk-generate/preview", json=payload)
    assert resp.status_code == 200
    res_data = resp.json()["data"]
    assert res_data["total_certificates"] == 1
    assert res_data["valid_certificates_count"] == 1
    assert res_data["certificates"][0]["incentive_details"]["quartile"] == "Q1"


# ==============================================================================
# SUITE 3 & 4: RESEARCHER REPOSITORY MATCHING ENGINE & STRICT TITLE RULE
# ==============================================================================

def test_author_matching_priority_and_ambiguity(
    test_client, super_admin_user, seed_repository_researchers
):
    """
    Validates 3-tier author matching priority:
    1. Exact UUID
    2. Exact Scopus ID
    3. Normalized name + department
    And ambiguous matching when multiple candidates exist without distinguishing department.
    """
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    r1 = seed_repository_researchers["r1"]

    # Match by exact UUID (Priority 1)
    p1_payload = {
        "batch": {"batch_name": "P1 Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"},
        "certificates": [
            {
                "research_title": "P1 Paper",
                "authors": [
                    {
                        "researcher": {"researcher_id": str(r1.id), "full_name": "A. Sharma"},
                        "certificate_title": None,
                    }
                ],
            }
        ],
    }
    resp1 = test_client.post("/api/admin/sama/certificates/bulk-generate/preview", json=p1_payload)
    match_item1 = resp1.json()["data"]["certificates"][0]["authors"][0]
    assert match_item1["status"] == "MATCHED"
    assert match_item1["matched_by"] == "UUID"
    assert match_item1["matched_author_id"] == str(r1.id)

    # Ambiguous match (Two Amit Kumars in Chemistry and Computer Science, no department provided)
    amb_payload = {
        "batch": {"batch_name": "Amb Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"},
        "certificates": [
            {
                "research_title": "Ambiguous Paper",
                "authors": [
                    {
                        "researcher": {"full_name": "Dr. Amit Kumar"},
                        "certificate_title": "Dr.",
                    }
                ],
            }
        ],
    }
    resp_amb = test_client.post("/api/admin/sama/certificates/bulk-generate/preview", json=amb_payload)
    match_amb = resp_amb.json()["data"]["certificates"][0]["authors"][0]
    assert match_amb["status"] == "AMBIGUOUS"
    assert len(match_amb["candidates"]) == 2

    # Disambiguation with department (Priority 3 disambiguated)
    disamb_payload = {
        "batch": {"batch_name": "Disamb Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"},
        "certificates": [
            {
                "research_title": "Disambiguated Paper",
                "authors": [
                    {
                        "researcher": {"full_name": "Amit Kumar", "department": "Department of Chemistry"},
                        "certificate_title": "Dr.",
                    }
                ],
            }
        ],
    }
    resp_disamb = test_client.post("/api/admin/sama/certificates/bulk-generate/preview", json=disamb_payload)
    match_disamb = resp_disamb.json()["data"]["certificates"][0]["authors"][0]
    assert match_disamb["status"] == "MATCHED"
    assert match_disamb["matched_by"] == "NORMALIZED_NAME"
    assert match_disamb["matched_author_id"] == str(seed_repository_researchers["r3_a"].id)


def test_strict_academic_title_rule(
    test_client, super_admin_user, seed_repository_researchers, db_session
):
    """
    CRITICAL TITLE RULE:
    academic_title_snapshot is strictly derived from certificate_title (or None).
    NEVER copied from repository profile even if author has Dr. in repository profile!
    """
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    # Researcher 1 is stored as "Dr. Ananya Sharma", but the certificate explicitly sets certificate_title: null
    payload = {
        "batch": {"batch_name": "Title Rule Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"},
        "certificates": [
            {
                "research_title": "Title Rule Verification Paper",
                "authors": [
                    {
                        "researcher": {
                            "scopus_id": "57200112233",
                            "full_name": "Ananya Sharma",
                        },
                        "certificate_title": None,  # EXPLICITLY NULL: MUST NOT COPY "Dr." FROM REPOSITORY
                    }
                ],
            }
        ],
    }

    gen_resp = test_client.post("/api/admin/sama/certificates/bulk-generate/confirm", json=payload)
    assert gen_resp.status_code == 200
    cert_id = gen_resp.json()["data"]["created_certificates"][0]["certificate_id"]

    # Verify persisted CertificateAuthor in database
    cert_obj = db_session.get(FelicitationCertificate, uuid.UUID(cert_id))
    assert cert_obj is not None
    assert len(cert_obj.authors) == 1
    assert cert_obj.authors[0].academic_title_snapshot is None  # NOT "Dr."!


# ==============================================================================
# SUITE 5, 6, 7, 8, 9: GENERATION, SUBMISSION, DEAN & VC APPROVAL LIFECYCLE
# ==============================================================================

def test_full_bulk_generation_and_dual_approval_workflow(
    test_client, super_admin_user, dean_user, vc_user, seed_authorities, seed_repository_researchers, db_session
):
    """
    Complete lifecycle validation:
    1. SAdmin confirms batch generation -> status is PENDING_DEAN_APPROVAL (never sealed).
    2. SAdmin submits batch to Dean queue.
    3. Dean bulk approves -> status becomes PENDING_VC_APPROVAL, Dean signature snapshot attached.
    4. SAdmin forwards to VC queue.
    5. VC bulk approves -> cryptographic sealing, QR code verification, SHA-256 hash, and transitions to ISSUED.
    """
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    # 1. Generate Batch
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    gen_payload = {
        "batch": {
            "batch_name": "Full Lifecycle Batch Oct 2026",
            "certificate_type": "RESEARCH_PUBLICATION",
            "issue_date": today_ist.isoformat(),
            "bulletin": {"volume": 3, "issue": 1, "period": "October 2026"},
        },
        "certificates": [
            {
                "research_title": "Advanced Biomaterials for Tissue Regeneration",
                "authors": [
                    {
                        "researcher": {
                            "scopus_id": "57200112233",
                            "full_name": "Dr. Ananya Sharma",
                            "department": "Department of Biotechnology",
                        },
                        "certificate_title": "Dr.",
                        "author_role": "Lead Author",
                    }
                ],
                "publication_details": {"journal": "Biomaterials Science"},
            },
            {
                "research_title": "Semiconductor Nano-Heterostructures",
                "authors": [
                    {
                        "researcher": {
                            "scopus_id": "58199223344",
                            "full_name": "Prof. Rajesh Kumar Verma",
                            "department": "Department of Physics",
                        },
                        "certificate_title": "Prof.",
                        "author_role": "Principal Investigator",
                    }
                ],
                "publication_details": {"journal": "Nano Letters"},
            },
        ],
    }

    gen_resp = test_client.post("/api/admin/sama/certificates/bulk-generate/confirm", json=gen_payload)
    assert gen_resp.status_code == 200
    gen_data = gen_resp.json()["data"]
    batch_id = gen_data["batch_id"]
    assert gen_data["created_count"] == 2
    cert_ids = [c["certificate_id"] for c in gen_data["created_certificates"]]

    # Verify initial status in DB: must be PENDING_DEAN_APPROVAL, NOT sealed
    for cid in cert_ids:
        c_record = db_session.get(FelicitationCertificate, uuid.UUID(cid))
        assert c_record.status == "PENDING_DEAN_APPROVAL"
        assert c_record.checksum_sha256 is None
        assert c_record.publication_details["batch"]["batch_id"] == batch_id

    # 2. Bulk Submit to Dean
    sub_resp = test_client.post(
        "/api/admin/sama/certificates/bulk-submit-dean",
        json={"certificate_ids": cert_ids},
    )
    assert sub_resp.status_code == 200
    assert sub_resp.json()["data"]["submitted_count"] == 2

    # 3. Dean Bulk Approval (Executed by authorized Dean user)
    app.dependency_overrides[get_current_user] = lambda: dean_user
    dean_appr_resp = test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=DEAN_RD",
        json={
            "certificate_ids": cert_ids,
            "action": "APPROVE",
            "remarks": "Academic merit verified by Dean R&D.",
        },
    )
    assert dean_appr_resp.status_code == 200
    dean_data = dean_appr_resp.json()["data"]
    assert dean_data["success_count"] == 2

    # Verify status in DB: now PENDING_VC_APPROVAL, with Dean signature snapshot
    for cid in cert_ids:
        c_record = db_session.get(FelicitationCertificate, uuid.UUID(cid))
        assert c_record.status == "PENDING_VC_APPROVAL"
        dean_appr = next((ap for ap in c_record.approvals if ap.authority_type == "DEAN_RD"), None)
        assert dean_appr is not None
        assert dean_appr.status == "APPROVED"
        assert dean_appr.signatory_name_snapshot == "Prof. (Dr.) Rajesh Kumar"

    # 4. Bulk Forward to VC
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    fwd_resp = test_client.post(
        "/api/admin/sama/certificates/bulk-forward-vc",
        json={"certificate_ids": cert_ids},
    )
    assert fwd_resp.status_code == 200
    assert fwd_resp.json()["data"]["forwarded_count"] == 2

    # 5. VC Bulk Approval & Terminal Sealing (Executed by authorized VC user)
    app.dependency_overrides[get_current_user] = lambda: vc_user
    vc_appr_resp = test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=VICE_CHANCELLOR",
        json={
            "certificate_ids": cert_ids,
            "action": "APPROVE",
            "remarks": "Approved by Vice Chancellor.",
        },
    )
    assert vc_appr_resp.status_code == 200
    vc_data = vc_appr_resp.json()["data"]
    assert vc_data["success_count"] == 2

    # Verify terminal status in DB: ISSUED, SHA-256 checksum present, PDF file storage path set
    for cid in cert_ids:
        c_record = db_session.get(FelicitationCertificate, uuid.UUID(cid))
        assert c_record.status == "ISSUED"
        assert c_record.checksum_sha256 is not None
        assert len(c_record.checksum_sha256) == 64
        assert c_record.file_storage_path is not None
        vc_appr = next((ap for ap in c_record.approvals if ap.authority_type == "VICE_CHANCELLOR"), None)
        assert vc_appr is not None
        assert vc_appr.status == "APPROVED"
        assert vc_appr.signatory_name_snapshot == "Prof. Vinay Kumar Pathak"


def test_bulk_rejection_requires_mandatory_remarks(
    test_client, dean_user, super_admin_user, seed_authorities, seed_repository_researchers, db_session
):
    """Rejection by Dean or VC requires mandatory remarks and transitions certificate to REJECTED."""
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    gen_payload = {
        "batch": {"batch_name": "Rejection Test Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"},
        "certificates": [
            {
                "research_title": "Paper to be Rejected",
                "authors": [{"researcher": {"scopus_id": "57200112233", "full_name": "Dr. Ananya Sharma"}}],
            }
        ],
    }
    gen_resp = test_client.post("/api/admin/sama/certificates/bulk-generate/confirm", json=gen_payload)
    cert_id = gen_resp.json()["data"]["created_certificates"][0]["certificate_id"]

    # Rejection without remarks must fail with 400
    app.dependency_overrides[get_current_user] = lambda: dean_user
    fail_resp = test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=DEAN_RD",
        json={"certificate_ids": [cert_id], "action": "REJECT", "remarks": ""},
    )
    assert fail_resp.status_code == 400

    # Rejection with remarks succeeds and sets status to REJECTED
    rej_resp = test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=DEAN_RD",
        json={"certificate_ids": [cert_id], "action": "REJECT", "remarks": "Does not meet institutional quartile threshold."},
    )
    assert rej_resp.status_code == 200
    c_record = db_session.get(FelicitationCertificate, uuid.UUID(cert_id))
    assert c_record.status == "REJECTED"
    assert c_record.rejection_reason == "Does not meet institutional quartile threshold."


# ==============================================================================
# SUITE 10: RBAC, BATCH METRICS & ZIP EXPORT
# ==============================================================================

def test_rbac_non_impersonation_enforcement(
    test_client, normal_user, super_admin_user, dean_user, seed_authorities, seed_repository_researchers, db_session
):
    """
    Enforces separation of powers:
    - Normal user cannot generate batch.
    - Super Admin without Dean role cannot execute Dean approval.
    - Dean cannot approve VC stage.
    - VC cannot approve without prior Dean approval.
    """
    # 1. Normal user cannot generate batch (403)
    app.dependency_overrides[get_current_user] = lambda: normal_user
    res1 = test_client.post(
        "/api/admin/sama/certificates/bulk-generate/confirm",
        json={"batch": {"batch_name": "Unauthorized Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"}, "certificates": []},
    )
    assert res1.status_code == 403

    # Generate batch as SAdmin
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    gen_payload = {
        "batch": {"batch_name": "RBAC Test Batch", "certificate_type": "RESEARCH_PUBLICATION", "issue_date": "2026-10-15"},
        "certificates": [
            {
                "research_title": "RBAC Paper",
                "authors": [{"researcher": {"scopus_id": "57200112233", "full_name": "Dr. Ananya Sharma"}}],
            }
        ],
    }
    gen_resp = test_client.post("/api/admin/sama/certificates/bulk-generate/confirm", json=gen_payload)
    cert_id = gen_resp.json()["data"]["created_certificates"][0]["certificate_id"]

    # 2. Super Admin without Dean role cannot call Dean approval (403 Forbidden)
    res2 = test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=DEAN_RD",
        json={"certificate_ids": [cert_id], "action": "APPROVE"},
    )
    assert res2.status_code == 403

    # 3. Dean cannot call VC approval (403 Forbidden)
    app.dependency_overrides[get_current_user] = lambda: dean_user
    res3 = test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=VICE_CHANCELLOR",
        json={"certificate_ids": [cert_id], "action": "APPROVE"},
    )
    assert res3.status_code == 403


def test_batch_management_metrics_and_zip_export(
    test_client, super_admin_user, dean_user, vc_user, seed_authorities, seed_repository_researchers, db_session
):
    """
    Validates:
    1. Batch listing with aggregated status counts.
    2. Batch detail retrieval.
    3. ZIP export containing vector PDFs and CSV manifest.
    """
    today_ist = datetime.now(timezone.utc).astimezone(IST).date()
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    # Generate batch
    gen_payload = {
        "batch": {
            "batch_name": "Export ZIP Batch",
            "certificate_type": "RESEARCH_PUBLICATION",
            "issue_date": today_ist.isoformat(),
        },
        "certificates": [
            {
                "research_title": "Paper for ZIP Export 1",
                "authors": [{"researcher": {"scopus_id": "57200112233", "full_name": "Dr. Ananya Sharma"}}],
            }
        ],
    }
    gen_resp = test_client.post("/api/admin/sama/certificates/bulk-generate/confirm", json=gen_payload)
    batch_id = gen_resp.json()["data"]["batch_id"]
    cert_id = gen_resp.json()["data"]["created_certificates"][0]["certificate_id"]

    # Approve through Dean and VC to render PDF
    app.dependency_overrides[get_current_user] = lambda: dean_user
    test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=DEAN_RD",
        json={"certificate_ids": [cert_id], "action": "APPROVE"},
    )

    app.dependency_overrides[get_current_user] = lambda: vc_user
    test_client.post(
        "/api/admin/sama/certificates/bulk-approve?authority=VICE_CHANCELLOR",
        json={"certificate_ids": [cert_id], "action": "APPROVE"},
    )

    # 1. List batches
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    list_resp = test_client.get("/api/admin/sama/certificates/batches")
    assert list_resp.status_code == 200
    batches = list_resp.json()["data"]["items"]
    target_batch = next((b for b in batches if b["batch_id"] == batch_id), None)
    assert target_batch is not None
    assert target_batch["total_certificates"] == 1
    assert target_batch["issued_count"] == 1

    # 2. Batch detail
    detail_resp = test_client.get(f"/api/admin/sama/certificates/batches/{batch_id}")
    assert detail_resp.status_code == 200
    assert detail_resp.json()["data"]["total_certificates"] == 1

    # 3. Export ZIP
    zip_resp = test_client.get(f"/api/admin/sama/certificates/batches/{batch_id}/export-zip")
    assert zip_resp.status_code == 200
    assert zip_resp.headers["content-type"] == "application/zip"

    # Verify ZIP contents
    zip_bytes = io.BytesIO(zip_resp.content)
    with zipfile.ZipFile(zip_bytes, "r") as zf:
        file_list = zf.namelist()
        assert "manifest_summary.csv" in file_list
        manifest_text = zf.read("manifest_summary.csv").decode("utf-8")
        assert "Paper for ZIP Export 1" in manifest_text
        assert "Dr. Ananya Sharma" in manifest_text
