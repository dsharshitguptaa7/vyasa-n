import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_db
from app.models.role import Role
from app.schemas.common import ApiResponse
from app.schemas.role import RoleWithPermissions, RoleListResponse

router = APIRouter(prefix="/roles", tags=["Roles & RBAC"])


@router.get("", response_model=ApiResponse[RoleListResponse])
def list_roles(
    db: Session = Depends(get_db),
) -> ApiResponse[RoleListResponse]:
    """
    List all platform roles and their associated permissions.
    """
    stmt = select(Role).options(joinedload(Role.permissions)).order_by(Role.name.asc())
    roles = db.execute(stmt).unique().scalars().all()
    mapped = [RoleWithPermissions.model_validate(r) for r in roles]

    return ApiResponse(
        success=True,
        message="Roles retrieved successfully",
        data=RoleListResponse(
            count=len(mapped),
            roles=mapped,
        ),
    )


@router.get("/{name_or_id}", response_model=ApiResponse[RoleWithPermissions])
def get_role(
    name_or_id: str,
    db: Session = Depends(get_db),
) -> ApiResponse[RoleWithPermissions]:
    """
    Get a role by UUID identifier or name slug (e.g. administrator, authority, applicant).
    """
    try:
        parsed_uuid = uuid.UUID(name_or_id)
        stmt = select(Role).options(joinedload(Role.permissions)).where(Role.id == parsed_uuid)
    except ValueError:
        stmt = select(Role).options(joinedload(Role.permissions)).where(Role.name == name_or_id)

    role = db.execute(stmt).unique().scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role '{name_or_id}' was not found",
        )

    return ApiResponse(
        success=True,
        message="Role details retrieved successfully",
        data=RoleWithPermissions.model_validate(role),
    )
