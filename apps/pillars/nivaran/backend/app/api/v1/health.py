from fastapi import APIRouter
from app.core.config import settings
from app.core.database import check_database_connection
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """
    Health check verifying service status and active database connectivity.
    Never exposes internal connection strings or credentials.
    """
    db_connected = check_database_connection()
    return HealthResponse(
        status="ok" if db_connected else "degraded",
        service=settings.SERVICE_NAME,
        environment=settings.ENVIRONMENT,
        database="connected" if db_connected else "disconnected",
    )
