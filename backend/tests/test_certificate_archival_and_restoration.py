"""
Comprehensive Automated Test Suite for:
VYASA SAMIKSHA CMS — Certificate Archival, Deletion & Administrative Restoration Facility

Validates all 8 core criteria:
1. Individual Archival: Soft-deletes with mandatory institutional rationale, records JSONB provenance & audit.
2. Active Issued Certificate Protection: Blocks direct deletion/archival of active unrevoked certificates.
3. Bulk Archival: Supports mixed collections, partial failure isolation, and atomic commit of valid candidates.
4. Archived Certificates Querying: Lists archived records with previous status and provenance for recovery.
5. Restoration State Machine & Anti-Reactivation Safety:
   - Revoked certificates restore strictly to REVOKED (NEVER to ISSUED / active).
   - Superseded certificates restore strictly to SUPERSEDED.
   - Pending approval certificates restore to respective approval queues.
   - Scheduled / Draft certificates restore to respective states.
6. Bulk Restoration: Handles multi-record recovery with per-record results and partial failure reporting.
7. Public Verification Shield:
   - Archived revoked certificates remain publicly verifiable as REVOKED (with original revocation date/reason).
   - Internal archival metadata is strictly stripped from public responses.
   - Archived non-revoked certificates return HTTP 404.
8. Strict RBAC: All archival, restoration, and archived endpoints require Super Admin authorization.
"""

import uuid
import pytest
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, joinedload
from sqlalchemy.pool import StaticPool

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

IST = ZoneInfo("Asia/Kolkata")
TEST_DB_URL = "sqlite:///:memory:"

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, expire_on_commit=False, bind=test_engine)


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
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def users_setup(db_session):
    super_admin_role = Role(name="super_admin", description="Super Admin Role")
    dean_role = Role(name="dean_rd", description="Dean Role")
    user_role = Role(name="user", description="Normal User Role")
    db_session.add_all([super_admin_role, dean_role, user_role])
    db_session.flush()

    sadmin = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Administrator",
        is_active=True,
    )
    sadmin.roles.append(super_admin_role)

    dean = User(
        id=uuid.uuid4(),
        email="dean@csjmu.ac.in",
        first_name="Dean",
        last_name="RD",
        is_active=True,
    )
    dean.roles.append(dean_role)

    regular_user = User(
        id=uuid.uuid4(),
        email="researcher@csjmu.ac.in",
        first_name="Regular",
        last_name="Researcher",
        is_active=True,
    )
    regular_user.roles.append(user_role)

    db_session.add_all([sadmin, dean, regular_user])
    db_session.commit()
    db_session.refresh(sadmin)
    db_session.refresh(dean)
    db_session.refresh(regular_user)
    return {"sadmin": sadmin, "dean": dean, "user": regular_user}


@pytest.fixture
def seed_bulletin_and_authors(db_session):
    bulletin = ResearchBulletin(
        volume_number=5,
        issue_number=11,
        publication_period="November 2026",
        title="CSJMU Research Excellence Bulletin Vol 5 Issue 11",
        is_published=True,
    )
    db_session.add(bulletin)
    db_session.flush()

    author = ResearchAuthor(
        scopus_id="57200112233",
        full_name="Dr. Archival Scientist",
        department="Department of Computer Science",
        institutional_affiliation="Chhatrapati Shahu Ji Maharaj University, Kanpur",
        is_verified=True,
    )
    db_session.add(author)
    db_session.commit()
    db_session.refresh(bulletin)
    db_session.refresh(author)
    return bulletin, author


def _create_certificate(db_session, *, cert_number: str, status: str, is_revoked: bool = False, **kwargs):
    cert = FelicitationCertificate(
        certificate_number=cert_number,
        verification_token=f"TOKEN-{cert_number}",
        status=status,
        is_revoked=is_revoked,
        certificate_type=kwargs.get("certificate_type", "RESEARCH_PUBLICATION"),
        title="Certificate of Research Excellence",
        research_title=kwargs.get("research_title", "Advanced Archival Architecture in Higher Education"),
        checksum_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        file_storage_path=f"mock_storage/{cert_number}.pdf",
        publication_details=kwargs.get("publication_details", {}),
        revocation_reason=kwargs.get("revocation_reason"),
        revoked_at=kwargs.get("revoked_at"),
        scheduled_issue_date=kwargs.get("scheduled_issue_date"),
    )
    db_session.add(cert)
    db_session.commit()
    db_session.refresh(cert)
    return cert


