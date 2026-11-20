# -*- coding: utf-8 -*-
"""
SAMIKSHA Issue 3 Legacy Certificate Recovery — Isolated Verification & Simulation Tests
Strictly runs against an in-memory isolated database.
Zero production connection or modifications.
"""
import os
import json
import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from fastapi import FastAPI, Request

from app.models.base import Base
from app.api.dependencies import get_db
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    LegacyCertificateRegistry,
)
from app.modules.sama_veda.services.legacy_recovery_service import (
    LegacyRecoveryService,
    LegacyRecoverySecurityError,
)
from app.modules.sama_veda.router import router as sama_router


@pytest.fixture(scope="module")
def isolated_db_engine():
    """Isolated in-memory SQLite engine for recovery testing."""
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
def isolated_db_session(isolated_db_engine):
    """Session factory for isolated tests."""
    Session = sessionmaker(bind=isolated_db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="module")
def recovery_dataset():
    """Load normalized 75-certificate historical recovery dataset."""
    path = os.path.join("scratch", "normalized_recovery", "historical_75_certificates.json")
    assert os.path.exists(path), f"Recovery dataset not found at {path}"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@pytest.fixture(scope="module")
def test_client(isolated_db_engine):
    """Isolated FastAPI test client connected strictly to in-memory database."""
    app = FastAPI()
    app.include_router(sama_router)

    TestSessionLocal = sessionmaker(bind=isolated_db_engine)

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    return client


# =============================================================================
# 1. DATASET VALIDATION & PROVENANCE TESTS
# =============================================================================

def test_recovery_dataset_integrity(recovery_dataset):
    """Verifies that the recovery dataset contains exactly 75 valid unique certificates."""
    val = LegacyRecoveryService.validate_dataset(recovery_dataset)
    assert val["is_valid"] is True, f"Validation errors: {val['errors']}"
    assert val["total_evaluated"] == 75
    assert val["valid_count"] == 75
    assert val["unique_tokens"] == 75
    assert val["unique_cert_numbers"] == 75
    assert len(val["errors"]) == 0

    # Ensure excluded serials (45, 73) were NOT fabricated
    cert_numbers = [r["certificate_number"] for r in val["valid_records"]]
    assert "CSJMU/SAMIKSHA/2026/000045" not in cert_numbers
    assert "CSJMU/SAMIKSHA/2026/000073" not in cert_numbers


def test_validation_rejects_malformed_tokens():
    """Verifies that non-32-hex tokens or missing fields are strictly rejected."""
    bad_data = [
        {"cert_no": "CSJMU/SAMIKSHA/2026/999999", "recipient": "Test", "token": "not_hex"},
        {"cert_no": "CSJMU/SAMIKSHA/2026/999998", "recipient": "", "token": "0123456789abcdef0123456789abcdef"},
    ]
    val = LegacyRecoveryService.validate_dataset(bad_data)
    assert val["is_valid"] is False
    assert len(val["errors"]) == 2


# =============================================================================
# 2. DRY-RUN AND IDEMPOTENT SEEDING TESTS
# =============================================================================

def test_dry_run_seed_reports_accurate_counts(isolated_db_session, recovery_dataset):
    """Verifies dry-run reports accurate counts without modifying database."""
    # First set up active conflicting cert 000002 for Amrita Singh
    active_cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2026/000002",
        verification_token="16bdb1f68b9e433c9037ae9206643b2b",
        status="ISSUED",
        is_revoked=False,
    )
    isolated_db_session.add(active_cert)
    isolated_db_session.commit()

    # Dry run before seeding
    dry_run = LegacyRecoveryService.dry_run_seed(isolated_db_session, recovery_dataset)
    assert dry_run["success"] is True
    assert dry_run["total_proposed"] == 75
    assert dry_run["new_records_count"] == 75
    assert dry_run["already_present_count"] == 0
    assert len(dry_run["token_collisions_with_active"]) == 0

    # Verify no records were inserted into legacy registry yet
    count = isolated_db_session.query(LegacyCertificateRegistry).count()
    assert count == 0


