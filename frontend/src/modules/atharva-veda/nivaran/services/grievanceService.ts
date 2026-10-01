import { apiClient } from '../../../../services/apiClient';
import {
  AssistantDeanDocumentRequestPayload,
  AssistantDeanForwardRequest,
  AssistantDeanGrievanceDetailResponse,
  AssistantDeanQueueResponse,
  AssistantDeanResolveRequest,
  AssociateDeanDashboardStats,
  AssociateDeanForwardRequest,
  AssociateDeanResolveRequest,
  AssociateDeanDocumentRequestPayload,
  AssociateDeanCommitteeRequestPayload,
  AssociateDeanGrievanceDetailResponse,
  CommitteeRequestPayload,
  CommitteeRequestResponseItem,
  DocumentRequestItem,
  GrievanceDetailResponse,
  GrievanceOCRExtractResponse,
  GrievanceSubmitRequest,
  GrievanceSummaryItem,
  ManagerReviewRequest,
  RoutingPreviewResponse,
  TaxonomyCategoryItem,
  TaxonomySubjectItem,
} from '../types/grievance';
import {
  DeanDashboardDataResponse,
  DeanDashboardFilterParams,
  DeanCasesLedgerParams,
  ExecutiveLedgerResponse,
} from '../types/deanDashboard';


const BASE_PREFIX = '/modules/atharva-veda/nivaran';

