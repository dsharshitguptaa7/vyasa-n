from fastapi import APIRouter
from app.api.routes import health, pillars, users, roles, permissions, notifications, auth, applicant
from app.modules import modules_router
from app.admin import router as admin_router
from app.watchdog import router as watchdog_router

api_router = APIRouter()

# Core API routes
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(applicant.router)
api_router.include_router(pillars.router)
api_router.include_router(users.router)
api_router.include_router(roles.router)
api_router.include_router(permissions.router)
api_router.include_router(notifications.router)

# Veda Governance Modules
api_router.include_router(modules_router)

# Administration Console
api_router.include_router(admin_router)

# Operational Watchdog
api_router.include_router(watchdog_router)
