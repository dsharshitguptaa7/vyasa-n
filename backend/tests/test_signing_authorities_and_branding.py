"""
Tests for SAMIKSHA Certificate Official Branding, Signing Authority Lifecycle,
and Historical Signature Preservation (Phases 2, 3, and 4).

Covers:
1. Institutional Branding & Official Asset Resolution (CSJMU emblem & NAAC A++ logo)
2. Accurate NAAC Accreditation wording in PDF header
3. Digital signature storage key path resolution via storage_service abstraction
4. Removal of artificial/cursive simulated signatures
5. Authority CRUD lifecycle, upload validation, magic bytes & size ceiling
6. Immutable historical snapshotting during approval
7. Safe deletion dependency check (soft-delete on referenced, hard-delete on unreferenced)
"""
from datetime import datetime, timezone
import io
import os
from pathlib import Path
from unittest.mock import MagicMock, patch
import uuid
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.api.dependencies import get_db, get_current_user
from app.models.base import Base
from app.models.user import User
from app.models.role import Role
from app.modules.sama_veda.models.certificate import (
    CertificateSignatory,
    CertificateApproval,
    FelicitationCertificate,
    CertificateTemplate,
)
from app.modules.sama_veda.schemas.cms import (
    CertificateSignatoryCreate,
    CertificateSignatoryUpdate,
)
from app.modules.sama_veda.services.certificate_pdf_service import (
    CertificatePDFEngine,
    certificate_pdf_engine,
)
from app.modules.sama_veda.services.cms_service import SamaCmsService
from app.core.storage import storage_service, StorageFileNotFoundError


# ============================================================================
# FIXTURES
# ============================================================================

@pytest.fixture(scope="module")
def sqlite_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(sqlite_engine):
    connection = sqlite_engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, expire_on_commit=False)
    session = SessionLocal()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def super_admin_user():
    user = User(
        id=uuid.uuid4(),
        email="superadmin@csjmu.ac.in",
        first_name="CSJMU Super",
        last_name="Administrator",
        is_active=True,
    )
    user.roles = [Role(id=uuid.uuid4(), name="super_admin", description="Super Admin")]
    return user


# ============================================================================
# PHASE 2 TESTS – BRANDING & LOGO INTEGRATION
# ============================================================================

def test_branding_assets_resolved_to_root():
    """Verify that CertificatePDFEngine correctly resolves CSJMU emblem and NAAC A++ logo."""
    engine = CertificatePDFEngine()
    assert engine.csjmu_logo_path.is_file(), f"CSJMU emblem not found at {engine.csjmu_logo_path}"
    assert engine.naac_logo_path.is_file(), f"NAAC logo not found at {engine.naac_logo_path}"
    assert engine.csjmu_logo_path.name == "csjmu-logo.png"
    assert engine.naac_logo_path.name == "naac-A-Plus-Plus.png"


def test_pdf_header_renders_official_branding_and_naac_accreditation():
    """Verify PDF rendering incorporates official university header with NAAC A++ text."""
    pdf_bytes, sha = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/TEST01",
        verification_token="token_test_001",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_test_001",
        authors=[{"author_name_snapshot": "Dr. Test Scholar"}],
        research_title="Quantum Transport in Graphene Nanoribbons",
    )
    assert len(pdf_bytes) > 2000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()

    # Verify official accreditation wording
    assert "CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY, KANPUR" in page_text
    assert "Accredited A++ by NAAC" in page_text
    assert "RESEARCH & DEVELOPMENT CELL" in page_text


def test_template_config_branding_overrides():
    """Verify template config allows toggling logos and custom accreditation text."""
    custom_accreditation = "Kanpur, UP • Established 1966 • NAAC A++ Accredited University"
    pdf_bytes, _ = certificate_pdf_engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/TEST02",
        verification_token="token_test_002",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_test_002",
        authors=[{"author_name_snapshot": "Dr. Test Scholar"}],
        template_config={
            "show_university_emblem": True,
            "show_naac_badge": True,
            "accreditation_text": custom_accreditation,
        },
    )
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_text = reader.pages[0].extract_text()
    assert "Kanpur, UP" in page_text
    assert "NAAC A++ Accredited University" in page_text


# ============================================================================
# PHASE 3 TESTS – SIGNATURE MANAGEMENT & MISSING SIGNATURE HANDLING
# ============================================================================

def test_signature_path_resolution_via_storage_service(tmp_path):
    """Verify _resolve_signature_path resolves relative storage keys via storage_service."""
    engine = CertificatePDFEngine()

    # 1. Non-existent / empty key returns None
    assert engine._resolve_signature_path(None) is None
    assert engine._resolve_signature_path("") is None

    # 2. Storage key resolution
    dummy_file = tmp_path / "sig_test.png"
    dummy_file.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...")

    with patch.object(storage_service, "get_file_path", return_value=dummy_file):
        resolved = engine._resolve_signature_path("sama_veda/signatures/sig_test.png")
        assert resolved == dummy_file

    # 3. Direct absolute Path resolution
    assert engine._resolve_signature_path(str(dummy_file)) == dummy_file


