import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '../App';
import { grievanceService } from '../modules/atharva-veda/nivaran/services/grievanceService';
import { anudaanService } from '../modules/yajur-veda/services/anudaanService';
import { phase6dService } from '../modules/atharva-veda/nivaran/services/phase6dService';

// Mock services
vi.mock('../modules/atharva-veda/nivaran/services/grievanceService', () => ({
  grievanceService: {
    getTaxonomySubjects: vi.fn().mockResolvedValue([]),
    getTaxonomyCategories: vi.fn().mockResolvedValue([]),
    getMyGrievances: vi.fn().mockResolvedValue([]),
    getManagerTriageQueue: vi.fn().mockResolvedValue([]),
    getAssistantDeanCases: vi.fn().mockResolvedValue([]),
    getGrievanceDocumentRequests: vi.fn().mockResolvedValue([]),
    getAssistantDeanGrievanceDetail: vi.fn().mockResolvedValue({
      id: 'GRIEV-101',
      grievance_id: 'GRIEV-101',
      status: 'UNDER_INVESTIGATION',
      category_name: 'Evaluation',
      description: 'Discrepancy in course evaluation score',
      subject_name: 'Computer Science',
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-02T12:00:00Z',
      applicant_name: 'Aditi Sharma',
      history: [],
      attachments: [],
      documents: [],
    }),
    getGrievanceDetail: vi.fn().mockResolvedValue({
      id: 'CASE-123',
      grievance_id: 'CASE-123',
      status: 'UNDER_INVESTIGATION',
      category_name: 'Evaluation',
      description: 'Discrepancy in course evaluation score',
      subject_name: 'Computer Science',
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-02T12:00:00Z',
      applicant_name: 'Aditi Sharma',
      history: [],
      attachments: [],
      documents: [],
    }),
  },
}));

vi.mock('../modules/atharva-veda/nivaran/services/phase6dService', () => ({
  phase6dService: {
    searchStudentRecords: vi.fn().mockResolvedValue({
      items: [
        {
          id: 'STU-001',
          full_name: 'Rahul Kumar',
          registration_number: 'REG-2026-001',
          enrollment_number: 'ENR-2026-001',
          academic_standing: 'GOOD',
          subject_name: 'Computer Science',
        },
      ],
      total: 1,
    }),
  },
}));

