/**
 * ANUDAAN (Yajur Veda) TypeScript Type Definitions
 * Exact mirrors of Pydantic v2 schemas and models in backend/app/modules/yajur_veda/
 * 
 * Institution: Chhatrapati Shahu Ji Maharaj University, Kanpur
 * Module: Pillar 2 (Yajur Veda) -> ANUDAAN V1.1
 */

// =============================================================================
// 1. Authoritative Enumerations
// =============================================================================

export type AnudaanApplicantCategory =
  | 'FACULTY_CAMPUS'
  | 'SCHOLAR_CAMPUS'
  | 'POSTDOC_CAMPUS';

export type AnudaanApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CLARIFICATION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'APPROVED_FOR_RELEASE'
  | 'RELEASED'
  | 'PROCESSING'
  | 'CREDITED';

export type AnudaanDocumentType = 'ARTICLE' | 'REVIEW';

export type AnudaanPublicationStatus =
  | 'PUBLISHED'
  | 'ACCEPTED'
  | 'IN_PRESS'
  | 'PREPRINT';

export type AnudaanIndexingType =
  | 'SCOPUS'
  | 'WEB_OF_SCIENCE'
  | 'SCOPUS_AND_WOS';

export type AnudaanQuartile = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'UNASSIGNED';

export type AnudaanAuthorRole = 'FIRST' | 'CORRESPONDING' | 'CO_AUTHOR';

export type AnudaanBankAccountType = 'SAVINGS' | 'CURRENT';

export type AnudaanBankOwnershipStatus = 'UNVERIFIED' | 'VERIFIED' | 'REJECTED';

export type AnudaanDocumentCategory =
  | 'PUBLISHED_PAPER'
  | 'CANCELLED_CHEQUE'
  | 'PASSBOOK'
  | 'OTHER';

export type AnudaanVerificationType =
  | 'AFFILIATION_CHECK'
  | 'QUARTILE_VERIFICATION'
  | 'BANK_ACCOUNT_VERIFICATION'
  | 'SCOPUS_VALIDATION'
  | 'DEAN_APPROVAL'
  | 'MANUAL_CHECK';

export type AnudaanVerificationStatus =
  | 'PENDING'
  | 'VERIFIED'
  | 'FLAGGED'
  | 'REJECTED';

// =============================================================================
// 2. Banking Schemas
// =============================================================================

/**
 * Input payload for designating bank details for an author.
 * Note: confirm_account_number is strictly validated on frontend and excluded here.
 */
export interface AnudaanBankAccountInput {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  confirm_account_number?: string;
  ifsc_code: string;
  branch_name: string;
  account_type?: AnudaanBankAccountType;
  pan_number?: string | null;
  bank_mobile_number?: string | null;
}

/**
 * Public safe representation of a bank account.
 * Sensitive ciphertext and plaintext account numbers are stripped.
 */
export interface AnudaanSafeBankAccountOut {
  id: string;
  account_holder_name: string;
  bank_name: string;
  account_number_last4: string;
  masked_account_number: string;
  ifsc_code: string;
  branch_name: string;
  account_type: AnudaanBankAccountType;
  proof_document_storage_key?: string | null;
  created_at: string;
}

// =============================================================================
// 3. Author & Attribution Schemas
// =============================================================================

export interface AnudaanAuthorCreate {
  full_name: string;
  scopus_author_id?: string | null;
  scopus_profile_url?: string | null;
  mobile_number?: string | null;
  employee_or_registration_id?: string | null;
  author_role: AnudaanAuthorRole;
  author_order?: number | null;
  is_csjmu_affiliated?: boolean;
  has_multiple_corresponding_authors?: boolean;
  is_nominated_corresponding_author?: boolean;
  bank_reuse_selected?: boolean;
  bank_account_id?: string | null;
  new_bank_details?: AnudaanBankAccountInput | null;
}

export interface AnudaanAuthorOut {
  id: string;
  publication_id: string;
  person_id: string;
  full_name: string;
  scopus_author_id?: string | null;
  scopus_profile_url?: string | null;
  employee_or_registration_id?: string | null;
  mobile_number?: string | null;
  author_role: AnudaanAuthorRole;
  author_order?: number | null;
  is_csjmu_affiliated: boolean;
  has_multiple_corresponding_authors: boolean;
  is_nominated_corresponding_author: boolean;
  bank_reuse_selected: boolean;
  bank_account?: AnudaanSafeBankAccountOut | null;
  created_at: string;
}

