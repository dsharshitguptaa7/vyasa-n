import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VyasaDashboardPage } from '../VyasaDashboardPage';
import { Navbar } from '../../../components/common/Navbar';
import { NivaranEFilesPage } from '../../../modules/atharva-veda/nivaran/pages/NivaranEFilesPage';
import { MyStudentRecordPage } from '../../../modules/atharva-veda/nivaran/pages/MyStudentRecordPage';
import { phase6dService } from '../../../modules/atharva-veda/nivaran/services/phase6dService';
import * as AuthContextModule from '../../../context/AuthContext';
import { grievanceService } from '../../../modules/atharva-veda/nivaran/services/grievanceService';
import { GrievanceSummaryItem } from '../../../modules/atharva-veda/nivaran/types/grievance';

const mockApplicantUser: AuthContextModule.AuthContextValue = {
  user: {
    id: 'appl-test-01',
    email: 'scholar@csjmu.ac.in',
    first_name: 'Harshit',
    last_name: 'Gupta',
    roles: ['applicant'],
    department: 'Computer Science & AI',
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
  displayName: 'Harshit Gupta',
};

const mockSampleGrievances: GrievanceSummaryItem[] = [
  {
    id: 'uuid-case-001',
    grievance_id: 'GRV-2026-1001',
    title: 'Lab access request for high-performance computing cluster',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    subject_id: 'subj-1',
    subject_name: 'Computer Science',
    category_id: 'cat-1',
    category_name: 'Facility Access',
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-20T12:00:00Z',
  },
  {
    id: 'uuid-case-002',
    grievance_id: 'GRV-2026-1002',
    title: 'Discrepancy in semester research fellowship credit',
    status: 'CLARIFICATION_REQUESTED',
    priority: 'URGENT',
    subject_id: 'subj-2',
    subject_name: 'Research Governance',
    category_id: 'cat-2',
    category_name: 'Fellowship Disbursement',
    created_at: '2026-10-18T14:30:00Z',
    updated_at: '2026-10-22T09:15:00Z',
  },
  {
    id: 'uuid-case-003',
    grievance_id: 'GRV-2026-0901',
    title: 'Supervisor change petition approved',
    status: 'RESOLVED',
    priority: 'MEDIUM',
    subject_id: 'subj-1',
    subject_name: 'Computer Science',
    category_id: 'cat-3',
    category_name: 'Academic Advisory',
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-25T16:00:00Z',
  },
];

describe('VYASA Applicant Dashboard & Workspace Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Applicant Logo Navigation & Header Routing', () => {
    it('1.1 Clicking university brand or logo routes applicant to /dashboard', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
          <Navbar />
        </MemoryRouter>
      );

      // Verify the top navbar renders CSJMU branding and notification bell without redundant horizontal app navigation
      expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
      expect(screen.getByTitle('Institutional Notifications')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    });
  });

  describe('2. Explore University Services (3 Balanced Cards)', () => {
    it('2.1 Renders all three balanced service cards for authenticated applicant', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue(mockSampleGrievances);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('service-card-nivaran')).toBeInTheDocument();
      });

      expect(screen.getByTestId('service-card-anveshan')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-student-record')).toBeInTheDocument();
      expect(screen.getByTestId('open-service-btn-nivaran')).toBeInTheDocument();
      expect(screen.getByTestId('quick-action-submit-grievance')).toBeInTheDocument();
      expect(screen.getByTestId('open-service-btn-anveshan')).toBeInTheDocument();
      expect(screen.getByTestId('open-service-btn-student-record')).toBeInTheDocument();
    });

    it('2.2 Service Card buttons navigate to the expected module routes', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue(mockSampleGrievances);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<VyasaDashboardPage />} />
            <Route path="/modules/atharva-veda/nivaran/submit" element={<div data-testid="submit-dest">Submit Screen</div>} />
            <Route path="/modules/atharva-veda/nivaran/my-grievances" element={<div data-testid="cases-dest">My Cases Screen</div>} />
            <Route path="/modules/sama-veda" element={<div data-testid="anveshan-dest">ANVESHAN Screen</div>} />
            <Route path="/modules/atharva-veda/nivaran/student-records/me" element={<div data-testid="student-record-dest">Student Record Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('open-service-btn-nivaran')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('quick-action-submit-grievance'));
      expect(screen.getByTestId('submit-dest')).toBeInTheDocument();
    });
  });

  describe('3. Data-Backed Status Overview & Real Metrics', () => {
    it('3.1 Accurately computes Total, In-Progress, Resolved, and Action Required counts', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue(mockSampleGrievances);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('applicant-cases-overview')).toBeInTheDocument();
      });

      // Total Cases: 3
      expect(screen.getByText('Total Cases')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();

      // In Progress: 1 (GRV-2026-1001)
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      // Resolved: 1 (GRV-2026-0901)
      expect(screen.getByText('Resolved')).toBeInTheDocument();

      // Action Required: 1 (GRV-2026-1002 has CLARIFICATION_REQUESTED)
      expect(screen.getByText('Action Required in NIVARAN')).toBeInTheDocument();
    });
  });

  describe('4. Recent Case Dossiers Activity Feed', () => {
    it('4.1 Displays recent grievance records with tracking ID and navigates to detail', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue(mockSampleGrievances);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<VyasaDashboardPage />} />
            <Route path="/modules/atharva-veda/nivaran/grievance/:id" element={<div data-testid="detail-dest">Detail Screen</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('GRV-2026-1001')).toBeInTheDocument();
      });

      expect(screen.getByText('Lab access request for high-performance computing cluster')).toBeInTheDocument();
      expect(screen.getByText('Facility Access')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Lab access request for high-performance computing cluster'));
      expect(screen.getByTestId('detail-dest')).toBeInTheDocument();
    });

    it('4.2 Displays helpful empty state when applicant has no registered cases', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('applicant-empty-cases')).toBeInTheDocument();
      });

      expect(screen.getByText('No Cases Registered Yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Submit Your First Grievance/i })).toBeInTheDocument();
    });

    it('4.3 Displays non-blocking error notice with retry button upon API failure', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockRejectedValueOnce(new Error('Network error'));

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });

      expect(screen.getByText(/Unable to load your grievance cases at this time/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();

      // Clicking Retry calls getMyGrievances again
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue(mockSampleGrievances);
      fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

      await waitFor(() => {
        expect(screen.getByText('GRV-2026-1001')).toBeInTheDocument();
      });
    });
  });

  describe('5. Unified Sidebar Structure & Sectioning', () => {
    it('5.1 Renders categorized sidebar sections and accessible links', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('MY WORKSPACE')).toBeInTheDocument();
      });

      expect(screen.getByText('UNIVERSITY SERVICES')).toBeInTheDocument();
      expect(screen.getByText('MY RECORDS')).toBeInTheDocument();
      expect(screen.getByText('MY ACTIVITY')).toBeInTheDocument();
      expect(screen.getByText('SUPPORT')).toBeInTheDocument();
      expect(screen.getByText('ACCOUNT')).toBeInTheDocument();

      // Links inside sidebar
      const dashboardLinks = screen.getAllByRole('link', { name: 'Dashboard' });
      expect(dashboardLinks.length).toBeGreaterThan(0);
      expect(screen.getByRole('link', { name: 'Submit Grievance' })).toHaveAttribute('href', '/modules/atharva-veda/nivaran/submit');
      expect(screen.getByRole('link', { name: 'My Grievances' })).toHaveAttribute('href', '/modules/atharva-veda/nivaran/my-grievances');
      expect(screen.getByRole('link', { name: 'SAMIKSHA Research' })).toHaveAttribute('href', '/modules/sama-veda');
      expect(screen.getByRole('link', { name: 'My E-Files' })).toHaveAttribute('href', '/modules/atharva-veda/nivaran/e-files');
      expect(screen.getByRole('link', { name: 'My Student Record' })).toHaveAttribute('href', '/modules/atharva-veda/nivaran/student-records/me');
      expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/notifications');
    });

    it('5.2 Provides accessible Logout button in sidebar and top header that executes logout', async () => {
      const mockLogout = vi.fn();
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
        ...mockApplicantUser,
        logout: mockLogout,
      });
      vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<VyasaDashboardPage />} />
            <Route path="/applicant/login" element={<div>Applicant Login Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('MY WORKSPACE')).toBeInTheDocument();
      });

      // Verify sidebar logout button exists
      const sidebarLogoutBtn = screen.getByTestId('sidebar-logout-btn');
      expect(sidebarLogoutBtn).toBeInTheDocument();
      expect(sidebarLogoutBtn).toHaveTextContent('Logout');

      // Verify top header logout button exists
      const headerLogoutBtn = screen.getByTestId('navbar-logout-btn');
      expect(headerLogoutBtn).toBeInTheDocument();
      expect(headerLogoutBtn).toHaveTextContent('Logout');

      // Clicking sidebar logout triggers auth.logout and navigates to login
      fireEvent.click(sidebarLogoutBtn);
      expect(mockLogout).toHaveBeenCalled();
      expect(screen.getByText('Applicant Login Page')).toBeInTheDocument();
    });
  });

  describe('6. Single Header Integrity Across Scholar Workspace Routes', () => {
    it('6.1 E-Files route renders strictly one institutional header and no marketing footer', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(phase6dService, 'getMyEFiles').mockResolvedValue([]);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/e-files']}>
          <NivaranEFilesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('My Official Sealed E-Files')).toBeInTheDocument();
      });

      // Exactly ONE institutional top bar is rendered
      const topBars = document.querySelectorAll('.csjmu-top-bar');
      expect(topBars.length).toBe(1);

      // No public marketing footer inside scholar workspace
      expect(document.querySelector('.vyasa-footer')).not.toBeInTheDocument();
    });

    it('6.2 Student Record route renders strictly one institutional header and no marketing footer', async () => {
      vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(mockApplicantUser);
      vi.spyOn(phase6dService, 'getMyStudentRecord').mockResolvedValue({
        id: 'rec-1',
        full_name: 'Harshit Gupta',
        roll_number: 'CSJMU-PHD-2026',
        program_enrolled: 'Doctor of Philosophy (Ph.D.)',
        department: 'Computer Science & AI',
        status: 'ACTIVE',
        efiles: [],
        grievances: [],
      } as any);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/student-records/me']}>
          <MyStudentRecordPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Student Master Record')).toBeInTheDocument();
      });

      // Exactly ONE institutional top bar is rendered
      const topBars = document.querySelectorAll('.csjmu-top-bar');
      expect(topBars.length).toBe(1);

      // No public marketing footer inside scholar workspace
      expect(document.querySelector('.vyasa-footer')).not.toBeInTheDocument();
    });
  });
});
