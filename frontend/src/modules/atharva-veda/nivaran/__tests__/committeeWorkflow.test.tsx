import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequestCommitteeModal } from '../components/RequestCommitteeModal';
import { FormCommitteeModal } from '../components/FormCommitteeModal';
import { AssociateDeanGrievanceDetailPage } from '../pages/AssociateDeanGrievanceDetailPage';
import { grievanceService } from '../services/grievanceService';
import { EligibleAuthorityItem } from '../types/grievance';

// Mock grievanceService
vi.mock('../services/grievanceService', () => ({
  grievanceService: {
    getEligibleAuthorities: vi.fn(),
    formCommitteeDirect: vi.fn(),
    reviewCommitteeRequest: vi.fn(),
    getCommitteeRequests: vi.fn(),
    getCommittees: vi.fn(),
    getAssociateDeanGrievanceDetail: vi.fn(),
    getGrievanceDocumentRequests: vi.fn(),
    resolveAssociateDeanGrievance: vi.fn(),
    forwardAssociateDeanGrievance: vi.fn(),
    requestAssociateDeanDocuments: vi.fn(),
    requestAssociateDeanCommittee: vi.fn(),
  },
}));

// Mock useAuth for Associate Dean
vi.mock('../../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'mock-assoc-id',
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
    authorityDesignation: 'Associate Dean R&D',
  }),
}));

const mockAuthorities: EligibleAuthorityItem[] = [
  {
    id: 'auth-dean-uuid',
    name: 'Prof. Alok Kumar',
    email: 'deanrd@csjmu.ac.in',
    role: 'DEAN',
    designation: 'Dean Research & Development',
  },
  {
    id: 'auth-assoc-uuid',
    name: 'Dr. Sweta Pandey',
    email: 'associatedean1@csjmu.ac.in',
    role: 'ASSOCIATE_DEAN',
    designation: 'Associate Dean R&D',
  },
  {
    id: 'auth-asst-uuid',
    name: 'Dr. Ankit Trivedi',
    email: 'assistantdean1@csjmu.ac.in',
    role: 'ASSISTANT_DEAN',
    designation: 'Assistant Dean Academics',
  },
];

