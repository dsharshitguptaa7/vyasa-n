"""
Central VYASA-N Notification Engine
Core orchestrator for:
- Event Ingestion & Validation
- Idempotency & Deduplication
- Dynamic Recipient Resolution
- Template Resolution & Parameter Interpolation
- Preference Check & Delivery Channel Dispatch
- In-App & Email Delivery Adapter execution
- Delivery Outcome & Audit Logging
"""
import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.orm import Session, selectinload

from app.models.notification import (
    Notification,
    NotificationPreference,
    NotificationTemplate,
    NotificationDelivery,
)
from app.models.user import User
from app.schemas.notification import NotificationEventPayload
from app.services.notifications.contracts import (
    NotificationPriority,
    NotificationChannel,
    DeliveryStatus,
)
from app.services.notifications.registry import registry
from app.services.notifications.adapters import (
    InAppDeliveryAdapter,
    EmailDeliveryAdapter,
    DeliveryResult,
)

logger = logging.getLogger("vyasa.notifications.engine")


class NotificationEngine:
    def __init__(self):
        self.in_app_adapter = InAppDeliveryAdapter()
        self.email_adapter = EmailDeliveryAdapter()

    def process_event(
        self,
        db: Session,
        event: NotificationEventPayload,
    ) -> List[Notification]:
        """
        Processes an ecosystem event contract payload:
        1. Validates source pillar and event type in registry.
        2. Resolves recipient user UUIDs.
        3. Enforces idempotency via event_id deduplication.
        4. Interpolates title, body, action_route from registered templates.
        5. Persists Notification records.
        6. Dispatches to delivery adapters (In-App and Email) according to user preferences.
        7. Logs delivery attempts into NotificationDelivery table.
        """
        # Resolve authoritative source pillar
        pillar_id = registry.resolve_pillar_for_event(
            event_type=event.event_type,
            entity_type=event.entity_type,
            explicit_pillar=event.source_pillar,
        )
        pillar = registry.get_pillar(pillar_id)
        if not pillar:
            logger.warning(f"[Notification Engine] Unknown pillar '{pillar_id}' - processing with generic fallback.")
            event_def = None
        else:
            event_def = pillar.get_event(event.event_type)

        # 1. Resolve Recipient User IDs
        recipient_ids: List[uuid.UUID] = []
        if event.recipient_user_ids:
            recipient_ids.extend(event.recipient_user_ids)
        elif pillar and pillar.recipient_resolver:
            resolved = pillar.recipient_resolver(db, event.event_type, event.model_dump())
            recipient_ids.extend(resolved)

        if not recipient_ids:
            logger.info(f"[Notification Engine] No eligible recipients resolved for event {event.event_type} on {pillar_id}.")
            return []

        # Remove duplicates while preserving order
        unique_recipients: List[uuid.UUID] = []
        for uid in recipient_ids:
            if uid not in unique_recipients:
                unique_recipients.append(uid)

        # 2. Prepare Template Parameters for interpolation
        template_vars = {
            "pillar": registry.get_display_name(pillar_id),
            "event_type": event.event_type,
            "entity_type": event.entity_type or "",
            "entity_id": event.entity_id or "",
            **(event.metadata or {}),
        }

        # Priority resolution
        priority_str = event.priority or (event_def.template.default_priority.value if event_def else "MEDIUM")
        action_required = event.action_required or (event_def.template.is_action_required if event_def else False)
        category_type = event_def.category if event_def else "info"

        created_notifications: List[Notification] = []

        for user_id in unique_recipients:
            # 3. Idempotency Check: if event_id is given, check if already delivered to this user
            if event.event_id:
                existing = db.scalar(
                    select(Notification).where(
                        Notification.user_id == user_id,
                        Notification.event_id == event.event_id,
                    )
                )
                if existing:
                    logger.info(f"[Notification Engine] Duplicate event {event.event_id} skipped for user {user_id}.")
                    created_notifications.append(existing)
                    continue

            # Verify target user exists and is active
            target_user = db.scalar(select(User).where(User.id == user_id))
            if not target_user or not target_user.is_active:
                logger.warning(f"[Notification Engine] Skipping inactive or non-existent recipient {user_id}.")
                continue

            # 4. Resolve Title & Message & Route
            title = event.title
            body = event.message
            action_route = event.action_route

            if not title or not body:
                # Check DB template override first
                db_template = db.scalar(
                    select(NotificationTemplate).where(
                        NotificationTemplate.source_pillar == pillar_id,
                        NotificationTemplate.event_type == event.event_type,
                        NotificationTemplate.is_enabled.is_(True),
                    )
                )
                if db_template:
                    title = title or self._interpolate(db_template.title_template, template_vars)
                    body = body or self._interpolate(db_template.body_template, template_vars)
                    if not action_route and db_template.action_route_template:
                        action_route = self._interpolate(db_template.action_route_template, template_vars)
                elif event_def:
                    title = title or self._interpolate(event_def.template.title_template, template_vars)
                    body = body or self._interpolate(event_def.template.body_template, template_vars)
                    if not action_route and event_def.template.action_route_template:
                        action_route = self._interpolate(event_def.template.action_route_template, template_vars)

            title = title or f"{pillar_id}: {event.event_type}"
            body = body or f"Event {event.event_type} occurred in {pillar_id}."

            # 5. Check User Notification Preferences
            user_pref = db.scalar(
                select(NotificationPreference).where(
                    NotificationPreference.user_id == user_id,
                    or_(
                        NotificationPreference.source_pillar == pillar_id,
                        NotificationPreference.source_pillar == "*",
                    ),
                    or_(
                        NotificationPreference.event_type == event.event_type,
                        NotificationPreference.event_type == "*",
                    ),
                ).order_by(
                    # Specific preferences take precedence over wildcards
                    NotificationPreference.source_pillar.desc(),
                    NotificationPreference.event_type.desc(),
                )
            )

            # 6. Create Notification Record
            notif = Notification(
                user_id=user_id,
                source_pillar=pillar_id,
                event_type=event.event_type,
                event_id=event.event_id,
                title=title,
                message=body,
                type=category_type,
                priority=priority_str,
                action_route=action_route,
                action_required=action_required,
                entity_type=event.entity_type,
                entity_id=event.entity_id,
                metadata_json=event.metadata,
                is_read=False,
            )
            db.add(notif)
            db.flush()

            # 7. Delivery Channel Execution
            channels_to_dispatch = event.channel_override or (pillar.channels if pillar else ["IN_APP", "EMAIL"])

            # In-App Delivery
            if NotificationChannel.IN_APP.value in channels_to_dispatch:
                in_app_res = self.in_app_adapter.deliver(db, notif, target_user, user_pref)
                delivery_log = NotificationDelivery(
                    notification_id=notif.id,
                    channel=in_app_res.channel.value,
                    status=in_app_res.status.value,
                    attempt_count=in_app_res.attempt_count,
                    error_message=in_app_res.error_message,
                    recipient_destination=in_app_res.recipient_destination,
                )
                db.add(delivery_log)

            # Email Delivery
            if NotificationChannel.EMAIL.value in channels_to_dispatch:
                email_res = self.email_adapter.deliver(db, notif, target_user, user_pref)
                delivery_log = NotificationDelivery(
                    notification_id=notif.id,
                    channel=email_res.channel.value,
                    status=email_res.status.value,
                    attempt_count=email_res.attempt_count,
                    error_message=email_res.error_message,
                    recipient_destination=email_res.recipient_destination,
                )
                db.add(delivery_log)

            created_notifications.append(notif)

        db.commit()
        for n in created_notifications:
            db.refresh(n)

        return created_notifications

    def _interpolate(self, template_str: str, data: Dict[str, Any]) -> str:
        """Safely formats template with variables, leaving missing keys intact."""
        try:
            return template_str.format_map(SafeDict(data))
        except Exception:
            return template_str

    # -------------------------------------------------------------------------
    # Notification Store Query Methods
    # -------------------------------------------------------------------------
    def list_notifications(
        self,
        db: Session,
        user_id: uuid.UUID,
        is_read: Optional[bool] = None,
        source_pillar: Optional[str] = None,
        priority: Optional[str] = None,
        action_required: Optional[bool] = None,
        event_type: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[Notification], int, int, int]:
        """
        Lists notifications for a user with comprehensive filters and metadata totals.
        Returns: (notifications, total_count, unread_count, action_required_count)
        """
        base_filter = [Notification.user_id == user_id]

        if is_read is not None:
            base_filter.append(Notification.is_read == is_read)
        if source_pillar and source_pillar.strip() != "ALL":
            base_filter.append(Notification.source_pillar == source_pillar.strip().upper())
        if priority and priority.strip() != "ALL":
            base_filter.append(Notification.priority == priority.strip().upper())
        if action_required is not None:
            base_filter.append(Notification.action_required == action_required)
        if event_type:
            base_filter.append(Notification.event_type == event_type.strip())
        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            base_filter.append(
                or_(
                    func.lower(Notification.title).like(term),
                    func.lower(Notification.message).like(term),
                )
            )

        query = (
            select(Notification)
            .options(selectinload(Notification.deliveries))
            .where(*base_filter)
            .order_by(Notification.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        notifs = list(db.execute(query).scalars().all())

        # Totals
        total_count = db.scalar(select(func.count(Notification.id)).where(*base_filter)) or 0
        unread_count = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        ) or 0
        action_required_count = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.action_required.is_(True),
                Notification.is_read.is_(False),
            )
        ) or 0

        return notifs, total_count, unread_count, action_required_count

    def get_user_summary(self, db: Session, user_id: uuid.UUID) -> Dict[str, Any]:
        """Calculates notification counts grouped by pillar, status, and priority."""
        total = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user_id)) or 0
        unread = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.is_read.is_(False),
            )
        ) or 0
        action_req = db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id,
                Notification.action_required.is_(True),
            )
        ) or 0

        # By Pillar
        pillar_rows = db.execute(
            select(Notification.source_pillar, func.count(Notification.id))
            .where(Notification.user_id == user_id)
            .group_by(Notification.source_pillar)
        ).all()
        by_pillar = {row[0]: row[1] for row in pillar_rows}

        # By Priority
        priority_rows = db.execute(
            select(Notification.priority, func.count(Notification.id))
            .where(Notification.user_id == user_id)
            .group_by(Notification.priority)
        ).all()
        by_priority = {row[0]: row[1] for row in priority_rows}

        return {
            "total_count": total,
            "unread_count": unread,
            "action_required_count": action_req,
            "by_pillar": by_pillar,
            "by_priority": by_priority,
        }

    def mark_as_read(self, db: Session, notification_id: uuid.UUID, user_id: Optional[uuid.UUID] = None) -> Optional[Notification]:
        stmt = select(Notification).where(Notification.id == notification_id)
        if user_id:
            stmt = stmt.where(Notification.user_id == user_id)
        notif = db.scalar(stmt)
        if not notif:
            return None

        notif.is_read = True
        notif.read_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(notif)
        return notif

    def mark_all_as_read(
        self,
        db: Session,
        user_id: uuid.UUID,
        source_pillar: Optional[str] = None,
    ) -> int:
        filters = [
            Notification.user_id == user_id,
            Notification.is_read.is_(False),
        ]
        if source_pillar and source_pillar.strip() != "ALL":
            filters.append(Notification.source_pillar == source_pillar.strip().upper())

        now = datetime.now(timezone.utc)
        stmt = (
            update(Notification)
            .where(*filters)
            .values(is_read=True, read_at=now)
        )
        result = db.execute(stmt)
        db.commit()
        return result.rowcount


class SafeDict(dict):
    """Fallback dict that returns '{key}' if a key is missing during formatting."""
    def __missing__(self, key):
        return f"{{{key}}}"


engine = NotificationEngine()
