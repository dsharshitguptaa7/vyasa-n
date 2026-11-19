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

export interface BulkStatusUpdateResult {
  updated_count: number;
  updated_ids: string[];
  failed_count: number;
  failed_items: { id: string; reason: string }[];
  total_requested: number;
  new_status: ContentStatus;
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
// 5. CERTIFICATES & MODERN INSTITUTIONAL LIFECYCLE MANAGEMENT
// ============================================================================

export type CertificateStatus =
  | 'DRAFT'
  | 'PENDING_DEAN_APPROVAL'
  | 'PENDING_VC_APPROVAL'
  | 'SCHEDULED'
  | 'ISSUED'
  | 'REJECTED'
  | 'REVOKED'
  | 'SUPERSEDED'
  | 'ARCHIVED';

export type AuthorityType = 'DEAN_RD' | 'VICE_CHANCELLOR';

export interface CertificateAuthorItem {
  id?: string;
  certificate_id?: string;
  researcher_id?: string | null;
  author_name_snapshot: string;
  academic_title_snapshot?: string | null;
  scopus_id_snapshot?: string | null;
  affiliation_snapshot?: string | null;
  department_snapshot?: string | null;
  designation_snapshot?: string | null;
  author_order: number;
  author_role: string;
}

export interface CertificateApprovalItem {
  id?: string;
  certificate_id?: string;
  authority_type: AuthorityType | string;
  signatory_id?: string | null;
  signatory_name_snapshot?: string | null;
  designation_snapshot?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  remarks?: string | null;
  decided_at?: string | null;
  decided_by_user_id?: string | null;
}

export interface CertificateSignatoryItem {
  id: string;
  authority_type: string;
  signatory_name: string;
  designation: string;
  department?: string | null;
  signature_image_path?: string | null;
  signature_asset_version: number;
  is_active: boolean;
  effective_date?: string | null;
  deleted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSignatoryPayload {
  authority_type: string;
  signatory_name: string;
  designation: string;
  department?: string;
  is_active?: boolean;
}

export interface UpdateSignatoryPayload {
  authority_type?: string;
  signatory_name?: string;
  designation?: string;
  department?: string;
  is_active?: boolean;
}

export interface CertificateTemplateItem {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  certificate_type: string;
  orientation: string;
  config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTemplatePayload {
  code: string;
  name: string;
  description?: string;
  certificate_type?: string;
  orientation?: string;
  config?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdateTemplatePayload {
  name?: string;
  description?: string;
  certificate_type?: string;
  orientation?: string;
  config?: Record<string, any>;
  is_active?: boolean;
  is_default?: boolean;
}

export interface CertificateStatsRecord {
  total_certificates: number;
  total_issued?: number;
  draft_certificates: number;
  pending_approvals: number;
  scheduled_certificates?: number;
  issued_certificates: number;
  revoked_certificates: number;
  reissued_certificates: number;
  total_researchers_linked: number;
}

export interface FelicitationCertificateItem {
  id: string;
  certificate_number: string;
  certificate_type?: string;
  status?: CertificateStatus;
  template_id?: string | null;
  template_version?: number | null;
  title?: string | null;
  presentation_statement?: string | null;
  research_contribution_statement?: string | null;
  research_title?: string | null;
  congratulatory_statement?: string | null;
  publication_details?: Record<string, any> | null;
  verification_token?: string | null;
  verification_url?: string | null;
  bulletin_id?: string | null;
  author_id?: string | null;
  publication_id?: string | null;
  file_storage_path?: string | null;
  checksum_sha256?: string | null;
  download_count: number;
  scheduled_issue_date?: string | null;
  activated_at?: string | null;
  is_scheduled?: boolean;
  time_until_activation_seconds?: number | null;
  issued_at?: string | null;
  approved_at?: string | null;
  is_revoked: boolean;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  rejection_reason?: string | null;
  reissued_from_id?: string | null;
  reissued_reason?: string | null;
  created_at: string;
  authors?: CertificateAuthorItem[];
  approvals?: CertificateApprovalItem[];
  template?: CertificateTemplateItem | null;

  verification_hash?: string;
  author_name?: string | null;
  author_department?: string | null;
  bulletin_title?: string | null;
  bulletin_volume?: number | null;
  bulletin_issue?: number | null;
}

export interface IssueCertificatePayload {
  certificate_type?: string;
  template_id?: string | null;
  title?: string;
  presentation_statement?: string;
  research_contribution_statement?: string;
  research_title?: string;
  congratulatory_statement?: string;
  publication_details?: Record<string, any>;
  issue_date?: string;
  authors?: CertificateAuthorItem[];
  submit_for_approval?: boolean;
  direct_issue_justification?: string;
  certificate_number?: string;
  bulletin_id?: string | null;
  author_id?: string | null;
  publication_id?: string | null;
  file_storage_path?: string;
  checksum_sha256?: string | null;
}

export interface CertificatePreviewPayload {
  certificate_type?: string;
  template_id?: string | null;
  bulletin_id?: string | null;
  title?: string;
  presentation_statement?: string;
  research_contribution_statement?: string;
  research_title?: string;
  congratulatory_statement?: string;
  publication_details?: Record<string, any>;
  issue_date?: string;
  authors?: CertificateAuthorItem[];
  certificate_number?: string;
  config_overrides?: Record<string, any>;
}

export interface CertificateReschedulePayload {
  scheduled_issue_date: string;
}

export interface CertificateApprovalPayload {
  action: 'APPROVE' | 'REJECT';
  remarks?: string;
}

export interface CertificateReissuePayload {
  reissue_reason: string;
  updated_title?: string;
  updated_authors?: CertificateAuthorItem[];
  updated_research_title?: string;
  updated_publication_details?: Record<string, any>;
}

export interface RevokeCertificatePayload {
  revocation_reason: string;
}

export interface CertificateListResponse {
  total: number;
  items: FelicitationCertificateItem[];
}

export interface SignatoryListResponse {
  total: number;
  items: CertificateSignatoryItem[];
}

export interface TemplateListResponse {
  total: number;
  items: CertificateTemplateItem[];
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
  target_bulletin_id?: string | null;
  target_bulletin_title?: string | null;
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
  target_bulletin_id?: string | null;
}



export interface BulkDeleteResult {
  deleted_count: number;
  deleted_ids: string[];
  failed_count: number;
  failed_items: { id: string; reason?: string; error?: string }[];
  total_requested: number;
}

export interface BulkDeleteCertificatesPayload {
  certificate_ids: string[];
  reason: string;
}

export interface BulkDeleteCertificatesResponse {
  operation_id: string;
  total_requested: number;
  deleted_count: number;
  failed_count: number;
  deleted_ids: string[];
  failed_items: { id: string; reason: string }[];
  audit_logged: boolean;
}

export interface SingleRestoreCertificatePayload {
  reason: string;
}

export interface BulkRestoreCertificatesPayload {
  certificate_ids: string[];
  reason: string;
}

export interface BulkRestoreFailureItem {
  id: string;
  reason: string;
}

export interface BulkRestoreResultItem {
  id: string;
  certificate_number: string;
  restored_to_status: string;
}

export interface BulkRestoreCertificatesResponse {
  operation_id: string;
  total_requested: number;
  restored_count: number;
  failed_count: number;
  restored_items: BulkRestoreResultItem[];
  failed_items: BulkRestoreFailureItem[];
  audit_logged: boolean;
}

export interface ArchivedCertificateItem {
  id: string;
  certificate_number: string;
  title: string;
  certificate_type: string;
  previous_status: string;
  archival_reason?: string | null;
  archived_at?: string | null;
  archived_by_user_id?: string | null;
  primary_recipient?: string | null;
  verification_token?: string | null;
  is_revoked: boolean;
}

export interface ArchivedCertificateListResponse {
  total: number;
  skip: number;
  limit: number;
  items: ArchivedCertificateItem[];
}

export interface CertificateVerificationItem {
  input_text: string;
  certificate_number?: string;
  status: string;
  is_valid: boolean;
  is_scheduled?: boolean;
  is_revoked?: boolean;
  is_superseded?: boolean;
  is_duplicate?: boolean;
  error_message?: string | null;
  certificate_id?: string | null;
  title?: string | null;
  certificate_type?: string | null;
  recipient_name?: string | null;
  research_title?: string | null;
  issue_date?: string | null;
  scheduled_issue_date?: string | null;
  revocation_reason?: string | null;
  revoked_at?: string | null;
  replacement_certificate_number?: string | null;
  verification_token?: string | null;
  sha256_checksum?: string | null;
}

export interface BulkVerifyCertificatesResponse {
  total_submitted: number;
  valid_count: number;
  scheduled_count: number;
  revoked_count: number;
  superseded_count: number;
  not_found_count: number;
  invalid_count: number;
  duplicate_count: number;
  results: CertificateVerificationItem[];
}


// ============================================================================
// 8. BULK CERTIFICATE GENERATION & DUAL-AUTHORITY WORKFLOW TYPES
// ============================================================================

export interface BulkBulletinMetadata {
  volume?: number | null;
  issue?: number | null;
  period?: string | null;
}

export interface BulkCertificateUploadBatchMetadata {
  batch_name: string;
  certificate_type: 'RESEARCH_PUBLICATION' | 'INCENTIVE_AWARD';
  issue_date: string;
  bulletin?: BulkBulletinMetadata | null;
}

export interface BulkResearcherInput {
  researcher_id?: string | null;
  scopus_id?: string | null;
  full_name: string;
  department?: string | null;
  institutional_affiliation?: string | null;
}

export interface BulkAuthorInput {
  researcher: BulkResearcherInput;
  certificate_title?: string | null;
  author_role?: string | null;
  is_corresponding?: boolean | null;
}

export interface BulkCertificateItemInput {
  item_id?: string | null;
  research_title: string;
  authors: BulkAuthorInput[];
  research_contribution_statement?: string | null;
  publication_details?: Record<string, any> | null;
  incentive_details?: Record<string, any> | null;
}

export interface BulkCertificateUploadPayload {
  batch: BulkCertificateUploadBatchMetadata;
  certificates: BulkCertificateItemInput[];
}

export interface AuthorCandidate {
  id: string;
  full_name: string;
  scopus_id?: string | null;
  department?: string | null;
  institutional_affiliation?: string | null;
  is_verified: boolean;
  match_score?: number | null;
}

export interface AuthorMatchItem {
  input_full_name: string;
  input_scopus_id?: string | null;
  input_department?: string | null;
  certificate_title?: string | null;
  author_role?: string | null;
  status: 'MATCHED' | 'AMBIGUOUS' | 'NOT_FOUND';
  matched_author_id?: string | null;
  matched_author_name?: string | null;
  matched_by?: string | null;
  candidates: AuthorCandidate[];
}

export interface BulkCertificatePreviewItem {
  index: number;
  research_title: string;
  certificate_type: string;
  issue_date: string;
  is_valid: boolean;
  validation_errors: string[];
  authors: AuthorMatchItem[];
  publication_details?: Record<string, any> | null;
  incentive_details?: Record<string, any> | null;
}

export interface BulkCertificatePreviewResponse {
  batch: BulkCertificateUploadBatchMetadata;
  total_certificates: number;
  valid_certificates_count: number;
  invalid_certificates_count: number;
  total_authors: number;
  matched_authors_count: number;
  ambiguous_authors_count: number;
  not_found_authors_count: number;
  certificates: BulkCertificatePreviewItem[];
}

export interface AuthorResolutionMapping {
  author_index: number;
  resolved_author_id?: string | null;
  certificate_title?: string | null;
}

export interface CertificateResolutionMapping {
  certificate_index: number;
  authors?: AuthorResolutionMapping[] | null;
}

export interface BulkCertificateGenerateRequest {
  batch: BulkCertificateUploadBatchMetadata;
  certificates: BulkCertificateItemInput[];
  resolutions?: CertificateResolutionMapping[] | null;
}

export interface BulkCertificateGenerateResultItem {
  index: number;
  certificate_id: string;
  certificate_number: string;
  research_title: string;
  status: string;
  authors_count: number;
}

export interface BulkCertificateGenerateResponse {
  batch_id: string;
  batch_name: string;
  certificate_type: string;
  total_requested: number;
  created_count: number;
  failed_count: number;
  created_certificates: BulkCertificateGenerateResultItem[];
  failed_items: Record<string, any>[];
}

export interface BulkSubmitDeanRequest {
  certificate_ids: string[];
}

export interface BulkForwardVCRequest {
  certificate_ids: string[];
}

export interface BulkApprovalActionRequest {
  certificate_ids: string[];
  action: 'APPROVE' | 'REJECT';
  remarks?: string | null;
}

export interface BulkApprovalResultItem {
  certificate_id: string;
  certificate_number: string;
  previous_status: string;
  new_status: string;
  authority: string;
  action: string;
  success: boolean;
  error?: string | null;
}

export interface BulkApprovalResponse {
  operation_id: string;
  authority: string;
  action: string;
  total_requested: number;
  success_count: number;
  failure_count: number;
  results: BulkApprovalResultItem[];
}

export interface BatchSummaryItem {
  batch_id: string;
  batch_name: string;
  certificate_type: string;
  created_at: string;
  total_certificates: number;
  pending_dean_count: number;
  pending_vc_count: number;
  issued_count: number;
  scheduled_count: number;
  rejected_count: number;
  archived_count: number;
}

export interface BatchListResponse {
  total: number;
  items: BatchSummaryItem[];
}

export interface BatchDetailResponse {
  batch_id: string;
  batch_name: string;
  certificate_type: string;
  created_at: string;
  total_certificates: number;
  status_counts: Record<string, number>;
  certificates: Record<string, any>[];
}
