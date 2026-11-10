/**
 * ANUDAAN (Yajur Veda) Typed API Client Service
 * Encapsulates all public and researcher-facing API endpoints for the
 * CSJMU Research Publication Incentive Management System (ANUDAAN V1.1).
 * 
 * Target base route: /modules/yajur-veda/anudaan
 * Base client apiClient prefixes config.apiBaseUrl (/api), resolving to:
 * /api/modules/yajur-veda/anudaan/...
 */

import { apiClient, ApiError } from '../../../services/apiClient';
import { ApiResponse } from '../../../types/api';
import {
  AnudaanApplicationCreateDraft,
  AnudaanApplicationUpdateDraft,
  AnudaanDraftCreationResponse,
  AnudaanApplicationDetailOut,
  AnudaanPublicationCreate,
  AnudaanPublicationUpdate,
  AnudaanPublicationOut,
  AnudaanAuthorCreate,
  AnudaanAuthorOut,
  AnudaanSafeBankAccountOut,
  AnudaanDocumentCategory,
  AnudaanDocumentOut,
  AnudaanApplicationSubmitRequest,
  AnudaanTrackingRequest,
  AnudaanTrackingStatusResponse,
} from '../types/anudaan';
import { getDraftSession, saveDraftSession } from './anudaanSession';

const ANUDAAN_API_BASE = '/modules/yajur-veda/anudaan';

/**
 * Resolves the draft key to use for authentication, preferring an explicitly
 * passed key, and falling back to the current active session in sessionStorage.
 */
function resolveDraftHeaders(explicitKey?: string): HeadersInit {
  const key = explicitKey || getDraftSession()?.draftKey;
  if (!key) {
    return {};
  }
  return {
    'X-Anudaan-Draft-Key': key.trim(),
  };
}

