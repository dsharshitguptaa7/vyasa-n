import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { VyasaPortalSidebar } from '../../dashboard/components/VyasaPortalSidebar';
import { ApplicantSidebar } from '../../applicant/components/ApplicantSidebar';
import { AdminSidebar } from '../../../admin/components/AdminSidebar';
import { AdminRoute } from '../../../components/auth/AdminRoute';
import { SamaVedaDashboardPage } from '../../../modules/sama-veda/pages/SamaVedaDashboardPage';
import { VyasaDashboardPage } from '../../dashboard/VyasaDashboardPage';
import { PublicShell, WorkspaceShell, AdminShell } from '../../../components/layout';
import * as AuthContextModule from '../../../context/AuthContext';

// Mock dependencies
vi.mock('../../../services/notificationService', () => ({
  notificationService: {
    getSummary: vi.fn().mockResolvedValue({ unread_count: 5 }),
  },
}));

vi.mock('../../../modules/atharva-veda/nivaran/services/grievanceService', () => ({
  grievanceService: {
    getMyGrievances: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../../modules/sama-veda/services/samaVedaService', () => ({
  samaVedaService: {
    getBulletins: vi.fn().mockResolvedValue({ items: [] }),
    getCamProjects: vi.fn().mockResolvedValue({ items: [] }),
    getFellowships: vi.fn().mockResolvedValue({ items: [] }),
    getSpotlights: vi.fn().mockResolvedValue({ items: [] }),
    getPublications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getAuthors: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    verifyCertificate: vi.fn(),
    downloadCertificate: vi.fn(),
    downloadBulletin: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Unified Portal, Layout & ANVESHAN Architecture Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUserWithRole = (roles: string[], email: string = 'user@csjmu.ac.in') => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'usr-1', email, roles },
      token: 'jwt-token',
      isAuthenticated: true,
      isLoading: false,
      isAdmin: roles.includes('super_admin') || roles.includes('administrator'),
      isSuperAdmin: roles.includes('super_admin'),
      isAuthority: roles.includes('authority'),
      isApplicant: roles.includes('applicant'),
      isManager: roles.includes('manager'),
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      authorityRole: null,
      authorityId: null,
      authorityDesignation: null,
      persona: roles.includes('super_admin') ? 'admin' : 'guest',
      displayName: 'Test User',
      login: vi.fn(),
      completeTwoFactorAuth: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  };

  describe('1. Navigation Bug Fixes & Service Sidebar', () => {
    it('1.1 Clicking ANVESHAN opens ANVESHAN (/modules/sama-veda), NOT NIVARAN', () => {
      mockUserWithRole(['authority']);

      render(
        <MemoryRouter>
          <VyasaPortalSidebar />
        </MemoryRouter>
      );

      // Services dropdown is open by default
      const anveshanBtn = screen.getByText('SAMIKSHA');
      fireEvent.click(anveshanBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/modules/sama-veda');
      expect(mockNavigate).not.toHaveBeenCalledWith('/modules/atharva-veda/nivaran/submit');
    });

    it('1.2 Clicking NIVARAN opens NIVARAN (/modules/atharva-veda/nivaran/...)', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter>
          <VyasaPortalSidebar />
        </MemoryRouter>
      );

      const nivaranBtn = screen.getByText('NIVARAN');
      fireEvent.click(nivaranBtn);

      expect(mockNavigate).toHaveBeenCalled();
      const calledPath = mockNavigate.mock.calls[0][0];
      expect(calledPath).toContain('/modules/atharva-veda/nivaran');
    });

    it('1.3 Guidelines & Help opens help modal callback or guidelines, NOT grievances', () => {
      mockUserWithRole(['authority']);
      const mockSelectHelp = vi.fn();

      render(
        <MemoryRouter>
          <VyasaPortalSidebar onSelectHelp={mockSelectHelp} />
        </MemoryRouter>
      );

      const helpBtn = screen.getByText('Guidelines & Help');
      fireEvent.click(helpBtn);

      expect(mockSelectHelp).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalledWith('/modules/atharva-veda/nivaran/my-grievances');
    });

    it('1.4 Scholar Sidebar Dashboard navigates to /dashboard, not to grievances', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter>
          <ApplicantSidebar />
        </MemoryRouter>
      );

      const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
      expect(dashboardLink.getAttribute('href')).toBe('/dashboard');

      const grievancesLink = screen.getByRole('link', { name: /My Grievances/i });
      expect(grievancesLink.getAttribute('href')).toBe('/modules/atharva-veda/nivaran/my-grievances');

      const anveshanLink = screen.getByRole('link', { name: /SAMIKSHA Research/i });
      expect(anveshanLink.getAttribute('href')).toBe('/modules/sama-veda');
    });
  });

  describe('2. ANVESHAN Branding & URL Tab Synchronization', () => {
    it('2.1 Renders ANVESHAN official branding and initiative tagline', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter initialEntries={['/modules/sama-veda']}>
          <SamaVedaDashboardPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/SAMIKSHA • Research, Recognition & Innovation Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/Discover\. Research\. Inspire\./i)).toBeInTheDocument();
      expect(screen.getByText(/A VYASA Research & Innovation Initiative/i)).toBeInTheDocument();
    });

    it('2.2 Synchronizes active tab with URL path parameter (e.g. /modules/sama-veda/publications)', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter initialEntries={['/modules/sama-veda/publications']}>
          <Routes>
            <Route path="/modules/sama-veda/:tab" element={<SamaVedaDashboardPage />} />
          </Routes>
        </MemoryRouter>
      );

      const pubButton = screen.getByRole('button', { name: /Publications Archive/i });
      expect(pubButton).toHaveStyle({ borderBottom: '2px solid #0d766e' });
    });

    it('2.3 Clicking tab navigates to canonical subroute without full page reload', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter initialEntries={['/modules/sama-veda']}>
          <SamaVedaDashboardPage />
        </MemoryRouter>
      );

      const bulletinsTab = screen.getAllByRole('button', { name: /Research Bulletins/i })[0];
      fireEvent.click(bulletinsTab);

      expect(mockNavigate).toHaveBeenCalledWith('/modules/sama-veda/bulletins');
    });

    it('2.4 Invalid tab names fall back safely to overview tab', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter initialEntries={['/modules/sama-veda/invalid-tab-xyz']}>
          <Routes>
            <Route path="/modules/sama-veda/:tab" element={<SamaVedaDashboardPage />} />
          </Routes>
        </MemoryRouter>
      );

      const overviewBtn = screen.getByRole('button', { name: /Overview/i });
      expect(overviewBtn).toHaveStyle({ borderBottom: '2px solid #0d766e' });
    });
  });

  describe('3. Clean Layout Architecture & Shell Separation', () => {
    it('3.1 PublicShell renders university marketing footer', () => {
      render(
        <MemoryRouter>
          <PublicShell>
            <div>Public Content</div>
          </PublicShell>
        </MemoryRouter>
      );

      expect(screen.getByText('Public Content')).toBeInTheDocument();
      expect(screen.getAllByText(/Chhatrapati Shahu Ji Maharaj University/i).length).toBeGreaterThanOrEqual(1);
    });

    it('3.2 WorkspaceShell enforces 100vh application viewport and omits marketing footer', () => {
      render(
        <MemoryRouter>
          <WorkspaceShell>
            <div>Workspace Application Content</div>
          </WorkspaceShell>
        </MemoryRouter>
      );

      expect(screen.getByText('Workspace Application Content')).toBeInTheDocument();
      // Marketing footer headings should not be rendered
      expect(screen.queryByText(/Autonomous Governance Portals/i)).not.toBeInTheDocument();
    });

    it('3.3 AdminShell contains AdminSidebar with role-appropriate links', () => {
      mockUserWithRole(['super_admin']);

      render(
        <MemoryRouter>
          <AdminShell activeTab="overview">
            <div>Admin Control Canvas</div>
          </AdminShell>
        </MemoryRouter>
      );

      expect(screen.getByText('Admin Control Canvas')).toBeInTheDocument();
      expect(screen.getByText('SAMIKSHA (Sama Veda)')).toBeInTheDocument();
      expect(screen.getByText('NIVARAN (Atharva Veda)')).toBeInTheDocument();
    });
  });

  describe('4. Role & Permission Authorization Matrix', () => {
    it('4.1 AdminRoute grants access to seeded administrator role when allowedRoles is not specified', () => {
      mockUserWithRole(['administrator'], 'admin@csjmu.ac.in');

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminRoute>
            <div>Restricted Admin Canvas</div>
          </AdminRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Restricted Admin Canvas')).toBeInTheDocument();
      expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    });

    it('4.2 AdminRoute grants access to super_admin', () => {
      mockUserWithRole(['super_admin'], 'superadmin@csjmu.ac.in');

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminRoute>
            <div>Super Admin Canvas</div>
          </AdminRoute>
        </MemoryRouter>
      );

      expect(screen.getByText('Super Admin Canvas')).toBeInTheDocument();
    });

    it('4.3 AdminRoute denies access to ordinary applicant with Access Denied card', () => {
      mockUserWithRole(['applicant'], 'student@csjmu.ac.in');

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <AdminRoute>
            <div>Restricted Admin Canvas</div>
          </AdminRoute>
        </MemoryRouter>
      );

      expect(screen.queryByText('Restricted Admin Canvas')).not.toBeInTheDocument();
      expect(screen.getByText('Access Denied')).toBeInTheDocument();
    });

    it('4.4 AdminSidebar hides Atharva Veda operations for sama_content_editor', () => {
      mockUserWithRole(['sama_content_editor']);

      render(
        <MemoryRouter>
          <AdminSidebar activeTab="sama-overview" />
        </MemoryRouter>
      );

      // Sama Veda / ANVESHAN sections should be visible
      expect(screen.getByText('SAMIKSHA (Sama Veda)')).toBeInTheDocument();
      expect(screen.getByText('Publications')).toBeInTheDocument();

      // Atharva Veda section should be hidden
      expect(screen.queryByText('NIVARAN (Atharva Veda)')).not.toBeInTheDocument();
      expect(screen.queryByText('Subject Clusters')).not.toBeInTheDocument();
      expect(screen.queryByText('Authorities')).not.toBeInTheDocument();
    });

    it('4.5 AdminSidebar shows Data Import to sama_content_admin but hides it from sama_content_editor', () => {
      // Editor view
      mockUserWithRole(['sama_content_editor']);
      const { rerender } = render(
        <MemoryRouter>
          <AdminSidebar activeTab="sama-overview" />
        </MemoryRouter>
      );
      expect(screen.queryByText('Data Import')).not.toBeInTheDocument();

      // Admin view
      mockUserWithRole(['sama_content_admin']);
      rerender(
        <MemoryRouter>
          <AdminSidebar activeTab="sama-overview" />
        </MemoryRouter>
      );
      expect(screen.getByText('Data Import')).toBeInTheDocument();
    });
  });

  describe('5. Authenticated Dashboard Service Cards', () => {
    it('5.1 Dashboard presents distinct cards for both NIVARAN and ANVESHAN', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      expect(screen.getByTestId('service-card-nivaran')).toBeInTheDocument();
      expect(screen.getByTestId('service-card-anveshan')).toBeInTheDocument();
      expect(screen.getByText('Explore SAMIKSHA')).toBeInTheDocument();
    });

    it('5.2 Clicking Explore SAMIKSHA on dashboard navigates to /modules/sama-veda', () => {
      mockUserWithRole(['applicant']);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <VyasaDashboardPage />
        </MemoryRouter>
      );

      const exploreBtn = screen.getByTestId('open-service-btn-anveshan');
      fireEvent.click(exploreBtn);

      expect(mockNavigate).toHaveBeenCalledWith('/modules/sama-veda');
    });
  });
});
