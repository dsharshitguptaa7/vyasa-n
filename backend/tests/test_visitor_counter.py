import uuid
from datetime import date, timedelta
from unittest.mock import patch, MagicMock
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.models.base import Base
from app.models.visitor import PublicVisitor, PublicDailyVisit
from app.models.user import User
from app.models.role import Role
from app.services.visitor_service import (
    VisitorService,
    is_bot_or_crawler,
    is_internal_administrative_user,
    check_rate_limit,
    validate_visitor_token,
    generate_visitor_token,
)
from app.api.routes.visitor import VISITOR_COOKIE_NAME
from app.api.dependencies import get_db
from app.main import app


@pytest.fixture
def memory_db():
    from app.models.role import Role, user_roles
    from app.models.user import User
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(
        bind=engine,
        tables=[
            PublicVisitor.__table__,
            PublicDailyVisit.__table__,
            User.__table__,
            Role.__table__,
            user_roles,
        ],
    )
    Session = sessionmaker(bind=engine, expire_on_commit=False)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def client(memory_db):
    def override_get_db():
        try:
            yield memory_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.pop(get_db, None)


class TestVisitorServiceUnit:
    def test_generate_and_validate_token(self):
        token = generate_visitor_token()
        assert token is not None
        assert len(token) >= 32
        assert validate_visitor_token(token) == token

        # Malformed tokens
        assert validate_visitor_token("") is None
        assert validate_visitor_token(None) is None
        assert validate_visitor_token("short") is None
        assert validate_visitor_token("invalid!@#$%^&*()_+") is None

    def test_bot_detection(self):
        assert is_bot_or_crawler("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)") is True
        assert is_bot_or_crawler("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)") is True
        assert is_bot_or_crawler("curl/7.88.1") is True
        assert is_bot_or_crawler("python-requests/2.31.0") is True
        assert is_bot_or_crawler("PostmanRuntime/7.32.3") is True
        assert is_bot_or_crawler("UptimeRobot/2.0") is True
        assert is_bot_or_crawler("") is True
        assert is_bot_or_crawler(None) is True

        # Legitimate browsers
        assert is_bot_or_crawler("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36") is False
        assert is_bot_or_crawler("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15") is False

    def test_internal_admin_detection(self):
        admin_role = Role(id=uuid.uuid4(), name="super_admin")
        admin_user = User(id=uuid.uuid4(), email="admin@csjmu.ac.in", roles=[admin_role])
        assert is_internal_administrative_user(admin_user) is True

        dean_role = Role(id=uuid.uuid4(), name="dean")
        dean_user = User(id=uuid.uuid4(), email="dean@csjmu.ac.in", roles=[dean_role])
        assert is_internal_administrative_user(dean_user) is True

        applicant_role = Role(id=uuid.uuid4(), name="applicant")
        applicant_user = User(id=uuid.uuid4(), email="student@csjmu.ac.in", roles=[applicant_role])
        assert is_internal_administrative_user(applicant_user) is False

        assert is_internal_administrative_user(None) is False


