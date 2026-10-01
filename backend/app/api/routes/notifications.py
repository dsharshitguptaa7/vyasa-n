import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_pagination
from app.models.notification import Notification
from app.schemas.common import ApiResponse, PaginationQuery
from app.schemas.notification import (
    NotificationCreate,
    NotificationRead,
    NotificationListResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=ApiResponse[NotificationListResponse])
def list_notifications(
    user_id: Optional[uuid.UUID] = None,
    is_read: Optional[bool] = None,
    pagination: PaginationQuery = Depends(get_pagination),
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationListResponse]:
    """
    List platform notifications, optionally filtered by user ID and read status.
    """
    stmt = select(Notification).order_by(Notification.created_at.desc())
    if user_id:
        stmt = stmt.where(Notification.user_id == user_id)
    if is_read is not None:
        stmt = stmt.where(Notification.is_read == is_read)

    stmt = stmt.offset(pagination.skip).limit(pagination.limit)
    notifs = db.execute(stmt).scalars().all()
    mapped = [NotificationRead.model_validate(n) for n in notifs]

    return ApiResponse(
        success=True,
        message="Notifications retrieved successfully",
        data=NotificationListResponse(
            count=len(mapped),
            notifications=mapped,
        ),
    )


@router.post("", response_model=ApiResponse[NotificationRead], status_code=status.HTTP_201_CREATED)
def dispatch_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationRead]:
    """
    Dispatch a platform notification to a target user.
    """
    notif = Notification(
        user_id=payload.user_id,
        title=payload.title,
        message=payload.message,
        type=payload.type,
        metadata_json=payload.metadata_json,
        is_read=False,
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)

    return ApiResponse(
        success=True,
        message="Notification dispatched successfully",
        data=NotificationRead.model_validate(notif),
    )


@router.patch("/{notification_id}/read", response_model=ApiResponse[NotificationRead])
def mark_notification_as_read(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationRead]:
    """
    Mark an unread notification as read.
    """
    stmt = select(Notification).where(Notification.id == notification_id)
    notif = db.execute(stmt).scalar_one_or_none()

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found",
        )

    notif.is_read = True
    notif.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notif)

    return ApiResponse(
        success=True,
        message="Notification marked as read",
        data=NotificationRead.model_validate(notif),
    )
