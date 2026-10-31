import uuid
from typing import Generator, Optional, Dict, Any
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.common import PaginationQuery


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a managed database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_pagination(
    skip: int = 0,
    limit: int = 50,
) -> PaginationQuery:
    """
    Standard pagination query parameter validator.
    """
    if skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skip cannot be negative",
        )
    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100",
        )
    return PaginationQuery(skip=skip, limit=limit)


def get_optional_auth_payload(
    authorization: Optional[str] = Header(None),
) -> Optional[Dict[str, Any]]:
    """
    Authentication foundation helper: parses Bearer token if provided.
    Does not strictly enforce auth yet (full auth milestone to come).
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    return decode_access_token(token)


def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """
    Strict authentication dependency resolving the active VYASA Core User from Bearer token.
    Validates token authenticity, signature, issuer, expiration, and user active status.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split("Bearer ", 1)[1].strip()
    payload = decode_access_token(token, verify_issuer=True)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim ('sub').",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_uuid = uuid.UUID(sub)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject ('sub') is not a valid UUID.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = select(User).options(joinedload(User.roles)).where(User.id == user_uuid)
    user = db.execute(stmt).unique().scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this token does not exist.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if getattr(user, "must_change_password", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before accessing platform resources.",
        )

    return user


def require_applicant_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Ensure the authenticated caller possesses the generic 'applicant' platform role.
    """
    roles = [r.name.lower() for r in current_user.roles]
    if "applicant" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to applicants only.",
        )
    return current_user


def require_super_admin_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Ensure the authenticated caller possesses the central 'super_admin' platform role.
    Strictly accepts only 'super_admin'. Legacy 'administrator' or 'admin' roles are NOT accepted.
    """
    roles = [r.name.lower() for r in current_user.roles]
    if "super_admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Super Admin only.",
        )
    return current_user


def require_admin_user(
    current_user: User = Depends(require_super_admin_user),
) -> User:
    """
    Ensure the authenticated caller possesses administrative platform privileges.
    Strictly delegates to require_super_admin_user.
    """
    return current_user


def require_permission(permission_name: str):
    """
    Factory dependency checking if the caller possesses the specified granular permission
    through their assigned roles, or possesses the overarching 'super_admin' platform role.
    """
    def _permission_guard(
        current_user: User = Depends(get_current_user),
    ) -> User:
        roles = [r.name.lower() for r in current_user.roles]
        if "super_admin" in roles:
            return current_user

        assigned_permissions = set()
        for r in current_user.roles:
            if hasattr(r, "permissions") and r.permissions:
                for p in r.permissions:
                    assigned_permissions.add(p.name)

        if permission_name not in assigned_permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Missing required permission: '{permission_name}'.",
            )
        return current_user

    return _permission_guard