export const grievanceService = {
  /**
   * Retrieves active academic subjects for grievance submission.
   */
  async getTaxonomySubjects(): Promise<TaxonomySubjectItem[]> {
    const res = await apiClient.get<TaxonomySubjectItem[]>(`${BASE_PREFIX}/taxonomy/subjects`);
    return res.data || [];
  },

  /**
   * Retrieves active grievance categories for grievance submission and triage.
   */
  async getTaxonomyCategories(): Promise<TaxonomyCategoryItem[]> {
    const res = await apiClient.get<TaxonomyCategoryItem[]>(`${BASE_PREFIX}/taxonomy/categories`);
    return res.data || [];
  },

  /**
   * Submits a new formal grievance into Atharva Veda.
   */
  async submitGrievance(payload: GrievanceSubmitRequest): Promise<GrievanceDetailResponse> {
    const res = await apiClient.post<GrievanceDetailResponse>(`${BASE_PREFIX}/grievances`, payload);
    return res.data!;
  },

  /**
   * Extracts title and description from an uploaded handwritten or printed document.
   * Input assistance only — does NOT create a grievance record.
   */
  async extractGrievanceFromOCR(file: File): Promise<GrievanceOCRExtractResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.postFormData<GrievanceOCRExtractResponse>(
      `${BASE_PREFIX}/grievances/ocr/extract`,
      formData
    );
    return res.data!;
  },

  /**
   * Uploads an attachment to an existing grievance via multipart/form-data.
   */
  async uploadGrievanceDocument(grievanceId: string, file: File, documentType: string = 'ATTACHMENT') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    const res = await apiClient.postFormData(
      `${BASE_PREFIX}/grievances/${encodeURIComponent(grievanceId)}/documents`,
      formData
    );
    return res.data!;
  },

  /**
   * Lists all grievances submitted by the authenticated applicant.
   */
  async getMyGrievances(): Promise<GrievanceSummaryItem[]> {
    const res = await apiClient.get<GrievanceSummaryItem[]>(`${BASE_PREFIX}/grievances/my`);
    return res.data || [];
  },

  /**
   * Retrieves full grievance dossier including AI classification, status history, and attachments.
   */
  async getGrievanceDetail(id: string): Promise<GrievanceDetailResponse> {
    const res = await apiClient.get<GrievanceDetailResponse>(`${BASE_PREFIX}/grievances/${id}`);
    return res.data!;
  },

  /**
   * Retrieves the Manager triage queue.
   */
  async getManagerTriageQueue(statusFilter?: string): Promise<GrievanceSummaryItem[]> {
    const endpoint = statusFilter
      ? `${BASE_PREFIX}/manager/queue?status_filter=${encodeURIComponent(statusFilter)}`
      : `${BASE_PREFIX}/manager/queue`;
    const res = await apiClient.get<GrievanceSummaryItem[]>(endpoint);
    return res.data || [];
  },

  /**
   * Previews dynamic routing destination before committing triage assignment.
   */
  async previewRouting(id: string, categoryId?: string): Promise<RoutingPreviewResponse> {
    const endpoint = categoryId
      ? `${BASE_PREFIX}/manager/grievances/${id}/preview-routing?category_id=${encodeURIComponent(categoryId)}`
      : `${BASE_PREFIX}/manager/grievances/${id}/preview-routing`;
    const res = await apiClient.get<RoutingPreviewResponse>(endpoint);
    return res.data!;
  },

  /**
   * Reviews AI recommendation directly with CONFIRMED, ACCEPTED, or OVERRIDDEN decision (reference parity).
   */
  async reviewAIRecommendation(
    id: string,
    decision: 'CONFIRMED' | 'ACCEPTED' | 'OVERRIDDEN',
    categoryId?: string
  ): Promise<GrievanceDetailResponse> {
    const res = await apiClient.patch<GrievanceDetailResponse>(
      `${BASE_PREFIX}/grievances/${encodeURIComponent(id)}/ai-review`,
      { category_id: categoryId, decision }
    );
    return res.data!;
  },

  /**
   * Manager action to confirm or override grievance category and assign to the dynamically resolved authority.
   */
  async reviewAndAssignGrievance(
    id: string,
    payload: ManagerReviewRequest
  ): Promise<GrievanceDetailResponse> {
    const res = await apiClient.post<GrievanceDetailResponse>(
      `${BASE_PREFIX}/manager/grievances/${id}/review`,
      payload
    );
    return res.data!;
  },

  /**
   * Retrieves persona and institutional workspace context.
   */
  async getWorkspaceContext(): Promise<{
    persona: string;
    authority_role?: string | null;
    authority_id?: string | null;
    authority_designation?: string | null;
    is_applicant: boolean;
    is_admin: boolean;
    is_authority: boolean;
  }> {
    const res = await apiClient.get<any>(`${BASE_PREFIX}/workspace`);
    return res.data!;
  },

  /**
   * Retrieves cases scoped to the authenticated Assistant Dean's subject cluster.
   */
  async getAssistantDeanCases(): Promise<GrievanceSummaryItem[]> {
    const res = await apiClient.get<GrievanceSummaryItem[]>(`${BASE_PREFIX}/assistant-dean/cases`);
    return res.data || [];
  },

  /**
   * Retrieves the Assistant Dean paginated queue with optional filtering.
   */
  async getAssistantDeanQueue(params?: {
    page?: number;
    page_size?: number;
    status_filter?: string;
    search?: string;
    priority?: string;
  }): Promise<AssistantDeanQueueResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.page_size) query.append('page_size', params.page_size.toString());
    if (params?.status_filter) query.append('status_filter', params.status_filter);
    if (params?.search) query.append('search', params.search);
    if (params?.priority) query.append('priority', params.priority);

    const queryString = query.toString();
    const endpoint = queryString
      ? `${BASE_PREFIX}/assistant-dean/queue?${queryString}`
      : `${BASE_PREFIX}/assistant-dean/queue`;

    const res = await apiClient.get<AssistantDeanQueueResponse>(endpoint);
    return res.data || { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 };
  },

  /**
   * Retrieves full grievance dossier for Assistant Dean review with Stage 2 routing preview.
   */
  async getAssistantDeanGrievanceDetail(id: string): Promise<AssistantDeanGrievanceDetailResponse> {
    const res = await apiClient.get<any>(
      `${BASE_PREFIX}/assistant-dean/grievances/${encodeURIComponent(id)}`
    );
    const raw = res.data;
    if (!raw) {
      throw new Error('Grievance dossier not found.');
    }
    const grv = raw.grievance || raw;
    const next_auth = raw.next_authority || grv.next_authority;
    const can_forward = Boolean(raw.can_forward ?? grv.can_forward ?? (next_auth ? true : false));
    const stage2_preview = raw.stage2_routing_preview || grv.stage2_routing_preview || (next_auth ? {
      grievance_id: grv.id || grv.grievance_id,
      subject_name: grv.subject_name || '',
      category_name: grv.final_category_name || grv.category_name || '',
      routing_type: grv.routing_type || 'CLUSTER',
      target_authority_id: next_auth.id,
      target_authority_name: next_auth.name,
      target_authority_role: next_auth.role,
      target_authority_email: next_auth.email,
      is_active: true,
    } : null);

    return {
      ...grv,
      can_forward,
      forward_blocked_reason: raw.forward_blocked_reason ?? grv.forward_blocked_reason ?? null,
      stage2_routing_preview: stage2_preview,
      next_authority: next_auth || null,
      routing: raw.routing ?? grv.routing ?? null,
      documents: grv.documents || [],
      history: grv.history || [],
      resolution_summary: raw.resolution_summary ?? grv.resolution_summary ?? null,
      resolved_at: raw.resolved_at ?? grv.resolved_at ?? null,
    };
  },


  /**
   * Directly resolves a grievance under Assistant Dean jurisdiction.
   */
  async resolveAssistantDeanGrievance(
    id: string,
    payload: AssistantDeanResolveRequest
  ): Promise<GrievanceDetailResponse> {
    const res = await apiClient.post<GrievanceDetailResponse>(
      `${BASE_PREFIX}/assistant-dean/grievances/${encodeURIComponent(id)}/resolve`,
      payload
    );
    return res.data!;
  },

  /**
   * Forwards a grievance to Stage 2 authority with 6-point verification & 3-point justification.
   */
  async forwardAssistantDeanGrievance(
    id: string,
    payload: AssistantDeanForwardRequest
  ): Promise<GrievanceDetailResponse> {
    const res = await apiClient.post<GrievanceDetailResponse>(
      `${BASE_PREFIX}/assistant-dean/grievances/${encodeURIComponent(id)}/forward`,
      payload
    );
    return res.data!;
  },

  /**
   * Requests evidentiary documentation from student / departments, transitioning status to AWAITING_INFORMATION.
   */
  async requestGrievanceDocuments(
    id: string,
    payload: AssistantDeanDocumentRequestPayload
  ): Promise<DocumentRequestItem[]> {
    const res = await apiClient.post<DocumentRequestItem[]>(
      `${BASE_PREFIX}/assistant-dean/grievances/${encodeURIComponent(id)}/document-requests`,
      payload
    );
    return res.data || [];
  },

  /**
   * Retrieves pending and fulfilled document requests for a grievance.
   */
  async getGrievanceDocumentRequests(id: string): Promise<DocumentRequestItem[]> {
    const res = await apiClient.get<DocumentRequestItem[]>(
      `${BASE_PREFIX}/grievances/${encodeURIComponent(id)}/document-requests`
    );
    return res.data || [];
  },

  /**
   * Requests formation of an ad-hoc inquiry committee for the grievance.
   */
  async requestCommitteeCreation(
    id: string,
    payload: CommitteeRequestPayload
  ): Promise<CommitteeRequestResponseItem> {
    const res = await apiClient.post<CommitteeRequestResponseItem>(
      `${BASE_PREFIX}/assistant-dean/grievances/${encodeURIComponent(id)}/committee-requests`,
      payload
    );
    return res.data!;
  },

  /**
   * Retrieves dashboard docket statistics for Associate Dean.
   */
  async getAssociateDeanDashboard(): Promise<AssociateDeanDashboardStats> {
    const res = await apiClient.get<AssociateDeanDashboardStats>(`${BASE_PREFIX}/associate-dean/dashboard`);
    return res.data || {
      total_assigned: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      escalated: 0,
    };
  },

  /**
   * Retrieves paginated jurisdictional queue for Associate Dean.
   */
  async getAssociateDeanGrievances(params?: {
    status?: string;
    search?: string;
    priority?: string;
    page?: number;
    page_size?: number;
  }): Promise<{ items: GrievanceSummaryItem[]; total: number; page: number; page_size: number }> {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.priority) query.set('priority', params.priority);
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));

    const endpoint = `${BASE_PREFIX}/associate-dean/grievances${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await apiClient.get<{ items: GrievanceSummaryItem[]; total: number; page: number; page_size: number }>(endpoint);
    return res.data || { items: [], total: 0, page: 1, page_size: 20 };
  },

  /**
   * Retrieves full grievance dossier for Associate Dean review with Stage 3 Dean preview.
   */
  async getAssociateDeanGrievanceDetail(id: string): Promise<AssociateDeanGrievanceDetailResponse> {
    const res = await apiClient.get<any>(
      `${BASE_PREFIX}/associate-dean/grievances/${encodeURIComponent(id)}`
    );
    const raw = res.data;
    if (!raw) {
      throw new Error('Grievance dossier not found.');
    }
    const grv = raw.grievance || raw;
    const next_auth = raw.next_authority || grv.next_authority;
    const can_forward = Boolean(raw.can_forward ?? grv.can_forward ?? (next_auth ? true : false));
    const stage3_preview = raw.stage3_dean_preview || grv.stage3_dean_preview || (next_auth ? {
      grievance_id: grv.id || grv.grievance_id,
      routing_type: 'DEAN',
      target_authority_id: next_auth.id,
      target_authority_name: next_auth.name,
      target_authority_role: next_auth.role,
      target_authority_email: next_auth.email,
      is_active: true,
    } : null);

    return {
      ...grv,
      can_forward,
      forward_blocked_reason: raw.forward_blocked_reason ?? grv.forward_blocked_reason ?? null,
      stage3_dean_preview: stage3_preview,
      next_authority: next_auth || null,
      routing: raw.routing ?? grv.routing ?? null,
      documents: grv.documents || [],
      history: grv.history || [],
      resolution_summary: raw.resolution_summary ?? grv.resolution_summary ?? null,
      resolved_at: raw.resolved_at ?? grv.resolved_at ?? null,
    };
  },

  /**
   * Directly resolves a grievance under Associate Dean jurisdiction.
   */
  async resolveAssociateDeanGrievance(
    id: string,
    payload: AssociateDeanResolveRequest
  ): Promise<GrievanceDetailResponse> {
    const res = await apiClient.post<GrievanceDetailResponse>(
      `${BASE_PREFIX}/associate-dean/grievances/${encodeURIComponent(id)}/resolve`,
      payload
    );
    return res.data!;
  },

  /**
   * Forwards/escalates a grievance to Dean R&D.
   */
  async forwardAssociateDeanGrievance(
    id: string,
    payload: AssociateDeanForwardRequest
  ): Promise<GrievanceDetailResponse> {
    const res = await apiClient.post<GrievanceDetailResponse>(
      `${BASE_PREFIX}/associate-dean/grievances/${encodeURIComponent(id)}/forward`,
      payload
    );
    return res.data!;
  },

  /**
   * Requests evidentiary documentation from student / departments under Associate Dean jurisdiction.
   */
  async requestAssociateDeanDocuments(
    id: string,
    payload: AssociateDeanDocumentRequestPayload
  ): Promise<DocumentRequestItem[]> {
    const res = await apiClient.post<DocumentRequestItem[]>(
      `${BASE_PREFIX}/associate-dean/grievances/${encodeURIComponent(id)}/document-requests`,
      payload
    );
    return res.data || [];
  },

  /**
   * Requests formation of an ad-hoc inquiry committee for the grievance under Associate Dean jurisdiction.
   */
  async requestAssociateDeanCommittee(
    id: string,
    payload: AssociateDeanCommitteeRequestPayload
  ): Promise<CommitteeRequestResponseItem> {
    const res = await apiClient.post<CommitteeRequestResponseItem>(
      `${BASE_PREFIX}/associate-dean/grievances/${encodeURIComponent(id)}/request-committee`,
      payload
    );
    return res.data!;
  },

  /**
   * Retrieves cases scoped to the authenticated Associate Dean's grievance cluster.
   */
  async getAssociateDeanCases(): Promise<GrievanceSummaryItem[]> {
    const res = await apiClient.get<GrievanceSummaryItem[]>(`${BASE_PREFIX}/associate-dean/cases`);
    return res.data || [];
  },

  /**
   * Retrieves cases scoped to the Dean of Academic Affairs for executive review.
   */
  async getDeanCases(): Promise<GrievanceSummaryItem[]> {
    const res = await apiClient.get<GrievanceSummaryItem[]>(`${BASE_PREFIX}/dean/cases`);
    return res.data || [];
  },

  /**
   * Retrieves comprehensive executive metrics and analytics for Dean Command Center.
   */
  async getDeanExecutiveDashboard(
    filters?: DeanDashboardFilterParams
  ): Promise<DeanDashboardDataResponse> {
    const query = new URLSearchParams();
    if (filters) {
      if (filters.start_date) query.set('start_date', filters.start_date);
      if (filters.end_date) query.set('end_date', filters.end_date);
      if (filters.status && filters.status !== 'ALL') query.set('status', filters.status);
      if (filters.priority && filters.priority !== 'ALL') query.set('priority', filters.priority);
      if (filters.current_level && filters.current_level !== 'ALL') query.set('current_level', filters.current_level);
      if (filters.authority_id) query.set('authority_id', filters.authority_id);
      if (filters.category_id) query.set('category_id', filters.category_id);
      if (filters.grievance_cluster_id) query.set('grievance_cluster_id', filters.grievance_cluster_id);
      if (filters.subject_cluster_id) query.set('subject_cluster_id', filters.subject_cluster_id);
      if (filters.subject_id) query.set('subject_id', filters.subject_id);
      if (filters.routing_type) query.set('routing_type', filters.routing_type);
      if (filters.aging_bucket) query.set('aging_bucket', filters.aging_bucket);
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<DeanDashboardDataResponse>(`${BASE_PREFIX}/dean/dashboard${qStr}`);
    return res.data!;
  },

  /**
   * Retrieves paginated, sortable, searchable grievance ledger for Dean Command Center.
   */
  async getDeanDashboardCases(
    params?: DeanCasesLedgerParams
  ): Promise<ExecutiveLedgerResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.page) query.set('page', String(params.page));
      if (params.page_size) query.set('page_size', String(params.page_size));
      if (params.search) query.set('search', params.search.trim());
      if (params.sort_by) query.set('sort_by', params.sort_by);
      if (params.sort_dir) query.set('sort_dir', params.sort_dir);
      if (params.start_date) query.set('start_date', params.start_date);
      if (params.end_date) query.set('end_date', params.end_date);
      if (params.status && params.status !== 'ALL') query.set('status', params.status);
      if (params.priority && params.priority !== 'ALL') query.set('priority', params.priority);
      if (params.current_level && params.current_level !== 'ALL') query.set('current_level', params.current_level);
      if (params.authority_id) query.set('authority_id', params.authority_id);
      if (params.category_id) query.set('category_id', params.category_id);
      if (params.grievance_cluster_id) query.set('grievance_cluster_id', params.grievance_cluster_id);
      if (params.subject_cluster_id) query.set('subject_cluster_id', params.subject_cluster_id);
      if (params.subject_id) query.set('subject_id', params.subject_id);
      if (params.routing_type) query.set('routing_type', params.routing_type);
      if (params.aging_bucket) query.set('aging_bucket', params.aging_bucket);
    }
    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ExecutiveLedgerResponse>(`${BASE_PREFIX}/dean/dashboard/cases${qStr}`);
    return res.data!;
  },
};



