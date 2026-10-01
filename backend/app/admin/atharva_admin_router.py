import uuid
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.dependencies import get_db, require_admin_user
from app.models.user import User
from app.models.audit import AuditLog
from app.modules.atharva_veda.nivaran.models.authority import NivaranAuthority
from app.modules.atharva_veda.nivaran.models.taxonomy import SubjectCluster, Subject, GrievanceCluster, Category
from app.modules.atharva_veda.nivaran.models.enums import NivaranRole, CategoryRoutingType
from app.modules.atharva_veda.nivaran.services.admin_config_service import AdminConfigService
from app.schemas.response import ApiResponse
from app.admin.schemas.atharva_config import (
    AuthorityOut,
    AuthorityStatusUpdate,
    SubjectClusterOut,
    SubjectClusterCreate,
    SubjectClusterUpdate,
    SubjectClusterAssistantDeanUpdate,
    SubjectClusterStatusUpdate,
    SubjectOut,
    SubjectCreate,
    SubjectUpdate,
    SubjectStatusUpdate,
    SubjectMappingUpdate,
    GrievanceClusterOut,
    GrievanceClusterAssociateDeanUpdate,
    GrievanceClusterStatusUpdate,
    CategoryOut,
    CategoryRoutingUpdate,
    CategoryStatusUpdate,
    AtharvaConfigSummary,
    AuditLogOut,
    PaginatedAuditLogs,
)

atharva_admin_router = APIRouter(prefix="/atharva", tags=["Atharva Veda Admin Configuration"])


