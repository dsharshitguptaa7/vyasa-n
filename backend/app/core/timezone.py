"""
Centralized Institutional Timezone Foundation for VYASA Core.

Business Timezone: Asia/Kolkata (IST / UTC+05:30)

Guarantees:
1. All application/business date-time operations evaluate in Asia/Kolkata.
2. Timestamps represent absolute instants; conversion between UTC and IST preserves the exact instant.
3. Database storage in PostgreSQL TIMESTAMPTZ stores absolute UTC instants.
4. No naive datetime ambiguity is permitted.
"""

from datetime import date, datetime, time, timezone
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
UTC = timezone.utc


def now_ist() -> datetime:
    """Return the current time as a timezone-aware datetime in Asia/Kolkata (IST)."""
    return datetime.now(IST)


def now_utc() -> datetime:
    """Return the current time as a timezone-aware datetime in UTC."""
    return datetime.now(UTC)


def today_ist() -> date:
    """Return today's calendar date according to the Asia/Kolkata (IST) business timezone."""
    return now_ist().date()


def start_of_day_ist(d: Optional[date] = None) -> datetime:
    """Return the start of the specified (or current) IST calendar day (00:00:00.000000+05:30)."""
    target_date = d or today_ist()
    return datetime.combine(target_date, time.min, tzinfo=IST)


def end_of_day_ist(d: Optional[date] = None) -> datetime:
    """Return the end of the specified (or current) IST calendar day (23:59:59.999999+05:30)."""
    target_date = d or today_ist()
    return datetime.combine(target_date, time.max, tzinfo=IST)


def to_ist(dt: datetime) -> datetime:
    """
    Convert a datetime to Asia/Kolkata.
    If the datetime is naive, it is assumed to represent UTC and converted to IST.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(IST)


def to_utc(dt: datetime) -> datetime:
    """
    Convert a datetime to UTC.
    If the datetime is naive, it is assumed to represent Asia/Kolkata and converted to UTC.
    """
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST)
    return dt.astimezone(UTC)


def ist_day_bounds_utc(d: Optional[date] = None) -> Tuple[datetime, datetime]:
    """
    Return the UTC instant bounds [start_utc, end_utc] for the specified IST calendar day.
    Useful for querying PostgreSQL TIMESTAMPTZ columns against an IST calendar date.
    
    Example:
        For 2026-09-28 IST:
        start_utc = 2026-09-27 18:30:00+00:00
        end_utc   = 2026-09-28 18:29:59.999999+00:00
    """
    start_ist = start_of_day_ist(d)
    end_ist = end_of_day_ist(d)
    return start_ist.astimezone(UTC), end_ist.astimezone(UTC)


def format_iso_ist(dt: datetime) -> str:
    """Format any datetime as an unambiguous ISO 8601 string in Asia/Kolkata with explicit offset (+05:30)."""
    return to_ist(dt).isoformat()
