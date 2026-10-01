import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NivaranNav } from '../components/NivaranNav';
import { NivaranWorkspaceCard } from '../components/NivaranWorkspaceCard';
import { AppRoutes } from '../../../../App';
import * as AuthContextModule from '../../../../context/AuthContext';

describe('Authority Boundary & Role-Based Access Separation UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithAuth = (ui: React.ReactElement, authOverrides: Partial<AuthContextModule.AuthContextValue>) => {
    const defaultAuth: AuthContextModule.AuthContextValue = {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      isAdmin: false,
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
      displayName: 'Guest User',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      ...authOverrides,
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);

    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  it('1. Applicant persona: sees Submit & My Grievances, but NO Manager, Dean, or Admin controls', () => {
    renderWithAuth(
      <div>
        <NivaranNav />
        <NivaranWorkspaceCard />
      </div>,
      {
        isAuthenticated: true,
        isApplicant: true,
        user: {
          id: 'applicant-1',
          email: 'scholar@csjmu.ac.in',
          roles: ['applicant'],
        },
        persona: 'applicant',
        displayName: 'PhD Scholar',
      }
    );

    // Should see Applicant navigation and actions
    expect(screen.getByRole('link', { name: /Submit Grievance/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /My Grievances/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /\+ Submit Grievance/i })).toBeInTheDocument();

    // Must NOT see Manager, Dean, or Admin controls
    expect(screen.queryByText(/Manager Triage Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assigned Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cluster Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin Taxonomy & Authorities/i)).not.toBeInTheDocument();
  });

  it('2. Manager persona: sees Manager Triage Queue, but NO Applicant submit or Admin control-plane', () => {
    renderWithAuth(
      <div>
        <NivaranNav />
        <NivaranWorkspaceCard />
      </div>,
      {
        isAuthenticated: true,
        isAuthority: true,
        isManager: true,
        authorityRole: 'MANAGER',
        authorityDesignation: 'Triage Manager',
        user: {
          id: 'manager-1',
          email: 'manager.phd@csjmu.ac.in',
          roles: ['authority'],
          authority_role: 'MANAGER',
        },
        persona: 'manager',
        displayName: 'Nivaran Triage Manager',
      }
    );

    // Should see Manager navigation link and workspace button
    expect(screen.getByRole('link', { name: /Manager Triage Queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manager Triage Queue/i })).toBeInTheDocument();

    // Must NOT see Applicant actions or other authority queues
    expect(screen.queryByRole('link', { name: /Submit Grievance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Grievances/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /\+ Submit Grievance/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Assigned Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cluster Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin Taxonomy & Authorities/i)).not.toBeInTheDocument();
  });

  it('3. Assistant Dean persona: sees Assigned Cases, but NO Manager triage or Applicant submit', () => {
    renderWithAuth(
      <div>
        <NivaranNav />
        <NivaranWorkspaceCard />
      </div>,
      {
        isAuthenticated: true,
        isAuthority: true,
        isAssistantDean: true,
        authorityRole: 'ASSISTANT_DEAN',
        authorityDesignation: 'Assistant Dean (Cluster 1)',
        user: {
          id: 'asst-dean-1',
          email: 'astdean.cluster1@csjmu.ac.in',
          roles: ['authority'],
          authority_role: 'ASSISTANT_DEAN',
        },
        persona: 'assistant_dean',
        displayName: 'Assistant Dean Cluster 1',
      }
    );

    // Should see Assistant Dean navigation link and card button
    expect(screen.getByRole('link', { name: /Assigned Cases/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Assigned Cases/i })).toBeInTheDocument();

    // Must NOT see other personas
    expect(screen.queryByRole('link', { name: /Submit Grievance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Grievances/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Manager Triage Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cluster Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin Taxonomy & Authorities/i)).not.toBeInTheDocument();
  });

  it('4. Associate Dean persona: sees Cluster Cases, but NO Manager triage or Applicant submit', () => {
    renderWithAuth(
      <div>
        <NivaranNav />
        <NivaranWorkspaceCard />
      </div>,
      {
        isAuthenticated: true,
        isAuthority: true,
        isAssociateDean: true,
        authorityRole: 'ASSOCIATE_DEAN',
        authorityDesignation: 'Associate Dean (Grievance Cluster 1)',
        user: {
          id: 'assoc-dean-1',
          email: 'assocdean.cluster1@csjmu.ac.in',
          roles: ['authority'],
          authority_role: 'ASSOCIATE_DEAN',
        },
        persona: 'associate_dean',
        displayName: 'Associate Dean Cluster 1',
      }
    );

    // Should see Associate Dean navigation link and card button
    expect(screen.getByRole('link', { name: /Cluster Cases/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cluster Cases/i })).toBeInTheDocument();

    // Must NOT see other personas
    expect(screen.queryByRole('link', { name: /Submit Grievance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Grievances/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Manager Triage Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assigned Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Queue/i)).not.toBeInTheDocument();
  });

  it('5. Dean persona: sees Executive Queue, but NO Manager triage or Applicant submit', () => {
    renderWithAuth(
      <div>
        <NivaranNav />
        <NivaranWorkspaceCard />
      </div>,
      {
        isAuthenticated: true,
        isAuthority: true,
        isDean: true,
        authorityRole: 'DEAN',
        authorityDesignation: 'Dean of Academic Affairs',
        user: {
          id: 'dean-1',
          email: 'dean.academic@csjmu.ac.in',
          roles: ['authority'],
          authority_role: 'DEAN',
        },
        persona: 'dean',
        displayName: 'Dean Academic Affairs',
      }
    );

    // Should see Dean navigation link and card button
    expect(screen.getByRole('link', { name: /Executive Queue/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Executive Cases/i })).toBeInTheDocument();

    // Must NOT see other personas
    expect(screen.queryByRole('link', { name: /Submit Grievance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Grievances/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Manager Triage Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assigned Cases/i)).not.toBeInTheDocument();
  });

  it('6. Admin persona (admin@csjmu.ac.in): sees Admin Taxonomy link, NO Applicant or Authority queues', () => {
    renderWithAuth(
      <div>
        <NivaranNav />
        <NivaranWorkspaceCard />
      </div>,
      {
        isAuthenticated: true,
        isAdmin: true,
        isAuthority: true, // Has authority role in DB, but authorityRole is null (no institutional authority appointment)
        authorityRole: null,
        user: {
          id: 'admin-1',
          email: 'admin@csjmu.ac.in',
          roles: ['administrator', 'authority'],
          authority_role: null,
        },
        persona: 'admin',
        displayName: 'VYASA Platform Admin',
      }
    );

    // Should see Admin control plane links (in nav and card)
    expect(screen.getByRole('link', { name: /Admin Taxonomy & Authorities/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Admin Taxonomy & Authorities/i })).toBeInTheDocument();

    // Must NOT see Applicant or Manager or Dean queues
    expect(screen.queryByRole('link', { name: /Submit Grievance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /My Grievances/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Manager Triage Queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Assigned Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cluster Cases/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Executive Queue/i)).not.toBeInTheDocument();
  });

  it('7. Route Guard: non-admin trying to access /admin is blocked by AdminRoute', () => {
    const authState: AuthContextModule.AuthContextValue = {
      user: {
        id: 'user-1',
        email: 'scholar@csjmu.ac.in',
        roles: ['applicant'],
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      isAdmin: false,
      isAuthority: false,
      isApplicant: true,
      isManager: false,
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      authorityRole: null,
      authorityId: null,
      authorityDesignation: null,
      persona: 'applicant',
      displayName: 'Scholar',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(authState);

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText(/Administrative Control Plane Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/Administrator Role Required/i)).toBeInTheDocument();
  });

  it('8. Route Guard: non-manager trying to access Manager queue is blocked by ManagerRoute', () => {
    const authState: AuthContextModule.AuthContextValue = {
      user: {
        id: 'user-1',
        email: 'admin@csjmu.ac.in',
        roles: ['administrator'],
      },
      token: 'valid-token',
      isAuthenticated: true,
      isLoading: false,
      isAdmin: true,
      isAuthority: false,
      isApplicant: false,
      isManager: false,
      isAssistantDean: false,
      isAssociateDean: false,
      isDean: false,
      authorityRole: null,
      authorityId: null,
      authorityDesignation: null,
      persona: 'admin',
      displayName: 'Admin User',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    };

    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(authState);

    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/manager/queue']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByText(/Triage Command Center Restricted/i)).toBeInTheDocument();
    expect(screen.getByText(/Triage Manager Role Required/i)).toBeInTheDocument();
  });
});
