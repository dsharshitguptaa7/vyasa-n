"""
Unit and API Integration Tests for ANUDAAN Simplified Sadmin Incentive Sanction Register.
Verifies CRUD operations, quartile validation, amount validation, duplicate prevention,
privacy preservation, distinct researcher aggregation, public showcase filtering,
optional department and project title, and Volume & Issue Felicitation Cycle management.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from app.modules.yajur_veda.models.showcase import AnudaanSanctionEntry, AnudaanFelicitationCycle
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanSanctionEntryCreate,
    AnudaanSanctionEntryUpdate,
    AnudaanSanctionEntryOut,
    AnudaanPublicSanctionOut,
    AnudaanPublicImpactStats,
    AnudaanFelicitationCycleCreate,
    AnudaanFelicitationCycleUpdate,
    AnudaanFelicitationCycleOut,
)
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service


class TestSanctionValidationAndIntegrity:
    """Tests validation constraints and data models for Sanction Register."""

    def test_valid_sanction_entry_creation(self):
        cycle_id = uuid.uuid4()
        payload = AnudaanSanctionEntryCreate(
            researcher_name="Dr. Ramesh Sharma",
            department_name="Department of Physics",
            project_title="Quantum Material Synthesis",
            publication_title="Quantum Coherence in 2D Superconductors",
            publication_doi="10.1038/s41586-026-00123-x",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 10),
            felicitation_cycle_id=cycle_id,
            remarks="VC sanction order 2026/042",
            is_published=True,
        )
        assert payload.quartile == "Q1"
        assert payload.sanctioned_amount == Decimal("50000.00")
        assert payload.is_published is True
        assert payload.felicitation_cycle_id == cycle_id
        assert payload.project_title == "Quantum Material Synthesis"

    def test_optional_department_and_project_title(self):
        """Department and project title are optional; creation succeeds without them."""
        cycle_id = uuid.uuid4()
        payload = AnudaanSanctionEntryCreate(
            researcher_name="Dr. Ramesh Sharma",
            department_name=None,
            project_title=None,
            publication_title="Quantum Coherence in 2D Superconductors",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 10),
            felicitation_cycle_id=cycle_id,
        )
        assert payload.department_name is None
        assert payload.project_title is None
        assert payload.publication_title == "Quantum Coherence in 2D Superconductors"

    def test_mandatory_publication_title(self):
        """Publication title is strictly mandatory; omitting it raises validation error."""
        cycle_id = uuid.uuid4()
        with pytest.raises(ValidationError):
            AnudaanSanctionEntryCreate(
                researcher_name="Dr. Ramesh Sharma",
                publication_title="",  # Too short / empty
                quartile="Q1",
                sanctioned_amount=Decimal("50000.00"),
                academic_year="2025-2026",
                sanction_date=date(2026, 2, 10),
                felicitation_cycle_id=cycle_id,
            )

    def test_mandatory_felicitation_cycle_id(self):
        """New sanction records strictly require felicitation_cycle_id."""
        with pytest.raises(ValidationError):
            AnudaanSanctionEntryCreate(
                researcher_name="Dr. Ramesh Sharma",
                publication_title="Quantum Coherence in 2D Superconductors",
                quartile="Q1",
                sanctioned_amount=Decimal("50000.00"),
                academic_year="2025-2026",
                sanction_date=date(2026, 2, 10),
                # Missing felicitation_cycle_id
            )

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
                felicitation_cycle_id=uuid.uuid4(),
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
                felicitation_cycle_id=uuid.uuid4(),
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
            felicitation_cycle_id=uuid.uuid4(),
        )
        assert payload.sanctioned_amount == Decimal("0.00")

    def test_public_sanction_excludes_pii(self):
        """Public schema must only contain researcher_name, department, publication_title, quartile, amount, year."""
        pub_out = AnudaanPublicSanctionOut(
            id=uuid.uuid4(),
            researcher_name="Dr. Ramesh Sharma",
            department_name="Department of Physics",
            project_title="Quantum Material Synthesis",
            publication_title="Quantum Coherence",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
            volume_number=2,
            issue_number=2,
            cycle_display_title="Convocation Felicitation",
            cycle_status="COMPLETED",
        )
        data = pub_out.model_dump()
        assert "employee_id" not in data
        assert "institutional_id" not in data
        assert "bank_account" not in data
        assert "pan" not in data
        assert "mobile_number" not in data
        assert "utr" not in data
        assert "disbursement_reference" not in data
        assert data["volume_number"] == 2
        assert data["issue_number"] == 2


class TestFelicitationCycleOperations:
    """Tests Volume & Issue Felicitation Cycle management."""

    def test_create_cycle_payload_validation(self):
        payload = AnudaanFelicitationCycleCreate(
            volume_number=2,
            issue_number=3,
            display_title="Spring Research Recognition Ceremony",
            status="UPCOMING",
            felicitation_date=date(2026, 3, 15),
            academic_year="2025-2026",
            description="Upcoming felicitation for Q1 & Q2 publication incentives.",
            is_published=True,
            is_archived=False,
        )
        assert payload.volume_number == 2
        assert payload.issue_number == 3
        assert payload.status == "UPCOMING"

    def test_create_cycle_service(self):
        mock_db = MagicMock()
        mock_db.scalar.return_value = None  # No duplicate volume/issue

        payload = AnudaanFelicitationCycleCreate(
            volume_number=2,
            issue_number=2,
            display_title="Annual Research Convocation Felicitation",
            status="COMPLETED",
            felicitation_date=date(2026, 1, 20),
            academic_year="2025-2026",
        )

        cycle = anudaan_showcase_service.create_felicitation_cycle(mock_db, payload)
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert cycle.volume_number == 2
        assert cycle.issue_number == 2
        assert cycle.status == "COMPLETED"

    def test_duplicate_volume_issue_rejected(self):
        mock_db = MagicMock()
        existing_cycle = AnudaanFelicitationCycle(
            id=uuid.uuid4(),
            volume_number=2,
            issue_number=2,
            status="COMPLETED",
        )
        mock_db.scalar.return_value = existing_cycle

        payload = AnudaanFelicitationCycleCreate(
            volume_number=2,
            issue_number=2,
            status="UPCOMING",
        )

        with pytest.raises(ValueError, match="already exists"):
            anudaan_showcase_service.create_felicitation_cycle(mock_db, payload)


class TestSanctionServiceOperations:
    """Tests service CRUD, duplicate protection, and metric aggregation."""

    def test_duplicate_entry_prevention(self):
        mock_db = MagicMock()
        cycle_id = uuid.uuid4()
        existing_entry = AnudaanSanctionEntry(
            id=uuid.uuid4(),
            researcher_name="Dr. Ramesh Sharma",
            department_name="Physics",
            publication_title="Quantum Coherence",
            academic_year="2025-2026",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            sanction_date=date(2026, 2, 10),
            felicitation_cycle_id=cycle_id,
        )
        mock_db.get.return_value = AnudaanFelicitationCycle(id=cycle_id, volume_number=2, issue_number=2)
        mock_db.scalar.return_value = existing_entry

        payload = AnudaanSanctionEntryCreate(
            researcher_name="Dr. Ramesh Sharma",
            department_name="Physics",
            publication_title="Quantum Coherence",
            quartile="Q1",
            sanctioned_amount=Decimal("50000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 10),
            felicitation_cycle_id=cycle_id,
        )

        with pytest.raises(ValueError, match="already exists"):
            anudaan_showcase_service.create_sanction_entry(mock_db, payload)

    def test_create_sanction_entry_success(self):
        mock_db = MagicMock()
        cycle_id = uuid.uuid4()
        mock_db.get.return_value = AnudaanFelicitationCycle(id=cycle_id, volume_number=2, issue_number=2)
        mock_db.scalar.return_value = None  # No existing duplicate

        payload = AnudaanSanctionEntryCreate(
            researcher_name="Prof. Ananya Sen",
            department_name="Biotechnology",
            project_title="CRISPR Modulation Grant",
            publication_title="CRISPR Gene Editing in Crop Resistance",
            quartile="Q1",
            sanctioned_amount=Decimal("100000.00"),
            academic_year="2025-2026",
            sanction_date=date(2026, 2, 12),
            felicitation_cycle_id=cycle_id,
        )

        entry = anudaan_showcase_service.create_sanction_entry(mock_db, payload, created_by_id=uuid.uuid4())
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert entry.researcher_name == "Prof. Ananya Sen"
        assert entry.sanctioned_amount == Decimal("100000.00")
        assert entry.felicitation_cycle_id == cycle_id
        assert entry.project_title == "CRISPR Modulation Grant"

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

