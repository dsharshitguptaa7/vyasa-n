import { apiClient } from '../../services/apiClient';
import { authService } from '../../services/authService';
import { config } from '../../config';
import { ApiResponse } from '../../types/api';
import {
  AnudaanPublicImpactStats,
  AnudaanDisbursementCreate,
  AnudaanDisbursementOut,
  AnudaanDisbursementListResponse,
  AnudaanGalleryItemCreate,
  AnudaanGalleryItemUpdate,
  AnudaanGalleryItemOut,
  AnudaanGalleryListResponse,
  AnudaanGalleryImageOut,
  AnudaanPublicConfigOut,
  AnudaanPublicConfigUpdate,
  AnudaanSanctionEntryCreate,
  AnudaanSanctionEntryUpdate,
  AnudaanSanctionEntryOut,
  AnudaanSanctionListResponse,
  AnudaanApplicationLookupItem,
  AnudaanFelicitationCycleCreate,
  AnudaanFelicitationCycleUpdate,
  AnudaanFelicitationCycleOut,
  AnudaanFelicitationCycleListResponse,
} from '../types/anudaan';

function requireData<T>(res: ApiResponse<T>): T {
  if (res.data === undefined) {
    throw new Error(res.message || 'Operation returned empty response');
  }
  return res.data;
}

