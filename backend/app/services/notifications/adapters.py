import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationDelivery, NotificationPreference
from app.models.user import User
from app.services.notifications.contracts import NotificationChannel, DeliveryStatus

logger = logging.getLogger("vyasa.notifications.adapters")


class DeliveryResult:
    def __init__(
        self,
        channel: NotificationChannel,
        status: DeliveryStatus,
        attempt_count: int = 1,
        error_message: Optional[str] = None,
        recipient_destination: Optional[str] = None,
    ):
        self.channel = channel
        self.status = status
        self.attempt_count = attempt_count
        self.error_message = error_message
        self.recipient_destination = recipient_destination


class BaseDeliveryAdapter(ABC):
    channel: NotificationChannel

    @abstractmethod
    def deliver(
        self,
        db: Session,
        notification: Notification,
        user: User,
        preference: Optional[NotificationPreference] = None,
    ) -> DeliveryResult:
        pass


class InAppDeliveryAdapter(BaseDeliveryAdapter):
    channel = NotificationChannel.IN_APP

    def deliver(
        self,
        db: Session,
        notification: Notification,
        user: User,
        preference: Optional[NotificationPreference] = None,
    ) -> DeliveryResult:
        if preference and not preference.in_app_enabled:
            return DeliveryResult(
                channel=self.channel,
                status=DeliveryStatus.SKIPPED,
                recipient_destination=f"user:{user.id}",
                error_message="User opted out of in-app delivery for this event",
            )

        return DeliveryResult(
            channel=self.channel,
            status=DeliveryStatus.SENT,
            recipient_destination=f"user:{user.id}",
        )


