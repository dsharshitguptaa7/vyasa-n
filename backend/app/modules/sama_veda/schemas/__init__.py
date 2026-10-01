"""
Sama Veda Request and Response Schemas (Reserved Boundary)
"""
from pydantic import BaseModel


class SamaVedaStatusResponse(BaseModel):
    module_key: str
    status: str
    message: str
