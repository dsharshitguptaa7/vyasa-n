import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PublicShell } from '../../../components/layout/PublicShell';
import { WorkspaceShell } from '../../../components/layout/WorkspaceShell';
import { UnifiedSidebar } from '../../../components/layout/UnifiedSidebar';
import { SamaVedaDashboardPage } from '../../../modules/sama-veda/pages/SamaVedaDashboardPage';
import * as AuthContextModule from '../../../context/AuthContext';
import { notificationService } from '../../../services/notificationService';
import { samaVedaService } from '../../../modules/sama-veda/services/samaVedaService';

vi.mock('../../../modules/sama-veda/services/samaVedaService', () => ({
  samaVedaService: {
    getBulletins: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getCamProjects: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getFellowships: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getSpotlights: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    getPublications: vi.fn().mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 }),
    getAuthors: vi.fn().mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 }),
    verifyCertificate: vi.fn(),
  },
}));

describe('SAMIKSHA Research Workspace Shell Integration Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(notificationService, 'getSummary').mockResolvedValue({
      total_count: 2,
      unread_count: 1,
      action_required_count: 0,
      by_source: { SAMIKSHA: 1 },
    });
  });

  const mockAuthHelper = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: {
        id: 'user-scholar-1',
        email: 'scholar@csjmu.ac.in',
        fullName: 'Dr. Ramesh Chandra',
        roles: ['applicant'],
      },
      token: 'jwt-token-123',
      isAuthenticated: true,
      isLoading: false,
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
      persona: 'applicant',
      displayName: 'Dr. Ramesh Chandra',
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

  it('1. Authenticated user visiting SAMIKSHA renders inside shared WorkspaceShell with UnifiedSidebar', () => {
    mockAuthHelper();

    const { container } = render(
      <MemoryRouter initialEntries={['/modules/sama-veda']}>
        <PublicShell currentTab="samiksha">
          <SamaVedaDashboardPage />
        </PublicShell>
      </MemoryRouter>
    );

    // Enforces shared WorkspaceShell layout
    expect(container.querySelector('.vyasa-workspace-shell')).toBeInTheDocument();
    expect(container.querySelector('.vyasa-unified-sidebar')).toBeInTheDocument();
    expect(container.querySelector('.vyasa-workspace-canvas')).toBeInTheDocument();

    // No marketing footer in authenticated workspace
    expect(container.querySelector('.vyasa-footer')).not.toBeInTheDocument();

    // Shows institutional breadcrumbs
    expect(screen.getByText('VYASA Dashboard')).toBeInTheDocument();
    expect(screen.getAllByText('SAMIKSHA Research').length).toBeGreaterThanOrEqual(1);
  });

  it('2. Unauthenticated visitor to SAMIKSHA remains public with marketing footer and no sidebar', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isSuperAdmin: false,
      isAdmin: false,
      isAuthority: false,
      isApplicant: false,
      isGuest: true,
      isManager: false,
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      isFixedAuthority: false,
      authorityRole: null,
      authorityId: null,
      authorityDesignation: null,
      persona: 'guest',
      displayName: '',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      hasRole: vi.fn(),
      hasAuthorityRole: vi.fn(),
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/modules/sama-veda']}>
        <PublicShell currentTab="samiksha">
          <SamaVedaDashboardPage />
        </PublicShell>
      </MemoryRouter>
    );

    // Enforces public shell without workspace sidebar
    expect(container.querySelector('.vyasa-public-shell')).toBeInTheDocument();
    expect(container.querySelector('.vyasa-unified-sidebar')).not.toBeInTheDocument();

    // Marketing footer rendered for unauthenticated public visitors
    expect(screen.getAllByText(/Chhatrapati Shahu Ji Maharaj University/i).length).toBeGreaterThanOrEqual(1);
  });

  it('3. SAMIKSHA accordion automatically expands and highlights active item on sub-routes', () => {
    mockAuthHelper();

    render(
      <MemoryRouter initialEntries={['/modules/sama-veda/publications']}>
        <UnifiedSidebar />
      </MemoryRouter>
    );

    // SAMIKSHA accordion open
    const samikshaToggle = screen.getByRole('button', { name: /SAMIKSHA/i });
    expect(samikshaToggle).toHaveAttribute('aria-expanded', 'true');

    // Research Publications link is active
    const publicationsLink = screen.getByRole('link', { name: /Research Publications/i });
    expect(publicationsLink).toHaveAttribute('href', '/modules/sama-veda/publications');
  });

  it('4. Authority persona (e.g. Dean R&D) visiting SAMIKSHA retains WorkspaceShell and role badge', () => {
    mockAuthHelper({
      user: {
        id: 'dean-1',
        email: 'dean@csjmu.ac.in',
        fullName: 'Prof. Namita Tiwari',
        roles: ['authority'],
      },
      isAuthority: true,
      isApplicant: false,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean R&D',
      displayName: 'Prof. Namita Tiwari',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/modules/sama-veda/bulletins']}>
        <PublicShell currentTab="samiksha">
          <SamaVedaDashboardPage />
        </PublicShell>
      </MemoryRouter>
    );

    expect(container.querySelector('.vyasa-workspace-shell')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-account-name')).toHaveTextContent('Prof. Namita Tiwari');
    expect(screen.getByTestId('sidebar-account-role')).toHaveTextContent('Dean R&D');
  });

  it('5. Breadcrumb trail reflects the active SAMIKSHA tab in authenticated view', () => {
    mockAuthHelper();

    render(
      <MemoryRouter initialEntries={['/modules/sama-veda/fellowships']}>
        <Routes>
          <Route
            path="/modules/sama-veda/:tab"
            element={
              <PublicShell currentTab="samiksha">
                <SamaVedaDashboardPage />
              </PublicShell>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Breadcrumb contains active tab name
    const breadcrumbNav = screen.getByRole('navigation', { name: /Breadcrumb/i });
    expect(within(breadcrumbNav).getByText('Fellowship Schemes')).toBeInTheDocument();
  });
});
