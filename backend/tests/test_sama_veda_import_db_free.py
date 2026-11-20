import os
import sys
import uuid
import json
from decimal import Decimal
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from tests.safety_guard import enforce_test_environment_safety
enforce_test_environment_safety()

from app.main import app
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.modules.sama_veda.models import (
    ResearchBulletin,
    ResearchAuthor,
    ResearchPublication,
    CamAiProject,
    FellowshipScheme,
    ResearcherSpotlight,
    SamaImportBatch,
)
from app.modules.sama_veda.services.import_service import import_service, CANONICAL_HISTORICAL_DIR
from app.api.dependencies import get_db, get_current_user


def make_mock_user(role_name: str, permissions: list[str]) -> User:
    role = Role(name=role_name)
    role.permissions = [Permission(name=p, resource="sama_veda", action=p.split(":")[-1]) for p in permissions]
    user = User(
        id=uuid.uuid4(),
        email=f"{role_name}@csjmu.ac.in",
        first_name="Test",
        last_name=role_name.capitalize(),
        is_active=True,
    )
    user.roles = [role]
    return user


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# Unit Tests for Import Engine
# -----------------------------------------------------------------------------

def test_parse_inr_amount():
    amt, disp = import_service.parse_inr_amount("₹10,00,000")
    assert amt == Decimal("1000000")
    assert disp == "₹10,00,000"

    amt2, disp2 = import_service.parse_inr_amount("₹4,12,550")
    assert amt2 == Decimal("412550")
    assert disp2 == "₹4,12,550"

    amt3, disp3 = import_service.parse_inr_amount(None)
    assert amt3 is None
    assert disp3 is None


def test_parse_file_content_json_array():
    content = json.dumps([{"title": "Paper 1"}, {"title": "Paper 2"}]).encode("utf-8")
    rows, fmt, errors = import_service.parse_file_content(content, "test.json")
    assert fmt == "json"
    assert len(rows) == 2
    assert len(errors) == 0


def test_parse_file_content_json_wrapped():
    content = json.dumps({"publications": [{"title": "Paper 1"}, {"title": "Paper 2"}]}).encode("utf-8")
    rows, fmt, errors = import_service.parse_file_content(content, "data.json")
    assert fmt == "json"
    assert len(rows) == 2
    assert len(errors) == 0


def test_parse_file_content_csv():
    csv_text = "title,category\nPaper A,Article\nPaper B,Review\n"
    rows, fmt, errors = import_service.parse_file_content(csv_text.encode("utf-8"), "test.csv")
    assert fmt == "csv"
    assert len(rows) == 2
    assert rows[0]["title"] == "Paper A"
    assert rows[1]["category"] == "Review"
    assert len(errors) == 0


def test_parse_file_content_invalid_format():
    rows, fmt, errors = import_service.parse_file_content(b"raw data", "test.unsupported")
    assert len(errors) == 1
    assert "Unsupported file format" in errors[0].message


def test_preview_publications_create_and_skip():
    mock_db = MagicMock()
    # First publication doesn't exist, second exists
    existing_pub = MagicMock()
    existing_pub.id = uuid.uuid4()
    existing_pub.slug = "v2-i1-r002"
    existing_pub.title = "Existing Title"

    mock_db.execute.return_value.scalar_one_or_none.side_effect = [None, None, existing_pub, existing_pub]

    rows = [
        {"title": "New Paper", "slug": "v2-i1-r001"},
        {"title": "Existing Title", "slug": "v2-i1-r002"},
    ]

    items, errors = import_service.preview_publications(mock_db, rows)
    assert len(items) == 2
    assert items[0].action == "create"
    assert items[0].identifier == "v2-i1-r001"
    assert items[1].action == "skip"
    assert len(errors) == 0


def test_preview_publications_missing_title_error():
    mock_db = MagicMock()
    rows = [{"slug": "v2-i1-r001"}]  # Missing title
    items, errors = import_service.preview_publications(mock_db, rows)
    assert len(items) == 1
    assert items[0].action == "fail"
    assert len(errors) == 1
    assert errors[0].field == "title"


