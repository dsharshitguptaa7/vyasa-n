import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.core.database import engine, SessionLocal, check_database_connection
from app.core.logging import logger
from app.services.seed_service import seed_all
from app.api.router import api_router
from app.schemas.response import ApiResponse, ApiErrorDetail


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Application lifespan manager for startup and shutdown procedures.
    """
    logger.info("Initializing VYASA Core backend service...")
    
    # 1. Verify Database Connection
    if check_database_connection():
        logger.info("PostgreSQL database connection verified successfully.")
    else:
        logger.warning("Database connection could not be verified on startup.")

    # 2. Run Idempotent Seeding
    try:
        with SessionLocal() as db:
            seed_results = seed_all(db)
            logger.info("Database seeding completed: %s", seed_results)
    except Exception as exc:
        logger.error("Failed to execute database seeding: %s", str(exc))

    yield

    # Teardown database engine pool
    logger.info("Shutting down VYASA Core backend service...")
    engine.dispose()


app = FastAPI(
    title="VYASA Core Governance Backend",
    description="Foundational platform and identity service for the VYASA ecosystem",
    version="0.1.0",
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


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_req: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ApiResponse(
            success=False,
            message=str(exc.detail),
            error=ApiErrorDetail(code=f"HTTP_{exc.status_code}"),
        ).model_dump(),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_req: Request, exc: RequestValidationError):
    serialized_errors = []
    for err in exc.errors():
        item = dict(err)
        if "ctx" in item and isinstance(item["ctx"], dict):
            ctx = dict(item["ctx"])
            if "error" in ctx:
                ctx["error"] = str(ctx["error"])
            item["ctx"] = ctx
        serialized_errors.append(item)

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=ApiResponse(
            success=False,
            message="Request validation failed",
            error=ApiErrorDetail(code="VALIDATION_ERROR", details=serialized_errors),
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(_req: Request, exc: Exception):
    logger.error("Unhandled exception: %s", str(exc), exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ApiResponse(
            success=False,
            message="Internal server error",
            error=ApiErrorDetail(code="INTERNAL_SERVER_ERROR"),
        ).model_dump(),
    )


# Mount API Router
app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/")
def root_status():
    return {
        "service": settings.SERVICE_NAME,
        "environment": settings.NODE_ENV,
        "status": "online",
        "docs": "/docs",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
