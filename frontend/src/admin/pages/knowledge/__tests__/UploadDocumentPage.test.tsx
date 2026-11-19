import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { UploadDocumentPage } from '../UploadDocumentPage';
import { knowledgeAdminService } from '../../../services/knowledgeAdminService';
import { ApiError } from '../../../../services/apiClient';

// Mock UI components that aren't critical to form behavior
vi.mock('../../../components/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-layout">{children}</div>,
}));

describe('UploadDocumentPage Component & Error Visibility Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <UploadDocumentPage />
      </MemoryRouter>
    );
  };

  it('1. Renders form and rejects submission if no file is selected', async () => {
    renderComponent();

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    // Button is disabled when no file is selected
    expect(submitBtn).toBeDisabled();

    // Trigger submit on form directly
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getAllByText(/please select a valid document file to upload/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('2. Submits valid DOCX file with user-reported metadata successfully', async () => {
    const uploadSpy = vi.spyOn(knowledgeAdminService, 'uploadDocument').mockResolvedValueOnce({
      id: 'doc-docx-1',
      title: 'Ph.D. Ordinance CSJMU FINAL 2024-25',
      domain: 'academic-regulations',
      document_type: 'ordinance',
      current_version_id: 'ver-1',
    } as any);

    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const docxFile = new File(['docx test content'], 'Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    fireEvent.change(fileInput, { target: { files: [docxFile] } });

    // File name and title auto-populate
    expect(screen.getByText(/Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25.docx/i)).toBeInTheDocument();

    // Fill Title
    const titleInput = screen.getByPlaceholderText(/e.g. CSJMU Ph.D. Ordinance/i);
    fireEvent.change(titleInput, { target: { value: 'Ph.D. Ordinance CSJMU FINAL 2024-25' } });

    // Select domain
    const domainSelect = screen.getByDisplayValue(/Doctoral Studies/i);
    fireEvent.change(domainSelect, { target: { value: 'academic-regulations' } });

    // Select document type
    const docTypeSelect = screen.getByDisplayValue(/Institutional Policy/i);
    fireEvent.change(docTypeSelect, { target: { value: 'ordinance' } });

    // Academic session
    const sessionInput = screen.getByPlaceholderText(/e.g. 2026-27/i);
    fireEvent.change(sessionInput, { target: { value: '2026-27' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/document uploaded successfully!/i)).toBeInTheDocument();
    });
  });

  it('3. Submits valid PDF file successfully', async () => {
    const uploadSpy = vi.spyOn(knowledgeAdminService, 'uploadDocument').mockResolvedValueOnce({
      id: 'doc-pdf-1',
      title: 'Academic Regulations 2026',
      domain: 'academic-regulations',
      document_type: 'regulation',
      current_version_id: 'ver-pdf-1',
    } as any);

    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const pdfFile = new File(['%PDF sample'], 'regulations.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdfFile] } });

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/document uploaded successfully!/i)).toBeInTheDocument();
    });
  });

  it('4. Rejects invalid academic session with actionable validation error', async () => {
    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const testFile = new File(['content'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const sessionInput = screen.getByPlaceholderText(/e.g. 2026-27/i);
    fireEvent.change(sessionInput, { target: { value: '2026/27-invalid' } });

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Academic session must be in the format YYYY-YY or YYYY-YYYY/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('5. Handles backend HTTP 422 with structured field details and renders actionable message', async () => {
    const apiErr = new ApiError(
      'Request validation failed',
      422,
      'VALIDATION_ERROR',
      [
        { loc: ['body', 'academic_session'], msg: 'Academic session must be in the format YYYY-YY or YYYY-YYYY (e.g. 2026-27 or 2026-2027).' },
      ]
    );

    vi.spyOn(knowledgeAdminService, 'uploadDocument').mockRejectedValueOnce(apiErr);

    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const testFile = new File(['content'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Must NOT display only generic "Request validation failed"
      expect(screen.getByText(/Upload rejected: academic session: Academic session must be in the format/i)).toBeInTheDocument();
    });
  });

  it('6. Handles duplicate document HTTP 409 conflict cleanly', async () => {
    const apiErr = new ApiError(
      'Document with identical content (SHA-256: abc123def) already exists in knowledge base: Document ID doc-1, Version 1.',
      409,
      'DUPLICATE_DOCUMENT'
    );

    vi.spyOn(knowledgeAdminService, 'uploadDocument').mockRejectedValueOnce(apiErr);

    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const testFile = new File(['content'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Duplicate document: Document with identical content/i)).toBeInTheDocument();
    });
  });

  it('7. Handles network failure gracefully without exposing raw traces', async () => {
    const networkErr = new ApiError(
      'Unable to connect to VYASA backend service. Please verify network connectivity.',
      0,
      'NETWORK_ERROR'
    );

    vi.spyOn(knowledgeAdminService, 'uploadDocument').mockRejectedValueOnce(networkErr);

    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const testFile = new File(['content'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Network error: Unable to connect to VYASA backend service/i)).toBeInTheDocument();
    });
  });

  it('8. Preserves selected file and form metadata after an upload error', async () => {
    const apiErr = new ApiError('Upload failed: Server error', 500);
    vi.spyOn(knowledgeAdminService, 'uploadDocument').mockRejectedValueOnce(apiErr);

    renderComponent();

    const fileInput = document.getElementById('knowledge-file-input') as HTMLInputElement;
    const testFile = new File(['my binary content'], 'custom_ordinance.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    fireEvent.change(fileInput, { target: { files: [testFile] } });

    const titleInput = screen.getByPlaceholderText(/e.g. CSJMU Ph.D. Ordinance/i) as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'My Preserved Ordinance Title' } });

    const sessionInput = screen.getByPlaceholderText(/e.g. 2026-27/i) as HTMLInputElement;
    fireEvent.change(sessionInput, { target: { value: '2026-27' } });

    const submitBtn = screen.getByRole('button', { name: /upload & extract passages/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Upload failed: Server error/i)).toBeInTheDocument();
    });

    // Form inputs and file must still be present and preserved!
    expect(screen.getByText(/custom_ordinance.docx/i)).toBeInTheDocument();
    expect(titleInput.value).toBe('My Preserved Ordinance Title');
    expect(sessionInput.value).toBe('2026-27');
  });
});
