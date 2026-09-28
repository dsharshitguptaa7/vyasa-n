"""
NIVARAN Authority & Authorization Service.

Resolves NIVARAN authority profiles from vyasa_user_id and checks
institutional permissions and domain roles.

Identity Flow:
VYASA identity (vyasa_user_id)
    ↓
NIVARAN authority profile (nivaran_authorities)
    ↓
NIVARAN role (NivaranRole)
    ↓
NivaranPermission
"""

import uuid
from typing import Optional, Sequence
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.permissions import NivaranPermission, ROLE_PERMISSIONS
from app.models.authority import NivaranAuthority
from app.models.enums import NivaranRole


class AuthorityAuthorizationService:
    """Service for resolving authority profiles and evaluating domain roles and permissions."""

    @staticmethod
    def get_authority_by_vyasa_user_id(
        db: Session, vyasa_user_id: uuid.UUID
    ) -> Optional[NivaranAuthority]:
        """
        Query nivaran_authorities table for an active authority profile mapped to vyasa_user_id.
        Returns None if user is not an active authority.
        """
        stmt = (
            select(NivaranAuthority)
            .where(
                NivaranAuthority.vyasa_user_id == vyasa_user_id,
                NivaranAuthority.is_active.is_(True),
            )
        )
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def has_role(
        authority: NivaranAuthority, allowed_roles: Sequence[NivaranRole]
    ) -> bool:
        """Check if authority holds one of the specified domain roles."""
        return authority.role in allowed_roles

    @staticmethod
    def has_permission(
        authority: NivaranAuthority, permission: NivaranPermission
    ) -> bool:
        """Check if authority's role has the specified domain permission."""
        role_perms = ROLE_PERMISSIONS.get(authority.role, set())
        return permission in role_perms