def test_preview_authors_detects_scopus_name_conflict():
    mock_db = MagicMock()
    existing_author = MagicMock()
    existing_author.id = uuid.uuid4()
    existing_author.scopus_id = "7003697042"
    existing_author.full_name = "Pramod S Dobal"

    mock_db.execute.return_value.scalar_one_or_none.side_effect = [existing_author, None]

    rows = [
        {"id": "7003697042", "name": "Pramod S. Dobal"}  # Name variation
    ]

    items, errors = import_service.preview_authors(mock_db, rows)
    assert len(items) == 1
    assert items[0].action == "review"
    assert "Identity discrepancy" in items[0].reason
    assert items[0].conflict_details["existing_name"] == "Pramod S Dobal"


# -----------------------------------------------------------------------------
# Historical Bundle Simulation Test (Read-only / Dry-run)
# -----------------------------------------------------------------------------

def test_historical_bundle_dry_run_against_source():
    if not os.path.isdir(CANONICAL_HISTORICAL_DIR):
        pytest.skip("Historical repository directory not present on this machine")

    mock_db = MagicMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None
    mock_db.execute.return_value.scalars.return_value.all.return_value = []

    report = import_service.run_historical_bundle(
        db=mock_db,
        source_dir=CANONICAL_HISTORICAL_DIR,
        dry_run=True,
    )

    assert report["dry_run"] is True
    assert "entities" in report
    assert report["entities"]["bulletins"]["created"] == 2
    assert report["entities"]["publications"]["created"] == 207
    assert report["entities"]["cam_projects"]["created"] == 6
    assert report["entities"]["fellowships"]["created"] == 6
    assert report["entities"]["spotlights"]["created"] == 5
    # Ensure dry_run added SamaImportBatch ledger entry
    assert mock_db.add.called
    assert mock_db.commit.called


# -----------------------------------------------------------------------------
# API Endpoints & RBAC Security Tests
# -----------------------------------------------------------------------------

@pytest.fixture
def test_client():
    return TestClient(app)


