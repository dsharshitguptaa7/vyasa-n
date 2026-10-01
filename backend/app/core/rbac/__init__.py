"""
VYASA Core Role-Based Access Control (RBAC) Subsystem
Owns roles, granular permissions, and authorization dependency guards.
"""
from app.models.role import Role, user_roles
from app.models.permission import Permission, role_permissions

__all__ = ["Role", "Permission", "user_roles", "role_permissions"]
