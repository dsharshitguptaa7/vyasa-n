import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as AuthContextModule from '../../../../context/AuthContext';
import { phase6dService } from '../services/phase6dService';
import { NivaranEFilesPage } from '../pages/NivaranEFilesPage';
import { StudentMasterRecordsPage } from '../pages/StudentMasterRecordsPage';
import { StudentMasterRecordDetailPage } from '../pages/StudentMasterRecordDetailPage';
import { StudentRecordSearchPage } from '../pages/StudentRecordSearchPage';
import { AppRoutes } from '../../../../App';
import { Navbar } from '../../../../components/common/Navbar';

// Mock phase6dService
vi.mock('../services/phase6dService', () => ({
  phase6dService: {
    getMyEFiles: vi.fn(),
    listAuthorityEFiles: vi.fn(),
    getEFileDetail: vi.fn(),
    verifyEFile: vi.fn(),
    getDownloadUrl: vi.fn((id: string) => `/api/modules/atharva-veda/nivaran/e-files/${id}/download`),
    getMyStudentRecord: vi.fn(),
    searchStudentRecords: vi.fn(),
    getStudentRecordDetail: vi.fn(),
  },
}));

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

describe('Phase 6D Frontend: Global E-Files & Student Master Records Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // 1. Applicant Persona Tests
  // ==========================================
  describe('Applicant Persona', () => {
    const applicantUser = {
      id: 'app-user-1',
      email: 'scholar@csjmu.ac.in',
      first_name: 'Scholar',
      last_name: 'Kumar',
      roles: ['applicant'],
    };

    const mockEFile = {
      id: 'efile-1',
      e_file_number: 'NVR/EF/2026/000001',
      grievance_id: 'grv-1',
      grievance_ref: 'CSJMU-2026-ABCD1',
      grievance_title: 'Discrepancy in Coursework Grade',
      applicant_vyasa_user_id: 'app-user-1',
      applicant_name: 'Scholar Kumar',
      student_record_id: 'smr-1',
      student_record_number: 'SERF-PHD2026001',
      status: 'FINALIZED',
      content_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
      page_count: 4,
      is_sealed: true,
      sealed_at: '2026-10-01T10:00:00Z',
      created_at: '2026-10-01T10:00:00Z',
      documents: [],
    };

    const mockSMR = {
      id: 'smr-1',
      record_number: 'SERF-PHD2026001',
      student_vyasa_user_id: 'app-user-1',
      full_name_snapshot: 'Scholar Kumar',
      email_snapshot: 'scholar@csjmu.ac.in',
      mobile_snapshot: '9876543210',
      registration_number_snapshot: 'PHD2026001',
      enrollment_number_snapshot: 'CSJMU2026ENR01',
      subject_id: 'sub-1',
      subject_name: 'Computer Science',
      status: 'ACTIVE',
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-10-01T10:00:00Z',
      grievances: [
        {
          id: 'grv-1',
          grievance_id: 'CSJMU-2026-ABCD1',
          title: 'Discrepancy in Coursework Grade',
          status: 'CLOSED',
          priority: 'MEDIUM',
          category_name: 'Examination',
          created_at: '2026-09-15T00:00:00Z',
          closed_at: '2026-10-01T10:00:00Z',
        },
      ],
      efiles: [
        {
          id: 'efile-1',
          e_file_number: 'NVR/EF/2026/000001',
          grievance_id: 'grv-1',
          grievance_ref: 'CSJMU-2026-ABCD1',
          status: 'FINALIZED',
          page_count: 4,
          content_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
          is_sealed: true,
          sealed_at: '2026-10-01T10:00:00Z',
          created_at: '2026-10-01T10:00:00Z',
        },
      ],
    };

    it('1. Applicant: E-Files page renders own sealed dossiers and does not show authority search input', async () => {
      mockAuth({
        isAuthenticated: true,
        isApplicant: true,
        user: applicantUser,
        displayName: 'Scholar Kumar',
      });
      vi.mocked(phase6dService.getMyEFiles).mockResolvedValue([mockEFile]);

      render(
        <MemoryRouter>
          <NivaranEFilesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('My Official Sealed E-Files')).toBeInTheDocument();
      });

      expect(screen.getByText('NVR/EF/2026/000001')).toBeInTheDocument();
      expect(screen.getByText('Discrepancy in Coursework Grade')).toBeInTheDocument();
      // Applicant must NOT see authority search input
      expect(screen.queryByPlaceholderText(/Search by E-File number/i)).not.toBeInTheDocument();
      // Verify download button presence
      expect(screen.getByRole('link', { name: /Download Official PDF/i })).toHaveAttribute(
        'href',
        '/api/modules/atharva-veda/nivaran/e-files/efile-1/download'
      );
    });

    it('2. Applicant: Verify Seal invokes cryptographic verification and renders green badge', async () => {
      mockAuth({
        isAuthenticated: true,
        isApplicant: true,
        user: applicantUser,
        displayName: 'Scholar Kumar',
      });
      vi.mocked(phase6dService.getMyEFiles).mockResolvedValue([mockEFile]);
      vi.mocked(phase6dService.verifyEFile).mockResolvedValue({
        e_file_number: 'NVR/EF/2026/000001',
        is_valid: true,
        calculated_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
        stored_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
        is_sealed: true,
        algorithm: 'SHA-256',
      });

      render(
        <MemoryRouter>
          <NivaranEFilesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('NVR/EF/2026/000001')).toBeInTheDocument();
      });

      const verifyBtn = screen.getByRole('button', { name: /Verify Seal/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Integrity Verified:/i)).toBeInTheDocument();
      });
      expect(phase6dService.verifyEFile).toHaveBeenCalledWith('efile-1');
    });

    it('3. Applicant: Student Master Record route renders own record directly without search bar', async () => {
      mockAuth({
        isAuthenticated: true,
        isApplicant: true,
        user: applicantUser,
        displayName: 'Scholar Kumar',
      });
      vi.mocked(phase6dService.getMyStudentRecord).mockResolvedValue(mockSMR);

      render(
        <MemoryRouter>
          <StudentMasterRecordsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('SERF-PHD2026001')).toBeInTheDocument();
      });

      expect(screen.getByText('Scholar Kumar')).toBeInTheDocument();
      expect(screen.getByText('PHD2026001')).toBeInTheDocument();
      // Must NOT render directory search bar
      expect(screen.queryByPlaceholderText(/Enter Registration No/i)).not.toBeInTheDocument();
      // Should show linked grievances
      expect(screen.getByText('Discrepancy in Coursework Grade')).toBeInTheDocument();
    });
  });

  // ==========================================
  // 2. Authority Persona Tests (Manager / Deans)
  // ==========================================
  describe('Manager & Authority Personas', () => {
    const managerUser = {
      id: 'mgr-user-1',
      email: 'manager@csjmu.ac.in',
      first_name: 'Dr. Manager',
      last_name: 'Tiwari',
      roles: ['authority'],
    };

    it('4. Manager: E-Files page provides authority search bar and lists jurisdictional E-Files', async () => {
      mockAuth({
        isAuthenticated: true,
        isAuthority: true,
        isManager: true,
        user: managerUser,
        displayName: 'Dr. Manager Tiwari',
      });

      vi.mocked(phase6dService.listAuthorityEFiles).mockResolvedValue({
        items: [
          {
            id: 'efile-2',
            e_file_number: 'NVR/EF/2026/000002',
            grievance_id: 'grv-2',
            grievance_ref: 'CSJMU-2026-FELLW1',
            grievance_title: 'Fellowship Stipend Delay',
            applicant_vyasa_user_id: 'app-user-2',
            applicant_name: 'Amit Sharma',
            student_record_id: 'smr-2',
            student_record_number: 'SERF-PHD2026002',
            status: 'FINALIZED',
            content_hash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            page_count: 3,
            is_sealed: true,
            sealed_at: '2026-10-01T11:00:00Z',
            created_at: '2026-10-01T11:00:00Z',
            documents: [],
          },
        ],
        total: 1,
        page: 1,
        page_size: 15,
        total_pages: 1,
      });

      render(
        <MemoryRouter>
          <NivaranEFilesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Institutional Digital E-Files Archive')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText(/Search by E-File number/i)).toBeInTheDocument();
      expect(screen.getByText('NVR/EF/2026/000002')).toBeInTheDocument();
      expect(screen.getByText('Fellowship Stipend Delay')).toBeInTheDocument();
    });

    it('5. Authority: Student Records directory search queries records and navigates to detail dossier', async () => {
      mockAuth({
        isAuthenticated: true,
        isAuthority: true,
        isAssistantDean: true,
        user: {
          id: 'asst-user-1',
          email: 'asstdean@csjmu.ac.in',
          first_name: 'Dr. Ankit',
          last_name: 'Trivedi',
          roles: ['authority'],
        },
      });

      vi.mocked(phase6dService.searchStudentRecords).mockResolvedValue({
        items: [
          {
            id: 'smr-target-1',
            record_number: 'SERF-PHD2026099',
            student_vyasa_user_id: 'student-99',
            full_name_snapshot: 'Rajesh Verma',
            email_snapshot: 'rajesh@csjmu.ac.in',
            registration_number_snapshot: 'PHD2026099',
            enrollment_number_snapshot: 'CSJMU2026099',
            subject_id: 'sub-cs',
            subject_name: 'Computer Science',
            status: 'ACTIVE',
            total_grievances: 2,
            open_grievances: 0,
            resolved_grievances: 0,
            closed_grievances: 2,
            total_efiles: 2,
            created_at: '2026-09-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        page_size: 15,
      });

      render(
        <MemoryRouter>
          <StudentRecordSearchPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Student Master Records Directory')).toBeInTheDocument();
      const input = screen.getByPlaceholderText(/Enter Registration No/i);
      fireEvent.change(input, { target: { value: 'Rajesh' } });
      const searchBtn = screen.getByRole('button', { name: /Search Records/i });
      fireEvent.click(searchBtn);

      await waitFor(() => {
        expect(screen.getByText('SERF-PHD2026099')).toBeInTheDocument();
      });

      expect(screen.getByText('Rajesh Verma')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /View Master Record →/i })).toBeInTheDocument();
    });

    it('6. Authority: Master Record detail renders student dossier metrics, history, and sealed E-Files', async () => {
      mockAuth({
        isAuthenticated: true,
        isAuthority: true,
        isDean: true,
        user: {
          id: 'dean-user-1',
          email: 'dean@csjmu.ac.in',
          first_name: 'Dr. Dean',
          last_name: 'Academics',
          roles: ['authority'],
        },
      });

      vi.mocked(phase6dService.getStudentRecordDetail).mockResolvedValue({
        id: 'smr-detail-1',
        record_number: 'SERF-PHD2026500',
        student_vyasa_user_id: 'student-500',
        full_name_snapshot: 'Meera Patel',
        email_snapshot: 'meera@csjmu.ac.in',
        mobile_snapshot: '9998887776',
        registration_number_snapshot: 'PHD2026500',
        enrollment_number_snapshot: 'CSJMU2026500',
        subject_id: 'sub-biotech',
        subject_name: 'Biotechnology',
        status: 'ACTIVE',
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-10-01T00:00:00Z',
        grievances: [
          {
            id: 'grv-bio-1',
            grievance_id: 'CSJMU-2026-BIO1',
            title: 'Lab Access During Semester Break',
            status: 'CLOSED',
            priority: 'HIGH',
            category_name: 'Facilities',
            created_at: '2026-09-10T00:00:00Z',
            closed_at: '2026-09-20T00:00:00Z',
          },
        ],
        efiles: [
          {
            id: 'efile-bio-1',
            e_file_number: 'NVR/EF/2026/000050',
            grievance_id: 'grv-bio-1',
            grievance_ref: 'CSJMU-2026-BIO1',
            status: 'FINALIZED',
            page_count: 5,
            content_hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            is_sealed: true,
            sealed_at: '2026-09-20T00:00:00Z',
            created_at: '2026-09-20T00:00:00Z',
          },
        ],
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/student-records/smr-detail-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/student-records/:id"
              element={<StudentMasterRecordDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Official Student Master Record Dossier')).toBeInTheDocument();
      });

      expect(screen.getByText('SERF-PHD2026500')).toBeInTheDocument();
      expect(screen.getByText('Meera Patel')).toBeInTheDocument();
      expect(screen.getByText('Lab Access During Semester Break')).toBeInTheDocument();
      expect(screen.getByText('NVR/EF/2026/000050')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Download Dossier ↓/i })).toBeInTheDocument();
    });
  });

  // ==========================================
  // 3. Platform Admin Boundary Protection
  // ==========================================
  describe('Platform Admin Separation', () => {
    it('7. Admin without authority role receives Access Restricted banner on E-Files page', async () => {
      mockAuth({
        isAuthenticated: true,
        isAdmin: true,
        isAuthority: false,
        isApplicant: false,
        user: {
          id: 'admin-user-1',
          email: 'admin@csjmu.ac.in',
          first_name: 'Sys',
          last_name: 'Admin',
          roles: ['administrator'],
        },
      });

      render(
        <MemoryRouter>
          <NivaranEFilesPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(
        screen.getByText(/Platform Administrators do not automatically inherit case-level grievance or E-File dossier access/i)
      ).toBeInTheDocument();
    });

    it('8. Admin without authority role receives Access Restricted banner on Student Master Record detail page', async () => {
      mockAuth({
        isAuthenticated: true,
        isAdmin: true,
        isAuthority: false,
        isApplicant: false,
        user: {
          id: 'admin-user-1',
          email: 'admin@csjmu.ac.in',
          first_name: 'Sys',
          last_name: 'Admin',
          roles: ['administrator'],
        },
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/student-records/some-id']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/student-records/:id"
              element={<StudentMasterRecordDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(
        screen.getByText(/Platform Administrators do not automatically inherit case-level grievance or Student Master Record access/i)
      ).toBeInTheDocument();
    });
  });

  // ==========================================
  // 5. Global Top Navbar Visibility Verification
  // ==========================================
  describe('Global Top Navbar Persona Visibility (Navbar.tsx)', () => {
    it('renders "My E-Files" and "My Student Record" for Applicant in NIVARAN shell', () => {
      mockAuth({
        isAuthenticated: true,
        isApplicant: true,
        displayName: 'Rahul Sharma',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/my-grievances']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText('My Grievances')).toBeInTheDocument();
      expect(screen.getByText('Submit Grievance')).toBeInTheDocument();
      expect(screen.getByText('My E-Files')).toBeInTheDocument();
      expect(screen.getByText('My Student Record')).toBeInTheDocument();
      expect(screen.getByText('Scholar Profile')).toBeInTheDocument();
    });

    it('renders "Closure Review", "E-Files", and "Student Records" for Manager in NIVARAN shell', () => {
      mockAuth({
        isAuthenticated: true,
        isManager: true,
        isAuthority: true,
        displayName: 'Dr. Triage Manager',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/manager/queue']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText('Triage Queue')).toBeInTheDocument();
      expect(screen.getByText('Closure Review')).toBeInTheDocument();
      expect(screen.getByText('E-Files')).toBeInTheDocument();
      expect(screen.getByText('Student Records')).toBeInTheDocument();
    });

    it('renders "E-Files" and "Student Records" for Assistant Dean in NIVARAN shell', () => {
      mockAuth({
        isAuthenticated: true,
        isAssistantDean: true,
        isAuthority: true,
        displayName: 'Dr. Assistant Dean',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/assistant-dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText('Jurisdictional Docket')).toBeInTheDocument();
      expect(screen.getByText('Assigned Cases')).toBeInTheDocument();
      expect(screen.getByText('E-Files')).toBeInTheDocument();
      expect(screen.getByText('Student Records')).toBeInTheDocument();
    });

    it('renders "E-Files" and "Student Records" for Associate Dean in NIVARAN shell', () => {
      mockAuth({
        isAuthenticated: true,
        isAssociateDean: true,
        isAuthority: true,
        displayName: 'Prof. Associate Dean',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/associate-dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText('Executive Docket')).toBeInTheDocument();
      expect(screen.getByText('Cluster Cases')).toBeInTheDocument();
      expect(screen.getByText('E-Files')).toBeInTheDocument();
      expect(screen.getByText('Student Records')).toBeInTheDocument();
    });

    it('renders "E-Files" and "Student Records" for Dean in NIVARAN shell', () => {
      mockAuth({
        isAuthenticated: true,
        isDean: true,
        isAuthority: true,
        displayName: 'Prof. Dean R&D',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/dean/dashboard']}>
          <Navbar />
        </MemoryRouter>
      );

      expect(screen.getByText('Executive Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Executive Queue')).toBeInTheDocument();
      expect(screen.getByText('E-Files')).toBeInTheDocument();
      expect(screen.getByText('Student Records')).toBeInTheDocument();
    });
  });
});
