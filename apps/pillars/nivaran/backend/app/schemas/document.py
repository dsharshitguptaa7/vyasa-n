"""Document schemas for NIVARAN Pillar."""

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class InitialDocumentAttachment(BaseModel):
    """Initial evidence document attachment metadata supplied at filing."""

    file_name: str = Field(..., min_length=1, max_length=255, description="Original filename")
    file_path: str = Field(..., min_length=1, max_length=1000, description="Relative storage path")
    mime_type: str = Field(..., min_length=3, max_length=100, description="File MIME type")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    document_type: Optional[str] = Field(default="ATTACHMENT", max_length=50, description="Category of document")
    storage_key: Optional[str] = Field(default=None, max_length=500, description="Object storage reference key")
    content_hash: Optional[str] = Field(default=None, max_length=64, description="SHA-256 checksum of content")


class ApplicantDocumentResponse(BaseModel):
    """Safe document metadata view returned to the applicant."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_name: str
    mime_type: str
    file_size: int
    document_type: Optional[str]
    created_at: datetime