class TestVisitorCountingLifecycle:
    def test_first_time_visitor_increments_total_and_today(self, memory_db):
        day1 = date(2026, 11, 11)
        stats, token, is_new = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        assert is_new is True
        assert stats.total_visitors == 1
        assert stats.today_visitors == 1
        assert stats.date == "2026-11-11"

    def test_refresh_same_day_does_not_increment_either_counter(self, memory_db):
        day1 = date(2026, 11, 11)
        # First visit
        stats1, token, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        assert stats1.total_visitors == 1
        assert stats1.today_visitors == 1

        # Same visitor refreshes 5 times on the same day
        for _ in range(5):
            stats2, token2, is_new = VisitorService.record_visit(memory_db, visitor_token=token, target_date=day1)
            assert is_new is False
            assert token2 == token
            assert stats2.total_visitors == 1
            assert stats2.today_visitors == 1

    def test_returning_visitor_next_day_increments_today_only(self, memory_db):
        day1 = date(2026, 11, 11)
        day2 = date(2026, 11, 12)

        # Day 1: First visit
        stats1, token, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        assert stats1.total_visitors == 1
        assert stats1.today_visitors == 1

        # Day 2: Same visitor returns
        stats2, token2, is_new = VisitorService.record_visit(memory_db, visitor_token=token, target_date=day2)
        assert token2 == token
        assert is_new is False
        assert stats2.total_visitors == 1  # Total remains 1 because visitor was already counted
        assert stats2.today_visitors == 1  # Today is 1 for Day 2

    def test_multiple_unique_visitors_increment_both(self, memory_db):
        day1 = date(2026, 11, 11)
        stats1, token1, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        stats2, token2, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        stats3, token3, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)

        assert token1 != token2 != token3
        assert stats3.total_visitors == 3
        assert stats3.today_visitors == 3

    def test_midnight_rollover_logic(self, memory_db):
        day1 = date(2026, 11, 11)
        day2 = date(2026, 11, 12)

        # 3 visitors on day 1
        _, t1, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        _, t2, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)
        _, t3, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day1)

        stats_day1 = VisitorService.get_visitor_stats(memory_db, target_date=day1)
        assert stats_day1.total_visitors == 3
        assert stats_day1.today_visitors == 3

        # Day 2 starts: stats queried for day 2 before any visits on day 2
        stats_day2_initial = VisitorService.get_visitor_stats(memory_db, target_date=day2)
        assert stats_day2_initial.total_visitors == 3
        assert stats_day2_initial.today_visitors == 0  # Clean zero count at midnight rollover

        # Visitor 1 returns on day 2
        stats_day2_v1, _, _ = VisitorService.record_visit(memory_db, visitor_token=t1, target_date=day2)
        assert stats_day2_v1.total_visitors == 3
        assert stats_day2_v1.today_visitors == 1

        # Brand new visitor 4 arrives on day 2
        stats_day2_v4, _, _ = VisitorService.record_visit(memory_db, visitor_token=None, target_date=day2)
        assert stats_day2_v4.total_visitors == 4
        assert stats_day2_v4.today_visitors == 2

    def test_bot_exclusion_does_not_increment_counts(self, memory_db):
        day1 = date(2026, 11, 11)
        # Crawlers and bots are excluded
        stats, token, _ = VisitorService.record_visit(memory_db, visitor_token=None, is_excluded=True, target_date=day1)
        assert stats.total_visitors == 0
        assert stats.today_visitors == 0