describe('NIVARAN-AI Committee Formation Workflow & Matrix UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(grievanceService.getEligibleAuthorities).mockResolvedValue(mockAuthorities);
    vi.mocked(grievanceService.getCommitteeRequests).mockResolvedValue([]);
    vi.mocked(grievanceService.getCommittees).mockResolvedValue([]);
    vi.mocked(grievanceService.getGrievanceDocumentRequests).mockResolvedValue([]);
  });

  describe('RequestCommitteeModal Component', () => {
    it('1. Assistant Dean caller sees Associate Dean and Dean options only, with Assistant Deans excluded', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <RequestCommitteeModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockSubmit}
          grievanceId="grv-123"
          callerRole="ASSISTANT_DEAN"
        />
      );

      await waitFor(() => {
        expect(grievanceService.getEligibleAuthorities).toHaveBeenCalled();
      });

      // Recipient select should contain Dean and Associate Dean options
      const select = screen.getByLabelText(/Intended Recipient Authority/i);
      expect(select).toBeInTheDocument();

      // Check options
      expect(screen.getByText(/Prof. Alok Kumar/i)).toBeInTheDocument();
      expect(screen.getByText(/Dr. Sweta Pandey/i)).toBeInTheDocument();

      // Assistant Dean should NOT be an option in recipient dropdown
      expect(screen.queryByText(/Dr. Ankit Trivedi/i)).not.toBeInTheDocument();
    });

    it('2. Associate Dean caller has recipient locked exclusively to the Dean', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <RequestCommitteeModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockSubmit}
          grievanceId="grv-123"
          callerRole="ASSOCIATE_DEAN"
        />
      );

      await waitFor(() => {
        expect(grievanceService.getEligibleAuthorities).toHaveBeenCalled();
      });

      // Under rule: Associate Dean can request from Dean only
      expect(screen.getByText(/Associate Deans must request committee formation directly from the Dean/i)).toBeInTheDocument();
    });

    it('3. Validates justification length and dispatches submission payload', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <RequestCommitteeModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockSubmit}
          grievanceId="grv-123"
          callerRole="ASSISTANT_DEAN"
        />
      );

      await waitFor(() => {
        expect(grievanceService.getEligibleAuthorities).toHaveBeenCalled();
      });

      const select = screen.getByLabelText(/Intended Recipient Authority/i);
      fireEvent.change(select, { target: { value: 'auth-dean-uuid' } });

      const justificationInput = screen.getByLabelText(/Justification & Terms of Inquiry/i);
      fireEvent.change(justificationInput, { target: { value: 'Cross-faculty inquiry requires senior board review' } });

      const submitBtn = screen.getByRole('button', { name: /Submit Committee Formation Request/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            target_authority_id: 'auth-dean-uuid',
            justification: 'Cross-faculty inquiry requires senior board review',
          })
        );
      });
    });
  });

  describe('FormCommitteeModal Component', () => {
    it('4. Allows direct committee formation with Chairperson and Members selection', async () => {
      const mockSubmit = vi.fn().mockResolvedValue(undefined);
      render(
        <FormCommitteeModal
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={mockSubmit}
          grievanceId="CSJMU-2026-00088"
          grievanceUuid="grv-123"
          authorityRole="DEAN"
        />
      );

      await waitFor(() => {
        expect(grievanceService.getEligibleAuthorities).toHaveBeenCalled();
      });

      const torInput = screen.getByLabelText(/Terms & Purpose of Inquiry/i);
      fireEvent.change(torInput, { target: { value: 'Submit final report within 10 days' } });

      // Click member checkbox
      const memberItem = screen.getAllByText(/Dr\. Sweta Pandey/i)[1];
      fireEvent.click(memberItem);

      const submitBtn = screen.getByRole('button', { name: /Form Inquiry Committee/i });
      expect(submitBtn).not.toBeDisabled();
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            grievance_id: 'grv-123',
            terms_of_reference: 'Submit final report within 10 days',
            chairperson_id: expect.any(String),
            members: expect.any(Array),
          })
        );
      });
    });
  });

  describe('AssociateDeanGrievanceDetailPage Distinct Actions', () => {
    it('5. Renders distinct "Request Committee Formation" and "Form Committee Directly" action buttons', async () => {
      vi.mocked(grievanceService.getAssociateDeanGrievanceDetail).mockResolvedValue({
        id: 'grv-uuid-assoc-1',
        grievance_id: 'CSJMU-2026-00088',
        title: 'PhD Synopsis Submission Approval Delay',
        status: 'ASSIGNED',
        priority: 'HIGH',
        subject_id: 'sub-1',
        subject_name: 'Computer Science & Engineering',
        category_id: 'cat-1',
        category_name: 'Research Course Work',
        created_at: '2026-10-01T10:00:00Z',
        description: 'Synopsis pending approval for over 6 months.',
        applicant_name: 'Rahul Sharma',
        applicant_email: 'rahul.phd@csjmu.ac.in',
        applicant_phone: '+919876543210',
        enrollment_number: 'ENR-2024-001',
        department_name: 'Computer Science',
        is_active_assignment: true,
        assigned_authority_name: 'Dr. Sweta Pandey',
        history: [],
        documents: [],
        cluster_info: {
          cluster_id: 'clus-1',
          cluster_name: 'Academic Affairs Cluster',
          associate_dean_name: 'Dr. Sweta Pandey',
        },
      } as any);

      render(
        <MemoryRouter initialEntries={['/modules/atharva-veda/nivaran/associate-dean/cases/grv-uuid-assoc-1']}>
          <Routes>
            <Route
              path="/modules/atharva-veda/nivaran/associate-dean/cases/:id"
              element={<AssociateDeanGrievanceDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU-2026-00088')).toBeInTheDocument();
      });

      // Both buttons must be visible and distinct
      const requestBtn = screen.getByRole('button', { name: /^Request Committee Formation$/i });
      const formDirectBtn = screen.getByRole('button', { name: /^Form Committee Directly$/i });

      expect(requestBtn).toBeInTheDocument();
      expect(formDirectBtn).toBeInTheDocument();

      // Clicking "Request Committee Formation" opens Request Committee modal
      fireEvent.click(requestBtn);
      await waitFor(() => {
        expect(screen.getByText(/Intended Recipient Authority/i)).toBeInTheDocument();
      });
    });
  });
});