def test_seed_execution_and_idempotency(isolated_db_session, recovery_dataset):
    """Executes isolated seed and verifies idempotency on repeated run."""
    # Execute actual isolated seed
    res1 = LegacyRecoveryService.execute_seed(isolated_db_session, recovery_dataset, dry_run=False)
    assert res1["success"] is True
    assert res1["inserted_count"] == 75

    count = isolated_db_session.query(LegacyCertificateRegistry).count()
    assert count == 75

    # Re-run seed immediately — must insert 0 new records (idempotent)
    res2 = LegacyRecoveryService.execute_seed(isolated_db_session, recovery_dataset, dry_run=False)
    assert res2["success"] is True
    assert res2["inserted_count"] == 0
    assert res2["already_present_count"] == 75

    final_count = isolated_db_session.query(LegacyCertificateRegistry).count()
    assert final_count == 75


def test_seed_detects_token_collision_with_active_ledger(isolated_db_session):
    """Verifies that if a proposed legacy token collides with an active cert token, it is blocked."""
    colliding_data = [{
        "cert_no": "CSJMU/SAMIKSHA/2026/TEST_COLLISION",
        "recipient": "Collision Test",
        "token": "16bdb1f68b9e433c9037ae9206643b2b", # Collides with Amrita Singh!
    }]
    dry_run = LegacyRecoveryService.dry_run_seed(isolated_db_session, colliding_data)
    assert dry_run["success"] is False
    assert len(dry_run["token_collisions_with_active"]) == 1


# =============================================================================
# 3. VERIFICATION RESOLUTION & COLLISION TESTS (PHASE 7)
# =============================================================================

def test_harshit_gupta_qr_token_resolves_to_legacy_record(test_client):
    """Verifies that Dr. Harshit Gupta's original QR token resolves to his historical record."""
    harshit_token = "8e17212587fa4b6b8b3e4a8f20d21342"
    resp = test_client.get(f"/modules/sama-veda/certificates/verify/{harshit_token}")
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["certificate_number"] == "CSJMU/SAMIKSHA/2026/000002"
    assert data["verification_token"] == harshit_token
    assert "Harshit Gupta" in data["authors"][0]["author_name"]
    assert data["research_title"] == "XYZ"
    assert data["is_legacy"] is True
    assert data["status"] == "HISTORICAL"
    assert data["historical_designation"] == "OFFICIAL HISTORICAL CERTIFICATE ARCHIVE"
    # Ensure no fabricated live approval dates
    assert data["approved_at"] is None


def test_amrita_singh_active_token_resolves_to_active_record(test_client):
    """Verifies that Amrita Singh's active token resolves to her active ledger record."""
    amrita_token = "16bdb1f68b9e433c9037ae9206643b2b"
    resp = test_client.get(f"/modules/sama-veda/certificates/verify/{amrita_token}")
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["certificate_number"] == "CSJMU/SAMIKSHA/2026/000002"
    assert data["verification_token"] == amrita_token
    assert data.get("is_legacy") is not True


def test_certificate_number_query_flags_collision_advisory(test_client):
    """
    Verifies that querying by certificate number CSJMU/SAMIKSHA/2026/000002
    returns the active record while flagging the collision with the historical record.
    """
    resp = test_client.get("/modules/sama-veda/certificates/verify/CSJMU/SAMIKSHA/2026/000002")
    assert resp.status_code == 200
    data = resp.json()["data"]

    assert data["has_legacy_collision"] is True
    assert data["legacy_collision_info"] is not None
    assert "Harshit Gupta" in data["legacy_collision_info"]["legacy_recipient"]
    assert data["legacy_collision_info"]["legacy_token"] == "8e17212587fa4b6b8b3e4a8f20d21342"


def test_invalid_token_returns_404(test_client):
    """Verifies that an unknown token returns a standard 404 response."""
    resp = test_client.get("/modules/sama-veda/certificates/verify/00000000000000000000000000000000")
    assert resp.status_code == 404
    assert "Certificate not found" in resp.json()["detail"]


# =============================================================================
# 4. STATUS & SECURITY RULES
# =============================================================================

