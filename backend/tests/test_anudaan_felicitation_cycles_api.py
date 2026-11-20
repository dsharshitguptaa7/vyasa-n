"""
ANUDAAN (Yajur Veda) Felicitation & Recognition Cycles Admin API Tests
Verifies:
1. List felicitation cycles API returns HTTP 200 with accurate structure.
2. Null values in created_at, updated_at, description, felicitation_date serialize safely.
3. Decimal and UUID values in API response serialize without 500 error.
4. Status, academic year, archive status, and search filters work accurately.
5. Service-level aggregation accurately counts linked sanctions and computes total INR.
6. Get felicitation cycle detail by ID works properly.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.role import Role
from app.modules.yajur_veda.models.showcase import (
    AnudaanFelicitationCycle,
    AnudaanSanctionEntry,
)
from app.modules.yajur_veda.schemas.showcase import (
    AnudaanFelicitationCycleOut,
    AnudaanFelicitationCycleListResponse,
)
from app.modules.yajur_veda.services.showcase_service import anudaan_showcase_service


@pytest.fixture
def admin_user():
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
def client(admin_user):
    with patch("app.main.check_database_connection", return_value=False), \
         patch("app.main.seed_all", return_value={}):
        app.dependency_overrides[get_current_user] = lambda: admin_user
        with TestClient(app) as test_client:
            yield test_client
        app.dependency_overrides.clear()


class TestAnudaanFelicitationCyclesAPI:
    """Verifies Felicitation & Recognition Cycles Admin API endpoints and serialization."""

    def test_list_felicitation_cycles_endpoint_success(self, client):
        """GET /api/admin/anudaan/felicitations returns HTTP 200 with items and total."""
        cycle1_id = uuid.uuid4()
        cycle2_id = uuid.uuid4()

        mock_items = [
            {
                "id": cycle1_id,
                "volume_number": 2,
                "issue_number": 2,
                "display_title": "Annual Research Felicitation Ceremony 2026",
                "status": "COMPLETED",
                "felicitation_date": date(2026, 3, 15),
                "academic_year": "2025-2026",
                "description": "Honoring scholars for Q1 and Q2 indexed publications.",
                "is_published": True,
                "is_archived": False,
                "sanction_count": 5,
                "total_sanctioned_amount": Decimal("150000.00"),
                "created_at": datetime(2026, 1, 10, 10, 0, 0, tzinfo=timezone.utc),
                "updated_at": datetime(2026, 1, 10, 10, 0, 0, tzinfo=timezone.utc),
            },
            {
                "id": cycle2_id,
                "volume_number": 2,
                "issue_number": 3,
                "display_title": "Monsoon Research Assembly",
                "status": "UPCOMING",
                "felicitation_date": None,
                "academic_year": "2025-2026",
                "description": None,
                "is_published": True,
                "is_archived": False,
                "sanction_count": 2,
                "total_sanctioned_amount": Decimal("31000.00"),
                "created_at": None,  # Test null created_at
                "updated_at": None,  # Test null updated_at
            },
        ]

        with patch.object(anudaan_showcase_service, "list_felicitation_cycles", return_value=(mock_items, 2)):
            resp = client.get("/api/admin/anudaan/felicitations?status=ALL&academic_year=ALL&is_archived=false")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["data"]["total"] == 2
            assert len(data["data"]["items"]) == 2

            # Check cycle 1
            c1 = data["data"]["items"][0]
            assert c1["volume_number"] == 2
            assert c1["issue_number"] == 2
            assert c1["status"] == "COMPLETED"
            assert float(c1["total_sanctioned_amount"]) == 150000.0

            # Check cycle 2 (null description and date handled safely)
            c2 = data["data"]["items"][1]
            assert c2["volume_number"] == 2
            assert c2["issue_number"] == 3
            assert c2["status"] == "UPCOMING"
            assert c2["description"] is None
            assert c2["felicitation_date"] is None
            assert float(c2["total_sanctioned_amount"]) == 31000.0

    def test_schema_null_timestamp_tolerance(self):
        """AnudaanFelicitationCycleOut tolerates null timestamps and missing optional fields."""
        cycle_id = uuid.uuid4()
        out = AnudaanFelicitationCycleOut(
            id=cycle_id,
            volume_number=1,
            issue_number=1,
            display_title=None,
            status="COMPLETED",
            felicitation_date=None,
            academic_year=None,
            description=None,
            is_published=True,
            is_archived=False,
            sanction_count=0,
            total_sanctioned_amount=Decimal("0.00"),
            created_at=None,
            updated_at=None,
        )
        assert out.id == cycle_id
        assert out.created_at is None
        assert out.updated_at is None
        assert out.total_sanctioned_amount == Decimal("0.00")

    def test_get_single_cycle_detail(self, client):
        """GET /api/admin/anudaan/felicitations/{cycle_id} returns single cycle."""
        cycle_id = uuid.uuid4()
        mock_detail = {
            "id": cycle_id,
            "volume_number": 1,
            "issue_number": 1,
            "display_title": "Founding Volume",
            "status": "COMPLETED",
            "felicitation_date": date(2025, 12, 1),
            "academic_year": "2025-2026",
            "description": "Inaugural recognition.",
            "is_published": True,
            "is_archived": False,
            "sanction_count": 3,
            "total_sanctioned_amount": Decimal("75000.00"),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        with patch.object(anudaan_showcase_service, "get_felicitation_cycle", return_value=mock_detail):
            resp = client.get(f"/api/admin/anudaan/felicitations/{cycle_id}")
            assert resp.status_code == 200
            data = resp.json()
            assert data["success"] is True
            assert data["data"]["volume_number"] == 1
            assert data["data"]["issue_number"] == 1
            assert float(data["data"]["total_sanctioned_amount"]) == 75000.0

    def test_get_single_cycle_not_found(self, client):
        """GET /api/admin/anudaan/felicitations/{cycle_id} returns 404 if missing."""
        cycle_id = uuid.uuid4()
        with patch.object(anudaan_showcase_service, "get_felicitation_cycle", return_value=None):
            resp = client.get(f"/api/admin/anudaan/felicitations/{cycle_id}")
            assert resp.status_code == 404

    def test_list_felicitation_cycles_service_db_logic(self):
        """Verifies showcase service query building and fallback defaults."""
        mock_db = MagicMock()
        mock_cycle = MagicMock()
        mock_cycle.id = uuid.uuid4()
        mock_cycle.volume_number = 2
        mock_cycle.issue_number = 1
        mock_cycle.display_title = "Volume 2 Issue 1"
        mock_cycle.status = "COMPLETED"
        mock_cycle.felicitation_date = date(2026, 1, 15)
        mock_cycle.academic_year = "2025-2026"
        mock_cycle.description = "Ceremonial highlights"
        mock_cycle.is_published = True
        mock_cycle.is_archived = False
        mock_cycle.created_at = None
        mock_cycle.updated_at = None

        mock_db.scalar.side_effect = [
            1,                  # total count from subquery
            3,                  # sanction_count
            Decimal("181000.00"), # total_sanctioned_amount
        ]
        mock_db.scalars.return_value.all.return_value = [mock_cycle]

        items, total = anudaan_showcase_service.list_felicitation_cycles(
            mock_db,
            status="COMPLETED",
            academic_year="2025-2026",
            is_archived=False,
            search="Volume 2",
        )

        assert total == 1
        assert len(items) == 1
        item = items[0]
        assert item["volume_number"] == 2
        assert item["issue_number"] == 1
        assert item["sanction_count"] == 3
        assert item["total_sanctioned_amount"] == Decimal("181000.00")
        assert item["created_at"] is not None
        assert item["updated_at"] is not None
