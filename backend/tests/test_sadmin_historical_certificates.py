# -*- coding: utf-8 -*-
"""
SAMIKSHA SAdmin — Historical Legacy Certificate Search, Detail & Download Tests
Strictly runs against an in-memory isolated database.
Zero production connection or modifications.
"""
import os
import json
import uuid
import pytest
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from fastapi import FastAPI, Depends

from app.models.base import Base
from app.api.dependencies import get_db, require_permission, get_current_user
from app.models.user import User
from app.models.role import Role
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    LegacyCertificateRegistry,
)
from app.modules.sama_veda.services.legacy_recovery_service import LegacyRecoveryService
from app.modules.sama_veda.services.cms_service import sama_cms_service
from app.admin.sama_admin_router import sama_admin_router
from app.core.storage import storage_service, BaseStorageProvider


@pytest.fixture(scope="module")
def isolated_engine():
    """Isolated in-memory SQLite engine for SAdmin recovery testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture(scope="module")
def db_session(isolated_engine):
    """Session factory for isolated tests."""
    Session = sessionmaker(bind=isolated_engine)
    session = Session()

    # 1. Seed active conflicting cert 000002 for Amrita Singh
    active_02 = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2026/000002",
        status="ISSUED",
        is_revoked=False,
        verification_token="active_token_amrita_000002_hex_id",
        title="Certificate of Appreciation & Research Excellence",
        research_title="Active Digital Research on AI Diagnostics",
        created_at=datetime(2026, 10, 15, tzinfo=timezone.utc),
    )
    session.add(active_02)
    session.flush()

    author_02 = CertificateAuthor(
        certificate_id=active_02.id,
        author_name_snapshot="Amrita Singh",
        affiliation_snapshot="CSJMU Kanpur",
        department_snapshot="Computer Science",
        author_order=1,
        author_role="CORRESPONDING_AUTHOR",
    )
    session.add(author_02)

    # 2. Seed active cert 000001
    active_01 = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2026/000001",
        status="ISSUED",
        is_revoked=False,
        verification_token="active_token_000001_hex_id",
        title="Certificate of Appreciation & Research Excellence",
        research_title="Quantum Physics and Energy Harvesting",
        created_at=datetime(2026, 10, 14, tzinfo=timezone.utc),
    )
    session.add(active_01)
    session.flush()

    author_01 = CertificateAuthor(
        certificate_id=active_01.id,
        author_name_snapshot="Prof. Ramesh Chandra",
        affiliation_snapshot="CSJMU Kanpur",
        department_snapshot="Physics",
        author_order=1,
        author_role="FIRST_AUTHOR",
    )
    session.add(author_01)

    # 3. Seed 75 historical certificates from scratch json
    path = os.path.join("scratch", "normalized_recovery", "historical_75_certificates.json")
    assert os.path.exists(path), f"Recovery dataset not found at {path}"
    with open(path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    # Execute isolated seed
    res = LegacyRecoveryService.execute_seed(session, dataset, dry_run=False, allow_remote=False)
    assert res["executed"] is True
    assert res["inserted_count"] == 75

    session.commit()
    yield session
    session.close()


@pytest.fixture(scope="module")
def admin_user():
    super_role = Role(name="super_admin")
    u = User(
        id=uuid.uuid4(),
        email="sadmin@csjmu.ac.in",
        first_name="Super",
        last_name="Admin",
        password_hash="fake",
        roles=[super_role],
        is_active=True,
    )
    return u


@pytest.fixture(scope="module")
def regular_user():
    read_role = Role(name="viewer")
    u = User(
        id=uuid.uuid4(),
        email="viewer@csjmu.ac.in",
        first_name="Viewer",
        last_name="User",
        password_hash="fake",
        roles=[read_role],
        is_active=True,
    )
    return u


@pytest.fixture(scope="module")
def client(isolated_engine, admin_user):
    app = FastAPI()
    app.include_router(sama_admin_router, prefix="/api/admin")

    TestSessionLocal = sessionmaker(bind=isolated_engine)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_current_user():
        return admin_user

    def override_permission(perm: str):
        def _guard():
            return admin_user
        return _guard

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[require_permission("sama:read")] = override_permission("sama:read")
    app.dependency_overrides[require_permission("sama:certificate:manage")] = override_permission("sama:certificate:manage")

    return TestClient(app)


# ==============================================================================
# TESTS
# ==============================================================================

def test_sadmin_all_75_legacy_records_discoverable(client, db_session):
    """
    1. SAdmin listing with origin="all" returns active certificates + all 75 historical records.
    2. SAdmin listing with origin="historical" returns exactly 75 records.
    3. Every legacy record has record_type="historical" and is_legacy=True.
    """
    # Origin = historical
    resp = client.get("/api/admin/sama/certificates?origin=historical&limit=100")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 75
    assert len(data["items"]) == 75
    for item in data["items"]:
        assert item["record_type"] == "historical"
        assert item["is_legacy"] is True
        assert item["status"] == "HISTORICAL"

    # Origin = all (2 active + 75 historical = 77)
    resp_all = client.get("/api/admin/sama/certificates?origin=all&limit=100")
    assert resp_all.status_code == 200
    data_all = resp_all.json()["data"]
    assert data_all["total"] == 77
    assert len(data_all["items"]) == 77

    active_items = [i for i in data_all["items"] if i["record_type"] == "active"]
    legacy_items = [i for i in data_all["items"] if i["record_type"] == "historical"]
    assert len(active_items) == 2
    assert len(legacy_items) == 75


def test_sadmin_search_by_recipient(client):
    """Search by recipient name resolves historical certificates."""
    # Subrat Mishra
    resp = client.get("/api/admin/sama/certificates?search=Subrat&origin=all")
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"
    assert items[0]["authors"][0]["author_name_snapshot"] == "Subrat Mishra"
    assert items[0]["record_type"] == "historical"

    # Swasti Srivastava
    resp2 = client.get("/api/admin/sama/certificates?search=Swasti&origin=all")
    assert resp2.status_code == 200
    items2 = resp2.json()["data"]["items"]
    assert len(items2) == 1
    assert items2[0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000007"
    assert items2[0]["authors"][0]["author_name_snapshot"] == "Swasti Srivastava"


def test_sadmin_search_by_serial(client):
    """Search by serial number (full, partial, with or without '#')."""
    # Exact serial
    resp = client.get("/api/admin/sama/certificates?search=CSJMU/SAMIKSHA/2026/000006&origin=all")
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"

    # Partial serial number
    resp_part = client.get("/api/admin/sama/certificates?search=000006&origin=all")
    assert resp_part.status_code == 200
    items_part = resp_part.json()["data"]["items"]
    assert len(items_part) == 1
    assert items_part[0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"

    # With leading hash
    resp_hash = client.get("/api/admin/sama/certificates?search=%23000006&origin=all")
    assert resp_hash.status_code == 200
    items_hash = resp_hash.json()["data"]["items"]
    assert len(items_hash) == 1
    assert items_hash[0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"


def test_sadmin_search_by_title(client):
    """Search by research paper title."""
    resp = client.get("/api/admin/sama/certificates?search=Nanocellulose&origin=all")
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    # Both Subrat Mishra (000006) and Swasti Srivastava (000007) share this paper title
    assert len(items) == 2
    serials = {i["certificate_number"] for i in items}
    assert "CSJMU/SAMIKSHA/2026/000006" in serials
    assert "CSJMU/SAMIKSHA/2026/000007" in serials


def test_sadmin_search_by_scopus_id(db_session, client):
    """Search by Scopus ID matches historical records when present in recovery_metadata."""
    # Find a record and add scopus_id to its recovery_metadata
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000010")
    ).first()
    assert reg is not None
    meta = dict(reg.recovery_metadata or {})
    meta["scopus_id"] = "57199999888"
    reg.recovery_metadata = meta
    db_session.commit()

    resp = client.get("/api/admin/sama/certificates?search=57199999888&origin=all")
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 1
    assert items[0]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000010"
    assert items[0]["authors"][0]["scopus_id_snapshot"] == "57199999888"


def test_sadmin_historical_certificate_detail_endpoint(db_session, client):
    """
    GET /api/admin/sama/certificates/{id} on a historical certificate returns
    original historical metadata without querying active ledger.
    """
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000006")
    ).first()
    assert reg is not None

    resp = client.get(f"/api/admin/sama/certificates/{reg.id}")
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["id"] == str(reg.id)
    assert data["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"
    assert data["record_type"] == "historical"
    assert data["is_legacy"] is True
    assert data["status"] == "HISTORICAL"
    assert data["title"] == "Certificate of Appreciation for Research Publication"
    assert data["research_title"] == "From Nature to Nanomedicine: The Promise and Challenges of Nanocellulose-Based Drug Delivery Systems"
    assert data["sanction_amount"] == "INR 4,000"
    assert "Volume 2, Issue 3" in data["issue_reference"]
    assert data["verification_token"] == reg.verification_token
    assert len(data["authors"]) == 1
    assert data["authors"][0]["author_name_snapshot"] == "Subrat Mishra"


def test_sadmin_serial_collision_000002_dual_records(client, db_session):
    """
    Serial 000002 collision:
    Active cert (Amrita Singh) and Historical cert (Harshit Gupta) are both returned,
    have distinct IDs, distinct record_types, and collision info populated.
    """
    resp = client.get("/api/admin/sama/certificates?search=000002&origin=all")
    assert resp.status_code == 200
    items = resp.json()["data"]["items"]
    assert len(items) == 2

    active_rec = next(i for i in items if i["record_type"] == "active")
    hist_rec = next(i for i in items if i["record_type"] == "historical")

    assert active_rec["id"] != hist_rec["id"]
    assert active_rec["certificate_number"] == "CSJMU/SAMIKSHA/2026/000002"
    assert hist_rec["certificate_number"] == "CSJMU/SAMIKSHA/2026/000002"

    assert active_rec["authors"][0]["author_name_snapshot"] == "Amrita Singh"
    assert hist_rec["authors"][0]["author_name_snapshot"] == "Harshit Gupta"

    assert active_rec["has_legacy_collision"] is True
    assert active_rec["legacy_collision_info"]["colliding_serial"] == "CSJMU/SAMIKSHA/2026/000002"
    assert active_rec["legacy_collision_info"]["historical_recipient"] == "Harshit Gupta"

    assert hist_rec["has_legacy_collision"] is True
    assert hist_rec["legacy_collision_info"]["colliding_serial"] == "CSJMU/SAMIKSHA/2026/000002"
    assert hist_rec["legacy_collision_info"]["active_recipient"] == "Amrita Singh"

    # Detail query by active ID returns Amrita Singh
    resp_active = client.get(f"/api/admin/sama/certificates/{active_rec['id']}")
    assert resp_active.status_code == 200
    assert resp_active.json()["data"]["authors"][0]["author_name_snapshot"] == "Amrita Singh"
    assert resp_active.json()["data"]["record_type"] == "active"

    # Detail query by historical ID returns Harshit Gupta
    resp_hist = client.get(f"/api/admin/sama/certificates/{hist_rec['id']}")
    assert resp_hist.status_code == 200
    assert resp_hist.json()["data"]["authors"][0]["author_name_snapshot"] == "Harshit Gupta"
    assert resp_hist.json()["data"]["record_type"] == "historical"


def test_sadmin_download_historical_pdf_local_and_spaces(client, db_session, tmp_path):
    """
    Tests historical PDF download via SAdmin endpoint:
    1. Local storage resolution (000002).
    2. Simulated cloud Spaces resolution (000008).
    """
    # 1. Historical 000002 (local file in backend/storage/sama_veda/certificates/)
    reg_02 = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000002")
    ).first()
    assert reg_02 is not None

    resp_02 = client.get(f"/api/admin/sama/certificates/{reg_02.id}/download")
    assert resp_02.status_code == 200
    assert resp_02.headers["content-type"] == "application/pdf"
    assert "attachment" in resp_02.headers.get("content-disposition", "")
    assert "CSJMU_SAMIKSHA_2026_000002.pdf" in resp_02.headers.get("content-disposition", "")
    assert resp_02.content.startswith(b"%PDF")

    # 2. Spaces mock download for 000008
    mock_pdf = tmp_path / "spaces_mock_08.pdf"
    mock_pdf.write_bytes(b"%PDF-1.4 Mock Spaces historical PDF content for SAdmin download test")

    class MockSpacesStorage(BaseStorageProvider):
        def get_file_path(self, storage_key: str):
            if "000008" in storage_key:
                return mock_pdf
            raise FileNotFoundError("Not found in Spaces")
        def exists(self, storage_key: str):
            return "000008" in storage_key
        def get_file_bytes(self, storage_key: str):
            return b"%PDF-1.4 Mock Spaces content"
        def save_file(self, *args, **kwargs):
            pass
        def delete_file(self, storage_key: str):
            return True
        def generate_presigned_url(self, storage_key: str, **kwargs):
            return f"https://spaces/{storage_key}"
        def copy_file(self, *args, **kwargs):
            pass
        def get_file_metadata(self, *args, **kwargs):
            return {}
        def get_file_url(self, *args, **kwargs):
            return ""
        def move_file(self, *args, **kwargs):
            pass
        def stream_file(self, *args, **kwargs):
            yield b"%PDF-1.4 Mock Spaces content"

    reg_08 = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000008")
    ).first()
    assert reg_08 is not None

    orig_provider = storage_service._provider
    try:
        storage_service.set_provider(MockSpacesStorage())
        resp_08 = client.get(f"/api/admin/sama/certificates/{reg_08.id}/download")
        assert resp_08.status_code == 200
        assert resp_08.headers["content-type"] == "application/pdf"
        assert "CSJMU_SAMIKSHA_2026_000008.pdf" in resp_08.headers.get("content-disposition", "")
        assert resp_08.content.startswith(b"%PDF-1.4 Mock Spaces")
    finally:
        storage_service.set_provider(orig_provider)


def test_missing_serials_45_73_absent_in_sadmin(client):
    """Serials 45 and 73 are never returned."""
    for s in ["CSJMU/SAMIKSHA/2026/000045", "CSJMU/SAMIKSHA/2026/000073", "000045", "000073"]:
        resp = client.get(f"/api/admin/sama/certificates?search={s}&origin=all")
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0
        assert len(resp.json()["data"]["items"]) == 0


def test_origin_filters_isolation(client):
    """
    origin=active returns ONLY active records.
    origin=historical returns ONLY historical records.
    """
    # Active only
    resp_act = client.get("/api/admin/sama/certificates?origin=active&limit=100")
    assert resp_act.status_code == 200
    data_act = resp_act.json()["data"]
    assert data_act["total"] == 2
    for item in data_act["items"]:
        assert item["record_type"] == "active"
        assert item["is_legacy"] is False

    # Historical only
    resp_hist = client.get("/api/admin/sama/certificates?origin=historical&limit=100")
    assert resp_hist.status_code == 200
    data_hist = resp_hist.json()["data"]
    assert data_hist["total"] == 75
    for item in data_hist["items"]:
        assert item["record_type"] == "historical"
        assert item["is_legacy"] is True


def test_pagination_across_combined_origins(client):
    """Pagination seamlessly spans across active and historical datasets."""
    # Page 1 (limit=10, skip=0)
    resp_p1 = client.get("/api/admin/sama/certificates?origin=all&limit=10&skip=0")
    assert resp_p1.status_code == 200
    p1 = resp_p1.json()["data"]
    assert p1["total"] == 77
    assert len(p1["items"]) == 10
    # First 2 are active, next 8 are historical
    assert p1["items"][0]["record_type"] == "active"
    assert p1["items"][1]["record_type"] == "active"
    assert p1["items"][2]["record_type"] == "historical"

    # Page 2 (limit=10, skip=10)
    resp_p2 = client.get("/api/admin/sama/certificates?origin=all&limit=10&skip=10")
    assert resp_p2.status_code == 200
    p2 = resp_p2.json()["data"]
    assert p2["total"] == 77
    assert len(p2["items"]) == 10
    for item in p2["items"]:
        assert item["record_type"] == "historical"

    # Ensure no overlap between page 1 and page 2
    p1_ids = {i["id"] for i in p1["items"]}
    p2_ids = {i["id"] for i in p2["items"]}
    assert len(p1_ids.intersection(p2_ids)) == 0


def test_download_revoked_historical_certificate_returns_403(client, db_session):
    """Revoked historical certificates cannot be downloaded (403 Forbidden)."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000007")
    ).first()
    assert reg is not None

    reg.is_revoked = True
    reg.revoked_at = datetime.now(timezone.utc)
    reg.revocation_reason = "Institutional audit revocation"
    db_session.commit()

    try:
        resp = client.get(f"/api/admin/sama/certificates/{reg.id}/download")
        assert resp.status_code == 403
        assert "revoked" in resp.json()["detail"].lower()
    finally:
        reg.is_revoked = False
        reg.revoked_at = None
        reg.revocation_reason = None
        db_session.commit()