class EmailDeliveryAdapter(BaseDeliveryAdapter):
    channel = NotificationChannel.EMAIL

    def __init__(self, sender_service=None):
        self.sender_service = sender_service

    def _get_sender(self):
        if self.sender_service:
            return self.sender_service
        from app.services.notifications.email_service import email_sender_service
        return email_sender_service

    def deliver(
        self,
        db: Session,
        notification: Notification,
        user: User,
        preference: Optional[NotificationPreference] = None,
    ) -> DeliveryResult:
        user_email = (user.email or "").strip()
        if not user_email:
            return DeliveryResult(
                channel=self.channel,
                status=DeliveryStatus.SKIPPED,
                recipient_destination="no-email",
                error_message="Target user has no email address configured",
            )

        if preference and not preference.email_enabled:
            return DeliveryResult(
                channel=self.channel,
                status=DeliveryStatus.SKIPPED,
                recipient_destination=user_email,
                error_message="User opted out of email delivery for this event",
            )

        sender = self._get_sender()
        if not sender.validate_recipient_email(user_email):
            return DeliveryResult(
                channel=self.channel,
                status=DeliveryStatus.SKIPPED,
                recipient_destination=user_email,
                error_message=f"Recipient address '{user_email}' is not a valid email format",
            )

        try:
            subject, html_content, text_content = self._render_email_content(notification, user)
            success, err = sender.send_email(
                recipient_email=user_email,
                subject=subject,
                html_content=html_content,
                text_content=text_content,
            )

            if success:
                return DeliveryResult(
                    channel=self.channel,
                    status=DeliveryStatus.SENT,
                    recipient_destination=user_email,
                )
            else:
                return DeliveryResult(
                    channel=self.channel,
                    status=DeliveryStatus.FAILED,
                    error_message=err or "Email dispatch failed",
                    recipient_destination=user_email,
                )
        except Exception as e:
            # Sanitize error detail to never expose connection strings, passwords, or secrets
            sanitized_err = str(e).split(":")[-1].strip() or "Transient email gateway error"
            logger.error(f"[Email Delivery Error] Failed to send email to {user_email}: {sanitized_err}")
            return DeliveryResult(
                channel=self.channel,
                status=DeliveryStatus.FAILED,
                error_message=sanitized_err[:255],
                recipient_destination=user_email,
            )

    def _render_email_content(
        self,
        notification: Notification,
        user: User,
    ) -> Tuple[str, str, str]:
        from app.core.config import settings
        from app.services.notifications.email_templates import (
            render_email_layout,
            build_authority_login_email,
            build_authority_unusual_login_email,
            build_document_request_email,
            build_grievance_resolved_email,
            build_grievance_closed_email,
        )

        evt = notification.event_type or ""
        meta = notification.metadata_json or {}
        base_portal = settings.PORTAL_BASE_URL.rstrip("/")
        support_email = settings.SUPPORT_CONTACT_EMAIL

        if evt == "auth.login_confirmation":
            return build_authority_login_email(
                account_identifier=meta.get("account_identifier") or user.email,
                login_time_str=meta.get("login_time") or "Recently",
                ip_address=meta.get("ip_address"),
                user_agent=meta.get("user_agent"),
                portal_url=meta.get("portal_url") or f"{base_portal}/governance",
                support_email=support_email,
            )

        if evt == "auth.unusual_login_alert":
            return build_authority_unusual_login_email(
                account_identifier=meta.get("account_identifier") or user.email,
                login_time_str=meta.get("login_time") or "Recently",
                reason=meta.get("reason") or "New device or unusual login pattern detected",
                ip_address=meta.get("ip_address"),
                user_agent=meta.get("user_agent"),
                portal_url=meta.get("portal_url") or f"{base_portal}/governance",
                support_email=support_email,
            )

        if evt == "grievance.document_requested":
            tracking_id = meta.get("tracking_id") or notification.entity_id or "GRV-CASE"
            docs = meta.get("requested_documents") or []
            if isinstance(docs, str):
                docs = [docs]
            instructions = meta.get("instructions") or notification.message
            deadline = meta.get("deadline")
            action_path = notification.action_route or f"/modules/atharva-veda/nivaran/grievance/{notification.entity_id}"
            portal_link = meta.get("portal_link") or f"{base_portal}{action_path}"
            return build_document_request_email(
                tracking_id=tracking_id,
                requested_documents=docs,
                instructions=instructions,
                deadline_str=deadline,
                portal_link=portal_link,
                support_email=support_email,
            )

        if evt in ("grievance.resolved", "grievance.feedback_requested"):
            tracking_id = meta.get("tracking_id") or notification.entity_id or "GRV-CASE"
            resolution_summary = meta.get("resolution_summary") or notification.message
            action_path = notification.action_route or f"/modules/atharva-veda/nivaran/grievance/{notification.entity_id}"
            feedback_link = meta.get("feedback_link") or f"{base_portal}{action_path}"
            return build_grievance_resolved_email(
                tracking_id=tracking_id,
                resolution_summary=resolution_summary,
                feedback_link=feedback_link,
                support_email=support_email,
            )

        if evt == "grievance.closed":
            tracking_id = meta.get("tracking_id") or notification.entity_id or "GRV-CASE"
            closure_date = meta.get("closure_date") or meta.get("closed_at_str")
            if not closure_date:
                closure_date = notification.created_at.strftime("%d %b %Y, %I:%M %p") if notification.created_at else "Recently"
            closure_summary = meta.get("closure_summary") or notification.message
            action_path = notification.action_route or f"/modules/atharva-veda/nivaran/grievance/{notification.entity_id}"
            dossier_link = meta.get("dossier_link") or f"{base_portal}{action_path}"
            return build_grievance_closed_email(
                tracking_id=tracking_id,
                closure_date_str=closure_date,
                closure_summary=closure_summary,
                dossier_link=dossier_link,
                support_email=support_email,
            )

        # Fallback / Generic Event Layout
        pillar_name = notification.source_pillar or "VYASA_CORE"
        from app.services.notifications.registry import registry
        pillar_display = registry.get_display_name(pillar_name)

        subject = f"[{pillar_display}] {notification.title}"
        action_btn = None
        if notification.action_route:
            action_url = f"{base_portal}{notification.action_route}"
            action_btn = ("View Details in Portal", action_url)

        html_body, text_body = render_email_layout(
            title=subject,
            preheader=notification.title,
            headline=notification.title,
            body_paragraphs=[notification.message],
            action_button=action_btn,
            pillar_label=pillar_display,
            is_alert=(notification.priority == "CRITICAL"),
            support_email=support_email,
        )
        return subject, html_body, text_body
