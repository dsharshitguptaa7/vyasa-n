import re
import uuid
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    """Payload for user authentication."""
    email: str = Field(..., description="User email address")
    password: str = Field(..., description="Plaintext password")


class AuthenticatedUserResponse(BaseModel):
    """Standardized user identity payload exposed to clients and pillars."""
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    roles: List[str]

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """OAuth2/JWT bearer token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUserResponse


class TokenVerifyRequest(BaseModel):
    """Payload submitted by independent pillars to verify a VYASA Bearer token."""
    token: str = Field(..., description="JWT access token string or Bearer token header value")


class TokenVerifyResponse(BaseModel):
    """Pillar verification response establishing identity authenticity."""
    valid: bool
    user: Optional[AuthenticatedUserResponse] = None


class SubjectResponse(BaseModel):
    """Institutional subject representation for registration catalog."""
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}


class ApplicantRegisterRequest(BaseModel):
    """Payload for applicant registration in VYASA Core."""
    full_name: str = Field(..., min_length=2, max_length=200, description="Applicant full legal name")
    email: str = Field(..., min_length=5, max_length=255, description="Applicant email address")
    password: str = Field(..., min_length=8, max_length=128, description="Account password")
    phone: Optional[str] = Field(None, max_length=20, description="Contact phone number")
    phd_registration_number: Optional[str] = Field(None, max_length=100, description="Doctoral PhD registration/roll number")
    department: Optional[str] = Field(None, max_length=150, description="Academic department")
    subject_id: uuid.UUID = Field(..., description="Canonical subject UUID from institutional catalog")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
            raise ValueError("Invalid email address format")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Full name cannot be blank")
        return clean

    @field_validator("phd_registration_number")
    @classmethod
    def validate_phd_reg(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            return clean if clean else None
        return None


class ApplicantRegistrationResponse(BaseModel):
    """Response returned upon successful applicant registration."""
    message: str = "Registration successful"
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str = "applicant"
    subject_id: uuid.UUID
    subject_name: str
    phd_registration_number: Optional[str] = None
