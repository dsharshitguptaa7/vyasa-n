"""
Yajur Veda Domain Services
Includes ANUDAAN (Research Publication Incentive Management System) service layer.
"""
from app.modules.yajur_veda.services.anudaan_service import AnudaanService


class YajurVedaService:
    @staticmethod
    def get_status() -> dict:
        return {"status": "planned", "veda": "Yajur Veda: Research Administration & Incentives"}


__all__ = ["YajurVedaService", "AnudaanService"]