def test_download_missing_historical_pdf_returns_404(client, db_session):
    """When a historical certificate has no file in storage archive, returns clean 404."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000011")
    ).first()
    assert reg is not None

    orig_ref = reg.source_pdf_reference
    reg.source_pdf_reference = "non_existent_folder/missing.pdf"
    db_session.commit()

    try:
        resp = client.get(f"/api/admin/sama/certificates/{reg.id}/download")
        assert resp.status_code == 404
        assert "Historical certificate PDF file not found in storage archive." in resp.json()["detail"]
    finally:
        reg.source_pdf_reference = orig_ref
        db_session.commit()


def test_nonexistent_certificate_id_returns_404(client):
    """Invalid UUID returns 404."""
    random_id = uuid.uuid4()
    resp = client.get(f"/api/admin/sama/certificates/{random_id}")
    assert resp.status_code == 404
    resp_dl = client.get(f"/api/admin/sama/certificates/{random_id}/download")
    assert resp_dl.status_code == 404


def test_update_historical_recovery_metadata_success(client, db_session):
    """Admin can repair Scopus ID and storage key, and Scopus ID is immediately searchable."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000008")
    ).first()
    assert reg is not None

    payload = {
        "scopus_id": "57219876543",
        "storage_key": "sama_veda/certificates/recovered_000008.pdf",
        "original_filename": "orig_000008_signed.pdf",
        "recipient_name": "Dr. Repaired Recipient",
        "department": "Biotechnology",
    }

    resp = client.patch(f"/api/admin/sama/certificates/{reg.id}/recovery-metadata", json=payload)
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]

    # Verify response reflects update
    assert data["scopus_id"] == "57219876543"
    assert data["recipient_name"] == "Dr. Repaired Recipient"
    assert data["department"] == "Biotechnology"

    # Verify DB persistence
    db_session.refresh(reg)
    assert reg.recovery_metadata.get("scopus_id") == "57219876543"
    assert reg.recovery_metadata.get("storage_key") == "sama_veda/certificates/recovered_000008.pdf"
    assert reg.source_pdf_reference == "sama_veda/certificates/recovered_000008.pdf"

    # Verify immediate searchability in SAdmin certificates search
    search_resp = client.get("/api/admin/sama/certificates?search=57219876543")
    assert search_resp.status_code == 200
    search_items = search_resp.json()["data"]["items"]
    assert any(i["id"] == str(reg.id) for i in search_items)


