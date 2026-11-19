import uuid
from datetime import date, datetime, timezone
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.sama_veda.models.certificate import FelicitationCertificate, CertificateAuthor
from app.modules.sama_veda.schemas.cms import (
    CertificateIssueRequest,
    BulkCertificateItemInput,
    BulkCertificateGenerateRequest,
    BulkCertificateUploadBatchMetadata,
)
from app.modules.sama_veda.services.cms_service import SamaCmsService
from app.main import app
from app.api.dependencies import get_db, get_current_user


@pytest.fixture
def super_admin_user():
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "sadmin@csjmu.ac.in"
    role = MagicMock()
    role.name = "super_admin"
    user.roles = [role]
    user.is_active = True
    return user


@pytest.fixture
def client():
    return TestClient(app)


def test_validation_manual_certificate_number_clean():
    # Blank / whitespace -> None
    assert SamaCmsService.validate_manual_certificate_number(None) is None
    assert SamaCmsService.validate_manual_certificate_number("") is None
    assert SamaCmsService.validate_manual_certificate_number("   ") is None

    # Valid values
    assert SamaCmsService.validate_manual_certificate_number("CSJMU/SAMIKSHA/2026/000123") == "CSJMU/SAMIKSHA/2026/000123"
    assert SamaCmsService.validate_manual_certificate_number("CSJMU-RD-2025_99") == "CSJMU-RD-2025_99"

    # Excessive length > 100
    with pytest.raises(ValueError, match="exceeds maximum allowed length"):
        SamaCmsService.validate_manual_certificate_number("A" * 101)

    # Path traversal / control characters
    with pytest.raises(ValueError, match="forbidden control or path traversal"):
        SamaCmsService.validate_manual_certificate_number("../../etc/passwd")

    with pytest.raises(ValueError, match="forbidden control or path traversal"):
        SamaCmsService.validate_manual_certificate_number("CERT\x00NULL")

    # Invalid special characters
    with pytest.raises(ValueError, match="Invalid certificate number format"):
        SamaCmsService.validate_manual_certificate_number("CERT<SCRIPT>")


def test_validation_manual_verification_identifier_clean():
    # Blank / whitespace -> None
    assert SamaCmsService.validate_manual_verification_identifier(None) is None
    assert SamaCmsService.validate_manual_verification_identifier("") is None
    assert SamaCmsService.validate_manual_verification_identifier("   ") is None

    # Valid hex identifier / UUID
    assert SamaCmsService.validate_manual_verification_identifier("ef6f4ff26b0944f5a76477ac7094cbd5") == "ef6f4ff26b0944f5a76477ac7094cbd5"
    assert SamaCmsService.validate_manual_verification_identifier("621f5cff-f389-4e80-af7a-d2e9298a436e") == "621f5cff-f389-4e80-af7a-d2e9298a436e"

    # Full URL extraction
    url = "https://vyasa-n.csjmu.ac.in/verify/ef6f4ff26b0944f5a76477ac7094cbd5"
    assert SamaCmsService.validate_manual_verification_identifier(url) == "ef6f4ff26b0944f5a76477ac7094cbd5"

    url_api = "https://vyasa.csjmu.ac.in/api/modules/sama-veda/certificates/verify/ef6f4ff26b0944f5a76477ac7094cbd5/"
    assert SamaCmsService.validate_manual_verification_identifier(url_api) == "ef6f4ff26b0944f5a76477ac7094cbd5"

    relative_url = "/verify/custom-token-123"
    assert SamaCmsService.validate_manual_verification_identifier(relative_url) == "custom-token-123"

    # External / invalid URL
    with pytest.raises(ValueError, match="Invalid verification URL format"):
        SamaCmsService.validate_manual_verification_identifier("https://malicious.com/not-verify/12345")

    # Length > 64
    with pytest.raises(ValueError, match="exceeds maximum allowed length"):
        SamaCmsService.validate_manual_verification_identifier("A" * 65)

    # Invalid characters
    with pytest.raises(ValueError, match="Invalid verification identifier format"):
        SamaCmsService.validate_manual_verification_identifier("token with spaces")

    with pytest.raises(ValueError, match="Invalid verification identifier format"):
        SamaCmsService.validate_manual_verification_identifier("token$!@#")


def test_schema_model_validator_url_extraction():
    # Verify CertificateIssueRequest model validator extracts URL
    req = CertificateIssueRequest(
        title="Appreciation Certificate",
        verification_identifier="https://vyasa-n.csjmu.ac.in/verify/ef6f4ff26b0944f5a76477ac7094cbd5",
        certificate_number="CSJMU/MANUAL/001",
    )
    assert req.verification_token == "ef6f4ff26b0944f5a76477ac7094cbd5"
    assert req.verification_identifier == "ef6f4ff26b0944f5a76477ac7094cbd5"

    # Blank values become None
    req2 = CertificateIssueRequest(
        title="Appreciation Certificate",
        verification_identifier="   ",
    )
    assert req2.verification_token is None


