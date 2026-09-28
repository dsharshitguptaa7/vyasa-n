import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    user_id: uuid.UUID
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
    type: str = Field(default="info", max_length=64)
    metadata_json: Optional[Dict[str, Any]] = None


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    type: str
    is_read: bool
    read_at: Optional[datetime] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class NotificationListResponse(BaseModel):
    count: int
    notifications: List[NotificationRead]
