"""
Timezone Standardization & Daily Quota Boundary Test Suite for NIVARAN Pillar.

Verifies:
1. now_ist() returns timezone-aware datetime in Asia/Kolkata (+05:30).
2. now_utc() returns timezone-aware datetime in UTC (+00:00).
3. Instant preservation across conversions.
4. Calendar day boundaries for Asia/Kolkata in UTC:
   - [00:00:00 IST -> 18:30:00 UTC previous day, 23:59:59.999999 IST -> 18:29:59.999999 UTC current day]
5. Daily grievance submission quota boundary respects Asia/Kolkata calendar day:
   - Instant at 19:00 UTC (00:30 IST) is counted in today's quota.
   - Instant at 18:29 UTC (23:59 IST previous day) is NOT counted in today's quota.
6. Tracking code date prefix uses Asia/Kolkata date (YYYYMMDD).
7. Database connection session timezone evaluates to Asia/Kolkata.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.exceptions import DailyLimitExceededError
from app.core.timezone import (
    IST,
    UTC,
    end_of_day_ist,
    format_iso_ist,
    ist_day_bounds_utc,
    now_ist,
    now_utc,
    start_of_day_ist,
    to_ist,
    to_utc,
)
from app.models.audit import AuditLog
from app.models.enums import GrievancePriority, GrievanceStatus
from app.models.grievance import Grievance
from app.models.taxonomy import Subject
from app.services.grievance_submission import generate_grievance_tracking_id
from app.services.submission_restrictions import check_daily_submission_limit


def test_now_ist_and_now_utc():
    """Verify aware datetimes and correct offsets."""
    ist_dt = now_ist()
    utc_dt = now_utc()

    assert ist_dt.tzinfo is not None
    assert str(ist_dt.tzinfo) == "Asia/Kolkata"
    assert ist_dt.utcoffset().total_seconds() == 19800  # +05:30 = 5.5 * 3600

    assert utc_dt.tzinfo is not None
    assert utc_dt.utcoffset().total_seconds() == 0


def test_instant_preservation():
    """Conversions preserve exact point in time."""
    utc_dt = now_utc()
    ist_dt = to_ist(utc_dt)
    assert utc_dt.timestamp() == ist_dt.timestamp()


def test_ist_calendar_day_bounds_in_utc():
    """
    On 2026-09-28:
    IST day start: 2026-09-28 00:00:00+05:30 -> UTC 2026-09-27 18:30:00+00:00
    IST day end:   2026-09-28 23:59:59.999999+05:30 -> UTC 2026-09-28 18:29:59.999999+00:00
    """
    target = date(2026, 9, 28)
    start_utc, end_utc = ist_day_bounds_utc(target)

    expected_start = datetime(2026, 9, 27, 18, 30, 0, tzinfo=timezone.utc)
    expected_end = datetime(2026, 9, 28, 18, 29, 59, 999999, tzinfo=timezone.utc)

    assert start_utc == expected_start
    assert end_utc == expected_end


def test_tracking_id_uses_ist_date():
    """generate_grievance_tracking_id() produces prefix matching Asia/Kolkata current date."""
    tracking_id = generate_grievance_tracking_id()
    expected_date = now_ist().strftime("%Y%m%d")
    assert tracking_id.startswith(f"G-{expected_date}-")


def test_daily_submission_quota_boundary(db_session: Session):
    """
    Verify daily submission quota strictly enforces Asia/Kolkata day boundaries.
    Submissions within today's IST window are counted.
    Submissions from yesterday IST (even if on same UTC calendar date) are excluded.
    """
    test_user_id = uuid.uuid4()
    start_of_today_utc, end_of_today_utc = ist_day_bounds_utc()

    # Find a valid subject
    subject = db_session.execute(select(Subject).limit(1)).scalar_one_or_none()
    if not subject:
        pytest.skip("No subjects in database to link grievance")

    # Record 1: Submitted yesterday in IST (e.g. 1 minute before IST midnight)
    yesterday_instant = start_of_today_utc - timedelta(seconds=60)
    g_old = Grievance(
        grievance_id=f"G-OLD-{uuid.uuid4().hex[:6]}",
        applicant_vyasa_user_id=test_user_id,
        subject_id=subject.id,
        title="Old Grievance",
        description="Old Description",
        status=GrievanceStatus.SUBMITTED,
        priority=GrievancePriority.MEDIUM,
        submitted_at=yesterday_instant,
        created_at=yesterday_instant,
    )
    db_session.add(g_old)
    db_session.commit()

    # Quota check should succeed (0 in today's IST window)
    check_daily_submission_limit(db_session, test_user_id)

    # Now add 3 grievances within today's IST window
    today_instant_1 = start_of_today_utc + timedelta(minutes=10)
    today_instant_2 = start_of_today_utc + timedelta(hours=2)
    today_instant_3 = start_of_today_utc + timedelta(hours=4)

    for i, inst in enumerate([today_instant_1, today_instant_2, today_instant_3]):
        g = Grievance(
            grievance_id=f"G-TODAY-{i}-{uuid.uuid4().hex[:6]}",
            applicant_vyasa_user_id=test_user_id,
            subject_id=subject.id,
            title=f"Today Grievance {i}",
            description=f"Description {i}",
            status=GrievanceStatus.SUBMITTED,
            priority=GrievancePriority.MEDIUM,
            submitted_at=inst,
            created_at=inst,
        )
        db_session.add(g)
    db_session.commit()

    # 4th submission attempt should be blocked
    with pytest.raises(DailyLimitExceededError):
        check_daily_submission_limit(db_session, test_user_id)


def test_database_session_timezone(db_session: Session):
    """PostgreSQL session timezone evaluates to Asia/Kolkata."""
    result = db_session.execute(text("SHOW timezone")).scalar()
    assert result == "Asia/Kolkata"