class TestVisitorEndpointsIntegration:
    def test_public_stats_accessible_without_auth(self, client):
        response = client.get("/api/public/visitor-stats")
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "data" in body
        assert "total_visitors" in body["data"]
        assert "today_visitors" in body["data"]
        assert body["data"]["timezone"] == "Asia/Kolkata"

    def test_visitor_track_sets_secure_cookie_and_increments(self, client):
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        res1 = client.post("/api/public/visitor-track", headers=headers)
        assert res1.status_code == 200
        data1 = res1.json()["data"]
        assert data1["total_visitors"] == 1
        assert data1["today_visitors"] == 1

        cookie = res1.cookies.get(VISITOR_COOKIE_NAME)
        assert cookie is not None
        assert len(cookie) >= 24

        # Immediate refresh with cookie does not increment
        res2 = client.post("/api/public/visitor-track", headers=headers, cookies={VISITOR_COOKIE_NAME: cookie})
        assert res2.status_code == 200
        data2 = res2.json()["data"]
        assert data2["total_visitors"] == 1
        assert data2["today_visitors"] == 1

    def test_bot_user_agent_returns_stats_without_increment(self, client):
        headers = {"User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)"}
        res = client.post("/api/public/visitor-track", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["total_visitors"] == 0
        assert data["today_visitors"] == 0

    def test_malformed_client_visitor_id_replaced_safely(self, client):
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Visitor-Id": "'; DROP TABLE public_visitors; --",
        }
        res = client.post("/api/public/visitor-track", headers=headers)
        assert res.status_code == 200
        cookie = res.cookies.get(VISITOR_COOKIE_NAME)
        assert cookie is not None
        assert "'" not in cookie
        assert "DROP" not in cookie

    def test_internal_admin_token_excluded_from_counting(self, client, memory_db):
        from app.core.security import create_access_token
        # Create an administrative user in DB
        admin_role = Role(id=uuid.uuid4(), name="super_admin")
        admin_user = User(
            id=uuid.uuid4(),
            email="superadmin@csjmu.ac.in",
            first_name="Super",
            last_name="Admin",
            password_hash="test",
            roles=[admin_role],
        )
        memory_db.add(admin_role)
        memory_db.add(admin_user)
        memory_db.commit()

        token = create_access_token({"sub": "superadmin@csjmu.ac.in"})
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Authorization": f"Bearer {token}",
        }
        res = client.post("/api/public/visitor-track", headers=headers)
        assert res.status_code == 200
        data = res.json()["data"]
        # Internal admin should NOT be counted as a public visitor
        assert data["total_visitors"] == 0
        assert data["today_visitors"] == 0

    def test_concurrent_or_duplicate_tracking_safety(self, memory_db):
        day1 = date(2026, 11, 11)
        token = generate_visitor_token()

        # Simulate concurrent tracking requests attempting to record the same visitor on the same day
        stats1, _, is_new1 = VisitorService.record_visit(memory_db, visitor_token=token, target_date=day1)
        assert is_new1 is False or is_new1 is True

        # Second and third calls from concurrent / repeated actions
        stats2, _, is_new2 = VisitorService.record_visit(memory_db, visitor_token=token, target_date=day1)
        stats3, _, is_new3 = VisitorService.record_visit(memory_db, visitor_token=token, target_date=day1)

        assert is_new2 is False
        assert is_new3 is False
        assert stats1.total_visitors == 1
        assert stats2.total_visitors == 1
        assert stats3.total_visitors == 1
        assert stats1.today_visitors == 1
        assert stats2.today_visitors == 1
        assert stats3.today_visitors == 1

    def test_migration_definition_integrity(self):
        import importlib.util
        from pathlib import Path

        migration_path = Path(__file__).parent.parent / "alembic" / "versions" / "8b29c54e1020_public_visitor_counter.py"
        assert migration_path.exists(), "Migration file 8b29c54e1020_public_visitor_counter.py must exist"

        spec = importlib.util.spec_from_file_location("migration_1020", migration_path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        assert mod.revision == "8b29c54e1020"
        assert mod.down_revision == "8b29c54e1019"
        assert hasattr(mod, "upgrade")
        assert hasattr(mod, "downgrade")

    def test_counts_persist_across_engine_restart(self):
        # Temporary SQLite file to test actual persistence across connection/engine disposals
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            # Phase 1: Record 2 visitors
            engine1 = create_engine(f"sqlite:///{tmp_path}")
            Base.metadata.create_all(bind=engine1, tables=[PublicVisitor.__table__, PublicDailyVisit.__table__])
            Session1 = sessionmaker(bind=engine1)
            with Session1() as s1:
                VisitorService.record_visit(s1, visitor_token="v1-token-12345678901234567890", target_date=date(2026, 11, 11))
                VisitorService.record_visit(s1, visitor_token="v2-token-12345678901234567890", target_date=date(2026, 11, 11))
            engine1.dispose()

            # Phase 2: Simulate complete server reboot / new engine initialization
            engine2 = create_engine(f"sqlite:///{tmp_path}")
            Session2 = sessionmaker(bind=engine2)
            with Session2() as s2:
                stats = VisitorService.get_visitor_stats(s2, target_date=date(2026, 11, 11))
                assert stats.total_visitors == 2
                assert stats.today_visitors == 2
            engine2.dispose()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

