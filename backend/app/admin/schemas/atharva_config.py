import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole, CategoryRoutingType


class AuthorityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vyasa_user_id: uuid.UUID
    role: NivaranRole
    name_snapshot: str
    email_snapshot: str
    phone_snapshot: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AuthorityStatusUpdate(BaseModel):
    is_active: bool


class SubjectClusterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cluster_number: int
    name: str
    description: Optional[str] = None
    is_active: bool
    assistant_dean_id: Optional[uuid.UUID] = None
    assistant_dean: Optional[AuthorityOut] = None
    subject_count: int = 0
    created_at: datetime
    updated_at: datetime


class SubjectClusterCreate(BaseModel):
    cluster_number: int
    name: str
    description: Optional[str] = None
    assistant_dean_id: Optional[uuid.UUID] = None
    is_active: bool = True


class SubjectClusterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cluster_number: Optional[int] = None


class SubjectClusterAssistantDeanUpdate(BaseModel):
    assistant_dean_id: Optional[uuid.UUID] = None


class SubjectClusterStatusUpdate(BaseModel):
    is_active: bool


class SubjectCreate(BaseModel):
    name: str
    subject_cluster_id: uuid.UUID
    code: Optional[str] = None
    is_active: bool = True


class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    subject_cluster_id: Optional[uuid.UUID] = None


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: Optional[str] = None
    name: str
    subject_cluster_id: uuid.UUID
    cluster_name: Optional[str] = None
    cluster_number: Optional[int] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SubjectStatusUpdate(BaseModel):
    is_active: bool


class SubjectMappingUpdate(BaseModel):
    subject_cluster_id: uuid.UUID


class GrievanceClusterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cluster_number: int
    name: str
    description: Optional[str] = None
    is_active: bool
    associate_dean_id: Optional[uuid.UUID] = None
    associate_dean: Optional[AuthorityOut] = None
    category_count: int = 0
    created_at: datetime
    updated_at: datetime


class GrievanceClusterAssociateDeanUpdate(BaseModel):
    associate_dean_id: Optional[uuid.UUID] = None


class GrievanceClusterStatusUpdate(BaseModel):
    is_active: bool


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    routing_type: CategoryRoutingType
    grievance_cluster_id: Optional[uuid.UUID] = None
    cluster_name: Optional[str] = None
    cluster_number: Optional[int] = None
    fixed_authority_id: Optional[uuid.UUID] = None
    fixed_authority_name: Optional[str] = None
    fixed_authority_role: Optional[NivaranRole] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CategoryRoutingUpdate(BaseModel):
    routing_type: CategoryRoutingType
    grievance_cluster_id: Optional[uuid.UUID] = None
    fixed_authority_id: Optional[uuid.UUID] = None


class CategoryStatusUpdate(BaseModel):
    is_active: bool


class AtharvaConfigSummary(BaseModel):
    total_authorities: int
    active_authorities: int
    role_counts: Dict[str, int]
    total_subject_clusters: int
    active_subject_clusters: int
    total_subjects: int
    active_subjects: int
    total_grievance_clusters: int
    active_grievance_clusters: int
    total_categories: int
    active_categories: int
    categories_by_routing_type: Dict[str, int]


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_email: Optional[str] = None
    module: str
    action: str
    entity_name: str
    entity_id: str
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime


class PaginatedAuditLogs(BaseModel):
    total: int
    logs: List[AuditLogOut]
