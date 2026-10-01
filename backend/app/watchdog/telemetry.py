"""
VYASA Watchdog: Operational Telemetry & Health Probe Reservation
"""
from typing import Dict, Any
from app.core.config import settings
from app.core.database import check_database_connection, engine


class WatchdogTelemetry:
    """
    Reserved operational telemetry collector for system health,
    database connection pool conditions, and service anomalies.
    """

    @staticmethod
    def get_pool_status() -> Dict[str, Any]:
        """
        Inspects SQLAlchemy connection pool metrics safely.
        """
        pool = engine.pool
        return {
            "pool_size": getattr(pool, "size", lambda: settings.DB_POOL_SIZE)(),
            "checked_in": getattr(pool, "checkedin", lambda: 0)(),
            "checked_out": getattr(pool, "checkedout", lambda: 0)(),
            "overflow": getattr(pool, "overflow", lambda: 0)(),
            "db_healthy": check_database_connection(),
        }