// =============================================================================
// 4. Document Schemas
// =============================================================================

export interface AnudaanDocumentOut {
  id: string;
  application_id: string;
  publication_id?: string | null;
  person_id?: string | null;
  document_type: AnudaanDocumentCategory;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
}

// =============================================================================
// 5. Publication Schemas
// =============================================================================

export interface AnudaanPublicationCreate {
  publication_date: string; // YYYY-MM-DD (>= 2026-01-01)
  document_type: AnudaanDocumentType; // ARTICLE | REVIEW
  publication_status?: AnudaanPublicationStatus; // PUBLISHED
  indexing_type: AnudaanIndexingType; // SCOPUS | WEB_OF_SCIENCE | SCOPUS_AND_WOS
  has_csjmu_affiliation?: boolean;
  doi?: string | null;
  paper_title: string;
  journal_name: string;
  issn?: string | null;
  e_issn?: string | null;
  publication_year: number;
  volume?: string | null;
  issue?: string | null;
  page_details?: string | null;
  applicant_declared_quartile: AnudaanQuartile;
}

export interface AnudaanPublicationUpdate {
  publication_date?: string | null;
  document_type?: AnudaanDocumentType | null;
  publication_status?: AnudaanPublicationStatus | null;
  indexing_type?: AnudaanIndexingType | null;
  has_csjmu_affiliation?: boolean | null;
  doi?: string | null;
  paper_title?: string | null;
  journal_name?: string | null;
  issn?: string | null;
  e_issn?: string | null;
  publication_year?: number | null;
  volume?: string | null;
  issue?: string | null;
  page_details?: string | null;
  applicant_declared_quartile?: AnudaanQuartile | null;
}

export interface AnudaanPublicationOut {
  id: string;
  application_id: string;
  publication_date: string;
  document_type: AnudaanDocumentType;
  publication_status: AnudaanPublicationStatus;
  indexing_type: AnudaanIndexingType;
  has_csjmu_affiliation: boolean;
  doi?: string | null;
  normalized_doi?: string | null;
  paper_title: string;
  journal_name: string;
  issn?: string | null;
  e_issn?: string | null;
  publication_year: number;
  volume?: string | null;
  issue?: string | null;
  page_details?: string | null;
  applicant_declared_quartile: AnudaanQuartile;
  verified_quartile?: AnudaanQuartile | null;
  jci_value?: number | null;
  paper_document_storage_key?: string | null;
  authors: AnudaanAuthorOut[];
  documents: AnudaanDocumentOut[];
  created_at: string;
}

// =============================================================================
// 6. Statutory Declarations
// =============================================================================

export const MANDATORY_DECLARATION_TYPES = [
  'APPLICANT_ELIGIBILITY',
  'AUTHOR_ROLE',
  'PUBLICATION_ELIGIBILITY',
  'ANNUAL_LIMITS',
  'AUTHENTICITY',
  'NON_DUPLICATION',
  'BANK_OWNERSHIP',
  'REFUND_UNDERTAKING',
] as const;

export type MandatoryDeclarationType = (typeof MANDATORY_DECLARATION_TYPES)[number];

export const DRAFT_DECLARATION_TEXTS: Record<MandatoryDeclarationType, string> = {
  APPLICANT_ELIGIBILITY:
    'I confirm that I am currently a serving Faculty member, registered Research Scholar, or registered Post-Doctoral Researcher at the CSJMU Campus, and satisfy the eligibility criteria specified under the ANUDAAN Research Publication Incentive Scheme.',
  AUTHOR_ROLE:
    'I declare that my authorship attribution as First Author or nominated Corresponding Author is true and correct, and has been mutually consented to by all co-authors of the paper.',
  PUBLICATION_ELIGIBILITY:
    'I confirm that this publication was officially published on or after January 1, 2026, is classified as an Article or Review, is indexed in Scopus or Web of Science, and bears explicit institutional affiliation with Chhatrapati Shahu Ji Maharaj University, Kanpur.',
  ANNUAL_LIMITS:
    'I acknowledge the applicable institutional publication submission ceilings per tier (Q1: 6, Q2: 6, Q3: 4, Q4: 2) as configured under university guidelines.',
  AUTHENTICITY:
    'I affirm that all information, publication metadata, author roles, and supporting documents submitted in this application are authentic, accurate, and unmanipulated.',
  NON_DUPLICATION:
    'I solemnly declare that this research publication has not been submitted for, rewarded by, or claimed under any other cash incentive scheme or award of CSJMU or any other external agency.',
  BANK_OWNERSHIP:
    'I confirm that the designated bank account is active, valid, and owned by the declared payable author as registered in bank records, and all provided banking details are accurate.',
  REFUND_UNDERTAKING:
    'I hereby undertake to refund the entire disbursed incentive amount to CSJMU if the publication is subsequently retracted, found in violation of academic ethics, or determined ineligible.',
};

