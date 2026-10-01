import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AssistantDeanDashboardPage } from '../pages/AssistantDeanDashboardPage';
import { AssistantDeanGrievanceDetailPage } from '../pages/AssistantDeanGrievanceDetailPage';
import { ForwardConfirmationModal } from '../components/ForwardConfirmationModal';
import { ResolveGrievanceModal } from '../components/ResolveGrievanceModal';
import { RequestDocumentModal } from '../components/RequestDocumentModal';
import { RequestCommitteeModal } from '../components/RequestCommitteeModal';
import { grievanceService } from '../services/grievanceService';
import {
  AssistantDeanGrievanceDetailResponse,
  AssistantDeanQueueResponse,
  GrievanceSummaryItem,
  RoutingPreviewResponse,
} from '../types/grievance';

// Mock grievanceService
vi.mock('../services/grievanceService', () => ({
  grievanceService: {
    getAssistantDeanQueue: vi.fn(),
    getAssistantDeanGrievanceDetail: vi.fn(),
    resolveAssistantDeanGrievance: vi.fn(),
    forwardAssistantDeanGrievance: vi.fn(),
    requestGrievanceDocuments: vi.fn(),
    getGrievanceDocumentRequests: vi.fn(),
    requestCommitteeCreation: vi.fn(),
  },
}));

// Mock useAuth
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-user-asst-dean',
      email: 'asst_dean1@csjmu.ac.in',
      fullName: 'Assistant Dean Science',
      roles: ['authority'],
    },
    isAuthority: true,
    isAssistantDean: true,
    isApplicant: false,
    isAdmin: false,
    isManager: false,
    isAssociateDean: false,
    isDean: false,
    authorityRole: 'ASSISTANT_DEAN',
    authorityDesignation: 'Assistant Dean of Academic Affairs (Cluster 1)',
  }),
}));

const mockGrievanceItem: GrievanceSummaryItem = {
  id: 'grv-uuid-1',
  grievance_id: 'CSJMU-2026-00042',
  title: 'Midterm Grading Not Evaluated According to Rubric',
  status: 'ASSIGNED',
  priority: 'HIGH',
  subject_id: 'sub-1',
  subject_name: 'Computer Science & Engineering',
  category_id: 'cat-1',
  category_name: 'Examination Grading Discrepancy',
  final_category_name: 'Examination Grading Discrepancy',
  assigned_authority_name: 'Dr. Jane Smith (Assistant Dean)',
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:05:00Z',
};

const mockQueueResponse: AssistantDeanQueueResponse = {
  items: [mockGrievanceItem],
  total: 1,
  page: 1,
  page_size: 15,
  total_pages: 1,
};

const mockRoutingPreview: RoutingPreviewResponse = {
  grievance_id: 'CSJMU-2026-00042',
  subject_name: 'Computer Science & Engineering',
  category_name: 'Examination Grading Discrepancy',
  routing_type: 'CLUSTER',
  target_authority_id: 'assoc-dean-uuid',
  target_authority_name: 'Dr. Robert Davis',
  target_authority_role: 'ASSOCIATE_DEAN',
  target_authority_email: 'assoc_dean1@csjmu.ac.in',
  is_active: true,
};

const mockGrievanceDetail: AssistantDeanGrievanceDetailResponse = {
  id: 'grv-uuid-1',
  grievance_id: 'CSJMU-2026-00042',
  title: 'Midterm Grading Not Evaluated According to Rubric',
  description: 'Detailed statement of unfair evaluation during the midterm examination.',
  status: 'ASSIGNED',
  priority: 'HIGH',
  subject_id: 'sub-1',
  subject_name: 'Computer Science & Engineering',
  subject_cluster_name: 'Engineering & Technology Cluster',
  category_id: 'cat-1',
  category_name: 'Examination Grading Discrepancy',
  final_category_id: 'cat-1',
  final_category_name: 'Examination Grading Discrepancy',
  category_reviewed: true,
  category_overridden: false,
  applicant_id: 'scholar-uuid-1',
  applicant_name: 'Scholar Applicant',
  applicant_email: 'scholar@csjmu.ac.in',
  student_registration_number: 'CSJMU-PHD-2024-001',
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:05:00Z',
  history: [
    {
      id: 'hist-1',
      from_status: 'PENDING_REVIEW',
      to_status: 'ASSIGNED',
      actor_type: 'MANAGER',
      remarks: 'Triaged and assigned to Assistant Dean',
      created_at: '2026-09-28T10:05:00Z',
    },
  ],
  documents: [
    {
      id: 'doc-1',
      file_name: 'midterm_paper.pdf',
      file_path: '/uploads/midterm_paper.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 1048576,
      document_type: 'ATTACHMENT',
      is_confidential: false,
      created_at: '2026-09-28T10:00:00Z',
    },
  ],
  stage2_routing_preview: mockRoutingPreview,
  can_forward: true,
};

