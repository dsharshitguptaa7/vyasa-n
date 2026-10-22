export type VyasaGenericRole = 'administrator' | 'authority' | 'applicant' | string;

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  fullName?: string;
  roles: VyasaGenericRole[];
  phone?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string | null;
  // Authority-specific institutional fields
  authority_role?: 'MANAGER' | 'ASSISTANT_DEAN' | 'ASSOCIATE_DEAN' | 'DEAN' | string | null;
  authority_id?: string | null;
  authority_designation?: string | null;
  authority_department?: string | null;
  assigned_cluster_name?: string | null;
  assigned_cluster_number?: number | null;
  // Scholar/Applicant-specific academic fields
  phd_registration_number?: string | null;
  department?: string | null;
  subject_name?: string | null;
  enrollment_number?: string | null;
  scholar_record_number?: string | null;
}


export interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  user?: AuthenticatedUser;
  requires_two_factor?: boolean;
  two_factor_setup_required?: boolean;
  challenge_id?: string;
  message?: string;
  recovery_codes?: string[];
}

export interface TwoFactorChallenge {
  challenge_id: string;
  requires_two_factor: boolean;
  two_factor_setup_required: boolean;
  message?: string;
}

export interface TwoFactorSetupDetails {
  challenge_id: string;
  requires_2fa_setup: boolean;
  issuer: string;
  account_name: string;
  qr_code: string;
  manual_setup_key: string;
}

export interface TwoFactorStatus {
  is_enabled: boolean;
  enabled_at: string | null;
  last_verified_at: string | null;
  remaining_recovery_codes: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthenticatedUser | null;
  token: string | null;
}

export interface SubjectItem {
  id: string;
  name: string;
}

export interface ApplicantRegisterPayload {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
  phd_registration_number?: string;
  department?: string;
  subject_id: string;
}

export interface ApplicantRegisterResponse {
  message: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  subject_id: string;
  subject_name: string;
  phd_registration_number?: string | null;
}

// Backward compatibility alias
export type UserProfile = AuthenticatedUser;
export type UserRole = VyasaGenericRole;
