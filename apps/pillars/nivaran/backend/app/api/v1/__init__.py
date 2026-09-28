from fastapi import APIRouter
from app.api.v1.applicant import router as applicant_router
from app.api.v1.authority import router as authority_router
from app.api.v1.grievances import router as grievances_router
from app.api.v1.health import router as health_router
from app.api.v1.session import router as session_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, prefix="/health", tags=["Health"])
api_v1_router.include_router(session_router, prefix="/session", tags=["Session"])
api_v1_router.include_router(authority_router, prefix="/authority", tags=["Authority"])
api_v1_router.include_router(applicant_router, prefix="/applicant", tags=["Applicant"])
api_v1_router.include_router(grievances_router, prefix="/grievances", tags=["Grievances"])

__all__ = ["api_v1_router"]
