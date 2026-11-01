import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '../../../components/common/Navbar';
import { UnifiedSidebar } from '../../../components/layout/UnifiedSidebar';
import { WorkspaceShell } from '../../../components/layout/WorkspaceShell';
import { PublicShell } from '../../../components/layout/PublicShell';
import * as AuthContextModule from '../../../context/AuthContext';
import { notificationService } from '../../../services/notificationService';

describe('Unified VYASA-n Ecosystem Navigation Architecture Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue({
      total_count: 3,
      unread_count: 2,
      action_required_count: 1,
      by_source: { NIVARAN: 2 },
    });
  });

  const mockAuthHelper = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: {
        id: 'user-1',
        email: 'dean.rd@csjmu.ac.in',
        fullName: 'Prof. Namita Tiwari',
        roles: ['authority'],
      },
      token: 'jwt-token',
      isAuthenticated: true,
      isLoading: false,
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
      authorityId: 'auth-dean',
      authorityDesignation: 'Dean R&D',
      persona: 'dean',
      displayName: 'Prof. Namita Tiwari',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
      hasAuthorityRole: vi.fn(),
      ...overrides,
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
    return defaultAuth;
  };

  /* -------------------------------------------------------------------------
   * Requirement 1 & 2: Unified Top Navbar contains ONLY Branding + Bell
   * ----------------------------------------------------------------------- */
  it('1 & 2. Authenticated top navbar contains ONLY branding & notification bell, without navigation items', () => {
    mockAuthHelper();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    // Branding exists
    expect(screen.getByAltText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();

    // Notification bell exists
    const bellBtn = screen.getByRole('button', { name: /^Notifications$/i });
    expect(bellBtn).toBeInTheDocument();

    // STRICT CHECK: Top navbar must NOT contain any navigation menus, tabs or logout
    expect(screen.queryByRole('navigation', { name: /Platform navigation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /VYASA Services Menu/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('navbar-profile-section')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Services')).not.toBeInTheDocument();
    expect(screen.queryByText('NIVARAN')).not.toBeInTheDocument();
    expect(screen.queryByText('SAMIKSHA')).not.toBeInTheDocument();
    expect(screen.queryByText('My Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Guidelines & Help')).not.toBeInTheDocument();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  /* -------------------------------------------------------------------------
   * Requirement 3: Left Sidebar contains Sections A, B, C, D
   * ----------------------------------------------------------------------- */
  it('3. Left sidebar contains sections A (Platform), B (Services), C (Utilities), and D (Account)', () => {
    mockAuthHelper();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    // Section Headers
    expect(screen.getByText('PLATFORM')).toBeInTheDocument();
    expect(screen.getByText('SERVICES')).toBeInTheDocument();
    expect(screen.getByText('UTILITIES')).toBeInTheDocument();
    expect(screen.getByText('ACCOUNT')).toBeInTheDocument();

    // Section A Items
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-nav-profile')).toBeInTheDocument();

    // Section B Accordions
    expect(screen.getByTestId('sidebar-services-toggle')).toBeInTheDocument(); // NIVARAN
    expect(screen.getByRole('button', { name: /SAMIKSHA/i })).toBeInTheDocument();

    // Section C Items
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Guidelines & Help/i })).toBeInTheDocument();

    // Section D Items
    expect(screen.getByTestId('sidebar-profile-action')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-logout-btn')).toBeInTheDocument();
  });

  /* -------------------------------------------------------------------------
   * Requirement 4: Services section includes NIVARAN and SAMIKSHA
   * ----------------------------------------------------------------------- */
  it('4. Services section organizes NIVARAN and SAMIKSHA with accordion expand/collapse', () => {
    mockAuthHelper();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    const nivaranToggle = screen.getByTestId('sidebar-services-toggle');
    const samikshaToggle = screen.getByRole('button', { name: /SAMIKSHA/i });

    expect(nivaranToggle).toHaveAttribute('aria-expanded', 'true');
    expect(samikshaToggle).toHaveAttribute('aria-expanded', 'false');

    // Toggle SAMIKSHA to open
    fireEvent.click(samikshaToggle);
    expect(samikshaToggle).toHaveAttribute('aria-expanded', 'true');
  });

  /* -------------------------------------------------------------------------
   * Requirement 5: All 6 SAMIKSHA tabs are accessible in SAMIKSHA accordion
   * ----------------------------------------------------------------------- */
  it('5. All 6 SAMIKSHA tabs are accessible with canonical routes', () => {
    mockAuthHelper();

    render(
      <MemoryRouter initialEntries={['/modules/sama-veda']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    // Open SAMIKSHA accordion
    const samikshaToggle = screen.getByRole('button', { name: /SAMIKSHA/i });
    if (samikshaToggle.getAttribute('aria-expanded') !== 'true') {
      fireEvent.click(samikshaToggle);
    }

    // 6 Canonical tabs
    expect(screen.getByRole('link', { name: /Research Publications/i })).toHaveAttribute(
      'href',
      '/modules/sama-veda/publications'
    );
    expect(screen.getByRole('link', { name: /Research Bulletins/i })).toHaveAttribute(
      'href',
      '/modules/sama-veda/bulletins'
    );
    expect(screen.getByRole('link', { name: /Researcher Directory/i })).toHaveAttribute(
      'href',
      '/modules/sama-veda/researchers'
    );
    expect(screen.getByRole('link', { name: /Certificate Verification/i })).toHaveAttribute(
      'href',
      '/modules/sama-veda/certificates'
    );
    expect(screen.getByRole('link', { name: /CAM-AI Projects/i })).toHaveAttribute(
      'href',
      '/modules/sama-veda/cam-projects'
    );
    expect(screen.getByRole('link', { name: /Fellowship Schemes/i })).toHaveAttribute(
      'href',
      '/modules/sama-veda/fellowships'
    );
  });

  /* -------------------------------------------------------------------------
   * Requirement 6: Bottom account section displays real user name & real role
   * ----------------------------------------------------------------------- */
  it('6. Bottom account section displays actual user name and accurate role label', () => {
    mockAuthHelper({
      displayName: 'Prof. Namita Tiwari',
      authorityDesignation: 'Dean R&D',
      authorityRole: 'DEAN',
      isDean: true,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    expect(screen.getByTestId('sidebar-account-name')).toHaveTextContent('Prof. Namita Tiwari');
    expect(screen.getByTestId('sidebar-account-role')).toHaveTextContent('Dean R&D');
    expect(screen.getByTestId('sidebar-account-initials')).toHaveTextContent('PT');
  });

  it('6b. Displays Doctoral Scholar role label for applicants', () => {
    mockAuthHelper({
      displayName: 'Aditi Sharma',
      isDean: false,
      isAuthority: false,
      isApplicant: true,
      authorityRole: null,
      authorityDesignation: null,
      user: { id: 'app-1', email: 'aditi@csjmu.ac.in', fullName: 'Aditi Sharma', roles: ['applicant'] },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    expect(screen.getByTestId('sidebar-account-name')).toHaveTextContent('Aditi Sharma');
    expect(screen.getByTestId('sidebar-account-role')).toHaveTextContent('Doctoral Scholar');
    expect(screen.getByTestId('sidebar-account-initials')).toHaveTextContent('AS');
  });

  /* -------------------------------------------------------------------------
   * Requirement 7: Logout redirects applicants to applicant login, authorities to authority login
   * ----------------------------------------------------------------------- */
  it('7a. Logout redirects applicants to /applicant/login', async () => {
    const logoutMock = vi.fn();
    mockAuthHelper({
      isApplicant: true,
      isAuthority: false,
      logout: logoutMock,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<UnifiedSidebar />} />
          <Route path="/applicant/login" element={<div>Applicant Login Destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    const logoutBtn = screen.getByTestId('sidebar-logout-btn');
    fireEvent.click(logoutBtn);

    expect(logoutMock).toHaveBeenCalled();
    expect(await screen.findByText('Applicant Login Destination')).toBeInTheDocument();
  });

  it('7b. Logout redirects authorities to /authority/login', async () => {
    const logoutMock = vi.fn();
    mockAuthHelper({
      isApplicant: false,
      isAuthority: true,
      isDean: true,
      logout: logoutMock,
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<UnifiedSidebar />} />
          <Route path="/authority/login" element={<div>Authority Login Destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    const logoutBtn = screen.getByTestId('sidebar-logout-btn');
    fireEvent.click(logoutBtn);

    expect(logoutMock).toHaveBeenCalled();
    expect(await screen.findByText('Authority Login Destination')).toBeInTheDocument();
  });

  /* -------------------------------------------------------------------------
   * Requirement 8: Public landing page still works with normal public shell
   * ----------------------------------------------------------------------- */
  it('8. Unauthenticated users see normal public navbar and footer', () => {
    mockAuthHelper({
      isAuthenticated: false,
      user: null,
      displayName: '',
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicShell currentTab="overview">
          <div>Landing Page Body Content</div>
        </PublicShell>
      </MemoryRouter>
    );

    expect(screen.getByText('Landing Page Body Content')).toBeInTheDocument();
    expect(screen.getByText('ज्ञान से शोध तक, AI के साथ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LOGIN/i })).toBeInTheDocument();
  });

  /* -------------------------------------------------------------------------
   * Requirement 9: WorkspaceShell enforces single-scroll canvas without marketing footer
   * ----------------------------------------------------------------------- */
  it('9. WorkspaceShell renders unified header + sidebar + main canvas without marketing footer', () => {
    mockAuthHelper();

    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <WorkspaceShell currentTab="governance">
          <div data-testid="workspace-content">Executive Command Center Data</div>
        </WorkspaceShell>
      </MemoryRouter>
    );

    // Shell structure
    expect(container.querySelector('.vyasa-workspace-shell')).toBeInTheDocument();
    expect(container.querySelector('.vyasa-unified-sidebar')).toBeInTheDocument();
    expect(container.querySelector('.vyasa-workspace-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-content')).toBeInTheDocument();

    // No marketing footer in authenticated workspace
    expect(container.querySelector('.vyasa-footer')).not.toBeInTheDocument();
  });

  /* -------------------------------------------------------------------------
   * Requirement 10: Super Admin NIVARAN sidebar includes Subjects in correct order
   * ----------------------------------------------------------------------- */
  it('10. Super Admin NIVARAN sidebar includes Subjects between Subject Clusters and Grievance Clusters', () => {
    mockAuthHelper({
      isSuperAdmin: true,
      isAdmin: true,
      user: {
        id: 'admin-1',
        email: 'superadmin@csjmu.ac.in',
        fullName: 'Super Administrator',
        roles: ['super_admin', 'administrator'],
      },
      displayName: 'Super Administrator',
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    // Get all links inside NIVARAN
    const authoritiesLink = screen.getByRole('link', { name: /Authorities Management/i });
    const categoriesLink = screen.getByRole('link', { name: /Grievance Categories/i });
    const clustersLink = screen.getByRole('link', { name: /Subject Clusters/i });
    const subjectsLink = screen.getByRole('link', { name: /^Subjects$/i });
    const grievanceClustersLink = screen.getByRole('link', { name: /Grievance Clusters/i });
    const auditLink = screen.getByRole('link', { name: /Audit Explorer/i });
    const efilesLink = screen.getByRole('link', { name: /My E-Files/i });

    expect(authoritiesLink).toHaveAttribute('href', '/admin/atharva/authorities');
    expect(categoriesLink).toHaveAttribute('href', '/admin/atharva/categories');
    expect(clustersLink).toHaveAttribute('href', '/admin/atharva/subject-clusters');
    expect(subjectsLink).toHaveAttribute('href', '/admin/atharva/subjects');
    expect(grievanceClustersLink).toHaveAttribute('href', '/admin/atharva/grievance-clusters');
    expect(auditLink).toHaveAttribute('href', '/admin/atharva/audit-logs');
    expect(efilesLink).toHaveAttribute('href', '/modules/atharva-veda/nivaran/e-files');

    // Verify ordering
    const links = [
      authoritiesLink,
      categoriesLink,
      clustersLink,
      subjectsLink,
      grievanceClustersLink,
      auditLink,
      efilesLink,
    ];

    for (let i = 0; i < links.length - 1; i++) {
      expect(links[i].compareDocumentPosition(links[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