export const anudaanService = {
  /**
   * 1. Create a new draft application.
   * Public entry point for researchers. Returns application identifier and tracking secret.
   * Automatically caches the session credentials in sessionStorage for tab persistence.
   */
  async createDraft(
    data: AnudaanApplicationCreateDraft
  ): Promise<ApiResponse<AnudaanDraftCreationResponse>> {
    const res = await apiClient.post<AnudaanDraftCreationResponse>(
      `${ANUDAAN_API_BASE}/applications`,
      data
    );

    if (res.success && res.data) {
      saveDraftSession({
        applicationId: res.data.application_id,
        applicationNumber: res.data.application_number,
        draftKey: res.data.tracking_secret,
        createdAt: res.data.created_at,
      });
    }

    return res;
  },

  /**
   * 2. Retrieve draft application details.
   * Requires X-Anudaan-Draft-Key. Returns complete draft graph.
   */
  async getDraft(
    applicationId: string,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanApplicationDetailOut>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.get<AnudaanApplicationDetailOut>(
      `${ANUDAAN_API_BASE}/applications/${applicationId}`,
      headers
    );
  },

  /**
   * 3. Update applicant profile and form metadata on a draft application.
   * Requires X-Anudaan-Draft-Key. Uses HTTP PATCH.
   */
  async updateDraft(
    applicationId: string,
    data: AnudaanApplicationUpdateDraft,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanApplicationDetailOut>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.patch<AnudaanApplicationDetailOut>(
      `${ANUDAAN_API_BASE}/applications/${applicationId}`,
      data,
      headers
    );
  },

  /**
   * 4. Add a publication to a draft application.
   * Enforces publication date >= 2026-01-01 and intra-draft DOI uniqueness.
   */
  async addPublication(
    applicationId: string,
    data: AnudaanPublicationCreate,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanPublicationOut>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.post<AnudaanPublicationOut>(
      `${ANUDAAN_API_BASE}/applications/${applicationId}/publications`,
      data,
      headers
    );
  },

  /**
   * 5. Update an existing draft publication.
   * Uses HTTP PATCH.
   */
  async updatePublication(
    publicationId: string,
    data: AnudaanPublicationUpdate,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanPublicationOut>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.patch<AnudaanPublicationOut>(
      `${ANUDAAN_API_BASE}/publications/${publicationId}`,
      data,
      headers
    );
  },

  /**
   * 6. Remove a publication from a draft application.
   * Uses HTTP DELETE.
   */
  async deletePublication(
    publicationId: string,
    draftKey?: string
  ): Promise<ApiResponse<unknown>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.delete<unknown>(
      `${ANUDAAN_API_BASE}/publications/${publicationId}`,
      headers
    );
  },

  /**
   * 7. Add an author attribution to a publication.
   * Attaches author role and optional encrypted banking details.
   */
  async addAuthor(
    publicationId: string,
    data: AnudaanAuthorCreate,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanAuthorOut>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.post<AnudaanAuthorOut>(
      `${ANUDAAN_API_BASE}/publications/${publicationId}/authors`,
      data,
      headers
    );
  },

  /**
   * 8. Remove an author attribution from a publication.
   * Uses HTTP DELETE.
   */
  async deleteAuthor(
    authorId: string,
    draftKey?: string
  ): Promise<ApiResponse<unknown>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.delete<unknown>(
      `${ANUDAAN_API_BASE}/authors/${authorId}`,
      headers
    );
  },

  /**
   * 9. Retrieve verified bank accounts linked to an identified researcher.
   * Scoped to application context (SEC-01) to eliminate IDOR risks.
   * Plaintext account numbers and PANs are strictly withheld by backend.
   */
  async getVerifiedBankAccounts(
    personId: string,
    applicationId: string,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanSafeBankAccountOut[]>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.get<AnudaanSafeBankAccountOut[]>(
      `${ANUDAAN_API_BASE}/applications/${applicationId}/people/${personId}/verified-bank-accounts`,
      headers
    );
  },

  /**
   * 10. Upload supporting document (PDF, PNG, JPEG max 10MB).
   * Uses multipart/form-data via postFormData without manual Content-Type header.
   */
  async uploadDocument(
    applicationId: string,
    file: File,
    documentType: AnudaanDocumentCategory,
    options?: {
      publicationId?: string;
      personId?: string;
      draftKey?: string;
    }
  ): Promise<ApiResponse<AnudaanDocumentOut>> {
    const headers = resolveDraftHeaders(options?.draftKey);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', documentType);
    if (options?.publicationId) {
      formData.append('publication_id', options.publicationId);
    }
    if (options?.personId) {
      formData.append('person_id', options.personId);
    }

    return apiClient.postFormData<AnudaanDocumentOut>(
      `${ANUDAAN_API_BASE}/applications/${applicationId}/documents`,
      formData,
      headers
    );
  },

  /**
   * 11. Delete an uploaded document and purge file from storage provider.
   * Uses HTTP DELETE.
   */
  async deleteDocument(
    documentId: string,
    draftKey?: string
  ): Promise<ApiResponse<unknown>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.delete<unknown>(
      `${ANUDAAN_API_BASE}/documents/${documentId}`,
      headers
    );
  },

  /**
   * 12. Atomic final application submission.
   * Validates all 8 statutory declarations, executes row-level and DOI advisory locks,
   * transitions status to SUBMITTED, and dispatches confirmation email outbox.
   */
  async submitApplication(
    applicationId: string,
    data: AnudaanApplicationSubmitRequest,
    draftKey?: string
  ): Promise<ApiResponse<AnudaanApplicationDetailOut>> {
    const headers = resolveDraftHeaders(draftKey);
    return apiClient.post<AnudaanApplicationDetailOut>(
      `${ANUDAAN_API_BASE}/applications/${applicationId}/submit`,
      data,
      headers
    );
  },

  /**
   * 13. Public status tracking endpoint.
   * Submits application number and tracking secret via JSON body.
   * Protected by sliding-window rate limiter (10 req/min).
   * Uniformly returns safe status summary without leaking private banking tokens.
   */
  async trackApplication(
    data: AnudaanTrackingRequest
  ): Promise<ApiResponse<AnudaanTrackingStatusResponse>> {
    return apiClient.post<AnudaanTrackingStatusResponse>(
      `${ANUDAAN_API_BASE}/track`,
      data
    );
  },
};

export { ApiError };
