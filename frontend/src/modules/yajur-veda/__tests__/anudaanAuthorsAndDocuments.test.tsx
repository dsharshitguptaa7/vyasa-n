import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Step4AuthorsAndBank } from '../components/Step4AuthorsAndBank';
import { Step5Documents } from '../components/Step5Documents';
import { AnudaanWizardPage } from '../pages/AnudaanWizardPage';
import { anudaanService } from '../services/anudaanService';
import { saveDraftSession, clearDraftSession } from '../services/anudaanSession';
import {
  AnudaanApplicationDetailOut,
  AnudaanPublicationOut,
  AnudaanAuthorOut,
  AnudaanSafeBankAccountOut,
  AnudaanDocumentOut,
  AnudaanBankAccountInput,
} from '../types/anudaan';

const MOCK_PUB_1: AnudaanPublicationOut = {
  id: 'pub-001',
  application_id: 'app-001',
  paper_title: 'Quantum Computing and Machine Learning in Complex Networks',
  journal_name: 'IEEE Transactions on Quantum Engineering',
  issn: '2689-1808',
  e_issn: null,
  applicant_declared_quartile: 'Q1',
  indexing_type: 'SCOPUS_AND_WOS',
  has_csjmu_affiliation: true,
  doi: '10.1109/TQE.2026.001',
  publication_date: '2026-03-15',
  publication_year: 2026,
  document_type: 'ARTICLE',
  publication_status: 'PUBLISHED',
  authors: [],
  documents: [],
  created_at: '2026-11-08T18:00:00Z',
  updated_at: '2026-11-08T18:00:00Z',
};

const MOCK_CACHED_BANK: AnudaanBankAccountInput = {
  account_holder_name: 'Dr. Vikram Sharma',
  bank_name: 'State Bank of India',
  branch_name: 'CSJMU Campus Branch',
  account_number: '123456789012',
  confirm_account_number: '123456789012',
  ifsc_code: 'SBIN0001234',
  account_type: 'SAVINGS',
  pan_number: 'ABCDE1234F',
};

const MOCK_APPLICANT_BANK: AnudaanSafeBankAccountOut = {
  id: 'bank-applicant-001',
  account_holder_name: 'Dr. Vikram Sharma',
  bank_name: 'State Bank of India',
  branch_name: 'CSJMU Campus Branch',
  ifsc_code: 'SBIN0001234',
  masked_account_number: '••••••••9012',
  masked_pan: '••••••1234F',
  ownership_verification_status: 'VERIFIED',
  created_at: '2026-11-08T18:00:00Z',
};

const MOCK_CORR_BANK: AnudaanSafeBankAccountOut = {
  id: 'bank-corr-002',
  account_holder_name: 'Dr. Anita Roy',
  bank_name: 'Punjab National Bank',
  branch_name: 'Civil Lines, Kanpur',
  ifsc_code: 'PUNB0123400',
  masked_account_number: '••••••••5678',
  masked_pan: '••••••4567G',
  ownership_verification_status: 'VERIFIED',
  created_at: '2026-11-08T18:00:00Z',
};

const MOCK_AUTHOR_FIRST: AnudaanAuthorOut = {
  id: 'author-001',
  publication_id: 'pub-001',
  person_id: 'person-001',
  full_name: 'Dr. Vikram Sharma',
  author_role: 'FIRST',
  author_order: 1,
  is_csjmu_affiliated: true,
  has_multiple_corresponding_authors: false,
  is_nominated_corresponding_author: false,
  bank_reuse_selected: false,
  bank_account: MOCK_APPLICANT_BANK,
  created_at: '2026-11-08T18:00:00Z',
};

const MOCK_AUTHOR_CORR: AnudaanAuthorOut = {
  id: 'author-002',
  publication_id: 'pub-001',
  person_id: 'person-002',
  full_name: 'Dr. Anita Roy',
  author_role: 'CORRESPONDING',
  author_order: 2,
  is_csjmu_affiliated: true,
  has_multiple_corresponding_authors: false,
  is_nominated_corresponding_author: true,
  bank_reuse_selected: false,
  bank_account: MOCK_CORR_BANK,
  created_at: '2026-11-08T18:00:00Z',
};

const MOCK_APPLICATION_BASE: AnudaanApplicationDetailOut = {
  id: 'app-001',
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
  publications: [MOCK_PUB_1],
  documents: [],
  declarations: [],
  created_at: '2026-11-08T18:00:00Z',
  updated_at: '2026-11-08T18:00:00Z',
};

