from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db
from app.models.permission import Permission
from app.schemas.common import ApiResponse
from app.schemas.role import PermissionRead, PermissionListResponse

router = APIRouter(prefix="/permissions", tags=["Permissions"])


@router.get("", response_model=ApiResponse[PermissionListResponse])
def list_permissions(
    db: Session = Depends(get_db),
) -> ApiResponse[PermissionListResponse]:
    """
    List all platform permission capabilities and resources.
    """
    stmt = select(Permission).order_by(Permission.resource.asc(), Permission.action.asc())
    permissions = db.execute(stmt).scalars().all()
    mapped = [PermissionRead.model_validate(p) for p in permissions]

    return ApiResponse(
        success=True,
        message="Permissions retrieved successfully",
        data=PermissionListResponse(
            count=len(mapped),
            permissions=mapped,
        ),
    )
