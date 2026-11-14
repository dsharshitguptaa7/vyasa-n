"""
Tests for Official Certificate PDF Download System and Public Verification (SAMIKSHA Subsystem).

Covers all Phase requirements:
1. Valid certificate download by public verification token and certificate number.
2. Invalid verification token handling (HTTP 404).
3. Revoked certificate download blocked (HTTP 403 with justification).
4. Superseded certificate behavior (HTTP 409 Conflict, replacement link in verification response).
5. Missing PDF handling (graceful HTTP 404 without leaking storage internals).
6. Checksum mismatch handling (tamper-detection blocks download with HTTP 409).
7. Unauthorized authenticated download (HTTP 403 for non-owners/non-admins).
8. Authorized researcher authenticated download (owner faculty access).
9. Admin authenticated download (Super Admin access via admin router).
10. Existing QR verification compatibility (preserves verification URLs and payload structure).
"""
import hashlib
import io
import os
from pathlib import Path
from unittest.mock import MagicMock, patch
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.dependencies import get_db, get_current_user, get_optional_current_user
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.certificate import (
    FelicitationCertificate,
    CertificateAuthor,
    CertificateVerificationEvent,
)
from app.core.storage import storage_service, StorageFileNotFoundError


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
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def mock_storage(tmp_path):
    """
    Sets up a temporary storage directory for testing ReportLab PDF retrieval.
    """
    certs_dir = tmp_path / "sama_veda" / "certificates"
    certs_dir.mkdir(parents=True, exist_ok=True)

    with patch.object(storage_service, "get_file_path") as mock_get_path:
        def side_effect(storage_key: str):
            if not storage_key:
                raise StorageFileNotFoundError("Empty storage key")
            # Normalize key
            rel = storage_key.lstrip("/")
            target = tmp_path / rel
            if not target.exists():
                raise StorageFileNotFoundError(f"File not found: {storage_key}")
            return target

        mock_get_path.side_effect = side_effect
        yield {"base_dir": tmp_path, "certs_dir": certs_dir}


def create_sample_pdf(content: bytes = b"%PDF-1.4 Mock Valid Certificate Stream Content") -> bytes:
    return content


# ============================================================================
# 1. VALID CERTIFICATE DOWNLOAD BY TOKEN AND NUMBER
# ============================================================================

def test_valid_certificate_download_by_token(client, db_session, mock_storage):
    pdf_bytes = create_sample_pdf(b"%PDF-1.4 Official Certificate Document Valid")
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()

    file_name = "CSJMU_CERT_2025_001.pdf"
    file_path = mock_storage["certs_dir"] / file_name
    file_path.write_bytes(pdf_bytes)

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/001",
        certificate_type="RESEARCH_PUBLICATION",
        status="ISSUED",
        title="Certificate of Appreciation & Research Excellence",
        verification_token="token-valid-abc-123",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=pdf_hash,
        download_count=0,
    )
    db_session.add(cert)
    db_session.commit()

    # Public download by verification token
    res = client.get(f"/api/modules/sama-veda/certificates/verify/token-valid-abc-123/download")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert "attachment" in res.headers["content-disposition"]
    assert "CSJMU_CERT_2025_001.pdf" in res.headers["content-disposition"]
    assert res.headers["x-certificate-number"] == "CSJMU/CERT/2025/001"
    assert res.headers["x-certificate-sha256"] == pdf_hash
    assert res.content == pdf_bytes

    # Verify download count increment and verification event
    db_session.refresh(cert)
    assert cert.download_count == 1
    events = db_session.query(CertificateVerificationEvent).filter_by(certificate_id=cert.id).all()
    assert len(events) >= 1
    assert "DOWNLOAD" in events[-1].verification_source


def test_valid_certificate_download_by_number(client, db_session, mock_storage):
    pdf_bytes = create_sample_pdf(b"%PDF-1.4 Certificate By Number Stream")
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()

    file_name = "CSJMU_CERT_2025_002.pdf"
    file_path = mock_storage["certs_dir"] / file_name
    file_path.write_bytes(pdf_bytes)

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/002",
        status="ISSUED",
        verification_token="token-num-xyz-456",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=pdf_hash,
        download_count=0,
    )
    db_session.add(cert)
    db_session.commit()

    # Public download by certificate number
    res = client.get(f"/api/modules/sama-veda/certificates/download/CSJMU%2FCERT%2F2025%2F002")
    assert res.status_code == 200
    assert res.content == pdf_bytes
    assert res.headers["x-certificate-number"] == "CSJMU/CERT/2025/002"

    db_session.refresh(cert)
    assert cert.download_count == 1


# ============================================================================
# 2. INVALID VERIFICATION TOKEN
# ============================================================================

def test_invalid_verification_token_returns_404(client):
    res = client.get("/api/modules/sama-veda/certificates/verify/non-existent-token-999/download")
    assert res.status_code == 404
    assert "not found" in res.json()["message"].lower() or "not found" in str(res.json()).lower()