def test_partial_update_preserves_untouched_metadata(client, db_session):
    """Updating a single field does not overwrite untouched recovery metadata fields."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000008")
    ).first()
    assert reg is not None

    # Update only department
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"department": "Advanced Bioengineering"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["department"] == "Advanced Bioengineering"
    # Scopus ID and storage key are preserved
    assert data["scopus_id"] == "57219876543"

    db_session.refresh(reg)
    assert reg.recovery_metadata.get("scopus_id") == "57219876543"
    assert reg.recovery_metadata.get("storage_key") == "sama_veda/certificates/recovered_000008.pdf"


def test_update_historical_metadata_validation(client, db_session):
    """Validation rejects invalid Scopus IDs and unsafe storage keys."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000009")
    ).first()
    assert reg is not None

    # Invalid Scopus ID (non-numeric)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"scopus_id": "SCOPUS_ABC_123"},
    )
    assert resp.status_code == 422
    assert "8 to 12" in resp.json()["detail"]

    # Invalid Scopus ID (too short)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"scopus_id": "12345"},
    )
    assert resp.status_code == 422

    # Unsafe storage key (path traversal)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"storage_key": "../../etc/passwd.pdf"},
    )
    assert resp.status_code == 422
    assert "traversal" in resp.json()["detail"].lower()

    # Unsafe storage key (root slash)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"storage_key": "/absolute/path/file.pdf"},
    )
    assert resp.status_code == 422

    # Unsafe storage key (Windows drive)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"storage_key": "C:\\certs\\file.pdf"},
    )
    assert resp.status_code == 422

    # Unsafe storage key (external URL)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"storage_key": "https://malicious.com/fake.pdf"},
    )
    assert resp.status_code == 422

    # Unsafe storage key (not a PDF)
    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"storage_key": "sama_veda/certificates/malware.exe"},
    )
    assert resp.status_code == 422