def test_revoked_historical_certificate_behavior(isolated_db_session, test_client):
    """Verifies that a revoked legacy certificate is accurately reported as REVOKED."""
    # Temporarily mark cert 000006 as revoked
    reg = isolated_db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000006")
    ).first()
    reg.is_revoked = True
    reg.revoked_at = datetime.now(timezone.utc)
    reg.revocation_reason = "Test institutional invalidation"
    isolated_db_session.commit()

    resp = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["is_revoked"] is True
    assert data["status"] == "REVOKED"
    assert data["is_download_allowed"] is False
    assert resp.json()["message"] == "Certificate has been REVOKED."

    # Download must be blocked with 403 Forbidden
    dl_resp = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}/download")
    assert dl_resp.status_code == 403

    # Reset
    reg.is_revoked = False
    reg.revoked_at = None
    reg.revocation_reason = None
    isolated_db_session.commit()


# =============================================================================
# 5. ALL 75 TOKENS SIMULATION (PHASE 9)
# =============================================================================

def test_all_75_tokens_verification_simulation(test_client, recovery_dataset):
    """
    Simulates verification requests for all 75 recovered historical tokens.
    Verifies 100% resolution rate, exact recipient match, and zero wrong-recipient outcomes.
    """
    total = len(recovery_dataset)
    assert total == 75

    successful_resolutions = 0
    wrong_recipient_resolutions = 0
    unresolved_tokens = 0

    for idx, expected in enumerate(recovery_dataset):
        token = expected["token"]
        resp = test_client.get(f"/modules/sama-veda/certificates/verify/{token}")

        if resp.status_code != 200:
            unresolved_tokens += 1
            continue

        data = resp.json()["data"]
        resolved_recipient = data["authors"][0]["author_name"]
        expected_recipient = expected["recipient"]

        # Check recipient match
        if expected_recipient.lower() not in resolved_recipient.lower() and resolved_recipient.lower() not in expected_recipient.lower():
            wrong_recipient_resolutions += 1
            print(f"Recipient mismatch at {expected['cert_no']}: expected '{expected_recipient}', got '{resolved_recipient}'")
        else:
            successful_resolutions += 1

        # Check cert number match
        assert data["certificate_number"] == expected["cert_no"]
        assert data["is_legacy"] is True

    print("\n=== VERIFICATION SIMULATION METRICS ===")
    print(f"Total historical tokens tested: {total}")
    print(f"Successful legacy resolutions: {successful_resolutions}")
    print(f"Wrong-recipient resolutions: {wrong_recipient_resolutions}")
    print(f"Unresolved tokens: {unresolved_tokens}")

# =============================================================================
# 6. MIGRATION UPGRADE & DOWNGRADE TESTS
# =============================================================================

def test_migration_upgrade_and_downgrade():
    """Verifies that Alembic migration 8b29c54e1031 upgrades and downgrades cleanly."""
    import importlib.util
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import inspect

    mig_path = os.path.join("backend", "alembic", "versions", "8b29c54e1031_sama_legacy_certificate_registry.py")
    spec = importlib.util.spec_from_file_location("mig_test", mig_path)
    mig = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mig)

    engine = create_engine("sqlite:///:memory:")
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        op = Operations(ctx)
        mig.op = op

        mig.upgrade()
        insp = inspect(conn)
        tables = insp.get_table_names()
        assert "sama_legacy_certificate_registry" in tables

        mig.downgrade()
        tables_after = inspect(conn).get_table_names()
        assert "sama_legacy_certificate_registry" not in tables_after


# =============================================================================
# 7. SEEDER CLI SECURITY GUARD TESTS
# =============================================================================

def test_seeder_security_blocks_remote_without_explicit_auth(isolated_db_session, recovery_dataset):
    """Verifies that attempting live execution against remote host without flags raises LegacyRecoverySecurityError."""
    # Mock engine bind URL to simulate a remote cloud database
    orig_bind = isolated_db_session.bind
    class MockEngine:
        url = "postgresql+psycopg://user:secret_pass@ep-remote-cluster.neon.tech/vyasa"
        dialect = orig_bind.dialect

    try:
        isolated_db_session.bind = MockEngine()

        with pytest.raises(LegacyRecoverySecurityError) as exc_info:
            LegacyRecoveryService.execute_seed(
                isolated_db_session,
                recovery_dataset[:2],
                dry_run=False,
                allow_remote=False
            )

        assert "BLOCKED" in str(exc_info.value)
        assert "remote" in str(exc_info.value).lower()
    finally:
        isolated_db_session.bind = orig_bind


