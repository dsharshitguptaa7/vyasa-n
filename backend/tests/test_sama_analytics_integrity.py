"""
Data Integrity and Aggregation Engine Automated Test Suite for Sama Veda
Research Intelligence & Analytics Overview.

Verifies:
1. Publication category aggregation and normalization.
2. Publication totals versus category totals reconciliation.
3. Category normalization across variations and unrecognized types.
4. Yearly publication aggregation, timestamp fallbacks, and invalid year exclusion.
5. Authoritative Verified Faculty criteria vs Provisional Scholars.
6. Directory vs Overview verified count consistency.
7. Bulletin issue counts (actual cataloged records vs print cover metadata).
8. Filtered versus unfiltered counter isolation.
9. Empty dataset resilience (zero division protection).
10. API endpoint contract and response schema compliance.
"""

import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.models.base import Base
# Ensure all models are imported so Base.metadata contains all tables
import app.modules.sama_veda.models
from app.modules.sama_veda.models.publication import ResearchPublication, PublicationAuthor
from app.modules.sama_veda.models.author import ResearchAuthor
from app.modules.sama_veda.models.bulletin import ResearchBulletin
from app.modules.sama_veda.models.cam_project import CamAiProject
from app.modules.sama_veda.models.fellowship import FellowshipScheme
from app.modules.sama_veda.services.analytics_service import (
    SamaAnalyticsService,
    normalize_publication_category,
)
from app.main import app
from app.api.dependencies import get_db


