import uuid
from datetime import date, datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.dependencies import get_db, get_current_user
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateApproval,
    CertificateTemplate,
    CertificateSignatory,
)
from app.modules.sama_veda.services.cms_service import SamaCmsService


@pytest.fixture(scope="module")
def sqlite_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(sqlite_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sqlite_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def test_admin_user(db_session):
    admin_role = db_session.query(Role).filter_by(name="super_admin").first()
    if not admin_role:
        admin_role = Role(name="super_admin", description="Super Admin")
        db_session.add(admin_role)
        db_session.flush()

    user = db_session.query(User).filter_by(email="admin_ledger_test@csjmu.ac.in").first()
    if not user:
        user = User(
            email="admin_ledger_test@csjmu.ac.in",
            password_hash="mock_hash",
            first_name="Admin",
            last_name="Tester",
            is_active=True,
        )
        user.roles.append(admin_role)
        db_session.add(user)
        db_session.commit()
    return user


@pytest.fixture
def client(db_session, test_admin_user):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return test_admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def seed_73_certificates_dataset(db_session):
    """
    Seeds exactly 73 records matching the observed dashboard problem breakdown:
    - 4 Issued & Active
    - 12 Scheduled
    - 55 Pending Approvals (30 Dean R&D, 25 Vice Chancellor)
    - 2 Revoked
    - 0 Superseded
    Total = 73
    """
    # Clean previous records in table
    db_session.query(CertificateAuthor).delete()
    db_session.query(CertificateApproval).delete()
    db_session.query(FelicitationCertificate).delete()
    db_session.commit()

    records = []
    base_date = date(2026, 3, 15)

    # 1. 4 Issued & Active
    for i in range(1, 5):
        cert = FelicitationCertificate(
            certificate_number=f"CSJMU/2026/ISSUE-{i:03d}",
            status="ISSUED",
            is_revoked=False,
            title="Certificate of Appreciation & Research Excellence",
            research_title=f"Issued Active Research Paper {i}",
            verification_token=f"token-issued-{i}",
            scheduled_issue_date=base_date,
            issued_at=datetime.now(timezone.utc),
            activated_at=datetime.now(timezone.utc),
        )
        cert.authors.append(
            CertificateAuthor(
                author_name_snapshot=f"Active Scholar {i}",
                academic_title_snapshot="Dr.",
                department_snapshot="Department of Physics",
                scopus_id_snapshot=f"570001{i:02d}",
                author_role="First Author",
                author_order=1,
            )
        )
        records.append(cert)

    # 2. 12 Scheduled (Pre-Activation)
    for i in range(1, 13):
        cert = FelicitationCertificate(
            certificate_number=f"CSJMU/2026/SCHED-{i:03d}",
            status="SCHEDULED",
            is_revoked=False,
            title="Certificate of Appreciation & Research Excellence",
            research_title=f"Scheduled Research Paper {i}",
            verification_token=f"token-sched-{i}",
            scheduled_issue_date=date(2026, 4, 1),
            issued_at=datetime(2026, 4, 1, 0, 0, tzinfo=timezone.utc),
            activated_at=None,
        )
        cert.authors.append(
            CertificateAuthor(
                author_name_snapshot=f"Scheduled Scholar {i}",
                academic_title_snapshot=None,
                department_snapshot="Department of Chemistry",
                scopus_id_snapshot=f"570002{i:02d}",
                author_role="Corresponding Author",
                author_order=1,
            )
        )
        records.append(cert)

    # 3. 55 Pending Approvals
    # 30 awaiting Dean R&D approval
    for i in range(1, 31):
        cert = FelicitationCertificate(
            certificate_number=f"CSJMU/2026/PEND-DEAN-{i:03d}",
            status="PENDING_DEAN_APPROVAL",
            is_revoked=False,
            title="Certificate of Appreciation & Research Excellence",
            research_title=f"Dean Awaiting Research Paper {i}",
            verification_token=f"token-dean-{i}",
            scheduled_issue_date=base_date,
        )
        cert.authors.append(
            CertificateAuthor(
                author_name_snapshot=f"Dean Pending Scholar {i}",
                academic_title_snapshot="Prof.",
                department_snapshot="Department of Mathematics",
                scopus_id_snapshot=f"570003{i:02d}",
                author_role="First Author",
                author_order=1,
            )
        )
        records.append(cert)

    # 25 awaiting Vice Chancellor approval
    for i in range(1, 26):
        cert = FelicitationCertificate(
            certificate_number=f"CSJMU/2026/PEND-VC-{i:03d}",
            status="PENDING_VC_APPROVAL",
            is_revoked=False,
            title="Certificate of Appreciation & Research Excellence",
            research_title=f"VC Awaiting Research Paper {i}",
            verification_token=f"token-vc-{i}",
            scheduled_issue_date=base_date,
        )
        cert.authors.append(
            CertificateAuthor(
                author_name_snapshot=f"VC Pending Scholar {i}",
                academic_title_snapshot=None,
                department_snapshot="Department of Life Sciences",
                scopus_id_snapshot=f"570004{i:02d}",
                author_role="Co-Author",
                author_order=1,
            )
        )
        records.append(cert)

    # 4. 2 Revoked Certificates
    for i in range(1, 3):
        cert = FelicitationCertificate(
            certificate_number=f"CSJMU/2026/REV-{i:03d}",
            status="REVOKED",
            is_revoked=True,
            revocation_reason=f"Official Audit Revocation Justification {i}",
            revoked_at=datetime.now(timezone.utc),
            title="Certificate of Appreciation & Research Excellence",
            research_title=f"Revoked Research Paper {i}",
            verification_token=f"token-revoked-{i}",
            scheduled_issue_date=base_date,
        )
        cert.authors.append(
            CertificateAuthor(
                author_name_snapshot=f"Revoked Scholar {i}",
                academic_title_snapshot=None,
                department_snapshot="Department of Law",
                scopus_id_snapshot=f"570005{i:02d}",
                author_role="Author",
                author_order=1,
            )
        )
        records.append(cert)

    db_session.add_all(records)
    db_session.commit()
    assert len(records) == 73
    return records


# ============================================================================
# REGRESSION TEST SUITE: CMS APPROVAL QUEUE & ISSUED LEDGER
# ============================================================================

def test_01_dashboard_stats_counting_rules(client, seed_73_certificates_dataset):
    """
    Requirement: Consistent counting rules without double counting.
    Total Certificates in Registry: 73
    Total Issued (Active + Revoked + Superseded): 6
    Issued & Active: 4
    Scheduled: 12
    Pending Approvals: 55
    Revoked: 2
    Superseded: 0
    Sum: 4 + 12 + 55 + 2 + 0 = 73 (100% consistent)
    """
    resp = client.get("/api/admin/sama/certificates/stats")
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]

    assert data["total_certificates"] == 73
    assert data["total_issued"] == 6  # 4 active + 2 revoked + 0 superseded
    assert data["issued_certificates"] == 4
    assert data["scheduled_certificates"] == 12
    assert data["pending_approvals"] == 55
    assert data["revoked_certificates"] == 2
    assert data["reissued_certificates"] == 0
    assert (
        data["issued_certificates"]
        + data["scheduled_certificates"]
        + data["pending_approvals"]
        + data["revoked_certificates"]
        + data["reissued_certificates"]
        + data["draft_certificates"]
    ) == data["total_certificates"]