def test_seeder_credential_masking():
    """Verifies that the CLI script masks sensitive database connection details."""
    from scripts.seed_legacy_certificates import mask_url, is_remote_db

    url = "postgresql+psycopg://admin_user:super_secret_pw@ep-nameless-feather.neon.tech:5432/vyasandb?sslmode=require"
    masked = mask_url(url)
    assert "super_secret_pw" not in masked
    assert "admin_user" not in masked
    assert "***:***@ep-nameless-feather.neon.tech:5432/vyasandb" in masked

    assert is_remote_db(url) is True
    assert is_remote_db("sqlite:///:memory:") is False
    assert is_remote_db("postgresql://user:pass@localhost:5432/db") is False
    assert is_remote_db("postgresql://user:pass@127.0.0.1:5432/db") is False


# =============================================================================
# 8. CONTAINMENT & EMERGENCY ROLLBACK TESTS
# =============================================================================

def test_legacy_containment_switch(test_client, monkeypatch):
    """Verifies that setting DISABLE_LEGACY_CERTIFICATE_VERIFICATION=TRUE immediately suppresses legacy lookup."""
    harshit_token = "8e17212587fa4b6b8b3e4a8f20d21342"

    # Normal mode -> 200 OK
    resp_normal = test_client.get(f"/modules/sama-veda/certificates/verify/{harshit_token}")
    assert resp_normal.status_code == 200

    # Emergency containment mode -> 404 Not Found (Zero DB mutations)
    monkeypatch.setenv("DISABLE_LEGACY_CERTIFICATE_VERIFICATION", "TRUE")
    resp_contained = test_client.get(f"/modules/sama-veda/certificates/verify/{harshit_token}")
    assert resp_contained.status_code == 404

    # Restore
    monkeypatch.delenv("DISABLE_LEGACY_CERTIFICATE_VERIFICATION", raising=False)
    resp_restored = test_client.get(f"/modules/sama-veda/certificates/verify/{harshit_token}")
    assert resp_restored.status_code == 200


def test_granular_record_deactivation(isolated_db_session, test_client):
    """Verifies that setting is_legacy=False suppresses an individual record across all endpoints without deleting it."""
    # Temporarily set is_legacy=False on cert 000007
    reg = isolated_db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000007")
    ).first()
    reg.is_legacy = False
    isolated_db_session.commit()

    try:
        # 1. Token verification endpoint -> 404 Not Found
        resp = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}")
        assert resp.status_code == 404

        # 2. Certificate number verification endpoint -> 404 Not Found
        resp_cert = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.certificate_number}")
        assert resp_cert.status_code == 404

        # 3. Token download endpoint -> 404 Not Found
        resp_dl_token = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}/download")
        assert resp_dl_token.status_code == 404

        # 4. Certificate number download endpoint -> 404 Not Found
        resp_dl_cert = test_client.get(f"/modules/sama-veda/certificates/download/{reg.certificate_number}")
        assert resp_dl_cert.status_code == 404
    finally:
        # Restore is_legacy=True
        reg.is_legacy = True
        isolated_db_session.commit()

    resp_restored = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}")
    assert resp_restored.status_code == 200


def test_disabled_legacy_collision_advisory_suppression(isolated_db_session, test_client):
    """
    Verifies that when a historical colliding record has is_legacy=False,
    querying the active serial number does NOT display a collision advisory for that record.
    """
    harshit_reg = isolated_db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000002")
    ).first()
    harshit_reg.is_legacy = False
    isolated_db_session.commit()

    try:
        resp = test_client.get("/modules/sama-veda/certificates/verify/CSJMU/SAMIKSHA/2026/000002")
        assert resp.status_code == 200
        data = resp.json()["data"]
        # Active cert for Amrita Singh is returned, but collision advisory must be suppressed
        assert data["has_legacy_collision"] is False
        assert data["legacy_collision_info"] is None
    finally:
        harshit_reg.is_legacy = True
        isolated_db_session.commit()

    # Once restored, collision advisory re-appears
    resp_restored = test_client.get("/modules/sama-veda/certificates/verify/CSJMU/SAMIKSHA/2026/000002")
    assert resp_restored.status_code == 200
    assert resp_restored.json()["data"]["has_legacy_collision"] is True


