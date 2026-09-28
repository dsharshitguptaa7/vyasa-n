from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class PillarMetadataResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: Optional[str] = None
    route: Optional[str] = None
    status: str
    enabled: bool
    requiredRoles: List[str] = Field(default_factory=list)
    version: Optional[str] = None
    endpointUrl: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None


class PillarListResponse(BaseModel):
    count: int
    pillars: List[PillarMetadataResponse]
