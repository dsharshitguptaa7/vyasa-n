import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnudaanStepper } from '../components/AnudaanStepper';
import { Step1ApplicantProfile } from '../components/Step1ApplicantProfile';
import { Step2ApplicantBank } from '../components/Step2ApplicantBank';
import { Step3Publications } from '../components/Step3Publications';
import { AnudaanWizardPage } from '../pages/AnudaanWizardPage';
import { anudaanService } from '../services/anudaanService';
import { ApiError } from '../../../services/apiClient';
import { saveDraftSession, clearDraftSession } from '../services/anudaanSession';
import { AnudaanApplicationDetailOut } from '../types/anudaan';

const MOCK_APPLICATION: AnudaanApplicationDetailOut = {
  id: '01d12825-9dda-4775-aa02-ff6a07254c47',
  application_number: 'ANU-2026-00042',
  applicant_category: 'FACULTY_CAMPUS',
  full_name: 'Dr. Vikram Sharma',
  institutional_id: 'EMP-9876',
  designation: 'Associate Professor',
  department_name: 'Department of Physics',
  supervisor_name: null,
  mobile_number: '9876543210',
  scopus_author_id: '57200000001',
  scopus_profile_url: 'https://www.scopus.com/authid/detail.uri?authorId=57200000001',
  status: 'DRAFT',
  form_metadata: {},
  submitted_at: null,
  publications: [],
  documents: [],
  declarations: [],
  created_at: '2026-11-08T18:00:00Z',
  updated_at: '2026-11-08T18:00:00Z',
};