export interface AnudaanDeclarationAcceptance {
  declaration_type: string;
  accepted: boolean;
  declaration_version?: string;
  declaration_text_snapshot: string;
}

export interface AnudaanDeclarationOut {
  id: string;
  declaration_type: string;
  accepted: boolean;
  accepted_at?: string | null;
  accepted_by_identifier?: string | null;
  declaration_version: string;
  declaration_text_snapshot: string;
}

// =============================================================================
// 7. Application Draft & Lifecycle Schemas
// =============================================================================

export interface AnudaanApplicationCreateDraft {
  applicant_category: AnudaanApplicantCategory;
  full_name: string;
  institutional_id: string;
  designation: string;
  department_name: string;
  supervisor_name?: string | null;
  mobile_number: string;
  scopus_author_id?: string | null;
  scopus_profile_url?: string | null;
  form_metadata?: Record<string, unknown>;
}

export interface AnudaanApplicationUpdateDraft {
  applicant_category?: AnudaanApplicantCategory | null;
  full_name?: string | null;
  institutional_id?: string | null;
  designation?: string | null;
  department_name?: string | null;
  supervisor_name?: string | null;
  mobile_number?: string | null;
  scopus_author_id?: string | null;
  scopus_profile_url?: string | null;
  form_metadata?: Record<string, unknown> | null;
}

export interface AnudaanDraftCreationResponse {
  application_id: string;
  application_number: string;
  tracking_secret: string; // 32-character URL-safe string
  status: AnudaanApplicationStatus;
  applicant_category: AnudaanApplicantCategory;
  full_name: string;
  institutional_id: string;
  department_name: string;
  created_at: string;
  message: string;
}

export interface AnudaanApplicationDetailOut {
  id: string;
  application_number: string;
  applicant_category: AnudaanApplicantCategory;
  full_name: string;
  institutional_id: string;
  designation: string;
  department_name: string;
  supervisor_name?: string | null;
  mobile_number: string;
  scopus_author_id?: string | null;
  scopus_profile_url?: string | null;
  status: AnudaanApplicationStatus;
  form_metadata?: Record<string, unknown>;
  submitted_at?: string | null;
  publications: AnudaanPublicationOut[];
  documents: AnudaanDocumentOut[];
  declarations: AnudaanDeclarationOut[];
  created_at: string;
  updated_at: string;
}

export interface AnudaanApplicationSubmitRequest {
  declarations: AnudaanDeclarationAcceptance[];
}

// =============================================================================
// 8. Public Tracking Schemas
// =============================================================================

export interface AnudaanTrackingRequest {
  application_number: string;
  tracking_secret: string;
}

export interface AnudaanTrackingPublicationSummary {
  id: string;
  paper_title: string;
  journal_name: string;
  publication_year: number;
  applicant_declared_quartile: AnudaanQuartile;
  verified_quartile?: AnudaanQuartile | null;
  indexing_type: AnudaanIndexingType;
  document_type: AnudaanDocumentType;
}

export interface AnudaanTrackingStatusResponse {
  application_number: string;
  status: AnudaanApplicationStatus;
  applicant_name: string;
  applicant_category: AnudaanApplicantCategory;
  department_name: string;
  submitted_at?: string | null;
  publication_count: number;
  publications: AnudaanTrackingPublicationSummary[];
  last_updated: string;
  status_description: string;
}

// =============================================================================
// 9. Institutional Showcase & Public Impact Types
// =============================================================================

