import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VyasaDashboardPage } from '../VyasaDashboardPage';
import * as AuthContextModule from '../../../context/AuthContext';
import { AuthenticatedUser } from '../../../types/auth';
import { grievanceService } from '../../../modules/atharva-veda/nivaran/services/grievanceService';

const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
  const defaultAuth: AuthContextModule.AuthContextValue = {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    hasRole: vi.fn(),
    hasAuthorityRole: vi.fn(),
    isSuperAdmin: false,
    isAdmin: false,
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
    displayName: 'Unknown User',
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

describe('VyasaDashboardPage - Refactored Ecosystem Dashboard Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Authenticated dashboard renders cleanly with welcome banner and academic session', () => {
    mockAuth({
      isAuthenticated: true,
      displayName: 'Dr. Test Authority',
      user: {
        id: 'user-1',
        email: 'authority@csjmu.ac.in',
        first_name: 'Dr. Test',
        last_name: 'Authority',
        roles: ['authority'],
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('dashboard-welcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-welcome-heading')).toHaveTextContent('Welcome, Dr. Test Authority');
    expect(screen.getByText(/Chhatrapati Shahu Ji Maharaj University/i)).toBeInTheDocument();
    expect(screen.getByText('2026–27')).toBeInTheDocument();
  });

  it('2. Compact identity summary displays accurate name and email', () => {
    mockAuth({
      isAuthenticated: true,
      displayName: 'Prof. Namita Tiwari',
      isDean: true,
      authorityDesignation: 'Dean R&D',
      user: {
        id: 'dean-1',
        email: 'namita.tiwari@csjmu.ac.in',
        first_name: 'Namita',
        last_name: 'Tiwari',
        roles: ['authority'],
        phone: '+91 9876543210',
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('compact-identity-summary')).toBeInTheDocument();
    expect(screen.getByTestId('profile-full-name')).toHaveTextContent('Prof. Namita Tiwari');
    expect(screen.getByTestId('profile-email')).toHaveTextContent('namita.tiwari@csjmu.ac.in');
  });

  it('3. Phone number is displayed in compact summary when present', () => {
    mockAuth({
      isAuthenticated: true,
      displayName: 'Aarav Sharma',
      isApplicant: true,
      user: {
        id: 'appl-1',
        email: 'aarav@csjmu.ac.in',
        roles: ['applicant'],
        phone: '+91 9811223344',
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-phone')).toHaveTextContent('+91 9811223344');
  });

  it('4. Phone number shows "Not provided" gracefully when absent', () => {
    mockAuth({
      isAuthenticated: true,
      displayName: 'Aarav Sharma',
      isApplicant: true,
      user: {
        id: 'appl-1',
        email: 'aarav@csjmu.ac.in',
        roles: ['applicant'],
        phone: null,
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-phone')).toHaveTextContent('Not provided');
  });

  it('5. Clicking "View Full Profile" navigates to /profile', () => {
    mockAuth({
      isAuthenticated: true,
      displayName: 'Aarav Sharma',
      isApplicant: true,
      user: {
        id: 'appl-1',
        email: 'aarav@csjmu.ac.in',
        roles: ['applicant'],
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<VyasaDashboardPage />} />
          <Route path="/profile" element={<div data-testid="profile-destination">Profile Dossier Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const profileBtn = screen.getByTestId('view-full-profile-btn');
    expect(profileBtn).toBeInTheDocument();
    fireEvent.click(profileBtn);

    expect(screen.getByTestId('profile-destination')).toBeInTheDocument();
  });

  it('6. Redundant grievance summary cards (My Grievances, Action Required, Resolved) are ABSENT from ecosystem dashboard', () => {
    mockAuth({
      isAuthenticated: true,
      isApplicant: true,
      displayName: 'Scholar User',
      user: {
        id: 'appl-1',
        email: 'scholar@csjmu.ac.in',
        roles: ['applicant'],
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    // Verify grievance summary telemetry metric cards are removed
    expect(screen.queryByText('Submitted dossiers')).not.toBeInTheDocument();
    expect(screen.queryByText('Awaiting your response')).not.toBeInTheDocument();
    expect(screen.queryByText('Successfully closed')).not.toBeInTheDocument();

    // Verify top-level ecosystem indicator is present instead
    expect(screen.getByTestId('ecosystem-services-indicator')).toBeInTheDocument();
    expect(screen.getByText(/Active Ecosystem Services/i)).toBeInTheDocument();
  });

  it('7. Service Launcher prominently features NIVARAN-AI and navigates via persona-aware destination', () => {
    mockAuth({
      isAuthenticated: true,
      isDean: true,
      displayName: 'Prof. Namita Tiwari',
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean R&D',
      user: {
        id: 'dean-1',
        email: 'dean.rd@csjmu.ac.in',
        roles: ['authority'],
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<VyasaDashboardPage />} />
          <Route path="/modules/atharva-veda/nivaran/dean/dashboard" element={<div data-testid="dean-dest">Dean Executive Command Center</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('service-card-nivaran')).toBeInTheDocument();
    expect(screen.getByText('AI-Assisted Grievance Redressal & Dispute Resolution')).toBeInTheDocument();
    expect(screen.queryByText('View All Services')).not.toBeInTheDocument();

    const serviceBtn = screen.getByTestId('open-service-btn-nivaran');
    fireEvent.click(serviceBtn);

    expect(screen.getByTestId('dean-dest')).toBeInTheDocument();
  });

  it('8. Recent Grievances table is ABSENT from ecosystem dashboard', () => {
    mockAuth({
      isAuthenticated: true,
      isApplicant: true,
      displayName: 'Scholar User',
      user: {
        id: 'appl-1',
        email: 'scholar@csjmu.ac.in',
        roles: ['applicant'],
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('Recent Grievances')).not.toBeInTheDocument();
    expect(screen.queryByText('Tracking ID')).not.toBeInTheDocument();
    expect(screen.queryByText('Assigned Authority')).not.toBeInTheDocument();
  });

  it('9. Technical telemetry strip is ABSENT for regular users but visible for Admin', () => {
    // 1. Regular user (Dean)
    mockAuth({
      isAuthenticated: true,
      isDean: true,
      isAdmin: false,
      displayName: 'Dean Tiwari',
      user: {
        id: 'dean-1',
        roles: ['authority'],
      },
    });

    const { unmount } = render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('card-telemetry')).not.toBeInTheDocument();
    unmount();

    // 2. Admin user
    mockAuth({
      isAuthenticated: true,
      isAdmin: true,
      displayName: 'Admin Officer',
      user: {
        id: 'admin-1',
        roles: ['admin'],
      },
    });

    render(
      <MemoryRouter>
        <VyasaDashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-telemetry')).toBeInTheDocument();
  });

  it('10. Renders compact attention banner when applicant has grievances requiring action', async () => {
    vi.spyOn(grievanceService, 'getMyGrievances').mockResolvedValue([
      {
        id: 'grv-1',
        grievance_id: 'GRV-2026-001',
        title: 'Document Clarification Needed',
        status: 'CLARIFICATION_REQUESTED',
        priority: 'HIGH',
        category_name: 'Academic',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any,
    ]);

    mockAuth({
      isAuthenticated: true,
      isApplicant: true,
      displayName: 'Scholar Neha',
      user: {
        id: 'appl-neha',
        roles: ['applicant'],
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<VyasaDashboardPage />} />
          <Route path="/modules/atharva-veda/nivaran/my-grievances" element={<div data-testid="my-grievances-dest">My Grievances</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('grievance-attention-banner')).toBeInTheDocument();
      expect(screen.getByText(/Action Required in NIVARAN-AI/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View in NIVARAN-AI/i }));
    expect(screen.getByTestId('my-grievances-dest')).toBeInTheDocument();
  });
});