def test_02_approval_queue_contains_all_55_pending(client, seed_73_certificates_dataset):
    """
    Requirement: Display every certificate genuinely awaiting Dean R&D or VC approval.
    55 pending certificates are correctly counted and accessible.
    Scheduled, Issued, and Revoked records must NOT be returned.
    """
    resp = client.get("/api/admin/sama/certificates?scope=approvals&limit=100")
    assert resp.status_code == 200
    res_data = resp.json()["data"]

    assert res_data["total"] == 55
    assert len(res_data["items"]) == 55

    for item in res_data["items"]:
        assert item["status"] in ["PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL", "SUBMITTED"]
        assert item["is_revoked"] is False
        assert not item["certificate_number"].startswith("CSJMU/2026/ISSUE-")
        assert not item["certificate_number"].startswith("CSJMU/2026/SCHED-")
        assert not item["certificate_number"].startswith("CSJMU/2026/REV-")


def test_03_approval_queue_stage_filters(client, seed_73_certificates_dataset):
    """
    Requirement: Stage filtering for Dean R&D (30) and Vice Chancellor (25).
    No double-counting between stages.
    """
    # Awaiting Dean R&D
    resp_dean = client.get("/api/admin/sama/certificates?scope=approvals&approval_stage=DEAN&limit=100")
    assert resp_dean.status_code == 200
    data_dean = resp_dean.json()["data"]
    assert data_dean["total"] == 30
    assert len(data_dean["items"]) == 30
    assert all(c["status"] == "PENDING_DEAN_APPROVAL" for c in data_dean["items"])

    # Awaiting Vice Chancellor
    resp_vc = client.get("/api/admin/sama/certificates?scope=approvals&approval_stage=VC&limit=100")
    assert resp_vc.status_code == 200
    data_vc = resp_vc.json()["data"]
    assert data_vc["total"] == 25
    assert len(data_vc["items"]) == 25
    assert all(c["status"] == "PENDING_VC_APPROVAL" for c in data_vc["items"])

    # Verify Dean + VC == Total Pending (30 + 25 = 55)
    assert data_dean["total"] + data_vc["total"] == 55


