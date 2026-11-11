"""
Unit and API Integration Tests for ANUDAAN Simplified Sadmin Incentive Sanction Register.
Verifies CRUD operations, quartile validation, amount validation, duplicate prevention,
privacy preservation, distinct researcher aggregation, and public showcase filtering.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from app.modules.yajur_veda.models.showcase import AnudaanSanctionEntry
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanSanctionEntryCreate,
    AnudaanSanctionEntryUpdate,
    AnudaanSanctionEntryOut,
    AnudaanPublicSanctionOut,
    AnudaanPublicImpactStats,
)
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service


class TestSanctionValidationAndIntegrity:
    """Tests validation constraints and data models for Sanction Register."""

    def test_valid_sanction_entry_creation(self):
        payload = AnudaanSanctionEntryCreate(
            researcher_name="Dr. Ramesh Sharma",
            department_name="Department of Physics",
            publication_title="Quantum Coherence in 2D Superconductors",
            publication_doi="10.1038/s41586-026-00123-x",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 10),
            remarks="VC sanction order 2026/042",
            is_published=True,
        )
        assert payload.quartile == "Q1"
        assert payload.sanctioned_amount == Decimal("50000.00")
        assert payload.is_published is True

    def test_invalid_quartile_rejected(self):
        with pytest.raises(ValidationError):
            AnudaanSanctionEntryCreate(
                researcher_name="Dr. Ramesh Sharma",
                department_name="Department of Physics",
                publication_title="Quantum Coherence",
                quartile="Q5",  # Invalid
                sanctioned_amount=Decimal("50000.00"),
                academic_year="2025-2026",
                sanction_date=date(2026, 2, 10),
            )

    def test_negative_amount_rejected(self):
        with pytest.raises(ValidationError):
            AnudaanSanctionEntryCreate(
                researcher_name="Dr. Ramesh Sharma",
                department_name="Department of Physics",
                publication_title="Quantum Coherence",
                quartile="Q1",
                sanctioned_amount=Decimal("-1000.00"),  # Negative
                academic_year="2025-2026",
                sanction_date=date(2026, 2, 10),
            )

    def test_zero_amount_accepted(self):
        payload = AnudaanSanctionEntryCreate(
            researcher_name="Dr. Ramesh Sharma",
            department_name="Department of Physics",
            publication_title="Quantum Coherence",
            quartile="Q2",
            sanctioned_amount=Decimal("0.00"),  # Non-negative zero allowed
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 10),
        )
        assert payload.sanctioned_amount == Decimal("0.00")

    def test_public_sanction_excludes_pii(self):
        """Public schema must only contain researcher_name, department, publication_title, quartile, amount, year."""
        pub_out = AnudaanPublicSanctionOut(
            id=uuid.uuid4(),
            researcher_name="Dr. Ramesh Sharma",
            department_name="Department of Physics",
            publication_title="Quantum Coherence",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
        )
        data = pub_out.model_dump()
        assert "employee_id" not in data
        assert "institutional_id" not in data
        assert "bank_account" not in data
        assert "pan" not in data
        assert "mobile_number" not in data
        assert "utr" not in data
        assert "disbursement_reference" not in data


class TestSanctionServiceOperations:
    """Tests service CRUD, duplicate protection, and metric aggregation."""

    def test_duplicate_entry_prevention(self):
        mock_db = MagicMock()
        existing_entry = AnudaanSanctionEntry(
            id=uuid.uuid4(),
            researcher_name="Dr. Ramesh Sharma",
            department_name="Physics",
            publication_title="Quantum Coherence",
            academic_year="2025-2026",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            sanction_date=date(2026, 2, 10),
        )
        mock_db.scalar.return_value = existing_entry

        payload = AnudaanSanctionEntryCreate(
            researcher_name="Dr. Ramesh Sharma",
            department_name="Physics",
            publication_title="Quantum Coherence",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 10),
        )

        with pytest.raises(ValueError, match="already exists"):
            anudaan_showcase_service.create_sanction_entry(mock_db, payload)

    def test_create_sanction_entry_success(self):
        mock_db = MagicMock()
        mock_db.scalar.return_value = None  # No existing duplicate

        payload = AnudaanSanctionEntryCreate(
            researcher_name="Prof. Ananya Sen",
            department_name="Biotechnology",
            publication_title="CRISPR Gene Editing in Crop Resistance",
            quartile="Q1",
            sanctioned_amount=Decimal("100000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 12),
        )

        entry = anudaan_showcase_service.create_sanction_entry(mock_db, payload, created_by_id=uuid.uuid4())
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert entry.researcher_name == "Prof. Ananya Sen"
        assert entry.sanctioned_amount == Decimal("100000.00")

    def test_toggle_sanction_publication(self):
        mock_db = MagicMock()
        entry = AnudaanSanctionEntry(
            id=uuid.uuid4(),
            researcher_name="Prof. Ananya Sen",
            department_name="Biotechnology",
            publication_title="CRISPR",
            quartile="Q1",
            sanctioned_amount=Decimal("100000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 12),
            is_published=True,
        )
        mock_db.get.return_value = entry

        updated = anudaan_showcase_service.toggle_sanction_publication(mock_db, entry.id, False)
        assert updated.is_published is False
        mock_db.commit.assert_called_once()

    def test_delete_sanction_entry(self):
        mock_db = MagicMock()
        entry = AnudaanSanctionEntry(id=uuid.uuid4())
        mock_db.get.return_value = entry

        result = anudaan_showcase_service.delete_sanction_entry(mock_db, entry.id)
        assert result is True
        mock_db.delete.assert_called_once_with(entry)
        mock_db.commit.assert_called_once()

    def test_impact_stats_derived_from_published_sanctions(self):
        mock_db = MagicMock()
        mock_db.scalars.return_value.all.return_value = ["2025-2026"]
        mock_db.scalar.side_effect = [
            12,                    # distinct researchers
            Decimal("450000.00"),  # total sanctioned INR
            15,                    # total entries
            datetime(2026, 2, 11, 12, 0, 0, tzinfo=timezone.utc), # latest_updated_at
        ]
        mock_db.execute.return_value.all.return_value = [
            ("Q1", 8),
            ("Q2", 5),
            ("Q3", 2),
        ]

        stats = anudaan_showcase_service.get_public_impact_stats(mock_db, academic_year="2025-2026")

        assert stats.total_researchers_recognised == 12
        assert stats.total_incentive_sanctioned_inr == Decimal("450000.00")
        assert stats.total_sanction_entries == 15
        assert stats.quartile_breakdown == {"Q1": 8, "Q2": 5, "Q3": 2, "Q4": 0}
        assert stats.reporting_academic_year == "2025-2026"
