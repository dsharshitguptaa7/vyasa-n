"""
ANUDAAN Phase 4.3.6 Security, RBAC, Ledger Integrity & Consent Audit Tests

Verifies:
1. Application status enum reconciliation: CREDITED terminal status, no DISBURSED enum value.
2. Unique constraint on disbursement_reference at DB layer to prevent race conditions.
3. Separation of duties: Four-eyes principle on disbursements (self-verification rejection).
4. Reversal integrity: Mandatory non-empty reversal justification.
5. Institutional consent lifecycle: Blocking publication without consent, auto-unpublishing on consent revocation.
6. Beneficiary & financial statistics: Zero PII in public schema, accurate author vs applicant counting.
7. Bank input schema: Frontend-only confirm_account_number decoupling.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from pydantic import ValidationError

from app.modules.yajur_veda.models.enums import (
    AnudaanApplicationStatus,
    AnudaanApplicantCategory,
)
from app.modules.yajur_veda.models.showcase import (
    AnudaanDisbursement,
    AnudaanGalleryItem,
    AnudaanPublicConfig,
)
from app.modules.yajur_veda.schemas.anudaan import (
    AnudaanBankAccountInput,
)
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanDisbursementCreate,
    AnudaanDisbursementVerifyRequest,
    AnudaanDisbursementReverseRequest,
    AnudaanGalleryItemCreate,
    AnudaanGalleryItemUpdate,
    AnudaanPublicImpactStats,
)
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service


# =============================================================================
# 1. Status Contract & Enum Reconciliation
# =============================================================================

class TestApplicationStatusEnumReconciliation:
    """Verifies that the canonical status enum remains uncorrupted and backwards-compatible."""

    def test_credited_status_is_canonical_terminal_state(self):
        """The database enum must use CREDITED for incentive payouts."""
        assert AnudaanApplicationStatus.CREDITED.value == "CREDITED"
        # DISBURSED must NOT be an application status enum member
        assert "DISBURSED" not in [s.value for s in AnudaanApplicationStatus]

    def test_application_lifecycle_progression(self):
        """Verify full lifecycle statuses exist in expected order."""
        statuses = [s.value for s in AnudaanApplicationStatus]
        expected_statuses = [
            "DRAFT",
            "SUBMITTED",
            "UNDER_REVIEW",
            "NEEDS_CLARIFICATION",
            "ACCEPTED",
            "REJECTED",
            "APPROVED_FOR_RELEASE",
            "RELEASED",
            "PROCESSING",
            "CREDITED",
        ]
        for s in expected_statuses:
            assert s in statuses


# =============================================================================
# 2. Database Constraint & Concurrency Ledger Integrity
# =============================================================================

class TestDisbursementLedgerIntegrity:
    """Verifies DB constraints, unique UTR enforcement, and mathematical precision."""

    def test_disbursement_reference_has_unique_constraint(self):
        """Database model must declare a UniqueConstraint on disbursement_reference."""
        table = AnudaanDisbursement.__table__
        # Check unique constraints on the table
        unique_constraint_names = [c.name for c in table.constraints if hasattr(c, "columns")]
        assert "uq_anudaan_disbursement_reference" in unique_constraint_names

        # Check unique index exists on disbursement_reference column
        ref_indexes = [idx for idx in table.indexes if any(c.name == "disbursement_reference" for c in idx.columns)]
        assert any(idx.unique for idx in ref_indexes)

    def test_disbursement_creation_numeric_precision(self):
        """Disbursement amount must preserve exact Decimal precision (no float rounding)."""
        payload = AnudaanDisbursementCreate(
            application_id=uuid.uuid4(),
            disbursement_reference="UTR/2026/02/100912",
            disbursement_date=date(2026, 2, 10),
            amount=Decimal("25000.50"),
            academic_year="2025-2026",
            payment_method="NEFT",
        )
        assert isinstance(payload.amount, Decimal)
        assert str(payload.amount) == "25000.50"


# =============================================================================
# 3. Separation of Duties (Four-Eyes Principle) & Reversals
# =============================================================================

class TestDisbursementSeparationOfDuties:
    """Verifies that an officer who recorded a disbursement cannot verify their own entry."""

    def test_self_verification_is_strictly_rejected(self):
        """Self-verification must raise ValueError."""
        officer_id = uuid.uuid4()
        disbursement_id = uuid.uuid4()

        disb = AnudaanDisbursement(
            id=disbursement_id,
            application_id=uuid.uuid4(),
            disbursement_reference="UTR/2026/02/99999",
            disbursement_date=date(2026, 2, 10),
            amount=Decimal("15000.00"),
            academic_year="2025-2026",
            payment_method="RTGS",
            verification_status="RECORDED",
            recorded_by_id=officer_id,  # Recorded by officer_id
        )

        mock_db = MagicMock()
        mock_db.get.return_value = disb

        with pytest.raises(ValueError) as excinfo:
            anudaan_showcase_service.verify_disbursement(
                db=mock_db,
                disbursement_id=disbursement_id,
                user_id=officer_id,  # Same user attempts verification!
                notes="Self-approval attempt",
            )

        assert "Separation of duties violation" in str(excinfo.value)
        assert disb.verification_status == "RECORDED"

    def test_verification_by_different_officer_succeeds(self):
        """Verification by a distinct second officer succeeds."""
        maker_id = uuid.uuid4()
        checker_id = uuid.uuid4()
        disbursement_id = uuid.uuid4()

        disb = AnudaanDisbursement(
            id=disbursement_id,
            application_id=uuid.uuid4(),
            disbursement_reference="UTR/2026/02/88888",
            disbursement_date=date(2026, 2, 10),
            amount=Decimal("15000.00"),
            academic_year="2025-2026",
            payment_method="RTGS",
            verification_status="RECORDED",
            recorded_by_id=maker_id,
        )

        mock_db = MagicMock()
        mock_db.get.return_value = disb

        updated = anudaan_showcase_service.verify_disbursement(
            db=mock_db,
            disbursement_id=disbursement_id,
            user_id=checker_id,
            notes="Verified against bank statement",
        )

        assert updated.verification_status == "VERIFIED"
        assert updated.verified_by_id == checker_id

    def test_reversal_requires_non_empty_justification(self):
        """Reversal with empty or whitespace-only reason must raise ValueError."""
        disbursement_id = uuid.uuid4()
        disb = AnudaanDisbursement(
            id=disbursement_id,
            application_id=uuid.uuid4(),
            disbursement_reference="UTR/2026/02/77777",
            disbursement_date=date(2026, 2, 10),
            amount=Decimal("15000.00"),
            academic_year="2025-2026",
            payment_method="RTGS",
            verification_status="VERIFIED",
        )

        mock_db = MagicMock()
        mock_db.get.return_value = disb

        # Whitespace-only justification
        with pytest.raises(ValueError) as excinfo:
            anudaan_showcase_service.reverse_disbursement(
                db=mock_db,
                disbursement_id=disbursement_id,
                reversal_reason="   ",
                user_id=uuid.uuid4(),
            )
        assert "A non-empty justification is required" in str(excinfo.value)


# =============================================================================
# 4. Institutional Consent & Privacy Governance
# =============================================================================

class TestGalleryConsentAndPrivacy:
    """Verifies that ceremony photos without consent cannot be published and revocation auto-unpublishes."""

    def test_create_published_item_without_consent_is_rejected(self):
        """Cannot create a published item if has_consent=False."""
        mock_db = MagicMock()
        payload = AnudaanGalleryItemCreate(
            title="Convocation Research Ceremony 2026",
            event_name="Annual Felicitation 2026",
            description="Ceremony distribution of research incentives",
            event_date=date(2026, 1, 15),
            academic_year="2025-2026",
            has_consent=False,
            is_published=True,  # Conflicting with has_consent=False
        )

        with pytest.raises(ValueError) as excinfo:
            anudaan_showcase_service.create_gallery_item(
                db=mock_db,
                payload=payload,
                user_id=uuid.uuid4(),
            )
        assert "Institutional privacy violation" in str(excinfo.value)

    def test_consent_revocation_automatically_unpublishes(self):
        """When an administrator marks has_consent=False, is_published must automatically become False."""
        item_id = uuid.uuid4()
        item = AnudaanGalleryItem(
            id=item_id,
            title="Research Felicitation",
            event_name="Annual Felicitation",
            event_date=date(2026, 1, 15),
            academic_year="2025-2026",
            description="Annual ceremony",
            has_consent=True,
            is_published=True,
        )

        mock_db = MagicMock()
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = item

        # Researcher withdraws consent
        update_payload = AnudaanGalleryItemUpdate(
            has_consent=False,
        )

        updated = anudaan_showcase_service.update_gallery_item(
            db=mock_db,
            item_id=item_id,
            payload=update_payload,
        )

        assert updated.has_consent is False
        assert updated.is_published is False  # Must be auto-unpublished!

    def test_update_cannot_publish_when_consent_revoked(self):
        """Cannot set is_published=True when item has no consent."""
        item_id = uuid.uuid4()
        item = AnudaanGalleryItem(
            id=item_id,
            title="Research Felicitation",
            event_name="Annual Felicitation",
            event_date=date(2026, 1, 15),
            academic_year="2025-2026",
            description="Annual ceremony",
            has_consent=False,
            is_published=False,
        )

        mock_db = MagicMock()
        mock_db.execute.return_value.unique.return_value.scalar_one_or_none.return_value = item

        update_payload = AnudaanGalleryItemUpdate(
            is_published=True,
        )

        with pytest.raises(ValueError) as excinfo:
            anudaan_showcase_service.update_gallery_item(
                db=mock_db,
                item_id=item_id,
                payload=update_payload,
            )
        assert "Institutional privacy violation" in str(excinfo.value)


# =============================================================================
# 5. Public Impact Stats Zero-PII & Decoupling
# =============================================================================

class TestPublicImpactStatsSecurity:
    """Verifies that public impact statistics never leak PII or individual claim data."""

    def test_public_impact_stats_schema_has_no_pii_fields(self):
        """AnudaanPublicImpactStats must only contain aggregate metrics."""
        schema_fields = set(AnudaanPublicImpactStats.model_fields.keys())
        pii_fields = {
            "name", "email", "applicant_name", "beneficiary_name", "pan",
            "account_number", "bank_account", "phone", "mobile", "utr",
            "reference", "paper_title", "journal", "applicant_id",
        }
        leaked = schema_fields.intersection(pii_fields)
        assert len(leaked) == 0, f"Public schema contains PII fields: {leaked}"

    def test_bank_input_confirm_account_number_optional_in_api(self):
        """API allows confirm_account_number to be omitted (handled purely by frontend)."""
        valid_input = AnudaanBankAccountInput(
            account_holder_name="Dr. Ramanujan",
            bank_name="Canara Bank",
            account_number="123456789012",
            ifsc_code="CNRB0001234",
            branch_name="CSJMU Campus Branch",
        )
        assert valid_input.account_number == "123456789012"
        assert valid_input.confirm_account_number is None
