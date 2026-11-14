import { apiClient } from '../../../services/apiClient';
import { config } from '../../../config';

export interface PublicPublication {
  id: string;
  bulletin_id: string;
  serial_no: number;
  slug: string;
  title: string;
  source_journal: string;
  category: string;
  doi?: string | null;
  author_display: string;
  authors_complete: boolean;
  abstract?: string | null;
  external_url?: string | null;
  is_featured: boolean;
  published_at?: string | null;
  created_at: string;
  author_links: Array<{
    author_id: string;
    author_name?: string | null;
    author_order: number;
    is_corresponding: boolean;
    department?: string | null;
  }>;
}

export interface PublicBulletin {
  id: string;
  volume_number: number;
  issue_number: number;
  title: string;
  publication_period: string;
  publication_count: number;
  file_size_bytes: number;
  checksum_sha256: string;
  published_at?: string | null;
  download_url?: string;
}

export interface PublicAuthor {
  id: string;
  full_name: string;
  department?: string | null;
  institutional_affiliation?: string | null;
  scopus_id?: string | null;
  is_verified: boolean;
}

export interface PublicCamProject {
  id: string;
  legacy_project_id?: number | null;
  category?: string | null;
  domain?: string | null;
  title: string;
  funding_amount_inr?: number | null;
  funding_display?: string | null;
  status: string;
  principal_investigators: any[];
  co_investigators: any[];
}

export interface PublicFellowship {
  id: string;
  scheme_code: string;
  scheme_name: string;
  active_scholars_count: number;
}

export interface PublicSpotlight {
  id: string;
  headline: string;
  summary?: string | null;
  media_type: string;
  media_url?: string | null;
  video_embed_url?: string | null;
  display_order: number;
}

export interface CertificateAuthorPublic {
  author_name: string;
  academic_title?: string | null;
  scopus_id?: string | null;
  department?: string | null;
  affiliation?: string | null;
  author_order?: number;
  author_role?: string;
  is_verified?: boolean;
}

export interface CertificateApprovalPublic {
  authority_type: string;
  signatory_name: string;
  designation: string;
  status: string;
  decided_at?: string | null;
}

export interface CertificateVerificationResult {
  certificate_number: string;
  certificate_type?: string;
  status?: string;
  title?: string;
  presentation_statement?: string;
  research_contribution_statement?: string;
  research_title?: string;
  congratulatory_statement?: string;
  publication_details?: Record<string, any>;
  verification_token?: string;
  issued_at?: string | null;
  approved_at?: string | null;
  is_revoked: boolean;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  reissued_from_number?: string | null;
  reissued_reason?: string | null;
  authors: CertificateAuthorPublic[];
  approvals: CertificateApprovalPublic[];
  bulletin?: {
    volume_number: number;
    issue_number: number;
    title: string;
    publication_period: string;
  } | null;
  author?: {
    id: string;
    full_name: string;
    department?: string | null;
    scopus_id?: string | null;
    is_verified: boolean;
  } | null;
  publication?: {
    id: string;
    title: string;
    category: string;
    source_journal: string;
    doi?: string | null;
  } | null;
  sha256_checksum: string;
  is_download_allowed: boolean;
  replacement_certificate?: {
    id: string;
    certificate_number: string;
    verification_token: string;
    status: string;
    issued_at?: string | null;
    verification_url: string;
  } | null;
}

export interface DiscoveredCertificateItem {
  id: string;
  certificate_number: string;
  title: string;
  certificate_type: string;
  category: 'RESEARCH_WORK' | 'INCENTIVE';
  publication_title?: string | null;
  issue_date?: string | null;
  issued_at?: string | null;
  status: string;
  is_revoked: boolean;
  revocation_reason?: string | null;
  reissued_reason?: string | null;
  verification_token: string;
  verification_url: string;
  is_download_allowed: boolean;
  download_url: string;
}

