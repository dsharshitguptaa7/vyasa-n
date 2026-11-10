import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageContainer } from '@vyasa/ui';
import { PageHeader } from '../components/common/PageHeader';
import { UnifiedSidebar } from '../components/layout/UnifiedSidebar';
import { WorkspaceShell } from '../components/layout/WorkspaceShell';
import {
  getPlatformNavItems,
  getNivaranNavItems,
  getSamikshaNavItems,
  getVedaPortalsNavItems,
  getUtilitiesNavItems,
  getRoleDashboardDestination,
} from '../config/navigation';
import * as AuthContextModule from '../context/AuthContext';

// Mock AuthContext
const mockAuthHelper = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
  const defaultAuth: AuthContextModule.AuthContextValue = {
    user: null,
    token: null,
    isAuthenticated: false,
    isAdmin: false,
    isAuthority: false,
    isApplicant: false,
    isManager: false,
    isAssistantDean: false,
    isAssociateDean: false,
    isDean: false,
    isSuperAdmin: false,
    authorityRole: null,
    displayName: 'Test User',
    login: vi.fn(),
    logout: vi.fn(),
    canAccessAuthority: vi.fn().mockReturnValue(false),
    hasRole: vi.fn().mockReturnValue(false),
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

describe('Phase 2: Layout Canvas & WorkspaceShell Unification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  /* -------------------------------------------------------------------------
   * 1. PageContainer Standardization
   * ----------------------------------------------------------------------- */
  describe('1. Unified PageContainer Baseline', () => {
    it('renders children with standard container classes', () => {
      render(
        <PageContainer className="test-custom-class">
          <div data-testid="child-content">Content Canvas</div>
        </PageContainer>
      );

      const container = screen.getByTestId('child-content').parentElement;
      expect(container).toHaveClass('vyasa-page-container');
      expect(container).toHaveClass('test-custom-class');
      expect(container).not.toHaveClass('vyasa-page-container--fluid');
    });

    it('supports fluid mode with 100% max-width modifier', () => {
      render(
        <PageContainer fluid>
          <div data-testid="fluid-content">Wide Data Table</div>
        </PageContainer>
      );

      const container = screen.getByTestId('fluid-content').parentElement;
      expect(container).toHaveClass('vyasa-page-container');
      expect(container).toHaveClass('vyasa-page-container--fluid');
    });
  });

  /* -------------------------------------------------------------------------
   * 2. Common PageHeader & Role-Aware Breadcrumbs
   * ----------------------------------------------------------------------- */
  describe('2. Common PageHeader & Role-Aware Breadcrumbs', () => {
    it('renders title, subtitle, status badge, and action buttons', () => {
      const handlePrimary = vi.fn();
      const handleSecondary = vi.fn();

      render(
        <MemoryRouter>
          <PageHeader
            title="Grievance Redressal Command Center"
            subtitle="Executive overview and triage dashboard"
            statusBadge={{ label: 'Active', variant: 'teal' }}
            primaryAction={{
              label: 'New Action',
              onClick: handlePrimary,
            }}
            secondaryActions={[
              {
                label: 'Export Report',
                onClick: handleSecondary,
              },
            ]}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Grievance Redressal Command Center')).toBeInTheDocument();
      expect(screen.getByText('Executive overview and triage dashboard')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      const primaryBtn = screen.getByRole('button', { name: 'New Action' });
      fireEvent.click(primaryBtn);
      expect(handlePrimary).toHaveBeenCalledTimes(1);

      const secondaryBtn = screen.getByRole('button', { name: 'Export Report' });
      fireEvent.click(secondaryBtn);
      expect(handleSecondary).toHaveBeenCalledTimes(1);
    });

    it('renders breadcrumbs and back button', () => {
      const handleBack = vi.fn();

      render(
        <MemoryRouter>
          <PageHeader
            title="Docket Detail"
            backButton={{
              onClick: handleBack,
              label: 'Return to Docket',
            }}
            breadcrumbs={[
              { label: 'Dashboard', path: '/atharva-veda/dean/dashboard' },
              { label: 'Atharva Veda', path: '/atharva-veda/workspace' },
              { label: 'Docket Detail' },
            ]}
          />
        </MemoryRouter>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Atharva Veda')).toBeInTheDocument();
      expect(screen.getByText('Return to Docket')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Return to Docket/i }));
      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('resolves correct role-aware dashboard destinations', () => {
      expect(getRoleDashboardDestination({ isAuthenticated: false })).toBe('/');
      expect(getRoleDashboardDestination({ isAuthenticated: true, isApplicant: true })).toBe('/applicant/dashboard');
      expect(getRoleDashboardDestination({ isAuthenticated: true, isDean: true })).toBe('/atharva-veda/dean/dashboard');
      expect(getRoleDashboardDestination({ isAuthenticated: true, isAssociateDean: true })).toBe('/atharva-veda/associate-dean/dashboard');
      expect(getRoleDashboardDestination({ isAuthenticated: true, isAssistantDean: true })).toBe('/atharva-veda/assistant-dean/dashboard');
      expect(getRoleDashboardDestination({ isAuthenticated: true, isManager: true })).toBe('/atharva-veda/manager/queue');
      expect(getRoleDashboardDestination({ isAuthenticated: true, isAdmin: true })).toBe('/admin');
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Centralized Navigation Configuration & Role Filtering
   * ----------------------------------------------------------------------- */
  describe('3. Centralized Navigation Configuration', () => {
    it('filters Nivaran menu items based on user authority role', () => {
      // Applicant
      const applicantNav = getNivaranNavItems({ isAuthenticated: true, isApplicant: true });
      expect(applicantNav.some((item) => item.id === 'my-grievances')).toBe(true);
      expect(applicantNav.some((item) => item.id === 'submit-grievance')).toBe(true);
      expect(applicantNav.some((item) => item.id === 'executive-review')).toBe(false);

      // Dean
      const deanNav = getNivaranNavItems({ isAuthenticated: true, isDean: true });
      expect(deanNav.some((item) => item.id === 'executive-review')).toBe(true);
      expect(deanNav.some((item) => item.id === 'student-records')).toBe(true);

      // Assistant Dean
      const asstNav = getNivaranNavItems({ isAuthenticated: true, isAssistantDean: true });
      expect(asstNav.some((item) => item.id === 'assigned-cases')).toBe(true);

      // Associate Dean
      const assocNav = getNivaranNavItems({ isAuthenticated: true, isAssociateDean: true });
      expect(assocNav.some((item) => item.id === 'jurisdiction-cases')).toBe(true);

      // Manager
      const mgrNav = getNivaranNavItems({ isAuthenticated: true, isManager: true });
      expect(mgrNav.some((item) => item.id === 'manager-queue')).toBe(true);
    });

    it('guards Samiksha Data Import for content admin role only', () => {
      const editorAuth = {
        isAuthenticated: true,
        user: { id: 'u1', email: 'ed@csjmu.ac.in', roles: ['sama_content_editor'] },
        hasRole: (role: string) => role === 'sama_content_editor',
      };
      const editorSamiksha = getSamikshaNavItems(editorAuth);
      expect(editorSamiksha.some((item) => item.id === 'sama-import')).toBe(false);

      const adminAuth = {
        isAuthenticated: true,
        user: { id: 'u2', email: 'adm@csjmu.ac.in', roles: ['sama_content_admin'] },
        hasRole: (role: string) => role === 'sama_content_admin',
      };
      const adminSamiksha = getSamikshaNavItems(adminAuth);
      expect(adminSamiksha.some((item) => item.id === 'sama-import')).toBe(true);
    });

    it('provides Veda Portals and Utilities navigation items', () => {
      const vedaItems = getVedaPortalsNavItems();
      expect(vedaItems).toHaveLength(4);
      expect(vedaItems.map((i) => i.id)).toEqual(['atharva-veda', 'sama-veda', 'yajur-veda', 'rig-veda']);

      const utilItems = getUtilitiesNavItems({ isAuthenticated: true });
      expect(utilItems.some((i) => i.id === 'notifications')).toBe(true);
      expect(utilItems.some((i) => i.id === 'help')).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------
   * 4. UnifiedSidebar Functionality & Personas
   * ----------------------------------------------------------------------- */
  describe('4. UnifiedSidebar Functionality', () => {
    it('renders applicant mode navigation for applicants', () => {
      mockAuthHelper({
        isAuthenticated: true,
        isApplicant: true,
        displayName: 'Scholar Aditi',
      });

      render(
        <MemoryRouter initialEntries={['/applicant/dashboard']}>
          <UnifiedSidebar activeTab="dashboard" />
        </MemoryRouter>
      );

      expect(screen.getByText('Scholar Aditi')).toBeInTheDocument();
      expect(screen.getByText('Submit Grievance')).toBeInTheDocument();
      expect(screen.getByText('My Grievances')).toBeInTheDocument();
    });

    it('renders platform & Samiksha navigation for admin persona', () => {
      mockAuthHelper({
        isAuthenticated: true,
        isAdmin: true,
        displayName: 'Admin User',
        user: { id: 'admin-1', email: 'admin@csjmu.ac.in', roles: ['admin', 'sama_content_admin'] },
        hasRole: (r: string) => r === 'admin' || r === 'sama_content_admin',
      });

      render(
        <MemoryRouter initialEntries={['/admin/sama']}>
          <UnifiedSidebar activeTab="sama-overview" />
        </MemoryRouter>
      );

      expect(screen.getByText('SAMIKSHA Research')).toBeInTheDocument();
      expect(screen.getByText('Data Ingestion')).toBeInTheDocument();
      expect(screen.getByText('Research Publications')).toBeInTheDocument();
    });

    it('supports expanding and collapsing sidebar sections', () => {
      mockAuthHelper({
        isAuthenticated: true,
        isDean: true,
        displayName: 'Dean Namita',
      });

      render(
        <MemoryRouter initialEntries={['/atharva-veda/dean/dashboard']}>
          <UnifiedSidebar />
        </MemoryRouter>
      );

      // Section button for NIVARAN
      const nivaranBtn = screen.getByTestId('sidebar-services-toggle');
      expect(nivaranBtn).toHaveAttribute('aria-expanded', 'true');

      // Click to collapse
      fireEvent.click(nivaranBtn);
      expect(nivaranBtn).toHaveAttribute('aria-expanded', 'false');

      // Click to re-expand
      fireEvent.click(nivaranBtn);
      expect(nivaranBtn).toHaveAttribute('aria-expanded', 'true');
    });
  });

  /* -------------------------------------------------------------------------
   * 5. WorkspaceShell Canvas & Mobile Drawer Accessibility
   * ----------------------------------------------------------------------- */
  describe('5. WorkspaceShell Canvas & Mobile Drawer Accessibility', () => {
    it('locks body scroll when mobile drawer is opened and unlocks when closed', () => {
      mockAuthHelper({
        isAuthenticated: true,
        isApplicant: true,
      });

      const { container } = render(
        <MemoryRouter>
          <WorkspaceShell>
            <div>Workspace Canvas</div>
          </WorkspaceShell>
        </MemoryRouter>
      );

      // Drawer trigger button
      const openDrawerBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
      fireEvent.click(openDrawerBtn);

      // Body scroll locked
      expect(document.body.style.overflow).toBe('hidden');

      // Click backdrop to close
      const backdrop = container.querySelector('.vyasa-mobile-backdrop');
      expect(backdrop).toBeInTheDocument();
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Body scroll restored
      expect(document.body.style.overflow).toBe('');
    });

    it('closes mobile drawer on Escape key press and restores focus', () => {
      mockAuthHelper({
        isAuthenticated: true,
        isApplicant: true,
      });

      render(
        <MemoryRouter>
          <WorkspaceShell>
            <div>Workspace Canvas</div>
          </WorkspaceShell>
        </MemoryRouter>
      );

      const openDrawerBtn = screen.getByRole('button', { name: /Toggle navigation menu/i });
      fireEvent.click(openDrawerBtn);
      expect(document.body.style.overflow).toBe('hidden');

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(document.body.style.overflow).toBe('');
    });

    it('renders main canvas with overflowX: hidden', () => {
      render(
        <MemoryRouter>
          <WorkspaceShell>
            <div data-testid="test-content">Content</div>
          </WorkspaceShell>
        </MemoryRouter>
      );

      const mainCanvas = screen.getByRole('main');
      expect(mainCanvas).toHaveClass('vyasa-workspace-canvas');
      expect(mainCanvas.style.overflowX).toBe('hidden');
    });
  });
});
