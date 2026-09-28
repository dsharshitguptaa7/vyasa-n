"""
FastAPI Authorization Dependencies for NIVARAN Pillar.

Derives authorization strictly through the identity boundary:
VYASA identity (vyasa_user_id from VerifiedVyasaIdentity)
    ↓
NIVARAN authority profile (nivaran_authorities)
    ↓
NIVARAN role (NivaranRole)
    ↓
NIVARAN permissions (NivaranPermission)

Never accepts client-supplied role parameters as proof of authorization.
Returns controlled HTTP 403 for unauthorized authority operations.
"""

import uuid
from typing import Callable, Sequence
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.identity import get_authenticated_vyasa_identity
from app.core.permissions import NivaranPermission, ROLE_PERMISSIONS
from app.models.authority import NivaranAuthority
from app.models.enums import NivaranRole
from app.services.authorization import AuthorityAuthorizationService
from app.services.vyasa_identity import VerifiedVyasaIdentity


def get_current_authority(
    db: Session = Depends(get_db),
    identity: VerifiedVyasaIdentity = Depends(get_authenticated_vyasa_identity),
) -> NivaranAuthority:
    """
    Resolve the active NivaranAuthority profile for the verified VYASA identity.
    Raises HTTP 403 Forbidden if user is unknown or lacks an active authority profile.
    """
    authority = AuthorityAuthorizationService.get_authority_by_vyasa_user_id(
        db, identity.id
    )
    if not authority:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: No active NIVARAN authority profile found for user.",
        )
    return authority


def require_nivaran_role(*allowed_roles: NivaranRole) -> Callable:
    """
    FastAPI dependency factory enforcing that caller holds one of the specified NivaranRole(s).
    """
    def dependency(
        authority: NivaranAuthority = Depends(get_current_authority),
    ) -> NivaranAuthority:
        if not AuthorityAuthorizationService.has_role(authority, allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Action requires role in {[r.value for r in allowed_roles]}; current role is {authority.role.value}.",
            )
        return authority

    return dependency


def require_nivaran_permission(permission: NivaranPermission) -> Callable:
    """
    FastAPI dependency factory enforcing that caller holds the specified NivaranPermission.
    """
    def dependency(
        authority: NivaranAuthority = Depends(get_current_authority),
    ) -> NivaranAuthority:
        if not AuthorityAuthorizationService.has_permission(authority, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Insufficient privileges for permission '{permission.value}'.",
            )
        return authority

    return dependency


# Convenience dependency specifically for Manager role
require_manager = require_nivaran_role(NivaranRole.MANAGER)
