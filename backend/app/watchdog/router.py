from fastapi import APIRouter
from app.schemas.response import ApiResponse
from app.watchdog.telemetry import WatchdogTelemetry

router = APIRouter(prefix="/watchdog", tags=["Operational Watchdog & Health Telemetry"])


@router.get("/metrics", response_model=ApiResponse)
def get_watchdog_metrics():
    """
    Reserved operational telemetry endpoint.
    Exposes database pool health and system vitality without leaking credentials.
    """
    metrics = WatchdogTelemetry.get_pool_status()
    return ApiResponse(
        success=True,
        message="Watchdog operational telemetry captured.",
        data=metrics,
    )