@pytest.fixture
def in_memory_db():
    """Isolated SQLite database session for unit testing aggregation logic."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


# ============================================================================
# 1. CATEGORY NORMALIZATION TESTS
# ============================================================================

def test_category_normalization_rules():
    assert normalize_publication_category("article") == "Article"
    assert normalize_publication_category("Articles") == "Article"
    assert normalize_publication_category("  journal article  ") == "Article"
    assert normalize_publication_category("review") == "Review"
    assert normalize_publication_category("Review Article") == "Review"
    assert normalize_publication_category("book chapter") == "Book Chapter"
    assert normalize_publication_category("chapter") == "Book Chapter"
    assert normalize_publication_category("conference paper") == "Conference Paper"
    assert normalize_publication_category("proceedings") == "Conference Paper"
    assert normalize_publication_category("book") == "Book"
    assert normalize_publication_category("") == "Uncategorized"
    assert normalize_publication_category(None) == "Uncategorized"
    assert normalize_publication_category("special report") == "Special Report"


# ============================================================================
# 2. CATEGORY AGGREGATION & RECONCILIATION TESTS
# ============================================================================

def test_category_aggregation_reconciles_with_total(in_memory_db):
    bulletin = ResearchBulletin(
        id=uuid.uuid4(),
        volume_number=1,
        issue_number=1,
        title="Vol 1 Iss 1",
        publication_period="Jan - Mar 2026",
        file_path="bulletins/v1-i1.pdf",
        publication_count=10,
        status="published",
        is_active=True,
    )
    in_memory_db.add(bulletin)
    in_memory_db.commit()

    # Seed 5 published articles, 3 reviews, 2 book chapters, and 2 drafts (which must be excluded)
    test_specs = [
        ("Article", "published"),
        ("article", "published"),
        ("JOURNAL ARTICLE", "published"),
        ("Article", "published"),
        ("Article", "published"),
        ("Review", "published"),
        ("review", "published"),
        ("Review Article", "published"),
        ("Book Chapter", "published"),
        ("chapter", "published"),
        ("Article", "draft"),       # EXCLUDED
        ("Review", "in_review"),    # EXCLUDED
    ]

    for idx, (cat, stat) in enumerate(test_specs):
        pub = ResearchPublication(
            id=uuid.uuid4(),
            bulletin_id=bulletin.id,
            serial_no=idx + 1,
            slug=f"slug-{idx + 1}",
            title=f"Publication {idx + 1}",
            source_journal="CSJMU Journal",
            category=cat,
            author_display="Test Author",
            status=stat,
            created_at=datetime(2026, 1, 15, tzinfo=timezone.utc),
        )
        in_memory_db.add(pub)
    in_memory_db.commit()

    total_eligible = SamaAnalyticsService.get_total_eligible_publications(in_memory_db)
    assert total_eligible == 10  # 12 total minus 2 drafts

    distribution = SamaAnalyticsService.get_publication_category_distribution(in_memory_db)
    category_counts = {item["name"]: item["count"] for item in distribution}

    assert category_counts["Article"] == 5
    assert category_counts["Review"] == 3
    assert category_counts["Book Chapter"] == 2

    # Reconciles exactly: Sum of category counts == total eligible publications
    assert sum(category_counts.values()) == total_eligible
    # Percentage sum equals 100%
    assert round(sum(item["percentage"] for item in distribution)) == 100


# ============================================================================
# 3. RESEARCHER VERIFICATION CRITERIA & INTEGRITY
# ============================================================================

def test_researcher_verification_metrics(in_memory_db):
    authors = [
        ResearchAuthor(
            id=uuid.uuid4(),
            full_name="Dr. Verified One",
            scopus_id="111111",
            is_verified=True,
        ),
        ResearchAuthor(
            id=uuid.uuid4(),
            full_name="Dr. Verified Two",
            scopus_id="222222",
            is_verified=True,
        ),
        ResearchAuthor(
            id=uuid.uuid4(),
            full_name="Scholar Provisional",
            scopus_id=None,
            is_verified=False,
        ),
        ResearchAuthor(
            id=uuid.uuid4(),
            full_name="Scholar Unverified",
            scopus_id="999999",  # Presence of Scopus ID does NOT infer verification!
            is_verified=False,
        ),
    ]
    in_memory_db.add_all(authors)
    in_memory_db.commit()

    metrics = SamaAnalyticsService.get_researcher_verification_metrics(in_memory_db)
    assert metrics["total_researchers"] == 4
    assert metrics["verified_faculty"] == 2
    assert metrics["provisional_scholars"] == 2
    assert metrics["verified_faculty"] + metrics["provisional_scholars"] == metrics["total_researchers"]


# ============================================================================
# 4. BULLETIN ISSUE ASSOCIATIONS & RECONCILIATION
# ============================================================================

def test_bulletin_issue_actual_vs_archival_counts(in_memory_db):
    b1 = ResearchBulletin(
        id=uuid.uuid4(),
        volume_number=2,
        issue_number=1,
        title="Vol 2 Iss 1",
        publication_period="Jan - Mar 2026",
        file_path="b1.pdf",
        publication_count=91,  # Archival print claim
        status="published",
        is_active=True,
    )
    b2 = ResearchBulletin(
        id=uuid.uuid4(),
        volume_number=2,
        issue_number=2,
        title="Vol 2 Iss 2",
        publication_period="Apr - Jun 2026",
        file_path="b2.pdf",
        publication_count=197,  # Archival print claim
        status="published",
        is_active=True,
    )
    in_memory_db.add_all([b1, b2])
    in_memory_db.commit()

    # Add 3 publications to b1, 0 to b2
    for i in range(3):
        pub = ResearchPublication(
            id=uuid.uuid4(),
            bulletin_id=b1.id,
            serial_no=i + 1,
            slug=f"b1-pub-{i+1}",
            title=f"Paper {i+1}",
            source_journal="Journal",
            category="Article",
            author_display="Author",
            status="published",
            created_at=datetime(2026, 2, 1, tzinfo=timezone.utc),
        )
        in_memory_db.add(pub)
    in_memory_db.commit()

    bulletin_metrics = SamaAnalyticsService.get_bulletin_issue_metrics(in_memory_db)
    b1_metric = next(b for b in bulletin_metrics if b["id"] == str(b1.id))
    b2_metric = next(b for b in bulletin_metrics if b["id"] == str(b2.id))

    # Actual publication count must reflect live database associations
    assert b1_metric["actual_publication_count"] == 3
    assert b1_metric["archival_count"] == 91

    assert b2_metric["actual_publication_count"] == 0
    assert b2_metric["archival_count"] == 197

    # Sum of actual counts reconciles with total publications
    total_actual = sum(b["actual_publication_count"] for b in bulletin_metrics)
    assert total_actual == SamaAnalyticsService.get_total_eligible_publications(in_memory_db)


# ============================================================================
# 5. EMPTY DATASET BEHAVIOR
# ============================================================================

def test_empty_dataset_graceful_handling(in_memory_db):
    overview = SamaAnalyticsService.get_full_overview_analytics(in_memory_db)
    assert overview["summary"]["total_publications"] == 0
    assert overview["summary"]["total_researchers"] == 0
    assert overview["summary"]["verified_faculty"] == 0
    assert overview["summary"]["provisional_scholars"] == 0
    assert overview["category_distribution"] == []
    assert overview["yearly_trends"] == []
    assert overview["reconciliation"]["categories_reconciled"] is True
    assert overview["reconciliation"]["bulletins_reconciled"] is True


# ============================================================================
# 6. API CONTRACT TESTS
# ============================================================================

def test_analytics_overview_api_endpoint(in_memory_db):
    app.dependency_overrides[get_db] = lambda: in_memory_db
    client = TestClient(app)

    response = client.get("/api/modules/sama-veda/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "summary" in data["data"]
    assert "category_distribution" in data["data"]
    assert "yearly_trends" in data["data"]
    assert "researcher_breakdown" in data["data"]
    assert "reconciliation" in data["data"]

    app.dependency_overrides.clear()


def test_authors_endpoint_telemetry_metadata(in_memory_db):
    # Seed 3 authors (1 verified, 2 provisional)
    in_memory_db.add_all([
        ResearchAuthor(id=uuid.uuid4(), full_name="Alpha", department="Physics", is_verified=True),
        ResearchAuthor(id=uuid.uuid4(), full_name="Beta", department="Physics", is_verified=False),
        ResearchAuthor(id=uuid.uuid4(), full_name="Gamma", department="Chemistry", is_verified=False),
    ])
    in_memory_db.commit()

    app.dependency_overrides[get_db] = lambda: in_memory_db
    client = TestClient(app)

    # 1. Unfiltered request with pagination limit=2
    res_page1 = client.get("/api/modules/sama-veda/authors?skip=0&limit=2")
    assert res_page1.status_code == 200
    data1 = res_page1.json()["data"]
    assert len(data1["items"]) == 2
    assert data1["total"] == 3
    assert data1["verified_count"] == 1
    assert data1["provisional_count"] == 2
    assert data1["global_total"] == 3
    assert data1["global_verified_count"] == 1

    # 2. Filtered request by department="Chemistry"
    res_filter = client.get("/api/modules/sama-veda/authors?department=Chemistry")
    assert res_filter.status_code == 200
    data_f = res_filter.json()["data"]
    assert data_f["total"] == 1
    assert data_f["verified_count"] == 0
    assert data_f["provisional_count"] == 1
    # Global counters remain preserved!
    assert data_f["global_total"] == 3
    assert data_f["global_verified_count"] == 1

    app.dependency_overrides.clear()


def test_yearly_aggregation_and_timestamp_fallbacks(in_memory_db):
    bulletin = ResearchBulletin(
        id=uuid.uuid4(),
        volume_number=1,
        issue_number=1,
        title="Vol 1 Iss 1",
        publication_period="2024 - 2026",
        file_path="bulletins/v1-i1.pdf",
        status="published",
        is_active=True,
    )
    in_memory_db.add(bulletin)
    in_memory_db.commit()

    # 1. Pub with explicit published_at in 2024
    p1 = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=bulletin.id,
        serial_no=1,
        slug="pub-2024",
        title="2024 Paper",
        source_journal="Journal",
        category="Article",
        author_display="Author A",
        status="published",
        published_at=datetime(2024, 6, 1, tzinfo=timezone.utc),
        created_at=datetime(2025, 1, 1, tzinfo=timezone.utc),
    )
    # 2. Pub with published_at None, created_at in 2025 (fallback to created_at)
    p2 = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=bulletin.id,
        serial_no=2,
        slug="pub-2025",
        title="2025 Paper",
        source_journal="Journal",
        category="Review",
        author_display="Author B",
        status="published",
        published_at=None,
        created_at=datetime(2025, 3, 15, tzinfo=timezone.utc),
    )
    # 3. Pub in 2026
    p3 = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=bulletin.id,
        serial_no=3,
        slug="pub-2026",
        title="2026 Paper",
        source_journal="Journal",
        category="Article",
        author_display="Author C",
        status="published",
        published_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
    )
    # 4. Draft publication in 2026 (MUST NOT be counted)
    p4 = ResearchPublication(
        id=uuid.uuid4(),
        bulletin_id=bulletin.id,
        serial_no=4,
        slug="draft-2026",
        title="Draft Paper",
        source_journal="Journal",
        category="Article",
        author_display="Author D",
        status="draft",
        published_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
        created_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
    )
    in_memory_db.add_all([p1, p2, p3, p4])
    in_memory_db.commit()

    trends = SamaAnalyticsService.get_publication_yearly_trends(in_memory_db)
    trend_map = {t["year"]: t["count"] for t in trends}

    assert trend_map["2024"] == 1
    assert trend_map["2025"] == 1
    assert trend_map["2026"] == 1
    assert sum(trend_map.values()) == 3


def test_overview_and_directory_metric_reconciliation(in_memory_db):
    """
    Verifies that the Overview analytics service and Directory endpoint
    derive their verification metrics from the identical authoritative source.
    """
    for i in range(5):
        in_memory_db.add(
            ResearchAuthor(
                id=uuid.uuid4(),
                full_name=f"Verified Prof {i}",
                scopus_id=f"SCOPUS_{i}",
                is_verified=True,
            )
        )
    for i in range(15):
        in_memory_db.add(
            ResearchAuthor(
                id=uuid.uuid4(),
                full_name=f"Provisional Scholar {i}",
                scopus_id=None,
                is_verified=False,
            )
        )
    in_memory_db.commit()

    # 1. Overview analytics calculation
    overview = SamaAnalyticsService.get_full_overview_analytics(in_memory_db)
    assert overview["summary"]["total_researchers"] == 20
    assert overview["summary"]["verified_faculty"] == 5
    assert overview["summary"]["provisional_scholars"] == 15

    # 2. Directory API response
    app.dependency_overrides[get_db] = lambda: in_memory_db
    client = TestClient(app)
    res = client.get("/api/modules/sama-veda/authors?limit=5")
    assert res.status_code == 200
    dir_data = res.json()["data"]

    # Even though only 5 items are returned in page slice, directory telemetry matches overview exactly
    assert dir_data["global_total"] == overview["summary"]["total_researchers"]
    assert dir_data["global_verified_count"] == overview["summary"]["verified_faculty"]
    assert dir_data["global_provisional_count"] == overview["summary"]["provisional_scholars"]

    app.dependency_overrides.clear()
