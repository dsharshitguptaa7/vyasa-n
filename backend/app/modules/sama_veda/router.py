from fastapi import APIRouter
from app.core.registry import get_module_by_key
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/modules/sama-veda", tags=["Sama Veda: Research Recognition & Communication"])


@router.get("/status", response_model=ApiResponse)
def get_sama_veda_status():
    """
    Architectural boundary status endpoint for Sama Veda (Research Recognition & Communication).
    Business logic and workflows scheduled for future development phases.
    """
    module = get_module_by_key("sama_veda")
    return ApiResponse(
        success=True,
        message="Sama Veda architectural boundary active. Domain business logic planned.",
        data=module.model_dump() if module else {"status": "planned"},
    )