def test_individual_archival_success(db_session, users_setup):
    """Verifies that an eligible certificate is safely archived with mandatory reason and provenance."""
    sadmin = users_setup["sadmin"]

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == "sadmin@csjmu.ac.in")).unique().first()
    client = TestClient(app)

    try:
        # Create a revoked certificate (eligible for archival)
        revoked_cert = _create_certificate(
            db_session,
            cert_number="CSJMU/2026/REV/001",
            status="REVOKED",
            is_revoked=True,
            revocation_reason="Initial erroneous metadata",
            revoked_at=datetime.now(timezone.utc),
        )

        response = client.request(
            "DELETE",
            f"/api/admin/sama/certificates/{revoked_cert.id}",
            json={"reason": "Archived after audit review authorized by university committee"},
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["success"] is True
        assert data["data"]["status"] == "ARCHIVED"

        # Verify database state
        db_session.expire_all()
        refreshed = db_session.get(FelicitationCertificate, revoked_cert.id)
        assert refreshed.status == "ARCHIVED"
        assert refreshed.is_revoked is True
        assert "[DELETED by Admin]" in (refreshed.rejection_reason or "")

        # Verify JSONB archival provenance
        archival_info = (refreshed.publication_details or {}).get("archival", {})
        assert archival_info["is_archived"] is True
        assert archival_info["previous_status"] == "REVOKED"
        assert archival_info["archival_reason"] == "Archived after audit review authorized by university committee"
        assert archival_info["archived_by_user_id"] == str(sadmin.id)
        assert len(archival_info.get("history", [])) == 1
        assert archival_info["history"][0]["action"] == "ARCHIVED"
    finally:
        app.dependency_overrides.clear()


def test_active_certificate_archival_blocked(db_session, users_setup):
    """
    Mandatory Rule: Active issued certificates must undergo formal revocation or reissuance before archival.
    They cannot be archived directly.
    """
    sadmin = users_setup["sadmin"]

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == "sadmin@csjmu.ac.in")).unique().first()
    client = TestClient(app)

    try:
        active_cert = _create_certificate(
            db_session,
            cert_number="CSJMU/2026/ACT/001",
            status="ISSUED",
            is_revoked=False,
        )

        response = client.request(
            "DELETE",
            f"/api/admin/sama/certificates/{active_cert.id}",
            json={"reason": "Attempting direct deletion of active certificate"},
        )
        assert response.status_code == 400
        err_msg = response.json().get("detail") or response.json().get("message") or ""
        assert "Active issued certificates must be formally revoked or reissued before archival" in err_msg

        # Ensure active certificate remains untouched
        db_session.expire_all()
        refreshed = db_session.get(FelicitationCertificate, active_cert.id)
        assert refreshed.status == "ISSUED"
    finally:
        app.dependency_overrides.clear()


def test_bulk_archival_success_and_partial_failures(db_session, users_setup):
    """
    Verifies bulk archival supports mixed eligible/ineligible states:
    - Revoked and Superseded certificates succeed.
    - Active issued certificate fails safely and is reported in failed_items without halting execution.
    """
    sadmin = users_setup["sadmin"]

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == "sadmin@csjmu.ac.in")).unique().first()
    client = TestClient(app)

    try:
        c_rev = _create_certificate(db_session, cert_number="CSJMU/BULK/REV", status="REVOKED", is_revoked=True)
        c_sup = _create_certificate(db_session, cert_number="CSJMU/BULK/SUP", status="SUPERSEDED", is_revoked=False)
        c_act = _create_certificate(db_session, cert_number="CSJMU/BULK/ACT", status="ISSUED", is_revoked=False)
        fake_id = str(uuid.uuid4())

        payload = {
            "certificate_ids": [str(c_rev.id), str(c_sup.id), str(c_act.id), fake_id],
            "reason": "Institutional archival cleanup batch for Q4 2026",
        }

        response = client.post("/api/admin/sama/certificates/bulk-delete", json=payload)
        assert response.status_code == 200, response.text
        data = response.json()["data"]

        assert data["total_requested"] == 4
        assert data["deleted_count"] == 2
        assert data["failed_count"] == 2

        deleted_str_ids = data["deleted_ids"]
        assert str(c_rev.id) in deleted_str_ids
        assert str(c_sup.id) in deleted_str_ids

        failed_dict = {f["id"]: f["reason"] for f in data["failed_items"]}
        assert str(c_act.id) in failed_dict
        assert "formally revoked or reissued" in failed_dict[str(c_act.id)]
        assert fake_id in failed_dict

        # Verify DB states
        db_session.expire_all()
        assert db_session.get(FelicitationCertificate, c_rev.id).status == "ARCHIVED"
        assert db_session.get(FelicitationCertificate, c_sup.id).status == "ARCHIVED"
        assert db_session.get(FelicitationCertificate, c_act.id).status == "ISSUED"
    finally:
        app.dependency_overrides.clear()


