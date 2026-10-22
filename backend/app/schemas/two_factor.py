from datetime import datetime
from uuid import UUID
from typing import List, Optional
from pydantic import BaseModel, Field


class TwoFactorChallengeResponse(BaseModel):
    requires_two_factor: bool = True
    two_factor_setup_required: bool
    challenge_id: UUID
    message: str


class TwoFactorSetupResponse(BaseModel):
    challenge_id: UUID
    requires_2fa_setup: bool = True
    issuer: str
    account_name: str
    qr_code: str
    manual_setup_key: str


class TwoFactorConfirmSetupRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")


class TwoFactorVerifyRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")


class TwoFactorRecoveryRequest(BaseModel):
    challenge_id: UUID
    recovery_code: str = Field(..., min_length=8, max_length=32, description="Backup recovery code")


class TwoFactorStatusResponse(BaseModel):
    is_enabled: bool
    enabled_at: Optional[datetime] = None
    last_verified_at: Optional[datetime] = None
    remaining_recovery_codes: int = 0


class TwoFactorRegenerateRecoveryCodesRequest(BaseModel):
    password: str
    code: str = Field(..., min_length=6, max_length=6, description="Current 6-digit TOTP code")


class TwoFactorRecoveryCodesResponse(BaseModel):
    recovery_codes: List[str]
    message: str
