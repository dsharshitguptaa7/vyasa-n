import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DocumentDetailPage } from '../DocumentDetailPage';
import { knowledgeAdminService } from '../../../services/knowledgeAdminService';
import { ApiError } from '../../../../services/apiClient';

vi.mock('../../../components/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-layout">{children}</div>,
}));

describe('DocumentDetailPage & Chunk Viewer Resiliency Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validDocId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

  const renderWithRoute = (initialPath: string) => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/knowledge-centre/documents/:documentId" element={<DocumentDetailPage />} />
          <Route path="/admin/knowledge-centre/documents" element={<div>Library Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('1. Rejects invalid or undefined document ID without making API calls', async () => {
    const detailSpy = vi.spyOn(knowledgeAdminService, 'getDocumentDetail');

    renderWithRoute('/admin/knowledge-centre/documents/undefined');

    await waitFor(() => {
      expect(screen.getByText(/Invalid Document Identifier/i)).toBeInTheDocument();
      expect(screen.getByText(/expected a canonical uuid/i)).toBeInTheDocument();
    });

    expect(detailSpy).not.toHaveBeenCalled();
  });

  it('2. Distinguishes genuine 404 Document Not Found from other errors', async () => {
    vi.spyOn(knowledgeAdminService, 'getDocumentDetail').mockRejectedValueOnce(
      new ApiError('Document not found', 404, 'NOT_FOUND')
    );

    renderWithRoute(`/admin/knowledge-centre/documents/${validDocId}`);

    await waitFor(() => {
      expect(screen.getByText(/Document Not Found/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(`Document with ID "${validDocId}" could not be found`, 'i'))).toBeInTheDocument();
    });
  });

  it('3. Distinguishes 403 Access Denied from Document Not Found', async () => {
    vi.spyOn(knowledgeAdminService, 'getDocumentDetail').mockRejectedValueOnce(
      new ApiError('Access denied: You do not have Super Admin permissions', 403, 'FORBIDDEN')
    );

    renderWithRoute(`/admin/knowledge-centre/documents/${validDocId}`);

    await waitFor(() => {
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(screen.getByText(/Super Admin permissions/i)).toBeInTheDocument();
    });
  });

  it('4. Renders document details and extracted chunks with headings and tokens', async () => {
    vi.spyOn(knowledgeAdminService, 'getDocumentDetail').mockResolvedValueOnce({
      document: {
        id: validDocId,
        title: 'Ph.D. Ordinance CSJMU 2026',
        description: 'Statutory ordinance governing doctoral research',
        domain: 'doctoral-studies',
        subdomain: 'Coursework Guidelines',
        document_type: 'ordinance',
        academic_session: '2026-27',
        issuing_authority: 'Academic Council',
        effective_from: '2026-08-01T00:00:00.000Z',
        effective_until: null,
        current_version_id: 'v1-uuid',
        status: 'active',
        uploaded_by_id: null,
        approved_by_id: null,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        published_at: '2026-08-01T00:00:00.000Z',
        archived_at: null,
        current_version: null,
        version_count: 1,
        chunk_count: 2,
      },
      versions: [
        {
          id: 'v1-uuid',
          version_number: 1,
          storage_key: 'vyasa-knowledge/doctoral-studies/v1_phd.pdf',
          checksum_sha256: 'abc123456789',
          original_filename: 'phd_ordinance.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1048576,
          extraction_status: 'indexed',
          processing_error: null,
          approval_status: 'approved',
          approved_by_id: null,
          approved_at: '2026-08-01T00:00:00.000Z',
          created_at: '2026-08-01T00:00:00.000Z',
          chunk_count: 2,
        },
      ],
      chunks: [
        {
          id: 'c1-uuid',
          chunk_index: 0,
          content: 'Coursework shall be compulsory for all enrolled Ph.D. scholars.',
          page_number: 3,
          section_heading: 'Section 4.1 Coursework Requirement',
          token_count: 35,
          verification_status: 'indexed',
          has_embedding: true,
        },
        {
          id: 'c2-uuid',
          chunk_index: 1,
          content: 'Minimum 55% marks required to qualify coursework examination.',
          page_number: 4,
          section_heading: 'Section 4.2 Passing Criteria',
          token_count: 42,
          verification_status: 'indexed',
          has_embedding: true,
        },
      ],
      total_chunks: 2,
    });

    renderWithRoute(`/admin/knowledge-centre/documents/${validDocId}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ph.D. Ordinance CSJMU 2026' })).toBeInTheDocument();
      expect(screen.getByText(/Section 4.1 Coursework Requirement/i)).toBeInTheDocument();
      expect(screen.getByText(/Section 4.2 Passing Criteria/i)).toBeInTheDocument();
      expect(screen.getByText(/Chunk #0/i)).toBeInTheDocument();
      expect(screen.getByText(/35 tokens/i)).toBeInTheDocument();
    });
  });

  it('5. Renders Processing State alert and empty state when document extraction is in progress', async () => {
    vi.spyOn(knowledgeAdminService, 'getDocumentDetail').mockResolvedValueOnce({
      document: {
        id: validDocId,
        title: 'Processing Document 2026',
        description: null,
        domain: 'admissions',
        subdomain: null,
        document_type: 'brochure',
        academic_session: '2026-27',
        issuing_authority: 'Director Admissions',
        effective_from: null,
        effective_until: null,
        current_version_id: null,
        status: 'processing',
        uploaded_by_id: null,
        approved_by_id: null,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        published_at: null,
        archived_at: null,
        current_version: null,
        version_count: 1,
        chunk_count: 0,
      },
      versions: [
        {
          id: 'v1-proc-uuid',
          version_number: 1,
          storage_key: 'vyasa-knowledge/admissions/v1_brochure.pdf',
          checksum_sha256: 'def456',
          original_filename: 'brochure.pdf',
          mime_type: 'application/pdf',
          size_bytes: 2048576,
          extraction_status: 'pending',
          processing_error: null,
          approval_status: 'pending',
          approved_by_id: null,
          approved_at: null,
          created_at: '2026-08-01T00:00:00.000Z',
          chunk_count: 0,
        },
      ],
      chunks: [],
      total_chunks: 0,
    });

    renderWithRoute(`/admin/knowledge-centre/documents/${validDocId}`);

    await waitFor(() => {
      expect(screen.getByText(/Text Extraction & Embedding In Progress/i)).toBeInTheDocument();
      expect(screen.getByText(/Extraction in progress.../i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /check for passages/i })).toBeInTheDocument();
    });
  });

  it('6. Renders Extraction Failed alert and Retry button when processing failed', async () => {
    vi.spyOn(knowledgeAdminService, 'getDocumentDetail').mockResolvedValueOnce({
      document: {
        id: validDocId,
        title: 'Failed Document',
        description: null,
        domain: 'doctoral-studies',
        subdomain: null,
        document_type: 'ordinance',
        academic_session: null,
        issuing_authority: null,
        effective_from: null,
        effective_until: null,
        current_version_id: null,
        status: 'failed',
        uploaded_by_id: null,
        approved_by_id: null,
        created_at: '2026-08-01T00:00:00.000Z',
        updated_at: '2026-08-01T00:00:00.000Z',
        published_at: null,
        archived_at: null,
        current_version: null,
        version_count: 1,
        chunk_count: 0,
      },
      versions: [
        {
          id: 'v1-failed-uuid',
          version_number: 1,
          storage_key: 'vyasa-knowledge/doctoral-studies/v1_bad.pdf',
          checksum_sha256: 'fail123',
          original_filename: 'bad.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1024,
          extraction_status: 'failed',
          processing_error: 'Corrupted PDF stream: EOF marker missing',
          approval_status: 'pending',
          approved_by_id: null,
          approved_at: null,
          created_at: '2026-08-01T00:00:00.000Z',
          chunk_count: 0,
        },
      ],
      chunks: [],
      total_chunks: 0,
    });

    const retrySpy = vi.spyOn(knowledgeAdminService, 'retryExtraction').mockResolvedValueOnce({} as any);

    renderWithRoute(`/admin/knowledge-centre/documents/${validDocId}`);

    await waitFor(() => {
      expect(screen.getByText(/Document Text Extraction Failed/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Corrupted PDF stream: EOF marker missing/i).length).toBeGreaterThanOrEqual(1);
    });

    const retryBtn = screen.getAllByRole('button', { name: /retry extraction/i })[0];
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(retrySpy).toHaveBeenCalledTimes(1);
    });
  });
});
