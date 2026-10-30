from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ImportRowError(BaseModel):
    row: int
    field: Optional[str] = None
    message: str
    value: Optional[Any] = None


class ReconciliationItem(BaseModel):
    action: str  # 'create' | 'update' | 'skip' | 'review' | 'fail'
    identifier: str
    reason: str
    record_summary: Dict[str, Any]
    conflict_details: Optional[Dict[str, Any]] = None


class ImportPreviewResponse(BaseModel):
    batch_id: UUID
    batch_number: str
    entity_type: str
    mode: str = "preview"
    total_rows: int
    create_count: int
    update_count: int
    skip_count: int
    review_count: int
    fail_count: int
    errors: List[ImportRowError] = []
    items: List[ReconciliationItem] = []
    reconciliation_summary: Dict[str, Any] = {}


class ImportExecuteResponse(BaseModel):
    batch_id: UUID
    batch_number: str
    entity_type: str
    status: str
    total_rows: int
    created_count: int
    updated_count: int
    skipped_count: int
    failed_count: int
    review_count: int
    executed_at: Optional[datetime] = None
    audit_event_id: Optional[str] = None


class ImportBatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    batch_number: str
    entity_type: str
    source_filename: str
    file_format: str
    mode: str
    status: str
    total_rows: int
    created_count: int
    updated_count: int
    skipped_count: int
    failed_count: int
    review_count: int
    error_summary: Optional[List[Dict[str, Any]]] = None
    reconciliation_report: Optional[Dict[str, Any]] = None
    imported_by_id: Optional[UUID] = None
    executed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ImportBatchListResponse(BaseModel):
    items: List[ImportBatchOut]
    total: int
    skip: int
    limit: int


class HistoricalBundleImportRequest(BaseModel):
    source_directory: Optional[str] = Field(None, description="Path to historical folder if custom, defaults to canonical path")
    dry_run: bool = Field(True, description="When True, only previews and validates without writing domain records")
    import_bulletins: bool = True
    import_publications: bool = True
    import_authors: bool = True
    import_certificates: bool = True
    import_cam_projects: bool = True
    import_fellowships: bool = True
    import_spotlights: bool = True
