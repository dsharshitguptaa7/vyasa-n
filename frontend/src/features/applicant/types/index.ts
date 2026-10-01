export interface ApplicantProfileData {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string | null;
  roles: string[];
  is_active: boolean;
  is_verified: boolean;
  phd_registration_number?: string | null;
  department?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  created_at: string;
}

export type ApplicantTabKey = 'overview' | 'academic' | 'pillars' | 'notifications' | 'account';
