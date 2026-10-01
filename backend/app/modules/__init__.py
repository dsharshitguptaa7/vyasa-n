"""
VYASA Veda Governance Modules
Root package exporting module routers.
"""
from fastapi import APIRouter
from app.modules.rig_veda import router as rig_veda_router
from app.modules.yajur_veda import router as yajur_veda_router
from app.modules.sama_veda import router as sama_veda_router
from app.modules.atharva_veda.nivaran import router as atharva_veda_router

modules_router = APIRouter()
modules_router.include_router(rig_veda_router)
modules_router.include_router(yajur_veda_router)
modules_router.include_router(sama_veda_router)
modules_router.include_router(atharva_veda_router)

__all__ = ["modules_router"]