def test_no_simulated_cursive_signature_when_asset_missing():
    """
    Verify simulated cursive script signature fallback has been completely removed.
    When signature asset is missing, the signature area stays clear.
    """
    engine = CertificatePDFEngine()
    # Confirm the method was removed entirely from class
    assert not hasattr(engine, "_draw_stylized_signature")

    # Render without any signatures
    pdf_bytes, _ = engine.render_certificate_pdf(
        certificate_number="CSJMU/SAMIKSHA/2026/TEST03",
        verification_token="token_test_003",
        verification_url="https://vyasa.csjmu.ac.in/verify/token_test_003",
        authors=[{"author_name_snapshot": "Dr. Candidate"}],
        dean_name="Prof. (Dr.) Rajesh Kumar",
        dean_designation="Dean – Research & Development",
        dean_signature_path=None,
        vc_name="Prof. Vinay Kumar Pathak",
        vc_designation="Vice Chancellor",
        vc_signature_path=None,
    )
    assert len(pdf_bytes) > 2000
    reader = PdfReader(io.BytesIO(pdf_bytes))
    text = reader.pages[0].extract_text()
    # Dignitary names and titles exist below line
    assert "Prof. (Dr.) Rajesh Kumar" in text
    assert "Prof. Vinay Kumar Pathak" in text


# ============================================================================
# PHASE 3/4 TESTS – AUTHORITY LIFECYCLE & HISTORICAL SNAPSHOTTING
# ============================================================================

def test_signatory_crud_and_toggle_active(db_session):
    """Verify add, edit, and active/inactive toggling for signing authorities."""
    # 1. Add Authority
    create_data = CertificateSignatoryCreate(
        authority_type="DEAN_RD",
        signatory_name="Prof. A. K. Sharma",
        designation="Dean – Research & Development",
        department="R&D Cell, CSJMU",
        is_active=True,
    )
    sig = SamaCmsService.create_signatory(db_session, create_data)
    assert sig.id is not None
    assert sig.signatory_name == "Prof. A. K. Sharma"
    assert sig.signature_asset_version == 1
    assert sig.deleted_at is None

    # 2. Edit Authority
    update_data = CertificateSignatoryUpdate(
        signatory_name="Prof. Arun Kumar Sharma",
        department="Central Research Cell, CSJMU Kanpur",
    )
    updated = SamaCmsService.update_signatory(db_session, sig, update_data)
    assert updated.signatory_name == "Prof. Arun Kumar Sharma"
    assert updated.signature_asset_version == 2

    # 3. Toggle Active
    toggled = SamaCmsService.toggle_signatory_active(db_session, sig.id)
    assert toggled.is_active is False

    toggled_again = SamaCmsService.toggle_signatory_active(db_session, sig.id)
    assert toggled_again.is_active is True
    assert toggled_again.deleted_at is None


def test_safe_delete_unreferenced_authority(db_session):
    """Unreferenced authority can be permanently deleted."""
    sig = SamaCmsService.create_signatory(
        db_session,
        CertificateSignatoryCreate(
            authority_type="VICE_CHANCELLOR",
            signatory_name="Prof. Guest VC",
            designation="Officiating Vice Chancellor",
            is_active=True,
        ),
    )
    sig_id = sig.id
    res = SamaCmsService.delete_signatory(db_session, sig_id)
    assert res["action"] == "deleted"
    assert res["referenced_approvals"] == 0
    assert db_session.get(CertificateSignatory, sig_id) is None


