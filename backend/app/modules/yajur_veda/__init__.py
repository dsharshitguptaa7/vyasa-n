"""
Yajur Veda Module: Research Administration & Incentives
"""
import app.models  # Guarantees Base model registry initializes cleanly before router
from app.modules.yajur_veda.router import router

__all__ = ["router"]
