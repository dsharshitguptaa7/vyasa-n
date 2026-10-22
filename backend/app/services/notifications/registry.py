"""
Unified Notification Pillar Registry
Provides an open, future-proof registry for all VYASA-N pillars to register:
- Module identifier (e.g. 'NIVARAN', 'VYASA_AI', 'RIG_VEDA')
- Supported event types & metadata
- Approved notification templates
- Dynamic recipient resolution callbacks
- Default priority rules and destination routes
- Supported delivery channels
"""
import logging
from typing import Dict, List, Optional, Callable, Any
import uuid
from sqlalchemy.orm import Session

from app.services.notifications.contracts import (
    EventDefinition,
    TemplateDefinition,
    NotificationPriority,
    NotificationChannel,
)
from app.services.notifications.nivaran_catalogue import (
    NIVARAN_EVENTS,
    resolve_nivaran_recipients,
)

logger = logging.getLogger("vyasa.notifications.registry")


class RegisteredPillar:
    def __init__(
        self,
        pillar_id: str,
        display_name: str,
        description: str,
        events: Dict[str, EventDefinition],
        recipient_resolver: Optional[Callable[[Session, str, dict], List[uuid.UUID]]] = None,
        channels: Optional[List[str]] = None,
    ):
        self.pillar_id = pillar_id.upper()
        self.display_name = display_name
        self.description = description
        self.events = events
        self.recipient_resolver = recipient_resolver
        self.channels = channels or [NotificationChannel.IN_APP.value, NotificationChannel.EMAIL.value]

    def get_event(self, event_type: str) -> Optional[EventDefinition]:
        return self.events.get(event_type)


