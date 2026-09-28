from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.pillar import PillarRegistry
from app.schemas.response import ApiResponse, ApiErrorDetail
from app.schemas.pillar import PillarMetadataResponse, PillarListResponse

router = APIRouter(prefix="/pillars", tags=["Pillars"])


def map_pillar_to_response(pillar: PillarRegistry) -> PillarMetadataResponse:
    meta = pillar.metadata_json or {}
    return PillarMetadataResponse(
        id=str(pillar.id),
        name=pillar.name,
        slug=pillar.pillar_key,
        description=pillar.description,
        icon=meta.get("icon"),
        route=meta.get("route"),
        status=pillar.status,
        enabled=pillar.is_enabled,
        requiredRoles=meta.get("requiredRoles", []),
        version=pillar.version,
        endpointUrl=pillar.base_url,
        metadata_json=meta,
    )


@router.get("", response_model=ApiResponse[PillarListResponse])
def list_pillars(
    x_user_roles: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> ApiResponse[PillarListResponse]:
    """
    List enabled ecosystem pillars from the pillar registry.
    Optional role-filtering through X-User-Roles header.
    """
    stmt = select(PillarRegistry).where(PillarRegistry.is_enabled == True)
    pillars = db.execute(stmt).scalars().all()

    roles: Optional[List[str]] = None
    if x_user_roles:
        roles = [r.strip() for r in x_user_roles.split(",") if r.strip()]

    mapped = [map_pillar_to_response(p) for p in pillars]

    if roles:
        mapped = [
            p for p in mapped
            if not p.requiredRoles or any(r in roles for r in p.requiredRoles)
        ]

    return ApiResponse(
        success=True,
        message="Available pillars retrieved successfully",
        data=PillarListResponse(
            count=len(mapped),
            pillars=mapped,
        ),
    )


@router.get("/{slug}", response_model=ApiResponse[PillarMetadataResponse])
def get_pillar(
    slug: str,
    db: Session = Depends(get_db),
) -> ApiResponse[PillarMetadataResponse]:
    """
    Retrieve contract metadata for a single pillar by slug key.
    """
    stmt = select(PillarRegistry).where(PillarRegistry.pillar_key == slug)
    pillar = db.execute(stmt).scalar_one_or_none()

    if not pillar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pillar with slug '{slug}' was not found in registry",
        )

    return ApiResponse(
        success=True,
        message="Pillar details retrieved successfully",
        data=map_pillar_to_response(pillar),
    )
