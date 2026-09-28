"""
Identity Extraction Dependencies for NIVARAN API.

Decouples identity verification from local authentication:
In production, caller provides Authorization: Bearer <vyasa_jwt>.
NIVARAN verifies the token with VYASA Core (POST /api/auth/verify).

Architectural Rule:
"VYASA owns identity. NIVARAN owns grievance data."
"""

import logging
import uuid
from typing import Optional
from fastapi import Depends, Header, HTTPException, status

from app.core.config import settings
from app.services.vyasa_identity import (
    VerifiedVyasaIdentity,
    VyasaIdentityClient,
    VyasaIdentityServiceError,
    vyasa_identity_client,
)

logger = logging.getLogger("nivaran.core.identity")


def get_authenticated_vyasa_identity(
    authorization: Optional[str] = Header(
        None,
        description="VYASA Core Bearer access token (Authorization: Bearer <token>)",
    ),
) -> VerifiedVyasaIdentity:
    """
    Extract and verify caller's identity against the authoritative VYASA Core authentication service.

    Rejects:
    - Missing Authorization header -> HTTP 401
    - Invalid Bearer scheme / missing token -> HTTP 401
    - Invalid, expired, or inactive token -> HTTP 401
    - Verification service communication failure -> HTTP 401
    """
    token_present = bool(authorization)
    token_length = len(authorization) if authorization else 0
    token_parts = authorization.strip().split(" ") if authorization else []
    token_segment_count = len(token_parts[1].split(".")) if len(token_parts) == 2 else 0

    logger.info(
        "SESSION REQUEST START: token_present=%s token_length=%d token_segment_count=%d",
        token_present,
        token_length,
        token_segment_count,
    )

    if not authorization:
        logger.warning("SESSION REQUEST REJECTED: Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing required identity token. Bearer token in 'Authorization' header is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    parts = authorization.strip().split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        logger.warning("SESSION REQUEST REJECTED: Invalid Authorization scheme: parts=%d", len(parts))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header scheme. Must be 'Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = parts[1].strip()
    if not token:
        logger.warning("SESSION REQUEST REJECTED: Empty token in Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty Bearer token in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        identity = vyasa_identity_client.verify_token(token)
    except VyasaIdentityServiceError as exc:
        logger.error("VYASA Core identity verification service unreachable or failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"VYASA Core identity verification unavailable: {str(exc)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if identity is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or inactive VYASA authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return identity


def get_authenticated_vyasa_user_id(
    identity: VerifiedVyasaIdentity = Depends(get_authenticated_vyasa_identity),
) -> uuid.UUID:
    """
    Extract verified user UUID from the authenticated VYASA identity.
    Client-supplied headers cannot override this verified UUID.
    """
    return identity.id


def get_current_applicant_id(
    authorization: Optional[str] = Header(
        None,
        description="VYASA Bearer Token (Authorization: Bearer <token>)",
    ),
    x_applicant_user_id: Optional[str] = Header(
        None,
        alias="X-Applicant-User-Id",
        description="Legacy/test applicant user UUID header",
    ),
    x_vyasa_user_id: Optional[str] = Header(
        None,
        alias="X-Vyasa-User-Id",
        description="Legacy/test gateway header for caller user UUID",
    ),
) -> uuid.UUID:
    """
    Extract and validate the authenticated applicant's vyasa_user_id.

    Precedence:
    1. If Authorization header is provided, authoritatively verify against VYASA Core.
       Any client-supplied X-Applicant-User-Id or X-Vyasa-User-Id is strictly ignored.
    2. If Authorization header is NOT provided and we are in non-production/test environments:
       Fallback to legacy X-Applicant-User-Id / X-Vyasa-User-Id headers for backward compatibility.
    3. If neither is provided, raise HTTP 401 Unauthorized.
    """
    if authorization:
        parts = authorization.strip().split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Authorization header scheme. Must be 'Bearer <token>'.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = parts[1].strip()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Empty Bearer token in Authorization header.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        try:
            identity = vyasa_identity_client.verify_token(token)
        except VyasaIdentityServiceError as exc:
            logger.error("VYASA Core identity verification service unreachable or failed: %s", str(exc))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"VYASA Core identity verification unavailable: {str(exc)}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        if identity is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid, expired, or inactive VYASA authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return identity.id

    # Fallback path for backward-compatibility with applicant tests and dev harnesses
    raw_id = x_applicant_user_id or x_vyasa_user_id
    if not raw_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide 'Authorization: Bearer <token>'.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return uuid.UUID(raw_id.strip())
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid applicant identity header format. Must be a valid UUID.",
        )