export interface ResearcherDiscoveryData {
  researcher: {
    id: string;
    full_name: string;
    department?: string | null;
    institutional_affiliation?: string | null;
    scopus_id?: string | null;
  };
  research_certificates: DiscoveredCertificateItem[];
  incentive_certificates: DiscoveredCertificateItem[];
  anudaan_incentives: {
    total_applications: number;
    approved_count: number;
    pdf_certificates_available: boolean;
    message: string;
  };
}

export interface ResearcherAuthChallenge {
  status: 'AUTH_REQUIRED';
  requires_authentication: boolean;
  researcher: {
    id: string;
    full_name: string;
    department?: string | null;
    institutional_affiliation?: string | null;
    scopus_id?: string | null;
    has_registered_user: boolean;
    masked_email?: string | null;
  };
  message: string;
}

export const samaVedaService = {
  async getPublications(params?: {
    skip?: number;
    limit?: number;
    category?: string;
    bulletin_id?: string;
    is_featured?: boolean;
    search?: string;
  }): Promise<{ items: PublicPublication[]; total: number; skip: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params?.category) searchParams.append('category', params.category);
    if (params?.bulletin_id) searchParams.append('bulletin_id', params.bulletin_id);
    if (params?.is_featured !== undefined) searchParams.append('is_featured', String(params.is_featured));
    if (params?.search) searchParams.append('search', params.search);

    const q = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<{ items: PublicPublication[]; total: number; skip: number; limit: number }>(
      `/modules/sama-veda/publications${q}`
    );
    return res.data!;
  },

  async getPublication(idOrSlug: string): Promise<PublicPublication> {
    const res = await apiClient.get<PublicPublication>(`/modules/sama-veda/publications/${idOrSlug}`);
    return res.data!;
  },

  async getBulletins(params?: { skip?: number; limit?: number }): Promise<{ items: PublicBulletin[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));

    const q = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<{ items: PublicBulletin[]; total: number }>(`/modules/sama-veda/bulletins${q}`);
    return res.data!;
  },

  async downloadBulletin(bulletinId: string, filename: string): Promise<void> {
    const url = `${config.apiBaseUrl}/modules/sama-veda/bulletins/${bulletinId}/download`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download research bulletin (HTTP ${response.status})`);
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

  async getAuthors(params?: {
    skip?: number;
    limit?: number;
    department?: string;
    search?: string;
  }): Promise<{ items: PublicAuthor[]; total: number; skip: number; limit: number }> {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', String(params.skip));
    if (params?.limit !== undefined) searchParams.append('limit', String(params.limit));
    if (params?.department) searchParams.append('department', params.department);
    if (params?.search) searchParams.append('search', params.search);

    const q = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<{ items: PublicAuthor[]; total: number; skip: number; limit: number }>(
      `/modules/sama-veda/authors${q}`
    );
    return res.data!;
  },

  async getCamProjects(params?: { category?: string; domain?: string }): Promise<{ items: PublicCamProject[]; total: number }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.domain) searchParams.append('domain', params.domain);

    const q = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<{ items: PublicCamProject[]; total: number }>(`/modules/sama-veda/cam-projects${q}`);
    return res.data!;
  },

  async getFellowships(): Promise<{ items: PublicFellowship[]; total: number }> {
    const res = await apiClient.get<{ items: PublicFellowship[]; total: number }>('/modules/sama-veda/fellowships');
    return res.data!;
  },

  async getSpotlights(): Promise<{ items: PublicSpotlight[]; total: number }> {
    const res = await apiClient.get<{ items: PublicSpotlight[]; total: number }>('/modules/sama-veda/spotlights');
    return res.data!;
  },

  async verifyCertificate(certificateNumber: string): Promise<CertificateVerificationResult> {
    const encoded = encodeURIComponent(certificateNumber);
    const res = await apiClient.get<CertificateVerificationResult>(`/modules/sama-veda/certificates/verify/${encoded}`);
    return res.data!;
  },

  async downloadCertificate(certificateNumberOrToken: string, filename?: string): Promise<void> {
    const encoded = encodeURIComponent(certificateNumberOrToken.trim());
    const url = `${config.apiBaseUrl}/modules/sama-veda/certificates/download/${encoded}`;
    const response = await fetch(url);
    if (!response.ok) {
      let errorMsg = `Download failed (HTTP ${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.detail) {
          errorMsg = errorData.detail;
        } else if (errorData?.message) {
          errorMsg = errorData.message;
        }
      } catch {
        if (response.status === 403) {
          errorMsg = 'Certificate revoked or issuance not finalized. PDF download is not permitted.';
        } else if (response.status === 409) {
          errorMsg = 'Certificate superseded or integrity verification failed.';
        } else if (response.status === 404) {
          errorMsg = 'Certificate PDF document unavailable in university digital storage.';
        } else if (response.status >= 500) {
          errorMsg = 'Download temporarily unavailable. Please try again later.';
        }
      }
      throw new Error(errorMsg);
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    const safeFilename = filename
      ? (filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`)
      : `Certificate-${certificateNumberOrToken.replace(/[\/\\]/g, '_')}.pdf`;
    a.download = safeFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  },

  async discoverResearcherCertificates(
    scopusId: string,
    researcherToken?: string
  ): Promise<{ data?: ResearcherDiscoveryData; challenge?: ResearcherAuthChallenge }> {
    const headers: Record<string, string> = {};
    if (researcherToken) {
      headers['X-Researcher-Token'] = researcherToken;
    }
    try {
      const res = await apiClient.get<ResearcherDiscoveryData>(
        `/modules/sama-veda/certificates/researcher-discovery?scopus_id=${encodeURIComponent(scopusId.trim())}`,
        headers
      );
      return { data: res.data };
    } catch (err: unknown) {
      const e = err as {
        response?: {
          status?: number;
          data?: {
            data?: ResearcherAuthChallenge;
            message?: string;
            detail?: string | { status?: string; message?: string };
          };
        };
        message?: string;
      };
      if (e.response?.status === 401 && e.response?.data?.data?.requires_authentication) {
        return {
          challenge: {
            ...e.response.data.data,
            message: e.response.data.message || 'Authentication required.',
          },
        };
      }
      const errorMsg =
        (typeof e.response?.data?.detail === 'string' ? e.response?.data?.detail : null) ||
        e.response?.data?.message ||
        e.message ||
        'Unable to discover certificates.';
      throw new Error(errorMsg);
    }
  },

  async sendResearcherOtp(scopusId: string): Promise<{ success: boolean; masked_email?: string; message: string }> {
    try {
      const res = await apiClient.post<{ masked_email?: string }>(
        '/modules/sama-veda/certificates/researcher-discovery/send-otp',
        { scopus_id: scopusId.trim() }
      );
      return {
        success: true,
        masked_email: res.data?.masked_email,
        message: res.message || 'Verification code sent.',
      };
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = e.response?.data?.detail || e.response?.data?.message || e.message || 'Failed to dispatch verification code.';
      throw new Error(msg);
    }
  },

  async verifyResearcherOtp(
    scopusId: string,
    otp: string
  ): Promise<{ success: boolean; researcher_token: string; message: string }> {
    try {
      const res = await apiClient.post<{ researcher_token: string }>(
        '/modules/sama-veda/certificates/researcher-discovery/verify-otp',
        { scopus_id: scopusId.trim(), otp: otp.trim() }
      );
      return {
        success: true,
        researcher_token: res.data!.researcher_token,
        message: res.message || 'Identity verified.',
      };
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
      const msg = e.response?.data?.detail || e.response?.data?.message || e.message || 'Incorrect or expired verification code.';
      throw new Error(msg);
    }
  },
};
