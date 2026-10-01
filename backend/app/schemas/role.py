import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class PermissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    resource: str
    action: str
    description: Optional[str] = None
    created_at: datetime


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    is_system: bool
    created_at: datetime


class RoleWithPermissions(RoleRead):
    permissions: List[PermissionRead] = Field(default_factory=list)


class RoleListResponse(BaseModel):
    count: int
    roles: List[RoleWithPermissions]


class PermissionListResponse(BaseModel):
    count: int
    permissions: List[PermissionRead]
