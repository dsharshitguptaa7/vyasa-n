import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, computed_field


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    type: str = Field(default="info", max_length=64)
    source_pillar: Optional[str] = Field(default=None, max_length=64)
    event_type: Optional[str] = Field(default=None, max_length=100)
    event_id: Optional[str] = Field(default=None, max_length=100)
    priority: str = Field(default="MEDIUM", max_length=32)
    action_route: Optional[str] = Field(default=None, max_length=500)
    action_required: bool = False
    entity_type: Optional[str] = Field(default=None, max_length=64)
    entity_id: Optional[str] = Field(default=None, max_length=100)
    metadata_json: Optional[Dict[str, Any]] = None


class NotificationDeliveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel: str
    status: str
    attempt_count: int
    last_attempt_at: datetime
    error_message: Optional[str] = None
    recipient_destination: Optional[str] = None
    created_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    source_pillar: str
    event_type: Optional[str] = None
    event_id: Optional[str] = None
    title: str
    message: str
    type: str
    priority: str = "MEDIUM"
    action_route: Optional[str] = None
    action_required: bool = False
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    deliveries: Optional[List[NotificationDeliveryRead]] = None

    @computed_field
    @property
    def source_display_name(self) -> str:
        from app.services.notifications.registry import registry
        return registry.get_display_name(self.source_pillar)


class NotificationListResponse(BaseModel):
    count: int
    unread_count: int = 0
    action_required_count: int = 0
    notifications: List[NotificationRead]


class NotificationSummaryResponse(BaseModel):
    total_count: int
    unread_count: int
    action_required_count: int
    by_pillar: Dict[str, int] = {}
    by_priority: Dict[str, int] = {}


class NotificationEventPayload(BaseModel):
    """
    Standard Ecosystem Event Contract Payload.
    Used by all pillars (NIVARAN, VYASA AI, Rig Veda, etc.) to publish lifecycle events.
    """
    event_id: Optional[str] = Field(
        default=None,
        description="Unique event ID for deduplication / idempotent retries",
    )
    source_pillar: str = Field(
        ...,
        description="Originating pillar code e.g. 'NIVARAN', 'VYASA_AI', 'RIG_VEDA'",
    )
    event_type: str = Field(
        ...,
        description="Standardized event category e.g. 'grievance.submitted', 'authority.case_assigned'",
    )
    title: Optional[str] = Field(
        default=None,
        description="Optional custom title (falls back to registered pillar template if omitted)",
    )
    message: Optional[str] = Field(
        default=None,
        description="Optional custom message body (falls back to registered pillar template)",
    )
    priority: Optional[str] = Field(
        default=None,
        description="Priority: LOW, MEDIUM, HIGH, CRITICAL",
    )
    action_route: Optional[str] = Field(
        default=None,
        description="Safe internal destination URL e.g. '/modules/atharva-veda/nivaran/grievance/123'",
    )
    action_required: bool = Field(
        default=False,
        description="True if user input/review/evidence is required",
    )
    entity_type: Optional[str] = Field(
        default=None,
        description="Entity type: 'grievance', 'document', 'efile', 'inquiry'",
    )
    entity_id: Optional[str] = Field(
        default=None,
        description="Domain entity primary key / reference identifier",
    )
    recipient_user_ids: Optional[List[uuid.UUID]] = Field(
        default=None,
        description="Direct list of target recipient user UUIDs",
    )
    recipient_role_target: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Role-based dynamic recipient resolution parameters e.g. {'role': 'MANAGER'}",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default_factory=dict,
        description="Contextual metadata for template variable interpolation and UI details",
    )
    channel_override: Optional[List[str]] = Field(
        default=None,
        description="Optional channel overrides e.g. ['IN_APP', 'EMAIL']",
    )


class NotificationPreferenceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    source_pillar: str
    event_type: str
    in_app_enabled: bool
    email_enabled: bool
    created_at: datetime
    updated_at: datetime


class NotificationPreferenceUpdate(BaseModel):
    source_pillar: str = "*"
    event_type: str = "*"
    in_app_enabled: bool = True
    email_enabled: bool = True


class NotificationTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_pillar: str
    event_type: str
    title_template: str
    body_template: str
    action_route_template: Optional[str] = None
    default_priority: str
    is_action_required: bool
    is_enabled: bool
    version: int
    created_at: datetime


class PillarInfo(BaseModel):
    pillar_id: str
    display_name: str
    description: str
    supported_events: List[str]
    channels: List[str]
