import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_db, get_pagination, get_optional_auth_payload
from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationDelivery,
)
from app.models.user import User
from app.schemas.common import ApiResponse, PaginationQuery
from app.schemas.notification import (
    NotificationCreate,
    NotificationRead,
    NotificationListResponse,
    NotificationSummaryResponse,
    NotificationEventPayload,
    NotificationPreferenceRead,
    NotificationPreferenceUpdate,
    PillarInfo,
)
from app.services.notifications.engine import engine as notification_engine
from app.services.notifications.registry import registry

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _resolve_target_user_id(
    explicit_user_id: Optional[uuid.UUID],
    auth_payload: Optional[Dict[str, Any]],
) -> Optional[uuid.UUID]:
    """Resolves target user ID from explicit query parameter or Bearer JWT claims."""
    if explicit_user_id:
        return explicit_user_id
    if auth_payload and auth_payload.get("sub"):
        try:
            return uuid.UUID(str(auth_payload["sub"]))
        except Exception:
            return None
    return None


@router.get("", response_model=ApiResponse[NotificationListResponse])
def list_notifications(
    user_id: Optional[uuid.UUID] = None,
    is_read: Optional[bool] = None,
    source_pillar: Optional[str] = None,
    priority: Optional[str] = None,
    action_required: Optional[bool] = None,
    event_type: Optional[str] = None,
    search: Optional[str] = None,
    pagination: PaginationQuery = Depends(get_pagination),
    auth_payload: Optional[Dict[str, Any]] = Depends(get_optional_auth_payload),
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationListResponse]:
    """
    List notifications with unified cross-pillar inbox filtering:
    - Persona-scoped by authenticated session or target user ID
    - Read/unread filter
    - Source pillar filter (e.g. 'NIVARAN', 'VYASA_AI', 'VYASA_CORE')
    - Action Required filter
    - Priority filter (LOW, MEDIUM, HIGH, CRITICAL)
    """
    target_uid = _resolve_target_user_id(user_id, auth_payload)

    if not target_uid:
        # If no user filter specified, return recent system notifications (for admin/test parity)
        stmt = select(Notification).order_by(Notification.created_at.desc())
        if is_read is not None:
            stmt = stmt.where(Notification.is_read == is_read)
        if source_pillar and source_pillar.strip() != "ALL":
            stmt = stmt.where(Notification.source_pillar == source_pillar.strip().upper())
        if priority and priority.strip() != "ALL":
            stmt = stmt.where(Notification.priority == priority.strip().upper())
        if action_required is not None:
            stmt = stmt.where(Notification.action_required == action_required)

        stmt = stmt.offset(pagination.skip).limit(pagination.limit)
        notifs = list(db.execute(stmt).scalars().all())
        mapped = [NotificationRead.model_validate(n) for n in notifs]
        return ApiResponse(
            success=True,
            message="Notifications retrieved successfully",
            data=NotificationListResponse(
                count=len(mapped),
                unread_count=sum(1 for n in mapped if not n.is_read),
                action_required_count=sum(1 for n in mapped if n.action_required and not n.is_read),
                notifications=mapped,
            ),
        )

    notifs, total_count, unread_count, action_req_count = notification_engine.list_notifications(
        db=db,
        user_id=target_uid,
        is_read=is_read,
        source_pillar=source_pillar,
        priority=priority,
        action_required=action_required,
        event_type=event_type,
        search=search,
        skip=pagination.skip,
        limit=pagination.limit,
    )
    mapped = [NotificationRead.model_validate(n) for n in notifs]

    return ApiResponse(
        success=True,
        message="Notifications retrieved successfully",
        data=NotificationListResponse(
            count=total_count,
            unread_count=unread_count,
            action_required_count=action_req_count,
            notifications=mapped,
        ),
    )


@router.get("/summary", response_model=ApiResponse[NotificationSummaryResponse])
def get_notifications_summary(
    user_id: Optional[uuid.UUID] = None,
    auth_payload: Optional[Dict[str, Any]] = Depends(get_optional_auth_payload),
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationSummaryResponse]:
    """
    Returns unread badge metrics and pillar distribution for notification bells.
    """
    target_uid = _resolve_target_user_id(user_id, auth_payload)
    if not target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated session or user_id parameter required to calculate summary",
        )

    summary = notification_engine.get_user_summary(db, target_uid)
    return ApiResponse(
        success=True,
        message="Notification summary retrieved successfully",
        data=NotificationSummaryResponse(**summary),
    )


@router.get("/pillars", response_model=ApiResponse[List[PillarInfo]])
def list_notification_pillars() -> ApiResponse[List[PillarInfo]]:
    """
    Lists registered ecosystem pillars, supported event types, and delivery capabilities.
    """
    pillars = registry.list_pillars()
    data = [
        PillarInfo(
            pillar_id=p.pillar_id,
            display_name=p.display_name,
            description=p.description,
            supported_events=list(p.events.keys()),
            channels=p.channels,
        )
        for p in pillars
    ]
    return ApiResponse(
        success=True,
        message="Registered pillars retrieved successfully",
        data=data,
    )