def test_historical_preservation_and_soft_delete_when_referenced(db_session):
    """
    CRITICAL REQUIREMENT:
    When an authority has approved a certificate:
    1. Signature snapshot and version snapshot are preserved in CertificateApproval.
    2. Modifying authority name, designation, or signature afterwards does NOT alter approval record.
    3. Deleting the authority performs soft-deletion, preserving certificate approval audit trail.
    """
    # 1. Create Authority with initial signature key
    sig = SamaCmsService.create_signatory(
        db_session,
        CertificateSignatoryCreate(
            authority_type="DEAN_RD",
            signatory_name="Prof. Initial Dean",
            designation="Dean – R&D",
            signature_image_path="sama_veda/signatures/dean_v1.png",
            is_active=True,
        ),
    )

    # 2. Create Certificate and process approval
    cert = FelicitationCertificate(
        certificate_number="CSJMU/SAMIKSHA/2026/HIST01",
        title="Certificate of Excellence",
        verification_token="token_hist_01",
        status="PENDING_DEAN_APPROVAL",
    )
    db_session.add(cert)
    db_session.commit()

    # Process Dean approval
    SamaCmsService.process_authority_approval(
        db_session,
        certificate=cert,
        authority_type="DEAN_RD",
        action="APPROVE",
        remarks="Excellent contribution",
    )

    # Verify snapshot captured on approval record
    appr = db_session.query(CertificateApproval).filter_by(certificate_id=cert.id, authority_type="DEAN_RD").first()
    assert appr is not None
    assert appr.signatory_id == sig.id
    assert appr.signatory_name_snapshot == "Prof. Initial Dean"
    assert appr.designation_snapshot == "Dean – R&D"
    assert appr.signature_image_path_snapshot == "sama_veda/signatures/dean_v1.png"
    assert appr.signature_asset_version_snapshot == 1

    # 3. Update the signatory's current details and signature
    SamaCmsService.update_signatory(
        db_session,
        sig,
        CertificateSignatoryUpdate(
            signatory_name="Prof. Successor Dean",
            designation="Senior Dean – Research",
            signature_image_path="sama_veda/signatures/dean_v2.png",
        ),
    )
    assert sig.signatory_name == "Prof. Successor Dean"
    assert sig.signature_asset_version == 2

    # 4. CRITICAL CHECK: Previous approval record MUST REMAIN UNCHANGED
    db_session.refresh(appr)
    assert appr.signatory_name_snapshot == "Prof. Initial Dean"
    assert appr.designation_snapshot == "Dean – R&D"
    assert appr.signature_image_path_snapshot == "sama_veda/signatures/dean_v1.png"
    assert appr.signature_asset_version_snapshot == 1

    # 5. Attempt safe deletion -> Must SOFT DELETE because of reference in CertificateApproval
    del_res = SamaCmsService.delete_signatory(db_session, sig.id)
    assert del_res["action"] == "soft_deleted"
    assert del_res["referenced_approvals"] == 1

    # Verify soft deleted state in DB
    db_session.refresh(sig)
    assert sig.is_active is False
    assert sig.deleted_at is not None
    # Certificate approval record is NOT deleted
    assert db_session.get(CertificateApproval, appr.id) is not None


# ============================================================================
# API ROUTER TESTS (Upload validation, magic bytes, streaming)
# ============================================================================

def test_api_upload_signature_magic_bytes_and_size_validation(db_session, super_admin_user):
    """Verify signature upload enforces PNG/JPEG magic bytes and rejects invalid files."""
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    client = TestClient(app)

    try:
        # Create authority
        sig = SamaCmsService.create_signatory(
            db_session,
            CertificateSignatoryCreate(
                authority_type="VICE_CHANCELLOR",
                signatory_name="Prof. Validated VC",
                designation="Vice Chancellor",
                is_active=True,
            ),
        )

        # 1. Reject invalid file type (e.g. plain text / script)
        bad_response = client.post(
            f"/api/admin/sama/signatories/{sig.id}/upload-signature",
            files={"file": ("fake_sig.png", b"Hello world! Not a PNG file.", "image/png")},
        )
        assert bad_response.status_code == 400
        bad_json = bad_response.json()
        error_msg = bad_json.get("detail") or bad_json.get("message", "")
        assert "Invalid image format" in error_msg

        # 2. Reject oversized file (> 2MB)
        oversized = b"\x89PNG\r\n\x1a\n" + b"\x00" * (2 * 1024 * 1024 + 10)
        over_response = client.post(
            f"/api/admin/sama/signatories/{sig.id}/upload-signature",
            files={"file": ("huge_sig.png", oversized, "image/png")},
        )
        assert over_response.status_code == 400
        over_json = over_response.json()
        over_msg = over_json.get("detail") or over_json.get("message", "")
        assert "exceeds 2MB limit" in over_msg

        # 3. Accept valid PNG file
        valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"\x00" * 32
        with patch.object(storage_service, "save_file") as mock_save:
            mock_res = MagicMock()
            mock_res.storage_key = "sama_veda/signatures/test_valid.png"
            mock_save.return_value = mock_res

            ok_response = client.post(
                f"/api/admin/sama/signatories/{sig.id}/upload-signature",
                files={"file": ("real_signature.png", valid_png, "image/png")},
            )
            assert ok_response.status_code == 200
            data = ok_response.json()["data"]
            assert data["signature_image_path"] == "sama_veda/signatures/test_valid.png"
            assert data["signature_asset_version"] == 2
    finally:
        app.dependency_overrides.clear()


def test_api_stream_signature_preview(db_session, super_admin_user, tmp_path):
    """Verify GET /signatories/{id}/signature streams file securely without revealing host paths."""
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_current_user] = lambda: super_admin_user
    client = TestClient(app)

    try:
        dummy_png = tmp_path / "actual_sig.png"
        dummy_png.write_bytes(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDRfake_png_content")

        sig = SamaCmsService.create_signatory(
            db_session,
            CertificateSignatoryCreate(
                authority_type="DEAN_RD",
                signatory_name="Prof. Preview Dean",
                designation="Dean – R&D",
                signature_image_path="sama_veda/signatures/actual_sig.png",
                is_active=True,
            ),
        )

        with patch.object(storage_service, "get_file_path", return_value=dummy_png):
            resp = client.get(f"/api/admin/sama/signatories/{sig.id}/signature")
            assert resp.status_code == 200
            assert resp.headers["content-type"] == "image/png"
            assert resp.content == dummy_png.read_bytes()
    finally:
        app.dependency_overrides.clear()
