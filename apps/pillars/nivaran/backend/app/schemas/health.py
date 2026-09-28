from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Service status")
    service: str = Field(default="vyasa-nivaran-backend", description="Service name")
    environment: str = Field(default="development", description="Runtime environment")
    database: str = Field(default="unknown", description="Database connection health")