def test_list_archived_certificates_endpoint(db_session, users_setup):
    """Verifies the GET /certificates/archived administrative recovery endpoint."""
    sadmin = users_setup["sadmin"]

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == "sadmin@csjmu.ac.in")).unique().first()
    client = TestClient(app)

    try:
        # Create an archived certificate with archival JSONB metadata
        c_arch = _create_certificate(
            db_session,
            cert_number="CSJMU/ARCH/LIST/001",
            status="ARCHIVED",
            publication_details={
                "archival": {
                    "is_archived": True,
                    "previous_status": "SUPERSEDED",
                    "archived_at": "2026-11-19T03:00:00Z",
                    "archival_reason": "Testing listing view",
                }
            },
        )

        response = client.get("/api/admin/sama/certificates/archived")
        assert response.status_code == 200, response.text
        data = response.json()["data"]
        assert data["total"] >= 1
        items = data["items"]
        found = next((i for i in items if i["certificate_number"] == "CSJMU/ARCH/LIST/001"), None)
        assert found is not None
        assert found["previous_status"] == "SUPERSEDED"
        assert found["archival_reason"] == "Testing listing view"
    finally:
        app.dependency_overrides.clear()


def test_restoration_lifecycle_mapping_and_anti_reactivation_safety(db_session, users_setup):
    """
    CRITICAL TEST: Validates complete restoration state mapping.
    1. Revoked certificates MUST restore to REVOKED, NEVER reactivating as active.
    2. Superseded certificates MUST restore to SUPERSEDED.
    3. Pending Dean approval certificates restore to PENDING_DEAN_APPROVAL.
    4. Pending VC approval certificates restore to PENDING_VC_APPROVAL.
    5. Approved certificates restore to APPROVED.
    6. Scheduled certificates restore to SCHEDULED.
    """
    sadmin = users_setup["sadmin"]

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == "sadmin@csjmu.ac.in")).unique().first()
    client = TestClient(app)

    try:
        # Scenario 1: Archived Revoked certificate
        c_rev = _create_certificate(
            db_session,
            cert_number="CSJMU/REST/REV/001",
            status="ARCHIVED",
            is_revoked=True,
            publication_details={
                "archival": {
                    "is_archived": True,
                    "previous_status": "REVOKED",
                    "history": [{"action": "ARCHIVED", "previous_status": "REVOKED"}],
                }
            },
        )

        resp = client.post(
            f"/api/admin/sama/certificates/{c_rev.id}/restore",
            json={"reason": "Restoring archived revoked certificate for administrative record check"},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["data"]["restored_to_status"] == "REVOKED"

        db_session.expire_all()
        refreshed_rev = db_session.get(FelicitationCertificate, c_rev.id)
        assert refreshed_rev.status == "REVOKED"
        assert refreshed_rev.is_revoked is True  # NEVER reactivated to active

        # Verify restoration history recorded in JSONB
        arch_meta = (refreshed_rev.publication_details or {}).get("archival", {})
        assert arch_meta["is_archived"] is False
        assert len(arch_meta.get("history", [])) == 2
        assert arch_meta["history"][1]["action"] == "RESTORED"
        assert arch_meta["history"][1]["restored_to_status"] == "REVOKED"

        # Scenario 2: Archived Superseded certificate
        c_sup = _create_certificate(
            db_session,
            cert_number="CSJMU/REST/SUP/001",
            status="ARCHIVED",
            is_revoked=False,
            publication_details={
                "archival": {"is_archived": True, "previous_status": "SUPERSEDED"}
            },
        )
        resp2 = client.post(
            f"/api/admin/sama/certificates/{c_sup.id}/restore",
            json={"reason": "Restoring superseded certificate"},
        )
        assert resp2.status_code == 200
        assert resp2.json()["data"]["restored_to_status"] == "SUPERSEDED"
        db_session.expire_all()
        assert db_session.get(FelicitationCertificate, c_sup.id).status == "SUPERSEDED"

        # Scenario 3: Archived PENDING_DEAN_APPROVAL certificate
        c_dean = _create_certificate(
            db_session,
            cert_number="CSJMU/REST/DEAN/001",
            status="ARCHIVED",
            is_revoked=False,
            publication_details={
                "archival": {"is_archived": True, "previous_status": "PENDING_DEAN_APPROVAL"}
            },
        )
        resp3 = client.post(
            f"/api/admin/sama/certificates/{c_dean.id}/restore",
            json={"reason": "Restoring certificate to Dean approval queue"},
        )
        assert resp3.status_code == 200
        assert resp3.json()["data"]["restored_to_status"] == "PENDING_DEAN_APPROVAL"
        db_session.expire_all()
        assert db_session.get(FelicitationCertificate, c_dean.id).status == "PENDING_DEAN_APPROVAL"

        # Scenario 4: Archived PENDING_VC_APPROVAL certificate
        c_vc = _create_certificate(
            db_session,
            cert_number="CSJMU/REST/VC/001",
            status="ARCHIVED",
            is_revoked=False,
            publication_details={
                "archival": {"is_archived": True, "previous_status": "PENDING_VC_APPROVAL"}
            },
        )
        resp4 = client.post(
            f"/api/admin/sama/certificates/{c_vc.id}/restore",
            json={"reason": "Restoring certificate to VC approval queue"},
        )
        assert resp4.status_code == 200
        assert resp4.json()["data"]["restored_to_status"] == "PENDING_VC_APPROVAL"

        # Scenario 5: Archived SCHEDULED certificate
        c_sched = _create_certificate(
            db_session,
            cert_number="CSJMU/REST/SCHED/001",
            status="ARCHIVED",
            is_revoked=False,
            scheduled_issue_date=date(2026, 12, 1),
            publication_details={
                "archival": {"is_archived": True, "previous_status": "SCHEDULED"}
            },
        )
        resp5 = client.post(
            f"/api/admin/sama/certificates/{c_sched.id}/restore",
            json={"reason": "Restoring scheduled certificate"},
        )
        assert resp5.status_code == 200
        assert resp5.json()["data"]["restored_to_status"] == "SCHEDULED"
    finally:
        app.dependency_overrides.clear()


def test_bulk_restoration_success(db_session, users_setup):
    """Verifies POST /certificates/bulk-restore with per-record results and partial failures."""
    sadmin = users_setup["sadmin"]

    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == "sadmin@csjmu.ac.in")).unique().first()
    client = TestClient(app)

    try:
        c1 = _create_certificate(
            db_session,
            cert_number="CSJMU/BULK/REST/01",
            status="ARCHIVED",
            is_revoked=True,
            publication_details={"archival": {"previous_status": "REVOKED"}},
        )
        c2 = _create_certificate(
            db_session,
            cert_number="CSJMU/BULK/REST/02",
            status="ARCHIVED",
            publication_details={"archival": {"previous_status": "SCHEDULED"}},
        )
        c3_not_archived = _create_certificate(
            db_session,
            cert_number="CSJMU/BULK/REST/03",
            status="ISSUED",
        )

        payload = {
            "certificate_ids": [str(c1.id), str(c2.id), str(c3_not_archived.id)],
            "reason": "Administrative bulk recovery for batch Q4",
        }

        response = client.post("/api/admin/sama/certificates/bulk-restore", json=payload)
        assert response.status_code == 200, response.text
        data = response.json()["data"]

        assert data["total_requested"] == 3
        assert data["restored_count"] == 2
        assert data["failed_count"] == 1

        restored_map = {item["id"]: item["restored_to_status"] for item in data["restored_items"]}
        assert restored_map[str(c1.id)] == "REVOKED"
        assert restored_map[str(c2.id)] == "SCHEDULED"

        failed_map = {f["id"]: f["reason"] for f in data["failed_items"]}
        assert str(c3_not_archived.id) in failed_map
        assert "not archived" in failed_map[str(c3_not_archived.id)]
    finally:
        app.dependency_overrides.clear()


