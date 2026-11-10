"""
Yajur Veda Request and Response Schemas
Includes ANUDAAN (Research Publication Incentive Management System) schemas.
"""
from pydantic import BaseModel

from app.modules.yajur_veda.schemas.anudaan import (
    AnudaanBankAccountInput,
    AnudaanSafeBankAccountOut,
    AnudaanAuthorCreate,
    AnudaanAuthorUpdate,
    AnudaanAuthorOut,
    AnudaanDocumentOut,
    AnudaanPublicationCreate,
    AnudaanPublicationUpdate,
    AnudaanPublicationOut,
    AnudaanDeclarationAcceptance,
    AnudaanDeclarationOut,
    AnudaanApplicationCreateDraft,
    AnudaanApplicationUpdateDraft,
    AnudaanApplicationSubmitRequest,
    AnudaanDraftCreationResponse,
    AnudaanApplicationDetailOut,
    AnudaanTrackingRequest,
    AnudaanTrackingPublicationSummary,
    AnudaanTrackingStatusResponse,
    MANDATORY_DECLARATION_TYPES,
    DRAFT_DECLARATION_TEXTS,
)


class YajurVedaStatusResponse(BaseModel):
    module_key: str
    status: str
    message: str


__all__ = [
    "YajurVedaStatusResponse",
    "AnudaanBankAccountInput",
    "AnudaanSafeBankAccountOut",
    "AnudaanAuthorCreate",
    "AnudaanAuthorUpdate",
    "AnudaanAuthorOut",
    "AnudaanDocumentOut",
    "AnudaanPublicationCreate",
    "AnudaanPublicationUpdate",
    "AnudaanPublicationOut",
    "AnudaanDeclarationAcceptance",
    "AnudaanDeclarationOut",
    "AnudaanApplicationCreateDraft",
    "AnudaanApplicationUpdateDraft",
    "AnudaanApplicationSubmitRequest",
    "AnudaanDraftCreationResponse",
    "AnudaanApplicationDetailOut",
    "AnudaanTrackingRequest",
    "AnudaanTrackingPublicationSummary",
    "AnudaanTrackingStatusResponse",
]
