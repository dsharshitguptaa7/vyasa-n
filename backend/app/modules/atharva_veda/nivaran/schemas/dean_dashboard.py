"""
Atharva Veda (NIVARAN-AI) Dean Executive Command Center Schemas.
Data models for executive KPIs, workflow pipelines, bottleneck analytics,
aging distributions, authority workloads, and institutional oversight.
"""
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


# ----------------------------------------------------------------------
# 1. Executive KPIs
# ----------------------------------------------------------------------
class DeanExecutiveKPIs(BaseModel):
    total_cases: int = 0
    active_cases: int = 0
    pending_cases: int = 0
    in_progress_cases: int = 0
    resolved_cases: int = 0
    closed_cases: int = 0
    escalated_cases: int = 0
    awaiting_info_cases: int = 0
    critical_urgent_cases: int = 0
    reopened_cases: int = 0
    resolution_rate: float = 0.0  # percentage (0.0 to 100.0)
    avg_resolution_time_hours: float = 0.0
    avg_resolution_time_display: str = "0h"
    ai_prediction_accuracy: float = 0.0  # percentage (0.0 to 100.0)


# ----------------------------------------------------------------------
# 2. Workflow Pipeline / Funnel
# ----------------------------------------------------------------------
class WorkflowPipelineStage(BaseModel):
    stage_key: str
    stage_name: str
    order: int
    current_count: int = 0
    percentage_of_active: float = 0.0
    avg_dwell_hours: float = 0.0
    avg_dwell_display: str = "0h"


# ----------------------------------------------------------------------
# 3. Bottleneck Analysis ("Where are cases stuck?")
# ----------------------------------------------------------------------
class BottleneckLevelItem(BaseModel):
    level: str  # e.g. "MANAGER", "ASSISTANT_DEAN", "ASSOCIATE_DEAN", "FIXED_AUTHORITY", "DEAN"
    level_label: str
    total_pending: int = 0
    oldest_case_tracking_id: Optional[str] = None
    oldest_case_age_hours: float = 0.0
    oldest_case_age_display: str = "-"
    avg_stage_age_hours: float = 0.0
    avg_stage_age_display: str = "-"
    median_stage_age_hours: float = 0.0
    median_stage_age_display: str = "-"
    max_stage_age_hours: float = 0.0
    max_stage_age_display: str = "-"


# ----------------------------------------------------------------------
# 4. Aging Distribution
# ----------------------------------------------------------------------
class AgingBucketItem(BaseModel):
    bucket_key: str  # "<24h", "1-3d", "4-7d", "8-14d", "15-30d", "30+d"
    label: str
    count: int = 0
    percentage: float = 0.0
    by_level: Dict[str, int] = Field(default_factory=dict)


# ----------------------------------------------------------------------
# 5. Authority Workloads & Specific Panels
# ----------------------------------------------------------------------
class AuthorityWorkloadItem(BaseModel):
    authority_id: uuid.UUID
    name: str
    role: str
    designation: Optional[str] = None
    department_or_cluster: Optional[str] = None
    assigned_count: int = 0
    pending_count: int = 0
    in_progress_count: int = 0
    awaiting_info_count: int = 0
    resolved_count: int = 0
    escalated_count: int = 0
    oldest_case_tracking_id: Optional[str] = None
    oldest_case_age_hours: float = 0.0
    oldest_case_age_display: str = "-"
    avg_case_age_hours: float = 0.0
    avg_case_age_display: str = "-"
    median_case_age_hours: float = 0.0
    median_case_age_display: str = "-"


class AssistantDeanWorkloadItem(BaseModel):
    authority_id: uuid.UUID
    name: str
    subject_cluster_name: str
    active_cases: int = 0
    pending: int = 0
    in_progress: int = 0
    awaiting_information: int = 0
    resolved: int = 0
    oldest_case_tracking_id: Optional[str] = None
    oldest_case_display: str = "-"
    avg_pending_age_display: str = "-"


class AssociateDeanWorkloadItem(BaseModel):
    authority_id: uuid.UUID
    name: str
    grievance_cluster_name: str
    active_cases: int = 0
    pending: int = 0
    in_progress: int = 0
    awaiting_information: int = 0
    resolved: int = 0
    escalated_to_dean: int = 0
    oldest_case_tracking_id: Optional[str] = None
    oldest_case_display: str = "-"
    avg_age_display: str = "-"


class RecentCategoryOverrideItem(BaseModel):
    grievance_id: str
    title: str
    ai_predicted_category: str
    manager_final_category: str
    confidence_score: Optional[float] = None
    reviewed_at: Optional[datetime] = None


