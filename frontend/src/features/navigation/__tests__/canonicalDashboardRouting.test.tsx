import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppRoutes } from '../../../App';
import * as AuthContextModule from '../../../context/AuthContext';
import { authService } from '../../../services/authService';
import { AuthProvider } from '../../../context/AuthContext';
import { ApplicantLoginPage, AuthorityLoginPage } from '../../auth';
import { getNivaranDestination } from '../../../utils/personaRouting';
import { AuthenticatedUser } from '../../../types/auth';

const mockApplicantUser: AuthenticatedUser = {
  id: 'appl-101',
  email: 'scholar.test@csjmu.ac.in',
  first_name: 'Scholar',
  last_name: 'Test',
  roles: ['applicant'],
  department: 'Computer Science',
  subject_name: 'AI & Data Science',
  enrollment_number: 'ENR-9988',
  phd_registration_number: 'REG-2024-01',
  is_active: true,
  is_verified: true,
};

const mockDeanUser: AuthenticatedUser = {
  id: 'dean-202',
  email: 'dean.rd@csjmu.ac.in',
  first_name: 'Namita',
  last_name: 'Tiwari',
  fullName: 'Prof. Namita Tiwari',
  roles: ['authority'],
  authority_role: 'DEAN',
  authority_designation: 'Dean R&D',
  is_active: true,
  is_verified: true,
};

const mockAssistantDeanUser: AuthenticatedUser = {
  id: 'asst-303',
  email: 'asst.dean@csjmu.ac.in',
  first_name: 'Vivek',
  last_name: 'Mishra',
  roles: ['authority'],
  authority_role: 'ASSISTANT_DEAN',
  authority_designation: 'Assistant Dean',
  assigned_cluster_name: 'Engineering & Technology',
  assigned_cluster_number: 1,
  is_active: true,
};

const mockAssociateDeanUser: AuthenticatedUser = {
  id: 'assoc-404',
  email: 'assoc.dean@csjmu.ac.in',
  first_name: 'Sunita',
  last_name: 'Rao',
  roles: ['authority'],
  authority_role: 'ASSOCIATE_DEAN',
  authority_designation: 'Associate Dean',
  assigned_cluster_name: 'Academic Grievances',
  assigned_cluster_number: 2,
  is_active: true,
};

const mockManagerUser: AuthenticatedUser = {
  id: 'mgr-505',
  email: 'manager.grievance@csjmu.ac.in',
  first_name: 'Rajesh',
  last_name: 'Kumar',
  roles: ['authority'],
  authority_role: 'MANAGER',
  authority_designation: 'Triage Manager',
  is_active: true,
};

