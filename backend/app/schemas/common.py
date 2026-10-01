from typing import Generic, TypeVar, Optional, Any, List
from datetime import datetime, timezone
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiErrorDetail(BaseModel):
    code: str
    details: Optional[Any] = None


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None
    error: Optional[ApiErrorDetail] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PaginationQuery(BaseModel):
    skip: int = Field(default=0, ge=0, description="Offset items to skip")
    limit: int = Field(default=50, ge=1, le=100, description="Max items to return")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    skip: int
    limit: int