export interface AnudaanPublicImpactStats {
  reporting_academic_year: string;
  total_researchers_recognised?: number;
  total_incentive_sanctioned_inr?: string | number;
  total_sanction_entries?: number;
  quartile_breakdown?: Record<string, number>;
  total_claims_received: number;
  claims_approved: number;
  claims_under_review: number;
  claims_rejected: number;
  researchers_benefited: number;
  total_incentive_disbursed_inr: string | number;
  disbursement_status: 'VERIFIED' | 'AWAITING_VERIFIED_DISBURSEMENTS' | 'SANCTIONED' | string;
  last_updated_at?: string | null;
  academic_years_available: string[];
}

export interface AnudaanGalleryImageOut {
  id: string;
  gallery_item_id: string;
  storage_key: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  caption?: string | null;
  is_cover: boolean;
  display_order: number;
  created_at: string;
}

export interface AnudaanGalleryItemOut {
  id: string;
  title: string;
  event_name: string;
  event_date: string;
  academic_year: string;
  description: string;
  researcher_name?: string | null;
  researcher_designation?: string | null;
  department_name?: string | null;
  has_consent: boolean;
  is_featured: boolean;
  is_published: boolean;
  display_order: number;
  felicitation_cycle_id?: string | null;
  felicitation_cycle_volume?: number | null;
  felicitation_cycle_issue?: number | null;
  images: AnudaanGalleryImageOut[];
  created_at: string;
  updated_at: string;
}

export interface AnudaanGalleryListResponse {
  total: number;
  items: AnudaanGalleryItemOut[];
}

export interface AnudaanPublicConfigOut {
  impact_section_enabled: boolean;
  gallery_section_enabled: boolean;
  active_academic_year?: string | null;
  custom_banner_note?: string | null;
  updated_at?: string | null;
}

export interface AnudaanPublicConfigUpdate {
  impact_section_enabled?: boolean;
  gallery_section_enabled?: boolean;
  active_academic_year?: string | null;
  custom_banner_note?: string | null;
}

export interface AnudaanDisbursementCreate {
  application_id: string;
  author_id?: string | null;
  disbursement_reference: string;
  amount: number;
  disbursement_date: string;
  academic_year: string;
  payment_method?: string;
  notes?: string | null;
}

export interface AnudaanDisbursementOut {
  id: string;
  application_id: string;
  application_number: string;
  applicant_name: string;
  author_id?: string | null;
  author_name?: string | null;
  disbursement_reference: string;
  amount: number | string;
  disbursement_date: string;
  academic_year: string;
  payment_method: string;
  verification_status: 'RECORDED' | 'VERIFIED' | 'REVERSED' | string;
  reversal_reason?: string | null;
  notes?: string | null;
  recorded_by_email?: string | null;
  verified_by_email?: string | null;
  verified_at?: string | null;
  created_at: string;
}

export interface AnudaanDisbursementListResponse {
  total: number;
  items: AnudaanDisbursementOut[];
  total_amount_inr: number | string;
}

export interface AnudaanGalleryItemCreate {
  title: string;
  event_name: string;
  event_date: string;
  academic_year: string;
  description: string;
  researcher_name?: string | null;
  researcher_designation?: string | null;
  department_name?: string | null;
  has_consent?: boolean;
  is_featured?: boolean;
  is_published?: boolean;
  display_order?: number;
  felicitation_cycle_id?: string | null;
}

export interface AnudaanGalleryItemUpdate {
  title?: string;
  event_name?: string;
  event_date?: string;
  academic_year?: string;
  description?: string;
  researcher_name?: string | null;
  researcher_designation?: string | null;
  department_name?: string | null;
  has_consent?: boolean;
  is_featured?: boolean;
  is_published?: boolean;
  display_order?: number;
  felicitation_cycle_id?: string | null;
}

// =============================================================================
// 10. Simplified Sadmin Incentive Sanction Register Types
// =============================================================================

export interface AnudaanSanctionEntryCreate {
  researcher_name: string;
  department_name?: string | null;
  project_title?: string | null;
  publication_title: string;
  publication_doi?: string | null;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  sanctioned_amount: number;
  academic_year: string;
  sanction_date: string;
  felicitation_cycle_id: string;
  remarks?: string | null;
  is_published?: boolean;
  application_id?: string | null;
  author_id?: string | null;
}

