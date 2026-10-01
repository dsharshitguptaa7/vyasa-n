"""
Sama Veda Module Dependencies
Security, authorization, and database dependency injection hooks for Sama Veda.
"""
from fastapi import Depends
from app.api.dependencies import get_current_user
from app.models.user import User


def require_sama_veda_access(current_user: User = Depends(get_current_user)) -> User:
    """
    Enforces active user session before accessing Sama Veda endpoints.
    Granular permission checks (e.g., sama:read, sama:write) will be enforced upon business logic implementation.
    """
    return current_user
