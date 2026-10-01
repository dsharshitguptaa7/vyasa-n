export interface GrievanceFeedbackCreate {
  rating: number;
  timeliness_rating: number;
  fairness_rating: number;
  feedback_text?: string;
}

export interface GrievanceFeedbackResponse {
  id: string;
  grievance_id: string;
  rating: number;
  timeliness_rating: number;
  fairness_rating: number;
  feedback_text?: string;
  created_at: string;
}

export interface PublicFeedbackSummary {
  average_rating: number | null;
  average_timeliness: number | null;
  average_fairness: number | null;
  total_feedback: number;
}

export interface ClosureQueueItem {
  id: string;
  grievance_id: string;
  title: string;
  priority: string;
  applicant_name: string;
  applicant_email: string;
  registration_number?: string;
  subject_name: string;
  category_name: string;
  resolved_by_name?: string;
  resolved_by_role?: string;
  resolved_at?: string;
  resolution_summary?: string;
  feedback_rating?: number;
  feedback_timeliness?: number;
  feedback_fairness?: number;
  feedback_text?: string;
  feedback_created_at?: string;
  is_closure_ready: boolean;
  created_at: string;
}

export interface ClosureQueueResponse {
  items: ClosureQueueItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface FinalizeClosureRequest {
  closure_notes?: string;
}

export interface FinalizeClosureResponse {
  grievance_id: string;
  status: string;
  closed_at: string;
  closed_by_name: string;
  e_file_id: string;
  e_file_number: string;
  student_record_id: string;
  student_record_number: string;
  content_hash: string;
  page_count: number;
}

export interface EFileDocumentItem {
  id: string;
  document_id: string;
  file_name: string;
  document_sha256_snapshot: string;
  section_order: number;
}

export interface EFileResponse {
  id: string;
  e_file_number: string;
  grievance_id: string;
  grievance_ref: string;
  applicant_vyasa_user_id: string;
  applicant_name?: string;
  student_record_id?: string;
  student_record_number?: string;
  status: string;
  file_path?: string;
  content_hash?: string;
  page_count: number;
  is_sealed: boolean;
  sealed_at?: string;
  sealed_by_authority_name?: string;
  created_at: string;
  documents: EFileDocumentItem[];
  grievance_title?: string;
}

export interface PaginatedEFilesResponse {
  items: EFileResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface EFileVerificationResponse {
  e_file_number: string;
  is_valid: boolean;
  calculated_hash: string;
  stored_hash: string;
  is_sealed: boolean;
  sealed_at?: string;
  algorithm: string;
}

export interface SMRGrievanceItem {
  id: string;
  grievance_id: string;
  title: string;
  status: string;
  priority: string;
  category_name: string;
  created_at: string;
  resolved_at?: string;
  closed_at?: string;
  e_file_id?: string;
  e_file_number?: string;
}

export interface SMREFileItem {
  id: string;
  e_file_number: string;
  grievance_id: string;
  grievance_ref: string;
  status: string;
  page_count: number;
  content_hash?: string;
  is_sealed: boolean;
  sealed_at?: string;
  created_at: string;
}

export interface StudentMasterRecordSummaryItem {
  id: string;
  record_number: string;
  student_vyasa_user_id: string;
  full_name_snapshot: string;
  email_snapshot: string;
  mobile_snapshot?: string;
  registration_number_snapshot?: string;
  enrollment_number_snapshot?: string;
  subject_id: string;
  subject_name: string;
  status: string;
  total_grievances: number;
  open_grievances: number;
  resolved_grievances: number;
  closed_grievances: number;
  total_efiles: number;
  created_at: string;
}

export interface StudentMasterRecordDetailResponse {
  id: string;
  record_number: string;
  student_vyasa_user_id: string;
  full_name_snapshot: string;
  email_snapshot: string;
  mobile_snapshot?: string;
  registration_number_snapshot?: string;
  enrollment_number_snapshot?: string;
  subject_id: string;
  subject_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  grievances: SMRGrievanceItem[];
  efiles: SMREFileItem[];
}

export interface PaginatedStudentRecordsResponse {
  items: StudentMasterRecordSummaryItem[];
  total: number;
  page: number;
  page_size: number;
}
