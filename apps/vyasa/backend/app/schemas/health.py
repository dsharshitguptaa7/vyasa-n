from typing import Optional
from pydantic import BaseModel


class HealthCheckData(BaseModel):
    service: str
    status: str
    timestamp: str
    uptimeSeconds: int
    environment: str
    version: str


class DatabaseHealthData(BaseModel):
    status: str
    database: str
    timestamp: str
    latency_ms: Optional[float] = None
    error: Optional[str] = None