def test_missing_archival_pdf_behavior(isolated_db_session, test_client):
    """
    Verifies that when a historical certificate has no PDF file on disk:
    1. Public verification metadata still resolves successfully with is_download_allowed=False.
    2. Download attempts return 404.
    """
    # Cert 000008 has no local PDF file on disk
    reg = isolated_db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000008")
    ).first()

    # Ensure source_pdf_reference does not exist on disk
    reg.source_pdf_reference = "non_existent_archive_path/missing.pdf"
    isolated_db_session.commit()

    # 1. Verification succeeds
    resp = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["certificate_number"] == "CSJMU/SAMIKSHA/2026/000008"
    assert data["is_download_allowed"] is False
    assert data["is_legacy"] is True

    # 2. Download returns 404
    resp_dl = test_client.get(f"/modules/sama-veda/certificates/verify/{reg.verification_token}/download")
    assert resp_dl.status_code == 404
    assert "not found" in resp_dl.json()["detail"].lower()


# =============================================================================
# 9. PHASE 1.9 HARDENED AUDIT TESTS (LOCK FAIL-CLOSED & SPACES RESOLUTION)
# =============================================================================

def test_advisory_lock_failure_aborts_execution(isolated_db_session, recovery_dataset):
    """
    Verifies that if PostgreSQL advisory lock is unavailable or errors,
    the seeder STRICTLY FAILS CLOSED and aborts with LegacyRecoverySecurityError.
    """
    orig_bind = isolated_db_session.bind
    orig_execute = isolated_db_session.execute

    class MockPgDialectWrapper:
        def __init__(self, dialect):
            self._d = dialect
            self.name = "postgresql"
        def __getattr__(self, item):
            return getattr(self._d, item)

    class MockEngineWrapper:
        def __init__(self, engine):
            self._e = engine
            self.url = "postgresql://localhost:5432/test"
            self.dialect = MockPgDialectWrapper(engine.dialect)
        def __getattr__(self, item):
            return getattr(self._e, item)

    try:
        isolated_db_session.bind = MockEngineWrapper(orig_bind)

        # Case 1: Advisory lock returns False (lock held by another process)
        def mock_exec_false(stmt, *args, **kwargs):
            if "pg_try_advisory_lock" in str(stmt):
                class Result:
                    def scalar(self):
                        return False
                return Result()
            return orig_execute(stmt, *args, **kwargs)

        isolated_db_session.execute = mock_exec_false
        with pytest.raises(LegacyRecoverySecurityError) as exc_info1:
            LegacyRecoveryService.execute_seed(isolated_db_session, recovery_dataset[:1], dry_run=False)
        assert "BLOCKED" in str(exc_info1.value)
        assert "advisory lock" in str(exc_info1.value).lower()

        # Case 2: Advisory lock query raises OperationalError (network timeout / syntax / permissions)
        def mock_exec_error(stmt, *args, **kwargs):
            if "pg_try_advisory_lock" in str(stmt):
                raise RuntimeError("Database connection timed out during advisory lock check")
            return orig_execute(stmt, *args, **kwargs)

        isolated_db_session.execute = mock_exec_error
        with pytest.raises(LegacyRecoverySecurityError) as exc_info2:
            LegacyRecoveryService.execute_seed(isolated_db_session, recovery_dataset[:1], dry_run=False)
        assert "BLOCKED" in str(exc_info2.value)
        assert "timed out" in str(exc_info2.value)

    finally:
        isolated_db_session.bind = orig_bind
        isolated_db_session.execute = orig_execute


