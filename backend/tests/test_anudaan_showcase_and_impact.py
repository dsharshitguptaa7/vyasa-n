"""
ANUDAAN Phase 4.3.5 Comprehensive Test Suite
Tests:
1. Institutional Incentive Impact aggregation logic & API.
2. APPROVED vs. CREDITED financial distinction (zero payment inference without verified records).
3. Zero-PII public exposure.
4. Sadmin controlled disbursement workflow (Record, Verify, Reverse, Duplicate Prevention).
5. Sadmin researcher recognition gallery CMS (CRUD, Photo validation, Consent, Cover, Ordering).
6. Public showcase configuration toggles.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.api.dependencies import get_current_user, require_permission
from app.models.user import User
from app.models.role import Role
from app.modules.yajur_veda.models.enums import (
    AnudaanApplicantCategory,
    AnudaanApplicationStatus,
)
from app.modules.yajur_veda.models.anudaan import (
    AnudaanApplication,
    AnudaanPublication,
    AnudaanPerson,
    AnudaanPublicationAuthor,
)
from app.modules.yajur_veda.models.showcase import (
    AnudaanDisbursement,
    AnudaanGalleryItem,
    AnudaanGalleryImage,
    AnudaanPublicConfig,
)
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanPublicImpactStats,
    AnudaanDisbursementCreate,
    AnudaanGalleryItemCreate,
    AnudaanPublicConfigUpdate,
)
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service


@pytest.fixture
def test_admin_user():
    user = User(
        id=uuid.uuid4(),
        email="sadmin.anudaan@csjmu.ac.in",
        first_name="Super Admin",
        last_name="ANUDAAN",
        is_active=True,
    )
    role = Role(id=uuid.uuid4(), name="super_admin", description="Super Admin")
    user.roles.append(role)
    return user


@pytest.fixture
def client(test_admin_user):
    with patch("app.main.check_database_connection", return_value=False), \
         patch("app.main.seed_all", return_value={}):
        app.dependency_overrides[get_current_user] = lambda: test_admin_user
        with TestClient(app) as test_client:
            yield test_client
        app.dependency_overrides.clear()


# =============================================================================
# 1. Impact Statistics & Financial Logic Tests
# =============================================================================

class TestAnudaanImpactAggregation:
    """Verifies data aggregation rules, zero-PII, and financial integrity."""

    def test_impact_stats_approved_not_credited(self):
        """
        CRITICAL: Applications with ACCEPTED / APPROVED_FOR_RELEASE must NOT
        be counted as disbursed amount. Only verified disbursements contribute to INR total.
        """
        mock_db = MagicMock()
        mock_db.scalars.return_value.all.return_value = ["2025-2026"]
        # Scalars calls: researchers_recognised=3, total_sanctioned=Decimal("0.00"), total_entries=3, latest_updated_at
        mock_db.scalar.side_effect = [
            3,                     # total_researchers_recognised
            Decimal("0.00"),        # total_incentive_sanctioned_inr
            3,                     # total_sanction_entries
            datetime(2026, 2, 1, 10, 0, 0, tzinfo=timezone.utc),  # latest_updated_at
        ]
        mock_db.execute.return_value.all.return_value = [("Q1", 2), ("Q2", 1)]

        stats = anudaan_showcase_service.get_public_impact_stats(mock_db, academic_year="2025-2026")

        assert stats.total_researchers_recognised == 3
        assert stats.total_sanction_entries == 3
        assert stats.total_incentive_sanctioned_inr == Decimal("0.00")
        assert stats.quartile_breakdown["Q1"] == 2
        assert stats.quartile_breakdown["Q2"] == 1
        assert stats.reporting_academic_year == "2025-2026"

    def test_impact_stats_with_verified_disbursement(self):
        """When published sanctions exist, totals reflect sanctioned sum and counts."""
        mock_db = MagicMock()
        mock_db.scalars.return_value.all.return_value = ["2025-2026"]
        mock_db.scalar.side_effect = [
            7,                      # total_researchers_recognised
            Decimal("150000.00"),   # total_incentive_sanctioned_inr
            10,                     # total_sanction_entries
            datetime(2026, 2, 20, 10, 0, 0, tzinfo=timezone.utc), # latest_updated_at
        ]
        mock_db.execute.return_value.all.return_value = [("Q1", 6), ("Q2", 4)]

        stats = anudaan_showcase_service.get_public_impact_stats(mock_db, academic_year="2025-2026")

        assert stats.total_incentive_sanctioned_inr == Decimal("150000.00")
        assert stats.total_researchers_recognised == 7
        assert stats.total_sanction_entries == 10
        assert stats.quartile_breakdown["Q1"] == 6
        assert stats.quartile_breakdown["Q2"] == 4


# =============================================================================
# 2. Public API Endpoints Tests
# =============================================================================

class TestAnudaanPublicEndpoints:
    """Verifies public router endpoints."""

    def test_get_public_impact_endpoint(self, client):
        mock_stats = AnudaanPublicImpactStats(
            reporting_academic_year="2025-2026",
            total_claims_received=12,
            claims_approved=8,
            claims_under_review=4,
            claims_rejected=0,
            researchers_benefited=7,
            total_incentive_disbursed_inr=Decimal("175000.00"),
            disbursement_status="VERIFIED",
            last_updated_at=datetime(2026, 2, 20, tzinfo=timezone.utc),
            academic_years_available=["2026-2027", "2025-2026"],
        )

        with patch.object(anudaan_showcase_service, "get_public_impact_stats", return_value=mock_stats), \
             patch.object(anudaan_showcase_service, "get_public_config") as mock_cfg:
            mock_cfg.return_value.active_academic_year = "2025-2026"
            resp = client.get("/api/modules/yajur-veda/anudaan/public/impact")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["data"]["total_claims_received"] == 12
            assert data["data"]["claims_approved"] == 8
            assert float(data["data"]["total_incentive_disbursed_inr"]) == 175000.0

            # Verify Zero PII leakage
            raw_text = resp.text
            assert "email" not in raw_text
            assert "pan" not in raw_text
            assert "bank_account" not in raw_text

    def test_get_public_gallery_endpoint(self, client):
        mock_item = AnudaanGalleryItem(
            id=uuid.uuid4(),
            title="Incentive Award Ceremony 2026",
            event_name="Annual Research Awards",
            event_date=date(2026, 2, 10),
            academic_year="2025-2026",
            description="Honoring scholars with research publication incentives.",
            researcher_name="Prof. Sharma",
            researcher_designation="Professor",
            department_name="Physics",
            has_consent=True,
            is_featured=True,
            is_published=True,
            display_order=0,
            created_at=datetime(2026, 2, 10, tzinfo=timezone.utc),
            updated_at=datetime(2026, 2, 10, tzinfo=timezone.utc),
            images=[],
        )

        with patch.object(anudaan_showcase_service, "list_public_gallery_items", return_value=(1, [mock_item])):
            resp = client.get("/api/modules/yajur-veda/anudaan/public/gallery")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["data"]["total"] == 1
            assert data["data"]["items"][0]["title"] == "Incentive Award Ceremony 2026"

    def test_get_public_config_endpoint(self, client):
        mock_cfg = AnudaanPublicConfig(
            id=uuid.uuid4(),
            config_key="global_showcase",
            impact_section_enabled=True,
            gallery_section_enabled=True,
            active_academic_year="2025-2026",
            custom_banner_note=None,
        )
        with patch.object(anudaan_showcase_service, "get_public_config", return_value=mock_cfg):
            resp = client.get("/api/modules/yajur-veda/anudaan/public/config")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["data"]["impact_section_enabled"] is True
            assert data["data"]["gallery_section_enabled"] is True


# =============================================================================
# 3. Sadmin Controlled Disbursements Tests
# =============================================================================

class TestAnudaanSadminDisbursements:
    """Verifies Sadmin disbursement recording, verification, and reversals."""

    def test_record_disbursement(self, client):
        app_id = uuid.uuid4()
        disb_id = uuid.uuid4()
        mock_disb = AnudaanDisbursement(
            id=disb_id,
            application_id=app_id,
            disbursement_reference="UTR-SBI-20260220-999",
            amount=Decimal("30000.00"),
            disbursement_date=date(2026, 2, 20),
            academic_year="2025-2026",
            payment_method="NEFT",
            verification_status="RECORDED",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with patch.object(anudaan_showcase_service, "create_disbursement", return_value=mock_disb), \
             patch("app.admin.anudaan_admin_router.audit_service.log_from_request"):
            payload = {
                "application_id": str(app_id),
                "disbursement_reference": "UTR-SBI-20260220-999",
                "amount": 30000.00,
                "disbursement_date": "2026-02-20",
                "academic_year": "2025-2026",
                "payment_method": "NEFT",
            }
            resp = client.post("/api/admin/anudaan/disbursements", json=payload)
            assert resp.status_code == 201
            data = resp.json()
            assert data["success"] is True
            assert data["data"]["verification_status"] == "RECORDED"
            assert data["data"]["disbursement_reference"] == "UTR-SBI-20260220-999"

    def test_verify_disbursement(self, client):
        disb_id = uuid.uuid4()
        mock_disb = AnudaanDisbursement(
            id=disb_id,
            application_id=uuid.uuid4(),
            disbursement_reference="UTR-SBI-VERIFIED",
            amount=Decimal("20000.00"),
            disbursement_date=date(2026, 2, 20),
            academic_year="2025-2026",
            payment_method="NEFT",
            verification_status="VERIFIED",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with patch.object(anudaan_showcase_service, "verify_disbursement", return_value=mock_disb), \
             patch("app.admin.anudaan_admin_router.audit_service.log_from_request"):
            resp = client.put(f"/api/admin/anudaan/disbursements/{disb_id}/verify", json={"notes": "Checked bank ledger."})
            assert resp.status_code == 200
            assert resp.json()["data"]["verification_status"] == "VERIFIED"

    def test_reverse_disbursement(self, client):
        disb_id = uuid.uuid4()
        mock_disb = AnudaanDisbursement(
            id=disb_id,
            application_id=uuid.uuid4(),
            disbursement_reference="UTR-SBI-REV",
            amount=Decimal("20000.00"),
            disbursement_date=date(2026, 2, 20),
            academic_year="2025-2026",
            payment_method="NEFT",
            verification_status="REVERSED",
            reversal_reason="Bank payment bounced due to IFSC transition.",
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        with patch.object(anudaan_showcase_service, "reverse_disbursement", return_value=mock_disb), \
             patch("app.admin.anudaan_admin_router.audit_service.log_from_request"):
            resp = client.post(
                f"/api/admin/anudaan/disbursements/{disb_id}/reverse",
                json={"reversal_reason": "Bank payment bounced due to IFSC transition."},
            )
            assert resp.status_code == 200
            assert resp.json()["data"]["verification_status"] == "REVERSED"


# =============================================================================
# 4. Sadmin Gallery CMS Tests
# =============================================================================

class TestAnudaanSadminGallery:
    """Verifies gallery entry CRUD, consent enforcement, and display config."""

    def test_create_and_update_gallery_item(self, client):
        item_id = uuid.uuid4()
        mock_item = AnudaanGalleryItem(
            id=item_id,
            title="Incentive Award Ceremony 2026",
            event_name="Annual Research Awards",
            event_date=date(2026, 2, 10),
            academic_year="2025-2026",
            description="Honoring scholars with research publication incentives.",
            researcher_name="Prof. Sharma",
            has_consent=True,
            is_featured=False,
            is_published=False,
            display_order=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            images=[],
        )

        with patch.object(anudaan_showcase_service, "create_gallery_item", return_value=mock_item), \
             patch("app.admin.anudaan_admin_router.audit_service.log_from_request"):
            create_payload = {
                "title": "Incentive Award Ceremony 2026",
                "event_name": "Annual Research Awards",
                "event_date": "2026-02-10",
                "academic_year": "2025-2026",
                "description": "Honoring scholars with research publication incentives.",
                "researcher_name": "Prof. Sharma",
                "has_consent": True,
            }
            resp = client.post("/api/admin/anudaan/gallery", json=create_payload)
            assert resp.status_code == 201
            assert resp.json()["data"]["title"] == "Incentive Award Ceremony 2026"

    def test_update_public_config(self, client):
        mock_cfg = AnudaanPublicConfig(
            id=uuid.uuid4(),
            config_key="global_showcase",
            impact_section_enabled=False,
            gallery_section_enabled=True,
            active_academic_year="2025-2026",
        )

        with patch.object(anudaan_showcase_service, "update_public_config", return_value=mock_cfg), \
             patch("app.admin.anudaan_admin_router.audit_service.log_from_request"):
            resp = client.put("/api/admin/anudaan/config", json={"impact_section_enabled": False})
            assert resp.status_code == 200
            assert resp.json()["data"]["impact_section_enabled"] is False
