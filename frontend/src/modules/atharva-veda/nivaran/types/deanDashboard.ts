/**
 * Atharva Veda (NIVARAN-AI) Dean Executive Command Center Types.
 * Complete type definitions for institutional metrics, pipeline stages,
 * bottleneck analysis, authority workloads, and surveillance indicators.
 */

export interface DeanExecutiveKPIs {
  total_cases: number;
  active_cases: number;
  pending_cases: number;
  in_progress_cases: number;
  resolved_cases: number;
  closed_cases: number;
  escalated_cases: number;
  awaiting_info_cases: number;
  critical_urgent_cases: number;
  reopened_cases: number;
  resolution_rate: number;
  avg_resolution_time_hours: number;
  avg_resolution_time_display: string;
  ai_prediction_accuracy: number;
}

export interface WorkflowPipelineStage {
  stage_key: string;
  stage_name: string;
  order: number;
  current_count: number;
  percentage_of_active: number;
  avg_dwell_hours: number;
  avg_dwell_display: string;
}

export interface BottleneckLevelItem {
  level: string;
  level_label: string;
  total_pending: number;
  oldest_case_tracking_id: string | null;
  oldest_case_age_hours: number;
  oldest_case_age_display: string;
  avg_stage_age_hours: number;
  avg_stage_age_display: string;
  median_stage_age_hours: number;
  median_stage_age_display: string;
  max_stage_age_hours: number;
  max_stage_age_display: string;
}

export interface AgingBucketItem {
  bucket_key: string;
  label: string;
  count: number;
  percentage: number;
  by_level: Record<string, number>;
}

export interface AuthorityWorkloadItem {
  authority_id: string;
  name: string;
  role: string;
  designation?: string | null;
  department_or_cluster?: string | null;
  assigned_count: number;
  pending_count: number;
  in_progress_count: number;
  awaiting_info_count: number;
  resolved_count: number;
  escalated_count: number;
  oldest_case_tracking_id?: string | null;
  oldest_case_age_hours: number;
  oldest_case_age_display: string;
  avg_case_age_hours: number;
  avg_case_age_display: string;
  median_case_age_hours: number;
  median_case_age_display: string;
}

export interface AssistantDeanWorkloadItem {
  authority_id: string;
  name: string;
  subject_cluster_name: string;
  active_cases: number;
  pending: number;
  in_progress: number;
  awaiting_information: number;
  resolved: number;
  oldest_case_tracking_id?: string | null;
  oldest_case_display: string;
  avg_pending_age_display: string;
}

export interface AssociateDeanWorkloadItem {
  authority_id: string;
  name: string;
  grievance_cluster_name: string;
  active_cases: number;
  pending: number;
  in_progress: number;
  awaiting_information: number;
  resolved: number;
  escalated_to_dean: number;
  oldest_case_tracking_id?: string | null;
  oldest_case_display: string;
  avg_age_display: string;
}

export interface RecentCategoryOverrideItem {
  grievance_id: string;
  title: string;
  ai_predicted_category: string;
  manager_final_category: string;
  confidence_score?: number | null;
  reviewed_at?: string | null;
}

export interface ManagerTriagePanel {
  awaiting_ai_review: number;
  awaiting_category_ratification: number;
  category_overridden: number;
  category_ratified: number;
  assigned_to_assistant_dean: number;
  unresolved_manager_queue: number;
  oldest_pending_manager_case?: string | null;
  avg_manager_age_display: string;
  ai_accuracy_percentage: number;
  ai_predictions_total: number;
  recent_overrides: RecentCategoryOverrideItem[];
}

export interface CategoryAnalyticsItem {
  category_id: string;
  category_name: string;
  routing_type: string;
  total_count: number;
  active_count: number;
  resolved_count: number;
  pending_count: number;
  percentage: number;
  avg_age_hours: number;
  avg_age_display: string;
}

export interface GrievanceClusterAnalyticsItem {
  cluster_id: string;
  cluster_number: number;
  cluster_name: string;
  assigned_associate_dean_name?: string | null;
  active_count: number;
  pending_count: number;
  resolved_count: number;
  oldest_case_display: string;
  avg_age_display: string;
}

export interface SubjectAnalyticsItem {
  subject_id: string;
  subject_name: string;
  subject_code?: string | null;
  cluster_name: string;
  active_count: number;
  pending_count: number;
  resolved_count: number;
  avg_age_display: string;
  assigned_assistant_dean_name?: string | null;
}

export interface SubjectClusterAnalyticsItem {
  cluster_id: string;
  cluster_number: number;
  cluster_name: string;
  assigned_assistant_dean_name?: string | null;
  active_count: number;
  pending_count: number;
  resolved_count: number;
  subjects: SubjectAnalyticsItem[];
}

export interface PriorityLevelDistribution {
  counts: Record<string, number>;
  by_authority_level: Record<string, Record<string, number>>;
}

export interface TimeTrendPoint {
  period: string;
  date: string;
  submitted_count: number;
  resolved_count: number;
  escalated_count: number;
  active_backlog: number;
}