class ManagerTriagePanel(BaseModel):
    awaiting_ai_review: int = 0
    awaiting_category_ratification: int = 0
    category_overridden: int = 0
    category_ratified: int = 0
    assigned_to_assistant_dean: int = 0
    unresolved_manager_queue: int = 0
    oldest_pending_manager_case: Optional[str] = None
    avg_manager_age_display: str = "-"
    ai_accuracy_percentage: float = 0.0
    ai_predictions_total: int = 0
    recent_overrides: List[RecentCategoryOverrideItem] = Field(default_factory=list)


# ----------------------------------------------------------------------
# 6. Category & Cluster Analytics
# ----------------------------------------------------------------------
class CategoryAnalyticsItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    routing_type: str
    total_count: int = 0
    active_count: int = 0
    resolved_count: int = 0
    pending_count: int = 0
    percentage: float = 0.0
    avg_age_hours: float = 0.0
    avg_age_display: str = "-"


class GrievanceClusterAnalyticsItem(BaseModel):
    cluster_id: uuid.UUID
    cluster_number: int
    cluster_name: str
    assigned_associate_dean_name: Optional[str] = None
    active_count: int = 0
    pending_count: int = 0
    resolved_count: int = 0
    oldest_case_display: str = "-"
    avg_age_display: str = "-"