@router.post("", response_model=ApiResponse[NotificationRead], status_code=status.HTTP_201_CREATED)
def dispatch_notification(
    payload: NotificationCreate,
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationRead]:
    """
    Direct notification dispatch (backward-compatible with existing test suite).
    """
    resolved_pillar = registry.resolve_pillar_for_event(
        event_type=payload.event_type,
        entity_type=payload.entity_type,
        explicit_pillar=payload.source_pillar,
    )
    notif = Notification(
        user_id=payload.user_id,
        source_pillar=resolved_pillar,
        event_type=payload.event_type,
        event_id=payload.event_id,
        title=payload.title,
        message=payload.message,
        type=payload.type,
        priority=payload.priority.upper() if payload.priority else "MEDIUM",
        action_route=payload.action_route,
        action_required=payload.action_required,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
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


@router.post("/events", response_model=ApiResponse[List[NotificationRead]], status_code=status.HTTP_201_CREATED)
def ingest_pillar_event(
    payload: NotificationEventPayload,
    db: Session = Depends(get_db),
) -> ApiResponse[List[NotificationRead]]:
    """
    Ecosystem Event Producer Ingestion Endpoint.
    Consumes standard PillarEventContract payloads, resolves recipients, applies deduplication,
    evaluates preferences, and produces cross-channel notifications.
    """
    created_notifs = notification_engine.process_event(db, payload)
    mapped = [NotificationRead.model_validate(n) for n in created_notifs]

    return ApiResponse(
        success=True,
        message=f"Event '{payload.event_type}' processed successfully; {len(mapped)} notification(s) produced.",
        data=mapped,
    )


@router.patch("/{notification_id}/read", response_model=ApiResponse[NotificationRead])
def mark_notification_as_read(
    notification_id: uuid.UUID,
    user_id: Optional[uuid.UUID] = None,
    auth_payload: Optional[Dict[str, Any]] = Depends(get_optional_auth_payload),
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationRead]:
    """
    Mark an unread notification as read.
    """
    target_uid = _resolve_target_user_id(user_id, auth_payload)
    notif = notification_engine.mark_as_read(db, notification_id, target_uid)

    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found",
        )

    return ApiResponse(
        success=True,
        message="Notification marked as read",
        data=NotificationRead.model_validate(notif),
    )


@router.post("/mark-all-read", response_model=ApiResponse[Dict[str, int]])
def mark_all_notifications_as_read(
    source_pillar: Optional[str] = None,
    user_id: Optional[uuid.UUID] = None,
    auth_payload: Optional[Dict[str, Any]] = Depends(get_optional_auth_payload),
    db: Session = Depends(get_db),
) -> ApiResponse[Dict[str, int]]:
    """
    Mark all notifications as read for current user, optionally filtered by pillar.
    """
    target_uid = _resolve_target_user_id(user_id, auth_payload)
    if not target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User identity required to mark all notifications as read",
        )

    updated_count = notification_engine.mark_all_as_read(db, target_uid, source_pillar)
    return ApiResponse(
        success=True,
        message=f"{updated_count} notification(s) marked as read",
        data={"updated_count": updated_count},
    )


@router.get("/preferences", response_model=ApiResponse[List[NotificationPreferenceRead]])
def get_user_preferences(
    user_id: Optional[uuid.UUID] = None,
    auth_payload: Optional[Dict[str, Any]] = Depends(get_optional_auth_payload),
    db: Session = Depends(get_db),
) -> ApiResponse[List[NotificationPreferenceRead]]:
    """
    Retrieves user notification channel and event preferences.
    """
    target_uid = _resolve_target_user_id(user_id, auth_payload)
    if not target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User identity required to view notification preferences",
        )

    prefs = list(
        db.execute(
            select(NotificationPreference).where(NotificationPreference.user_id == target_uid)
        ).scalars().all()
    )
    mapped = [NotificationPreferenceRead.model_validate(p) for p in prefs]
    return ApiResponse(
        success=True,
        message="Notification preferences retrieved",
        data=mapped,
    )


@router.put("/preferences", response_model=ApiResponse[NotificationPreferenceRead])
def update_user_preference(
    payload: NotificationPreferenceUpdate,
    user_id: Optional[uuid.UUID] = None,
    auth_payload: Optional[Dict[str, Any]] = Depends(get_optional_auth_payload),
    db: Session = Depends(get_db),
) -> ApiResponse[NotificationPreferenceRead]:
    """
    Updates or inserts user notification preference for a specific pillar/event.
    """
    target_uid = _resolve_target_user_id(user_id, auth_payload)
    if not target_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User identity required to update notification preferences",
        )

    pillar_key = payload.source_pillar.strip().upper() if payload.source_pillar else "*"
    event_key = payload.event_type.strip() if payload.event_type else "*"

    pref = db.scalar(
        select(NotificationPreference).where(
            NotificationPreference.user_id == target_uid,
            NotificationPreference.source_pillar == pillar_key,
            NotificationPreference.event_type == event_key,
        )
    )

    if not pref:
        pref = NotificationPreference(
            user_id=target_uid,
            source_pillar=pillar_key,
            event_type=event_key,
            in_app_enabled=payload.in_app_enabled,
            email_enabled=payload.email_enabled,
        )
        db.add(pref)
    else:
        pref.in_app_enabled = payload.in_app_enabled
        pref.email_enabled = payload.email_enabled

    db.commit()
    db.refresh(pref)

    return ApiResponse(
        success=True,
        message="Notification preference updated successfully",
        data=NotificationPreferenceRead.model_validate(pref),
    )