export interface RoutingTypeDistribution {
  routing_type: string;
  count: number;
  percentage: number;
  active_count: number;
  resolved_count: number;
}

export interface EscalationTransitionCount {
  transition_name: string;
  count: number;
}

export interface RoutingAnalytics {
  by_routing_type: RoutingTypeDistribution[];
  transitions: EscalationTransitionCount[];
}

export interface FixedAuthorityItem {
  category_id: string;
  category_name: string;
  authority_id: string;
  authority_name: string;
  authority_role: string;
  active_cases: number;
  pending_cases: number;
  resolved_cases: number;
  oldest_case_display: string;
  avg_age_display: string;
}

export interface ResolutionAnalytics {
  total_resolved: number;
  resolution_rate: number;
  avg_lifecycle_hours: number;
  avg_lifecycle_display: string;
  resolutions_by_authority_level: Record<string, number>;
  resolutions_by_category: Record<string, number>;
  resolutions_by_cluster: Record<string, number>;
}

export interface OldestCaseItem {
  id: string;
  tracking_id: string;
  title: string;
  submitted_at: string;
  submitted_display: string;
  total_age_hours: number;
  total_age_display: string;
  current_stage_age_hours: number;
  current_stage_age_display: string;
  current_authority_name: string;
  current_authority_role: string;
  current_level: string;
  category_name: string;
  subject_name: string;
  priority: string;
  status: string;
  last_action: string;
  last_action_timestamp?: string | null;
  last_action_display: string;
}

export interface DeanAttentionItem {
  id: string;
  tracking_id: string;
  title: string;
  priority: string;
  status: string;
  subject_name: string;
  category_name: string;
  current_authority_name: string;
  current_authority_role: string;
  submitted_at: string;
  submitted_display: string;
  aging_days: number;
  urgency_reason: string;
  escalation_count: number;
}

export interface ExecutiveActivityFeedItem {
  id: string;
  event_type: string;
  tracking_id: string;
  title: string;
  actor_name: string;
  actor_role: string;
  description: string;
  timestamp: string;
  timestamp_display: string;
}

export interface RoutingHealthSummary {
  grievances_with_active_assignment: number;
  grievances_without_active_assignment: number;
  categories_missing_routing: number;
  subjects_missing_cluster: number;
  clusters_missing_authority: number;
  is_healthy: boolean;
}

export interface FilterOptionItem {
  id: string;
  name: string;
  extra?: string | null;
}

export interface ExecutiveFilterMetadata {
  categories: FilterOptionItem[];
  subjects: FilterOptionItem[];
  subject_clusters: FilterOptionItem[];
  grievance_clusters: FilterOptionItem[];
  authorities: FilterOptionItem[];
  priorities: string[];
  statuses: string[];
  levels: string[];
  aging_buckets: string[];
}

export interface DeanDashboardDataResponse {
  generated_at: string;
  kpis: DeanExecutiveKPIs;
  workflow_pipeline: WorkflowPipelineStage[];
  bottlenecks: BottleneckLevelItem[];
  aging_distribution: AgingBucketItem[];
  authority_workloads: AuthorityWorkloadItem[];
  assistant_dean_panel: AssistantDeanWorkloadItem[];
  associate_dean_panel: AssociateDeanWorkloadItem[];
  manager_triage: ManagerTriagePanel;
  category_analytics: CategoryAnalyticsItem[];
  grievance_cluster_analytics: GrievanceClusterAnalyticsItem[];
  subject_cluster_analytics: SubjectClusterAnalyticsItem[];
  priority_analysis: PriorityLevelDistribution;
  time_trends: TimeTrendPoint[];
  routing_analytics: RoutingAnalytics;
  fixed_authorities: FixedAuthorityItem[];
  resolution_analytics: ResolutionAnalytics;
  oldest_cases: OldestCaseItem[];
  attention_items: DeanAttentionItem[];
  recent_activities: ExecutiveActivityFeedItem[];
  routing_health: RoutingHealthSummary;
  filters_metadata: ExecutiveFilterMetadata;
}

export interface ExecutiveLedgerRow {
  id: string;
  tracking_id: string;
  title: string;
  submitted_at: string;
  submitted_display: string;
  total_age_hours: number;
  total_age_display: string;
  current_level: string;
  current_authority_name: string;
  current_authority_role: string;
  category_name: string;
  subject_name: string;
  cluster_name: string;
  priority: string;
  status: string;
  current_stage_age_hours: number;
  current_stage_age_display: string;
  last_action: string;
  last_action_timestamp?: string | null;
  last_action_display: string;
}

export interface ExecutiveLedgerResponse {
  items: ExecutiveLedgerRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DeanDashboardFilterParams {
  start_date?: string;
  end_date?: string;
  status?: string;
  priority?: string;
  current_level?: string;
  authority_id?: string;
  category_id?: string;
  grievance_cluster_id?: string;
  subject_cluster_id?: string;
  subject_id?: string;
  routing_type?: string;
  aging_bucket?: string;
}

export interface DeanCasesLedgerParams extends DeanDashboardFilterParams {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}
