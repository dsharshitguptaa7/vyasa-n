"""
Rig Veda Module Dependencies
Security, authorization, and database dependency injection hooks for Rig Veda.
"""
from fastapi import Depends
from app.api.dependencies import get_current_user
from app.models.user import User


def require_rig_veda_access(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces active user session before accessing Rig Veda endpoints.
    Granular permission checks (e.g., rig:read, rig:write) will be enforced upon business logic implementation.
    """
    return current_user
