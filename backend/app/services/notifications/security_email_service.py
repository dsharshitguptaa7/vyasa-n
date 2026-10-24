"""
VYASAᴺ Authority Authentication Security Notification Service.

Fulfills Phase 3 Requirements:
1. Dispatches security notices on successful authority dashboard authentication.
2. Differentiates between routine logins and unusual logins/new-device detections.
3. Automatically triggers high-priority alerts upon backup recovery-code usage.
4. Restricts notifications to verified institutional authorities and administrators;
   ordinary applicant/scholar logins are strictly bypassed.
5. Employs non-blocking, fail-open design: delivery errors never impede, delay,
   or roll back user authentication.
6. Strictly avoids leaking passwords, OTPs, TOTP secrets, recovery codes, or JWTs.
7. Documents heuristic limitations of User-Agent device recognition.
"""

import logging
import secrets
import time
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.audit import AuditLog
from app.services.two_factor_service import TwoFactorService
from app.schemas.notification import NotificationEventPayload

logger = logging.getLogger("vyasa.auth.security_email")


class AuthoritySecurityEmailService:
    """
    Manages institutional security alerts for authority logins within the VYASAᴺ ecosystem.
    """

    AUTHORITY_ROLES = frozenset({
        "super_admin",
        "authority",
        "administrator",
        "admin",
        "dean",
        "associate_dean",
        "assistant_dean",
        "manager",
        "vice_chancellor",
        "registrar",
    })

    LOGIN_ACTIONS = frozenset({
        "auth.login_success",
        "auth.two_factor_verification_succeeded",
        "auth.two_factor_recovery_code_used",
        "auth.two_factor_setup_confirmed",
    })

    @classmethod
    def is_authority_user(cls, user: Optional[User], db: Session) -> bool:
        """
        Determines whether a user is an institutional authority or administrator.
        Returns False for regular applicants/students without administrative appointments.
        """
        if not user:
            return False

        # 1. Role-based check
        if user.roles:
            for r in user.roles:
                role_name = getattr(r, "name", "").lower()
                if role_name in cls.AUTHORITY_ROLES:
                    return True

        # 2. Mandatory 2FA check (includes active NivaranAuthority appointments)
        try:
            if TwoFactorService.is_2fa_mandatory_for_user(user, db):
                return True
        except Exception as e:
            logger.debug(f"2FA mandatory evaluation skipped or failed: {e}")

        return False

    @classmethod
    def evaluate_unusual_login(
        cls,
        db: Session,
        user: User,
        current_user_agent: Optional[str] = None,
        used_recovery_code: bool = False,
        login_time: Optional[datetime] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates whether the authentication event exhibits unusual characteristics.

        Signal 1: Usage of a backup recovery code is always considered a security-sensitive event.
        Signal 2: New/unrecognized User-Agent compared against the user's historical audit trail.

        Architectural Note on Device Recognition:
        In standard web protocols, User-Agent strings provide heuristic client identification.
        They do not represent tamper-proof hardware fingerprints. Browser updates or slight
        configuration shifts can alter the string. Per system requirements, an IP address change
        alone is NOT treated as conclusive evidence of suspicious activity.
        """
        # Signal 1: Backup recovery code used
        if used_recovery_code:
            return True, "A backup recovery code was used to authenticate to your authority account"

        if not current_user_agent or not current_user_agent.strip():
            # Without User-Agent, cannot evaluate device disparity
            return False, None

        normalized_ua = current_user_agent.strip()
        ref_time = login_time or datetime.now(timezone.utc)

        try:
            # Query prior successful authentications strictly before the current login timestamp
            query = (
                select(AuditLog.user_agent)
                .where(
                    AuditLog.user_id == user.id,
                    AuditLog.action.in_(cls.LOGIN_ACTIONS),
                    AuditLog.user_agent.is_not(None),
                    AuditLog.created_at < ref_time,
                )
                .order_by(AuditLog.created_at.desc())
                .limit(50)
            )
            past_user_agents: List[str] = db.scalars(query).all()

            # Filter out empty or whitespace-only records
            clean_past_uas = {ua.strip() for ua in past_user_agents if ua and ua.strip()}

            # If user has a documented history of past logins, but current UA has never been observed
            if clean_past_uas and normalized_ua not in clean_past_uas:
                return True, "Login detected from a new or unrecognized browser/device"

        except Exception as e:
            logger.warning(f"Error evaluating login audit history for user {user.id}: {e}")

        return False, None

    @classmethod
    def handle_successful_authority_login(
        cls,
        db: Session,
        user: User,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        used_recovery_code: bool = False,
        login_timestamp: Optional[datetime] = None,
    ) -> None:
        """
        Dispatches institutional security notifications upon completion of authority authentication.

        Guarantees:
        - Non-blocking & fail-open: any internal error is caught and logged; user authentication
          is never rolled back or impeded.
        - Privacy: No credentials, tokens, OTPs, or recovery codes are included in payloads or logs.
        - Precision: Applicants are strictly ignored.
        """
        try:
            if not cls.is_authority_user(user, db):
                return

            now = login_timestamp or datetime.now(timezone.utc)
            formatted_time = now.strftime("%d %b %Y, %I:%M %p UTC")

            is_unusual, reason = cls.evaluate_unusual_login(
                db=db,
                user=user,
                current_user_agent=user_agent,
                used_recovery_code=used_recovery_code,
                login_time=now,
            )

            account_identifier = getattr(user, "email", None) or getattr(user, "username", "Authority")
            event_type = "auth.unusual_login_alert" if is_unusual else "auth.login_confirmation"
            priority = "CRITICAL" if is_unusual else "MEDIUM"

            if is_unusual:
                title = "VYASAᴺ Security Alert: Unusual Login Detected on Authority Account"
                message = f"Security alert: {reason} for authority account {account_identifier}."
            else:
                title = "VYASAᴺ Security Notice: Successful Authority Dashboard Login"
                message = f"Authority login confirmed for {account_identifier} on {formatted_time}."

            event_id = f"auth_sec_{user.id}_{int(time.time())}_{secrets.token_hex(4)}"

            payload = NotificationEventPayload(
                source_pillar="VYASA_CORE",
                event_type=event_type,
                event_id=event_id,
                title=title,
                message=message,
                priority=priority,
                action_route="/governance",
                action_required=is_unusual,
                entity_type="user",
                entity_id=str(user.id),
                recipient_user_ids=[user.id],
                channel_override=["EMAIL", "IN_APP"],
                metadata={
                    "account_identifier": account_identifier,
                    "login_time": formatted_time,
                    "ip_address": client_ip,
                    "user_agent": user_agent,
                    "reason": reason if is_unusual else None,
                    "used_recovery_code": used_recovery_code,
                },
            )

            from app.services.notifications.engine import engine as notification_engine
            notification_engine.process_event(db=db, event=payload)
            logger.info(f"[Authority Security Email] Dispatched {event_type} for user {user.id}")

        except Exception as exc:
            # Strictly fail-open: Never disrupt the login flow
            logger.error(f"[Authority Security Email] Safe dispatch failed for user {getattr(user, 'id', 'unknown')}: {exc}")