# ==========================================
# 1. SUMMARY
# ==========================================
@atharva_admin_router.get("/summary", response_model=ApiResponse)
def get_atharva_config_summary(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    """
    Returns platform-wide live summary metrics for Atharva Veda institutional taxonomy & routing.
    All counts are dynamic; no hardcoded institutional figures.
    """
    total_authorities = db.scalar(select(func.count(NivaranAuthority.id))) or 0
    active_authorities = db.scalar(select(func.count(NivaranAuthority.id)).where(NivaranAuthority.is_active == True)) or 0

    role_rows = db.execute(
        select(NivaranAuthority.role, func.count(NivaranAuthority.id))
        .where(NivaranAuthority.is_active == True)
        .group_by(NivaranAuthority.role)
    ).all()
    role_counts = {str(r[0].value if hasattr(r[0], 'value') else r[0]): r[1] for r in role_rows}

    total_subj_clusters = db.scalar(select(func.count(SubjectCluster.id))) or 0
    active_subj_clusters = db.scalar(select(func.count(SubjectCluster.id)).where(SubjectCluster.is_active == True)) or 0

    total_subjects = db.scalar(select(func.count(Subject.id))) or 0
    active_subjects = db.scalar(select(func.count(Subject.id)).where(Subject.is_active == True)) or 0

    total_grv_clusters = db.scalar(select(func.count(GrievanceCluster.id))) or 0
    active_grv_clusters = db.scalar(select(func.count(GrievanceCluster.id)).where(GrievanceCluster.is_active == True)) or 0

    total_categories = db.scalar(select(func.count(Category.id))) or 0
    active_categories = db.scalar(select(func.count(Category.id)).where(Category.is_active == True)) or 0

    cat_routing_rows = db.execute(
        select(Category.routing_type, func.count(Category.id))
        .where(Category.is_active == True)
        .group_by(Category.routing_type)
    ).all()
    categories_by_routing_type = {
        str(r[0].value if hasattr(r[0], 'value') else r[0]): r[1] for r in cat_routing_rows
    }

    summary = AtharvaConfigSummary(
        total_authorities=total_authorities,
        active_authorities=active_authorities,
        role_counts=role_counts,
        total_subject_clusters=total_subj_clusters,
        active_subject_clusters=active_subj_clusters,
        total_subjects=total_subjects,
        active_subjects=active_subjects,
        total_grievance_clusters=total_grv_clusters,
        active_grievance_clusters=active_grv_clusters,
        total_categories=total_categories,
        active_categories=active_categories,
        categories_by_routing_type=categories_by_routing_type,
    )

    return ApiResponse(
        success=True,
        message="Atharva Veda configuration summary retrieved successfully.",
        data=summary.model_dump(),
    )


# ==========================================
# 2. AUTHORITIES
# ==========================================
@atharva_admin_router.get("/authorities", response_model=ApiResponse)
def list_authorities(
    role: Optional[NivaranRole] = Query(None, description="Filter by authority role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    search: Optional[str] = Query(None, description="Search by name, email, designation, or department"),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    stmt = select(NivaranAuthority)
    if role:
        stmt = stmt.where(NivaranAuthority.role == role)
    if is_active is not None:
        stmt = stmt.where(NivaranAuthority.is_active == is_active)
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                NivaranAuthority.name_snapshot.ilike(search_pattern),
                NivaranAuthority.email_snapshot.ilike(search_pattern),
                NivaranAuthority.designation.ilike(search_pattern),
                NivaranAuthority.department.ilike(search_pattern),
            )
        )
    stmt = stmt.order_by(NivaranAuthority.name_snapshot.asc())
    records = db.execute(stmt).scalars().all()

    authorities_out = [AuthorityOut.model_validate(r) for r in records]
    return ApiResponse(
        success=True,
        message="Atharva Veda authorities retrieved successfully.",
        data={"authorities": [a.model_dump() for a in authorities_out]},
    )


@atharva_admin_router.patch("/authorities/{authority_id}/status", response_model=ApiResponse)
def update_authority_status(
    authority_id: uuid.UUID,
    payload: AuthorityStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.set_authority_active_status(
            db=db,
            authority_id=authority_id,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Authority '{updated.name_snapshot}' active status updated to {updated.is_active}.",
            data=AuthorityOut.model_validate(updated).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==========================================
# 3. SUBJECT CLUSTERS
# ==========================================
@atharva_admin_router.get("/subject-clusters", response_model=ApiResponse)
def list_subject_clusters(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    stmt = select(SubjectCluster).options(joinedload(SubjectCluster.assistant_dean)).order_by(SubjectCluster.cluster_number.asc())
    if is_active is not None:
        stmt = stmt.where(SubjectCluster.is_active == is_active)
    clusters = db.execute(stmt).scalars().all()

    # Pre-calculate subject counts per cluster
    subject_count_rows = db.execute(
        select(Subject.subject_cluster_id, func.count(Subject.id))
        .group_by(Subject.subject_cluster_id)
    ).all()
    count_map = {r[0]: r[1] for r in subject_count_rows}

    output = []
    for c in clusters:
        asst_dean_out = AuthorityOut.model_validate(c.assistant_dean) if c.assistant_dean else None
        output.append(
            SubjectClusterOut(
                id=c.id,
                cluster_number=c.cluster_number,
                name=c.name,
                description=c.description,
                is_active=c.is_active,
                assistant_dean_id=c.assistant_dean_id,
                assistant_dean=asst_dean_out,
                subject_count=count_map.get(c.id, 0),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )

    return ApiResponse(
        success=True,
        message="Subject clusters retrieved successfully.",
        data={"clusters": [item.model_dump() for item in output]},
    )


@atharva_admin_router.patch("/subject-clusters/{cluster_id}/assistant-dean", response_model=ApiResponse)
def update_subject_cluster_assistant_dean(
    cluster_id: uuid.UUID,
    payload: SubjectClusterAssistantDeanUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.update_subject_cluster_assistant_dean(
            db=db,
            cluster_id=cluster_id,
            new_assistant_dean_id=payload.assistant_dean_id,
            actor_user_id=admin_user.id,
        )
        asst_dean_out = AuthorityOut.model_validate(updated.assistant_dean) if updated.assistant_dean else None
        return ApiResponse(
            success=True,
            message=f"Subject Cluster '{updated.name}' Assistant Dean mapping reconfigured.",
            data=SubjectClusterOut(
                id=updated.id,
                cluster_number=updated.cluster_number,
                name=updated.name,
                description=updated.description,
                is_active=updated.is_active,
                assistant_dean_id=updated.assistant_dean_id,
                assistant_dean=asst_dean_out,
                subject_count=0,
                created_at=updated.created_at,
                updated_at=updated.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@atharva_admin_router.patch("/subject-clusters/{cluster_id}/status", response_model=ApiResponse)
def update_subject_cluster_status(
    cluster_id: uuid.UUID,
    payload: SubjectClusterStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.set_subject_cluster_active_status(
            db=db,
            cluster_id=cluster_id,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Subject Cluster '{updated.name}' active status set to {updated.is_active}.",
            data={"id": str(updated.id), "is_active": updated.is_active},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@atharva_admin_router.post("/subject-clusters", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_subject_cluster(
    payload: SubjectClusterCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        created = AdminConfigService.create_subject_cluster(
            db=db,
            cluster_number=payload.cluster_number,
            name=payload.name,
            description=payload.description,
            assistant_dean_id=payload.assistant_dean_id,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        asst_dean_out = AuthorityOut.model_validate(created.assistant_dean) if created.assistant_dean else None
        return ApiResponse(
            success=True,
            message=f"Subject Cluster '{created.name}' created successfully.",
            data=SubjectClusterOut(
                id=created.id,
                cluster_number=created.cluster_number,
                name=created.name,
                description=created.description,
                is_active=created.is_active,
                assistant_dean_id=created.assistant_dean_id,
                assistant_dean=asst_dean_out,
                subject_count=0,
                created_at=created.created_at,
                updated_at=created.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@atharva_admin_router.patch("/subject-clusters/{cluster_id}", response_model=ApiResponse)
def update_subject_cluster(
    cluster_id: uuid.UUID,
    payload: SubjectClusterUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.update_subject_cluster(
            db=db,
            cluster_id=cluster_id,
            name=payload.name,
            description=payload.description,
            cluster_number=payload.cluster_number,
            actor_user_id=admin_user.id,
        )
        asst_dean_out = AuthorityOut.model_validate(updated.assistant_dean) if updated.assistant_dean else None
        return ApiResponse(
            success=True,
            message=f"Subject Cluster '{updated.name}' updated successfully.",
            data=SubjectClusterOut(
                id=updated.id,
                cluster_number=updated.cluster_number,
                name=updated.name,
                description=updated.description,
                is_active=updated.is_active,
                assistant_dean_id=updated.assistant_dean_id,
                assistant_dean=asst_dean_out,
                subject_count=0,
                created_at=updated.created_at,
                updated_at=updated.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 4. SUBJECTS
# ==========================================
@atharva_admin_router.get("/subjects", response_model=ApiResponse)
def list_subjects(
    subject_cluster_id: Optional[uuid.UUID] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    stmt = select(Subject).options(joinedload(Subject.cluster)).order_by(Subject.name.asc())
    if subject_cluster_id:
        stmt = stmt.where(Subject.subject_cluster_id == subject_cluster_id)
    if is_active is not None:
        stmt = stmt.where(Subject.is_active == is_active)
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Subject.name.ilike(search_pattern),
                Subject.code.ilike(search_pattern),
            )
        )
    records = db.execute(stmt).scalars().all()

    output = []
    for s in records:
        output.append(
            SubjectOut(
                id=s.id,
                code=s.code,
                name=s.name,
                subject_cluster_id=s.subject_cluster_id,
                cluster_name=s.cluster.name if s.cluster else None,
                cluster_number=s.cluster.cluster_number if s.cluster else None,
                is_active=s.is_active,
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
        )

    return ApiResponse(
        success=True,
        message="Subjects retrieved successfully.",
        data={"subjects": [item.model_dump() for item in output]},
    )


@atharva_admin_router.patch("/subjects/{subject_id}/status", response_model=ApiResponse)
def update_subject_status(
    subject_id: uuid.UUID,
    payload: SubjectStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.set_subject_active_status(
            db=db,
            subject_id=subject_id,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Subject '{updated.name}' active status set to {updated.is_active}.",
            data={"id": str(updated.id), "is_active": updated.is_active},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@atharva_admin_router.patch("/subjects/{subject_id}/cluster", response_model=ApiResponse)
def update_subject_cluster_mapping(
    subject_id: uuid.UUID,
    payload: SubjectMappingUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.update_subject_mapping(
            db=db,
            subject_id=subject_id,
            new_cluster_id=payload.subject_cluster_id,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Subject '{updated.name}' re-mapped to cluster successfully.",
            data={"id": str(updated.id), "subject_cluster_id": str(updated.subject_cluster_id)},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@atharva_admin_router.post("/subjects", response_model=ApiResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        created = AdminConfigService.create_subject(
            db=db,
            name=payload.name,
            subject_cluster_id=payload.subject_cluster_id,
            code=payload.code,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Subject '{created.name}' created successfully.",
            data=SubjectOut(
                id=created.id,
                code=created.code,
                name=created.name,
                subject_cluster_id=created.subject_cluster_id,
                cluster_name=created.cluster.name if created.cluster else None,
                cluster_number=created.cluster.cluster_number if created.cluster else None,
                is_active=created.is_active,
                created_at=created.created_at,
                updated_at=created.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@atharva_admin_router.patch("/subjects/{subject_id}", response_model=ApiResponse)
def update_subject(
    subject_id: uuid.UUID,
    payload: SubjectUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.update_subject(
            db=db,
            subject_id=subject_id,
            name=payload.name,
            code=payload.code,
            subject_cluster_id=payload.subject_cluster_id,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Subject '{updated.name}' updated successfully.",
            data=SubjectOut(
                id=updated.id,
                code=updated.code,
                name=updated.name,
                subject_cluster_id=updated.subject_cluster_id,
                cluster_name=updated.cluster.name if updated.cluster else None,
                cluster_number=updated.cluster.cluster_number if updated.cluster else None,
                is_active=updated.is_active,
                created_at=updated.created_at,
                updated_at=updated.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ==========================================
# 5. GRIEVANCE CLUSTERS
# ==========================================
@atharva_admin_router.get("/grievance-clusters", response_model=ApiResponse)
def list_grievance_clusters(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    stmt = select(GrievanceCluster).options(joinedload(GrievanceCluster.associate_dean)).order_by(GrievanceCluster.cluster_number.asc())
    if is_active is not None:
        stmt = stmt.where(GrievanceCluster.is_active == is_active)
    clusters = db.execute(stmt).scalars().all()

    # Pre-calculate category count per grievance cluster
    category_count_rows = db.execute(
        select(Category.grievance_cluster_id, func.count(Category.id))
        .where(Category.grievance_cluster_id.is_not(None))
        .group_by(Category.grievance_cluster_id)
    ).all()
    count_map = {r[0]: r[1] for r in category_count_rows}

    output = []
    for c in clusters:
        assoc_dean_out = AuthorityOut.model_validate(c.associate_dean) if c.associate_dean else None
        output.append(
            GrievanceClusterOut(
                id=c.id,
                cluster_number=c.cluster_number,
                name=c.name,
                description=c.description,
                is_active=c.is_active,
                associate_dean_id=c.associate_dean_id,
                associate_dean=assoc_dean_out,
                category_count=count_map.get(c.id, 0),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )

    return ApiResponse(
        success=True,
        message="Grievance clusters retrieved successfully.",
        data={"clusters": [item.model_dump() for item in output]},
    )


@atharva_admin_router.patch("/grievance-clusters/{cluster_id}/associate-dean", response_model=ApiResponse)
def update_grievance_cluster_associate_dean(
    cluster_id: uuid.UUID,
    payload: GrievanceClusterAssociateDeanUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.update_grievance_cluster_associate_dean(
            db=db,
            cluster_id=cluster_id,
            new_associate_dean_id=payload.associate_dean_id,
            actor_user_id=admin_user.id,
        )
        assoc_dean_out = AuthorityOut.model_validate(updated.associate_dean) if updated.associate_dean else None
        return ApiResponse(
            success=True,
            message=f"Grievance Cluster '{updated.name}' Associate Dean mapping reconfigured.",
            data=GrievanceClusterOut(
                id=updated.id,
                cluster_number=updated.cluster_number,
                name=updated.name,
                description=updated.description,
                is_active=updated.is_active,
                associate_dean_id=updated.associate_dean_id,
                associate_dean=assoc_dean_out,
                category_count=0,
                created_at=updated.created_at,
                updated_at=updated.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@atharva_admin_router.patch("/grievance-clusters/{cluster_id}/status", response_model=ApiResponse)
def update_grievance_cluster_status(
    cluster_id: uuid.UUID,
    payload: GrievanceClusterStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.set_grievance_cluster_active_status(
            db=db,
            cluster_id=cluster_id,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Grievance Cluster '{updated.name}' active status set to {updated.is_active}.",
            data={"id": str(updated.id), "is_active": updated.is_active},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==========================================
# 6. CATEGORIES
# ==========================================
@atharva_admin_router.get("/categories", response_model=ApiResponse)
def list_categories(
    routing_type: Optional[CategoryRoutingType] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    stmt = (
        select(Category)
        .options(
            joinedload(Category.grievance_cluster),
            joinedload(Category.fixed_authority),
        )
        .order_by(Category.name.asc())
    )
    if routing_type:
        stmt = stmt.where(Category.routing_type == routing_type)
    if is_active is not None:
        stmt = stmt.where(Category.is_active == is_active)
    if search:
        search_pattern = f"%{search.strip()}%"
        stmt = stmt.where(Category.name.ilike(search_pattern))

    records = db.execute(stmt).scalars().all()

    output = []
    for c in records:
        output.append(
            CategoryOut(
                id=c.id,
                name=c.name,
                routing_type=c.routing_type,
                grievance_cluster_id=c.grievance_cluster_id,
                cluster_name=c.grievance_cluster.name if c.grievance_cluster else None,
                cluster_number=c.grievance_cluster.cluster_number if c.grievance_cluster else None,
                fixed_authority_id=c.fixed_authority_id,
                fixed_authority_name=c.fixed_authority.name_snapshot if c.fixed_authority else None,
                fixed_authority_role=c.fixed_authority.role if c.fixed_authority else None,
                is_active=c.is_active,
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
        )

    return ApiResponse(
        success=True,
        message="Grievance categories retrieved successfully.",
        data={"categories": [item.model_dump() for item in output]},
    )


@atharva_admin_router.patch("/categories/{category_id}/routing", response_model=ApiResponse)
def update_category_routing(
    category_id: uuid.UUID,
    payload: CategoryRoutingUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.update_category_routing(
            db=db,
            category_id=category_id,
            routing_type=payload.routing_type,
            grievance_cluster_id=payload.grievance_cluster_id,
            fixed_authority_id=payload.fixed_authority_id,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Category '{updated.name}' routing reconfigured to {updated.routing_type}.",
            data=CategoryOut(
                id=updated.id,
                name=updated.name,
                routing_type=updated.routing_type,
                grievance_cluster_id=updated.grievance_cluster_id,
                cluster_name=updated.grievance_cluster.name if updated.grievance_cluster else None,
                cluster_number=updated.grievance_cluster.cluster_number if updated.grievance_cluster else None,
                fixed_authority_id=updated.fixed_authority_id,
                fixed_authority_name=updated.fixed_authority.name_snapshot if updated.fixed_authority else None,
                fixed_authority_role=updated.fixed_authority.role if updated.fixed_authority else None,
                is_active=updated.is_active,
                created_at=updated.created_at,
                updated_at=updated.updated_at,
            ).model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@atharva_admin_router.patch("/categories/{category_id}/status", response_model=ApiResponse)
def update_category_status(
    category_id: uuid.UUID,
    payload: CategoryStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    try:
        updated = AdminConfigService.set_category_active_status(
            db=db,
            category_id=category_id,
            is_active=payload.is_active,
            actor_user_id=admin_user.id,
        )
        return ApiResponse(
            success=True,
            message=f"Category '{updated.name}' active status set to {updated.is_active}.",
            data={"id": str(updated.id), "is_active": updated.is_active},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# ==========================================
# 7. AUDIT LOGS
# ==========================================
@atharva_admin_router.get("/audit-logs", response_model=ApiResponse)
def list_audit_logs(
    module: Optional[str] = Query("atharva_veda", description="Module domain filter"),
    action: Optional[str] = Query(None, description="Action filter"),
    entity_name: Optional[str] = Query(None, description="Entity name filter"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
):
    stmt = select(AuditLog).options(joinedload(AuditLog.user))
    count_stmt = select(func.count(AuditLog.id))

    if module:
        stmt = stmt.where(AuditLog.module == module)
        count_stmt = count_stmt.where(AuditLog.module == module)
    if action:
        stmt = stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
        count_stmt = count_stmt.where(AuditLog.action.ilike(f"%{action.strip()}%"))
    if entity_name:
        stmt = stmt.where(AuditLog.entity_name == entity_name)
        count_stmt = count_stmt.where(AuditLog.entity_name == entity_name)

    total = db.scalar(count_stmt) or 0
    records = db.execute(
        stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    ).scalars().all()

    logs_out = []
    for r in records:
        logs_out.append(
            AuditLogOut(
                id=r.id,
                user_id=r.user_id,
                user_email=r.user.email if r.user else None,
                module=r.module,
                action=r.action,
                entity_name=r.entity_name,
                entity_id=r.entity_id,
                details=r.details,
                ip_address=r.ip_address,
                created_at=r.created_at,
            )
        )

    return ApiResponse(
        success=True,
        message="Audit logs retrieved successfully.",
        data=PaginatedAuditLogs(total=total, logs=logs_out).model_dump(),
    )
