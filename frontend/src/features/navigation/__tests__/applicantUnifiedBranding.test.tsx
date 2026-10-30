import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VyasaDashboardPage } from '../../dashboard/VyasaDashboardPage';
import { ApplicantSidebar } from '../../applicant/components/ApplicantSidebar';
import { Navbar } from '../../../components/common/Navbar';
import * as AuthContextModule from '../../../context/AuthContext';
import { grievanceService } from '../../../modules/atharva-veda/nivaran/services/grievanceService';

const mockApplicantAuth: AuthContextModule.AuthContextValue = {
  user: {
    id: 'applicant-101',
    email: 'scholar.aditi@csjmu.ac.in',
    first_name: 'Aditi',
    last_name: 'Sharma',
    roles: ['applicant'],
    department: 'School of Advanced Studies',
  },
  token: 'mock-applicant-jwt',
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  hasRole: vi.fn().mockImplementation((role: string) => role === 'applicant'),
  hasAuthorityRole: vi.fn().mockReturnValue(false),
  isSuperAdmin: false,
  isAdmin: false,
  isAuthority: false,
  isApplicant: true,
  isGuest: false,
  isManager: false,
  isAssistantDean: false,
  isAssociateDean: false,
  isDean: false,
  isFixedAuthority: false,
  authorityRole: null,
  authorityId: null,
  authorityDesignation: null,
  displayName: 'Aditi Sharma',
};

const mockDeanAuth: AuthContextModule.AuthContextValue = {
  user: {
    id: 'dean-201',
    email: 'dean.rd@csjmu.ac.in',
    first_name: 'Namita',
    last_name: 'Tiwari',
    roles: ['authority'],
    department: 'Research & Development',
  },
  token: 'mock-dean-jwt',
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  hasRole: vi.fn().mockImplementation((role: string) => role === 'authority'),
  hasAuthorityRole: vi.fn().mockReturnValue(true),
  isSuperAdmin: false,
  isAdmin: false,
  isAuthority: true,
  isApplicant: false,
  isGuest: false,
  isManager: false,
  isAssistantDean: false,
  isAssociateDean: false,
  isDean: true,
  isFixedAuthority: false,
  authorityRole: 'DEAN',
  authorityId: 'auth-dean-1',
  authorityDesignation: 'Dean R&D',
  displayName: 'Prof. Namita Tiwari',
};

const mockAdminAuth: AuthContextModule.AuthContextValue = {
  user: {
    id: 'admin-301',
    email: 'admin@csjmu.ac.in',
    first_name: 'Central',
    last_name: 'Admin',
    roles: ['superadmin'],
    department: 'Vice Chancellor Office',
  },
  token: 'mock-admin-jwt',
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  hasRole: vi.fn().mockReturnValue(true),
  hasAuthorityRole: vi.fn().mockReturnValue(false),
  isSuperAdmin: true,
  isAdmin: true,
  isAuthority: false,
  isApplicant: false,
  isGuest: false,
  isManager: false,
  isAssistantDean: false,
  isAssociateDean: false,
  isDean: false,
  isFixedAuthority: false,
  authorityRole: null,
  authorityId: null,
  authorityDesignation: null,
  displayName: 'Central Admin',
};