describe('Single Canonical Authenticated Dashboard Architecture Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('1. Applicant login redirects directly to canonical /dashboard', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      access_token: 'applicant-token-xyz',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockApplicantUser,
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/applicant/login" element={<ApplicantLoginPage />} />
            <Route path="/dashboard" element={<div data-testid="canonical-dashboard-home">Canonical VYASA Dashboard</div>} />
            <Route path="/applicant" element={<div data-testid="legacy-scholar-workspace">Legacy Scholar Workspace</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'scholar.test@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'Secret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Applicant/i }));

    await waitFor(() => {
      expect(screen.getByTestId('canonical-dashboard-home')).toBeInTheDocument();
      expect(screen.queryByTestId('legacy-scholar-workspace')).not.toBeInTheDocument();
    });
  });

  it('2. Applicant NEVER lands on legacy Scholar Workspace', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-xyz');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/applicant']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    // Visiting legacy /applicant redirects to /dashboard rendering canonical dashboard
    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-welcome-heading')).toHaveTextContent('Welcome, Scholar Test');
      expect(screen.queryByText('Scholar Workspace Unavailable')).not.toBeInTheDocument();
    });
  });

  it('3. Authority login redirects directly to /dashboard', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue({
      access_token: 'dean-token-abc',
      token_type: 'bearer',
      expires_in: 3600,
      user: mockDeanUser,
    });
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockDeanUser);

    render(
      <MemoryRouter initialEntries={['/authority/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/authority/login" element={<AuthorityLoginPage />} />
            <Route path="/dashboard" element={<div data-testid="authority-dashboard-home">Authority Canonical Dashboard</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Institutional Email/i), {
      target: { value: 'dean.rd@csjmu.ac.in' },
    });
    fireEvent.change(screen.getByLabelText(/Security Credential/i), {
      target: { value: 'DeanSecret123!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In as Authority/i }));

    await waitFor(() => {
      expect(screen.getByTestId('authority-dashboard-home')).toBeInTheDocument();
    });
  });

  it('4. Legacy /authority route redirects to canonical /dashboard', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('dean-token-abc');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockDeanUser);

    render(
      <MemoryRouter initialEntries={['/authority']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-welcome-heading')).toHaveTextContent('Welcome, Namita Tiwari');
    });
  });

  it('5. Legacy /scholar route redirects to canonical /dashboard', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-xyz');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/scholar']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-welcome-heading')).toHaveTextContent('Welcome, Scholar Test');
    });
  });

  it('6. /dashboard renders the new canonical VyasaDashboardPage with personal info and services', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-xyz');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
      expect(screen.getByTestId('card-personal-info')).toBeInTheDocument();
      expect(screen.getByTestId('card-academic-profile')).toBeInTheDocument();
      expect(screen.getByTestId('card-access-security')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-nivaran')).toBeInTheDocument();
    });
  });

  it('7. Refreshing /dashboard keeps the canonical dashboard intact', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-xyz');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    // Initial mount
    const { unmount } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-heading')).toBeInTheDocument();
    });

    unmount();

    // Re-mount / simulated page refresh
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
      expect(screen.getByTestId('profile-full-name')).toHaveTextContent('Scholar Test');
    });
  });

  it('8. Public Scholar Portal remains accessible when unauthenticated', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    // Click "LOGIN" -> "Applicant / Scholar" on public navigation
    const loginBtn = screen.getByRole('button', { name: /^LOGIN/i });
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);

    const scholarLink = screen.getByRole('menuitem', { name: /Applicant \/ Scholar/i });
    expect(scholarLink).toBeInTheDocument();
    fireEvent.click(scholarLink);

    await waitFor(() => {
      expect(screen.getByText('Applicant Sign In')).toBeInTheDocument();
    });
  });

  it('9. Persona NIVARAN Destination Matrix resolves correctly without intermediate screen', () => {
    // Applicant
    expect(getNivaranDestination({ isAuthenticated: true, isApplicant: true }))
      .toBe('/modules/atharva-veda/nivaran/my-grievances');

    // Manager
    expect(getNivaranDestination({ isAuthenticated: true, isManager: true }))
      .toBe('/modules/atharva-veda/nivaran/manager/queue');

    // Assistant Dean
    expect(getNivaranDestination({ isAuthenticated: true, isAssistantDean: true }))
      .toBe('/modules/atharva-veda/nivaran/assistant-dean/dashboard');

    // Associate Dean
    expect(getNivaranDestination({ isAuthenticated: true, isAssociateDean: true }))
      .toBe('/modules/atharva-veda/nivaran/associate-dean/dashboard');

    // Dean
    expect(getNivaranDestination({ isAuthenticated: true, isDean: true }))
      .toBe('/modules/atharva-veda/nivaran/dean/dashboard');
  });

  it('10. Header Dashboard button navigates to /dashboard for all personas', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-xyz');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    // In NIVARAN header, click "← VYASA Dashboard"
    await waitFor(() => {
      const dashboardLink = screen.getByRole('link', { name: /← VYASA Dashboard/i });
      expect(dashboardLink).toBeInTheDocument();
      fireEvent.click(dashboardLink);
    });

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
    });
  });

  it('11. Inactive services are strictly hidden from Available Services', async () => {
    vi.spyOn(authService, 'getToken').mockReturnValue('applicant-token-xyz');
    vi.spyOn(authService, 'getCurrentUser').mockResolvedValue(mockApplicantUser);

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('service-card-nivaran')).toBeInTheDocument();
      expect(screen.queryByTestId('service-card-sankalp')).not.toBeInTheDocument();
      expect(screen.queryByTestId('service-card-praman')).not.toBeInTheDocument();
      expect(screen.queryByTestId('service-card-samiksha')).not.toBeInTheDocument();
    });
  });
});
