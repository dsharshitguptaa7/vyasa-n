import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.schemas.response import ApiResponse, ApiErrorDetail
from app.schemas.health import HealthCheckData, DatabaseHealthData

router = APIRouter(prefix="/health", tags=["Health"])

START_TIME = time.time()


@router.get("", response_model=ApiResponse[HealthCheckData])
def check_service_health() -> ApiResponse[HealthCheckData]:
    """
    Service health check endpoint reporting process uptime and identity.
    """
    uptime_seconds = int(time.time() - START_TIME)
    health_data = HealthCheckData(
        service=settings.SERVICE_NAME,
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptimeSeconds=uptime_seconds,
        environment=settings.NODE_ENV,
        version="0.1.0",
    )
    return ApiResponse(
        success=True,
        message="VYASA Core is running",
        data=health_data,
    )


@router.get("/db", response_model=ApiResponse[DatabaseHealthData])
def check_database_health(db: Session = Depends(get_db)):
    """
    Database connectivity check pinging Neon PostgreSQL with SELECT 1.
    """
    start = time.perf_counter()
    try:
        db.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        db_data = DatabaseHealthData(
            status="connected",
            database="postgresql",
            timestamp=datetime.now(timezone.utc).isoformat(),
            latency_ms=latency_ms,
        )
        return ApiResponse(
            success=True,
            message="Database connection healthy",
            data=db_data,
        )
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        db_data = DatabaseHealthData(
            status="disconnected",
            database="postgresql",
            timestamp=datetime.now(timezone.utc).isoformat(),
            latency_ms=latency_ms,
            error="Failed to connect to database",
        )
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=ApiResponse(
                success=False,
                message="Database health check failed",
                data=db_data,
                error=ApiErrorDetail(code="DATABASE_UNAVAILABLE"),
            ).model_dump(),
        )
