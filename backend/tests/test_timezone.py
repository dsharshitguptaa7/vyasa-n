"""
Timezone Standardization Test Suite for VYASA Core.

Verifies:
1. now_ist() returns timezone-aware datetime in Asia/Kolkata (+05:30).
2. now_utc() returns timezone-aware datetime in UTC (+00:00).
3. Instant preservation across conversions (to_ist, to_utc).
4. Calendar day boundaries for Asia/Kolkata map precisely to UTC instants.
5. ISO 8601 formatting includes explicit +05:30 offset.
6. Database session timezone evaluates to Asia/Kolkata.
"""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo
import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

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


def test_now_ist_properties():
    """now_ist() returns aware datetime with Asia/Kolkata zone and +05:30 offset."""
    dt = now_ist()
    assert dt.tzinfo is not None
    assert str(dt.tzinfo) == "Asia/Kolkata"
    assert dt.utcoffset().total_seconds() == 5.5 * 3600


def test_now_utc_properties():
    """now_utc() returns aware datetime with UTC zone and 0 offset."""
    dt = now_utc()
    assert dt.tzinfo is not None
    assert dt.utcoffset().total_seconds() == 0


def test_instant_preservation():
    """Converting between UTC and IST preserves exact absolute instant (epoch timestamp)."""
    current_utc = now_utc()
    converted_ist = to_ist(current_utc)
    reconverted_utc = to_utc(converted_ist)

    assert current_utc.timestamp() == converted_ist.timestamp()
    assert converted_ist.timestamp() == reconverted_utc.timestamp()


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


def test_cross_day_boundary_categorization():
    """
    Verify boundary instants:
    - 2026-09-27 18:29:59 UTC belongs to 2026-09-27 IST
    - 2026-09-27 18:30:00 UTC belongs to 2026-09-28 IST (00:00:00 IST)
    - 2026-09-27 19:00:00 UTC belongs to 2026-09-28 IST (00:30:00 IST)
    - 2026-09-28 18:29:59 UTC belongs to 2026-09-28 IST (23:59:59 IST)
    - 2026-09-28 18:30:00 UTC belongs to 2026-09-29 IST (00:00:00 IST)
    """
    target = date(2026, 9, 28)
    start_utc, end_utc = ist_day_bounds_utc(target)

    just_before_day = datetime(2026, 9, 27, 18, 29, 59, tzinfo=timezone.utc)
    exact_start = datetime(2026, 9, 27, 18, 30, 0, tzinfo=timezone.utc)
    late_night_utc = datetime(2026, 9, 27, 19, 0, 0, tzinfo=timezone.utc)
    exact_end = datetime(2026, 9, 28, 18, 29, 59, tzinfo=timezone.utc)
    next_day_start = datetime(2026, 9, 28, 18, 30, 0, tzinfo=timezone.utc)

    assert not (start_utc <= just_before_day <= end_utc)
    assert start_utc <= exact_start <= end_utc
    assert start_utc <= late_night_utc <= end_utc
    assert start_utc <= exact_end <= end_utc
    assert not (start_utc <= next_day_start <= end_utc)


def test_format_iso_ist():
    """format_iso_ist formats ISO string with explicit +05:30 offset."""
    utc_dt = datetime(2026, 9, 28, 4, 30, 0, tzinfo=timezone.utc)
    formatted = format_iso_ist(utc_dt)
    assert "+05:30" in formatted
    assert "2026-09-28T10:00:00+05:30" == formatted


def test_database_session_timezone(db_session: Session):
    """PostgreSQL session timezone evaluates to Asia/Kolkata."""
    result = db_session.execute(text("SHOW timezone")).scalar()
    assert result == "Asia/Kolkata"
