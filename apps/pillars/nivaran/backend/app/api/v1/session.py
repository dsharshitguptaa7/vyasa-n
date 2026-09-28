"""
Unified Cross-Pillar Session Resolution Endpoint for NIVARAN.

Dynamically evaluates the caller's verified generic VYASA role (authority vs applicant)
and returns the appropriate domain context:
- If 'applicant' -> StudentMasterRecord session
- If 'authority' or 'administrator' -> NivaranAuthority session
- Decoupled from credentials: all authentication is performed authoritatively via VYASA Core.
"""

import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.v1.applicant import _resolve_applicant_session
from app.api.v1.authority import (
    AuthoritySessionResponse,
    NivaranAuthoritySummary,
    VyasaIdentitySummary,
)
from app.core.database import get_db
from app.core.identity import get_authenticated_vyasa_identity
from app.services.authorization import AuthorityAuthorizationService
from app.services.vyasa_identity import VerifiedVyasaIdentity

logger = logging.getLogger("nivaran.api.session")
router = APIRouter()


@router.get(
    "",
    summary="Resolve authenticated session dynamically for any verified VYASA role",
)
def resolve_unified_session(
    request: Request,
    db: Session = Depends(get_db),
    identity: VerifiedVyasaIdentity = Depends(get_authenticated_vyasa_identity),
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """
    Unified entry point for NIVARAN handoff.
    Inspects generic roles verified by VYASA Core and routes to the appropriate domain logic:
    - 'applicant' -> JIT student provisioning + academic context
    - 'authority'/'administrator' -> NivaranAuthority role resolution
    """
    user_roles = [r.lower() for r in identity.roles]

    if "applicant" in user_roles:
        applicant_res = _resolve_applicant_session(request, db, identity, authorization)
        return {
            "success": True,
            "role_type": "applicant",
            "session": applicant_res.model_dump(),
        }

    if "authority" in user_roles or "administrator" in user_roles:
        authority = AuthorityAuthorizationService.get_authority_by_vyasa_user_id(db, identity.id)
        if not authority or not authority.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your VYASA identity is valid, but no active NIVARAN authority profile is assigned.",
            )
        auth_res = AuthoritySessionResponse(
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
        return {
            "success": True,
            "role_type": "authority",
            "session": auth_res.model_dump(),
        }

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: Your VYASA identity does not have an authorized role for NIVARAN.",
    )