class NotificationPillarRegistry:
    _instance: Optional["NotificationPillarRegistry"] = None
    _pillars: Dict[str, RegisteredPillar] = {}

    def __init__(self):
        self._pillars = {}
        self._bootstrap_builtin_pillars()

    @classmethod
    def get_instance(cls) -> "NotificationPillarRegistry":
        if cls._instance is None:
            cls._instance = NotificationPillarRegistry()
        return cls._instance

    def register_pillar(
        self,
        pillar_id: str,
        display_name: str,
        description: str,
        events: Dict[str, EventDefinition],
        recipient_resolver: Optional[Callable[[Session, str, dict], List[uuid.UUID]]] = None,
        channels: Optional[List[str]] = None,
    ) -> RegisteredPillar:
        """
        Registers an independent pillar into the central VYASA-N Notification Centre.
        """
        key = pillar_id.upper()
        pillar = RegisteredPillar(
            pillar_id=key,
            display_name=display_name,
            description=description,
            events=events,
            recipient_resolver=recipient_resolver,
            channels=channels,
        )
        self._pillars[key] = pillar
        logger.info(f"[Notification Registry] Registered pillar '{key}' with {len(events)} events.")
        return pillar

    def get_pillar(self, pillar_id: str) -> Optional[RegisteredPillar]:
        if not pillar_id:
            return None
        key = pillar_id.strip().upper()
        if key == "CORE":
            key = "VYASA_CORE"
        return self._pillars.get(key)

    def get_display_name(self, pillar_id: Optional[str]) -> str:
        """
        Authoritatively resolves the human-readable branding label for a pillar ID:
        - NIVARAN -> 'VYASA-N | NIVARAN'
        - VYASA_AI -> 'VYASA-N | VYASA AI'
        - VYASA_CORE / CORE -> 'VYASA-N | CORE'
        - Future / Unregistered pillar -> 'VYASA-N | [PILLAR_ID]'
        Never silently mislabels unknown or unregistered pillars as CORE.
        """
        if not pillar_id:
            return "VYASA-N"
        key = pillar_id.strip().upper()
        if key == "CORE":
            key = "VYASA_CORE"
        pillar = self.get_pillar(key)
        if pillar:
            return pillar.display_name
        # Fallback for future or unregistered pillars without defaulting to CORE
        return f"VYASA-N | {key}"

    def resolve_pillar_for_event(
        self,
        event_type: Optional[str] = None,
        entity_type: Optional[str] = None,
        explicit_pillar: Optional[str] = None,
    ) -> str:
        """
        Determines the authoritative pillar identifier based on explicit input or business event type:
        - Grievance events -> 'NIVARAN'
        - VYASA AI events -> 'VYASA_AI'
        - Genuine platform announcements -> 'VYASA_CORE'
        - Explicit registered/future pillar -> preserved exactly as provided
        """
        # If caller passed an explicit non-core pillar, respect it
        if explicit_pillar and explicit_pillar.strip().upper() not in {"", "VYASA_CORE", "CORE"}:
            return explicit_pillar.strip().upper()

        if event_type:
            evt = event_type.strip().lower()
            # 1. Search registered pillars for matching event
            for p_id, p_obj in self._pillars.items():
                if evt in p_obj.events:
                    return p_id

            # 2. Heuristic domain prefixes
            if any(evt.startswith(prefix) for prefix in ["grievance.", "manager.", "authority.", "committee."]):
                return "NIVARAN"
            if any(evt.startswith(prefix) for prefix in ["inquiry.", "guideline.", "knowledge.", "ai."]):
                return "VYASA_AI"
            if evt.startswith("platform."):
                return "VYASA_CORE"

        if entity_type and entity_type.strip().lower() in {"grievance", "efile", "dossier", "inquiry_case"}:
            return "NIVARAN"

        if explicit_pillar and explicit_pillar.strip().upper() in {"VYASA_CORE", "CORE"}:
            return "VYASA_CORE"

        return explicit_pillar.strip().upper() if explicit_pillar else "VYASA_CORE"

    def list_pillars(self) -> List[RegisteredPillar]:
        return list(self._pillars.values())

    def _bootstrap_builtin_pillars(self) -> None:
        """Bootstraps built-in initial pillars: NIVARAN, VYASA AI, and VYASA CORE."""
        # 1. Atharva Veda: NIVARAN-AI Grievance Redressal
        self.register_pillar(
            pillar_id="NIVARAN",
            display_name="VYASA-N | NIVARAN",
            description="Institutional Grievance Redressal and Dispute Resolution Pillar",
            events=NIVARAN_EVENTS,
            recipient_resolver=resolve_nivaran_recipients,
            channels=[NotificationChannel.IN_APP.value, NotificationChannel.EMAIL.value],
        )

        # 2. Public / Scholar Research AI Assistant (VYASA AI)
        vyasa_ai_events = {
            "inquiry.answered": EventDefinition(
                event_type="inquiry.answered",
                description="AI Research or Doctoral Regulation inquiry response generated",
                category="info",
                template=TemplateDefinition(
                    title_template="VYASA AI Response: {topic}",
                    body_template="Your doctoral inquiry regarding '{topic}' has been processed with official academic regulations.",
                    action_route_template="/phd-admission",
                    default_priority=NotificationPriority.LOW,
                    is_action_required=False,
                ),
                allowed_roles=["applicant", "authority"],
            ),
            "guideline.updated": EventDefinition(
                event_type="guideline.updated",
                description="Ph.D. Ordinance or Academic Regulation amendment announcement",
                category="info",
                template=TemplateDefinition(
                    title_template="Academic Ordinance Bulletin: {title}",
                    body_template="CSJMU Academic Council has published updated Ph.D. guidelines: {summary}.",
                    action_route_template="/phd-admission",
                    default_priority=NotificationPriority.MEDIUM,
                    is_action_required=False,
                ),
                allowed_roles=["applicant", "authority"],
            ),
        }
        self.register_pillar(
            pillar_id="VYASA_AI",
            display_name="VYASA-N | VYASA AI",
            description="Doctoral Research Regulations & Public AI Advisory Pillar",
            events=vyasa_ai_events,
            channels=[NotificationChannel.IN_APP.value, NotificationChannel.EMAIL.value],
        )

        # 3. VYASA Core Ecosystem Platform
        core_events = {
            "platform.onboarding": EventDefinition(
                event_type="platform.onboarding",
                description="Welcome to VYASA Ecosystem identity verification",
                category="info",
                template=TemplateDefinition(
                    title_template="Welcome to VYASAᴺ",
                    body_template="Your platform identity has been established across CSJMU governance pillars.",
                    action_route_template="/dashboard",
                    default_priority=NotificationPriority.LOW,
                    is_action_required=False,
                ),
                allowed_roles=["applicant", "authority", "administrator"],
            ),
            "platform.announcement": EventDefinition(
                event_type="platform.announcement",
                description="Ecosystem-wide administrative announcement",
                category="info",
                template=TemplateDefinition(
                    title_template="Ecosystem Bulletin: {headline}",
                    body_template="{announcement_body}",
                    action_route_template="/dashboard",
                    default_priority=NotificationPriority.HIGH,
                    is_action_required=False,
                ),
                allowed_roles=["applicant", "authority", "administrator"],
            ),
        }
        self.register_pillar(
            pillar_id="VYASA_CORE",
            display_name="VYASA-N | CORE",
            description="Central VYASA Institutional Identity & Platform Foundation",
            events=core_events,
            channels=[NotificationChannel.IN_APP.value, NotificationChannel.EMAIL.value],
        )


registry = NotificationPillarRegistry.get_instance()
