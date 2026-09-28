export interface VyasaIdentitySummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
}

export interface NivaranAuthoritySummary {
  id: string;
  vyasa_user_id: string;
  role: string; // 'MANAGER' | 'ASSISTANT_DEAN' | 'ASSOCIATE_DEAN' | 'DEAN' | 'GUEST_MEMBER'
  name: string;
  email: string;
  name_snapshot?: string;
  email_snapshot?: string;
  designation?: string | null;
  department?: string | null;
  is_active: boolean;
}

export interface AuthoritySessionResponse {
  success: boolean;
  vyasa_identity: VyasaIdentitySummary;
  nivaran_authority: NivaranAuthoritySummary;
}

export interface StudentMasterRecordSummary {
  id: string;
  student_vyasa_user_id: string;
  record_number: string;
  registration_number: string | null;
  enrollment_number: string | null;
  department: string | null;
  program_name: string | null;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  status: string;
  subject_id?: string | null;
  subject_name?: string | null;
}

export interface AcademicContextSummary {
  subject_id: string;
  subject_name: string;
  cluster_number: number;
  cluster_name: string;
  assistant_dean_name: string | null;
  assistant_dean_email: string | null;
  assistant_dean_designation: string | null;
}

export interface ApplicantSessionResponse {
  success: boolean;
  role: 'applicant';
  is_new_registration: boolean;
  vyasa_identity: VyasaIdentitySummary;
  student_record: StudentMasterRecordSummary;
  academic_context?: AcademicContextSummary | null;
}

export type UnifiedSessionResponse =
  | { success: true; role_type: 'authority'; session: AuthoritySessionResponse }
  | { success: true; role_type: 'applicant'; session: ApplicantSessionResponse };

export type AuthorityErrorCode =
  | 'MISSING_TOKEN'
  | 'INVALID_TOKEN'
  | 'VYASA_UNREACHABLE'
  | 'UNMAPPED_AUTHORITY'
  | 'FORBIDDEN_ROLE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export interface AuthorityErrorState {
  code: AuthorityErrorCode;
  status?: number;
  message: string;
  detail?: string;
}