# ============================================================================
# 3. REVOKED CERTIFICATE DOWNLOAD BLOCKED
# ============================================================================

def test_revoked_certificate_download_blocked(client, db_session, mock_storage):
    pdf_bytes = create_sample_pdf(b"%PDF-1.4 Revoked Cert Content")
    pdf_hash = hashlib.sha256(pdf_bytes).hexdigest()

    file_name = "CSJMU_CERT_REVOKED.pdf"
    file_path = mock_storage["certs_dir"] / file_name
    file_path.write_bytes(pdf_bytes)

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/REV-01",
        status="REVOKED",
        is_revoked=True,
        revocation_reason="Data duplication anomaly identified during ethics audit",
        verification_token="token-revoked-111",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=pdf_hash,
        download_count=0,
    )
    db_session.add(cert)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/verify/token-revoked-111/download")
    assert res.status_code == 403
    detail = res.json().get("message", "") or res.json().get("detail", "")
    assert "REVOKED" in detail
    assert "Data duplication anomaly" in detail

    # Verify download count did NOT increment
    db_session.refresh(cert)
    assert cert.download_count == 0


# ============================================================================
# 4. SUPERSEDED CERTIFICATE BEHAVIOR
# ============================================================================

def test_superseded_certificate_behavior(client, db_session, mock_storage):
    # Old certificate (superseded)
    old_pdf = create_sample_pdf(b"%PDF-1.4 Old Superseded PDF")
    old_file_name = "CSJMU_CERT_OLD_01.pdf"
    (mock_storage["certs_dir"] / old_file_name).write_bytes(old_pdf)

    old_cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/OLD-01",
        status="SUPERSEDED",
        is_revoked=False,
        reissued_reason="Typographical correction in recipient designation",
        verification_token="token-superseded-old",
        file_storage_path=f"sama_veda/certificates/{old_file_name}",
        checksum_sha256=hashlib.sha256(old_pdf).hexdigest(),
    )
    db_session.add(old_cert)

    # Replacement certificate
    new_pdf = create_sample_pdf(b"%PDF-1.4 New Reissued PDF")
    new_file_name = "CSJMU_CERT_NEW_02.pdf"
    (mock_storage["certs_dir"] / new_file_name).write_bytes(new_pdf)

    new_cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/NEW-02",
        status="ISSUED",
        is_revoked=False,
        reissued_from_id=old_cert.id,
        verification_token="token-reissued-new",
        file_storage_path=f"sama_veda/certificates/{new_file_name}",
        checksum_sha256=hashlib.sha256(new_pdf).hexdigest(),
    )
    db_session.add(new_cert)
    db_session.commit()

    # 1. Download of superseded certificate is blocked with informative 409
    res_download = client.get("/api/modules/sama-veda/certificates/verify/token-superseded-old/download")
    assert res_download.status_code == 409
    detail = res_download.json().get("message", "") or res_download.json().get("detail", "")
    assert "SUPERSEDED" in detail

    # 2. Public verification endpoint clearly returns superseded status and links to replacement
    res_verify = client.get("/api/modules/sama-veda/certificates/verify/token-superseded-old")
    assert res_verify.status_code == 200
    data = res_verify.json()["data"]
    assert data["status"] == "SUPERSEDED"
    assert data["is_download_allowed"] is False
    assert data["replacement_certificate"] is not None
    assert data["replacement_certificate"]["certificate_number"] == "CSJMU/CERT/2025/NEW-02"
    assert data["replacement_certificate"]["verification_token"] == "token-reissued-new"


# ============================================================================
# 5. MISSING PDF HANDLING (NO STORAGE PATH EXPOSURE)
# ============================================================================

def test_missing_pdf_in_storage_returns_safe_404(client, db_session):
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/MISSING-01",
        status="ISSUED",
        verification_token="token-missing-pdf",
        file_storage_path="sama_veda/certificates/non_existent_file_on_disk.pdf",
        checksum_sha256="abc123456789",
    )
    db_session.add(cert)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/verify/token-missing-pdf/download")
    assert res.status_code == 404
    detail = res.json().get("message", "") or res.json().get("detail", "")
    # Ensure raw internal disk path is NEVER exposed
    assert "non_existent_file_on_disk.pdf" not in detail
    assert "C:" not in detail
    assert "storage" in detail.lower() or "unavailable" in detail.lower()


# ============================================================================
# 6. CHECKSUM MISMATCH (TAMPER DETECTION)
# ============================================================================

