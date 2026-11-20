/**
 * Type definitions for VYASAⁿ AI Knowledge Centre Administration.
 * Maps 1:1 with backend SQLAlchemy models and Pydantic schemas.
 */

export type KnowledgeDomain =
  | 'doctoral-studies'
  | 'admissions'
  | 'academic-regulations'
  | 'research-development'
  | 'university-administration';

export const KNOWLEDGE_DOMAINS: { value: KnowledgeDomain; label: string; description: string }[] = [
  {
    value: 'doctoral-studies',
    label: 'Doctoral Studies',
    description: 'Ph.D. guidelines, RAC procedures, coursework ordinances, and thesis standards',
  },
  {
    value: 'admissions',
    label: 'Admissions & Eligibility',
    description: 'Eligibility criteria, entrance exams, reservation matrices, and intake policies',
  },
  {
    value: 'academic-regulations',
    label: 'Academic Regulations',
    description: 'Curriculum frameworks, grading schemes, NEP compliance, and examination rules',
  },
  {
    value: 'research-development',
    label: 'Research & Innovation',
    description: 'Grant allocations, ethics approvals, IPR guidelines, and seed funding policies',
  },
  {
    value: 'university-administration',
    label: 'University Administration',
    description: 'Statutes, administrative circulars, service rules, and executive council decisions',
  },
];

export type DocumentType =
  | 'policy'
  | 'ordinance'
  | 'regulation'
  | 'guideline'
  | 'manual'
  | 'circular'
  | 'notification'
  | 'brochure'
  | 'report'
  | 'form'
  | 'other';

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'policy', label: 'Institutional Policy' },
  { value: 'ordinance', label: 'University Ordinance' },
  { value: 'regulation', label: 'Academic Regulation' },
  { value: 'guideline', label: 'Procedural Guideline' },
  { value: 'manual', label: 'Handbook / Manual' },
  { value: 'circular', label: 'Administrative Circular' },
  { value: 'notification', label: 'Official Notification' },
  { value: 'brochure', label: 'Prospectus / Brochure' },
  { value: 'report', label: 'Annual / Evaluation Report' },
  { value: 'form', label: 'Official Format / Form' },
  { value: 'other', label: 'Other Statutory Document' },
];

export type KnowledgeDocumentStatus =
  | 'draft'
  | 'processing'
  | 'pending_approval'
  | 'active'
  | 'rejected'
  | 'archived';

export type KnowledgeApprovalStatus = 'pending' | 'approved' | 'rejected';

export type KnowledgeExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type KnowledgeVerificationStatus = 'unverified' | 'verified' | 'indexed' | 'rejected';

export interface KnowledgeDocumentVersionItem {
  id: string;
  version_number: number;
  storage_key: string;
  checksum_sha256: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  extraction_status: KnowledgeExtractionStatus;
  processing_error: string | null;
  approval_status: KnowledgeApprovalStatus;
  approved_by_id: string | null;
  approved_at: string | null;
  created_at: string;
  chunk_count: number;
}

export interface KnowledgeDocumentItem {
  id: string;
  title: string;
  description: string | null;
  domain: KnowledgeDomain;
  subdomain: string | null;
  document_type: DocumentType;
  academic_session: string | null;
  issuing_authority: string | null;
  effective_from: string | null;
  effective_until: string | null;
  current_version_id: string | null;
  status: KnowledgeDocumentStatus;
  uploaded_by_id: string | null;
  approved_by_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
  current_version: KnowledgeDocumentVersionItem | null;
  version_count: number;
  chunk_count: number;
}

export interface KnowledgeChunkItem {
  id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_heading: string | null;
  token_count: number | null;
  verification_status: KnowledgeVerificationStatus;
  has_embedding: boolean;
}

export interface KnowledgeDashboardStats {
  total_documents: number;
  published_documents: number;
  pending_approvals: number;
  processing_documents: number;
  failed_documents: number;
  total_passages: number;
  verified_passages: number;
  indexed_passages: number;
  domain_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
}

export interface KnowledgeDocumentListResponse {
  items: KnowledgeDocumentItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface KnowledgeDocumentDetailResponse {
  document: KnowledgeDocumentItem;
  versions: KnowledgeDocumentVersionItem[];
  chunks: KnowledgeChunkItem[];
  chunks_sample?: KnowledgeChunkItem[];
  total_chunks: number;
}

export interface KnowledgeChunkListResponse {
  items: KnowledgeChunkItem[];
  total: number;
  skip: number;
  limit: number;
  document_id: string;
  version_id?: string;
}

export interface KnowledgeChunkFilterParams {
  version_id?: string;
  skip?: number;
  limit?: number;
  search?: string;
}

export interface KnowledgeUploadResponse {
  success: boolean;
  id: string;
  document_id: string;
  version_id: string;
  current_version_id?: string;
  version_number: number;
  storage_key: string;
  checksum_sha256: string;
  status: KnowledgeDocumentStatus;
  extraction_status: KnowledgeExtractionStatus;
  message: string;
}

export interface KnowledgeUploadPayload {
  file: File;
  title: string;
  domain: KnowledgeDomain;
  document_type: DocumentType;
  description?: string;
  subdomain?: string;
  academic_session?: string;
  issuing_authority?: string;
  effective_from?: string;
  effective_until?: string;
}

export interface KnowledgeUploadVersionPayload {
  file: File;
}

export interface KnowledgeApprovePayload {
  version_id?: string;
}

export interface KnowledgeRejectPayload {
  reason: string;
  version_id?: string;
}

export interface KnowledgeRetryPayload {
  version_id?: string;
}

export interface KnowledgeFilterParams {
  skip?: number;
  limit?: number;
  domain?: string;
  status?: string;
  search?: string;
  document_type?: string;
}