describe('ANUDAAN Phase 4.2 Stepper & Intake Wizard Suite', () => {
  beforeEach(() => {
    clearDraftSession();
    vi.restoreAllMocks();
  });

  describe('1. AnudaanStepper Component', () => {
    it('1.1 Renders 3 numbered steps with current and completed indicators', () => {
      const stepClickSpy = vi.fn();
      render(
        <AnudaanStepper
          currentStep={2}
          completedSteps={[1]}
          onStepClick={stepClickSpy}
        />
      );

      expect(screen.getByText('Applicant Profile')).toBeInTheDocument();
      expect(screen.getByText('Bank Details')).toBeInTheDocument();
      expect(screen.getByText('Publications')).toBeInTheDocument();

      // Step 1 is completed and clickable
      fireEvent.click(screen.getByText('Applicant Profile'));
      expect(stepClickSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('2. Step 1: Applicant Profile & Eligibility', () => {
    it('2.1 Displays institutional campus eligibility rules and enforces required fields', async () => {
      const successSpy = vi.fn();
      render(<Step1ApplicantProfile onSuccess={successSpy} />);

      expect(screen.getByText(/Institutional Campus Eligibility Rules/i)).toBeInTheDocument();
      expect(screen.getByText(/Affiliated college faculty, retired staff, and alumni are strictly ineligible/i)).toBeInTheDocument();

      // Submit empty form
      fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));

      expect(screen.getByText(/Full name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Employee Code is required/i)).toBeInTheDocument();
      expect(successSpy).not.toHaveBeenCalled();
    });

    it('2.2 Enforces supervisor name conditionally for research scholars and postdocs', async () => {
      const successSpy = vi.fn();
      render(<Step1ApplicantProfile onSuccess={successSpy} />);

      // Change category to Research Scholar
      const categorySelect = screen.getByLabelText(/Applicant Category/i);
      fireEvent.change(categorySelect, { target: { value: 'SCHOLAR_CAMPUS' } });

      // Supervisor input should appear
      expect(screen.getByLabelText(/Research Supervisor \/ Mentor Name/i)).toBeInTheDocument();

      // Fill basic fields except supervisor
      fireEvent.change(screen.getByLabelText(/^Full Name/i), { target: { value: 'Aarav Scholar' } });
      fireEvent.change(screen.getByLabelText(/Registration ID/i), { target: { value: 'CSJMU-PHD-2024-01' } });
      fireEvent.change(screen.getByLabelText(/^Designation/i), { target: { value: 'Research Scholar' } });
      fireEvent.change(screen.getByLabelText(/Department \/ School/i), { target: { value: 'Chemistry' } });
      fireEvent.change(screen.getByLabelText(/Mobile Number/i), { target: { value: '9876543210' } });

      fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));

      expect(screen.getByText(/Supervisor \/ Mentor name is mandatory for Research Scholars/i)).toBeInTheDocument();
      expect(successSpy).not.toHaveBeenCalled();
    });

    it('2.3 Calls updateDraft when initialData is provided', async () => {
      const updateSpy = vi.spyOn(anudaanService, 'updateDraft').mockResolvedValueOnce({
        success: true,
        message: 'Updated',
        data: { ...MOCK_APPLICATION, full_name: 'Dr. Vikram Sharma Updated' },
      });

      const successSpy = vi.fn();
      render(
        <Step1ApplicantProfile
          initialData={MOCK_APPLICATION}
          onSuccess={successSpy}
        />
      );

      expect(screen.getByDisplayValue('Dr. Vikram Sharma')).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText(/^Full Name/i), {
        target: { value: 'Dr. Vikram Sharma Updated' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Save & Continue/i }));

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          MOCK_APPLICATION.id,
          expect.objectContaining({
            full_name: 'Dr. Vikram Sharma Updated',
            institutional_id: 'EMP-9876',
          })
        );
        expect(successSpy).toHaveBeenCalledWith(
          expect.objectContaining({ full_name: 'Dr. Vikram Sharma Updated' })
        );
      });
    });
  });

  describe('3. Step 2: Applicant Bank Details Intake', () => {
    it('3.1 Displays prominent architectural notice regarding bank persistence limitation', () => {
      render(
        <Step2ApplicantBank
          application={MOCK_APPLICATION}
          onSuccess={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/Bank Details Persistence Limitation/i)).toBeInTheDocument();
      expect(screen.getByText(/bank accounts are legally bound to/i)).toBeInTheDocument();
      expect(screen.getByText(/Publication Authors/i)).toBeInTheDocument();
      expect(screen.getByText(/retained in client session memory during this intake step/i)).toBeInTheDocument();
    });

    it('3.2 Rejects account number mismatch and enforces valid IFSC uppercase regex', () => {
      const successSpy = vi.fn();
      render(
        <Step2ApplicantBank
          application={MOCK_APPLICATION}
          onSuccess={successSpy}
          onBack={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText(/Account Holder Name/i), { target: { value: 'Dr. Vikram Sharma' } });
      fireEvent.change(screen.getByLabelText(/Bank Institution Name/i), { target: { value: 'State Bank of India' } });
      fireEvent.change(screen.getByLabelText(/^Bank Account Number/i), { target: { value: '12345678901' } });
      fireEvent.change(screen.getByLabelText(/Confirm Bank Account Number/i), { target: { value: '12345678999' } }); // Mismatch
      fireEvent.change(screen.getByLabelText(/IFSC Code/i), { target: { value: 'invalid_ifsc' } });
      fireEvent.change(screen.getByLabelText(/Branch Name/i), { target: { value: 'CSJMU Campus' } });

      fireEvent.click(screen.getByRole('button', { name: /Continue to Publications/i }));

      expect(screen.getByText(/Account numbers do not match/i)).toBeInTheDocument();
      expect(screen.getByText(/Invalid IFSC format/i)).toBeInTheDocument();
      expect(successSpy).not.toHaveBeenCalled();
    });

    it('3.3 Excludes confirm_account_number from payload delivered to onSuccess', () => {
      const successSpy = vi.fn();
      render(
        <Step2ApplicantBank
          application={MOCK_APPLICATION}
          onSuccess={successSpy}
          onBack={vi.fn()}
        />
      );

      fireEvent.change(screen.getByLabelText(/Account Holder Name/i), { target: { value: 'Dr. Vikram Sharma' } });
      fireEvent.change(screen.getByLabelText(/Bank Institution Name/i), { target: { value: 'State Bank of India' } });
      fireEvent.change(screen.getByLabelText(/^Bank Account Number/i), { target: { value: '12345678901' } });
      fireEvent.change(screen.getByLabelText(/Confirm Bank Account Number/i), { target: { value: '12345678901' } }); // Matches
      fireEvent.change(screen.getByLabelText(/IFSC Code/i), { target: { value: 'SBIN0001234' } });
      fireEvent.change(screen.getByLabelText(/Branch Name/i), { target: { value: 'CSJMU Campus' } });

      fireEvent.click(screen.getByRole('button', { name: /Continue to Publications/i }));

      expect(successSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          account_holder_name: 'Dr. Vikram Sharma',
          bank_name: 'State Bank of India',
          account_number: '12345678901',
          ifsc_code: 'SBIN0001234',
          branch_name: 'CSJMU Campus',
          account_type: 'SAVINGS',
        })
      );

      // Verify confirm_account_number was NOT sent in payload
      const submittedData = successSpy.mock.calls[0][0];
      expect(submittedData.confirm_account_number).toBeUndefined();
    });
  });

  describe('4. Step 3: Dynamic Publications Manager', () => {
    it('4.1 Rejects publication date before 2026-01-01 and enforces CSJMU affiliation', async () => {
      render(
        <Step3Publications
          application={MOCK_APPLICATION}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText(/No Publications Added Yet/i)).toBeInTheDocument();

      // Open Add Modal
      fireEvent.click(screen.getByRole('button', { name: /\+ Add Publication/i }));

      expect(screen.getByText('Add Research Publication')).toBeInTheDocument();

      // Enter publication date before 2026-01-01
      fireEvent.change(screen.getByLabelText(/Paper Title/i), { target: { value: 'Machine Learning in Optics' } });
      fireEvent.change(screen.getByLabelText(/Journal Name/i), { target: { value: 'Nature Photonics' } });
      fireEvent.change(screen.getByLabelText(/Official Publication Date/i), { target: { value: '2025-11-20' } }); // Ineligible
      fireEvent.click(screen.getByLabelText(/Affiliation Affirmation/i)); // Uncheck affiliation

      fireEvent.click(screen.getByRole('button', { name: 'Add Publication' }));

      expect(screen.getByText(/Only works published on or after January 1, 2026 are eligible/i)).toBeInTheDocument();
      expect(screen.getByText(/Publication must bear explicit CSJMU institutional affiliation/i)).toBeInTheDocument();
    });

    it('4.2 Detects intra-draft duplicate DOI client-side and handles backend HTTP 409 conflict', async () => {
      const appWithPub: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION,
        publications: [
          {
            id: 'pub-existing-1',
            application_id: MOCK_APPLICATION.id,
            paper_title: 'Existing Paper',
            journal_name: 'Science Advances',
            doi: '10.1016/j.neucom.2026.001',
            normalized_doi: '10.1016/j.neucom.2026.001',
            publication_date: '2026-02-10',
            publication_year: 2026,
            document_type: 'ARTICLE',
            indexing_type: 'SCOPUS',
            has_csjmu_affiliation: true,
            applicant_declared_quartile: 'Q1',
            authors: [],
            documents: [],
            created_at: '2026-11-08T18:00:00Z',
            publication_status: 'PUBLISHED',
          },
        ],
      };

      render(
        <Step3Publications
          application={appWithPub}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText('Existing Paper')).toBeInTheDocument();

      // Try adding another paper with same DOI
      fireEvent.click(screen.getByRole('button', { name: /\+ Add Publication/i }));

      fireEvent.change(screen.getByLabelText(/Paper Title/i), { target: { value: 'Second Paper Same DOI' } });
      fireEvent.change(screen.getByLabelText(/Journal Name/i), { target: { value: 'Science Advances' } });
      fireEvent.change(screen.getByLabelText(/Digital Object Identifier/i), { target: { value: '10.1016/j.neucom.2026.001' } });
      fireEvent.change(screen.getByLabelText(/Official Publication Date/i), { target: { value: '2026-03-01' } });

      fireEvent.click(screen.getByRole('button', { name: 'Add Publication' }));

      expect(screen.getByText(/A publication with this DOI is already added to your application draft/i)).toBeInTheDocument();
    });

    it('4.3 Calls addPublication, updatePublication, and deletePublication with confirmation', async () => {
      const addSpy = vi.spyOn(anudaanService, 'addPublication').mockResolvedValueOnce({
        success: true,
        message: 'Created',
        data: {} as any,
      });

      const getSpy = vi.spyOn(anudaanService, 'getDraft').mockResolvedValueOnce({
        success: true,
        message: 'OK',
        data: {
          ...MOCK_APPLICATION,
          publications: [
            {
              id: 'pub-new-1',
              application_id: MOCK_APPLICATION.id,
              paper_title: 'Deep Learning in Nanophotonics',
              journal_name: 'Optics Express',
              doi: '10.1364/OE.2026.001',
              normalized_doi: '10.1364/oe.2026.001',
              publication_date: '2026-01-15',
              publication_year: 2026,
              document_type: 'ARTICLE',
              indexing_type: 'SCOPUS_AND_WOS',
              has_csjmu_affiliation: true,
              applicant_declared_quartile: 'Q1',
              authors: [],
              documents: [],
              created_at: '2026-11-08T18:00:00Z',
              publication_status: 'PUBLISHED',
            },
          ],
        },
      });

      const refreshSpy = vi.fn();
      render(
        <Step3Publications
          application={MOCK_APPLICATION}
          onRefreshApplication={refreshSpy}
          onBack={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Add Publication/i }));

      fireEvent.change(screen.getByLabelText(/Paper Title/i), { target: { value: 'Deep Learning in Nanophotonics' } });
      fireEvent.change(screen.getByLabelText(/Journal Name/i), { target: { value: 'Optics Express' } });
      fireEvent.change(screen.getByLabelText(/Digital Object Identifier/i), { target: { value: '10.1364/OE.2026.001' } });
      fireEvent.change(screen.getByLabelText(/Official Publication Date/i), { target: { value: '2026-01-15' } });

      fireEvent.click(screen.getByRole('button', { name: 'Add Publication' }));

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith(
          MOCK_APPLICATION.id,
          expect.objectContaining({
            paper_title: 'Deep Learning in Nanophotonics',
            journal_name: 'Optics Express',
            doi: '10.1364/OE.2026.001',
          })
        );
        expect(refreshSpy).toHaveBeenCalled();
      });
    });
  });

  describe('5. AnudaanWizardPage Integration', () => {
    it('5.1 Restores draft from session and advances through intake steps', async () => {
      saveDraftSession({
        applicationId: MOCK_APPLICATION.id,
        applicationNumber: MOCK_APPLICATION.application_number,
        draftKey: 'test-secret-key-32-chars-long!',
      });

      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        message: 'OK',
        data: MOCK_APPLICATION,
      });

      vi.spyOn(anudaanService, 'updateDraft').mockResolvedValue({
        success: true,
        message: 'Updated',
        data: MOCK_APPLICATION,
      });

      render(
        <BrowserRouter>
          <AnudaanWizardPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('ANU-2026-00042')).toBeInTheDocument();
        expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
      });

      // Proceed to Step 2
      fireEvent.click(screen.getByRole('button', { name: /Save & Continue to Bank Details/i }));

      await waitFor(() => {
        expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
        expect(screen.getByText(/Applicant Bank Details Intake/i)).toBeInTheDocument();
      });
    });

    it('5.2 Displays empty state when no active draft session exists', async () => {
      render(
        <BrowserRouter>
          <AnudaanWizardPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/No Active Application Session Found/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Go to ANUDAAN Portal/i })).toBeInTheDocument();
      });
    });
  });
});
