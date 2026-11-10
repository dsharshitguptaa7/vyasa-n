import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { anudaanService } from '../services/anudaanService';
import { apiClient, ApiError } from '../../../services/apiClient';
import { saveDraftSession, clearDraftSession } from '../services/anudaanSession';
import {
  AnudaanApplicationCreateDraft,
  AnudaanPublicationCreate,
  AnudaanAuthorCreate,
  AnudaanApplicationSubmitRequest,
  MANDATORY_DECLARATION_TYPES,
  DRAFT_DECLARATION_TEXTS,
} from '../types/anudaan';

describe('ANUDAAN Typed API Service (anudaanService)', () => {
  beforeEach(() => {
    clearDraftSession();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. createDraft calls POST /modules/yajur-veda/anudaan/applications and caches session', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Draft application created successfully.',
      data: {
        application_id: 'app-uuid-1',
        application_number: 'ANU-2026-00001',
        tracking_secret: '32-character-secret-token-key-1',
        status: 'DRAFT',
        applicant_category: 'FACULTY_CAMPUS',
        full_name: 'Dr. Test Faculty',
        institutional_id: 'FAC001',
        department_name: 'Computer Science',
        created_at: '2026-11-08T18:00:00Z',
        message: 'Draft created',
      },
    });

    const payload: AnudaanApplicationCreateDraft = {
      applicant_category: 'FACULTY_CAMPUS',
      full_name: 'Dr. Test Faculty',
      institutional_id: 'FAC001',
      designation: 'Assistant Professor',
      department_name: 'Computer Science',
      mobile_number: '9876543210',
    };

    const res = await anudaanService.createDraft(payload);

    expect(postSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications',
      payload
    );
    expect(res.success).toBe(true);
    expect(res.data?.application_number).toBe('ANU-2026-00001');

    // Verify session was automatically cached in sessionStorage
    const stored = window.sessionStorage.getItem('anudaan_draft_auth');
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored || '{}').draftKey).toBe('32-character-secret-token-key-1');
  });

  it('2. getDraft calls GET /modules/yajur-veda/anudaan/applications/{id} with X-Anudaan-Draft-Key', async () => {
    const mockAppDetail = {
      id: 'app-uuid-1',
      application_number: 'ANU-2026-00001',
      applicant_category: 'FACULTY_CAMPUS',
      full_name: 'Dr. Test Faculty',
      institutional_id: 'FAC001',
      designation: 'Assistant Professor',
      department_name: 'Computer Science',
      mobile_number: '9876543210',
      status: 'DRAFT',
      publications: [],
      documents: [],
      declarations: [],
      created_at: '2026-11-08T18:00:00Z',
      updated_at: '2026-11-08T18:00:00Z',
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      message: 'OK',
      data: mockAppDetail as any,
    });

    // Provide key explicitly
    await anudaanService.getDraft('app-uuid-1', 'explicit-key-123');
    expect(getSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-uuid-1',
      { 'X-Anudaan-Draft-Key': 'explicit-key-123' }
    );

    // Fall back to stored session key
    saveDraftSession({
      applicationId: 'app-uuid-1',
      applicationNumber: 'ANU-2026-00001',
      draftKey: 'session-stored-key-456',
    });

    await anudaanService.getDraft('app-uuid-1');
    expect(getSpy).toHaveBeenLastCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-uuid-1',
      { 'X-Anudaan-Draft-Key': 'session-stored-key-456' }
    );
  });

  it('3. updateDraft calls PATCH /modules/yajur-veda/anudaan/applications/{id}', async () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      success: true,
      message: 'Updated',
      data: {} as any,
    });

    await anudaanService.updateDraft('app-1', { designation: 'Associate Professor' }, 'key-1');
    expect(patchSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-1',
      { designation: 'Associate Professor' },
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('4. addPublication calls POST /modules/yajur-veda/anudaan/applications/{id}/publications', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Created',
      data: {} as any,
    });

    const pubData: AnudaanPublicationCreate = {
      publication_date: '2026-02-15',
      document_type: 'ARTICLE',
      indexing_type: 'SCOPUS',
      paper_title: 'Quantum Machine Learning in Higher Education',
      journal_name: 'IEEE Transactions on Neural Networks',
      publication_year: 2026,
      applicant_declared_quartile: 'Q1',
    };

    await anudaanService.addPublication('app-1', pubData, 'key-1');
    expect(postSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-1/publications',
      pubData,
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('5. updatePublication and deletePublication call correct routes and methods', async () => {
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValueOnce({
      success: true,
      message: 'Updated',
      data: {} as any,
    });
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      success: true,
      message: 'Deleted',
    });

    await anudaanService.updatePublication('pub-1', { volume: '12' }, 'key-1');
    expect(patchSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/publications/pub-1',
      { volume: '12' },
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );

    await anudaanService.deletePublication('pub-1', 'key-1');
    expect(deleteSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/publications/pub-1',
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('6. addAuthor and deleteAuthor call correct author endpoints', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Author added',
      data: {} as any,
    });
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValueOnce({
      success: true,
      message: 'Author removed',
    });

    const authorPayload: AnudaanAuthorCreate = {
      full_name: 'Prof. Co-Author',
      author_role: 'CO_AUTHOR',
      author_order: 2,
    };

    await anudaanService.addAuthor('pub-1', authorPayload, 'key-1');
    expect(postSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/publications/pub-1/authors',
      authorPayload,
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );

    await anudaanService.deleteAuthor('auth-1', 'key-1');
    expect(deleteSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/authors/auth-1',
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('7. getVerifiedBankAccounts calls application-scoped route (SEC-01)', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: [],
    });

    await anudaanService.getVerifiedBankAccounts('person-uuid', 'app-uuid', 'key-1');
    expect(getSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-uuid/people/person-uuid/verified-bank-accounts',
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('8. uploadDocument constructs FormData and uses postFormData without manual Content-Type', async () => {
    const postFormDataSpy = vi.spyOn(apiClient, 'postFormData').mockResolvedValueOnce({
      success: true,
      message: 'Uploaded',
      data: {} as any,
    });

    const file = new File(['%PDF-sample-content'], 'manuscript.pdf', { type: 'application/pdf' });
    await anudaanService.uploadDocument('app-1', file, 'PUBLISHED_PAPER', {
      publicationId: 'pub-1',
      draftKey: 'key-1',
    });

    expect(postFormDataSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-1/documents',
      expect.any(FormData),
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('9. submitApplication validates payload and calls submit endpoint', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      message: 'Submitted',
      data: {} as any,
    });

    const declarations = MANDATORY_DECLARATION_TYPES.map((type) => ({
      declaration_type: type,
      accepted: true,
      declaration_version: '1.0',
      declaration_text_snapshot: DRAFT_DECLARATION_TEXTS[type],
    }));

    const submitPayload: AnudaanApplicationSubmitRequest = { declarations };

    await anudaanService.submitApplication('app-1', submitPayload, 'key-1');
    expect(postSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/applications/app-1/submit',
      submitPayload,
      { 'X-Anudaan-Draft-Key': 'key-1' }
    );
  });

  it('10. trackApplication calls POST /modules/yajur-veda/anudaan/track with JSON body', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      message: 'OK',
      data: {
        application_number: 'ANU-2026-00001',
        status: 'SUBMITTED',
        applicant_name: 'Dr. Test',
        applicant_category: 'FACULTY_CAMPUS',
        department_name: 'Physics',
        publication_count: 1,
        publications: [],
        last_updated: '2026-11-08T18:00:00Z',
        status_description: 'Under review by Dean R&D',
      },
    });

    const res = await anudaanService.trackApplication({
      application_number: 'ANU-2026-00001',
      tracking_secret: '32-character-secret',
    });

    expect(postSpy).toHaveBeenCalledWith(
      '/modules/yajur-veda/anudaan/track',
      {
        application_number: 'ANU-2026-00001',
        tracking_secret: '32-character-secret',
      }
    );
    expect(res.data?.status).toBe('SUBMITTED');
  });
});
