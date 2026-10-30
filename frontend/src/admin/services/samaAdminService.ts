import { apiClient } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { config } from '../../config';
import {
  ResearchPublicationItem,
  CreatePublicationPayload,
  UpdatePublicationPayload,
  PublicationListResponse,
  ResearchAuthorItem,
  CreateAuthorPayload,
  UpdateAuthorPayload,
  AuthorVerificationPayload,
  AuthorListResponse,
  ResearchBulletinItem,
  CreateBulletinPayload,
  UpdateBulletinPayload,
  BulletinListResponse,
  CamAiProjectItem,
  CreateCamProjectPayload,
  UpdateCamProjectPayload,
  CamProjectListResponse,
  FelicitationCertificateItem,
  IssueCertificatePayload,
  CertificateListResponse,
  ResearcherSpotlightItem,
  CreateSpotlightPayload,
  UpdateSpotlightPayload,
  SpotlightListResponse,
  StorageUploadResult,
  SamaOverviewStats,
  ContentStatus,
  ImportBatchRecord,
  ImportPreviewResult,
  ImportExecuteResult,
} from '../types/sama';

export const samaAdminService = {
  // =========================================================================
  // 1. PUBLICATIONS
  // =========================================================================
  async getPublications(params?: {
    skip?: number;
    limit?: number;
    bulletin_id?: string;
    category?: string;
    status?: string;
    search?: string;
    is_featured?: boolean;
  }): Promise<PublicationListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.bulletin_id) q.append('bulletin_id', params.bulletin_id);
    if (params?.category) q.append('category', params.category);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.is_featured !== undefined) q.append('is_featured', String(params.is_featured));

    const qs = q.toString();
    const res = await apiClient.get<PublicationListResponse>(`/admin/sama/publications${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getPublication(id: string): Promise<ResearchPublicationItem> {
    const res = await apiClient.get<ResearchPublicationItem>(`/admin/sama/publications/${id}`);
    return res.data!;
  },

  async createPublication(payload: CreatePublicationPayload): Promise<ResearchPublicationItem> {
    const res = await apiClient.post<ResearchPublicationItem>('/admin/sama/publications', payload);
    return res.data!;
  },

  async updatePublication(id: string, payload: UpdatePublicationPayload): Promise<ResearchPublicationItem> {
    const res = await apiClient.put<ResearchPublicationItem>(`/admin/sama/publications/${id}`, payload);
    return res.data!;
  },

  async updatePublicationStatus(id: string, status: ContentStatus): Promise<ResearchPublicationItem> {
    const res = await apiClient.patch<ResearchPublicationItem>(`/admin/sama/publications/${id}/status`, { status });
    return res.data!;
  },

  async deletePublication(id: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/sama/publications/${id}`);
    return res.data!;
  },

  // =========================================================================
  // 2. AUTHORS & SCOPUS
  // =========================================================================
  async getAuthors(params?: {
    skip?: number;
    limit?: number;
    search?: string;
    is_verified?: boolean;
    department?: string;
  }): Promise<AuthorListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.search) q.append('search', params.search);
    if (params?.is_verified !== undefined) q.append('is_verified', String(params.is_verified));
    if (params?.department) q.append('department', params.department);

    const qs = q.toString();
    const res = await apiClient.get<AuthorListResponse>(`/admin/sama/authors${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getAuthor(id: string): Promise<ResearchAuthorItem> {
    const res = await apiClient.get<ResearchAuthorItem>(`/admin/sama/authors/${id}`);
    return res.data!;
  },

  async createAuthor(payload: CreateAuthorPayload): Promise<ResearchAuthorItem> {
    const res = await apiClient.post<ResearchAuthorItem>('/admin/sama/authors', payload);
    return res.data!;
  },

  async updateAuthor(id: string, payload: UpdateAuthorPayload): Promise<ResearchAuthorItem> {
    const res = await apiClient.put<ResearchAuthorItem>(`/admin/sama/authors/${id}`, payload);
    return res.data!;
  },

  async verifyAuthor(id: string, payload: AuthorVerificationPayload): Promise<ResearchAuthorItem> {
    const res = await apiClient.patch<ResearchAuthorItem>(`/admin/sama/authors/${id}/verify`, payload);
    return res.data!;
  },

  async deleteAuthor(id: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/sama/authors/${id}`);
    return res.data!;
  },

  // =========================================================================
  // 3. BULLETINS
  // =========================================================================
  async getBulletins(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    is_active?: boolean;
  }): Promise<BulletinListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.status) q.append('status', params.status);
    if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));

    const qs = q.toString();
    const res = await apiClient.get<BulletinListResponse>(`/admin/sama/bulletins${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getBulletin(id: string): Promise<ResearchBulletinItem> {
    const res = await apiClient.get<ResearchBulletinItem>(`/admin/sama/bulletins/${id}`);
    return res.data!;
  },

  async uploadBulletinFile(file: File): Promise<StorageUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.postFormData<StorageUploadResult>('/admin/sama/bulletins/upload', formData);
    return res.data!;
  },

  async createBulletin(payload: CreateBulletinPayload): Promise<ResearchBulletinItem> {
    const res = await apiClient.post<ResearchBulletinItem>('/admin/sama/bulletins', payload);
    return res.data!;
  },

  async updateBulletin(id: string, payload: UpdateBulletinPayload): Promise<ResearchBulletinItem> {
    const res = await apiClient.put<ResearchBulletinItem>(`/admin/sama/bulletins/${id}`, payload);
    return res.data!;
  },

  async updateBulletinStatus(
    id: string,
    status: ContentStatus,
    isActive?: boolean
  ): Promise<ResearchBulletinItem> {
    const res = await apiClient.patch<ResearchBulletinItem>(`/admin/sama/bulletins/${id}/status`, {
      status,
      is_active: isActive,
    });
    return res.data!;
  },

  async deleteBulletin(id: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/sama/bulletins/${id}`);
    return res.data!;
  },

  // =========================================================================
  // 4. CAM-AI PROJECTS
  // =========================================================================
  async getCamProjects(params?: {
    skip?: number;
    limit?: number;
    category?: string;
    domain?: string;
    status?: string;
    search?: string;
  }): Promise<CamProjectListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.category) q.append('category', params.category);
    if (params?.domain) q.append('domain', params.domain);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);

    const qs = q.toString();
    const res = await apiClient.get<CamProjectListResponse>(`/admin/sama/cam-projects${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getCamProject(id: string): Promise<CamAiProjectItem> {
    const res = await apiClient.get<CamAiProjectItem>(`/admin/sama/cam-projects/${id}`);
    return res.data!;
  },

  async createCamProject(payload: CreateCamProjectPayload): Promise<CamAiProjectItem> {
    const res = await apiClient.post<CamAiProjectItem>('/admin/sama/cam-projects', payload);
    return res.data!;
  },

  async updateCamProject(id: string, payload: UpdateCamProjectPayload): Promise<CamAiProjectItem> {
    const res = await apiClient.put<CamAiProjectItem>(`/admin/sama/cam-projects/${id}`, payload);
    return res.data!;
  },

  async deleteCamProject(id: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/sama/cam-projects/${id}`);
    return res.data!;
  },

  // =========================================================================
  // 5. CERTIFICATES
  // =========================================================================
  async getCertificates(params?: {
    skip?: number;
    limit?: number;
    bulletin_id?: string;
    author_id?: string;
    is_revoked?: boolean;
    search?: string;
  }): Promise<CertificateListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.bulletin_id) q.append('bulletin_id', params.bulletin_id);
    if (params?.author_id) q.append('author_id', params.author_id);
    if (params?.is_revoked !== undefined) q.append('is_revoked', String(params.is_revoked));
    if (params?.search) q.append('search', params.search);

    const qs = q.toString();
    const res = await apiClient.get<CertificateListResponse>(`/admin/sama/certificates${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getCertificate(id: string): Promise<FelicitationCertificateItem> {
    const res = await apiClient.get<FelicitationCertificateItem>(`/admin/sama/certificates/${id}`);
    return res.data!;
  },

  async uploadCertificateFile(fileOrId: File | string, maybeFile?: File): Promise<StorageUploadResult> {
    const file = maybeFile instanceof File ? maybeFile : (fileOrId as File);
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.postFormData<StorageUploadResult>('/admin/sama/certificates/upload', formData);
    return res.data!;
  },

  async issueCertificate(payload: IssueCertificatePayload): Promise<FelicitationCertificateItem> {
    const res = await apiClient.post<FelicitationCertificateItem>('/admin/sama/certificates', payload);
    return res.data!;
  },

  async createCertificate(payload: IssueCertificatePayload): Promise<FelicitationCertificateItem> {
    return this.issueCertificate(payload);
  },

  async revokeCertificate(id: string, reasonOrPayload: string | { revocation_reason: string }): Promise<FelicitationCertificateItem> {
    const reason = typeof reasonOrPayload === 'string' ? reasonOrPayload : reasonOrPayload.revocation_reason;
    const res = await apiClient.post<FelicitationCertificateItem>(`/admin/sama/certificates/${id}/revoke`, {
      revocation_reason: reason,
    });
    return res.data!;
  },

  async downloadCertificate(id: string, filename: string): Promise<void> {
    const url = `${config.apiBaseUrl}/admin/sama/certificates/${id}/download`;
    const token = authService.getToken();
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error(`Failed to download certificate (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  // =========================================================================
  // 6. SPOTLIGHTS
  // =========================================================================
  async getSpotlights(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    media_type?: string;
  }): Promise<SpotlightListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));
    if (params?.media_type) q.append('media_type', params.media_type);

    const qs = q.toString();
    const res = await apiClient.get<SpotlightListResponse>(`/admin/sama/spotlights${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getSpotlight(id: string): Promise<ResearcherSpotlightItem> {
    const res = await apiClient.get<ResearcherSpotlightItem>(`/admin/sama/spotlights/${id}`);
    return res.data!;
  },

  async createSpotlight(payload: CreateSpotlightPayload): Promise<ResearcherSpotlightItem> {
    const res = await apiClient.post<ResearcherSpotlightItem>('/admin/sama/spotlights', payload);
    return res.data!;
  },

  async updateSpotlight(id: string, payload: UpdateSpotlightPayload): Promise<ResearcherSpotlightItem> {
    const res = await apiClient.put<ResearcherSpotlightItem>(`/admin/sama/spotlights/${id}`, payload);
    return res.data!;
  },

  async deleteSpotlight(id: string): Promise<{ id: string }> {
    const res = await apiClient.delete<{ id: string }>(`/admin/sama/spotlights/${id}`);
    return res.data!;
  },

  // =========================================================================
  // 7. DATA IMPORT & RECONCILIATION
  // =========================================================================
  async previewImport(entityType: string, file: File): Promise<ImportPreviewResult> {
    const formData = new FormData();
    formData.append('entity_type', entityType);
    formData.append('file', file);
    const res = await apiClient.postFormData<ImportPreviewResult>('/admin/sama/import/preview', formData);
    return res.data!;
  },

  async executeImport(batchId: string): Promise<ImportExecuteResult> {
    const res = await apiClient.post<ImportExecuteResult>(`/admin/sama/import/execute/${batchId}`);
    return res.data!;
  },

  async getImportBatches(params?: {
    skip?: number;
    limit?: number;
    entity_type?: string;
    status?: string;
  }): Promise<{ items: ImportBatchRecord[]; total: number; skip: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params?.entity_type) searchParams.append('entity_type', params.entity_type);
    if (params?.status) searchParams.append('status', params.status);

    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<{ items: ImportBatchRecord[]; total: number; skip: number; limit: number }>(
      `/admin/sama/import/batches${query}`
    );
    return res.data!;
  },

  async getImportBatch(batchId: string): Promise<ImportBatchRecord> {
    const res = await apiClient.get<ImportBatchRecord>(`/admin/sama/import/batches/${batchId}`);
    return res.data!;
  },

  async importHistoricalBundle(payload: {
    source_directory?: string;
    dry_run?: boolean;
  }): Promise<Record<string, any>> {
    const res = await apiClient.post<Record<string, any>>('/admin/sama/import/historical-bundle', payload);
    return res.data!;
  },

  // =========================================================================
  // 8. OVERVIEW AGGREGATION
  // =========================================================================
  async getOverviewStats(): Promise<SamaOverviewStats> {
    try {
      const [pubsAll, pubsPub, pubsDraft, authorsAll, authorsVer, bullAll, bullActive, certAll, certRev, camAll, spotAll] =
        await Promise.all([
          this.getPublications({ limit: 1 }),
          this.getPublications({ limit: 1, status: 'published' }),
          this.getPublications({ limit: 1, status: 'draft' }),
          this.getAuthors({ limit: 1 }),
          this.getAuthors({ limit: 1, is_verified: true }),
          this.getBulletins({ limit: 1 }),
          this.getBulletins({ limit: 1, is_active: true }),
          this.getCertificates({ limit: 1 }),
          this.getCertificates({ limit: 1, is_revoked: true }),
          this.getCamProjects({ limit: 1 }),
          this.getSpotlights({ limit: 1 }),
        ]);

      return {
        totalPublications: pubsAll.total,
        publishedPublications: pubsPub.total,
        draftPublications: pubsDraft.total,
        totalAuthors: authorsAll.total,
        verifiedAuthors: authorsVer.total,
        totalBulletins: bullAll.total,
        activeBulletins: bullActive.total,
        totalCertificates: certAll.total,
        revokedCertificates: certRev.total,
        totalCamProjects: camAll.total,
        totalSpotlights: spotAll.total,
      };
    } catch {
      return {
        totalPublications: 0,
        publishedPublications: 0,
        draftPublications: 0,
        totalAuthors: 0,
        verifiedAuthors: 0,
        totalBulletins: 0,
        activeBulletins: 0,
        totalCertificates: 0,
        revokedCertificates: 0,
        totalCamProjects: 0,
        totalSpotlights: 0,
      };
    }
  },
};