export const anudaanAdminService = {
  // =========================================================================
  // 1. IMPACT DASHBOARD ANALYTICS
  // =========================================================================
  async getImpactStats(academicYear?: string): Promise<AnudaanPublicImpactStats> {
    const q = academicYear ? `?academic_year=${encodeURIComponent(academicYear)}` : '';
    const res = await apiClient.get<AnudaanPublicImpactStats>(`/admin/anudaan/impact/stats${q}`);
    return requireData(res);
  },

  // =========================================================================
  // 1.1 SIMPLIFIED INCENTIVE SANCTION REGISTER
  // =========================================================================
  async getSanctions(params?: {
    skip?: number;
    limit?: number;
    academic_year?: string;
    quartile?: string;
    department?: string;
    cycle_id?: string;
    volume_number?: number;
    issue_number?: number;
    is_published?: boolean;
    search?: string;
  }): Promise<AnudaanSanctionListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.academic_year) q.append('academic_year', params.academic_year);
    if (params?.quartile) q.append('quartile', params.quartile);
    if (params?.department) q.append('department', params.department);
    if (params?.cycle_id) q.append('cycle_id', params.cycle_id);
    if (params?.volume_number !== undefined) q.append('volume_number', String(params.volume_number));
    if (params?.issue_number !== undefined) q.append('issue_number', String(params.issue_number));
    if (params?.is_published !== undefined) q.append('is_published', String(params.is_published));
    if (params?.search) q.append('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await apiClient.get<AnudaanSanctionListResponse>(`/admin/anudaan/sanctions${queryStr}`);
    return requireData(res);
  },

  async lookupApplications(search?: string): Promise<AnudaanApplicationLookupItem[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiClient.get<AnudaanApplicationLookupItem[]>(`/admin/anudaan/sanctions/lookup${q}`);
    return requireData(res);
  },

  async createSanction(payload: AnudaanSanctionEntryCreate): Promise<AnudaanSanctionEntryOut> {
    const res = await apiClient.post<AnudaanSanctionEntryOut>('/admin/anudaan/sanctions', payload);
    return requireData(res);
  },

  async updateSanction(id: string, payload: AnudaanSanctionEntryUpdate): Promise<AnudaanSanctionEntryOut> {
    const res = await apiClient.put<AnudaanSanctionEntryOut>(`/admin/anudaan/sanctions/${id}`, payload);
    return requireData(res);
  },

  async toggleSanctionPublish(id: string, isPublished: boolean): Promise<AnudaanSanctionEntryOut> {
    const res = await apiClient.patch<AnudaanSanctionEntryOut>(`/admin/anudaan/sanctions/${id}/publish?is_published=${isPublished}`, {});
    return requireData(res);
  },

  async deleteSanction(id: string): Promise<void> {
    await apiClient.delete(`/admin/anudaan/sanctions/${id}`);
  },

  // =========================================================================
  // 1.2 FELICITATION / RECOGNITION CYCLE MANAGEMENT (VOLUME & ISSUE)
  // =========================================================================
  async getFelicitationCycles(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    academic_year?: string;
    is_published?: boolean;
    is_archived?: boolean;
    search?: string;
  }): Promise<AnudaanFelicitationCycleListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.status) q.append('status', params.status);
    if (params?.academic_year) q.append('academic_year', params.academic_year);
    if (params?.is_published !== undefined) q.append('is_published', String(params.is_published));
    if (params?.is_archived !== undefined) q.append('is_archived', String(params.is_archived));
    if (params?.search) q.append('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await apiClient.get<AnudaanFelicitationCycleListResponse>(`/admin/anudaan/felicitations${queryStr}`);
    return requireData(res);
  },

  async getFelicitationCycle(id: string): Promise<AnudaanFelicitationCycleOut> {
    const res = await apiClient.get<AnudaanFelicitationCycleOut>(`/admin/anudaan/felicitations/${id}`);
    return requireData(res);
  },

  async createFelicitationCycle(payload: AnudaanFelicitationCycleCreate): Promise<AnudaanFelicitationCycleOut> {
    const res = await apiClient.post<AnudaanFelicitationCycleOut>('/admin/anudaan/felicitations', payload);
    return requireData(res);
  },

  async updateFelicitationCycle(id: string, payload: AnudaanFelicitationCycleUpdate): Promise<AnudaanFelicitationCycleOut> {
    const res = await apiClient.put<AnudaanFelicitationCycleOut>(`/admin/anudaan/felicitations/${id}`, payload);
    return requireData(res);
  },

  async toggleFelicitationPublish(id: string, isPublished: boolean): Promise<AnudaanFelicitationCycleOut> {
    const res = await apiClient.patch<AnudaanFelicitationCycleOut>(`/admin/anudaan/felicitations/${id}/publish?is_published=${isPublished}`, {});
    return requireData(res);
  },

  async toggleFelicitationArchive(id: string, isArchived: boolean): Promise<AnudaanFelicitationCycleOut> {
    const res = await apiClient.patch<AnudaanFelicitationCycleOut>(`/admin/anudaan/felicitations/${id}/archive?is_archived=${isArchived}`, {});
    return requireData(res);
  },

  async deleteFelicitationCycle(id: string): Promise<void> {
    await apiClient.delete(`/admin/anudaan/felicitations/${id}`);
  },

  // =========================================================================
  // 2. FINANCIAL DISBURSEMENT LEDGER
  // =========================================================================
  async getDisbursements(params?: {
    skip?: number;
    limit?: number;
    academic_year?: string;
    verification_status?: string;
  }): Promise<AnudaanDisbursementListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.academic_year) q.append('academic_year', params.academic_year);
    if (params?.verification_status) q.append('verification_status', params.verification_status);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await apiClient.get<AnudaanDisbursementListResponse>(`/admin/anudaan/disbursements${queryStr}`);
    return requireData(res);
  },

  async recordDisbursement(payload: AnudaanDisbursementCreate): Promise<AnudaanDisbursementOut> {
    const res = await apiClient.post<AnudaanDisbursementOut>('/admin/anudaan/disbursements', payload);
    return requireData(res);
  },

  async verifyDisbursement(id: string, notes?: string): Promise<AnudaanDisbursementOut> {
    const res = await apiClient.put<AnudaanDisbursementOut>(`/admin/anudaan/disbursements/${id}/verify`, { notes });
    return requireData(res);
  },

  async reverseDisbursement(id: string, reversal_reason: string): Promise<AnudaanDisbursementOut> {
    const res = await apiClient.post<AnudaanDisbursementOut>(`/admin/anudaan/disbursements/${id}/reverse`, {
      reversal_reason,
    });
    return requireData(res);
  },

  // =========================================================================
  // 3. RESEARCHER RECOGNITION GALLERY CMS
  // =========================================================================
  async getGalleryItems(params?: {
    skip?: number;
    limit?: number;
    academic_year?: string;
    is_published?: boolean;
  }): Promise<AnudaanGalleryListResponse> {
    const q = new URLSearchParams();
    if (params?.skip !== undefined) q.append('skip', String(params.skip));
    if (params?.limit !== undefined) q.append('limit', String(params.limit));
    if (params?.academic_year) q.append('academic_year', params.academic_year);
    if (params?.is_published !== undefined) q.append('is_published', String(params.is_published));
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    const res = await apiClient.get<AnudaanGalleryListResponse>(`/admin/anudaan/gallery${queryStr}`);
    return requireData(res);
  },

  async getGalleryItem(id: string): Promise<AnudaanGalleryItemOut> {
    const res = await apiClient.get<AnudaanGalleryItemOut>(`/admin/anudaan/gallery/${id}`);
    return requireData(res);
  },

  async createGalleryItem(payload: AnudaanGalleryItemCreate): Promise<AnudaanGalleryItemOut> {
    const res = await apiClient.post<AnudaanGalleryItemOut>('/admin/anudaan/gallery', payload);
    return requireData(res);
  },

  async updateGalleryItem(id: string, payload: AnudaanGalleryItemUpdate): Promise<AnudaanGalleryItemOut> {
    const res = await apiClient.put<AnudaanGalleryItemOut>(`/admin/anudaan/gallery/${id}`, payload);
    return requireData(res);
  },

  async deleteGalleryItem(id: string): Promise<void> {
    await apiClient.delete(`/admin/anudaan/gallery/${id}`);
  },

  async uploadGalleryImage(
    itemId: string,
    file: File,
    caption?: string,
    isCover: boolean = false,
    order: number = 0
  ): Promise<AnudaanGalleryImageOut> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    formData.append('is_cover', String(isCover));
    formData.append('display_order', String(order));

    const token = authService.getToken();
    const url = `${config.apiBaseUrl}/admin/anudaan/gallery/${itemId}/images`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(json?.detail || json?.message || 'Failed to upload photograph');
    }
    return json.data;
  },

  async removeGalleryImage(imageId: string): Promise<void> {
    await apiClient.delete(`/admin/anudaan/gallery/images/${imageId}`);
  },

  async setCoverImage(itemId: string, imageId: string): Promise<void> {
    await apiClient.put(`/admin/anudaan/gallery/${itemId}/images/${imageId}/cover`);
  },

  // =========================================================================
  // 4. PUBLIC DISPLAY CONFIGURATION
  // =========================================================================
  async getConfig(): Promise<AnudaanPublicConfigOut> {
    const res = await apiClient.get<AnudaanPublicConfigOut>('/admin/anudaan/config');
    return requireData(res);
  },

  async updateConfig(payload: AnudaanPublicConfigUpdate): Promise<AnudaanPublicConfigOut> {
    const res = await apiClient.put<AnudaanPublicConfigOut>('/admin/anudaan/config', payload);
    return requireData(res);
  },

  getImageUrl(imageId: string): string {
    return `${config.apiBaseUrl}/modules/yajur-veda/anudaan/public/gallery/images/${imageId}/file`;
  },
};
