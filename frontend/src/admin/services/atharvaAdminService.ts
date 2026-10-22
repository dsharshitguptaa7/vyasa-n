import { apiClient } from '../../services/apiClient';
import {
  Authority,
  CreateAuthorityPayload,
  UpdateAuthorityPayload,
  SubjectCluster,
  CreateSubjectClusterPayload,
  UpdateSubjectClusterPayload,
  Subject,
  CreateSubjectPayload,
  UpdateSubjectPayload,
  GrievanceCluster,
  CreateGrievanceClusterPayload,
  UpdateGrievanceClusterPayload,
  Category,
  CreateCategoryPayload,
  UpdateCategoryPayload,
  RoutingSimulationRequest,
  RoutingSimulationResult,
  AtharvaConfigSummary,
  PaginatedAuditLogs,
  NivaranRole,
  CategoryRoutingType,
} from '../types/atharva';

export const atharvaAdminService = {
  // =========================================================================
  // SUMMARY
  // =========================================================================
  async getSummary(): Promise<AtharvaConfigSummary> {
    const res = await apiClient.get<AtharvaConfigSummary>('/admin/atharva/summary');
    return res.data!;
  },

  // =========================================================================
  // AUTHORITIES
  // =========================================================================
  async getAuthorities(params?: {
    role?: NivaranRole;
    is_active?: boolean;
    search?: string;
  }): Promise<Authority[]> {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    const endpoint = `/admin/atharva/authorities${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ authorities: Authority[] }>(endpoint);
    return res.data?.authorities || [];
  },

  async createAuthority(payload: CreateAuthorityPayload): Promise<Authority> {
    const res = await apiClient.post<Authority>('/admin/atharva/authorities', payload);
    return res.data!;
  },

  async updateAuthority(authorityId: string, payload: UpdateAuthorityPayload): Promise<Authority> {
    const res = await apiClient.patch<Authority>(`/admin/atharva/authorities/${authorityId}`, payload);
    return res.data!;
  },

  async transferAuthority(authorityId: string, replacementAuthorityId: string): Promise<Record<string, unknown>> {
    const res = await apiClient.post<Record<string, unknown>>(`/admin/atharva/authorities/${authorityId}/transfer`, {
      replacement_authority_id: replacementAuthorityId,
    });
    return res.data!;
  },

  async deleteAuthority(authorityId: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/atharva/authorities/${authorityId}`);
    return res.data!;
  },

  async updateAuthorityStatus(authorityId: string, isActive: boolean): Promise<Authority> {
    const res = await apiClient.patch<Authority>(`/admin/atharva/authorities/${authorityId}/status`, {
      is_active: isActive,
    });
    return res.data!;
  },

  // =========================================================================
  // SUBJECT CLUSTERS
  // =========================================================================
  async getSubjectClusters(params?: { is_active?: boolean }): Promise<SubjectCluster[]> {
    const query = new URLSearchParams();
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const qs = query.toString();
    const endpoint = `/admin/atharva/subject-clusters${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ clusters: SubjectCluster[] }>(endpoint);
    return res.data?.clusters || [];
  },

  async createSubjectCluster(payload: CreateSubjectClusterPayload): Promise<SubjectCluster> {
    const res = await apiClient.post<SubjectCluster>('/admin/atharva/subject-clusters', payload);
    return res.data!;
  },

  async updateSubjectCluster(clusterId: string, payload: UpdateSubjectClusterPayload): Promise<SubjectCluster> {
    const res = await apiClient.patch<SubjectCluster>(`/admin/atharva/subject-clusters/${clusterId}`, payload);
    return res.data!;
  },

  async deleteSubjectCluster(clusterId: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/atharva/subject-clusters/${clusterId}`);
    return res.data!;
  },

  async updateSubjectClusterAssistantDean(
    clusterId: string,
    assistantDeanId: string | null
  ): Promise<SubjectCluster> {
    const res = await apiClient.patch<SubjectCluster>(
      `/admin/atharva/subject-clusters/${clusterId}/assistant-dean`,
      { assistant_dean_id: assistantDeanId }
    );
    return res.data!;
  },

  async updateSubjectClusterStatus(
    clusterId: string,
    isActive: boolean
  ): Promise<{ id: string; is_active: boolean }> {
    const res = await apiClient.patch<{ id: string; is_active: boolean }>(
      `/admin/atharva/subject-clusters/${clusterId}/status`,
      { is_active: isActive }
    );
    return res.data!;
  },

  // =========================================================================
  // SUBJECTS
  // =========================================================================
  async getSubjects(params?: {
    subject_cluster_id?: string;
    is_active?: boolean;
    search?: string;
  }): Promise<Subject[]> {
    const query = new URLSearchParams();
    if (params?.subject_cluster_id) query.append('subject_cluster_id', params.subject_cluster_id);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    const endpoint = `/admin/atharva/subjects${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ subjects: Subject[] }>(endpoint);
    return res.data?.subjects || [];
  },

  async createSubject(payload: CreateSubjectPayload): Promise<Subject> {
    const res = await apiClient.post<Subject>('/admin/atharva/subjects', payload);
    return res.data!;
  },

  async updateSubject(subjectId: string, payload: UpdateSubjectPayload): Promise<Subject> {
    const res = await apiClient.patch<Subject>(`/admin/atharva/subjects/${subjectId}`, payload);
    return res.data!;
  },

  async deleteSubject(subjectId: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/atharva/subjects/${subjectId}`);
    return res.data!;
  },

  async updateSubjectStatus(
    subjectId: string,
    isActive: boolean
  ): Promise<{ id: string; is_active: boolean }> {
    const res = await apiClient.patch<{ id: string; is_active: boolean }>(
      `/admin/atharva/subjects/${subjectId}/status`,
      { is_active: isActive }
    );
    return res.data!;
  },

  async updateSubjectMapping(
    subjectId: string,
    clusterId: string
  ): Promise<{ id: string; subject_cluster_id: string }> {
    const res = await apiClient.patch<{ id: string; subject_cluster_id: string }>(
      `/admin/atharva/subjects/${subjectId}/cluster`,
      { subject_cluster_id: clusterId }
    );
    return res.data!;
  },

  // =========================================================================
  // GRIEVANCE CLUSTERS
  // =========================================================================
  async getGrievanceClusters(params?: { is_active?: boolean }): Promise<GrievanceCluster[]> {
    const query = new URLSearchParams();
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));

    const qs = query.toString();
    const endpoint = `/admin/atharva/grievance-clusters${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ clusters: GrievanceCluster[] }>(endpoint);
    return res.data?.clusters || [];
  },

  async createGrievanceCluster(payload: CreateGrievanceClusterPayload): Promise<GrievanceCluster> {
    const res = await apiClient.post<GrievanceCluster>('/admin/atharva/grievance-clusters', payload);
    return res.data!;
  },

  async updateGrievanceCluster(clusterId: string, payload: UpdateGrievanceClusterPayload): Promise<GrievanceCluster> {
    const res = await apiClient.patch<GrievanceCluster>(`/admin/atharva/grievance-clusters/${clusterId}`, payload);
    return res.data!;
  },

  async deleteGrievanceCluster(clusterId: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/atharva/grievance-clusters/${clusterId}`);
    return res.data!;
  },

  async updateGrievanceClusterAssociateDean(
    clusterId: string,
    associateDeanId: string | null
  ): Promise<GrievanceCluster> {
    const res = await apiClient.patch<GrievanceCluster>(
      `/admin/atharva/grievance-clusters/${clusterId}/associate-dean`,
      { associate_dean_id: associateDeanId }
    );
    return res.data!;
  },

  async updateGrievanceClusterStatus(
    clusterId: string,
    isActive: boolean
  ): Promise<{ id: string; is_active: boolean }> {
    const res = await apiClient.patch<{ id: string; is_active: boolean }>(
      `/admin/atharva/grievance-clusters/${clusterId}/status`,
      { is_active: isActive }
    );
    return res.data!;
  },

  // =========================================================================
  // CATEGORIES & ROUTING
  // =========================================================================
  async getCategories(params?: {
    routing_type?: CategoryRoutingType;
    is_active?: boolean;
    search?: string;
  }): Promise<Category[]> {
    const query = new URLSearchParams();
    if (params?.routing_type) query.append('routing_type', params.routing_type);
    if (params?.is_active !== undefined) query.append('is_active', String(params.is_active));
    if (params?.search) query.append('search', params.search);

    const qs = query.toString();
    const endpoint = `/admin/atharva/categories${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ categories: Category[] }>(endpoint);
    return res.data?.categories || [];
  },

  async createCategory(payload: CreateCategoryPayload): Promise<Category> {
    const res = await apiClient.post<Category>('/admin/atharva/categories', payload);
    return res.data!;
  },

  async updateCategory(categoryId: string, payload: UpdateCategoryPayload): Promise<Category> {
    const res = await apiClient.patch<Category>(`/admin/atharva/categories/${categoryId}`, payload);
    return res.data!;
  },

  async deleteCategory(categoryId: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/atharva/categories/${categoryId}`);
    return res.data!;
  },

  async updateCategoryRouting(
    categoryId: string,
    payload: {
      routing_type: CategoryRoutingType;
      grievance_cluster_id?: string | null;
      fixed_authority_id?: string | null;
    }
  ): Promise<Category> {
    const res = await apiClient.patch<Category>(
      `/admin/atharva/categories/${categoryId}/routing`,
      payload
    );
    return res.data!;
  },

  async updateCategoryStatus(
    categoryId: string,
    isActive: boolean
  ): Promise<{ id: string; is_active: boolean }> {
    const res = await apiClient.patch<{ id: string; is_active: boolean }>(
      `/admin/atharva/categories/${categoryId}/status`,
      { is_active: isActive }
    );
    return res.data!;
  },

  async simulateRouting(payload: RoutingSimulationRequest): Promise<RoutingSimulationResult> {
    const res = await apiClient.post<RoutingSimulationResult>('/admin/atharva/routing/simulate', payload);
    return res.data!;
  },

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================
  async getAuditLogs(params?: {
    module?: string;
    action?: string;
    entity_name?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedAuditLogs> {
    const query = new URLSearchParams();
    if (params?.module) query.append('module', params.module);
    if (params?.action) query.append('action', params.action);
    if (params?.entity_name) query.append('entity_name', params.entity_name);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const qs = query.toString();
    const endpoint = `/admin/atharva/audit-logs${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<PaginatedAuditLogs>(endpoint);
    return res.data || { total: 0, logs: [] };
  },
};
