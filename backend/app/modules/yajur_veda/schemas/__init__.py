"""
Yajur Veda Request and Response Schemas (Reserved Boundary)
"""
from pydantic import BaseModel


class YajurVedaStatusResponse(BaseModel):
    module_key: str
    status: str
    message: str
