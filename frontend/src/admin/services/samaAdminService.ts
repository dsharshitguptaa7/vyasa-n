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
  CertificateStatsRecord,
  CertificatePreviewPayload,
  CertificateApprovalPayload,
  CertificateReissuePayload,
  CertificateTemplateItem,
  CreateTemplatePayload,
  UpdateTemplatePayload,
  TemplateListResponse,
  CertificateSignatoryItem,
  CreateSignatoryPayload,
  UpdateSignatoryPayload,
  SignatoryListResponse,
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
  BulkDeleteResult,
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

  async bulkDeletePublications(publicationIds: string[]): Promise<BulkDeleteResult> {
    const res = await apiClient.post<BulkDeleteResult>('/admin/sama/publications/bulk-delete', {
      publication_ids: publicationIds,
    });
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

  async bulkDeleteAuthors(authorIds: string[]): Promise<BulkDeleteResult> {
    const res = await apiClient.post<BulkDeleteResult>('/admin/sama/authors/bulk-delete', {
      author_ids: authorIds,
    });
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
      let errorMsg = `Failed to download certificate (HTTP ${response.status})`;
      try {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const errData = await response.json();
          errorMsg = errData?.message || errData?.detail || errorMsg;
        } else {
          if (response.status === 403) errorMsg = 'Certificate revoked or issuance not finalized. PDF download is not permitted.';
          else if (response.status === 404) errorMsg = 'Certificate PDF document not found in storage.';
          else if (response.status === 409) errorMsg = 'Certificate superseded or integrity verification failed.';
          else if (response.status >= 500) errorMsg = 'Storage service is temporarily unavailable. Please try again later.';
        }
      } catch {
        // keep fallback errorMsg
      }
      throw new Error(errorMsg);
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

  async getCertificateStats(): Promise<CertificateStatsRecord> {
    const res = await apiClient.get<CertificateStatsRecord>('/admin/sama/certificates/stats');
    return res.data || {
      total_certificates: 0,
      draft_certificates: 0,
      pending_approvals: 0,
      issued_certificates: 0,
      revoked_certificates: 0,
      reissued_certificates: 0,
      total_researchers_linked: 0,
    };
  },

  async previewCertificate(payload: CertificatePreviewPayload): Promise<Blob> {
    const url = `${config.apiBaseUrl}/admin/sama/certificates/preview`;
    const token = authService.getToken();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let errorMsg = `Failed to generate certificate preview (HTTP ${response.status})`;
      try {
        const ct = response.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const errData = await response.json();
          errorMsg = errData?.message || errData?.detail || errorMsg;
        } else {
          if (response.status === 403) errorMsg = 'Permission denied to preview certificate.';
          else if (response.status >= 500) errorMsg = 'PDF generation engine temporarily unavailable.';
        }
      } catch {
        // keep fallback errorMsg
      }
      throw new Error(errorMsg);
    }
    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('application/pdf')) {
      throw new Error('Server returned non-PDF response for certificate preview.');
    }
    return response.blob();
  },

  async approveCertificate(
    id: string,
    authority: 'DEAN_RD' | 'VICE_CHANCELLOR',
    action: 'APPROVE' | 'REJECT',
    remarks?: string
  ): Promise<FelicitationCertificateItem> {
    const payload: CertificateApprovalPayload = { action, remarks: remarks || undefined };
    const res = await apiClient.post<FelicitationCertificateItem>(
      `/admin/sama/certificates/${id}/approve?authority=${authority}`,
      payload
    );
    return res.data!;
  },

  async reissueCertificate(id: string, payload: CertificateReissuePayload): Promise<FelicitationCertificateItem> {
    const res = await apiClient.post<FelicitationCertificateItem>(`/admin/sama/certificates/${id}/reissue`, payload);
    return res.data!;
  },

  // =========================================================================
  // 5b. CERTIFICATE TEMPLATES
  // =========================================================================
  async getTemplates(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    certificate_type?: string;
  }): Promise<TemplateListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));
    if (params?.certificate_type) q.append('certificate_type', params.certificate_type);

    const qs = q.toString();
    const res = await apiClient.get<TemplateListResponse>(`/admin/sama/templates${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getTemplate(id: string): Promise<CertificateTemplateItem> {
    const res = await apiClient.get<CertificateTemplateItem>(`/admin/sama/templates/${id}`);
    return res.data!;
  },

  async createTemplate(payload: CreateTemplatePayload): Promise<CertificateTemplateItem> {
    const res = await apiClient.post<CertificateTemplateItem>('/admin/sama/templates', payload);
    return res.data!;
  },

  async updateTemplate(id: string, payload: UpdateTemplatePayload): Promise<CertificateTemplateItem> {
    const res = await apiClient.put<CertificateTemplateItem>(`/admin/sama/templates/${id}`, payload);
    return res.data!;
  },

  // =========================================================================
  // 5c. CERTIFICATE SIGNATORIES
  // =========================================================================
  async getSignatories(params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
    authority_type?: string;
  }): Promise<SignatoryListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.is_active !== undefined) q.append('is_active', String(params.is_active));
    if (params?.authority_type) q.append('authority_type', params.authority_type);

    const qs = q.toString();
    const res = await apiClient.get<SignatoryListResponse>(`/admin/sama/signatories${qs ? `?${qs}` : ''}`);
    return res.data || { total: 0, items: [] };
  },

  async getSignatory(id: string): Promise<CertificateSignatoryItem> {
    const res = await apiClient.get<CertificateSignatoryItem>(`/admin/sama/signatories/${id}`);
    return res.data!;
  },

  async createSignatory(payload: CreateSignatoryPayload): Promise<CertificateSignatoryItem> {
    const res = await apiClient.post<CertificateSignatoryItem>('/admin/sama/signatories', payload);
    return res.data!;
  },

  async updateSignatory(id: string, payload: UpdateSignatoryPayload): Promise<CertificateSignatoryItem> {
    const res = await apiClient.put<CertificateSignatoryItem>(`/admin/sama/signatories/${id}`, payload);
    return res.data!;
  },

  async uploadSignatorySignature(id: string, file: File): Promise<CertificateSignatoryItem> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.postFormData<CertificateSignatoryItem>(
      `/admin/sama/signatories/${id}/upload-signature`,
      formData
    );
    return res.data!;
  },

  async toggleSignatoryActive(id: string): Promise<CertificateSignatoryItem> {
    const res = await apiClient.patch<CertificateSignatoryItem>(`/admin/sama/signatories/${id}/toggle-active`, {});
    return res.data!;
  },

  async deleteSignatory(id: string): Promise<{ action: string; message: string; referenced_approvals: number }> {
    const res = await apiClient.delete<{ action: string; message: string; referenced_approvals: number }>(`/admin/sama/signatories/${id}`);
    return res.data!;
  },

  getSignatorySignatureUrl(id: string): string {
    return `${config.apiBaseUrl}/admin/sama/signatories/${id}/signature`;
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

  async bulkDeleteImportBatches(batchIds: string[]): Promise<BulkDeleteResult> {
    const res = await apiClient.post<BulkDeleteResult>('/admin/sama/import/batches/bulk-delete', {
      batch_ids: batchIds,
    });
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
