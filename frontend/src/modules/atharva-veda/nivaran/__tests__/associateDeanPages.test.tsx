import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AssociateDeanDashboardPage } from '../pages/AssociateDeanDashboardPage';
import { AssociateDeanGrievanceDetailPage } from '../pages/AssociateDeanGrievanceDetailPage';
import { ForwardToDeanModal } from '../components/ForwardToDeanModal';
import { ResolveGrievanceModal } from '../components/ResolveGrievanceModal';
import { grievanceService } from '../services/grievanceService';
import {
  AssociateDeanDashboardStats,
  AssociateDeanGrievanceDetailResponse,
  AssociateDeanQueueResponse,
  GrievanceSummaryItem,
  RoutingPreviewResponse,
} from '../types/grievance';

// Mock grievanceService
vi.mock('../services/grievanceService', () => ({
  grievanceService: {
    getAssociateDeanDashboard: vi.fn(),
    getAssociateDeanGrievances: vi.fn(),
    getAssociateDeanGrievanceDetail: vi.fn(),
    resolveAssociateDeanGrievance: vi.fn(),
    forwardAssociateDeanGrievance: vi.fn(),
    requestAssociateDeanDocuments: vi.fn(),
    requestAssociateDeanCommittee: vi.fn(),
    getGrievanceDocumentRequests: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-user-assoc-dean',
      email: 'associatedean1@csjmu.ac.in',
      fullName: 'Dr. Sweta Pandey',
      roles: ['authority'],
    },
    isAuthority: true,
    isAssociateDean: true,
    isApplicant: false,
    isAdmin: false,
    isManager: false,
    isAssistantDean: false,
    isDean: false,
    authorityRole: 'ASSOCIATE_DEAN',
    authorityDesignation: 'Associate Dean of Academic Affairs',
  }),
}));

const mockGrievanceItem: GrievanceSummaryItem = {
  id: 'grv-uuid-assoc-1',
  grievance_id: 'CSJMU-2026-00088',
  title: 'PhD Synopsis Submission Approval Delay',
  status: 'ASSIGNED',
  priority: 'HIGH',
  subject_id: 'sub-1',
  subject_name: 'Computer Science & Engineering',
  category_id: 'cat-coursework',
  category_name: 'Course Work & Evaluation',
  final_category_name: 'Course Work & Evaluation',
  assigned_authority_name: 'Dr. Sweta Pandey (Associate Dean)',
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:05:00Z',
};

const mockStats: AssociateDeanDashboardStats = {
  total_assigned: 12,
  pending: 4,
  in_progress: 5,
  resolved: 2,
  escalated: 1,
};

const mockQueueResponse: AssociateDeanQueueResponse = {
  items: [mockGrievanceItem],
  total: 1,
  page: 1,
  page_size: 15,
  total_pages: 1,
};

const mockDeanRoutingPreview: RoutingPreviewResponse = {
  grievance_id: 'CSJMU-2026-00088',
  subject_name: 'Computer Science & Engineering',
  category_name: 'Course Work & Evaluation',
  routing_type: 'FIXED_AUTHORITY',
  target_authority_id: 'dean-uuid-1',
  target_authority_name: 'Prof. Namita Tiwari',
  target_authority_role: 'DEAN',
  target_authority_email: 'research@csjmu.ac.in',
  is_active: true,
};

const mockGrievanceDetail: AssociateDeanGrievanceDetailResponse = {
  id: 'grv-uuid-assoc-1',
  grievance_id: 'CSJMU-2026-00088',
  title: 'PhD Synopsis Submission Approval Delay',
  description: 'Detailed grievance statement submitted by candidate regarding research advisory board review delay.',
  status: 'ASSIGNED',
  priority: 'HIGH',
  subject_id: 'sub-1',
  subject_name: 'Computer Science & Engineering',
  category_id: 'cat-coursework',
  category_name: 'Course Work & Evaluation',
  final_category_name: 'Course Work & Evaluation',
  applicant_name: 'Aditya Srivastava',
  applicant_roll_number: '230010042',
  applicant_email: 'aditya.s@csjmu.ac.in',
  applicant_department: 'Computer Science & Engineering',
  stage3_dean_preview: mockDeanRoutingPreview,
  can_resolve: true,
  can_forward: true,
  attachments: [],
  documents: [],
  history: [
    {
      id: 'hist-1',
      actor_name: 'Manager System',
      actor_role: 'MANAGER',
      actor_type: 'MANAGER',
      action: 'FORWARDED_TO_STAGE2',
      from_status: 'STAGE1_INVESTIGATION',
      to_status: 'ASSIGNED',
      remarks: 'Assistant Dean forwarded case following Stage 1 preliminary inquiry.',
      created_at: '2026-09-28T10:00:00Z',
    },
  ],
  created_at: '2026-09-28T09:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
};

