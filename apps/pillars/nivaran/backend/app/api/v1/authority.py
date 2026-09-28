"""
Authority Identity Resolution & Session Endpoints for NIVARAN.

Enforces:
1. Authoritative verification of caller identity via VYASA Core (POST /api/auth/verify).
2. Enforcement of generic VYASA 'authority' ecosystem role.
3. Real-time resolution of domain authority profile from nivaran_authorities.
4. Absolute decoupling: NIVARAN never issues JWTs or checks passwords.
"""

import logging
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.identity import get_authenticated_vyasa_identity
from app.services.authorization import AuthorityAuthorizationService
from app.services.vyasa_identity import VerifiedVyasaIdentity

logger = logging.getLogger("nivaran.api.authority")
router = APIRouter()


class VyasaIdentitySummary(BaseModel):
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    roles: List[str]


class NivaranAuthoritySummary(BaseModel):
    id: uuid.UUID
    vyasa_user_id: uuid.UUID
    role: str
    name: str
    email: str
    designation: Optional[str] = None
    department: Optional[str] = None
    is_active: bool


class AuthoritySessionResponse(BaseModel):
    success: bool
    vyasa_identity: VyasaIdentitySummary
    nivaran_authority: NivaranAuthoritySummary


@router.get(
    "/me",
    response_model=AuthoritySessionResponse,
    summary="Resolve authenticated authority identity and NIVARAN domain role",
    description="Consumes VYASA Core Bearer token, verifies identity against VYASA Core, and resolves the local NIVARAN authority domain profile.",
)
def get_authority_session(
    db: Session = Depends(get_db),
    identity: VerifiedVyasaIdentity = Depends(get_authenticated_vyasa_identity),
) -> AuthoritySessionResponse:
    """
    Authority Handoff Entry Point.
    Rejects:
    - Non-authority generic VYASA role (e.g. applicant) -> HTTP 403
    - Verified VYASA identity lacking a mapped nivaran_authorities record -> HTTP 403
    """
    user_roles = [r.lower() for r in identity.roles]
    if "authority" not in user_roles and "administrator" not in user_roles:
        logger.warning(
            "User %s attempted to access authority session with non-authority roles: %s",
            identity.id,
            identity.roles,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Your VYASA identity does not have the 'authority' ecosystem role.",
        )

    authority = AuthorityAuthorizationService.get_authority_by_vyasa_user_id(db, identity.id)
    if not authority or not authority.is_active:
        logger.warning(
            "Verified VYASA user %s (%s) has no active NIVARAN authority record",
            identity.id,
            identity.email,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your VYASA identity is valid, but no NIVARAN authority profile is assigned.",
        )

    return AuthoritySessionResponse(
        success=True,
        vyasa_identity=VyasaIdentitySummary(
            id=identity.id,
            email=identity.email,
            first_name=identity.first_name,
            last_name=identity.last_name,
            roles=identity.roles,
        ),
        nivaran_authority=NivaranAuthoritySummary(
            id=authority.id,
            vyasa_user_id=authority.vyasa_user_id,
            role=authority.role.value,
            name=authority.name_snapshot,
            email=authority.email_snapshot,
            designation=authority.designation,
            department=authority.department,
            is_active=authority.is_active,
        ),
    )