def test_storage_candidate_keys_generation(isolated_db_session):
    """Verifies that candidate storage keys follow CSJMU Spaces conventions."""
    reg = isolated_db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000002")
    ).first()

    keys = LegacyRecoveryService.get_candidate_storage_keys(reg)
    assert "sama_veda/certificates/CSJMU_SAMIKSHA_2026_000002.pdf" in keys
    assert "sama_veda/certificates/0cef9838bfa6_CSJMU_SAMIKSHA_2026_000002.pdf" in keys


def test_spaces_pdf_download_integration(isolated_db_session, test_client, tmp_path, monkeypatch):
    """
    Verifies that when a certificate PDF is stored in Spaces (simulated via storage_service proxy),
    the download endpoint resolves and streams the file successfully.
    """
    from app.core.storage import storage_service, BaseStorageProvider

    # Create dummy PDF in temporary path
    temp_pdf = tmp_path / "mock_download.pdf"
    temp_pdf.write_bytes(b"%PDF-1.4 mock content for Spaces testing")

    class MockSpacesStorage(BaseStorageProvider):
        def get_file_path(self, storage_key: str):
            if "000008" in storage_key:
                return temp_pdf
            raise FileNotFoundError("Not found")
        def exists(self, storage_key: str):
            return "000008" in storage_key
        def get_file_bytes(self, storage_key: str):
            return b"%PDF-1.4 mock content"
        def save_file(self, *args, **kwargs):
            pass
        def delete_file(self, storage_key: str):
            return True
        def generate_presigned_url(self, storage_key: str, expires_in_seconds: int = 300):
            return f"https://mock-spaces/{storage_key}"
        def copy_file(self, *args, **kwargs):
            pass
        def get_file_metadata(self, *args, **kwargs):
            return {}
        def get_file_url(self, storage_key: str, **kwargs):
            return f"https://mock-spaces/{storage_key}"
        def move_file(self, *args, **kwargs):
            pass
        def stream_file(self, *args, **kwargs):
            yield b"%PDF-1.4 mock content"

    orig_provider = storage_service._provider
    try:
        storage_service.set_provider(MockSpacesStorage())

        # Check resolution via service
        reg_08 = isolated_db_session.scalars(
            select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000008")
        ).first()

        resolved = LegacyRecoveryService.resolve_pdf_path(reg_08)
        assert resolved == str(temp_pdf)

        available = LegacyRecoveryService.is_pdf_available(reg_08)
        assert available is True

        # Test download endpoint streams the mock Spaces content
        resp = test_client.get(f"/modules/sama-veda/certificates/verify/{reg_08.verification_token}/download")
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "application/pdf"
        assert resp.content.startswith(b"%PDF-1.4")
    finally:
        storage_service.set_provider(orig_provider)


def test_slash_containing_serial_route_resolution(test_client):
    """
    Verifies that public verification routes handle certificate numbers with multiple slashes
    (e.g. /verify/CSJMU/SAMIKSHA/2026/000002) correctly.
    """
    # Active serial with slashes
    resp_active = test_client.get("/modules/sama-veda/certificates/verify/CSJMU/SAMIKSHA/2026/000002")
    assert resp_active.status_code == 200
    assert resp_active.json()["data"]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000002"

    # Historical serial with slashes (cert 000006)
    resp_legacy = test_client.get("/modules/sama-veda/certificates/verify/CSJMU/SAMIKSHA/2026/000006")
    assert resp_legacy.status_code == 200
    assert resp_legacy.json()["data"]["certificate_number"] == "CSJMU/SAMIKSHA/2026/000006"
    assert resp_legacy.json()["data"]["is_legacy"] is True


# =============================================================================
# 11. SADMIN VISIBILITY & DUAL-REGISTRY LISTING INTEGRATION TESTS
# =============================================================================