def test_import_preview_endpoint_authorized(test_client):
    admin_user = make_mock_user("sama_content_admin", ["sama:read", "sama:content:import"])

    fake_preview = MagicMock()
    fake_preview.model_dump.return_value = {
        "batch_id": str(uuid.uuid4()),
        "batch_number": "IMP-PUB-20261026-TEST01",
        "total_rows": 2,
        "create_count": 2,
        "skip_count": 0,
    }

    mock_db = MagicMock()
    bulletin_id = uuid.uuid4()
    fake_bulletin = MagicMock()
    fake_bulletin.id = bulletin_id
    mock_db.execute.return_value.scalar_one_or_none.return_value = fake_bulletin

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: admin_user

    with patch.object(import_service, "preview_batch", return_value=fake_preview):
        resp = test_client.post(
            "/api/admin/sama/import/preview",
            data={"entity_type": "publications", "bulletin_id": str(bulletin_id)},
            files={"file": ("test.json", b'[{"title": "Paper 1"}]', "application/json")},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["create_count"] == 2


def test_import_preview_endpoint_editor_forbidden(test_client):
    """
    sama_content_editor must be rejected with 403 Forbidden because they lack 'sama:content:import'.
    """
    editor_user = make_mock_user("sama_content_editor", ["sama:read", "sama:content:edit"])

    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: editor_user

    resp = test_client.post(
        "/api/admin/sama/import/preview",
        data={"entity_type": "publications"},
        files={"file": ("test.json", b'[{"title": "Paper 1"}]', "application/json")},
    )
    assert resp.status_code == 403
    assert "Missing required permission: 'sama:content:import'" in resp.json()["message"]


def test_import_execute_endpoint(test_client):
    super_admin = make_mock_user("super_admin", ["sama:read", "sama:content:import"])

    batch_id = uuid.uuid4()
    fake_exec = MagicMock()
    fake_exec.model_dump.return_value = {
        "batch_id": str(batch_id),
        "batch_number": "IMP-PUB-20261026-TEST01",
        "status": "completed",
        "created_count": 5,
    }

    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: super_admin

    with patch.object(import_service, "execute_batch", return_value=fake_exec):
        resp = test_client.post(f"/api/admin/sama/import/execute/{batch_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["status"] == "completed"


def test_get_import_batches_endpoint(test_client):
    read_user = make_mock_user("sama_content_editor", ["sama:read"])

    mock_db = MagicMock()
    mock_db.scalar.return_value = 1
    fake_batch = MagicMock()
    fake_batch.id = uuid.uuid4()
    fake_batch.batch_number = "IMP-BUNDLE-001"
    fake_batch.entity_type = "historical_bundle"
    fake_batch.source_filename = "research.felicitation.csjmu"
    fake_batch.file_format = "bundle"
    fake_batch.mode = "preview"
    fake_batch.status = "previewed"
    fake_batch.total_rows = 226
    fake_batch.created_count = 226
    fake_batch.updated_count = 0
    fake_batch.skipped_count = 0
    fake_batch.failed_count = 0
    fake_batch.review_count = 0
    fake_batch.executed_at = None
    fake_batch.created_at = None

    mock_db.execute.return_value.scalars.return_value.all.return_value = [fake_batch]

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: read_user

    resp = test_client.get("/api/admin/sama/import/batches")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["data"]["total"] == 1
    assert data["data"]["items"][0]["batch_number"] == "IMP-BUNDLE-001"

    app.dependency_overrides.clear()


def test_execute_batch_records_audit_event_cleanly():
    mock_db = MagicMock()
    batch_id = uuid.uuid4()
    user_id = uuid.uuid4()
    bulletin_id = uuid.uuid4()

    fake_bulletin = MagicMock()
    fake_bulletin.id = bulletin_id
    fake_bulletin.publication_count = 0

    fake_batch = MagicMock()
    fake_batch.id = batch_id
    fake_batch.batch_number = 'IMP-PUB-20261107-123456'
    fake_batch.entity_type = 'publications'
    fake_batch.status = 'previewed'
    fake_batch.raw_payload = []
    fake_batch.total_rows = 0
    fake_batch.reconciliation_report = {
        "items": [],
        "bulletin_id": str(bulletin_id),
    }

    mock_db.execute.return_value.scalar_one_or_none.side_effect = [fake_batch, fake_bulletin]

    res = import_service.execute_batch(
        db=mock_db,
        batch_id=str(batch_id),
        user_id=user_id,
        request_context={'client_ip': '127.0.0.1'},
    )

    assert res.status == 'completed'
    assert res.batch_id == batch_id
    assert res.audit_event_id is not None
    assert mock_db.commit.called


# =============================================================================
# BULLETIN-AWARE PUBLICATIONS BULK IMPORT TESTS
# =============================================================================

def test_preview_publications_missing_bulletin_rejected(test_client):
    """Missing bulletin ID for publications import is rejected with 400 Bad Request."""
    admin_user = make_mock_user("sama_content_admin", ["sama:read", "sama:content:import"])
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: admin_user

    resp = test_client.post(
        "/api/admin/sama/import/preview",
        data={"entity_type": "publications"},
        files={"file": ("papers.json", b'[{"title": "Paper 1"}]', "application/json")},
    )
    assert resp.status_code == 400
    err_text = resp.json().get("detail") or resp.json().get("message") or ""
    assert "Target bulletin ID is required" in err_text


def test_preview_publications_invalid_bulletin_format_rejected(test_client):
    """Malformed bulletin UUID is rejected with 400 Bad Request."""
    admin_user = make_mock_user("sama_content_admin", ["sama:read", "sama:content:import"])
    app.dependency_overrides[get_db] = lambda: MagicMock()
    app.dependency_overrides[get_current_user] = lambda: admin_user

    resp = test_client.post(
        "/api/admin/sama/import/preview",
        data={"entity_type": "publications", "bulletin_id": "not-a-uuid"},
        files={"file": ("papers.json", b'[{"title": "Paper 1"}]', "application/json")},
    )
    assert resp.status_code == 400
    err_text = resp.json().get("detail") or resp.json().get("message") or ""
    assert "Invalid bulletin ID format" in err_text


def test_preview_publications_nonexistent_bulletin_rejected(test_client):
    """Non-existent bulletin UUID is rejected with 404 Not Found."""
    admin_user = make_mock_user("sama_content_admin", ["sama:read", "sama:content:import"])
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: admin_user

    missing_id = str(uuid.uuid4())
    resp = test_client.post(
        "/api/admin/sama/import/preview",
        data={"entity_type": "publications", "bulletin_id": missing_id},
        files={"file": ("papers.json", b'[{"title": "Paper 1"}]', "application/json")},
    )
    assert resp.status_code == 404
    err_text = resp.json().get("detail") or resp.json().get("message") or ""
    assert f"Target bulletin with ID '{missing_id}' does not exist" in err_text


def test_preview_publications_valid_bulletin_accepted_and_context_bound():
    """Valid bulletin is bound to the preview items and reconciliation report."""
    mock_db = MagicMock()
    bulletin_id = uuid.uuid4()
    mock_bulletin = ResearchBulletin(
        id=bulletin_id,
        volume_number=2,
        issue_number=1,
        title="Volume 2 • Issue 1",
        publication_period="2026",
        file_path="storage/test.pdf",
    )
    # 1st execute for bulletin lookup, then no existing publications
    mock_db.execute.return_value.scalar_one_or_none.side_effect = [mock_bulletin, None, None]

    content = json.dumps([
        {"title": "Paper A", "source_journal": "Nature", "category": "Article"},
        {"title": "Paper B", "source_journal": "Science", "category": "Review", "bulletin_id": "malicious-client-id"},
    ]).encode("utf-8")

    preview = import_service.preview_batch(
        db=mock_db,
        entity_type="publications",
        filename="papers.json",
        content_bytes=content,
        bulletin_id=bulletin_id,
    )

    assert preview.target_bulletin_id == bulletin_id
    assert "Volume 2 — Issue 1" in preview.target_bulletin_title
    assert preview.create_count == 2
    for item in preview.items:
        assert item.action == "create"
        # Overrides any file-provided bulletin_id with validated target bulletin ID
        assert item.record_summary["bulletin_id"] == str(bulletin_id)


def test_execute_batch_assigns_selected_bulletin_to_all_publications():
    """Every persisted publication in a batch receives the target bulletin ID."""
    mock_db = MagicMock()
    batch_id = uuid.uuid4()
    user_id = uuid.uuid4()
    bulletin_id = uuid.uuid4()

    mock_bulletin = ResearchBulletin(
        id=bulletin_id,
        volume_number=2,
        issue_number=1,
        title="Volume 2 • Issue 1",
        publication_period="2026",
        file_path="storage/test.pdf",
    )
    mock_bulletin.publication_count = 10

    fake_batch = SamaImportBatch(
        id=batch_id,
        batch_number="IMP-PUB-20261119-001",
        entity_type="publications",
        source_filename="papers.json",
        file_format="json",
        mode="preview",
        status="previewed",
        total_rows=2,
        reconciliation_report={
            "items": [
                {
                    "action": "create",
                    "identifier": "pub-1",
                    "reason": "New publication record",
                    "record_summary": {
                        "title": "Quantum ML in Agriculture",
                        "slug": "qml-agri-01",
                        "source_journal": "IEEE",
                        "category": "Article",
                        "serial_no": 1,
                        "bulletin_id": "ignored-file-id",
                    },
                },
                {
                    "action": "create",
                    "identifier": "pub-2",
                    "reason": "New publication record",
                    "record_summary": {
                        "title": "Nanocatalysts for Hydrogen",
                        "slug": "nano-h2-02",
                        "source_journal": "JACS",
                        "category": "Article",
                        "serial_no": 2,
                    },
                },
            ],
            "bulletin_id": str(bulletin_id),
            "target_bulletin_title": "Volume 2 — Issue 1",
        },
    )

    mock_db.execute.return_value.scalar_one_or_none.side_effect = [fake_batch, mock_bulletin]

    added_objects = []
    def track_add(obj):
        added_objects.append(obj)
    mock_db.add.side_effect = track_add

    res = import_service.execute_batch(
        db=mock_db,
        batch_id=batch_id,
        user_id=user_id,
        bulletin_id=bulletin_id,
    )

    assert res.status == "completed"
    assert res.created_count == 2
    assert res.target_bulletin_id == bulletin_id

    # Verify all added publications strictly have target bulletin_id
    pubs_added = [o for o in added_objects if isinstance(o, ResearchPublication)]
    assert len(pubs_added) == 2
    for pub in pubs_added:
        assert pub.bulletin_id == bulletin_id
        assert pub.bulletin_id is not None
        assert pub.status == "draft"

    # Verify bulletin publication_count is NOT mutated by draft imports (preserves archival count integrity)
    assert mock_bulletin.publication_count == 10
    assert mock_db.commit.called


def test_execute_batch_mismatched_bulletin_context_rejected():
    """Attempting to execute with a different bulletin than previewed raises ValueError."""
    mock_db = MagicMock()
    batch_id = uuid.uuid4()
    preview_bulletin_id = uuid.uuid4()
    different_bulletin_id = uuid.uuid4()

    fake_batch = SamaImportBatch(
        id=batch_id,
        batch_number="IMP-PUB-20261119-002",
        entity_type="publications",
        source_filename="papers.json",
        file_format="json",
        mode="preview",
        status="previewed",
        total_rows=1,
        reconciliation_report={
            "items": [],
            "bulletin_id": str(preview_bulletin_id),
        },
    )
    mock_db.execute.return_value.scalar_one_or_none.return_value = fake_batch

    with pytest.raises(ValueError, match="does not match previewed bulletin context"):
        import_service.execute_batch(
            db=mock_db,
            batch_id=batch_id,
            bulletin_id=different_bulletin_id,
        )


def test_execute_batch_atomic_rollback_on_failure():
    """If an error occurs during publication persistence, the entire transaction rolls back."""
    mock_db = MagicMock()
    batch_id = uuid.uuid4()
    bulletin_id = uuid.uuid4()

    mock_bulletin = ResearchBulletin(
        id=bulletin_id,
        volume_number=2,
        issue_number=1,
        title="Volume 2 • Issue 1",
        publication_period="2026",
        file_path="storage/test.pdf",
    )

    fake_batch = SamaImportBatch(
        id=batch_id,
        batch_number="IMP-PUB-20261119-003",
        entity_type="publications",
        source_filename="papers.json",
        file_format="json",
        mode="preview",
        status="previewed",
        total_rows=2,
        reconciliation_report={
            "items": [
                {
                    "action": "create",
                    "identifier": "pub-1",
                    "record_summary": {"title": "Paper 1"},
                },
            ],
            "bulletin_id": str(bulletin_id),
        },
    )

    mock_db.execute.return_value.scalar_one_or_none.side_effect = [fake_batch, mock_bulletin]
    # Simulate DB error on commit
    mock_db.commit.side_effect = [Exception("Database foreign key constraint violation"), None]

    with pytest.raises(RuntimeError, match="Import execution failed and was rolled back"):
        import_service.execute_batch(
            db=mock_db,
            batch_id=batch_id,
        )

    assert mock_db.rollback.called
    assert fake_batch.status == "failed"


def test_non_publication_imports_unaffected_without_bulletin():
    """Authors, CamProjects, Fellowships do not require or use bulletin_id."""
    mock_db = MagicMock()
    mock_db.execute.return_value.scalar_one_or_none.return_value = None

    author_content = json.dumps([
        {"name": "Dr. Namita Gupta", "scopus_id": "57218940100"},
    ]).encode("utf-8")

    preview = import_service.preview_batch(
        db=mock_db,
        entity_type="authors",
        filename="authors.json",
        content_bytes=author_content,
    )

    assert preview.entity_type == "authors"
    assert preview.target_bulletin_id is None
    assert preview.create_count == 1
    assert preview.items[0].record_summary["name"] == "Dr. Namita Gupta"