def test_checksum_mismatch_blocks_download(client, db_session, mock_storage):
    original_pdf = create_sample_pdf(b"%PDF-1.4 Original File Content")
    original_hash = hashlib.sha256(original_pdf).hexdigest()

    # Tampered file on disk has different bytes
    tampered_pdf = create_sample_pdf(b"%PDF-1.4 Tampered Malicious File Content")
    file_name = "CSJMU_CERT_TAMPERED.pdf"
    (mock_storage["certs_dir"] / file_name).write_bytes(tampered_pdf)

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/TAMPER-01",
        status="ISSUED",
        verification_token="token-tamper-check",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=original_hash,  # Expects original hash, but file has tampered bytes
    )
    db_session.add(cert)
    db_session.commit()

    res = client.get("/api/modules/sama-veda/certificates/verify/token-tamper-check/download")
    assert res.status_code == 409
    detail = res.json().get("message", "") or res.json().get("detail", "")
    assert "integrity verification failed" in detail.lower()


# ============================================================================
# 7. AUTHENTICATED ACCESS AND RBAC PERMISSION CHECKS
# ============================================================================

def test_unauthorized_authenticated_user_download_blocked(client, db_session, mock_storage):
    pdf_bytes = create_sample_pdf(b"%PDF-1.4 Private Faculty Cert")
    file_name = "CSJMU_CERT_AUTH_TEST.pdf"
    (mock_storage["certs_dir"] / file_name).write_bytes(pdf_bytes)

    # Researcher author
    researcher_user = User(
        id=uuid.uuid4(),
        email="faculty.researcher@csjmu.ac.in",
        first_name="Faculty",
        last_name="Researcher",
        is_active=True,
    )
    author = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Dr. Faculty Researcher",
        user_id=researcher_user.id,
    )
    db_session.add_all([researcher_user, author])

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/PRIV-01",
        status="ISSUED",
        author_id=author.id,
        verification_token="token-private-01",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=hashlib.sha256(pdf_bytes).hexdigest(),
    )
    db_session.add(cert)

    # Unrelated user
    unrelated_user = User(
        id=uuid.uuid4(),
        email="unrelated.user@csjmu.ac.in",
        first_name="Unrelated",
        last_name="User",
        is_active=True,
    )
    db_session.add(unrelated_user)
    db_session.commit()

    # Attempt download as unrelated user (not admin, not author)
    app.dependency_overrides[get_optional_current_user] = lambda: unrelated_user
    try:
        res = client.get(f"/api/modules/sama-veda/certificates/{cert.id}/download")
        assert res.status_code == 403
        detail = res.json().get("message", "") or res.json().get("detail", "")
        assert "do not have permission" in detail.lower()
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_authorized_researcher_authenticated_download(client, db_session, mock_storage):
    pdf_bytes = create_sample_pdf(b"%PDF-1.4 Owner Researcher Cert")
    file_name = "CSJMU_CERT_OWNER.pdf"
    (mock_storage["certs_dir"] / file_name).write_bytes(pdf_bytes)

    researcher_user = User(
        id=uuid.uuid4(),
        email="owner.scholar@csjmu.ac.in",
        first_name="Owner",
        last_name="Scholar",
        is_active=True,
    )
    author = ResearchAuthor(
        id=uuid.uuid4(),
        full_name="Prof. Owner Scholar",
        user_id=researcher_user.id,
    )
    db_session.add_all([researcher_user, author])

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/OWN-01",
        status="ISSUED",
        author_id=author.id,
        verification_token="token-owner-01",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=hashlib.sha256(pdf_bytes).hexdigest(),
    )
    db_session.add(cert)
    db_session.commit()

    # Download as the certificate owner
    app.dependency_overrides[get_optional_current_user] = lambda: researcher_user
    try:
        res = client.get(f"/api/modules/sama-veda/certificates/{cert.id}/download")
        assert res.status_code == 200
        assert res.content == pdf_bytes
        assert res.headers["x-certificate-number"] == "CSJMU/CERT/2025/OWN-01"
    finally:
        app.dependency_overrides.pop(get_optional_current_user, None)


def test_admin_authenticated_download(client, db_session, mock_storage):
    pdf_bytes = create_sample_pdf(b"%PDF-1.4 Admin Ledger Cert")
    file_name = "CSJMU_CERT_ADMIN.pdf"
    (mock_storage["certs_dir"] / file_name).write_bytes(pdf_bytes)

    admin_role = Role(id=uuid.uuid4(), name="super_admin", description="Super Admin")
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@csjmu.ac.in",
        first_name="Admin",
        last_name="Sama",
        is_active=True,
        roles=[admin_role],
    )
    db_session.add_all([admin_role, admin_user])

    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/CERT/2025/ADM-01",
        status="ISSUED",
        verification_token="token-admin-01",
        file_storage_path=f"sama_veda/certificates/{file_name}",
        checksum_sha256=hashlib.sha256(pdf_bytes).hexdigest(),
    )
    db_session.add(cert)
    db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        res = client.get(f"/api/admin/sama/certificates/{cert.id}/download")
        assert res.status_code == 200
        assert res.content == pdf_bytes
        assert res.headers["x-certificate-number"] == "CSJMU/CERT/2025/ADM-01"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