describe('ANUDAAN Phase 4.3 Author Attribution, Bank Mapping & Documents Suite', () => {
  beforeEach(() => {
    clearDraftSession();
    vi.restoreAllMocks();
  });

  describe('1. Step 4 — Publication Author Attribution & Bank Mapping', () => {
    it('1.1 Displays author roles, badges, and enforces mandatory requirements gate', () => {
      render(
        <Step4AuthorsAndBank
          application={MOCK_APPLICATION_BASE}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      // Section title and publication card
      expect(screen.getByText('Author Attribution & Bank Mapping')).toBeInTheDocument();
      expect(screen.getByText(/Quantum Computing and Machine Learning in Complex Networks/i)).toBeInTheDocument();

      // Incomplete badge
      expect(screen.getByText('Incomplete Attributions')).toBeInTheDocument();

      // Proceed button is disabled
      const continueBtn = screen.getByRole('button', { name: /Complete All Author Attributions to Continue/i });
      expect(continueBtn).toBeDisabled();
    });

    it('1.2 Validates single cardinality of First Author and prevents duplicates', async () => {
      const appWithFirstAuthor: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION_BASE,
        publications: [
          {
            ...MOCK_PUB_1,
            authors: [MOCK_AUTHOR_FIRST],
          },
        ],
      };

      render(
        <Step4AuthorsAndBank
          application={appWithFirstAuthor}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      // Existing First Author displayed
      expect(screen.getByText('Dr. Vikram Sharma')).toBeInTheDocument();
      expect(screen.getByText('✓ First Author Assigned')).toBeInTheDocument();

      // Open add author modal
      fireEvent.click(screen.getByRole('button', { name: /\+ Add Author/i }));
      expect(screen.getByText('Add Author Attribution')).toBeInTheDocument();

      // Attempt to add a second First Author
      const roleSelect = screen.getByLabelText(/Author Role/i);
      fireEvent.change(roleSelect, { target: { value: 'FIRST' } });

      fireEvent.change(screen.getByLabelText(/^Full Name/i), {
        target: { value: 'Dr. Second Author' },
      });

      // Submit modal
      fireEvent.click(screen.getByRole('button', { name: /Save Author Attribution/i }));

      // Error banner should prevent second First Author
      await waitFor(() => {
        expect(
          screen.getByText(/This paper already has a designated First Author \(Dr\. Vikram Sharma\)\. Only 1 First Author is permitted\./i)
        ).toBeInTheDocument();
      });
    });

    it('1.3 Enforces co-author non-payable policy and hides bank detail inputs', () => {
      render(
        <Step4AuthorsAndBank
          application={MOCK_APPLICATION_BASE}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Add Author/i }));

      // Select Co-Author role
      const roleSelect = screen.getByLabelText(/Author Role/i);
      fireEvent.change(roleSelect, { target: { value: 'CO_AUTHOR' } });

      // Informative banner explaining co-authors do not receive direct payouts
      expect(
        screen.getByText(/Co-authors are not eligible for cash incentive disbursement\. No bank account is collected\./i)
      ).toBeInTheDocument();

      // Bank account selection options should NOT appear
      expect(screen.queryByText(/Designated Bank Account for Incentive Payout/i)).not.toBeInTheDocument();
    });

    it('1.4 Adds First Author using applicant bank reuse (Strategy A)', async () => {
      const addAuthorSpy = vi.spyOn(anudaanService, 'addAuthor').mockResolvedValue({
        success: true,
        data: MOCK_AUTHOR_FIRST,
        message: 'Author added',
      });
      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        data: {
          ...MOCK_APPLICATION_BASE,
          publications: [{ ...MOCK_PUB_1, authors: [MOCK_AUTHOR_FIRST] }],
        },
      });
      const refreshSpy = vi.fn();

      render(
        <Step4AuthorsAndBank
          application={MOCK_APPLICATION_BASE}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={refreshSpy}
          onBack={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Add Author/i }));

      // Fill author details
      fireEvent.change(screen.getByLabelText(/^Full Name/i), {
        target: { value: 'Dr. Vikram Sharma' },
      });

      // Toggle "This author is the Applicant (Dr. Vikram Sharma)"
      const applicantToggle = screen.getByLabelText(/This author is the Applicant/i);
      fireEvent.click(applicantToggle);

      // Strategy "Use Applicant Bank (Step 2)" should be active
      expect(screen.getByText(/Designated Applicant Bank Particulars/i)).toBeInTheDocument();

      // Submit modal
      fireEvent.click(screen.getByRole('button', { name: /Save Author Attribution/i }));

      await waitFor(() => {
        expect(addAuthorSpy).toHaveBeenCalledWith(
          'pub-001',
          expect.objectContaining({
            full_name: 'Dr. Vikram Sharma',
            author_role: 'FIRST',
            is_nominated_corresponding_author: false,
            new_bank_details: expect.objectContaining({
              account_holder_name: 'Dr. Vikram Sharma',
              bank_name: 'State Bank of India',
              account_number: '123456789012',
              ifsc_code: 'SBIN0001234',
            }),
          })
        );
        expect(refreshSpy).toHaveBeenCalled();
      });
    });

    it('1.5 Adds Corresponding Author with new bank account details (Strategy C)', async () => {
      const addAuthorSpy = vi.spyOn(anudaanService, 'addAuthor').mockResolvedValue({
        success: true,
        data: MOCK_AUTHOR_CORR,
        message: 'Author added',
      });
      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        data: {
          ...MOCK_APPLICATION_BASE,
          publications: [{ ...MOCK_PUB_1, authors: [MOCK_AUTHOR_CORR] }],
        },
      });
      const refreshSpy = vi.fn();

      render(
        <Step4AuthorsAndBank
          application={MOCK_APPLICATION_BASE}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={refreshSpy}
          onBack={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /\+ Add Author/i }));

      // Fill author details
      fireEvent.change(screen.getByLabelText(/^Full Name/i), {
        target: { value: 'Dr. Anita Roy' },
      });

      // Change role to CORRESPONDING
      const roleSelect = screen.getByLabelText(/Author Role/i);
      fireEvent.change(roleSelect, { target: { value: 'CORRESPONDING' } });

      // Click "Enter New Bank Details" button
      fireEvent.click(screen.getByRole('button', { name: /Enter New Bank Details/i }));

      // Fill new bank details
      fireEvent.change(screen.getByLabelText(/Account Holder Name/i), { target: { value: 'Dr. Anita Roy' } });
      fireEvent.change(screen.getByLabelText(/Bank Institution Name/i), { target: { value: 'Punjab National Bank' } });
      fireEvent.change(screen.getByLabelText(/Branch Name/i), { target: { value: 'Civil Lines' } });
      fireEvent.change(screen.getByLabelText(/^Account Number/i), { target: { value: '123456789012' } });
      fireEvent.change(screen.getByLabelText(/Confirm Account Number/i), { target: { value: '123456789012' } });
      fireEvent.change(screen.getByLabelText(/IFSC Code/i), { target: { value: 'PUNB0123400' } });
      fireEvent.change(screen.getByLabelText(/PAN/i), { target: { value: 'ABCDE1234F' } });

      fireEvent.click(screen.getByRole('button', { name: /Save Author Attribution/i }));

      await waitFor(() => {
        expect(addAuthorSpy).toHaveBeenCalledWith(
          'pub-001',
          expect.objectContaining({
            full_name: 'Dr. Anita Roy',
            author_role: 'CORRESPONDING',
            is_nominated_corresponding_author: true,
            new_bank_details: expect.objectContaining({
              account_holder_name: 'Dr. Anita Roy',
              bank_name: 'Punjab National Bank',
              account_number: '123456789012',
              confirm_account_number: '123456789012',
              ifsc_code: 'PUNB0123400',
              pan_number: 'ABCDE1234F',
            }),
          })
        );
        expect(refreshSpy).toHaveBeenCalled();
      });
    });

    it('1.6 Deletes author upon user confirmation', async () => {
      const deleteAuthorSpy = vi.spyOn(anudaanService, 'deleteAuthor').mockResolvedValue({
        success: true,
        data: undefined,
        message: 'Author removed',
      });
      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        data: {
          ...MOCK_APPLICATION_BASE,
          publications: [{ ...MOCK_PUB_1, authors: [MOCK_AUTHOR_CORR] }],
        },
      });
      const refreshSpy = vi.fn();

      const appWithAuthors: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION_BASE,
        publications: [
          {
            ...MOCK_PUB_1,
            authors: [MOCK_AUTHOR_FIRST, MOCK_AUTHOR_CORR],
          },
        ],
      };

      render(
        <Step4AuthorsAndBank
          application={appWithAuthors}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={refreshSpy}
          onBack={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      // Find remove button for author
      const removeButtons = screen.getAllByRole('button', { name: /^Remove$/i });
      fireEvent.click(removeButtons[0]);

      // Confirm modal pops up
      expect(screen.getByText('Confirm Author Removal')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Confirm Remove$/i }));

      await waitFor(() => {
        expect(deleteAuthorSpy).toHaveBeenCalledWith('author-001');
        expect(refreshSpy).toHaveBeenCalled();
      });
    });

    it('1.7 Successfully navigates to Step 5 when all publication author requirements are met', () => {
      const successSpy = vi.fn();
      const appComplete: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION_BASE,
        publications: [
          {
            ...MOCK_PUB_1,
            authors: [MOCK_AUTHOR_FIRST, MOCK_AUTHOR_CORR],
          },
        ],
      };

      render(
        <Step4AuthorsAndBank
          application={appComplete}
          cachedBankData={MOCK_CACHED_BANK}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onSuccess={successSpy}
        />
      );

      // Requirements summary should show satisfied
      expect(screen.getByText('✓ All Publications Ready')).toBeInTheDocument();

      const continueBtn = screen.getByRole('button', { name: /Continue to Supporting Documents →/i });
      expect(continueBtn).not.toBeDisabled();

      fireEvent.click(continueBtn);
      expect(successSpy).toHaveBeenCalled();
    });
  });

  describe('2. Step 5 — Publication Supporting Document Management', () => {
    const MOCK_MANUSCRIPT_DOC: AnudaanDocumentOut = {
      id: 'doc-001',
      application_id: 'app-001',
      publication_id: 'pub-001',
      person_id: null,
      document_type: 'PUBLISHED_PAPER',
      original_filename: 'Quantum_Paper_IEEE_2026.pdf',
      file_size_bytes: 2 * 1024 * 1024,
      mime_type: 'application/pdf',
      created_at: '2026-11-08T18:30:00Z',
    };

    it('2.1 Displays published paper upload requirement and blocks completion if missing', () => {
      render(
        <Step5Documents
          application={MOCK_APPLICATION_BASE}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByText('Supporting Document Management')).toBeInTheDocument();
      expect(screen.getByText(/Quantum Computing and Machine Learning in Complex Networks/i)).toBeInTheDocument();
      expect(screen.getByText('Manuscripts Pending')).toBeInTheDocument();

      const completeBtn = screen.getByRole('button', { name: /Upload All Manuscript PDFs to Complete/i });
      expect(completeBtn).toBeDisabled();
    });

    it('2.2 Rejects non-PDF files', async () => {
      render(
        <Step5Documents
          application={MOCK_APPLICATION_BASE}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/Manuscript PDF for Quantum Computing/i) as HTMLInputElement;

      const textFile = new File(['dummy content'], 'paper.txt', { type: 'text/plain' });
      Object.defineProperty(fileInput, 'files', {
        value: [textFile],
        configurable: true,
        writable: true,
      });
      fireEvent.change(fileInput, { target: { files: [textFile] } });

      await waitFor(() => {
        expect(screen.getByText(/Only PDF documents \(\.pdf\) are permitted\./i)).toBeInTheDocument();
      });
    });

    it('2.3 Rejects PDF files exceeding 10 MB limit', async () => {
      render(
        <Step5Documents
          application={MOCK_APPLICATION_BASE}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/Manuscript PDF for Quantum Computing/i) as HTMLInputElement;

      const largeFile = new File(['mock content'], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(largeFile, 'size', {
        value: 11 * 1024 * 1024,
        configurable: true,
      });
      Object.defineProperty(fileInput, 'files', {
        value: [largeFile],
        configurable: true,
        writable: true,
      });
      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/exceeds the 10 MB limit/i)).toBeInTheDocument();
      });
    });

    it('2.4 Uploads valid published paper PDF and refreshes application', async () => {
      const uploadSpy = vi.spyOn(anudaanService, 'uploadDocument').mockResolvedValue({
        success: true,
        data: MOCK_MANUSCRIPT_DOC,
        message: 'Uploaded',
      });
      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        data: {
          ...MOCK_APPLICATION_BASE,
          documents: [MOCK_MANUSCRIPT_DOC],
        },
      });
      const refreshSpy = vi.fn();

      render(
        <Step5Documents
          application={MOCK_APPLICATION_BASE}
          onRefreshApplication={refreshSpy}
          onBack={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      const fileInput = screen.getByLabelText(/Manuscript PDF for Quantum Computing/i) as HTMLInputElement;
      const validPdf = new File(['%PDF-1.4 mock content'], 'IEEE_Quantum_Paper.pdf', { type: 'application/pdf' });

      Object.defineProperty(fileInput, 'files', {
        value: [validPdf],
        configurable: true,
        writable: true,
      });
      fireEvent.change(fileInput, { target: { files: [validPdf] } });

      const uploadBtn = screen.getByRole('button', { name: /Upload Manuscript/i });
      expect(uploadBtn).not.toBeDisabled();
      fireEvent.click(uploadBtn);

      await waitFor(() => {
        expect(uploadSpy).toHaveBeenCalledWith(
          'app-001',
          validPdf,
          'PUBLISHED_PAPER',
          { publicationId: 'pub-001' }
        );
        expect(refreshSpy).toHaveBeenCalled();
      });
    });

    it('2.5 Displays uploaded document metadata and deletes document upon confirmation', async () => {
      const deleteDocSpy = vi.spyOn(anudaanService, 'deleteDocument').mockResolvedValue({
        success: true,
        data: undefined,
        message: 'Deleted',
      });
      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        data: {
          ...MOCK_APPLICATION_BASE,
          documents: [],
        },
      });
      const refreshSpy = vi.fn();

      const appWithDoc: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION_BASE,
        documents: [MOCK_MANUSCRIPT_DOC],
      };

      render(
        <Step5Documents
          application={appWithDoc}
          onRefreshApplication={refreshSpy}
          onBack={vi.fn()}
          onComplete={vi.fn()}
        />
      );

      // Metadata displayed
      expect(screen.getByText('Quantum_Paper_IEEE_2026.pdf')).toBeInTheDocument();
      expect(screen.getByText(/2.00 MB/i)).toBeInTheDocument();

      // Trigger delete
      fireEvent.click(screen.getByRole('button', { name: /Remove PDF/i }));

      // Confirm delete dialog
      expect(screen.getByText('Confirm Manuscript Document Removal')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /^Confirm Remove$/i }));

      await waitFor(() => {
        expect(deleteDocSpy).toHaveBeenCalledWith('doc-001');
        expect(refreshSpy).toHaveBeenCalled();
      });
    });

    it('2.6 Allows completing Step 5 when all publications have manuscript PDFs attached', () => {
      const completeSpy = vi.fn();

      const appComplete: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION_BASE,
        documents: [MOCK_MANUSCRIPT_DOC],
      };

      render(
        <Step5Documents
          application={appComplete}
          onRefreshApplication={vi.fn()}
          onBack={vi.fn()}
          onComplete={completeSpy}
        />
      );

      const completeBtn = screen.getByRole('button', { name: /Complete Supporting Documents Intake →/i });
      expect(completeBtn).not.toBeDisabled();

      fireEvent.click(completeBtn);
      expect(completeSpy).toHaveBeenCalled();
    });
  });

  describe('3. Wizard Navigation & Draft Recovery Integration', () => {
    it('3.1 Allows clicking completed steps on draft recovery to navigate to Step 4 and Step 5', async () => {
      saveDraftSession({
        applicationId: 'app-001',
        applicationNumber: 'ANU-2026-00042',
        draftKey: 'AUTH_TOKEN_TEST',
        createdAt: '2026-11-08T18:00:00Z',
      });

      const fullDraftApplication: AnudaanApplicationDetailOut = {
        ...MOCK_APPLICATION_BASE,
        publications: [
          {
            ...MOCK_PUB_1,
            authors: [MOCK_AUTHOR_FIRST, MOCK_AUTHOR_CORR],
          },
        ],
        documents: [
          {
            id: 'doc-bank-001',
            application_id: 'app-001',
            publication_id: null,
            person_id: null,
            document_type: 'CANCELLED_CHEQUE',
            original_filename: 'Cheque.pdf',
            file_size_bytes: 1024,
            mime_type: 'application/pdf',
            created_at: '2026-11-08T18:00:00Z',
          },
        ],
      };

      vi.spyOn(anudaanService, 'getDraft').mockResolvedValue({
        success: true,
        data: fullDraftApplication,
      });

      render(
        <BrowserRouter>
          <AnudaanWizardPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('ANU-2026-00042')).toBeInTheDocument();
      });

      // Stepper indicates steps
      expect(screen.getByText('Authors & Bank')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();

      // Click Step 4 on Stepper (since Step 3 is completed, Step 4 is clickable or accessible)
      fireEvent.click(screen.getByText('Authors & Bank'));

      await waitFor(() => {
        expect(screen.getByText('Author Attribution & Bank Mapping')).toBeInTheDocument();
      });
    });
  });
});
