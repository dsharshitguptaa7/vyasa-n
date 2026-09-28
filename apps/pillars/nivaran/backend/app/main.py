import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.ai.pipeline import ai_pipeline
from app.api import api_v1_router
from app.api.v1.health import get_health
from app.core.config import settings
from app.core.database import check_database_connection
from app.schemas.health import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("nivaran")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VYASA-NIVARAN Backend Foundation...")
    db_ok = check_database_connection()
    if db_ok:
        logger.info("Database connectivity check: OK")
    else:
        logger.warning("Database connectivity check: FAILED (Check network/credentials in .env)")

    # Initialize and pre-load local AI Pipeline
    logger.info("Loading local NIVARAN AI Classifier Pipeline...")
    ai_pipeline.initialize()
    logger.info("Local NIVARAN AI Classifier Pipeline loaded and verified successfully.")

    yield
    logger.info("Shutting down VYASA-NIVARAN Backend Foundation.")



app = FastAPI(
    title="VYASA NIVARAN Pillar API",
    description="Grievance Management, Academic Dispute Arbitration & Evidentiary Dossier Engine",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root health endpoints
@app.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check() -> HealthResponse:
    return get_health()


@app.get("/", tags=["Root"])
def root():
    return {
        "service": settings.SERVICE_NAME,
        "pillar": "nivaran",
        "ecosystem": "VYASA",
        "status": "operational",
        "version": "1.0.0",
    }


# Include API v1 router
app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