describe('Associate Dean Workflow - Frontend Parity Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grievanceService.getAssociateDeanDashboard).mockResolvedValue(mockStats);
    vi.mocked(grievanceService.getAssociateDeanGrievances).mockResolvedValue(mockQueueResponse);
    vi.mocked(grievanceService.getAssociateDeanGrievanceDetail).mockResolvedValue(mockGrievanceDetail);
    vi.mocked(grievanceService.getGrievanceDocumentRequests).mockResolvedValue([]);
  });

  describe('AssociateDeanDashboardPage', () => {
    it('renders dashboard KPI cards and case list correctly', async () => {
      render(
        <MemoryRouter>
          <AssociateDeanDashboardPage />
        </MemoryRouter>
      );

      // Verify header
      expect(screen.getByText('Associate Dean Jurisdictional Docket')).toBeInTheDocument();
      expect(screen.getByText('STAGE 2 JURISDICTION')).toBeInTheDocument();

      // Wait for stats to load
      await waitFor(() => {
        expect(screen.getByText('12')).toBeInTheDocument(); // total assigned
        expect(screen.getByText('4')).toBeInTheDocument();  // pending
        expect(screen.getByText('5')).toBeInTheDocument();  // in progress
        expect(screen.getByText('2')).toBeInTheDocument();  // resolved
        expect(screen.getByText('1')).toBeInTheDocument();  // escalated
      });

      // Verify table content
      await waitFor(() => {
        expect(screen.getByText('CSJMU-2026-00088')).toBeInTheDocument();
        expect(screen.getByText('PhD Synopsis Submission Approval Delay')).toBeInTheDocument();
      });
    });

    it('filters cases when status tab is clicked', async () => {
      render(
        <MemoryRouter>
          <AssociateDeanDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU-2026-00088')).toBeInTheDocument();
      });

      // Click "In Progress" tab
      const inProgressTab = screen.getByRole('button', { name: 'In Progress' });
      fireEvent.click(inProgressTab);

      await waitFor(() => {
        expect(grievanceService.getAssociateDeanGrievances).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'IN_PROGRESS' })
        );
      });
    });

    it('searches cases using search input field', async () => {
      render(
        <MemoryRouter>
          <AssociateDeanDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search by Case ID, applicant, or keywords/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search by Case ID, applicant, or keywords/i);
      fireEvent.change(searchInput, { target: { value: 'Synopsis' } });

      const filterBtn = screen.getByRole('button', { name: /Filter Queue/i });
      fireEvent.click(filterBtn);

      await waitFor(() => {
        expect(grievanceService.getAssociateDeanGrievances).toHaveBeenCalledWith(
          expect.objectContaining({ search: 'Synopsis' })
        );
      });
    });
  });

  describe('AssociateDeanGrievanceDetailPage', () => {
    it('renders grievance dossier, applicant card, and determination buttons', async () => {
      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/associate-dean/grievance/grv-uuid-assoc-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/associate-dean/grievance/:id"
              element={<AssociateDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      // Verify title & basic info
      await waitFor(() => {
        expect(screen.getByText('PhD Synopsis Submission Approval Delay')).toBeInTheDocument();
        expect(screen.getByText('CSJMU-2026-00088')).toBeInTheDocument();
      });

      // Verify applicant profile card
      expect(screen.getByText('Aditya Srivastava')).toBeInTheDocument();
      expect(screen.getByText('230010042')).toBeInTheDocument();

      // Verify determination action buttons are visible
      expect(screen.getAllByRole('button', { name: /Direct Resolution/i })[0]).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /Escalate to Dean R&D/i })[0]).toBeInTheDocument();
    });

    it('opens Direct Resolution modal and submits resolution', async () => {
      vi.mocked(grievanceService.resolveAssociateDeanGrievance).mockResolvedValue({
        id: 'grv-uuid-assoc-1',
        grievance_id: 'CSJMU-2026-00088',
        status: 'RESOLVED',
        resolution_summary: 'Research advisory committee convened and approved synopsis submission.',
        resolved_at: '2026-09-30T10:00:00Z',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/associate-dean/grievance/grv-uuid-assoc-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/associate-dean/grievance/:id"
              element={<AssociateDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Direct Resolution/i })[0]).toBeInTheDocument();
      });

      // Click resolve button
      fireEvent.click(screen.getAllByRole('button', { name: /Direct Resolution/i })[0]);

      // Resolve modal should appear
      await waitFor(() => {
        expect(screen.getByText(/Direct Resolution •/i)).toBeInTheDocument();
      });

      // Type resolution notes
      const textarea = screen.getByPlaceholderText(/Record the official resolution determination/i);
      fireEvent.change(textarea, {
        target: { value: 'Research advisory committee convened and approved synopsis submission.' },
      });

      // Submit resolution
      const confirmBtn = screen.getByRole('button', { name: /Commit Formal Resolution/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(grievanceService.resolveAssociateDeanGrievance).toHaveBeenCalledWith(
          'grv-uuid-assoc-1',
          expect.objectContaining({
            resolution_notes: 'Research advisory committee convened and approved synopsis submission.',
          })
        );
      });
    });

    it('opens ForwardToDeanModal and submits escalation to Dean', async () => {
      vi.mocked(grievanceService.forwardAssociateDeanGrievance).mockResolvedValue({
        id: 'grv-uuid-assoc-1',
        grievance_id: 'CSJMU-2026-00088',
        status: 'ESCALATED',
        current_assigned_authority_id: 'dean-uuid-1',
        forwarded_at: '2026-09-30T10:00:00Z',
      });

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/associate-dean/grievance/grv-uuid-assoc-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/associate-dean/grievance/:id"
              element={<AssociateDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /Escalate to Dean R&D/i })[0]).toBeInTheDocument();
      });

      // Click escalate button in header
      fireEvent.click(screen.getAllByRole('button', { name: /Escalate to Dean R&D/i })[0]);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText(/Escalate Grievance to Dean R&D/i)).toBeInTheDocument();
      });

      // Type justification
      const textarea = screen.getByPlaceholderText(/Explain why higher-tier intervention by Dean R&D is required/i);
      fireEvent.change(textarea, {
        target: { value: 'Dean discretionary decision required for cross-institutional research tenure extension.' },
      });

      // Submit forward
      const submitBtn = screen.getByRole('button', { name: /Confirm Escalation to Dean/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(grievanceService.forwardAssociateDeanGrievance).toHaveBeenCalledWith(
          'grv-uuid-assoc-1',
          expect.objectContaining({
            reason: 'Dean discretionary decision required for cross-institutional research tenure extension.',
          })
        );
      });
    });

    it('hides action determination buttons when grievance is already resolved', async () => {
      const resolvedDetail: AssociateDeanGrievanceDetailResponse = {
        ...mockGrievanceDetail,
        status: 'RESOLVED',
        can_resolve: false,
        can_forward: false,
      };
      vi.mocked(grievanceService.getAssociateDeanGrievanceDetail).mockResolvedValue(resolvedDetail);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/associate-dean/grievance/grv-uuid-assoc-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/associate-dean/grievance/:id"
              element={<AssociateDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('PhD Synopsis Submission Approval Delay')).toBeInTheDocument();
      });

      // Action determination buttons should not exist
      expect(screen.queryByRole('button', { name: /Direct Resolution/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Escalate to Dean R&D/i })).not.toBeInTheDocument();
    });
  });

  describe('ForwardToDeanModal', () => {
    it('disables submit button when justification is under 5 characters', () => {
      const onConfirm = vi.fn();
      const onClose = vi.fn();

      render(
        <ForwardToDeanModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          grievanceTrackingId="CSJMU-2026-00088"
          targetDean={mockDeanRoutingPreview}
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Confirm Escalation to Dean/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByPlaceholderText(/Explain why higher-tier intervention by Dean R&D is required/i);
      fireEvent.change(textarea, { target: { value: 'abcd' } }); // 4 chars
      expect(submitBtn).toBeDisabled();

      fireEvent.change(textarea, { target: { value: 'Valid justification notes here.' } }); // > 5 chars
      expect(submitBtn).not.toBeDisabled();
    });
  });
});
