from fastapi import APIRouter
from app.api.routes import health, pillars, users, roles, permissions, notifications, auth, applicant

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(applicant.router)
api_router.include_router(pillars.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(permissions.router)
api_router.include_router(notifications.router)
