from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.api.dependencies import get_db, get_current_user
from app.core.registry import get_all_registered_modules
from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/admin", tags=["Institutional Administration Console"])


@router.get("/status", response_model=ApiResponse)
def get_admin_system_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns platform-wide governance metrics for authenticated institutional administrators.
    """
    total_users = db.scalar(select(func.count(User.id))) or 0
    total_roles = db.scalar(select(func.count(Role.id))) or 0
    total_permissions = db.scalar(select(func.count(Permission.id))) or 0
    modules = get_all_registered_modules()

    return ApiResponse(
        success=True,
        message="Institutional administration metrics retrieved successfully.",
        data={
            "total_users": total_users,
            "total_roles": total_roles,
            "total_permissions": total_permissions,
            "total_modules": len(modules),
            "admin_user": current_user.email,
        },
    )


@router.get("/modules", response_model=ApiResponse)
def list_admin_modules(
    current_user: User = Depends(get_current_user),
):
    """
    Lists all foundational Veda governance modules with current deployment and availability status.
    """
    modules = get_all_registered_modules()
    return ApiResponse(
        success=True,
        message="Veda governance module registry retrieved.",
        data={"modules": [m.model_dump() for m in modules]},
    )


# Mount Atharva Veda / NIVARAN Configuration Subsystem
from app.admin.atharva_admin_router import atharva_admin_router, list_audit_logs
router.include_router(atharva_admin_router)

# Top-level platform audit logs route alias
router.add_api_route(
    "/audit-logs",
    list_audit_logs,
    methods=["GET"],
    response_model=ApiResponse,
    summary="Platform-wide Audit Log Explorer",
)

