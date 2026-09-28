import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_db, get_pagination
from app.core.security import hash_password
from app.models.user import User
from app.models.role import Role
from app.schemas.common import ApiResponse, PaginationQuery
from app.schemas.user import UserCreate, UserRead, UserListResponse

router = APIRouter(prefix="/users", tags=["Users & Identity"])


@router.get("", response_model=ApiResponse[UserListResponse])
def list_users(
    pagination: PaginationQuery = Depends(get_pagination),
    db: Session = Depends(get_db),
) -> ApiResponse[UserListResponse]:
    """
    List platform users with associated roles (paginated).
    """
    stmt = (
        select(User)
        .options(joinedload(User.roles))
        .order_by(User.created_at.desc())
        .offset(pagination.skip)
        .limit(pagination.limit)
    )
    users = db.execute(stmt).unique().scalars().all()
    mapped_users = [UserRead.model_validate(u) for u in users]

    return ApiResponse(
        success=True,
        message="Users retrieved successfully",
        data=UserListResponse(
            count=len(mapped_users),
            users=mapped_users,
        ),
    )


@router.get("/{user_id}", response_model=ApiResponse[UserRead])
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ApiResponse[UserRead]:
    """
    Retrieve user by UUID identifier.
    """
    stmt = (
        select(User)
        .options(joinedload(User.roles))
        .where(User.id == user_id)
    )
    user = db.execute(stmt).unique().scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with id '{user_id}' was not found",
        )

    return ApiResponse(
        success=True,
        message="User profile retrieved successfully",
        data=UserRead.model_validate(user),
    )


@router.post("", response_model=ApiResponse[UserRead], status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> ApiResponse[UserRead]:
    """
    Create a new platform user profile with hashed password and assigned roles.
    """
    # Check duplicate email
    existing_stmt = select(User).where(User.email == payload.email)
    if db.execute(existing_stmt).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A user with email '{payload.email}' already exists",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        is_active=True,
        is_verified=False,
    )

    # Attach requested initial roles
    if payload.role_names:
        roles_stmt = select(Role).where(Role.name.in_(payload.role_names))
        roles = db.execute(roles_stmt).scalars().all()
        user.roles.extend(roles)

    db.add(user)
    db.commit()
    db.refresh(user)

    return ApiResponse(
        success=True,
        message="User created successfully",
        data=UserRead.model_validate(user),
    )
