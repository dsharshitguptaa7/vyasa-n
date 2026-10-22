import enum
from typing import Dict, Any, List, Optional, Callable
from pydantic import BaseModel, Field
import uuid


class NotificationPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    EMAIL = "EMAIL"


class DeliveryStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class TemplateDefinition(BaseModel):
    title_template: str
    body_template: str
    action_route_template: Optional[str] = None
    default_priority: NotificationPriority = NotificationPriority.MEDIUM
    is_action_required: bool = False
    is_operational: bool = True  # Used e.g. for committee events registered in advance


class EventDefinition(BaseModel):
    event_type: str
    description: str
    category: str = "workflow"  # info, alert, task, workflow
    template: TemplateDefinition
    allowed_roles: List[str] = []
    is_operational: bool = True