export interface AnudaanSanctionEntryUpdate {
  researcher_name?: string;
  department_name?: string | null;
  project_title?: string | null;
  publication_title?: string;
  publication_doi?: string | null;
  quartile?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  sanctioned_amount?: number;
  academic_year?: string;
  sanction_date?: string;
  felicitation_cycle_id?: string | null;
  remarks?: string | null;
  is_published?: boolean;
  application_id?: string | null;
  author_id?: string | null;
}

export interface AnudaanSanctionEntryOut {
  id: string;
  researcher_name: string;
  department_name?: string | null;
  project_title?: string | null;
  publication_title: string;
  publication_doi?: string | null;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  sanctioned_amount: number | string;
  academic_year: string;
  sanction_date: string;
  felicitation_cycle_id?: string | null;
  felicitation_cycle_volume?: number | null;
  felicitation_cycle_issue?: number | null;
  felicitation_cycle_status?: string | null;
  felicitation_cycle_title?: string | null;
  volume_number?: number | null;
  issue_number?: number | null;
  cycle_status?: string | null;
  remarks?: string | null;
  is_published: boolean;
  application_id?: string | null;
  application_number?: string | null;
  author_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnudaanSanctionListResponse {
  total: number;
  items: AnudaanSanctionEntryOut[];
  total_sanctioned_inr: number | string;
}

export interface AnudaanPublicSanctionOut {
  id: string;
  researcher_name: string;
  department_name?: string | null;
  project_title?: string | null;
  publication_title: string;
  quartile: 'Q1' | 'Q2' | 'Q3' | 'Q4' | string;
  sanctioned_amount: number | string;
  academic_year: string;
  felicitation_cycle_id?: string | null;
  volume_number?: number | null;
  issue_number?: number | null;
  cycle_display_title?: string | null;
  cycle_status?: string | null;
  felicitation_date?: string | null;
}

export interface AnudaanPublicSanctionsResponse {
  total: number;
  items: AnudaanPublicSanctionOut[];
}

// =============================================================================
// 11. Felicitation / Recognition Cycle Types (Volume & Issue)
// =============================================================================

export interface AnudaanFelicitationCycleCreate {
  volume_number: number;
  issue_number: number;
  display_title?: string | null;
  status: 'UPCOMING' | 'COMPLETED';
  felicitation_date?: string | null;
  academic_year?: string | null;
  description?: string | null;
  is_published?: boolean;
  is_archived?: boolean;
}

export interface AnudaanFelicitationCycleUpdate {
  volume_number?: number;
  issue_number?: number;
  display_title?: string | null;
  status?: 'UPCOMING' | 'COMPLETED';
  felicitation_date?: string | null;
  academic_year?: string | null;
  description?: string | null;
  is_published?: boolean;
  is_archived?: boolean;
}

export interface AnudaanFelicitationCycleOut {
  id: string;
  volume_number: number;
  issue_number: number;
  display_title?: string | null;
  status: 'UPCOMING' | 'COMPLETED';
  felicitation_date?: string | null;
  academic_year?: string | null;
  description?: string | null;
  is_published: boolean;
  is_archived: boolean;
  sanction_count: number;
  total_sanctioned_amount: number | string;
  created_at: string;
  updated_at: string;
}

export interface AnudaanFelicitationCycleListResponse {
  total: number;
  items: AnudaanFelicitationCycleOut[];
}

export interface AnudaanPublicFelicitationCycleOut {
  id: string;
  volume_number: number;
  issue_number: number;
  display_title?: string | null;
  status: 'UPCOMING' | 'COMPLETED';
  felicitation_date?: string | null;
  academic_year?: string | null;
  description?: string | null;
  sanctions: AnudaanPublicSanctionOut[];
  total_sanctioned_amount: number | string;
  total_researchers: number;
  sanction_count: number;
  gallery_items: AnudaanGalleryItemOut[];
}

export interface AnudaanPublicShowcaseCyclesResponse {
  total_cycles: number;
  completed_cycles: AnudaanPublicFelicitationCycleOut[];
  upcoming_cycles: AnudaanPublicFelicitationCycleOut[];
}

export interface AnudaanApplicationLookupItem {
  application_id: string;
  application_number: string;
  applicant_name: string;
  department_name: string;
  publication_title?: string | null;
  publication_doi?: string | null;
  quartile?: string | null;
  authors: Array<{
    author_id: string;
    name: string;
    role: string;
    is_payable: boolean;
  }>;
}
