import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GrievanceSubmitPage } from '../pages/GrievanceSubmitPage';
import { ApplicantGrievanceListPage } from '../pages/ApplicantGrievanceListPage';
import { ApplicantGrievanceDetailPage } from '../pages/ApplicantGrievanceDetailPage';
import { ManagerTriageQueuePage } from '../pages/ManagerTriageQueuePage';
import { ManagerGrievanceReviewPage } from '../pages/ManagerGrievanceReviewPage';
import { grievanceService } from '../services/grievanceService';
import {
  GrievanceDetailResponse,
  GrievanceSummaryItem,
  TaxonomyCategoryItem,
  TaxonomySubjectItem,
} from '../types/grievance';

// Mock grievanceService
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
  },
}));

// Mock useAuth
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-user-uuid',
      email: 'scholar@csjmu.ac.in',
      fullName: 'Scholar Applicant',
      roles: ['applicant', 'manager'],
    },
    isAuthority: true,
    isApplicant: true,
  }),
}));

const mockSubjects: TaxonomySubjectItem[] = [
  {
    id: 'sub-1',
    name: 'Computer Science & Engineering',
    code: 'CSE',
    cluster_name: 'Science & Tech Cluster',
    is_active: true,
  },
];

const mockCategories: TaxonomyCategoryItem[] = [
  {
    id: 'cat-1',
    name: 'Examination Grading Discrepancy',
    code: 'EXAM',
    routing_type: 'SUBJECT_ASSISTANT_DEAN',
    cluster_name: 'Academic Affairs Cluster',
    is_active: true,
  },
  {
    id: 'cat-2',
    name: 'Hostel Maintenance & Mess',
    code: 'HOSTEL',
    routing_type: 'CLUSTER',
    cluster_name: 'Student Welfare Cluster',
    is_active: true,
  },
];

const mockGrievanceSummary: GrievanceSummaryItem = {
  id: 'grv-uuid-1',
  grievance_id: 'CSJMU-2026-00042',
  title: 'Midterm Grading Not Evaluated According to Rubric',
  status: 'PENDING_REVIEW',
  priority: 'HIGH',
  subject_id: 'sub-1',
  subject_name: 'Computer Science & Engineering',
  category_id: 'cat-1',
  category_name: 'Examination Grading Discrepancy',
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:05:00Z',
};

const mockGrievanceDetail: GrievanceDetailResponse = {
  id: 'grv-uuid-1',
  grievance_id: 'CSJMU-2026-00042',
  title: 'Midterm Grading Not Evaluated According to Rubric',
  description: 'Detailed explanation of how questions 3 and 4 were missed during paper evaluation.',
  status: 'PENDING_REVIEW',
  priority: 'HIGH',
  subject_id: 'sub-1',
  subject_name: 'Computer Science & Engineering',
  category_id: 'cat-1',
  category_name: 'Examination Grading Discrepancy',
  category_reviewed: false,
  category_overridden: false,
  ai_suggested_category_id: 'cat-1',
  ai_suggested_category_name: 'Examination Grading Discrepancy',
  ai_confidence: 0.94,
  applicant_id: 'mock-user-uuid',
  applicant_name: 'Scholar Applicant',
  applicant_email: 'scholar@csjmu.ac.in',
  student_registration_number: 'CSJMU2024PHD001',
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:05:00Z',
  history: [
    {
      id: 'hist-1',
      from_status: undefined,
      to_status: 'SUBMITTED',
      actor_type: 'USER',
      remarks: 'Initial grievance submitted by applicant.',
      created_at: '2026-09-28T10:00:00Z',
    },
    {
      id: 'hist-2',
      from_status: 'SUBMITTED',
      to_status: 'PENDING_REVIEW',
      actor_type: 'SYSTEM',
      remarks: 'AI processing complete: category classified and transitioned to pending review.',
      created_at: '2026-09-28T10:01:00Z',
    },
  ],
  documents: [
    {
      id: 'doc-1',
      file_name: 'marked_exam_sheet.pdf',
      file_path: 'storage/uploads/marked_exam_sheet.pdf',
      mime_type: 'application/pdf',
      file_size_bytes: 20480,
      document_type: 'ATTACHMENT',
      is_confidential: false,
      content_hash: 'a1b2c3d4e5f60718293a',
      created_at: '2026-09-28T10:00:00Z',
    },
  ],
};

