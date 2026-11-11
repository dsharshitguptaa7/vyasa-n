from typing import Optional
from fastapi import APIRouter, Depends, Request, Response, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.api.dependencies import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.visitor import VisitorStatsOut
from app.services.visitor_service import (
    VisitorService,
    is_bot_or_crawler,
    is_internal_administrative_user,
    check_rate_limit,
    hash_client_ip,
)

router = APIRouter(prefix="/public", tags=["Public / Visitor Counter"])

VISITOR_COOKIE_NAME = "vyasa_vid"
COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60  # 365 days


def _get_client_ip(request: Request) -> str:
    """Safely extracts client IP from headers or connection without persistence."""
    x_forwarded_for = request.headers.get("x-forwarded-for")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@router.get("/visitor-stats", response_model=ApiResponse[VisitorStatsOut])
def get_public_visitor_stats(
    db: Session = Depends(get_db),
) -> ApiResponse[VisitorStatsOut]:
    """
    Public aggregate visitor statistics for the main VYASA website.
    Accessible without authentication. Returns cumulative total and today's IST unique count.
    """
    stats = VisitorService.get_visitor_stats(db)
    return ApiResponse(
        success=True,
        message="Visitor statistics retrieved successfully",
        data=stats,
    )


@router.post("/visitor-track", response_model=ApiResponse[VisitorStatsOut])
def track_public_visitor(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    x_visitor_id: Optional[str] = Header(None, alias="X-Visitor-Id"),
    db: Session = Depends(get_db),
) -> ApiResponse[VisitorStatsOut]:
    """
    Records a unique visit to the main VYASA website using a privacy-first anonymous cookie.
    - Increments total unique visitors once per visitor lifetime (365 days).
    - Increments today's unique visitors once per IST calendar day (Asia/Kolkata).
    - Ignores automated crawlers, bots, and internal administrative traffic.
    - Prevents duplicate counting on page refresh or concurrent requests.
    """
    # 1. Ephemeral Rate Limiting (hashed identifier, raw IP never stored)
    client_ip = _get_client_ip(request)
    client_hash = hash_client_ip(client_ip)
    if not check_rate_limit(client_hash):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many tracking requests. Please slow down.",
        )

    # 2. Bot & Automated Crawlers Detection
    user_agent = request.headers.get("user-agent", "")
    is_bot = is_bot_or_crawler(user_agent)

    # 3. Browser Previews / Prefetch Header Inspection
    is_preview = (
        request.headers.get("sec-purpose", "").lower() == "preview"
        or request.headers.get("x-purpose", "").lower() == "preview"
    )

    # 4. Exclude Internal Administrative Traffic (if authenticated with administrative role)
    is_admin = False
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            try:
                user = db.query(User).filter(User.email == payload["sub"]).first()
                if user and is_internal_administrative_user(user):
                    is_admin = True
            except Exception:
                pass

    is_excluded = is_bot or is_preview or is_admin

    # 5. Extract existing visitor token from cookie or custom header
    visitor_token = request.cookies.get(VISITOR_COOKIE_NAME) or x_visitor_id

    # 6. Record visit atomically in database
    stats, effective_token, should_set_cookie = VisitorService.record_visit(
        db=db,
        visitor_token=visitor_token,
        is_excluded=is_excluded,
    )

    # 7. Issue or refresh secure first-party cookie
    is_production = settings.NODE_ENV == "production"
    response.set_cookie(
        key=VISITOR_COOKIE_NAME,
        value=effective_token,
        max_age=COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        samesite="lax",
        secure=is_production,
        path="/",
    )

    return ApiResponse(
        success=True,
        message="Visitor tracked successfully",
        data=stats,
    )
