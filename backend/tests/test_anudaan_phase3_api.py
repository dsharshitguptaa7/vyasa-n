"""
ANUDAAN (Yajur Veda) Phase 3 & 3.6 Comprehensive Test Suite.
Tests all Phase 3 functionality & Phase 3.6 remediations in strict compliance with ANUDAAN Field Mapping Document V1.1:
1. Pydantic v2 validation schemas:
   - Applicant categories, mobile formatting, IFSC & PAN regex validation.
   - Publication date cutoff (>= 2026-01-01) and PUBLISHED status requirement.
   - Account number confirmation match and bank encryption / masking.
   - Author role rules (Co-authors non-payable, nominated corresponding author must be CORRESPONDING).
2. Service business logic & validation gates:
   - Application draft creation, secure secret generation, PBKDF2 hashing.
   - Draft authentication using X-Anudaan-Draft-Key, locking on status != DRAFT.
   - Dynamic multi-publication intake and duplicate active DOI rejection.
   - Author attribution: First author single-cardinality, nominated corresponding author single-cardinality.
   - Banking details handling: AES Fernet encryption, bank reuse verification gate.
   - Document upload: Magic bytes verification (PDF, PNG, JPEG), 10MB size ceiling, storage proxy integration.
   - Final submission gate: Mandatory 1st author, nominated corresponding author, bank accounts, declarations, email dispatch.
   - Application tracking: Secret verification, safe sanitized response with zero credential leaks.
3. FastAPI Endpoints & Integration:
   - Full lifecycle test across all ANUDAAN endpoints.
4. Phase 3.6 Security & Remediation Dedicated Test Suite:
   - SEC-01: Verified bank account lookup IDOR protection & membership verification.
   - SEC-02: Tracking sliding-window rate limiting & indistinguishable 404 responses.
   - 8 Mandatory Statutory Declarations enforcement.
   - SEC-04 & SEC-05: DOI normalization edge cases & intra-draft duplicate rejection.
   - SEC-06: Compensating storage orphan cleanup on DB failure.
   - SEC-07: Durable email outbox recording in form_metadata and retry helper.
"""
from datetime import date, datetime, timezone
from decimal import Decimal
import io
from unittest.mock import MagicMock, patch
import uuid
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import app
from app.core.database import get_db
from app.core.security import hash_password, verify_password
from app.modules.yajur_veda.models.anudaan import (
    AnudaanApplication,
    AnudaanPerson,
    AnudaanPublication,
    AnudaanBankAccount,
    AnudaanBankAccountHolder,
    AnudaanPublicationAuthor,
    AnudaanDocument,
    AnudaanDeclaration,
    normalize_doi,
)
from app.modules.yajur_veda.models.enums import (
    AnudaanApplicantCategory,
    AnudaanApplicationStatus,
    AnudaanDocumentType,
    AnudaanPublicationStatus,
    AnudaanIndexingType,
    AnudaanQuartile,
    AnudaanAuthorRole,
    AnudaanBankAccountType,
    AnudaanBankOwnershipStatus,
    AnudaanDocumentCategory,
)
from app.modules.yajur_veda.schemas.anudaan import (
    AnudaanBankAccountInput,
    AnudaanSafeBankAccountOut,
    AnudaanAuthorCreate,
    AnudaanPublicationCreate,
    AnudaanPublicationUpdate,
    AnudaanApplicationCreateDraft,
    AnudaanApplicationUpdateDraft,
    AnudaanDeclarationAcceptance,
    AnudaanTrackingRequest,
    AnudaanTrackingStatusResponse,
    MANDATORY_DECLARATION_TYPES,
    DRAFT_DECLARATION_TEXTS,
)
from app.modules.yajur_veda.services.anudaan_service import AnudaanService, MAX_FILE_SIZE_BYTES
from app.modules.yajur_veda.router import anudaan_tracking_rate_limiter


SAMPLE_PDF_BYTES = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"
SAMPLE_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
SAMPLE_JPG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF"
INVALID_BYTES = b"EXEC_BAD_FILE_CONTENT_NOT_PDF"


# =============================================================================
# 1. Pydantic v2 Schema Tests
# =============================================================================

