import { apiClient } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { config } from '../../config';
import {
  KnowledgeDashboardStats,
  KnowledgeDocumentItem,
  KnowledgeDocumentVersionItem,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentDetailResponse,
  KnowledgeUploadPayload,
  KnowledgeUploadVersionPayload,
  KnowledgeApprovePayload,
  KnowledgeRejectPayload,
  KnowledgeRetryPayload,
  KnowledgeFilterParams,
} from '../types/knowledge';

const BASE_PREFIX = '/v1/admin/knowledge-centre';

export const knowledgeAdminService = {
  /**
   * Retrieves platform-wide Knowledge Centre dashboard metrics and passage distributions.
   */
  async getDashboardStats(): Promise<KnowledgeDashboardStats> {
    const res = await apiClient.get<KnowledgeDashboardStats>(`${BASE_PREFIX}/dashboard/stats`);
    if (!res.data) {
      throw new Error(res.message || 'Failed to fetch Knowledge Centre statistics.');
    }
    return res.data;
  },

  /**
   * Lists documents with domain, status, search filtering, and pagination.
   */
  async getDocuments(params?: KnowledgeFilterParams): Promise<KnowledgeDocumentListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params?.domain) searchParams.append('domain', params.domain);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.document_type) searchParams.append('document_type', params.document_type);

    const queryStr = searchParams.toString();
    const endpoint = `${BASE_PREFIX}/documents${queryStr ? `?${queryStr}` : ''}`;
    const res = await apiClient.get<KnowledgeDocumentListResponse>(endpoint);
    if (!res.data) {
      throw new Error(res.message || 'Failed to list documents.');
    }
    return res.data;
  },

  /**
   * Fetches full details for a document, including historical versions and parsed passages.
   */
  async getDocumentDetail(documentId: string): Promise<KnowledgeDocumentDetailResponse> {
    const res = await apiClient.get<KnowledgeDocumentDetailResponse>(`${BASE_PREFIX}/documents/${documentId}`);
    if (!res.data) {
      throw new Error(res.message || 'Failed to fetch document details.');
    }
    return res.data;
  },

  /**
   * Retrieves all immutable versions of a document.
   */
  async getDocumentVersions(documentId: string): Promise<KnowledgeDocumentVersionItem[]> {
    const res = await apiClient.get<KnowledgeDocumentVersionItem[]>(`${BASE_PREFIX}/documents/${documentId}/versions`);
    return res.data || [];
  },

  /**
   * Uploads a new document file with institutional metadata.
   */
  async uploadDocument(payload: KnowledgeUploadPayload): Promise<KnowledgeDocumentItem> {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('title', payload.title);
    formData.append('domain', payload.domain);
    formData.append('document_type', payload.document_type);

    if (payload.description) formData.append('description', payload.description);
    if (payload.subdomain) formData.append('subdomain', payload.subdomain);
    if (payload.academic_session) formData.append('academic_session', payload.academic_session);
    if (payload.issuing_authority) formData.append('issuing_authority', payload.issuing_authority);
    if (payload.effective_from) formData.append('effective_from', payload.effective_from);
    if (payload.effective_until) formData.append('effective_until', payload.effective_until);

    const res = await apiClient.postFormData<KnowledgeDocumentItem>(`${BASE_PREFIX}/documents/upload`, formData);
    if (!res.data) {
      throw new Error(res.message || 'Failed to upload document.');
    }
    return res.data;
  },

  /**
   * Uploads a revised version for an existing document.
   */
  async uploadNewVersion(
    documentId: string,
    payload: KnowledgeUploadVersionPayload
  ): Promise<KnowledgeDocumentVersionItem> {
    const formData = new FormData();
    formData.append('file', payload.file);

    const res = await apiClient.postFormData<KnowledgeDocumentVersionItem>(
      `${BASE_PREFIX}/documents/${documentId}/versions`,
      formData
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to upload new version.');
    }
    return res.data;
  },

  /**
   * Approves a document or version for live publication and AI retrieval.
   */
  async approveDocument(
    documentId: string,
    payload?: KnowledgeApprovePayload
  ): Promise<KnowledgeDocumentItem> {
    const res = await apiClient.post<KnowledgeDocumentItem>(
      `${BASE_PREFIX}/documents/${documentId}/approve`,
      payload || {}
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to approve document.');
    }
    return res.data;
  },

  /**
   * Rejects a document or version with a mandatory reason.
   */
  async rejectDocument(
    documentId: string,
    payload: KnowledgeRejectPayload
  ): Promise<KnowledgeDocumentItem> {
    const res = await apiClient.post<KnowledgeDocumentItem>(
      `${BASE_PREFIX}/documents/${documentId}/reject`,
      payload
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to reject document.');
    }
    return res.data;
  },

  /**
   * Archives a document, removing it from active AI retrieval.
   */
  async archiveDocument(documentId: string): Promise<KnowledgeDocumentItem> {
    const res = await apiClient.post<KnowledgeDocumentItem>(
      `${BASE_PREFIX}/documents/${documentId}/archive`,
      {}
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to archive document.');
    }
    return res.data;
  },

  /**
   * Retries text extraction and vector embedding for a failed document.
   */
  async retryExtraction(
    documentId: string,
    payload?: KnowledgeRetryPayload
  ): Promise<KnowledgeDocumentVersionItem> {
    const res = await apiClient.post<KnowledgeDocumentVersionItem>(
      `${BASE_PREFIX}/documents/${documentId}/retry`,
      payload || {}
    );
    if (!res.data) {
      throw new Error(res.message || 'Failed to retry extraction.');
    }
    return res.data;
  },

  /**
   * Generates a streaming download URL or downloads directly with SADMIN authentication.
   */
  async downloadDocumentFile(documentId: string, versionId?: string, filename?: string): Promise<void> {
    const searchParams = new URLSearchParams();
    if (versionId) searchParams.append('version_id', versionId);
    const queryStr = searchParams.toString();
    const url = `${config.apiBaseUrl}${BASE_PREFIX}/documents/${documentId}/download${queryStr ? `?${queryStr}` : ''}`;

    const token = authService.getToken();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename || `knowledge_document_${documentId}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};
