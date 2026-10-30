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

export interface CertificateVerificationResult {
  certificate_number: string;
  issued_at?: string | null;
  is_revoked: boolean;
  revoked_at?: string | null;
  revocation_reason?: string | null;
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

  async downloadCertificate(certificateNumber: string, filename: string): Promise<void> {
    const encoded = encodeURIComponent(certificateNumber);
    const url = `${config.apiBaseUrl}/modules/sama-veda/certificates/download/${encoded}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('This certificate has been revoked and cannot be downloaded.');
      }
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
};
