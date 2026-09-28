export type VyasaGenericRole = 'administrator' | 'authority' | 'applicant' | string;

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  fullName?: string;
  roles: VyasaGenericRole[];
  is_active?: boolean;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthenticatedUser;
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