def test_issue_certificate_all_four_combinations():
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = None  # No duplicates

    # Combination 1: Auto | Auto
    with patch("app.modules.sama_veda.services.certificate_pdf_service.certificate_pdf_engine.render_certificate_pdf", return_value=(b"pdf", "sha256")):
        with patch("app.core.storage.storage_service.save_file", return_value=MagicMock(storage_key="cert.pdf")):
            data1 = CertificateIssueRequest(
                title="Test Cert 1",
                certificate_number=None,
                verification_identifier=None,
            )
            cert1 = SamaCmsService.issue_certificate(mock_db, data1)
            assert cert1.certificate_number.startswith("CSJMU/SAMIKSHA/")
            assert len(cert1.verification_token) == 32  # uuid hex

    # Combination 2: Manual Number | Auto Identifier
    with patch("app.modules.sama_veda.services.certificate_pdf_service.certificate_pdf_engine.render_certificate_pdf", return_value=(b"pdf", "sha256")):
        with patch("app.core.storage.storage_service.save_file", return_value=MagicMock(storage_key="cert.pdf")):
            data2 = CertificateIssueRequest(
                title="Test Cert 2",
                certificate_number="CSJMU/SPECIAL/2026/001",
                verification_identifier=None,
            )
            cert2 = SamaCmsService.issue_certificate(mock_db, data2)
            assert cert2.certificate_number == "CSJMU/SPECIAL/2026/001"
            assert len(cert2.verification_token) == 32

    # Combination 3: Auto Number | Manual Identifier
    with patch("app.modules.sama_veda.services.certificate_pdf_service.certificate_pdf_engine.render_certificate_pdf", return_value=(b"pdf", "sha256")):
        with patch("app.core.storage.storage_service.save_file", return_value=MagicMock(storage_key="cert.pdf")):
            data3 = CertificateIssueRequest(
                title="Test Cert 3",
                certificate_number=None,
                verification_identifier="ef6f4ff26b0944f5a76477ac7094cbd5",
            )
            cert3 = SamaCmsService.issue_certificate(mock_db, data3)
            assert cert3.certificate_number.startswith("CSJMU/SAMIKSHA/")
            assert cert3.verification_token == "ef6f4ff26b0944f5a76477ac7094cbd5"

    # Combination 4: Manual Number | Manual Identifier
    with patch("app.modules.sama_veda.services.certificate_pdf_service.certificate_pdf_engine.render_certificate_pdf", return_value=(b"pdf", "sha256")):
        with patch("app.core.storage.storage_service.save_file", return_value=MagicMock(storage_key="cert.pdf")):
            data4 = CertificateIssueRequest(
                title="Test Cert 4",
                certificate_number="CSJMU/RECOVERED/2026/999",
                verification_identifier="https://vyasa-n.csjmu.ac.in/verify/ef6f4ff26b0944f5a76477ac7094cbd5",
            )
            cert4 = SamaCmsService.issue_certificate(mock_db, data4)
            assert cert4.certificate_number == "CSJMU/RECOVERED/2026/999"
            assert cert4.verification_token == "ef6f4ff26b0944f5a76477ac7094cbd5"


def test_issue_certificate_duplicate_rejection():
    mock_db = MagicMock(spec=Session)

    # Existing cert by number
    existing_cert = FelicitationCertificate(
        certificate_number="CSJMU/DUPLICATE/001",
        verification_token="token_dup_12345",
    )
    mock_db.scalar.return_value = existing_cert

    data = CertificateIssueRequest(
        title="Test Cert Duplicate",
        certificate_number="CSJMU/DUPLICATE/001",
    )
    with pytest.raises(ValueError, match="already assigned to another certificate"):
        SamaCmsService.issue_certificate(mock_db, data)


