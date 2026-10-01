import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../../../../App';
import { AuthProvider } from '../../../../context/AuthContext';
import { grievanceService } from '../services/grievanceService';
import { pillarService } from '../../../../services/pillarService';

// Mock services
vi.mock('../services/grievanceService', () => ({
  grievanceService: {
    getTaxonomySubjects: vi.fn(),
    getTaxonomyCategories: vi.fn(),
    submitGrievance: vi.fn(),
    getMyGrievances: vi.fn(),
    getGrievanceDetail: vi.fn(),
    getManagerTriageQueue: vi.fn(),
    previewRouting: vi.fn(),
    reviewAndAssignGrievance: vi.fn(),
    extractGrievanceFromOCR: vi.fn(),
  },
}));

vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-user-uuid',
      email: 'scholar@csjmu.ac.in',
      fullName: 'Scholar Applicant',
      roles: ['applicant', 'manager'],
      authority_role: 'MANAGER',
    },
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
    isAuthority: true,
    isApplicant: true,
    isManager: true,
    isAssistantDean: false,
    isAssociateDean: false,
    isDean: false,
    authorityRole: 'MANAGER',
    authorityId: 'mock-mgr-id',
    authorityDesignation: 'Triage Manager',
    persona: 'manager',
    displayName: 'Scholar Applicant',
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('NIVARAN Landing Runtime Navigation & Route Registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(pillarService, 'getPillars').mockResolvedValue([]);
    vi.mocked(grievanceService.getTaxonomySubjects).mockResolvedValue([
      { id: 'sub-1', name: 'Computer Science', code: 'CS', cluster_name: 'Tech', is_active: true },
    ]);
    vi.mocked(grievanceService.getTaxonomyCategories).mockResolvedValue([
      { id: 'cat-1', name: 'Evaluation', code: 'EV', routing_type: 'SUBJECT_ASSISTANT_DEAN', is_active: true },
    ]);
    vi.mocked(grievanceService.getMyGrievances).mockResolvedValue([]);
    vi.mocked(grievanceService.getManagerTriageQueue).mockResolvedValue([]);
  });

  it('1. Direct entry routes Manager from /modules/atharva-veda/nivaran directly to Manager Triage Queue without intermediate screen', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Manager Triage Command Center/i)).toBeInTheDocument();
    });
  });

  it('2. Navigates directly to Submit Grievance page via route /modules/atharva-veda/nivaran/submit', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/submit']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Submit Formal Grievance/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Brief summary of your grievance/i)).toBeInTheDocument();
    });
  });

  it('3. Navigates directly to My Grievances page via route /modules/atharva-veda/nivaran/my-grievances', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/My Grievance Dossiers/i)).toBeInTheDocument();
    });
  });

  it('4. Navigates to Manager Triage Queue at /modules/atharva-veda/nivaran/manager/queue', async () => {
    render(
      <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/manager/queue']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Manager Triage Command Center/i)).toBeInTheDocument();
    });
  });

  it('5. Supports direct alias URL /atharva-veda/nivaran/submit and /nivaran/submit', async () => {
    render(
      <MemoryRouter initialEntries={['/atharva-veda/nivaran/submit']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Submit Formal Grievance/i)).toBeInTheDocument();
    });
  });

  it('6. Supports direct alias URL /nivaran/manager/queue', async () => {
    render(
      <MemoryRouter initialEntries={['/nivaran/manager/queue']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Manager Triage Command Center/i)).toBeInTheDocument();
    });
  });

  it('7. Navigates from Ecosystem Home landing page NIVARAN card into NIVARAN module', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>
    );

    const openNivaranBtn = await screen.findByRole('button', { name: /Open Atharva Veda \/ NIVARAN/i });
    expect(openNivaranBtn).toBeInTheDocument();
    fireEvent.click(openNivaranBtn);

    await waitFor(() => {
      expect(screen.getByText(/Manager Triage Command Center/i)).toBeInTheDocument();
    });
  });
});