describe('Assistant Dean Workflow Frontend Components & Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AssistantDeanDashboardPage', () => {
    it('renders jurisdictional docket stats, search filters, and case ledger', async () => {
      vi.mocked(grievanceService.getAssistantDeanQueue).mockResolvedValueOnce(mockQueueResponse);

      render(
        <MemoryRouter>
          <AssistantDeanDashboardPage />
        </MemoryRouter>
      );

      expect(screen.getByText(/Loading Assistant Dean case ledger/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/Assistant Dean • Subject Cluster Docket/i)).toBeInTheDocument();
        expect(screen.getByText('CSJMU-2026-00042')).toBeInTheDocument();
        expect(screen.getByText('Midterm Grading Not Evaluated According to Rubric')).toBeInTheDocument();
        expect(screen.getByText(/Review Case →/i)).toBeInTheDocument();
      });
    });

    it('filters cases when status tab is clicked', async () => {
      vi.mocked(grievanceService.getAssistantDeanQueue).mockResolvedValueOnce(mockQueueResponse);
      vi.mocked(grievanceService.getAssistantDeanQueue).mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        page_size: 15,
        total_pages: 0,
      });

      render(
        <MemoryRouter>
          <AssistantDeanDashboardPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU-2026-00042')).toBeInTheDocument();
      });

      // Click Resolved tab
      const resolvedTab = screen.getByRole('button', { name: 'Resolved' });
      fireEvent.click(resolvedTab);

      await waitFor(() => {
        expect(grievanceService.getAssistantDeanQueue).toHaveBeenCalledWith(
          expect.objectContaining({ status_filter: 'RESOLVED' })
        );
      });
    });
  });

  describe('AssistantDeanGrievanceDetailPage', () => {
    it('renders full case dossier, Stage 2 escalation target card, and action determinations', async () => {
      vi.mocked(grievanceService.getAssistantDeanGrievanceDetail).mockResolvedValueOnce(mockGrievanceDetail);
      vi.mocked(grievanceService.getGrievanceDocumentRequests).mockResolvedValueOnce([]);

      render(
        <MemoryRouter initialEntries={['/assistant-dean/grievances/grv-uuid-1']}>
          <Routes>
            <Route
              path="/assistant-dean/grievances/:id"
              element={<AssistantDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Case Review • CSJMU-2026-00042/i)).toBeInTheDocument();
        expect(screen.getByText('Scholar Applicant')).toBeInTheDocument();
        expect(screen.getByText('Engineering & Technology Cluster')).toBeInTheDocument();
        expect(screen.getByText('Dr. Robert Davis')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Direct Resolution/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Forward to Dr. Robert Davis/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Request Evidentiary Documents/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Request Inquiry Committee/i })).toBeInTheDocument();
      });

      // Clicking Direct Resolution opens the ResolveGrievanceModal
      const resolveBtn = screen.getByRole('button', { name: /Direct Resolution/i });
      fireEvent.click(resolveBtn);

      await waitFor(() => {
        expect(screen.getByText(/Direct Resolution • CSJMU-2026-00042/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Commit Formal Resolution/i })).toBeInTheDocument();
      });

      // Close modal
      const cancelResolveBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelResolveBtn);

      // Clicking Forward opens ForwardConfirmationModal with Stage 2 destination
      const forwardBtn = screen.getByRole('button', { name: /Forward to Dr. Robert Davis/i });
      fireEvent.click(forwardBtn);

      await waitFor(() => {
        expect(screen.getByText(/Forward Grievance — Stage 2 Routing Escalation/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Forward Grievance/i })).toBeInTheDocument();
      });
    });

    it('hides action determination buttons and renders resolution card when grievance is RESOLVED', async () => {
      const resolvedDetail: AssistantDeanGrievanceDetailResponse = {
        ...mockGrievanceDetail,
        status: 'RESOLVED',
        resolution_summary: 'Discrepancy reconciled and re-evaluated by Department Chair.',
        resolved_at: '2026-09-29T12:00:00Z',
        can_forward: false,
      };

      vi.mocked(grievanceService.getAssistantDeanGrievanceDetail).mockResolvedValueOnce(resolvedDetail);
      vi.mocked(grievanceService.getGrievanceDocumentRequests).mockResolvedValueOnce([]);

      render(
        <MemoryRouter initialEntries={['/assistant-dean/grievances/grv-uuid-1']}>
          <Routes>
            <Route
              path="/assistant-dean/grievances/:id"
              element={<AssistantDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Official Resolution Determination/i)).toBeInTheDocument();
        expect(screen.getByText(/Discrepancy reconciled and re-evaluated by Department Chair./i)).toBeInTheDocument();
        expect(screen.getByText(/Grievance has been finalized under Assistant Dean jurisdiction/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Direct Resolution/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Forward to Dr. Robert Davis/i })).not.toBeInTheDocument();
      });
    });

    it('displays terminal routing notice when grievance cannot be forwarded further', async () => {
      const terminalDetail: AssistantDeanGrievanceDetailResponse = {
        ...mockGrievanceDetail,
        can_forward: false,
        forward_blocked_reason: 'Terminal routing: this category has no higher escalation authority.',
        stage2_routing_preview: null,
      };

      vi.mocked(grievanceService.getAssistantDeanGrievanceDetail).mockResolvedValueOnce(terminalDetail);
      vi.mocked(grievanceService.getGrievanceDocumentRequests).mockResolvedValueOnce([]);

      render(
        <MemoryRouter initialEntries={['/assistant-dean/grievances/grv-uuid-1']}>
          <Routes>
            <Route
              path="/assistant-dean/grievances/:id"
              element={<AssistantDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Direct Resolution/i })).toBeInTheDocument();
        expect(screen.getAllByText(/Terminal routing: this category has no higher escalation authority./i).length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByRole('button', { name: /Forward to Dr. Robert Davis/i })).not.toBeInTheDocument();
      });
    });

    it('renders error state and return button when case fails to load or access is denied', async () => {
      vi.mocked(grievanceService.getAssistantDeanGrievanceDetail).mockRejectedValueOnce(
        new Error('Case dossier could not be found or you lack Assistant Dean jurisdiction.')
      );
      vi.mocked(grievanceService.getGrievanceDocumentRequests).mockResolvedValueOnce([]);

      render(
        <MemoryRouter initialEntries={['/assistant-dean/grievances/invalid-uuid']}>
          <Routes>
            <Route
              path="/assistant-dean/grievances/:id"
              element={<AssistantDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Case dossier could not be found or you lack Assistant Dean jurisdiction./i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Return to Queue/i })).toBeInTheDocument();
      });
    });
  });


  describe('ForwardConfirmationModal', () => {
    it('renders Stage 2 destination, all 6 checkboxes, 3 justification fields, and Forward Grievance button', () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn();

      render(
        <ForwardConfirmationModal
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
          routingPreview={mockRoutingPreview}
        />
      );

      // 1. Modal title and close button
      expect(screen.getByText(/Forward Grievance — Stage 2 Routing Escalation/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Close dialog/i })).toBeInTheDocument();

      // 2. Stage 2 destination renders with dynamic authority info
      expect(screen.getByText(/Stage 2 Escalation Destination/i)).toBeInTheDocument();
      expect(screen.getByText(mockRoutingPreview.target_authority_name)).toBeInTheDocument();
      expect(screen.getByText(mockRoutingPreview.target_authority_role)).toBeInTheDocument();
      expect(screen.getByText(mockRoutingPreview.routing_type)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockRoutingPreview.target_authority_email, 'i'))).toBeInTheDocument();

      // 3. All 6 verification affirmation checkboxes render
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(6);
      expect(screen.getByText(/1\. I have thoroughly reviewed the student's submission/i)).toBeInTheDocument();
      expect(screen.getByText(/2\. I have verified prior grievance history/i)).toBeInTheDocument();
      expect(screen.getByText(/3\. I have consulted the relevant CSJMU academic ordinances/i)).toBeInTheDocument();
      expect(screen.getByText(/4\. I certify that I have no personal, academic, or professional conflict/i)).toBeInTheDocument();
      expect(screen.getByText(/5\. I confirm that resolution of this matter requires escalation/i)).toBeInTheDocument();
      expect(screen.getByText(/6\. I have formulated clear, actionable preliminary findings/i)).toBeInTheDocument();

      // 4. All 3 justification textareas render
      expect(screen.getByText(/Reasons for Escalation/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Preliminary Findings/i)).toBeInTheDocument();
      expect(screen.getByText(/Specific Questions \/ Actions for Stage 2 Authority/i)).toBeInTheDocument();

      // 5. Forward button and Cancel button render
      const forwardBtn = screen.getByRole('button', { name: /Forward Grievance/i });
      expect(forwardBtn).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();

      // 6. Forward button is disabled when requirements are incomplete
      expect(forwardBtn).toBeDisabled();
      expect(screen.getByText(/Affirmations incomplete \(0\/6 checked\)/i)).toBeInTheDocument();
    });

    it('disables forwarding button until all 6 affirmations and 3 justifications are satisfied', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn();

      render(
        <ForwardConfirmationModal
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
          routingPreview={mockRoutingPreview}
        />
      );

      const forwardBtn = screen.getByRole('button', { name: /Forward Grievance/i });
      expect(forwardBtn).toBeDisabled();

      // Check all 6 checkboxes
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(6);
      checkboxes.forEach((cb) => fireEvent.click(cb));

      // Still disabled because text areas are empty (< 5 chars)
      expect(forwardBtn).toBeDisabled();
      expect(screen.getByText(/Reasons for Escalation requires min\. 5 chars/i)).toBeInTheDocument();

      // Fill in 3 text areas
      const textareas = screen.getAllByRole('textbox');
      // textareas: 3 textareas + 1 input for forwarding notes
      fireEvent.change(textareas[0], { target: { value: 'Valid reason for escalation to cluster authority' } });
      expect(forwardBtn).toBeDisabled();
      expect(screen.getByText(/Preliminary Findings requires min\. 5 chars/i)).toBeInTheDocument();

      fireEvent.change(textareas[1], { target: { value: 'Detailed preliminary findings establishing the facts' } });
      expect(forwardBtn).toBeDisabled();
      expect(screen.getByText(/Specific Questions requires min\. 5 chars/i)).toBeInTheDocument();

      fireEvent.change(textareas[2], { target: { value: 'Specific questions regarding marks moderation' } });

      // Button should now be enabled and status shows valid
      await waitFor(() => {
        expect(forwardBtn).not.toBeDisabled();
        expect(screen.getByText(/All 6 affirmations and 3 justifications validated/i)).toBeInTheDocument();
      });

      // Submit
      fireEvent.click(forwardBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            confirmation: expect.objectContaining({
              reviewed_student_submission: true,
              reviewed_prior_history: true,
              reviewed_regulations: true,
              verified_no_conflict: true,
              confirmed_jurisdiction: true,
              confirmed_recommendations_actionable: true,
              reasons_justification: 'Valid reason for escalation to cluster authority',
              preliminary_findings: 'Detailed preliminary findings establishing the facts',
              specific_questions: 'Specific questions regarding marks moderation',
            }),
          })
        );
      });
    });

    it('shows loading state and disables button during submission to prevent duplicate submission', () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn();

      render(
        <ForwardConfirmationModal
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
          routingPreview={mockRoutingPreview}
          loading={true}
        />
      );

      const loadingBtn = screen.getByRole('button', { name: /Forwarding Grievance\.\.\./i });
      expect(loadingBtn).toBeInTheDocument();
      expect(loadingBtn).toBeDisabled();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    });
  });

  describe('ResolveGrievanceModal', () => {
    it('validates minimum 3 character notes before allowing resolution submission', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn();

      render(
        <ResolveGrievanceModal
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
          grievanceId="CSJMU-2026-00042"
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Commit Formal Resolution/i });
      expect(submitBtn).toBeDisabled();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'OK' } });
      expect(submitBtn).toBeDisabled();

      fireEvent.change(textarea, { target: { value: 'Discrepancy reconciled and marks revised by department chair.' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith({
          resolution_notes: 'Discrepancy reconciled and marks revised by department chair.',
        });
      });
    });
  });

  describe('RequestDocumentModal', () => {
    it('allows adding and submitting evidentiary document requests', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn();

      render(
        <RequestDocumentModal
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
          grievanceId="CSJMU-2026-00042"
        />
      );

      const textInputs = screen.getAllByRole('textbox');
      const docNameInput = textInputs[0];
      const docDescInput = textInputs[1];

      fireEvent.change(docNameInput, { target: { value: 'Midterm Answer Booklet' } });
      fireEvent.change(docDescInput, { target: { value: 'Scanned copy of student paper' } });

      const issueBtn = screen.getByRole('button', { name: /Issue Document Request/i });
      expect(issueBtn).not.toBeDisabled();

      fireEvent.click(issueBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith([
          expect.objectContaining({
            document_name: 'Midterm Answer Booklet',
            description: 'Scanned copy of student paper',
          }),
        ]);
      });
    });
  });

  describe('RequestCommitteeModal', () => {
    it('validates justification and submits proposed committee roles', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      const mockClose = vi.fn();

      render(
        <RequestCommitteeModal
          isOpen={true}
          onClose={mockClose}
          onSubmit={mockSubmit}
          grievanceId="CSJMU-2026-00042"
        />
      );

      const submitBtn = screen.getByRole('button', { name: /Submit Committee Formation Request/i });
      expect(submitBtn).toBeDisabled();

      const textareas = screen.getAllByRole('textbox');
      const reasonInput = textareas[0];

      fireEvent.change(reasonInput, { target: { value: 'Complex factual dispute requires independent evaluation.' } });
      expect(submitBtn).not.toBeDisabled();

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            reason: 'Complex factual dispute requires independent evaluation.',
            proposed_member_roles: ['Department Head', 'External Subject Expert', 'Faculty Observer'],
          })
        );
      });
    });
  });
});
