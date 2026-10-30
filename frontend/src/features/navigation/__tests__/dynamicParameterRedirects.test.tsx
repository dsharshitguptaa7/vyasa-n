import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppRoutes, DynamicParamRedirect } from '../../../App';
import * as AuthContextModule from '../../../context/AuthContext';

// Mock auxiliary services needed by AppRoutes components
vi.mock('../../../services/notificationService', () => ({
  notificationService: {
    getSummary: vi.fn().mockResolvedValue({ unread_count: 0 }),
    getNotifications: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));

vi.mock('../../../modules/atharva-veda/nivaran/services/grievanceService', () => ({
  grievanceService: {
    getMyGrievances: vi.fn().mockResolvedValue([]),
    getGrievanceDetail: vi.fn().mockResolvedValue(null),
    getManagerTriageQueue: vi.fn().mockResolvedValue([]),
    previewRouting: vi.fn().mockResolvedValue(null),
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

// Helper component that displays the current location for route assertions
const LocationTracker: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="current-location">
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
};

describe('Dynamic Parameter Redirects & Legacy Route Compatibility Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuthState = (opts: {
    isAuthenticated: boolean;
    roles?: string[];
    isManager?: boolean;
    isApplicant?: boolean;
  }) => {
    const roles = opts.roles || [];
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: opts.isAuthenticated
        ? { id: 'usr-test-123', email: 'test@csjmu.ac.in', roles }
        : null,
      token: opts.isAuthenticated ? 'mock-jwt-token' : null,
      isAuthenticated: opts.isAuthenticated,
      isLoading: false,
      isAdmin: roles.includes('super_admin') || roles.includes('administrator'),
      isSuperAdmin: roles.includes('super_admin'),
      isAuthority: roles.includes('authority') || opts.isManager === true,
      isApplicant: opts.isApplicant === true || roles.includes('applicant'),
      isManager: opts.isManager === true || roles.includes('manager'),
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      authorityRole: opts.isManager ? 'MANAGER' : null,
      authorityId: 'auth-mgr-1',
      authorityDesignation: opts.isManager ? 'Grievance Manager' : null,
      persona: opts.isManager ? 'authority' : 'guest',
      displayName: 'Test User',
      login: vi.fn(),
      completeTwoFactorAuth: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  };

  describe('1. Task 1: Sama Veda Legacy Tab Redirects (/sama-veda/:tab and /felicitation/:tab)', () => {
    it('1.1 Redirects /sama-veda/publications to /modules/sama-veda/publications preserving tab param', async () => {
      mockAuthState({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/sama-veda/publications']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda/publications');
      });
      // Verify not corrupted into literal string ":tab"
      expect(screen.getByTestId('pathname').textContent).not.toBe('/modules/sama-veda/:tab');
    });

    it('1.2 Redirects /sama-veda/authors to /modules/sama-veda/authors preserving tab param', async () => {
      mockAuthState({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/sama-veda/authors']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda/authors');
      });
      expect(screen.getByTestId('pathname').textContent).not.toBe('/modules/sama-veda/:tab');
    });

    it('1.3 Redirects /felicitation/bulletins to /modules/sama-veda/bulletins preserving tab param', async () => {
      mockAuthState({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/felicitation/bulletins']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda/bulletins');
      });
      expect(screen.getByTestId('pathname').textContent).not.toBe('/modules/sama-veda/:tab');
    });

    it('1.4 Redirects /felicitation/cam-projects to /modules/sama-veda/cam-projects preserving tab param', async () => {
      mockAuthState({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/felicitation/cam-projects']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda/cam-projects');
      });
      expect(screen.getByTestId('pathname').textContent).not.toBe('/modules/sama-veda/:tab');
    });

    it('1.5 Preserves search query parameters during dynamic tab redirection', async () => {
      mockAuthState({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/sama-veda/publications?category=ai&year=2026']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda/publications');
        expect(screen.getByTestId('search').textContent).toBe('?category=ai&year=2026');
      });
    });

    it('1.6 Base legacy routes (/sama-veda and /felicitation) redirect to /modules/sama-veda', async () => {
      mockAuthState({ isAuthenticated: false });

      const { unmount } = render(
        <MemoryRouter initialEntries={['/sama-veda']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda');
      });

      unmount();

      render(
        <MemoryRouter initialEntries={['/felicitation']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/modules/sama-veda');
      });
    });
  });

  describe('2. Task 3: Manager Review Legacy Aliases Preserving :id', () => {
    it('2.1 Redirects /atharva-veda/nivaran/manager/review/:id to canonical guarded route preserving :id', async () => {
      mockAuthState({ isAuthenticated: true, isManager: true, roles: ['authority', 'manager'] });

      render(
        <MemoryRouter initialEntries={['/atharva-veda/nivaran/manager/review/CSJMU-2026-00042']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe(
          '/modules/atharva-veda/nivaran/manager/review/CSJMU-2026-00042'
        );
      });
      expect(screen.getByTestId('pathname').textContent).not.toBe(
        '/modules/atharva-veda/nivaran/manager/review/:id'
      );
    });

    it('2.2 Redirects /nivaran/manager/review/:id to canonical guarded route preserving :id', async () => {
      mockAuthState({ isAuthenticated: true, isManager: true, roles: ['authority', 'manager'] });

      render(
        <MemoryRouter initialEntries={['/nivaran/manager/review/GRV-UUID-9988']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe(
          '/modules/atharva-veda/nivaran/manager/review/GRV-UUID-9988'
        );
      });
      expect(screen.getByTestId('pathname').textContent).not.toBe(
        '/modules/atharva-veda/nivaran/manager/review/:id'
      );
    });

    it('2.3 Unauthenticated access to /atharva-veda/nivaran/manager/review/:id is intercepted by canonical ManagerRoute', async () => {
      mockAuthState({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={['/atharva-veda/nivaran/manager/review/CASE-123']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      // Should be forwarded to canonical route and then redirected to authority login by ManagerRoute
      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/authority/login');
      });
    });

    it('2.4 Non-manager authenticated access to /nivaran/manager/review/:id is restricted by ManagerRoute', async () => {
      mockAuthState({ isAuthenticated: true, isManager: false, roles: ['applicant'] });

      render(
        <MemoryRouter initialEntries={['/nivaran/manager/review/CASE-456']}>
          <LocationTracker />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe(
          '/modules/atharva-veda/nivaran/manager/review/CASE-456'
        );
        expect(screen.getByText('Triage Command Center Restricted')).toBeInTheDocument();
        expect(screen.getByText(/Triage Manager Role Required/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Unit Test: DynamicParamRedirect Isolation', () => {
    it('3.1 Accurately interpolates route parameters without literal placeholder', () => {
      render(
        <MemoryRouter initialEntries={['/test-source/item-789']}>
          <LocationTracker />
          <Routes>
            <Route
              path="/test-source/:item_id"
              element={<DynamicParamRedirect to={({ item_id }) => `/canonical/target/${item_id}`} />}
            />
            <Route path="/canonical/target/:item_id" element={<div data-testid="target-page">Target Page</div>} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByTestId('pathname').textContent).toBe('/canonical/target/item-789');
      expect(screen.getByTestId('target-page')).toBeInTheDocument();
    });
  });
});
