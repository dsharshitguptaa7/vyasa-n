from fastapi import APIRouter
from app.core.registry import get_module_by_key
from app.schemas.response import ApiResponse

router = APIRouter(prefix="/modules/yajur-veda", tags=["Yajur Veda: Research Administration & Incentives"])


@router.get("/status", response_model=ApiResponse)
def get_yajur_veda_status():
    """
    Architectural boundary status endpoint for Yajur Veda (Research Administration & Incentives).
    Business logic and workflows scheduled for future development phases.
    """
    module = get_module_by_key("yajur_veda")
    return ApiResponse(
        success=True,
        message="Yajur Veda architectural boundary active. Domain business logic planned.",
        data=module.model_dump() if module else {"status": "planned"},
    )
