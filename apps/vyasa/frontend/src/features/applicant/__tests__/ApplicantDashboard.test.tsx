import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../../context/AuthContext';
import { ApplicantRoute } from '../../../components/auth/ApplicantRoute';
import { ApplicantDashboardPage } from '../pages/ApplicantDashboardPage';
import { AuthorityLoginPage } from '../../auth/AuthorityLoginPage';
import { ApplicantLoginPage } from '../../auth/ApplicantLoginPage';
import { authService } from '../../../services/authService';
import { applicantService } from '../services/applicantService';
import { pillarService } from '../../../services/pillarService';
import { AuthenticatedUser } from '../../../types/auth';
import { ApplicantProfileData } from '../types';

const mockApplicantUser: AuthenticatedUser = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'scholar.rohan@csjmu.ac.in',
  first_name: 'Rohan',
  last_name: 'Verma',
  fullName: 'Rohan Verma',
  roles: ['applicant'],
  is_active: true,
};

const mockAuthorityUser: AuthenticatedUser = {
  id: '11111111-2222-3333-4444-555555555555',
  email: 'authority.dean@vyasa.local',
  first_name: 'Institutional',
  last_name: 'Dean',
  fullName: 'Institutional Dean',
  roles: ['authority'],
  is_active: true,
};

const mockApplicantProfile: ApplicantProfileData = {
  id: 'profile-uuid-1234',
  user_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  email: 'scholar.rohan@csjmu.ac.in',
  first_name: 'Rohan',
  last_name: 'Verma',
  full_name: 'Rohan Verma',
  phone: '+919876543210',
  roles: ['applicant'],
  is_active: true,
  is_verified: true,
  phd_registration_number: 'CSJMU/PHD/2026/088',
  department: 'Department of Agricultural Sciences',
  subject_id: '2e79b5bc-27b5-4006-af24-27550c2ec56d',
  subject_name: 'Agricultural Chemistry',
  created_at: '2026-09-27T10:00:00Z',
};

const mockPillars = [
  {
    id: 'nivaran',
    slug: 'nivaran',
    name: 'NIVARAN',
    description: 'Doctoral Scholar Research Redressal & Institutional Grievance Governance System',
    status: 'development',
    enabled: true,
  },
  {
    id: 'pillar-1',
    slug: 'pillar-1',
    name: 'Pillar 1',
    description: 'Academic Lifecycle & Curricular Governance',
    status: 'scheduled',
    enabled: true,
  },
];

describe('Applicant Dashboard & Session Experience', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(applicantService, 'getProfile').mockResolvedValue(mockApplicantProfile);
    vi.spyOn(pillarService, 'getPillars').mockResolvedValue(mockPillars);
    vi.spyOn(applicantService, 'getNotifications').mockResolvedValue([]);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('Requirement 1: Applicant route renders for authenticated applicant', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Rohan Verma' })).toBeInTheDocument();
      expect(screen.getByText('Scholar Identity')).toBeInTheDocument();
    });
  });

  it('Requirement 2: Unauthenticated user is redirected to /applicant/login', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/applicant"
              element={
                <ApplicantRoute>
                  <ApplicantDashboardPage />
                </ApplicantRoute>
              }
            />
            <Route path="/applicant/login" element={<ApplicantLoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Applicant Login')).toBeInTheDocument();
      expect(screen.getByText('Applicant Sign In')).toBeInTheDocument();
    });
  });

  it('Requirement 3: Authenticated non-applicant is blocked with access restricted card', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-authority-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockAuthorityUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Institutional Access Restricted')).toBeInTheDocument();
      expect(screen.getByText('Applicant Role Required')).toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });
  });

  it('Requirement 4: Applicant identity card renders full name, email, role, and UUID', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Scholar Identity')).toBeInTheDocument();
      expect(screen.getByText('scholar.rohan@csjmu.ac.in')).toBeInTheDocument();
      expect(screen.getByText('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBeInTheDocument();
      expect(screen.getByText('CSJMU/PHD/2026/088')).toBeInTheDocument();
      expect(screen.getAllByText('Agricultural Chemistry')[0]).toBeInTheDocument();
    });
  });

  it('Requirement 5: Academic profile tab renders read-only record details', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Scholar Identity')).toBeInTheDocument();
    });

    // Switch to Academic Record tab
    fireEvent.click(screen.getByRole('button', { name: /🎓\s*Academic Record/i }));

    await waitFor(() => {
      expect(screen.getByText('Academic Record & Credentials')).toBeInTheDocument();
      expect(screen.getByText('Department of Agricultural Sciences')).toBeInTheDocument();
      expect(screen.getByText('Verified Doctoral Scholar')).toBeInTheDocument();
      expect(screen.getByText('Active Institutional Identity')).toBeInTheDocument();
    });
  });

  it('Requirement 6: Connected pillars section renders NIVARAN and other registry pillars', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Scholar Identity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /🌐\s*Connected Pillars/i }));

    await waitFor(() => {
      expect(screen.getByText(/NIVARAN: Grievance Redressal & Research Governance/i)).toBeInTheDocument();
      expect(screen.getByText('Pillar 1')).toBeInTheDocument();
    });
  });

  it('Requirement 7: Open NIVARAN button initiates Step 3 SSO handoff and opens NIVARAN', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      postMessage: vi.fn(),
    } as unknown as Window);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Scholar Identity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /🌐\s*Connected Pillars/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Open NIVARAN/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Open NIVARAN/i }));

    expect(openSpy).toHaveBeenCalledWith('http://localhost:5174?role=applicant', '_blank');
    expect(screen.getByText(/Cross-Pillar Handoff Active:/i)).toBeInTheDocument();
  });

  it('Requirement 8: Logout clears token and redirects to /applicant/login', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);
    const logoutSpy = vi.spyOn(authService, 'logout');

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/applicant"
              element={
                <ApplicantRoute>
                  <ApplicantDashboardPage />
                </ApplicantRoute>
              }
            />
            <Route path="/applicant/login" element={<ApplicantLoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }));

    expect(logoutSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Applicant Login')).toBeInTheDocument();
    });
  });

  it('Requirement 9: Session restoration rehydrates user from valid token', async () => {
    localStorage.setItem('vyasa_access_token', 'valid-stored-token');
    vi.spyOn(authService, 'getToken').mockReturnValue('valid-stored-token');
    const getCurrentUserSpy = vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getCurrentUserSpy).toHaveBeenCalled();
      expect(screen.getByRole('heading', { level: 1, name: 'Rohan Verma' })).toBeInTheDocument();
    });
  });

  it('Requirement 10: Handles profile loading failure with error card and retry action', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('mock-applicant-token');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);
    vi.spyOn(applicantService, 'getProfile').mockRejectedValueOnce(new Error('Network error loading profile'));

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <ApplicantRoute>
            <ApplicantDashboardPage />
          </ApplicantRoute>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Scholar Workspace Unavailable')).toBeInTheDocument();
      expect(screen.getByText('Network error loading profile')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry Loading/i })).toBeInTheDocument();
    });
  });
});
