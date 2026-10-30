export type ContentStatus = 'draft' | 'in_review' | 'published' | 'archived';

// ============================================================================
// 1. PUBLICATIONS
// ============================================================================

export interface PublicationAuthorLink {
  author_id: string;
  author_name?: string | null;
  author_order: number;
  is_corresponding: boolean;
  department?: string | null;
}

export interface PublicationAuthorLinkInput {
  author_id: string;
  author_order: number;
  is_corresponding: boolean;
}

export interface ResearchPublicationItem {
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
  status: ContentStatus;
  abstract?: string | null;
  external_url?: string | null;
  is_featured: boolean;
  published_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  author_links: PublicationAuthorLink[];

  journal_name?: string;
  publication_year?: number;
  scopus_indexed?: boolean;
}

export interface CreatePublicationPayload {
  bulletin_id: string;
  serial_no: number;
  slug: string;
  title: string;
  source_journal: string;
  category: string;
  doi?: string | null;
  author_display: string;
  authors_complete?: boolean;
  status?: ContentStatus;
  abstract?: string | null;
  external_url?: string | null;
  is_featured?: boolean;
  author_links?: PublicationAuthorLinkInput[];
}

export interface UpdatePublicationPayload {
  bulletin_id?: string;
  serial_no?: number;
  slug?: string;
  title?: string;
  source_journal?: string;
  category?: string;
  doi?: string | null;
  author_display?: string;
  authors_complete?: boolean;
  status?: ContentStatus;
  abstract?: string | null;
  external_url?: string | null;
  is_featured?: boolean;
  author_links?: PublicationAuthorLinkInput[];
}

export interface PublicationListResponse {
  total: number;
  items: ResearchPublicationItem[];
}

// ============================================================================
// 2. AUTHORS & SCOPUS
// ============================================================================

export interface ResearchAuthorItem {
  id: string;
  full_name: string;
  scopus_id?: string | null;
  department?: string | null;
  institutional_affiliation: string;
  user_id?: string | null;
  is_verified: boolean;
  verification_notes?: string | null;
  created_at: string;
  updated_at: string;

  name?: string;
  email?: string | null;
  designation?: string | null;
  scopus_author_id?: string | null;
  is_scopus_verified?: boolean;
  scopus_h_index?: number | null;
}

export interface CreateAuthorPayload {
  full_name: string;
  scopus_id?: string | null;
  department?: string | null;
  institutional_affiliation?: string;
  user_id?: string | null;
  is_verified?: boolean;
  verification_notes?: string | null;
}

export interface UpdateAuthorPayload {
  full_name?: string;
  scopus_id?: string | null;
  department?: string | null;
  institutional_affiliation?: string;
  user_id?: string | null;
  is_verified?: boolean;
  verification_notes?: string | null;
}

export interface AuthorVerificationPayload {
  is_verified: boolean;
  scopus_id?: string | null;
  verification_notes?: string | null;
}

export interface AuthorListResponse {
  total: number;
  items: ResearchAuthorItem[];
}

// ============================================================================
// 3. BULLETINS
// ============================================================================

export interface ResearchBulletinItem {
  id: string;
  volume_number: number;
  issue_number: number;
  title: string;
  publication_period: string;
  file_path: string;
  file_size_bytes: number;
  checksum_sha256?: string | null;
  publication_count: number;
  is_active: boolean;
  status: ContentStatus;
  published_at?: string | null;
  archived_at?: string | null;
  created_at: string;

  slug?: string;
  volume?: number;
  issue?: number;
  publication_month?: string;
  publication_year?: number;
}

export interface CreateBulletinPayload {
  volume_number: number;
  issue_number: number;
  title: string;
  publication_period: string;
  file_path: string;
  file_size_bytes?: number;
  checksum_sha256?: string | null;
  publication_count?: number;
  is_active?: boolean;
  status?: ContentStatus;
}

export interface UpdateBulletinPayload {
  volume_number?: number;
  issue_number?: number;
  title?: string;
  publication_period?: string;
  file_path?: string;
  file_size_bytes?: number;
  checksum_sha256?: string | null;
  publication_count?: number;
  is_active?: boolean;
  status?: ContentStatus;
}

export interface BulletinListResponse {
  total: number;
  items: ResearchBulletinItem[];
}

// ============================================================================
// 4. CAM-AI PROJECTS
// ============================================================================

export interface CamProjectInvestigator {
  name: string;
  department?: string;
  school?: string;
}

export interface CamAiProjectItem {
  id: string;
  legacy_project_id?: number | null;
  category: string;
  domain?: string | null;
  title: string;
  funding_amount_inr?: number | null;
  funding_display?: string | null;
  status: string;
  principal_investigators?: CamProjectInvestigator[];
  co_investigators?: CamProjectInvestigator[] | string[];
  created_at: string;
  updated_at?: string;

  project_title?: string;
  funding_amount?: number | null;
  funding_amount_display?: string | null;
  principal_investigator?: string | null;
  sanction_year?: number | null;
  deliverables_summary?: string | null;
}

export interface CreateCamProjectPayload {
  legacy_project_id?: number | null;
  category: string;
  domain?: string | null;
  title: string;
  funding_amount_inr?: number | null;
  funding_display?: string | null;
  status?: string;
  principal_investigators?: CamProjectInvestigator[];
  co_investigators?: CamProjectInvestigator[] | string[];

