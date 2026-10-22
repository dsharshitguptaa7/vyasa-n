import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from '../AdminRoute';
import * as AuthContextModule from '../../../context/AuthContext';
import { AuthenticatedUser } from '../../../types/auth';

const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
  const defaultAuth: AuthContextModule.AuthContextValue = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    isAdmin: false,
    isSuperAdmin: false,
    isAuthority: false,
    isApplicant: false,
    isManager: false,
    isAssistantDean: false,
    isAssociateDean: false,
    isDean: false,
    authorityRole: null,
    authorityId: null,
    authorityDesignation: null,
    persona: 'guest',
    displayName: 'Test User',
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

const renderWithRouter = (initialRoute = '/admin') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/authority/login" element={<div>Authority Login Page</div>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div data-testid="admin-content">Super Admin Secret Workspace</div>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('AdminRoute - Strict Super Admin Authorization Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while verifying credentials', () => {
    mockAuth({ isLoading: true });
    renderWithRouter();
    expect(screen.getByText(/Verifying Super Admin credentials/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to authority login', () => {
    mockAuth({ isAuthenticated: false, isLoading: false, user: null });
    renderWithRouter();
    expect(screen.getByText('Authority Login Page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('strictly blocks legacy administrator role and displays access denied', () => {
    const legacyAdminUser: AuthenticatedUser = {
      id: 'legacy-admin-uuid',
      email: 'legacy_admin@csjmu.ac.in',
      first_name: 'Legacy',
      last_name: 'Administrator',
      roles: ['administrator'],
      is_active: true,
      is_verified: true,
    };

    mockAuth({
      isAuthenticated: true,
      isLoading: false,
      user: legacyAdminUser,
      isAdmin: false,
      isSuperAdmin: false,
    });

    renderWithRouter();
    expect(screen.getByText(/Super Admin Role Required/i)).toBeInTheDocument();
    expect(screen.getByText(/super_admin/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('blocks applicant and authority roles', () => {
    const applicantUser: AuthenticatedUser = {
      id: 'app-uuid',
      email: 'scholar@csjmu.ac.in',
      first_name: 'Scholar',
      last_name: 'Applicant',
      roles: ['applicant'],
      is_active: true,
      is_verified: true,
    };

    mockAuth({
      isAuthenticated: true,
      isLoading: false,
      user: applicantUser,
      isAdmin: false,
      isSuperAdmin: false,
    });

    renderWithRouter();
    expect(screen.getByText(/Super Admin Role Required/i)).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('renders admin content when user has super_admin role', () => {
    const superAdminUser: AuthenticatedUser = {
      id: 'super-admin-uuid',
      email: 'superadmin@csjmu.ac.in',
      first_name: 'Supreme',
      last_name: 'Controller',
      roles: ['super_admin'],
      is_active: true,
      is_verified: true,
    };

    mockAuth({
      isAuthenticated: true,
      isLoading: false,
      user: superAdminUser,
      isAdmin: true,
      isSuperAdmin: true,
    });

    renderWithRouter();
    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.getByText('Super Admin Secret Workspace')).toBeInTheDocument();
  });
});