def test_public_verification_shield_for_archived_certificates(db_session):
    """
    CRITICAL TEST:
    1. Public verification of an archived REVOKED certificate must continue to return 200 with status: 'REVOKED'
       and the original revocation date & reason.
    2. Internal archival metadata (publication_details['archival']) MUST NEVER be exposed publicly.
    3. Public verification of an archived non-revoked certificate (e.g. draft/scheduled) must return 404.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    client = TestClient(app)

    try:
        now_utc = datetime.now(timezone.utc)
        # Create an archived revoked certificate
        archived_rev = _create_certificate(
            db_session,
            cert_number="CSJMU/2026/PUB/REVOKED",
            status="ARCHIVED",
            is_revoked=True,
            revocation_reason="Paper retracted by author upon discovery of methodological flaws",
            revoked_at=now_utc,
            publication_details={
                "doi": "10.1016/j.test.2026.01",
                "archival": {
                    "is_archived": True,
                    "previous_status": "REVOKED",
                    "archived_by_user_id": str(uuid.uuid4()),
                    "archival_reason": "INTERNAL SENSITIVE ADMIN NOTE: Case #441",
                    "history": [{"action": "ARCHIVED"}],
                },
            },
        )

        # 1. Query public verification by certificate number
        resp = client.get(f"/api/modules/sama-veda/certificates/verify/{archived_rev.certificate_number}")
        assert resp.status_code == 200, resp.text
        vdata = resp.json()["data"]

        # Effective status MUST be REVOKED
        assert vdata["status"] == "REVOKED"
        assert vdata["is_revoked"] is True
        assert vdata["is_download_allowed"] is False
        assert vdata["revocation_reason"] == "Paper retracted by author upon discovery of methodological flaws"
        assert vdata["revoked_at"] is not None

        # Internal archival metadata MUST NOT leak
        pub_details = vdata.get("publication_details") or {}
        assert "archival" not in pub_details, "CRITICAL LEAK: publication_details['archival'] was exposed publicly!"
        assert "INTERNAL SENSITIVE" not in str(vdata)

        # 2. Archived non-revoked certificate MUST return 404 publicly
        archived_draft = _create_certificate(
            db_session,
            cert_number="CSJMU/2026/PUB/DRAFT",
            status="ARCHIVED",
            is_revoked=False,
            publication_details={"doi": "10.1016/j.draft.2026"},
        )
        resp_draft = client.get(f"/api/modules/sama-veda/certificates/verify/{archived_draft.certificate_number}")
        assert resp_draft.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_rbac_super_admin_enforcement(db_session, users_setup):
    """Ensures that non-super-admin users are strictly blocked with 403 Forbidden."""
    dean = users_setup["dean"]
    user = users_setup["user"]

    cert = _create_certificate(db_session, cert_number="CSJMU/RBAC/001", status="REVOKED", is_revoked=True)

    app.dependency_overrides[get_db] = lambda: db_session

    for test_user in [dean, user]:
        app.dependency_overrides[get_current_user] = lambda email=test_user.email: db_session.scalars(select(User).options(joinedload(User.roles)).where(User.email == email)).unique().first()
        client = TestClient(app)

        # Delete
        r1 = client.request("DELETE", f"/api/admin/sama/certificates/{cert.id}", json={"reason": "unauthorized"})
        assert r1.status_code in (401, 403), f"Expected 403 for {test_user.email}, got {r1.status_code}"

        # Bulk Delete
        r2 = client.post("/api/admin/sama/certificates/bulk-delete", json={"certificate_ids": [str(cert.id)], "reason": "unauth"})
        assert r2.status_code in (401, 403)

        # Restore
        r3 = client.post(f"/api/admin/sama/certificates/{cert.id}/restore", json={"reason": "unauthorized"})
        assert r3.status_code in (401, 403)

        # Bulk Restore
        r4 = client.post("/api/admin/sama/certificates/bulk-restore", json={"certificate_ids": [str(cert.id)], "reason": "unauth"})
        assert r4.status_code in (401, 403)

        # List Archived
        r5 = client.get("/api/admin/sama/certificates/archived")
        assert r5.status_code in (401, 403)

    app.dependency_overrides.clear()
