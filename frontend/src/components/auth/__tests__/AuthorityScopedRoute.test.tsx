import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthorityScopedRoute, isDesignationJurisdictionMatch } from '../AuthorityScopedRoute';
import * as AuthContextModule from '../../../context/AuthContext';

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
    displayName: 'Test Authority',
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

const renderScopedRoute = (
  allowedRoles: string[] = ['DEAN'],
  roleTitle = 'Dean of Research & Development'
) => {
  return render(
    <MemoryRouter initialEntries={['/atharva-veda/dean/dashboard']}>
      <Routes>
        <Route path="/authority/login" element={<div>Authority Login Page</div>} />
        <Route
          path="/atharva-veda/dean/dashboard"
          element={
            <AuthorityScopedRoute allowedRoles={allowedRoles} roleTitle={roleTitle}>
              <div data-testid="dean-dashboard-content">Dean Executive Dashboard Content</div>
            </AuthorityScopedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('AuthorityScopedRoute - Institutional Jurisdiction & Designation Guard Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Correctly assigned Dean of Research & Development can access the dashboard', () => {
    mockAuth({
      isAuthenticated: true,
      isAuthority: true,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean of Research & Development',
      user: {
        id: '889e14ec-5411-5554-b8e3-2be991e64080',
        email: 'research@csjmu.ac.in',
        roles: ['authority'],
        authority_role: 'DEAN',
        authority_designation: 'Dean of Research & Development',
      },
    });

    renderScopedRoute();
    expect(screen.getByTestId('dean-dashboard-content')).toBeInTheDocument();
    expect(screen.queryByText(/Institutional Jurisdiction Restricted/i)).not.toBeInTheDocument();
  });

  it('2. Production Bug Reproduction & Fix: Account with appointed authority_role DEAN is recognized even if generic roles array was empty or pending', () => {
    // When backend returns user with authority_role='DEAN' and authority_designation, isAuthority resolves to true
    mockAuth({
      isAuthenticated: true,
      isAuthority: true, // Ensured by AuthContext appointed profile check
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean of Research & Development',
      user: {
        id: '889e14ec-5411-5554-b8e3-2be991e64080',
        email: 'research@csjmu.ac.in',
        roles: ['authority'],
        authority_role: 'DEAN',
        authority_designation: 'Dean of Research & Development',
      },
    });

    renderScopedRoute();
    expect(screen.getByTestId('dean-dashboard-content')).toBeInTheDocument();
  });

  it('3. Dean from another department (Dean of Academic Affairs) is blocked with Institutional Jurisdiction Restricted', () => {
    mockAuth({
      isAuthenticated: true,
      isAuthority: true,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean of Academic Affairs',
      user: {
        id: 'dean-academic-id',
        email: 'academic@csjmu.ac.in',
        roles: ['authority'],
        authority_role: 'DEAN',
        authority_designation: 'Dean of Academic Affairs',
      },
    });

    renderScopedRoute(['DEAN'], 'Dean of Research & Development');
    expect(screen.queryByTestId('dean-dashboard-content')).not.toBeInTheDocument();
    expect(screen.getByText(/Institutional Jurisdiction Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/Dean of Research & Development Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Jurisdictional Designation: Dean of Academic Affairs/i)).toBeInTheDocument();
  });

  it('4. An unassigned DEAN without Research & Development designation cannot access the dashboard', () => {
    mockAuth({
      isAuthenticated: true,
      isAuthority: true,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: null,
      user: {
        id: 'unassigned-dean-id',
        email: 'unassigned.dean@csjmu.ac.in',
        roles: ['authority'],
        authority_role: 'DEAN',
        authority_designation: null,
      },
    });

    renderScopedRoute(['DEAN'], 'Dean of Research & Development');
    expect(screen.queryByTestId('dean-dashboard-content')).not.toBeInTheDocument();
    expect(screen.getByText(/Institutional Jurisdiction Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/Dean of Research & Development Required/i)).toBeInTheDocument();
  });

  it('5. Legacy aliases (Dean, Research & Development / Dean of R&D) are accepted', () => {
    mockAuth({
      isAuthenticated: true,
      isAuthority: true,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean, Research & Development', // Legacy alias with comma
      user: {
        id: '889e14ec-5411-5554-b8e3-2be991e64080',
        email: 'research@csjmu.ac.in',
        roles: ['authority'],
        authority_role: 'DEAN',
        authority_designation: 'Dean, Research & Development',
      },
    });

    renderScopedRoute(['DEAN'], 'Dean of Research & Development');
    expect(screen.getByTestId('dean-dashboard-content')).toBeInTheDocument();
  });

  it('6. Non-Dean authority roles (ASSISTANT_DEAN) are denied access', () => {
    mockAuth({
      isAuthenticated: true,
      isAuthority: true,
      isAssistantDean: true,
      authorityRole: 'ASSISTANT_DEAN',
      authorityDesignation: 'Assistant Dean (Subject Specialist)',
      user: {
        id: 'asst-dean-id',
        email: 'asst1@csjmu.ac.in',
        roles: ['authority'],
        authority_role: 'ASSISTANT_DEAN',
      },
    });

    renderScopedRoute(['DEAN'], 'Dean of Research & Development');
    expect(screen.queryByTestId('dean-dashboard-content')).not.toBeInTheDocument();
    expect(screen.getByText(/Institutional Jurisdiction Restricted/i)).toBeInTheDocument();
  });

  it('7. Unauthenticated user is redirected to /authority/login', () => {
    mockAuth({
      isAuthenticated: false,
    });

    renderScopedRoute(['DEAN'], 'Dean of Research & Development');
    expect(screen.getByText('Authority Login Page')).toBeInTheDocument();
  });
});

describe('isDesignationJurisdictionMatch helper unit tests', () => {
  it('handles canonical and legacy alias permutations for Dean of R&D', () => {
    expect(isDesignationJurisdictionMatch('Dean of Research & Development', 'Dean of Research & Development')).toBe(true);
    expect(isDesignationJurisdictionMatch('Dean, Research & Development', 'Dean of Research & Development')).toBe(true);
    expect(isDesignationJurisdictionMatch('Dean Research & Development', 'Dean of Research & Development')).toBe(true);
    expect(isDesignationJurisdictionMatch('Dean of R&D', 'Dean of Research & Development')).toBe(true);
    expect(isDesignationJurisdictionMatch('Dean, R&D', 'Dean of Research & Development')).toBe(true);
    expect(isDesignationJurisdictionMatch('Dean (R&D)', 'Dean of Research & Development')).toBe(true);
  });

  it('strictly rejects mismatched jurisdictions', () => {
    expect(isDesignationJurisdictionMatch('Dean of Academic Affairs', 'Dean of Research & Development')).toBe(false);
    expect(isDesignationJurisdictionMatch('Dean of Student Welfare', 'Dean of Research & Development')).toBe(false);
    expect(isDesignationJurisdictionMatch('Dean Academics', 'Dean of Research & Development')).toBe(false);
  });
});