describe('Phase 1B: Unified Branding & Consistent Navigation Labels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* =========================================================================
   * 1. General Dashboard and Profile Routes: Unified Applicant Identity
   * ======================================================================= */
  describe('1. General Dashboard/Profile routes show unified applicant portal identity', () => {
    it('1.1 Renders "VYASA Scholar Portal" branding on /dashboard', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
      });

      // Sidebar header displays unified portal identity
      expect(screen.getAllByText('VYASA Scholar Portal').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Research, Recognition & Innovation Portal').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByLabelText('VYASA Official Emblem').length).toBeGreaterThanOrEqual(1);

      // Top navbar displays unified scholar portal authority context
      expect(screen.getAllByText(/VYASA Scholar Portal/i).length).toBeGreaterThanOrEqual(1);
    });

    it('1.2 Renders "VYASA Scholar Portal" branding on /profile', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <ApplicantSidebar activeTab="profile" />
        </MemoryRouter>
      );

      expect(screen.getAllByText('VYASA Scholar Portal').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Research, Recognition & Innovation Portal')).toBeInTheDocument();
      expect(screen.getAllByLabelText('VYASA Official Emblem').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* =========================================================================
   * 2. NIVARAN Grievance Routes: Preserve NIVARAN Identity
   * ======================================================================= */
  describe('2. NIVARAN grievance routes retain NIVARAN identity', () => {
    it('2.1 ApplicantSidebar renders NIVARAN-AI branding on /modules/atharva-veda/nivaran/my-grievances', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
          <ApplicantSidebar activeTab="my-grievances" />
        </MemoryRouter>
      );

      // NIVARAN branding is preserved
      expect(screen.getByText('NIVARAN-AI')).toBeInTheDocument();
      expect(screen.getByText('Scholar Redressal Portal')).toBeInTheDocument();
      expect(screen.queryByLabelText('VYASA Official Emblem')).not.toBeInTheDocument();
    });

    it('2.2 Top Navbar retains persistent CSJMU institutional header without secondary horizontal strip', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
          <Navbar />
        </MemoryRouter>
      );

      // Top navbar strictly renders CSJMU branding and notification bell
      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByTitle('Institutional Notifications')).toBeInTheDocument();
      // Second horizontal navigation masthead is omitted for applicants
      expect(screen.queryByText('Scholar Redressal Portal')).not.toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 3. Standardized "My Grievances" Navigation & Destinations
   * ======================================================================= */
  describe('3. Standardized "My Grievances" destination and actions', () => {
    it('3.1 Service Card for NIVARAN uses standardized "Open NIVARAN" action and navigates correctly', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<VyasaDashboardPage />} />
            <Route
              path="/modules/atharva-veda/nivaran/my-grievances"
              element={<div data-testid="canonical-grievances-screen">My Grievances Canonical Page</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('service-card-nivaran')).toBeInTheDocument();
      });

      // Label is standardized to "Open NIVARAN"
      const openNivaranBtn = screen.getByTestId('open-service-btn-nivaran');
      expect(openNivaranBtn).toHaveTextContent('Open NIVARAN');

      // Clicking navigates to canonical destination
      fireEvent.click(openNivaranBtn);
      expect(screen.getByTestId('canonical-grievances-screen')).toBeInTheDocument();
    });

    it('3.2 Attention Banner button uses standardized action wording and navigates to My Grievances', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([
        {
          id: 'case-clarify-1',
          grievance_id: 'GRV-2026-999',
          title: 'Hostel accommodation allotment discrepancy',
          status: 'CLARIFICATION_REQUESTED',
          priority: 'URGENT',
          subject_id: 's-1',
          subject_name: 'Student Welfare',
          category_id: 'c-1',
          category_name: 'Hostel',
          created_at: '2026-10-15T10:00:00Z',
          updated_at: '2026-10-20T12:00:00Z',
        },
      ]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<VyasaDashboardPage />} />
            <Route
              path="/modules/atharva-veda/nivaran/my-grievances"
              element={<div data-testid="canonical-grievances-screen">My Grievances Canonical Page</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('grievance-attention-banner')).toBeInTheDocument();
      });

      const bannerBtn = screen.getByRole('button', { name: /Review in My Grievances/i });
      expect(bannerBtn).toBeInTheDocument();

      fireEvent.click(bannerBtn);
      expect(screen.getByTestId('canonical-grievances-screen')).toBeInTheDocument();
    });

    it('3.3 Recent Case Activity header button uses standardized "View all in My Grievances"', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantAuth);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([
        {
          id: 'case-resolved-1',
          grievance_id: 'GRV-2026-888',
          title: 'Research lab consumable replenishment',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          subject_id: 's-1',
          subject_name: 'Chemistry',
          category_id: 'c-2',
          category_name: 'Lab Supplies',
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-15T12:00:00Z',
        },
      ]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<VyasaDashboardPage />} />
            <Route
              path="/modules/atharva-veda/nivaran/my-grievances"
              element={<div data-testid="canonical-grievances-screen">My Grievances Canonical Page</div>}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('GRV-2026-888')).toBeInTheDocument();
      });

      const viewAllBtn = screen.getByRole('button', { name: /View all in My Grievances/i });
      expect(viewAllBtn).toBeInTheDocument();

      fireEvent.click(viewAllBtn);
      expect(screen.getByTestId('canonical-grievances-screen')).toBeInTheDocument();
    });
  });

  /* =========================================================================
   * 4. Authority & Admin Navigation Remain Unchanged
   * ======================================================================= */
  describe('4. Authority and Admin navigation and role configurations remain unchanged', () => {
    it('4.1 Dean authority retains Dean Executive Authority and queue items', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockDeanAuth);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText(/Dean Executive Authority/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Executive Dashboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Executive Queue' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'E-Files' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Student Records' })).toBeInTheDocument();
    });

    it('4.2 Admin retains Admin Console and system taxonomy items', () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockAdminAuth);

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText('Admin Console')).toBeInTheDocument();
      expect(screen.getByText(/System Administration/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Overview' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Authorities' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Audit Logs' })).toBeInTheDocument();
    });
  });
});
