import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class ApplicantProfileResponse(BaseModel):
    """Institutional applicant profile representation for dashboard and session."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    full_name: str
    phone: Optional[str] = None
    roles: List[str]
    is_active: bool
    is_verified: bool
    phd_registration_number: Optional[str] = None
    department: Optional[str] = None
    subject_id: Optional[uuid.UUID] = None
    subject_name: Optional[str] = None
    created_at: datetime