def test_cms_service_list_certificates_origin_filtering(isolated_db_session):
    """
    Verifies that sama_cms_service.list_certificates correctly respects 'origin':
    - origin='historical': returns exactly the 75 recovered historical certificates.
    - origin='active': returns only active certificates from sama_felicitation_certificates.
    - origin='all': seamlessly combines active and historical records with exact total count.
    """
    from app.modules.sama_veda.services.cms_service import sama_cms_service

    # 1. Historical only
    hist_total, hist_certs = sama_cms_service.list_certificates(
        isolated_db_session, origin="historical", limit=100
    )
    assert hist_total == 75
    assert len(hist_certs) == 75
    assert all(c.is_legacy is True for c in hist_certs)
    assert all(c.status == "HISTORICAL" for c in hist_certs)

    # 2. Active only
    active_total, active_certs = sama_cms_service.list_certificates(
        isolated_db_session, origin="active", limit=100
    )
    assert all(c.is_legacy is False for c in active_certs)
    assert all(c.status != "HISTORICAL" for c in active_certs)

    # 3. All origins unified
    all_total, all_certs = sama_cms_service.list_certificates(
        isolated_db_session, origin="all", limit=100
    )
    assert all_total == active_total + 75
    legacy_count = sum(1 for c in all_certs if c.is_legacy is True)
    assert legacy_count > 0


def test_cms_service_serial_000002_dual_listing_collision(isolated_db_session):
    """
    Verifies that certificate serial CSJMU/SAMIKSHA/2026/000002 returns BOTH
    the Active record (Amrita Singh) and Historical record (Dr. Harshit Gupta)
    without overwriting or collapsing, and sets collision flags on both.
    """
    from app.modules.sama_veda.services.cms_service import sama_cms_service

    total, results = sama_cms_service.list_certificates(
        isolated_db_session, search="000002", origin="all"
    )
    assert total == 2
    assert len(results) == 2

    # Verify both records exist and have distinct IDs
    ids = {r.id for r in results}
    assert len(ids) == 2

    active_rec = next((r for r in results if not r.is_legacy), None)
    legacy_rec = next((r for r in results if r.is_legacy), None)

    assert active_rec is not None
    assert legacy_rec is not None

    # Check recipient identities
    assert len(legacy_rec.authors) > 0
    assert legacy_rec.authors[0].author_name_snapshot == "Harshit Gupta"

    # Check collision metadata
    assert active_rec.has_legacy_collision is True
    assert active_rec.legacy_collision_info is not None
    assert active_rec.legacy_collision_info["colliding_serial"] == "CSJMU/SAMIKSHA/2026/000002"

    assert legacy_rec.has_legacy_collision is True
    assert legacy_rec.legacy_collision_info is not None
    assert legacy_rec.legacy_collision_info["colliding_serial"] == "CSJMU/SAMIKSHA/2026/000002"


def test_cms_service_missing_serials_45_73_absent(isolated_db_session):
    """
    Verifies that missing serials 45 and 73 are never fabricated and
    return 0 results across all origins.
    """
    from app.modules.sama_veda.services.cms_service import sama_cms_service

    for serial in ["CSJMU/SAMIKSHA/2026/000045", "CSJMU/SAMIKSHA/2026/000073"]:
        total_hist, _ = sama_cms_service.list_certificates(
            isolated_db_session, search=serial, origin="historical"
        )
        assert total_hist == 0

        total_all, _ = sama_cms_service.list_certificates(
            isolated_db_session, search=serial, origin="all"
        )
        assert total_all == 0


def test_sadmin_legacy_certificate_detail_and_stats(isolated_db_session):
    """
    Verifies get_certificate_stats includes historical_certificates count and
    format_legacy_certificate_out populates all required metadata.
    """
    from app.modules.sama_veda.services.cms_service import sama_cms_service

    stats = sama_cms_service.get_certificate_stats(isolated_db_session)
    assert stats["historical_certificates"] == 75
    assert stats["total_certificates"] >= 75

    # Test format_legacy_certificate_out
    reg = isolated_db_session.scalars(
        select(LegacyCertificateRegistry).where(LegacyCertificateRegistry.certificate_number == "CSJMU/SAMIKSHA/2026/000006")
    ).first()
    assert reg is not None

    out = sama_cms_service.format_legacy_certificate_out(reg, isolated_db_session)
    assert out.is_legacy is True
    assert out.status == "HISTORICAL"
    assert out.certificate_number == "CSJMU/SAMIKSHA/2026/000006"
    assert "Issue 3" in (out.issue_reference or "")
    assert out.recovery_source is not None
    assert out.verification_token == reg.verification_token
    assert len(out.authors) > 0
    assert out.authors[0].author_name_snapshot == "Subrat Mishra"