def test_04_approval_queue_pagination_without_gaps_or_duplicates(client, seed_73_certificates_dataset):
    """
    Requirement: Pagination returns every record without gaps or duplicates across pages.
    55 records with limit=10 -> 6 pages (10, 10, 10, 10, 10, 5).
    """
    seen_ids = set()
    page_size = 10
    total_pages = (55 + page_size - 1) // page_size

    for page in range(total_pages):
        skip = page * page_size
        resp = client.get(f"/api/admin/sama/certificates?scope=approvals&skip={skip}&limit={page_size}")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["total"] == 55

        expected_count = 5 if page == total_pages - 1 else 10
        assert len(data["items"]) == expected_count

        for item in data["items"]:
            assert item["id"] not in seen_ids, f"Duplicate certificate {item['certificate_number']} found on page {page}"
            seen_ids.add(item["id"])

    assert len(seen_ids) == 55


def test_05_issued_ledger_scope_contains_all_issued_records(client, seed_73_certificates_dataset):
    """
    Requirement: Display all certificates that reached the issued state.
    Includes active (4) + revoked (2) = 6 records.
    Scheduled (12), Drafts (0), and Pending (55) are strictly excluded.
    """
    resp = client.get("/api/admin/sama/certificates?scope=ledger&limit=100")
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["total"] == 6
    assert len(data["items"]) == 6

    for item in data["items"]:
        # Must be either ISSUED or REVOKED or SUPERSEDED
        assert item["status"] in ["ISSUED", "REVOKED", "SUPERSEDED"] or item["is_revoked"] is True
        # Strictly never pending or scheduled in default issued ledger
        assert item["status"] not in ["DRAFT", "SUBMITTED", "PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL", "SCHEDULED"]


def test_06_issued_ledger_status_filters(client, seed_73_certificates_dataset):
    """
    Requirement: Distinguishable lifecycle states:
    - Issued & Active (4)
    - Revoked (2)
    - Scheduled (12)
    """
    # 1. Issued & Active
    resp_act = client.get("/api/admin/sama/certificates?scope=ledger&status=issued&limit=50")
    assert resp_act.status_code == 200
    data_act = resp_act.json()["data"]
    assert data_act["total"] == 4
    assert all(c["status"] == "ISSUED" and not c["is_revoked"] for c in data_act["items"])

    # 2. Revoked
    resp_rev = client.get("/api/admin/sama/certificates?scope=ledger&status=revoked&limit=50")
    assert resp_rev.status_code == 200
    data_rev = resp_rev.json()["data"]
    assert data_rev["total"] == 2
    assert all(c["is_revoked"] is True for c in data_rev["items"])

    # 3. Scheduled
    resp_sch = client.get("/api/admin/sama/certificates?scope=ledger&status=scheduled&limit=50")
    assert resp_sch.status_code == 200
    data_sch = resp_sch.json()["data"]
    assert data_sch["total"] == 12
    assert all(c["status"] == "SCHEDULED" for c in data_sch["items"])


def test_07_search_across_approval_queue_and_ledger(client, seed_73_certificates_dataset):
    """
    Requirement: Search works accurately across pages and scopes.
    """
    # Search in approval queue by author name snapshot
    resp_search_appr = client.get("/api/admin/sama/certificates?scope=approvals&search=Dean Pending Scholar 5")
    assert resp_search_appr.status_code == 200
    items_appr = resp_search_appr.json()["data"]["items"]
    assert len(items_appr) == 1
    assert items_appr[0]["certificate_number"] == "CSJMU/2026/PEND-DEAN-005"

    # Search in issued ledger by certificate number
    resp_search_ledg = client.get("/api/admin/sama/certificates?scope=ledger&search=ISSUE-003")
    assert resp_search_ledg.status_code == 200
    items_ledg = resp_search_ledg.json()["data"]["items"]
    assert len(items_ledg) == 1
    assert items_ledg[0]["certificate_number"] == "CSJMU/2026/ISSUE-003"


def test_08_empty_queue_when_all_cleared(client, db_session):
    """
    Requirement: Empty state appears only when actual filtered pending count is zero.
    """
    # Delete all pending records
    db_session.query(FelicitationCertificate).filter(
        FelicitationCertificate.status.in_(["PENDING_DEAN_APPROVAL", "PENDING_VC_APPROVAL", "SUBMITTED"])
    ).delete()
    db_session.commit()

    resp = client.get("/api/admin/sama/certificates?scope=approvals")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 0
    assert len(data["items"]) == 0