class SubjectAnalyticsItem(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    subject_code: Optional[str] = None
    cluster_name: str
    active_count: int = 0
    pending_count: int = 0
    resolved_count: int = 0
    avg_age_display: str = "-"
    assigned_assistant_dean_name: Optional[str] = None


class SubjectClusterAnalyticsItem(BaseModel):
    cluster_id: uuid.UUID
    cluster_number: int
    cluster_name: str
    assigned_assistant_dean_name: Optional[str] = None
    active_count: int = 0
    pending_count: int = 0
    resolved_count: int = 0
    subjects: List[SubjectAnalyticsItem] = Field(default_factory=list)


# ----------------------------------------------------------------------
# 7. Priority Analysis
# ----------------------------------------------------------------------
class PriorityLevelDistribution(BaseModel):
    counts: Dict[str, int] = Field(default_factory=dict)
    by_authority_level: Dict[str, Dict[str, int]] = Field(default_factory=dict)


# ----------------------------------------------------------------------
# 8. Time Trend & Velocity
# ----------------------------------------------------------------------
class TimeTrendPoint(BaseModel):
    period: str
    date: str
    submitted_count: int = 0
    resolved_count: int = 0
    escalated_count: int = 0
    active_backlog: int = 0


# ----------------------------------------------------------------------
# 9. Routing Analytics & Fixed Authority
# ----------------------------------------------------------------------
class RoutingTypeDistribution(BaseModel):
    routing_type: str
    count: int = 0
    percentage: float = 0.0
    active_count: int = 0
    resolved_count: int = 0


class EscalationTransitionCount(BaseModel):
    transition_name: str
    count: int = 0


class RoutingAnalytics(BaseModel):
    by_routing_type: List[RoutingTypeDistribution] = Field(default_factory=list)
    transitions: List[EscalationTransitionCount] = Field(default_factory=list)


class FixedAuthorityItem(BaseModel):
    category_id: uuid.UUID
    category_name: str
    authority_id: uuid.UUID
    authority_name: str
    authority_role: str
    active_cases: int = 0
    pending_cases: int = 0
    resolved_cases: int = 0
    oldest_case_display: str = "-"
    avg_age_display: str = "-"


# ----------------------------------------------------------------------
# 10. Resolution Analytics
# ----------------------------------------------------------------------
class ResolutionAnalytics(BaseModel):
    total_resolved: int = 0
    resolution_rate: float = 0.0
    avg_lifecycle_hours: float = 0.0
    avg_lifecycle_display: str = "0h"
    resolutions_by_authority_level: Dict[str, int] = Field(default_factory=dict)
    resolutions_by_category: Dict[str, int] = Field(default_factory=dict)
    resolutions_by_cluster: Dict[str, int] = Field(default_factory=dict)


# ----------------------------------------------------------------------
# 11. Oldest Cases & Attention Required
# ----------------------------------------------------------------------
class OldestCaseItem(BaseModel):
    id: uuid.UUID
    tracking_id: str
    title: str
    submitted_at: datetime
    submitted_display: str
    total_age_hours: float
    total_age_display: str
    current_stage_age_hours: float
    current_stage_age_display: str
    current_authority_name: str
    current_authority_role: str
    current_level: str
    category_name: str
    subject_name: str
    priority: str
    status: str
    last_action: str
    last_action_timestamp: Optional[datetime] = None
    last_action_display: str = "-"


class DeanAttentionItem(BaseModel):
    id: uuid.UUID
    tracking_id: str
    title: str
    priority: str
    status: str
    subject_name: str
    category_name: str
    current_authority_name: str
    current_authority_role: str
    submitted_at: datetime
    submitted_display: str
    aging_days: int
    urgency_reason: str
    escalation_count: int = 0


# ----------------------------------------------------------------------
# 12. Recent Activity Timeline
# ----------------------------------------------------------------------
class ExecutiveActivityFeedItem(BaseModel):
    id: str
    event_type: str
    tracking_id: str
    title: str
    actor_name: str
    actor_role: str
    description: str
    timestamp: datetime
    timestamp_display: str


# ----------------------------------------------------------------------
# 13. Routing Health
# ----------------------------------------------------------------------
class RoutingHealthSummary(BaseModel):
    grievances_with_active_assignment: int = 0
    grievances_without_active_assignment: int = 0
    categories_missing_routing: int = 0
    subjects_missing_cluster: int = 0
    clusters_missing_authority: int = 0
    is_healthy: bool = True


# ----------------------------------------------------------------------
# 14. Filters Metadata
# ----------------------------------------------------------------------
class FilterOptionItem(BaseModel):
    id: str
    name: str
    extra: Optional[str] = None


class ExecutiveFilterMetadata(BaseModel):
    categories: List[FilterOptionItem] = Field(default_factory=list)
    subjects: List[FilterOptionItem] = Field(default_factory=list)
    subject_clusters: List[FilterOptionItem] = Field(default_factory=list)
    grievance_clusters: List[FilterOptionItem] = Field(default_factory=list)
    authorities: List[FilterOptionItem] = Field(default_factory=list)
    priorities: List[str] = Field(default_factory=list)
    statuses: List[str] = Field(default_factory=list)
    levels: List[str] = Field(default_factory=list)
    aging_buckets: List[str] = Field(default_factory=list)


# ----------------------------------------------------------------------
# 15. Executive Grievance Ledger (Paginated)
# ----------------------------------------------------------------------
class ExecutiveLedgerRow(BaseModel):
    id: uuid.UUID
    tracking_id: str
    title: str
    submitted_at: datetime
    submitted_display: str
    total_age_hours: float
    total_age_display: str
    current_level: str
    current_authority_name: str
    current_authority_role: str
    category_name: str
    subject_name: str
    cluster_name: str
    priority: str
    status: str
    current_stage_age_hours: float
    current_stage_age_display: str
    last_action: str
    last_action_timestamp: Optional[datetime] = None
    last_action_display: str = "-"


class ExecutiveLedgerResponse(BaseModel):
    items: List[ExecutiveLedgerRow] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    page_size: int = 25
    total_pages: int = 1


# ----------------------------------------------------------------------
# 16. Aggregate Dean Executive Command Center Response
# ----------------------------------------------------------------------
class DeanDashboardDataResponse(BaseModel):
    generated_at: datetime
    kpis: DeanExecutiveKPIs
    workflow_pipeline: List[WorkflowPipelineStage] = Field(default_factory=list)
    bottlenecks: List[BottleneckLevelItem] = Field(default_factory=list)
    aging_distribution: List[AgingBucketItem] = Field(default_factory=list)
    authority_workloads: List[AuthorityWorkloadItem] = Field(default_factory=list)
    assistant_dean_panel: List[AssistantDeanWorkloadItem] = Field(default_factory=list)
    associate_dean_panel: List[AssociateDeanWorkloadItem] = Field(default_factory=list)
    manager_triage: ManagerTriagePanel
    category_analytics: List[CategoryAnalyticsItem] = Field(default_factory=list)
    grievance_cluster_analytics: List[GrievanceClusterAnalyticsItem] = Field(default_factory=list)
    subject_cluster_analytics: List[SubjectClusterAnalyticsItem] = Field(default_factory=list)
    priority_analysis: PriorityLevelDistribution
    time_trends: List[TimeTrendPoint] = Field(default_factory=list)
    routing_analytics: RoutingAnalytics
    fixed_authorities: List[FixedAuthorityItem] = Field(default_factory=list)
    resolution_analytics: ResolutionAnalytics
    oldest_cases: List[OldestCaseItem] = Field(default_factory=list)
    attention_items: List[DeanAttentionItem] = Field(default_factory=list)
    recent_activities: List[ExecutiveActivityFeedItem] = Field(default_factory=list)
    routing_health: RoutingHealthSummary
    filters_metadata: ExecutiveFilterMetadata
