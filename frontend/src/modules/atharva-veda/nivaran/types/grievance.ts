export type GrievanceStatus =
  | 'SUBMITTED'
  | 'AI_PROCESSING'
  | 'PENDING_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'AWAITING_INFORMATION'
  | 'UNDER_INVESTIGATION'
  | 'COMMITTEE_REVIEW'
  | 'HEARING_SCHEDULED'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export type GrievancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'URGENT';

export interface TaxonomySubjectItem {
  id: string;
  name: string;
  code?: string;
  cluster_id?: string;
  cluster_name?: string;
  is_active: boolean;
}

export interface TaxonomyCategoryItem {
  id: string;
  name: string;
  code?: string;
  description?: string;
  routing_type: string;
  cluster_id?: string;
  cluster_name?: string;
  is_active: boolean;
}

export interface DocumentUploadItem {
  file_name: string;
  mime_type: string;
  file_size: number;
  content_base64?: string;
  document_type?: string;
}

export interface GrievanceSubmitRequest {
  title: string;
  description: string;
  subject_id?: string;
  category_id?: string;
  documents?: DocumentUploadItem[];
}

export interface GrievanceOCRExtractResponse {
  title: string;
  description: string;
  confidence_note?: string;
}

export interface GrievanceSummaryItem {
  id: string;
  grievance_id: string;
  title: string;
  status: GrievanceStatus;
  priority: GrievancePriority;
  subject_id: string;
  subject_name: string;
  category_id: string;
  category_name: string;
  final_category_name?: string;
  assigned_authority_name?: string;
  created_at: string;
  updated_at: string;
}

export interface GrievanceStatusHistoryItem {
  id: string;
  from_status?: string;
  to_status: string;
  actor_user_id?: string;
  actor_authority_id?: string;
  actor_type: string;
  remarks?: string;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size_bytes: number;
  document_type: string;
  is_confidential: boolean;
  content_hash?: string;
  created_at: string;
}

export interface GrievanceDetailResponse {
  id: string;
  grievance_id: string;
  title: string;
  description: string;
  status: GrievanceStatus;
  priority: GrievancePriority;
  subject_id: string;
  subject_name: string;
  subject_cluster_name?: string;
  category_id: string;
  category_name: string;
  final_category_id?: string;
  final_category_name?: string;
  category_reviewed: boolean;
  category_overridden: boolean;
  category_override_reason?: string;
  ai_suggested_category_id?: string;
  ai_suggested_category_name?: string;
  ai_confidence?: number;
  assigned_authority_id?: string;
  assigned_authority_name?: string;
  assigned_authority_role?: string;
  applicant_id: string;
  applicant_name: string;
  applicant_email: string;
  student_registration_number?: string;
  created_at: string;
  updated_at: string;
  history: GrievanceStatusHistoryItem[];
  documents: DocumentItem[];
}

export interface ManagerReviewRequest {
  confirm_category: boolean;
  override_category_id?: string;
  override_reason?: string;
  priority?: GrievancePriority;
  remarks?: string;
}

export interface RoutingPreviewResponse {
  grievance_id: string;
  subject_name: string;
  category_name: string;
  routing_type: string;
  target_authority_id: string;
  target_authority_name: string;
  target_authority_role: string;
  target_authority_email: string;
  is_active: boolean;
}

export interface ForwardingConfirmationPayload {
  reasons_justification: string;
  preliminary_findings: string;
  specific_questions: string;
  reviewed_student_submission: boolean;
  reviewed_prior_history: boolean;
  reviewed_regulations: boolean;
  verified_no_conflict: boolean;
  confirmed_jurisdiction: boolean;
  confirmed_recommendations_actionable: boolean;
}

export interface AssistantDeanForwardRequest {
  target_authority_id?: string;
  forwarding_notes?: string;
  confirmation: ForwardingConfirmationPayload;
}

export interface AssistantDeanResolveRequest {
  resolution_notes: string;
}

export interface DocumentRequestItem {
  id?: string;
  grievance_id?: string;
  document_name: string;
  description?: string;
  deadline?: string;
  status?: string;
  created_at?: string;
}

export interface AssistantDeanDocumentRequestPayload {
  items: DocumentRequestItem[];
}

export interface CommitteeRequestPayload {
  reason: string;
  proposed_member_roles?: string[];
}

export interface CommitteeRequestResponseItem {
  id: string;
  grievance_id: string;
  requested_by_authority_id: string;
  reason: string;
  status: string;
  proposed_member_roles?: string[];
  created_at: string;
}

export interface AssistantDeanQueueResponse {
  items: GrievanceSummaryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AssistantDeanGrievanceDetailResponse extends GrievanceDetailResponse {
  stage2_routing_preview?: RoutingPreviewResponse | null;
  next_authority?: {
    id: string;
    name: string;
    role: string;
    designation?: string;
    email: string;
  } | null;
  routing?: {
    can_forward: boolean;
    can_resolve: boolean;
    routing_type?: string | null;
    next_authority_id?: string | null;
    next_authority_name?: string | null;
    next_authority_role?: string | null;
    next_authority?: any;
  } | null;
  can_forward?: boolean;
  forward_blocked_reason?: string | null;
  resolution_summary?: string | null;
  resolved_at?: string | null;
}

export interface AssociateDeanDashboardStats {
  total_assigned: number;
  pending: number;
  in_progress: number;
  resolved: number;
  escalated: number;
  grievance_cluster_id?: string | null;
  grievance_cluster_name?: string | null;
}

export interface AssociateDeanForwardRequest {
  reason?: string;
  remarks?: string;
  confirmation?: ForwardingConfirmationPayload;
}

export interface AssociateDeanResolveRequest {
  resolution_notes: string;
}

export interface AssociateDeanDocumentRequestPayload {
  documents: {
    document_name: string;
    description?: string;
    is_required?: boolean;
  }[];
  deadline?: string;
}

export interface AssociateDeanCommitteeRequestPayload {
  target_authority_id?: string;
  justification: string;
  proposed_scope?: string;
  supporting_remarks?: string;
}

export interface AssociateDeanGrievanceDetailResponse extends GrievanceDetailResponse {
  stage3_dean_preview?: {
    grievance_id: string;
    routing_type?: string;
    target_authority_id: string;
    target_authority_name: string;
    target_authority_role: string;
    target_authority_email: string;
    is_active: boolean;
  } | null;
  next_authority?: {
    id: string;
    name: string;
    role: string;
    designation?: string;
    email: string;
  } | null;
  routing?: {
    can_forward: boolean;
    can_resolve: boolean;
    routing_type?: string | null;
    next_authority_id?: string | null;
    next_authority_name?: string | null;
    next_authority_role?: string | null;
    next_authority?: any;
  } | null;
  can_forward?: boolean;
  forward_blocked_reason?: string | null;
  resolution_summary?: string | null;
  resolved_at?: string | null;
}