  project_title?: string;
  funding_amount?: number | null;
  funding_amount_display?: string | null;
  principal_investigator?: string | null;
  sanction_year?: number | null;
  deliverables_summary?: string | null;
}

export interface UpdateCamProjectPayload {
  legacy_project_id?: number | null;
  category?: string;
  domain?: string | null;
  title?: string;
  funding_amount_inr?: number | null;
  funding_display?: string | null;
  status?: string;
  principal_investigators?: CamProjectInvestigator[];
  co_investigators?: CamProjectInvestigator[] | string[];

  project_title?: string;
  funding_amount?: number | null;
  funding_amount_display?: string | null;
  principal_investigator?: string | null;
  sanction_year?: number | null;
  deliverables_summary?: string | null;
}

export interface CamProjectListResponse {
  total: number;
  items: CamAiProjectItem[];
}

// ============================================================================
// 5. CERTIFICATES
// ============================================================================

export interface FelicitationCertificateItem {
  id: string;
  certificate_number: string;
  bulletin_id: string;
  author_id: string;
  publication_id?: string | null;
  file_storage_path: string;
  checksum_sha256?: string | null;
  download_count: number;
  issued_at: string;
  is_revoked: boolean;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  created_at: string;

  verification_hash?: string;
  author_name?: string | null;
  author_department?: string | null;
  bulletin_title?: string | null;
  bulletin_volume?: number | null;
  bulletin_issue?: number | null;
}

export interface IssueCertificatePayload {
  certificate_number: string;
  bulletin_id: string;
  author_id: string;
  publication_id?: string | null;
  file_storage_path: string;
  checksum_sha256?: string | null;
}

export interface RevokeCertificatePayload {
  revocation_reason: string;
}

export interface CertificateListResponse {
  total: number;
  items: FelicitationCertificateItem[];
}

// ============================================================================
// 6. SPOTLIGHTS
// ============================================================================

export type SpotlightMediaType = 'photo' | 'video' | 'interview';

export interface ResearcherSpotlightItem {
  id: string;
  author_id?: string | null;
  headline: string;
  summary: string;
  media_type: SpotlightMediaType;
  media_url: string;
  video_embed_url?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;

  author_name?: string | null;
}

export interface CreateSpotlightPayload {
  author_id?: string | null;
  headline: string;
  summary: string;
  media_type?: SpotlightMediaType;
  media_url: string;
  video_embed_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateSpotlightPayload {
  author_id?: string | null;
  headline?: string;
  summary?: string;
  media_type?: SpotlightMediaType;
  media_url?: string;
  video_embed_url?: string | null;
  display_order?: number;
  is_active?: boolean;
}

export interface SpotlightListResponse {
  total: number;
  items: ResearcherSpotlightItem[];
}

// ============================================================================
// STORAGE UPLOAD RESPONSE
// ============================================================================

export interface StorageUploadResult {
  storage_key: string;
  filename: string;
  file_size_bytes: number;
  checksum_sha256?: string;
}

// ============================================================================
// OVERVIEW SUMMARY
// ============================================================================

export interface SamaOverviewStats {
  totalPublications: number;
  publishedPublications: number;
  draftPublications: number;
  totalAuthors: number;
  verifiedAuthors: number;
  totalBulletins: number;
  activeBulletins: number;
  totalCertificates: number;
  revokedCertificates: number;
  totalCamProjects: number;
  totalSpotlights: number;
}

// ============================================================================
// CONVENIENCE ALIASES
// ============================================================================

export type PublicationRecord = ResearchPublicationItem;
export type AuthorRecord = ResearchAuthorItem;
export type BulletinRecord = ResearchBulletinItem;
export type CamProjectRecord = CamAiProjectItem;
export type CertificateRecord = FelicitationCertificateItem;
export type SpotlightRecord = ResearcherSpotlightItem;

// ============================================================================
// 8. DATA IMPORT & RECONCILIATION
// ============================================================================

export interface ImportRowErrorItem {
  row: number;
  field?: string | null;
  message: string;
  value?: any;
}

export interface ReconciliationItemRecord {
  action: 'create' | 'update' | 'skip' | 'review' | 'fail';
  identifier: string;
  reason: string;
  record_summary: Record<string, any>;
  conflict_details?: Record<string, any> | null;
}

export interface ImportBatchRecord {
  id: string;
  batch_number: string;
  entity_type: string;
  source_filename: string;
  file_format: string;
  mode: 'preview' | 'execute';
  status: 'pending' | 'previewed' | 'completed' | 'failed';
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  review_count: number;
  error_summary?: ImportRowErrorItem[] | null;
  reconciliation_report?: Record<string, any> | null;
  executed_at?: string | null;
  created_at: string;
}

export interface ImportPreviewResult {
  batch_id: string;
  batch_number: string;
  entity_type: string;
  mode: string;
  total_rows: number;
  create_count: number;
  update_count: number;
  skip_count: number;
  review_count: number;
  fail_count: number;
  errors: ImportRowErrorItem[];
  items: ReconciliationItemRecord[];
  reconciliation_summary: Record<string, any>;
}

export interface ImportExecuteResult {
  batch_id: string;
  batch_number: string;
  entity_type: string;
  status: string;
  total_rows: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  failed_count: number;
  review_count: number;
  executed_at?: string | null;
  audit_event_id?: string | null;
}


