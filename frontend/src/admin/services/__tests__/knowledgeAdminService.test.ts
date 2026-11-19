import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { knowledgeAdminService } from '../knowledgeAdminService';
import { apiClient } from '../../../services/apiClient';

describe('Knowledge Admin Service (knowledgeAdminService)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. uploadDocument constructs FormData and delegates to apiClient.postFormData', async () => {
    const postFormDataSpy = vi.spyOn(apiClient, 'postFormData').mockResolvedValueOnce({
      success: true,
      message: 'Uploaded',
      data: {
        id: 'doc-uuid-1',
        title: 'Ph.D. Ordinance CSJMU FINAL 2024-25',
        domain: 'academic-regulations',
        document_type: 'ordinance',
      } as any,
    });

    const file = new File(['dummy docx bytes'], 'Ph.D. Ordinance CSJMU FINAL 2024-25 25.8.2-25.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const res = await knowledgeAdminService.uploadDocument({
      file,
      title: 'Ph.D. Ordinance CSJMU FINAL 2024-25',
      domain: 'academic-regulations',
      document_type: 'ordinance',
      academic_session: '2026-27',
      description: 'Authoritative PhD ordinance document',
    });

    expect(postFormDataSpy).toHaveBeenCalledTimes(1);
    expect(postFormDataSpy).toHaveBeenCalledWith(
      '/v1/admin/knowledge-centre/documents/upload',
      expect.any(FormData)
    );

    const formDataSent = postFormDataSpy.mock.calls[0][1] as FormData;
    expect(formDataSent.get('title')).toBe('Ph.D. Ordinance CSJMU FINAL 2024-25');
    expect(formDataSent.get('domain')).toBe('academic-regulations');
    expect(formDataSent.get('document_type')).toBe('ordinance');
    expect(formDataSent.get('academic_session')).toBe('2026-27');
    expect(formDataSent.get('description')).toBe('Authoritative PhD ordinance document');
    expect(formDataSent.get('subdomain')).toBeNull();
    expect(formDataSent.get('effective_from')).toBeNull();
    expect(formDataSent.get('effective_until')).toBeNull();
    expect(res.id).toBe('doc-uuid-1');
  });

  it('2. uploadDocument correctly populates all optional metadata when provided', async () => {
    const postFormDataSpy = vi.spyOn(apiClient, 'postFormData').mockResolvedValueOnce({
      success: true,
      message: 'Uploaded',
      data: { id: 'doc-uuid-2' } as any,
    });

    const file = new File(['dummy pdf'], 'rules.pdf', { type: 'application/pdf' });
    await knowledgeAdminService.uploadDocument({
      file,
      title: 'Doctoral Coursework Regulations',
      domain: 'doctoral-studies',
      document_type: 'regulation',
      subdomain: 'Coursework Guidelines',
      academic_session: '2026-27',
      issuing_authority: 'Academic Council',
      effective_from: '2026-08-01T00:00:00.000Z',
      effective_until: '2027-07-31T00:00:00.000Z',
      description: 'Coursework syllabus and assessment rules',
    });

    const formDataSent = postFormDataSpy.mock.calls[0][1] as FormData;
    expect(formDataSent.get('subdomain')).toBe('Coursework Guidelines');
    expect(formDataSent.get('issuing_authority')).toBe('Academic Council');
    expect(formDataSent.get('effective_from')).toBe('2026-08-01T00:00:00.000Z');
    expect(formDataSent.get('effective_until')).toBe('2027-07-31T00:00:00.000Z');
  });

  it('3. uploadNewVersion uses postFormData with target document ID', async () => {
    const postFormDataSpy = vi.spyOn(apiClient, 'postFormData').mockResolvedValueOnce({
      success: true,
      message: 'New version queued',
      data: { id: 'ver-uuid-2', version_number: 2 } as any,
    });

    const file = new File(['v2 content'], 'ordinance_v2.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const res = await knowledgeAdminService.uploadNewVersion('doc-uuid-1', { file });

    expect(postFormDataSpy).toHaveBeenCalledTimes(1);
    expect(postFormDataSpy).toHaveBeenCalledWith(
      '/v1/admin/knowledge-centre/documents/doc-uuid-1/versions',
      expect.any(FormData)
    );
    expect(res.version_number).toBe(2);
  });
});