describe('Atharva Veda Grievance Lifecycle Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grievanceService.getTaxonomySubjects).mockResolvedValue(mockSubjects);
    vi.mocked(grievanceService.getTaxonomyCategories).mockResolvedValue(mockCategories);
    vi.mocked(grievanceService.getMyGrievances).mockResolvedValue([mockGrievanceSummary]);
    vi.mocked(grievanceService.getGrievanceDetail).mockResolvedValue(mockGrievanceDetail);
    vi.mocked(grievanceService.getManagerTriageQueue).mockResolvedValue([mockGrievanceSummary]);
    vi.mocked(grievanceService.previewRouting).mockResolvedValue({
      grievance_id: 'CSJMU-2026-00042',
      subject_name: 'Computer Science & Engineering',
      category_name: 'Examination Grading Discrepancy',
      routing_type: 'SUBJECT_ASSISTANT_DEAN',
      target_authority_id: 'auth-dean-1',
      target_authority_name: 'Dr. Academic Dean',
      target_authority_role: 'ASSISTANT_DEAN',
      target_authority_email: 'asst_dean@csjmu.ac.in',
      is_active: true,
    });
  });

  it('1. GrievanceSubmitPage: loads taxonomy, validates inputs, and submits successfully', async () => {
    vi.mocked(grievanceService.submitGrievance).mockResolvedValue(mockGrievanceDetail);

    render(
      <MemoryRouter>
        <GrievanceSubmitPage />
      </MemoryRouter>
    );

    // Verify page loaded
    await waitFor(() => {
      expect(screen.getByText(/Submit Formal Grievance/i)).toBeInTheDocument();
      expect(screen.getByText(/Automatic Intake & Governance Routing/i)).toBeInTheDocument();
    });

    // Fill title and description
    fireEvent.change(screen.getByPlaceholderText(/Brief summary of your grievance/i), {
      target: { value: 'Grade recheck request for semester exam' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Provide complete facts/i), {
      target: { value: 'My grades for semester exam were incorrectly computed and need formal re-evaluation.' },
    });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /Submit Grievance/i }));

    await waitFor(() => {
      expect(grievanceService.submitGrievance).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Grade recheck request for semester exam',
        })
      );
      expect(screen.getByText(/Grievance Successfully Registered/i)).toBeInTheDocument();
      expect(screen.getAllByText(/CSJMU-2026-00042/i).length).toBeGreaterThan(0);
    });
  });

  it('2. ApplicantGrievanceListPage: displays submitted grievances table and navigation', async () => {
    render(
      <MemoryRouter>
        <ApplicantGrievanceListPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/My Grievance Dossiers/i)).toBeInTheDocument();
      expect(screen.getByText('CSJMU-2026-00042')).toBeInTheDocument();
      expect(screen.getByText(/Pending Review/i)).toBeInTheDocument();
      expect(screen.getByText(/View Dossier \u2192/i)).toBeInTheDocument();
    });
  });

  it('3. ApplicantGrievanceDetailPage: renders full dossier, AI classification score, and history timeline', async () => {
    render(
      <MemoryRouter initialEntries={['/atharva-veda/nivaran/grievance/grv-uuid-1']}>
        <Routes>
          <Route path="/atharva-veda/nivaran/grievance/:id" element={<ApplicantGrievanceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU-2026-00042')).toBeInTheDocument();
      expect(screen.getByText(/AI Automated Processing/i)).toBeInTheDocument();
      expect(screen.getByText(/94% Confidence/i)).toBeInTheDocument();
      expect(screen.getByText(/marked_exam_sheet.pdf/i)).toBeInTheDocument();
      expect(screen.getByText(/Lifecycle Status History/i)).toBeInTheDocument();
      expect(screen.getByText(/Initial grievance submitted by applicant/i)).toBeInTheDocument();
    });
  });

  it('4. ManagerTriageQueuePage: lists pending cases with filter controls', async () => {
    render(
      <MemoryRouter>
        <ManagerTriageQueuePage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Manager Triage Command Center/i)).toBeInTheDocument();
      expect(screen.getByText('CSJMU-2026-00042')).toBeInTheDocument();
      expect(screen.getByText(/Triage & Assign \u2192/i)).toBeInTheDocument();
    });
  });

  it('5. ManagerGrievanceReviewPage: previews dynamic routing and commits triage assignment', async () => {
    vi.mocked(grievanceService.reviewAndAssignGrievance).mockResolvedValue({
      ...mockGrievanceDetail,
      status: 'ASSIGNED',
      category_reviewed: true,
      assigned_authority_name: 'Dr. Academic Dean',
      assigned_authority_role: 'ASSISTANT_DEAN',
    });

    render(
      <MemoryRouter initialEntries={['/atharva-veda/nivaran/manager/review/grv-uuid-1']}>
        <Routes>
          <Route path="/atharva-veda/nivaran/manager/review/:id" element={<ManagerGrievanceReviewPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for data and live routing preview
    await waitFor(() => {
      expect(screen.getByText(/Manager Triage \u2022 CSJMU-2026-00042/i)).toBeInTheDocument();
      expect(screen.getByText(/Dynamic Routing Destination Preview/i)).toBeInTheDocument();
      expect(screen.getByText(/Dr. Academic Dean/i)).toBeInTheDocument();
    });

    // Submit triage action
    fireEvent.click(screen.getByText(/Confirm & Route to Authority/i));

    await waitFor(() => {
      expect(grievanceService.reviewAndAssignGrievance).toHaveBeenCalledWith(
        'grv-uuid-1',
        expect.objectContaining({
          confirm_category: true,
        })
      );
      expect(screen.getByText(/successfully triaged, categorized, and assigned/i)).toBeInTheDocument();
    });
  });
});