class TestAnudaanSchemas:
    """Tests Pydantic v2 request and response schemas."""

    def test_bank_account_input_valid(self):
        bank_in = AnudaanBankAccountInput(
            account_holder_name="Dr. Harish Kumar",
            bank_name="State Bank of India",
            account_number="123456789012",
            confirm_account_number="123456789012",
            ifsc_code="SBIN0001234",
            branch_name="CSJMU Campus Branch",
            account_type=AnudaanBankAccountType.SAVINGS,
            pan_number="ABCDE1234F",
            bank_mobile_number="9876543210",
        )
        assert bank_in.account_number == "123456789012"
        assert bank_in.ifsc_code == "SBIN0001234"
        assert bank_in.pan_number == "ABCDE1234F"

    def test_bank_account_mismatched_numbers_rejected(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanBankAccountInput(
                account_holder_name="Dr. Harish Kumar",
                bank_name="State Bank of India",
                account_number="123456789012",
                confirm_account_number="999999999999",
                ifsc_code="SBIN0001234",
                branch_name="CSJMU Campus Branch",
            )
        assert "Account numbers do not match" in str(exc.value)

    def test_bank_account_invalid_ifsc_rejected(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanBankAccountInput(
                account_holder_name="Dr. Harish Kumar",
                bank_name="State Bank of India",
                account_number="123456789012",
                confirm_account_number="123456789012",
                ifsc_code="INVALIDIFSC",
                branch_name="CSJMU Branch",
            )
        assert "Invalid IFSC code" in str(exc.value)

    def test_bank_account_invalid_pan_rejected(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanBankAccountInput(
                account_holder_name="Dr. Harish Kumar",
                bank_name="State Bank of India",
                account_number="123456789012",
                confirm_account_number="123456789012",
                ifsc_code="SBIN0001234",
                branch_name="CSJMU Branch",
                pan_number="BADPAN",
            )
        assert "Invalid PAN format" in str(exc.value)

    def test_safe_bank_output_masks_account_number(self):
        safe_out = AnudaanSafeBankAccountOut(
            id=uuid.uuid4(),
            account_holder_name="Dr. Harish Kumar",
            bank_name="State Bank of India",
            account_number_last4="9012",
            ifsc_code="SBIN0001234",
            branch_name="CSJMU Branch",
            account_type=AnudaanBankAccountType.SAVINGS,
            created_at=datetime.now(timezone.utc),
        )
        assert safe_out.account_number_last4 == "9012"
        assert safe_out.masked_account_number == "••••••••9012"
        assert not hasattr(safe_out, "account_number")

    def test_publication_date_eligibility_rule(self):
        pub_valid = AnudaanPublicationCreate(
            publication_date=date(2026, 1, 15),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            paper_title="Advanced Nanomaterials for Renewable Energy",
            journal_name="ACS Applied Nano Materials",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
        )
        assert pub_valid.publication_year == 2026

        with pytest.raises(ValidationError) as exc:
            AnudaanPublicationCreate(
                publication_date=date(2025, 12, 31),
                document_type=AnudaanDocumentType.ARTICLE,
                publication_status=AnudaanPublicationStatus.PUBLISHED,
                indexing_type=AnudaanIndexingType.SCOPUS,
                has_csjmu_affiliation=True,
                paper_title="Advanced Nanomaterials for Renewable Energy",
                journal_name="ACS Applied Nano Materials",
                publication_year=2025,
                applicant_declared_quartile=AnudaanQuartile.Q1,
            )
        assert "Ineligible publication date" in str(exc.value)

    def test_publication_status_must_be_published(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanPublicationCreate(
                publication_date=date(2026, 2, 1),
                document_type=AnudaanDocumentType.ARTICLE,
                publication_status=AnudaanPublicationStatus.ACCEPTED,
                indexing_type=AnudaanIndexingType.SCOPUS,
                has_csjmu_affiliation=True,
                paper_title="Advanced Nanomaterials for Renewable Energy",
                journal_name="ACS Applied Nano Materials",
                publication_year=2026,
                applicant_declared_quartile=AnudaanQuartile.Q1,
            )
        assert "Only fully PUBLISHED works are eligible" in str(exc.value)

    def test_coauthor_cannot_have_bank_details(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanAuthorCreate(
                full_name="Dr. External Co-Author",
                author_role=AnudaanAuthorRole.CO_AUTHOR,
                bank_account_id=uuid.uuid4(),
            )
        assert "Co-authors are non-payable" in str(exc.value)

    def test_nominated_corresponding_author_must_have_corresponding_role(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanAuthorCreate(
                full_name="Dr. First Author",
                author_role=AnudaanAuthorRole.FIRST,
                is_nominated_corresponding_author=True,
            )
        assert "Only an author with CORRESPONDING role" in str(exc.value)

    def test_bank_reuse_requires_bank_account_id(self):
        with pytest.raises(ValidationError) as exc:
            AnudaanAuthorCreate(
                full_name="Dr. Corresponding Author",
                author_role=AnudaanAuthorRole.CORRESPONDING,
                is_nominated_corresponding_author=True,
                bank_reuse_selected=True,
                bank_account_id=None,
            )
        assert "bank_account_id is required when bank_reuse_selected is True" in str(exc.value)


# =============================================================================
# 2. Service Layer Tests
# =============================================================================

class TestAnudaanService:
    """Tests business logic and verification gates in AnudaanService."""

    def test_create_draft_application(self):
        mock_db = MagicMock()
        mock_db.execute.return_value.scalar_one_or_none.return_value = None

        data = AnudaanApplicationCreateDraft(
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Rajesh Sharma",
            institutional_id="EMP-2024-001",
            designation="Professor",
            department_name="Department of Physics",
            mobile_number="9876543210",
            form_metadata={"email": "rajesh.sharma@csjmu.ac.in"},
        )

        app, secret = AnudaanService.create_draft_application(mock_db, data)
        assert app.status == AnudaanApplicationStatus.DRAFT
        assert app.full_name == "Prof. Rajesh Sharma"
        assert app.application_number.startswith("ANU-")
        assert len(secret) > 20
        stored_hash = app.form_metadata.get("tracking_secret_hash")
        assert stored_hash is not None
        assert verify_password(secret, stored_hash) is True

    def test_verify_draft_access_success_and_failure(self):
        mock_db = MagicMock()
        secret = "secret_valid_token_12345"
        secret_hash = hash_password(secret)

        fake_app = AnudaanApplication(
            id=uuid.uuid4(),
            application_number="ANU-2026-TEST1",
            status=AnudaanApplicationStatus.DRAFT,
            full_name="Prof. Test",
            institutional_id="EMP-01",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": secret_hash},
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = fake_app

        # 1. Valid access
        verified = AnudaanService.verify_draft_access(mock_db, fake_app.id, secret)
        assert verified.id == fake_app.id

        # 2. Missing key
        with pytest.raises(HTTPException) as exc1:
            AnudaanService.verify_draft_access(mock_db, fake_app.id, None)
        assert exc1.value.status_code == 401

        # 3. Invalid key
        with pytest.raises(HTTPException) as exc2:
            AnudaanService.verify_draft_access(mock_db, fake_app.id, "wrong_secret_token")
        assert exc2.value.status_code == 403

    def test_assert_draft_is_mutable_blocks_submitted(self):
        submitted_app = AnudaanApplication(
            id=uuid.uuid4(),
            application_number="ANU-2026-SUBMITTED",
            status=AnudaanApplicationStatus.SUBMITTED,
            full_name="Prof. Test",
            institutional_id="EMP-01",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
        )
        with pytest.raises(HTTPException) as exc:
            AnudaanService.assert_draft_is_mutable(submitted_app)
        assert exc.value.status_code == 400
        assert "locked for modifications" in exc.value.detail

    def test_add_publication_duplicate_doi_rejected(self):
        mock_db = MagicMock()
        app_id = uuid.uuid4()
        secret = "token_abc"
        fake_app = AnudaanApplication(
            id=app_id,
            status=AnudaanApplicationStatus.DRAFT,
            application_number="ANU-2026-TEST1",
            full_name="Prof. Test",
            institutional_id="EMP-01",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = fake_app

        # Mock that intra-draft has no duplicate (None), but active cross-app check finds a duplicate
        mock_db.execute.return_value.scalar_one_or_none.side_effect = [None, uuid.uuid4()]

        pub_data = AnudaanPublicationCreate(
            publication_date=date(2026, 3, 1),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            doi="10.1016/j.jmat.2026.01.001",
            paper_title="Synthesis and characterization",
            journal_name="Journal of Materials",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
        )

        with pytest.raises(HTTPException) as exc:
            AnudaanService.add_publication(mock_db, app_id, pub_data, secret)
        assert exc.value.status_code == 409
        assert "already submitted" in exc.value.detail

    def test_add_author_first_author_cardinality(self):
        mock_db = MagicMock()
        pub_id = uuid.uuid4()
        app_id = uuid.uuid4()
        secret = "token_123"

        fake_app = AnudaanApplication(
            id=app_id,
            status=AnudaanApplicationStatus.DRAFT,
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            full_name="Prof. Test",
            institutional_id="EMP-01",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
        )
        existing_first_author = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            publication_id=pub_id,
            person_id=uuid.uuid4(),
            author_role=AnudaanAuthorRole.FIRST,
        )
        fake_pub = AnudaanPublication(
            id=pub_id,
            application_id=app_id,
            paper_title="Test Paper",
            journal_name="Test Journal",
            publication_date=date(2026, 1, 15),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
            application=fake_app,
            authors=[existing_first_author],
        )

        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = fake_pub

        new_first_author_data = AnudaanAuthorCreate(
            full_name="Another Author",
            author_role=AnudaanAuthorRole.FIRST,
        )

        with pytest.raises(HTTPException) as exc:
            AnudaanService.add_author_to_publication(mock_db, pub_id, new_first_author_data, secret)
        assert exc.value.status_code == 400
        assert "Only one first author is permitted" in exc.value.detail

    def test_bank_reuse_unverified_account_rejected(self):
        mock_db = MagicMock()
        pub_id = uuid.uuid4()
        app_id = uuid.uuid4()
        person_id = uuid.uuid4()
        bank_id = uuid.uuid4()
        secret = "token_123"

        fake_app = AnudaanApplication(
            id=app_id,
            status=AnudaanApplicationStatus.DRAFT,
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            full_name="Prof. Test",
            institutional_id="EMP-01",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
        )
        fake_pub = AnudaanPublication(
            id=pub_id,
            application_id=app_id,
            paper_title="Test Paper",
            journal_name="Test Journal",
            publication_date=date(2026, 1, 15),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
            application=fake_app,
            authors=[],
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = fake_pub

        fake_person = AnudaanPerson(id=person_id, full_name="Dr. Author", mobile_number="9876543210")
        unverified_holder = AnudaanBankAccountHolder(
            person_id=person_id,
            bank_account_id=bank_id,
            ownership_verification_status=AnudaanBankOwnershipStatus.UNVERIFIED,
        )

        mock_db.execute.return_value.scalar_one_or_none.side_effect = [fake_person, unverified_holder]

        author_data = AnudaanAuthorCreate(
            full_name="Dr. Author",
            mobile_number="9876543210",
            author_role=AnudaanAuthorRole.FIRST,
            bank_reuse_selected=True,
            bank_account_id=bank_id,
        )

        with pytest.raises(HTTPException) as exc:
            AnudaanService.add_author_to_publication(mock_db, pub_id, author_data, secret)
        assert exc.value.status_code == 400
        assert "prior institutional verification" in exc.value.detail

    def test_submit_application_validation_gates(self):
        mock_db = MagicMock()
        app_id = uuid.uuid4()
        secret = "secret_valid_token"

        scholar_app = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-SCHOLAR",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.SCHOLAR_CAMPUS,
            full_name="Scholar Jane Doe",
            institutional_id="PHD-2024-05",
            designation="Research Scholar",
            department_name="Chemistry",
            supervisor_name=None,
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = scholar_app

        declarations = [
            AnudaanDeclarationAcceptance(
                declaration_type=dtype,
                accepted=True,
                declaration_text_snapshot=DRAFT_DECLARATION_TEXTS.get(dtype, "I hereby accept this mandatory institutional statutory declaration."),
            )
            for dtype in sorted(MANDATORY_DECLARATION_TYPES)
        ]

        with pytest.raises(HTTPException) as exc:
            AnudaanService.submit_application(mock_db, app_id, declarations, secret)
        assert exc.value.status_code == 400
        assert "Supervisor name is mandatory" in exc.value.detail

    def test_track_application_success_and_protection(self):
        mock_db = MagicMock()
        secret = "track_secret_xyz"
        app = AnudaanApplication(
            id=uuid.uuid4(),
            application_number="ANU-2026-TRACK1",
            status=AnudaanApplicationStatus.SUBMITTED,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Tracked User",
            institutional_id="EMP-99",
            designation="Professor",
            department_name="Mathematics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
            submitted_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app

        # Valid tracking
        res = AnudaanService.track_application(mock_db, "ANU-2026-TRACK1", secret)
        assert res.application_number == "ANU-2026-TRACK1"
        assert res.status == AnudaanApplicationStatus.SUBMITTED
        assert res.applicant_name == "Prof. Tracked User"
        assert not hasattr(res, "tracking_secret")
        assert not hasattr(res, "tracking_secret_hash")

        # Wrong secret returns uniform 404 (SEC-02)
        with pytest.raises(HTTPException) as exc:
            AnudaanService.track_application(mock_db, "ANU-2026-TRACK1", "wrong_secret")
        assert exc.value.status_code == 404
        assert "Application not found or tracking secret is invalid" in exc.value.detail


# =============================================================================
# 3. FastAPI Endpoints & Integration Tests
# =============================================================================

class TestAnudaanApiEndpoints:
    """End-to-end integration tests using FastAPI TestClient."""

    @pytest.fixture
    def client(self):
        with patch("app.main.check_database_connection", return_value=False), \
             patch("app.main.seed_all", return_value={}):
            with TestClient(app) as test_client:
                yield test_client

    def test_status_endpoint(self, client):
        resp = client.get("/api/modules/yajur-veda/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "anudaan" in data["data"]["submodules"]
        assert data["data"]["submodules"]["anudaan"]["version"] == "1.1"

    def test_create_draft_application_endpoint(self, client):
        mock_db = MagicMock()
        mock_db.execute.return_value.scalar_one_or_none.return_value = None

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            payload = {
                "applicant_category": "FACULTY_CAMPUS",
                "full_name": "Prof. Amit Verma",
                "institutional_id": "EMP-PHYS-042",
                "designation": "Associate Professor",
                "department_name": "Department of Physics",
                "mobile_number": "9876543210",
                "form_metadata": {"email": "amit.verma@csjmu.ac.in"},
            }
            resp = client.post("/api/modules/yajur-veda/anudaan/applications", json=payload)
            assert resp.status_code == 201
            body = resp.json()
            assert body["success"] is True
            assert "application_id" in body["data"]
            assert "tracking_secret" in body["data"]
            assert body["data"]["application_number"].startswith("ANU-")
            assert body["data"]["status"] == "DRAFT"
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_get_and_patch_draft_application_endpoint(self, client):
        mock_db = MagicMock()
        secret = "secret_draft_key_999"
        app_id = uuid.uuid4()
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-PATCH1",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Original Name",
            institutional_id="EMP-202",
            designation="Professor",
            department_name="Life Sciences",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
            documents=[],
            declarations=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            get_resp = client.get(
                f"/api/modules/yajur-veda/anudaan/applications/{app_id}",
                headers={"X-Anudaan-Draft-Key": secret},
            )
            assert get_resp.status_code == 200
            assert get_resp.json()["data"]["full_name"] == "Prof. Original Name"

            no_key_resp = client.get(f"/api/modules/yajur-veda/anudaan/applications/{app_id}")
            assert no_key_resp.status_code == 401

            patch_resp = client.patch(
                f"/api/modules/yajur-veda/anudaan/applications/{app_id}",
                headers={"X-Anudaan-Draft-Key": secret},
                json={"full_name": "Prof. Updated Name", "mobile_number": "9123456789"},
            )
            assert patch_resp.status_code == 200
            assert app_record.full_name == "Prof. Updated Name"
            assert app_record.mobile_number == "9123456789"
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_add_and_delete_publication_endpoint(self, client):
        mock_db = MagicMock()
        secret = "secret_pub_key"
        app_id = uuid.uuid4()
        pub_id = uuid.uuid4()
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-PUB1",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Publisher",
            institutional_id="EMP-303",
            designation="Professor",
            department_name="Chemistry",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
            documents=[],
            declarations=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        fake_pub = AnudaanPublication(
            id=pub_id,
            application_id=app_id,
            publication_date=date(2026, 2, 20),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            paper_title="Synthesis of 2D Materials",
            journal_name="Nano Research",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
            application=app_record,
            authors=[],
            documents=[],
            created_at=datetime.now(timezone.utc),
        )

        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record
        mock_db.execute.return_value.scalar_one_or_none.return_value = fake_pub

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            pub_payload = {
                "publication_date": "2026-02-20",
                "document_type": "ARTICLE",
                "publication_status": "PUBLISHED",
                "indexing_type": "SCOPUS",
                "has_csjmu_affiliation": True,
                "paper_title": "Synthesis of 2D Materials",
                "journal_name": "Nano Research",
                "publication_year": 2026,
                "applicant_declared_quartile": "Q1",
            }
            resp = client.post(
                f"/api/modules/yajur-veda/anudaan/applications/{app_id}/publications",
                headers={"X-Anudaan-Draft-Key": secret},
                json=pub_payload,
            )
            assert resp.status_code == 201
            assert resp.json()["data"]["paper_title"] == "Synthesis of 2D Materials"

            del_resp = client.delete(
                f"/api/modules/yajur-veda/anudaan/publications/{pub_id}",
                headers={"X-Anudaan-Draft-Key": secret},
            )
            assert del_resp.status_code == 200
            assert del_resp.json()["success"] is True
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_document_upload_and_delete_endpoint(self, client):
        mock_db = MagicMock()
        secret = "secret_doc_key"
        app_id = uuid.uuid4()
        doc_id = uuid.uuid4()
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-DOC1",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Documenter",
            institutional_id="EMP-404",
            designation="Professor",
            department_name="Chemistry",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
            documents=[],
            declarations=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        fake_doc = AnudaanDocument(
            id=doc_id,
            application_id=app_id,
            document_type=AnudaanDocumentCategory.PUBLISHED_PAPER,
            original_filename="paper.pdf",
            storage_key=f"anudaan/applications/{app_id}/published_paper_123.pdf",
            mime_type="application/pdf",
            file_size_bytes=len(SAMPLE_PDF_BYTES),
            created_at=datetime.now(timezone.utc),
            application=app_record,
        )

        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record
        mock_db.execute.return_value.scalar_one_or_none.return_value = fake_doc

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            with patch("app.modules.yajur_veda.services.anudaan_service.storage_service.save_file") as mock_save, \
                 patch("app.modules.yajur_veda.services.anudaan_service.storage_service.delete_file") as mock_del:
                mock_save.return_value = MagicMock()
                mock_del.return_value = True

                upload_resp = client.post(
                    f"/api/modules/yajur-veda/anudaan/applications/{app_id}/documents",
                    headers={"X-Anudaan-Draft-Key": secret},
                    data={"document_type": "PUBLISHED_PAPER"},
                    files={"file": ("manuscript.pdf", io.BytesIO(SAMPLE_PDF_BYTES), "application/pdf")},
                )
                assert upload_resp.status_code == 201
                assert upload_resp.json()["data"]["mime_type"] == "application/pdf"
                assert upload_resp.json()["data"]["original_filename"] == "manuscript.pdf"

                bad_resp = client.post(
                    f"/api/modules/yajur-veda/anudaan/applications/{app_id}/documents",
                    headers={"X-Anudaan-Draft-Key": secret},
                    data={"document_type": "PUBLISHED_PAPER"},
                    files={"file": ("bad.exe", io.BytesIO(INVALID_BYTES), "application/octet-stream")},
                )
                assert bad_resp.status_code == 400
                assert "Unsupported file format" in bad_resp.json()["message"]

                del_resp = client.delete(
                    f"/api/modules/yajur-veda/anudaan/documents/{doc_id}",
                    headers={"X-Anudaan-Draft-Key": secret},
                )
                assert del_resp.status_code == 200
                assert del_resp.json()["success"] is True
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_final_submission_endpoint_flow(self, client):
        mock_db = MagicMock()
        secret = "secret_final_key"
        app_id = uuid.uuid4()
        pub_id = uuid.uuid4()
        bank_id = uuid.uuid4()

        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-SUBMIT01",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Submitter",
            institutional_id="EMP-505",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret), "email": "prof.submitter@csjmu.ac.in"},
            publications=[],
            documents=[],
            declarations=[],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        bank = AnudaanBankAccount(
            id=bank_id,
            account_holder_name="Prof. Submitter",
            bank_name="State Bank of India",
            account_number_encrypted="encrypted_str",
            account_number_last4="1234",
            ifsc_code="SBIN0001234",
            branch_name="CSJMU",
            account_type=AnudaanBankAccountType.SAVINGS,
            created_at=datetime.now(timezone.utc),
        )

        person1 = AnudaanPerson(id=uuid.uuid4(), full_name="Prof. Submitter", mobile_number="9876543210")
        person2 = AnudaanPerson(id=uuid.uuid4(), full_name="Dr. Corr Author", mobile_number="9876543211")

        author1 = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            publication_id=pub_id,
            person_id=person1.id,
            author_role=AnudaanAuthorRole.FIRST,
            is_csjmu_affiliated=True,
            has_multiple_corresponding_authors=False,
            is_nominated_corresponding_author=False,
            bank_reuse_selected=False,
            bank_account_id=bank_id,
            bank_account=bank,
            person=person1,
            created_at=datetime.now(timezone.utc),
        )
        author2 = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            publication_id=pub_id,
            person_id=person2.id,
            author_role=AnudaanAuthorRole.CORRESPONDING,
            is_nominated_corresponding_author=True,
            has_multiple_corresponding_authors=False,
            is_csjmu_affiliated=True,
            bank_reuse_selected=False,
            bank_account_id=bank_id,
            bank_account=bank,
            person=person2,
            created_at=datetime.now(timezone.utc),
        )

        doc = AnudaanDocument(
            id=uuid.uuid4(),
            application_id=app_id,
            publication_id=pub_id,
            document_type=AnudaanDocumentCategory.PUBLISHED_PAPER,
            original_filename="manuscript.pdf",
            storage_key=f"anudaan/applications/{app_id}/published_paper.pdf",
            mime_type="application/pdf",
            file_size_bytes=1000,
            created_at=datetime.now(timezone.utc),
        )

        pub = AnudaanPublication(
            id=pub_id,
            application_id=app_id,
            publication_date=date(2026, 3, 1),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            paper_title="Complete Quantum Dots Paper",
            journal_name="Nature Nanotechnology",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
            paper_document_storage_key=doc.storage_key,
            authors=[author1, author2],
            documents=[doc],
            created_at=datetime.now(timezone.utc),
        )
        app_record.publications = [pub]
        app_record.documents = [doc]

        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            with patch("app.services.notifications.email_service.email_sender_service.send_email", return_value=(True, None)) as mock_email:
                payload = {
                    "declarations": [
                        {
                            "declaration_type": dtype,
                            "accepted": True,
                            "declaration_text_snapshot": DRAFT_DECLARATION_TEXTS[dtype],
                        }
                        for dtype in sorted(MANDATORY_DECLARATION_TYPES)
                    ]
                }
                resp = client.post(
                    f"/api/modules/yajur-veda/anudaan/applications/{app_id}/submit",
                    headers={"X-Anudaan-Draft-Key": secret},
                    json=payload,
                )
                assert resp.status_code == 200
                data = resp.json()["data"]
                assert data["status"] == "SUBMITTED"
                assert len(data["publications"]) == 1
                assert data["publications"][0]["paper_title"] == "Complete Quantum Dots Paper"
                mock_email.assert_called_once()
        finally:
            app.dependency_overrides.pop(get_db, None)


# =============================================================================
# 4. Phase 3.6 Security & Remediation Dedicated Test Suite
# =============================================================================

class TestAnudaanPhase36Remediation:
    """Verifies all Phase 3.6 security fixes and data integrity safeguards."""

    @pytest.fixture
    def client(self):
        with patch("app.main.check_database_connection", return_value=False), \
             patch("app.main.seed_all", return_value={}):
            with TestClient(app) as test_client:
                yield test_client

    def test_doi_normalization_edge_cases(self):
        """SEC-04: Robust DOI normalization with query strings, fragments, and trailing slashes."""
        # 1. URL with query params
        assert normalize_doi("https://doi.org/10.1016/j.cell.2025.10.001?ref=share&source=twitter") == "10.1016/j.cell.2025.10.001"
        # 2. URL with fragments
        assert normalize_doi("http://dx.doi.org/10.1103/PhysRevB.100.014401#sec-2") == "10.1103/physrevb.100.014401"
        # 3. Trailing slash trimming
        assert normalize_doi("10.1000/182/") == "10.1000/182"
        # 4. Bare prefix removal
        assert normalize_doi("doi: 10.1021/ja01577a030") == "10.1021/ja01577a030"
        # 5. Complex punctuation preserved
        complex_doi = "10.1002/(sici)1097-4652(199704)171:1<33::aid-jcp5>3.0.co;2-m"
        assert normalize_doi(complex_doi) == complex_doi.lower()

    def test_intra_draft_duplicate_doi_rejected(self):
        """SEC-04: Rejects duplicate DOIs within the same draft application."""
        mock_db = MagicMock()
        app_id = uuid.uuid4()
        secret = "secret_intra_doi"
        existing_pub = AnudaanPublication(
            id=uuid.uuid4(),
            application_id=app_id,
            paper_title="Existing Paper",
            doi="10.1016/j.cell.2026.01.001",
            normalized_doi="10.1016/j.cell.2026.01.001",
            publication_date=date(2026, 2, 1),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            journal_name="Cell",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
        )
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-INTRA1",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Intra",
            institutional_id="EMP-701",
            designation="Professor",
            department_name="Biosciences",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[existing_pub],
            documents=[],
            declarations=[],
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record

        # Duplicate DOI in different URL representation
        new_pub_data = AnudaanPublicationCreate(
            paper_title="Duplicate Paper",
            doi="https://doi.org/10.1016/j.cell.2026.01.001?utm_source=test",
            publication_date=date(2026, 2, 5),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            journal_name="Cell",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
        )

        with pytest.raises(HTTPException) as exc:
            AnudaanService.add_publication(mock_db, app_id, new_pub_data, secret)
        assert exc.value.status_code == 409
        assert "is already attached to this draft application" in exc.value.detail

    def test_eight_mandatory_declarations_enforcement(self):
        """Field Mapping V1.1: Strict validation of all 8 mandatory statutory declarations."""
        mock_db = MagicMock()
        app_id = uuid.uuid4()
        secret = "secret_decl_gates"
        bank_id = uuid.uuid4()
        person1 = AnudaanPerson(id=uuid.uuid4(), full_name="Prof. First")
        person2 = AnudaanPerson(id=uuid.uuid4(), full_name="Dr. Corr")
        author1 = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            author_role=AnudaanAuthorRole.FIRST,
            bank_account_id=bank_id,
            person=person1,
        )
        author2 = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            author_role=AnudaanAuthorRole.CORRESPONDING,
            is_nominated_corresponding_author=True,
            bank_account_id=bank_id,
            person=person2,
        )
        sample_pub = AnudaanPublication(
            id=uuid.uuid4(),
            application_id=app_id,
            paper_title="Test Paper",
            doi=None,
            normalized_doi=None,
            publication_date=date(2026, 2, 1),
            document_type=AnudaanDocumentType.ARTICLE,
            publication_status=AnudaanPublicationStatus.PUBLISHED,
            indexing_type=AnudaanIndexingType.SCOPUS,
            has_csjmu_affiliation=True,
            journal_name="Cell",
            publication_year=2026,
            applicant_declared_quartile=AnudaanQuartile.Q1,
            paper_document_storage_key="anudaan/paper.pdf",
            authors=[author1, author2],
            documents=[],
        )
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-DECL8",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Declarer",
            institutional_id="EMP-702",
            designation="Professor",
            department_name="Biosciences",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[sample_pub],
            documents=[],
            declarations=[],
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record
        mock_db.execute.return_value.first.return_value = None

        # 1. Missing declarations (< 8)
        incomplete_declarations = [
            AnudaanDeclarationAcceptance(
                declaration_type=dtype,
                accepted=True,
                declaration_text_snapshot=DRAFT_DECLARATION_TEXTS[dtype],
            )
            for dtype in list(MANDATORY_DECLARATION_TYPES)[:5]
        ]
        with pytest.raises(HTTPException) as exc:
            AnudaanService.submit_application(mock_db, app_id, incomplete_declarations, secret)
        assert exc.value.status_code == 400
        assert "All 8 statutory declarations are mandatory" in exc.value.detail

        # 2. Declaration with accepted=False rejected at Pydantic schema level
        with pytest.raises(ValidationError) as pyd_exc:
            AnudaanDeclarationAcceptance(
                declaration_type="REFUND_UNDERTAKING",
                accepted=False,
                declaration_text_snapshot=DRAFT_DECLARATION_TEXTS["REFUND_UNDERTAKING"],
            )
        assert "Declaration must be explicitly accepted" in str(pyd_exc.value)

        # 3. Declaration with snapshot text too short (< 10 chars) rejected at Pydantic schema level
        with pytest.raises(ValidationError) as pyd_exc2:
            AnudaanDeclarationAcceptance(
                declaration_type="REFUND_UNDERTAKING",
                accepted=True,
                declaration_text_snapshot="Too short",
            )
        assert "String should have at least 10 characters" in str(pyd_exc2.value)

    def test_bank_account_lookup_idor_protection(self, client):
        """SEC-01: Rejection of IDOR lookups on arbitrary or unrelated person IDs."""
        mock_db = MagicMock()
        secret = "secret_idor_key"
        app_id = uuid.uuid4()
        valid_person_id = uuid.uuid4()
        unrelated_person_id = uuid.uuid4()

        valid_person = AnudaanPerson(id=valid_person_id, full_name="Dr. Valid Author")
        unrelated_person = AnudaanPerson(id=unrelated_person_id, full_name="Dr. Unrelated Stranger")

        author = AnudaanPublicationAuthor(
            id=uuid.uuid4(),
            publication_id=uuid.uuid4(),
            person_id=valid_person_id,
            author_role=AnudaanAuthorRole.FIRST,
            person=valid_person,
        )
        pub = AnudaanPublication(
            id=uuid.uuid4(),
            application_id=app_id,
            authors=[author],
        )
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-IDOR1",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Applicant",
            institutional_id="EMP-703",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[pub],
            documents=[],
            declarations=[],
        )

        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            # 1. Missing application_id returns 400
            resp_no_app = client.get(
                f"/api/modules/yajur-veda/anudaan/people/{valid_person_id}/verified-bank-accounts",
                headers={"X-Anudaan-Draft-Key": secret},
            )
            assert resp_no_app.status_code == 400
            msg = resp_no_app.json().get("detail") or resp_no_app.json().get("message", "")
            assert "Application ID is required" in msg

            # 2. Unrelated person returns 403 Forbidden
            def mock_person_lookup(stmt):
                mock_res = MagicMock()
                mock_res.unique.return_value.scalar_one_or_none.return_value = app_record
                mock_res.scalar_one_or_none.return_value = unrelated_person
                return mock_res

            mock_db.execute.side_effect = mock_person_lookup
            resp_forbidden = client.get(
                f"/api/modules/yajur-veda/anudaan/applications/{app_id}/people/{unrelated_person_id}/verified-bank-accounts",
                headers={"X-Anudaan-Draft-Key": secret},
            )
            assert resp_forbidden.status_code == 403
            msg_forbid = resp_forbidden.json().get("detail") or resp_forbidden.json().get("message", "")
            assert "Access denied" in msg_forbid

            # 3. Valid person returns verified bank accounts
            def mock_valid_person_flow(stmt):
                mock_res = MagicMock()
                mock_res.unique.return_value.scalar_one_or_none.return_value = app_record
                mock_res.scalar_one_or_none.return_value = valid_person
                mock_res.scalars.return_value.all.return_value = []
                return mock_res

            mock_db.execute.side_effect = mock_valid_person_flow
            resp_valid = client.get(
                f"/api/modules/yajur-veda/anudaan/applications/{app_id}/people/{valid_person_id}/verified-bank-accounts",
                headers={"X-Anudaan-Draft-Key": secret},
            )
            assert resp_valid.status_code == 200
            assert resp_valid.json()["success"] is True
            assert isinstance(resp_valid.json()["data"], list)
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_tracking_rate_limiting(self, client):
        """SEC-02: IP-based sliding-window rate limiter triggers 429 after 10 requests within 60s."""
        mock_db = MagicMock()
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = None

        anudaan_tracking_rate_limiter.reset()

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            for i in range(10):
                resp = client.post(
                    "/api/modules/yajur-veda/anudaan/track",
                    json={"application_number": f"ANU-2026-TEST{i}", "tracking_secret": "secret_valid_123"},
                )
                assert resp.status_code == 404, f"Request {i+1} should pass rate limit (returning 404 for missing app)"

            resp_blocked = client.post(
                "/api/modules/yajur-veda/anudaan/track",
                json={"application_number": "ANU-2026-TEST11", "tracking_secret": "secret_valid_123"},
            )
            assert resp_blocked.status_code == 429
            msg_blocked = resp_blocked.json().get("detail") or resp_blocked.json().get("message", "")
            assert "Rate limit exceeded" in msg_blocked
            assert "seconds" in msg_blocked
        finally:
            app.dependency_overrides.pop(get_db, None)
            anudaan_tracking_rate_limiter.reset()

    def test_tracking_uniform_not_found_responses(self, client):
        """SEC-02: Indistinguishable 404 response on missing app number and invalid secret."""
        mock_db = MagicMock()
        secret = "correct_secret_abc"
        app_record = AnudaanApplication(
            id=uuid.uuid4(),
            application_number="ANU-2026-UNIFORM",
            status=AnudaanApplicationStatus.SUBMITTED,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Uniform",
            institutional_id="EMP-704",
            designation="Professor",
            department_name="Physics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
            submitted_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        app.dependency_overrides[get_db] = lambda: mock_db
        try:
            # 1. Non-existent application number
            mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = None
            resp_missing = client.post(
                "/api/modules/yajur-veda/anudaan/track",
                json={"application_number": "ANU-2026-DOESNOTEXIST", "tracking_secret": "any_secret_123"},
            )
            assert resp_missing.status_code == 404
            msg_missing = resp_missing.json().get("detail") or resp_missing.json().get("message", "")
            assert msg_missing == "Application not found or tracking secret is invalid."

            # 2. Existing application with incorrect secret
            mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record
            resp_bad_secret = client.post(
                "/api/modules/yajur-veda/anudaan/track",
                json={"application_number": "ANU-2026-UNIFORM", "tracking_secret": "wrong_secret_123"},
            )
            assert resp_bad_secret.status_code == 404
            msg_bad = resp_bad_secret.json().get("detail") or resp_bad_secret.json().get("message", "")
            assert msg_bad == msg_missing
        finally:
            app.dependency_overrides.pop(get_db, None)

    def test_storage_orphan_cleanup_on_db_error(self):
        """SEC-06: Compensating storage deletion if DB commit fails after save_file."""
        mock_db = MagicMock()
        app_id = uuid.uuid4()
        secret = "secret_orphan_key"
        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-ORPHAN",
            status=AnudaanApplicationStatus.DRAFT,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Orphan Test",
            institutional_id="EMP-705",
            designation="Professor",
            department_name="Chemistry",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret)},
            publications=[],
            documents=[],
            declarations=[],
        )
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = app_record
        mock_db.commit.side_effect = RuntimeError("Simulated DB connection failure during document commit")

        from unittest.mock import AsyncMock
        mock_upload = MagicMock()
        mock_upload.filename = "manuscript.pdf"
        mock_upload.read = AsyncMock(return_value=SAMPLE_PDF_BYTES)

        import asyncio

        with patch("app.modules.yajur_veda.services.anudaan_service.storage_service.save_file") as mock_save, \
             patch("app.modules.yajur_veda.services.anudaan_service.storage_service.delete_file") as mock_del:
            mock_save.return_value = MagicMock()
            mock_del.return_value = True

            with pytest.raises(RuntimeError) as exc:
                asyncio.run(
                    AnudaanService.upload_document(
                        db=mock_db,
                        application_id=app_id,
                        file=mock_upload,
                        document_type=AnudaanDocumentCategory.PUBLISHED_PAPER,
                        draft_key=secret,
                    )
                )
            assert "Simulated DB connection failure" in str(exc.value)
            mock_del.assert_called_once()

    def test_email_outbox_tracking_and_retry(self):
        """SEC-07: Durable outbox tracking in form_metadata and retry helper."""
        mock_db = MagicMock()
        app_id = uuid.uuid4()
        secret = "secret_outbox_key"

        app_record = AnudaanApplication(
            id=app_id,
            application_number="ANU-2026-OUTBOX",
            status=AnudaanApplicationStatus.SUBMITTED,
            applicant_category=AnudaanApplicantCategory.FACULTY_CAMPUS,
            full_name="Prof. Outbox",
            institutional_id="EMP-706",
            designation="Professor",
            department_name="Mathematics",
            mobile_number="9876543210",
            form_metadata={"tracking_secret_hash": hash_password(secret), "email": "outbox.test@csjmu.ac.in"},
            publications=[],
            documents=[],
            declarations=[],
            submitted_at=datetime.now(timezone.utc),
        )
        mock_db.execute.return_value.scalar_one_or_none.return_value = app_record

        # 1. Dispatch failure updates outbox to FAILED
        with patch("app.services.notifications.email_service.email_sender_service.send_email", return_value=(False, "SMTP Timeout")):
            AnudaanService._send_submission_confirmation_email(mock_db, app_record)
            outbox = app_record.form_metadata["email_notification_outbox"]
            assert outbox["status"] == "FAILED"
            assert outbox["attempts"] == 1
            assert "SMTP Timeout" in outbox["last_error"]

        # 2. Retry succeeds and updates outbox to SENT
        with patch("app.services.notifications.email_service.email_sender_service.send_email", return_value=(True, None)):
            success = AnudaanService.retry_failed_submission_notification(mock_db, app_id)
            assert success is True
            outbox = app_record.form_metadata["email_notification_outbox"]
            assert outbox["status"] == "SENT"
            assert outbox["attempts"] == 2
            assert outbox["last_error"] is None
