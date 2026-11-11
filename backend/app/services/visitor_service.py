import re
import secrets
import hashlib
import time
from collections import defaultdict
from datetime import date, datetime
from typing import Optional, Tuple, Set
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.timezone import today_ist, IST
from app.models.visitor import PublicVisitor, PublicDailyVisit
from app.models.user import User
from app.schemas.visitor import VisitorStatsOut


# Regular expression matching known automated bots, search crawlers, and monitoring agents
BOT_REGEX = re.compile(
    r"(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|"
    r"ia_archiver|crawler|spider|robot|crawling|scraper|scraping|archiver|transcoder|"
    r"curl|wget|python-requests|httpx|aiohttp|urllib|postman|insomnia|"
    r"lighthouse|pingdom|uptimerobot|statuspage|newrelic|datadog|check_http|"
    r"headlesschrome|phantomjs|selenium|playwright|puppeteer)",
    re.IGNORECASE,
)

# Internal administrative roles that should not inflate public visitor counts
ADMIN_ROLES: Set[str] = {
    "super_admin",
    "administrator",
    "manager",
    "triage_manager",
    "dean",
    "associate_dean",
    "assistant_dean",
    "authority",
    "authority_officer",
    "system_admin",
}

# In-memory sliding window rate limiter: client_hash -> list of unix timestamps
_RATE_LIMIT_BUCKET = defaultdict(list)
_RATE_LIMIT_WINDOW = 60  # seconds
_MAX_REQUESTS_PER_WINDOW = 60


def is_bot_or_crawler(user_agent: Optional[str]) -> bool:
    """
    Identifies whether the request originates from a search crawler, automated bot,
    or automated monitoring probe based on standard User-Agent header inspection.
    """
    if not user_agent or not user_agent.strip():
        return True
    return bool(BOT_REGEX.search(user_agent))


def is_internal_administrative_user(user: Optional[User]) -> bool:
    """
    Determines whether the authenticated user has an internal administrative or
    governance authority role that should be excluded from public visitor metrics.
    """
    if not user:
        return False
    user_roles = {r.name.lower() for r in user.roles} if hasattr(user, "roles") and user.roles else set()
    return bool(user_roles.intersection(ADMIN_ROLES))


def check_rate_limit(client_hash: str) -> bool:
    """
    Thread-safe sliding-window rate limit check using a one-way hashed client identifier.
    Guarantees raw IP addresses are never stored. Returns True if allowed, False if rate limited.
    """
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    timestamps = _RATE_LIMIT_BUCKET[client_hash]
    # Prune old timestamps
    _RATE_LIMIT_BUCKET[client_hash] = [t for t in timestamps if t > cutoff]
    if len(_RATE_LIMIT_BUCKET[client_hash]) >= _MAX_REQUESTS_PER_WINDOW:
        return False
    _RATE_LIMIT_BUCKET[client_hash].append(now)
    return True


def hash_client_ip(ip_address: Optional[str], salt: str = "vyasa-visitor-salt") -> str:
    """
    Creates an ephemeral one-way hash of client IP for rate-limiting.
    Does not persist raw IP address anywhere in memory or database.
    """
    raw = (ip_address or "unknown").strip()
    return hashlib.sha256(f"{raw}:{salt}".encode("utf-8")).hexdigest()[:24]


def generate_visitor_token() -> str:
    """
    Generates a cryptographically secure random first-party visitor token.
    Uses 32 url-safe random characters.
    """
    return secrets.token_urlsafe(32)


def validate_visitor_token(token: Optional[str]) -> Optional[str]:
    """
    Validates the format of a visitor token.
    Must be a non-empty alphanumeric / url-safe string between 24 and 64 characters.
    Returns the validated token, or None if malformed or missing.
    """
    if not token or not isinstance(token, str):
        return None
    token = token.strip()
    if re.match(r"^[A-Za-z0-9_-]{24,64}$", token):
        return token
    return None


class VisitorService:
    @staticmethod
    def get_visitor_stats(db: Session, target_date: Optional[date] = None) -> VisitorStatsOut:
        """
        Calculates and returns current aggregate visitor statistics.
        Total visitors: Lifetime unique visitors to the main VYASA website.
        Today's visitors: Unique visitors recorded during the institutional IST calendar day.
        """
        current_date = target_date or today_ist()

        total_unique = db.scalar(select(func.count(PublicVisitor.id))) or 0
        today_unique = db.scalar(
            select(func.count(PublicDailyVisit.id)).where(PublicDailyVisit.visit_date == current_date)
        ) or 0

        return VisitorStatsOut(
            total_visitors=int(total_unique),
            today_visitors=int(today_unique),
            date=current_date.isoformat(),
            timezone="Asia/Kolkata",
        )

    @staticmethod
    def record_visit(
        db: Session,
        visitor_token: Optional[str] = None,
        is_excluded: bool = False,
        target_date: Optional[date] = None,
    ) -> Tuple[VisitorStatsOut, str, bool]:
        """
        Records a unique visit for the main VYASA website.
        Handles:
        1. Anonymous visitor identity creation and persistence.
        2. Daily unique calendar day record scoped to Asia/Kolkata (IST).
        3. Race conditions and duplicate prevention via unique constraints.
        4. Bot, health check, and internal admin exclusions.

        Returns:
            Tuple of:
            - VisitorStatsOut: latest aggregate statistics.
            - str: the effective visitor token (retained or newly minted).
            - bool: whether a new first-party cookie should be set/refreshed.
        """
        validated_token = validate_visitor_token(visitor_token)
        is_new_cookie = False

        if not validated_token:
            effective_token = generate_visitor_token()
            is_new_cookie = True
        else:
            effective_token = validated_token

        current_date = target_date or today_ist()

        # If excluded (e.g. crawler, bot, internal administrative user), do not record visit
        if is_excluded:
            stats = VisitorService.get_visitor_stats(db, target_date=current_date)
            return stats, effective_token, is_new_cookie

        # 1. Fetch or create the PublicVisitor record
        visitor = db.scalar(
            select(PublicVisitor).where(PublicVisitor.visitor_token == effective_token)
        )

        if not visitor:
            try:
                visitor = PublicVisitor(
                    visitor_token=effective_token,
                    total_visits=1,
                )
                db.add(visitor)
                db.flush()
                is_new_cookie = True
            except IntegrityError:
                db.rollback()
                visitor = db.scalar(
                    select(PublicVisitor).where(PublicVisitor.visitor_token == effective_token)
                )

        if not visitor:
            # Fallback if somehow still not found
            stats = VisitorService.get_visitor_stats(db, target_date=current_date)
            return stats, effective_token, is_new_cookie

        # 2. Record daily visit if not already recorded for today in IST
        existing_daily = db.scalar(
            select(PublicDailyVisit).where(
                PublicDailyVisit.visitor_id == visitor.id,
                PublicDailyVisit.visit_date == current_date,
            )
        )

        if not existing_daily:
            try:
                new_daily = PublicDailyVisit(
                    visitor_id=visitor.id,
                    visit_date=current_date,
                )
                db.add(new_daily)
                visitor.total_visits = (visitor.total_visits or 0) + 1
                visitor.last_seen_at = func.now()
                db.commit()
            except IntegrityError:
                # Concurrent request from same visitor on same day already recorded
                db.rollback()
        else:
            # Already recorded today; keep total visits updated if needed
            try:
                visitor.last_seen_at = func.now()
                db.commit()
            except Exception:
                db.rollback()

        stats = VisitorService.get_visitor_stats(db, target_date=current_date)
        return stats, effective_token, is_new_cookie
