export type NivaranRole =
  | 'APPLICANT'
  | 'MANAGER'
  | 'ASSISTANT_DEAN'
  | 'ASSOCIATE_DEAN'
  | 'DEAN'
  | 'GUEST_MEMBER';

export type CategoryRoutingType =
  | 'CLUSTER'
  | 'GRIEVANCE_CLUSTER'
  | 'SUBJECT_ASSISTANT_DEAN'
  | 'FIXED_AUTHORITY';

export interface Authority {
  id: string;
  vyasa_user_id: string;
  role: NivaranRole;
  name_snapshot: string;
  email_snapshot: string;
  phone_snapshot: string | null;
  designation: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAuthorityPayload {
  name: string;
  email: string;
  role: NivaranRole;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  is_active?: boolean;
}

export interface UpdateAuthorityPayload {
  name?: string | null;
  email?: string | null;
  role?: NivaranRole | null;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
}

export interface SubjectCluster {
  id: string;
  cluster_number: number;
  name: string;
  description: string | null;
  is_active: boolean;
  assistant_dean_id: string | null;
  assistant_dean: Authority | null;
  subject_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectClusterPayload {
  cluster_number: number;
  name: string;
  description?: string | null;
  assistant_dean_id?: string | null;
  is_active?: boolean;
}

export interface UpdateSubjectClusterPayload {
  name?: string | null;
  description?: string | null;
  cluster_number?: number | null;
}

export interface Subject {
  id: string;
  code: string | null;
  name: string;
  subject_cluster_id: string;
  cluster_name: string | null;
  cluster_number: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectPayload {
  name: string;
  subject_cluster_id: string;
  code?: string | null;
  is_active?: boolean;
}

export interface UpdateSubjectPayload {
  name?: string | null;
  code?: string | null;
  subject_cluster_id?: string | null;
}

export interface GrievanceCluster {
  id: string;
  cluster_number: number;
  name: string;
  description: string | null;
  is_active: boolean;
  associate_dean_id: string | null;
  associate_dean: Authority | null;
  category_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGrievanceClusterPayload {
  cluster_number: number;
  name: string;
  description?: string | null;
  associate_dean_id?: string | null;
  is_active?: boolean;
}

export interface UpdateGrievanceClusterPayload {
  name?: string | null;
  description?: string | null;
  cluster_number?: number | null;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  routing_type: CategoryRoutingType;
  grievance_cluster_id: string | null;
  cluster_name: string | null;
  cluster_number: number | null;
  fixed_authority_id: string | null;
  fixed_authority_name: string | null;
  fixed_authority_role: NivaranRole | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string | null;
  routing_type: CategoryRoutingType;
  grievance_cluster_id?: string | null;
  fixed_authority_id?: string | null;
  is_active?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string | null;
  description?: string | null;
}

export interface RoutingSimulationRequest {
  category_id: string;
  subject_id?: string | null;
}

export interface RoutingSimulationResult {
  status: 'ROUTED' | 'AMBIGUOUS' | 'UNRESOLVED' | 'FALLBACK';
  routing_type: CategoryRoutingType;
  category_name: string;
  target_authority_id: string | null;
  target_authority_name: string | null;
  target_authority_role: string | null;
  cluster_name: string | null;
  cluster_number: number | null;
  path_taken: string[];
  warnings: string[];
  fallback_used: boolean;
}

export interface AtharvaConfigSummary {
  total_authorities: number;
  active_authorities: number;
  role_counts: Record<string, number>;
  total_subject_clusters: number;
  active_subject_clusters: number;
  total_subjects: number;
  active_subjects: number;
  total_grievance_clusters: number;
  active_grievance_clusters: number;
  total_categories: number;
  active_categories: number;
  categories_by_routing_type: Record<string, number>;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  module: string;
  action: string;
  entity_name: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedAuditLogs {
  total: number;
  logs: AuditLog[];
}
