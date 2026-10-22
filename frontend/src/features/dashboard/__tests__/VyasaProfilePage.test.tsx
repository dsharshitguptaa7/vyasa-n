import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VyasaProfilePage } from '../VyasaProfilePage';
import * as AuthContextModule from '../../../context/AuthContext';
import { AuthenticatedUser } from '../../../types/auth';

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

describe('VyasaProfilePage - Dedicated My Profile & Official Academic Dossier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Renders profile page header, breadcrumbs, and back to dashboard button', () => {
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
      <MemoryRouter initialEntries={['/profile']}>
        <Routes>
          <Route path="/profile" element={<VyasaProfilePage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/My Institutional Profile/i)).toBeInTheDocument();
    const backBtn = screen.getByTestId('profile-back-to-dashboard-btn');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
  });

  it('2. User name and email are displayed accurately from authentic user data', () => {
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
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-personal-info')).toBeInTheDocument();
    expect(screen.getByTestId('profile-full-name')).toHaveTextContent('Prof. Namita Tiwari');
    expect(screen.getByTestId('profile-email')).toHaveTextContent('namita.tiwari@csjmu.ac.in');
  });

  it('3. Phone number is displayed when present in user profile', () => {
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
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-phone')).toHaveTextContent('+91 9811223344');
  });

  it('4. Phone number shows "Not provided" gracefully when absent without breaking layout', () => {
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
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('profile-phone')).toHaveTextContent('Not provided');
  });

  it('5. Academic profile fields display correctly for Applicant/Scholar persona', () => {
    const scholarUser: AuthenticatedUser = {
      id: 'scholar-1',
      email: 'scholar@csjmu.ac.in',
      first_name: 'Rahul',
      last_name: 'Verma',
      roles: ['applicant'],
      phone: '+91 9123456780',
      department: 'Computer Science & Engineering',
      subject_name: 'Artificial Intelligence',
      phd_registration_number: 'PHD-CSE-2024-0042',
      enrollment_number: 'CSJMU-ENR-8899',
      scholar_record_number: 'SCH-2024-001',
    };

    mockAuth({
      isAuthenticated: true,
      isApplicant: true,
      displayName: 'Rahul Verma',
      user: scholarUser,
    });

    render(
      <MemoryRouter>
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-academic-profile')).toBeInTheDocument();
    expect(screen.getByTestId('scholar-programme')).toHaveTextContent('Ph.D. Research Scholar');
    expect(screen.getByTestId('scholar-department')).toHaveTextContent('Computer Science & Engineering');
    expect(screen.getByTestId('scholar-subject')).toHaveTextContent('Artificial Intelligence');
    expect(screen.getByTestId('scholar-registration')).toHaveTextContent('PHD-CSE-2024-0042');
    expect(screen.getByTestId('scholar-enrollment')).toHaveTextContent('CSJMU-ENR-8899');
    expect(screen.getByTestId('scholar-record-id')).toHaveTextContent('SCH-2024-001');
    expect(screen.queryByTestId('card-institutional-identity')).not.toBeInTheDocument();
  });

  it('6. Institutional Identity card displays for Assistant Dean with Subject Cluster jurisdiction', () => {
    const asstDeanUser: AuthenticatedUser = {
      id: 'asst-1',
      email: 'asst.dean@csjmu.ac.in',
      first_name: 'Dr. Vivek',
      last_name: 'Mishra',
      roles: ['authority'],
      authority_role: 'ASSISTANT_DEAN',
      authority_designation: 'Assistant Dean (Engineering)',
      authority_department: 'Department of Physical Sciences',
      assigned_cluster_name: 'Engineering & Technology',
      assigned_cluster_number: 1,
    };

    mockAuth({
      isAuthenticated: true,
      isAssistantDean: true,
      authorityRole: 'ASSISTANT_DEAN',
      authorityDesignation: 'Assistant Dean (Engineering)',
      displayName: 'Dr. Vivek Mishra',
      user: asstDeanUser,
    });

    render(
      <MemoryRouter>
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-institutional-identity')).toBeInTheDocument();
    expect(screen.getByTestId('authority-designation')).toHaveTextContent('Assistant Dean (Engineering)');
    expect(screen.getByTestId('authority-type')).toHaveTextContent('Assistant Dean (Stage-1 Subject Redressal Authority)');
    expect(screen.getByTestId('authority-department')).toHaveTextContent('Department of Physical Sciences');
    expect(screen.getByTestId('authority-jurisdiction')).toHaveTextContent('Subject Cluster: Engineering & Technology (Cluster 1)');
    expect(screen.queryByTestId('card-academic-profile')).not.toBeInTheDocument();
  });

  it('7. Institutional Identity card displays for Associate Dean with Grievance Cluster jurisdiction', () => {
    const assocDeanUser: AuthenticatedUser = {
      id: 'assoc-1',
      email: 'assoc.dean@csjmu.ac.in',
      first_name: 'Dr. Sunita',
      last_name: 'Rao',
      roles: ['authority'],
      authority_role: 'ASSOCIATE_DEAN',
      authority_designation: 'Associate Dean (Grievances)',
      authority_department: 'Office of the Associate Dean, R&D',
      assigned_cluster_name: 'Academic & Administrative Grievances',
      assigned_cluster_number: 2,
    };

    mockAuth({
      isAuthenticated: true,
      isAssociateDean: true,
      authorityRole: 'ASSOCIATE_DEAN',
      authorityDesignation: 'Associate Dean (Grievances)',
      displayName: 'Dr. Sunita Rao',
      user: assocDeanUser,
    });

    render(
      <MemoryRouter>
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-institutional-identity')).toBeInTheDocument();
    expect(screen.getByTestId('authority-type')).toHaveTextContent('Associate Dean (Stage-2 Category Redressal Authority)');
    expect(screen.getByTestId('authority-jurisdiction')).toHaveTextContent('Grievance Cluster: Academic & Administrative Grievances (Cluster 2)');
  });

  it('8. Institutional Identity card displays for Dean with University-Wide Jurisdiction', () => {
    const deanUser: AuthenticatedUser = {
      id: 'dean-1',
      email: 'dean.rd@csjmu.ac.in',
      first_name: 'Prof. Namita',
      last_name: 'Tiwari',
      roles: ['authority'],
      authority_role: 'DEAN',
      authority_designation: 'Dean R&D',
    };

    mockAuth({
      isAuthenticated: true,
      isDean: true,
      authorityRole: 'DEAN',
      authorityDesignation: 'Dean R&D',
      displayName: 'Prof. Namita Tiwari',
      user: deanUser,
    });

    render(
      <MemoryRouter>
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-institutional-identity')).toBeInTheDocument();
    expect(screen.getByTestId('authority-jurisdiction')).toHaveTextContent('University-Wide Academic & Research Redressal Jurisdiction');
  });

  it('9. Account & Access Security card renders Active, Verified, and Issuer details', () => {
    mockAuth({
      isAuthenticated: true,
      displayName: 'Prof. Namita Tiwari',
      isDean: true,
      authorityDesignation: 'Dean R&D',
      user: {
        id: 'dean-1',
        email: 'dean.rd@csjmu.ac.in',
        roles: ['authority'],
        is_active: true,
        is_verified: true,
      },
    });

    render(
      <MemoryRouter>
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('card-access-security')).toBeInTheDocument();
    expect(screen.getByTestId('account-status')).toHaveTextContent('Active');
    expect(screen.getByTestId('identity-verification-status')).toHaveTextContent('Verified Institutional Account');
    expect(screen.getByTestId('platform-issuer')).toHaveTextContent(/CSJMU VYASA.*Core/);
  });

  it('10. Sensitive fields (passwords, tokens, secret keys) are NEVER rendered', () => {
    const sensitiveUser: any = {
      id: 'user-sensitive',
      email: 'user@csjmu.ac.in',
      password: 'SuperSecretPassword123!',
      password_hash: '$2b$12$eX4mpleHashDoNotExposeEver',
      access_token: 'secret-token-xyz-12345',
      token: 'jwt-raw-secret-string',
      roles: ['applicant'],
    };

    mockAuth({
      isAuthenticated: true,
      isApplicant: true,
      displayName: 'Applicant User',
      user: sensitiveUser,
    });

    const { container } = render(
      <MemoryRouter>
        <VyasaProfilePage />
      </MemoryRouter>
    );

    expect(container.textContent).not.toContain('SuperSecretPassword123!');
    expect(container.textContent).not.toContain('$2b$12$eX4mpleHashDoNotExposeEver');
    expect(container.textContent).not.toContain('secret-token-xyz-12345');
    expect(container.textContent).not.toContain('jwt-raw-secret-string');
  });
});