vi.mock('../modules/yajur-veda/services/anudaanService', () => ({
  anudaanService: {
    trackApplication: vi.fn().mockResolvedValue({
      success: true,
      data: {
        application_number: 'ANU-2026-8888',
        status: 'APPROVED_FOR_RELEASE',
        applicant_name: 'Dr. Vikram Verma',
        applicant_category: 'FACULTY_CAMPUS',
        department_name: 'Physics',
        submitted_at: '2026-08-15T10:00:00Z',
        publication_count: 1,
        publications: [
          {
            id: 'PUB-1',
            paper_title: 'Quantum Sensor Array Calibration',
            journal_name: 'Physical Review Letters',
            publication_year: 2026,
            applicant_declared_quartile: 'Q1',
            verified_quartile: 'Q1',
            indexing_type: 'SCOPUS_AND_WOS',
            document_type: 'ARTICLE',
          },
        ],
        last_updated: '2026-09-01T10:00:00Z',
        status_description: 'VC Sanctioned and approved for disbursement.',
      },
    }),
  },
  ApiError: class ApiError extends Error {
    statusCode = 400;
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-auth-id',
      email: 'authority@csjmu.ac.in',
      firstName: 'Dr. Authority',
      roles: ['applicant', 'assistant_dean', 'associate_dean', 'dean', 'manager'],
      authority_role: 'ASSISTANT_DEAN',
    },
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
    isAuthority: true,
    isApplicant: true,
    isManager: true,
    isAssistantDean: true,
    isAssociateDean: true,
    isDean: true,
    authorityRole: 'ASSISTANT_DEAN',
    authorityDesignation: 'Assistant Dean of Academics',
    displayName: 'Dr. Authority',
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Helper component to track active router location
const LocationTracker: React.FC<{ onChange: (loc: any) => void }> = ({ onChange }) => {
  const location = useLocation();
  React.useEffect(() => {
    onChange(location);
  }, [location, onChange]);
  return null;
};

describe('Phase 1: Routing & Navigation Harmonization Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Atharva Veda Canonical Routing & Legacy Redirects', () => {
    it('redirects legacy /modules/atharva-veda/nivaran/assistant-dean/dashboard to canonical /atharva-veda/assistant-dean/dashboard', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/assistant-dean/dashboard']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/assistant-dean/dashboard');
      });
    });

    it('redirects legacy shorthand /nivaran/assistant-dean/dashboard to canonical /atharva-veda/assistant-dean/dashboard', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/nivaran/assistant-dean/dashboard']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/assistant-dean/dashboard');
      });
    });

    it('redirects legacy /modules/atharva-veda/nivaran/submit to canonical /atharva-veda/submit', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/submit']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/submit');
      });
    });

    it('redirects legacy /nivaran/submit to canonical /atharva-veda/submit', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/nivaran/submit']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/submit');
      });
    });

    it('redirects parameter-based route /modules/atharva-veda/nivaran/grievance/CASE-123 to canonical /atharva-veda/grievance/CASE-123', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/grievance/CASE-123']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/grievance/CASE-123');
      });
    });
  });

  describe('2. Student Search Workflow & Query Parameter Preservation', () => {
    it('redirects /atharva-veda/student-records/search with query params to /atharva-veda/student-records preserving search query', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/atharva-veda/student-records/search?q=CSJMU2026']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/student-records');
        expect(currentLocation?.search).toBe('?q=CSJMU2026');
      });
    });

    it('redirects legacy /modules/atharva-veda/nivaran/student-records/search to /atharva-veda/student-records', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/student-records/search?searchTerm=Aditi']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/atharva-veda/student-records');
        expect(currentLocation?.search).toBe('?searchTerm=Aditi');
      });
    });
  });

  describe('3. Anudaan Sanction Letter Route Registration & Verification', () => {
    it('renders Anudaan Sanction Letter at /modules/yajur-veda/anudaan/sanction/:id inside WorkspaceShell', async () => {
      render(
        <MemoryRouter initialEntries={['/modules/yajur-veda/anudaan/sanction/ANU-2026-8888?secret=mock-secret-key-32-chars-long']}>
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/OFFICE OF THE DEAN OF RESEARCH & DEVELOPMENT/i)).toBeInTheDocument();
        expect(screen.getByText(/EXECUTIVE SANCTION ORDER/i)).toBeInTheDocument();
        expect(screen.getByText(/CSJMU\/R&D\/ANUDAAN\//i)).toBeInTheDocument();
      });
    });

    it('redirects /anudaan/sanction/:id to canonical /modules/yajur-veda/anudaan/sanction/:id', async () => {
      let currentLocation: any = null;
      render(
        <MemoryRouter initialEntries={['/anudaan/sanction/ANU-2026-8888']}>
          <LocationTracker onChange={(loc) => (currentLocation = loc)} />
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(currentLocation?.pathname).toBe('/modules/yajur-veda/anudaan/sanction/ANU-2026-8888');
      });
    });
  });

  describe('4. Assistant Dean & Authority Breadcrumb Navigation', () => {
    it('renders the complete institutional breadcrumb structure in AssistantDeanGrievanceDetailPage', async () => {
      render(
        <MemoryRouter initialEntries={['/atharva-veda/assistant-dean/grievances/GRIEV-101']}>
          <AppRoutes />
        </MemoryRouter>
      );

      await waitFor(() => {
        const breadcrumbNav = screen.getByLabelText('Breadcrumb');
        expect(breadcrumbNav).toBeInTheDocument();
        expect(breadcrumbNav).toHaveTextContent('Dashboard');
        expect(breadcrumbNav).toHaveTextContent('Atharva Veda');
        expect(breadcrumbNav).toHaveTextContent('Assistant Dean Desk');
        expect(breadcrumbNav).toHaveTextContent('Case #GRIEV-101');
      });
    });
  });
});