def test_api_issue_certificate_with_overrides_and_audit(client, super_admin_user):
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = None  # No duplicates

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: super_admin_user

    with patch("app.modules.sama_veda.services.certificate_pdf_service.certificate_pdf_engine.render_certificate_pdf", return_value=(b"fake_pdf_bytes", "abc_sha256")):
        with patch("app.core.storage.storage_service.save_file", return_value=MagicMock(storage_key="sama_veda/certificates/cert.pdf")):
            with patch("app.services.audit_service.audit_service.log_from_request") as mock_audit:
                payload = {
                    "certificate_number": "CSJMU/RECONSTRUCTED/2026/0042",
                    "verification_identifier": "https://vyasa-n.csjmu.ac.in/verify/ef6f4ff26b0944f5a76477ac7094cbd5",
                    "title": "Certificate of Appreciation & Research Excellence",
                    "submit_for_approval": False,
                    "direct_issue_justification": "Restoring previously printed legitimate certificate record",
                }
                resp = client.post("/api/admin/sama/certificates", json=payload)
                assert resp.status_code == 201, resp.text
                data = resp.json()["data"]
                assert data["certificate_number"] == "CSJMU/RECONSTRUCTED/2026/0042"
                assert data["verification_token"] == "ef6f4ff26b0944f5a76477ac7094cbd5"

                # Verify audit logging
                assert mock_audit.called
                call_kwargs = mock_audit.call_args[1]
                audit_details = call_kwargs["details"]
                assert audit_details["is_manual_certificate_number"] is True
                assert audit_details["is_manual_verification_identifier"] is True
                assert audit_details["manual_override_type"] == "BOTH"
                assert audit_details["manual_certificate_number"] == "CSJMU/RECONSTRUCTED/2026/0042"
                assert audit_details["manual_verification_identifier"] == "ef6f4ff26b0944f5a76477ac7094cbd5"


def test_public_verification_resolves_restored_identifier(client):
    mock_db = MagicMock(spec=Session)

    manual_token = "ef6f4ff26b0944f5a76477ac7094cbd5"
    cert = FelicitationCertificate(
        id=uuid.uuid4(),
        certificate_number="CSJMU/RECOVERED/2026/000042",
        title="Certificate of Appreciation & Research Excellence",
        status="ISSUED",
        verification_token=manual_token,
        research_title="Quantum Coherence in 2D Superconductors",
        issued_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        is_revoked=False,
    )
    author = CertificateAuthor(
        author_name_snapshot="Dr. Ramanathan Iyer",
        academic_title_snapshot="Dr.",
        scopus_id_snapshot="57211599999",
        department_snapshot="Department of Physics",
        author_order=1,
    )
    cert.authors.append(author)

    mock_scalars = MagicMock()
    mock_scalars.unique.return_value.first.return_value = cert
    mock_db.scalars.return_value = mock_scalars

    app.dependency_overrides[get_db] = lambda: mock_db

    # Query public verification endpoint using the recovered token
    resp = client.get(f"/api/modules/sama-veda/certificates/verify/{manual_token}")
    assert resp.status_code == 200
    res_data = resp.json()["data"]
    assert res_data["certificate_number"] == "CSJMU/RECOVERED/2026/000042"
    assert res_data["verification_token"] == manual_token
    assert res_data["status"] == "ISSUED"
    assert res_data["research_title"] == "Quantum Coherence in 2D Superconductors"


def test_bulk_generation_with_manual_overrides():
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = None

    req = BulkCertificateGenerateRequest(
        batch=BulkCertificateUploadBatchMetadata(
            batch_name="Test Batch Overrides",
            certificate_type="RESEARCH_PUBLICATION",
            issue_date=date.today(),
        ),
        certificates=[
            BulkCertificateItemInput(
                research_title="Paper 1 with auto values",
                authors=[{"researcher": {"full_name": "Author 1"}}],
            ),
            BulkCertificateItemInput(
                research_title="Paper 2 with manual overrides",
                authors=[{"researcher": {"full_name": "Author 2"}}],
                certificate_number="CSJMU/BULK/2026/001",
                verification_identifier="https://vyasa-n.csjmu.ac.in/verify/token_bulk_002",
            ),
        ],
        resolutions=None,
    )

    actor_id = uuid.uuid4()
    resp = SamaCmsService.generate_bulk_certificates(mock_db, req, actor_user_id=actor_id)
    assert resp.created_count == 2
    assert resp.failed_count == 0
    assert resp.created_certificates[1].certificate_number == "CSJMU/BULK/2026/001"


def test_bulk_generation_intra_batch_collision_rejected():
    mock_db = MagicMock(spec=Session)
    mock_db.scalar.return_value = None

    # Two items with identical manual certificate number
    req = BulkCertificateGenerateRequest(
        batch=BulkCertificateUploadBatchMetadata(
            batch_name="Test Batch Duplicate",
            certificate_type="RESEARCH_PUBLICATION",
            issue_date=date.today(),
        ),
        certificates=[
            BulkCertificateItemInput(
                research_title="Paper 1",
                authors=[{"researcher": {"full_name": "Author 1"}}],
                certificate_number="CSJMU/DUPLICATE/001",
            ),
            BulkCertificateItemInput(
                research_title="Paper 2",
                authors=[{"researcher": {"full_name": "Author 2"}}],
                certificate_number="CSJMU/DUPLICATE/001",
            ),
        ],
        resolutions=None,
    )

    actor_id = uuid.uuid4()
    resp = SamaCmsService.generate_bulk_certificates(mock_db, req, actor_user_id=actor_id)
    assert resp.created_count == 1
    assert resp.failed_count == 1
    assert "Duplicate certificate number" in resp.failed_items[0]["reason"]