def test_active_certificate_rejected_on_recovery_metadata(client, db_session):
    """Active certificate ledger records cannot be modified via recovery metadata endpoint (400)."""
    active_cert = db_session.scalars(
        select(FelicitationCertificate).where(FelicitationCertificate.certificate_number == "CSJMU/SAMIKSHA/2026/000001")
    ).first()
    assert active_cert is not None

    resp = client.patch(
        f"/api/admin/sama/certificates/{active_cert.id}/recovery-metadata",
        json={"scopus_id": "57211112222"},
    )
    assert resp.status_code == 400
    assert "strictly restricted to historical certificates" in resp.json()["detail"]


def test_test_pdf_availability_endpoint(client, db_session, monkeypatch):
    """Test PDF availability endpoint correctly inspects storage provider without exposing secrets."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000010")
    ).first()
    assert reg is not None

    # 1. Missing file check
    resp = client.post(
        f"/api/admin/sama/certificates/{reg.id}/test-pdf",
        json={"storage_key": "sama_veda/certificates/definitely_missing_file_99999.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "missing"
    assert data["storage_key"] == "sama_veda/certificates/definitely_missing_file_99999.pdf"

    # 2. Existing file check (mocked storage provider)
    class MockStorageProvider:
        provider_name = "digitalocean_spaces"

        def exists(self, key: str) -> bool:
            return key == "sama_veda/certificates/present_file.pdf"

        def get_file_metadata(self, key: str):
            if key == "sama_veda/certificates/present_file.pdf":
                return {"size": 1048576, "content_length": 1048576}
            return {}

        def get_file_path(self, key: str):
            return None

    monkeypatch.setattr(storage_service, "_provider", MockStorageProvider())

    resp = client.post(
        f"/api/admin/sama/certificates/{reg.id}/test-pdf",
        json={"storage_key": "sama_veda/certificates/present_file.pdf"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] == "found"
    assert data["file_size_bytes"] == 1048576
    assert data["provider"] == "digitalocean_spaces"

    # 3. Active certificate rejected on test-pdf
    active_cert = db_session.scalars(
        select(FelicitationCertificate).where(FelicitationCertificate.certificate_number == "CSJMU/SAMIKSHA/2026/000001")
    ).first()
    resp_act = client.post(
        f"/api/admin/sama/certificates/{active_cert.id}/test-pdf",
        json={"storage_key": "sama_veda/certificates/test.pdf"},
    )
    assert resp_act.status_code == 400


def test_download_resolves_manually_assigned_storage_key_priority(client, db_session, tmp_path, monkeypatch):
    """When a historical certificate has a manually assigned storage_key, it takes precedence in download."""
    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000012")
    ).first()
    assert reg is not None

    # Create dummy PDF file for download
    custom_pdf = tmp_path / "custom_manual_target.pdf"
    custom_pdf.write_bytes(b"%PDF-1.4\n%Manual Priority PDF\n%%EOF")

    class ManualPriorityProvider:
        provider_name = "digitalocean_spaces"

        def exists(self, key: str) -> bool:
            return key == "sama_veda/certificates/custom_manual_target.pdf"

        def download_file(self, key: str) -> Path:
            if key == "sama_veda/certificates/custom_manual_target.pdf":
                return custom_pdf
            raise FileNotFoundError(f"Missing {key}")

        def get_file_path(self, key: str) -> Path:
            if key == "sama_veda/certificates/custom_manual_target.pdf":
                return custom_pdf
            raise FileNotFoundError(f"Missing {key}")

    monkeypatch.setattr(storage_service, "_provider", ManualPriorityProvider())

    # Set manual storage_key in recovery metadata
    meta = dict(reg.recovery_metadata or {})
    meta["storage_key"] = "sama_veda/certificates/custom_manual_target.pdf"
    reg.recovery_metadata = meta
    reg.source_pdf_reference = "sama_veda/certificates/custom_manual_target.pdf"
    db_session.commit()

    # Trigger download
    dl_resp = client.get(f"/api/admin/sama/certificates/{reg.id}/download")
    assert dl_resp.status_code == 200
    assert dl_resp.headers["content-type"] == "application/pdf"
    assert b"%Manual Priority PDF" in dl_resp.content


def test_audit_logging_on_recovery_metadata_update(client, db_session):
    """Verifies that an audit log entry is recorded with changed fields, without secrets or tokens."""
    from app.models.audit import AuditLog

    reg = db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000013")
    ).first()
    assert reg is not None

    resp = client.patch(
        f"/api/admin/sama/certificates/{reg.id}/recovery-metadata",
        json={"scopus_id": "57299887766", "department": "Department of Physics"},
    )
    assert resp.status_code == 200

    # Query audit logs for this entity
    audit_entry = db_session.scalars(
        select(AuditLog).where(
            AuditLog.entity_name == "LegacyCertificateRegistry",
            AuditLog.entity_id == str(reg.id),
            AuditLog.action == "historical_recovery_metadata_updated",
        )
    ).first()

    assert audit_entry is not None
    assert audit_entry.module == "sama_veda"
    details = audit_entry.details or {}
    assert "changed_fields" in details
    assert "scopus_id" in details["changed_fields"]
    assert "department" in details["changed_fields"]
    # Ensure verification_token is never in audit details
    details_str = json.dumps(details)
    assert "verification_token" not in details_str
    assert reg.verification_token not in details_str
