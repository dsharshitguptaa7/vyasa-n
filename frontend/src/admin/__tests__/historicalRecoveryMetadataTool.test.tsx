import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../context/AuthContext';
import { samaAdminService } from '../services/samaAdminService';
import CertificatesPage from '../pages/sama/CertificatesPage';

const mockAuth = () => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: {
      id: 'usr-admin-1',
      email: 'admin@csjmu.ac.in',
      first_name: 'Super',
      last_name: 'Admin',
      role: 'super_admin',
      roles: ['super_admin'],
      is_active: true,
      is_verified: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    token: 'mock-jwt-token',
    isAuthenticated: true,
    isLoading: false,
    isAdmin: true,
    isSuperAdmin: true,
    isAuthority: false,
    isApplicant: false,
    isManager: false,
    isAssistantDean: false,
    isAssociateDean: false,
    isDean: false,
    authorityRole: null,
    authorityId: null,
    authorityDesignation: null,
    persona: 'admin',
    displayName: 'Super Admin',
    login: vi.fn(),
    logout: vi.fn(),
  });
};

describe('CertificatesPage — Historical Certificate Recovery Metadata & PDF Repair Tool', () => {
  const activeCert = {
    id: 'cert-active-001',
    certificate_number: 'CSJMU/SAMIKSHA/2026/000001',
    record_type: 'active' as const,
    is_legacy: false,
    status: 'ISSUED' as const,
    title: 'Certificate of Appreciation & Research Excellence',
    research_title: 'Quantum Diagnostics and Microfluidics',
    recipient_name: 'Dr. Active Scholar',
    created_at: '2026-10-14T00:00:00Z',
    download_count: 2,
    authors: [
      {
        id: 'auth-active-1',
        certificate_id: 'cert-active-001',
        author_name_snapshot: 'Dr. Active Scholar',
        affiliation_snapshot: 'CSJMU Kanpur',
        department_snapshot: 'Physics',
        author_order: 1,
        author_role: 'CORRESPONDING_AUTHOR' as const,
      },
    ],
  };

  const historicalCert = {
    id: 'cert-hist-002',
    certificate_number: 'CSJMU/SAMIKSHA/2026/000002',
    record_type: 'historical' as const,
    is_legacy: true,
    status: 'HISTORICAL' as const,
    title: 'Certificate of Appreciation for Research Publication',
    research_title: 'Historical Nanotechnology in Renewable Energy',
    recipient_name: 'Dr. Historical Pioneer',
    scopus_id: '57209998888',
    storage_key: 'sama_veda/certificates/recovered_000002.pdf',
    created_at: '2026-06-01T00:00:00Z',
    download_count: 0,
    publication_details: {
      scopus_id: '57209998888',
      storage_key: 'sama_veda/certificates/recovered_000002.pdf',
      department: 'Chemistry',
      issue_reference: 'Volume 2, Issue 3 (July - September 2026)',
    },
    authors: [
      {
        id: 'auth-hist-1',
        certificate_id: 'cert-hist-002',
        author_name_snapshot: 'Dr. Historical Pioneer',
        scopus_id_snapshot: '57209998888',
        affiliation_snapshot: 'CSJMU Kanpur',
        department_snapshot: 'Chemistry',
        author_order: 1,
        author_role: 'CORRESPONDING_AUTHOR' as const,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();

    vi.spyOn(samaAdminService, 'getCertificateStats').mockResolvedValue({
      total_certificates: 2,
      total_issued: 2,
      draft_certificates: 0,
      pending_approvals: 0,
      scheduled_certificates: 0,
      issued_certificates: 2,
      revoked_certificates: 0,
      reissued_certificates: 0,
      total_researchers_linked: 2,
    });

    vi.spyOn(samaAdminService, 'getCertificates').mockResolvedValue({
      items: [activeCert, historicalCert],
      total: 2,
    });
    vi.spyOn(samaAdminService, 'getAuthors').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getPublications').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getTemplates').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getSignatories').mockResolvedValue({ items: [], total: 0 });
  });

  it('1. Renders "Edit Recovery Metadata" only for historical certificates', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000001')).toBeInTheDocument();
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000002')).toBeInTheDocument();
    });

    // Exactly 1 "Edit Recovery Metadata" button rendered (for the historical certificate)
    const editButtons = screen.getAllByRole('button', { name: /Edit Recovery Metadata/i });
    expect(editButtons.length).toBe(1);
  });

  it('2. Opens modal pre-populated with original historical metadata and storage key', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000002')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /Edit Recovery Metadata/i });
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText(/Edit Recovery Metadata — CSJMU\/SAMIKSHA\/2026\/000002/i)).toBeInTheDocument();
    });

    // Inputs should contain initial values
    const scopusInput = screen.getByPlaceholderText(/e\.g\. 57201234567/i) as HTMLInputElement;
    expect(scopusInput.value).toBe('57209998888');

    const storageKeyInput = screen.getByPlaceholderText(/e\.g\. sama_veda\/certificates\/CSJMU_SAMIKSHA_2026_000001\.pdf/i) as HTMLInputElement;
    expect(storageKeyInput.value).toBe('sama_veda/certificates/recovered_000002.pdf');
  });

  it('3. "Test PDF Availability" invokes API and displays verified status', async () => {
    const testPdfSpy = vi.spyOn(samaAdminService, 'testPdfAvailability').mockResolvedValue({
      status: 'found',
      exists: true,
      message: 'Historical PDF verified in Spaces (1,048,576 bytes).',
      file_size_bytes: 1048576,
      storage_key: 'sama_veda/certificates/recovered_000002.pdf',
      provider: 'digitalocean_spaces',
    });

    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000002')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Recovery Metadata/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Test PDF Availability/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Test PDF Availability/i }));

    await waitFor(() => {
      expect(testPdfSpy).toHaveBeenCalledWith('cert-hist-002', 'sama_veda/certificates/recovered_000002.pdf');
      expect(screen.getByText(/✓ Object Verified in Storage/i)).toBeInTheDocument();
      expect(screen.getByText(/Historical PDF verified in Spaces/i)).toBeInTheDocument();
    });
  });

  it('4. Client-side validation blocks invalid Scopus ID', async () => {
    const updateSpy = vi.spyOn(samaAdminService, 'updateHistoricalRecoveryMetadata');

    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000002')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Recovery Metadata/i }));

    const scopusInput = screen.getByPlaceholderText(/e\.g\. 57201234567/i);
    fireEvent.change(scopusInput, { target: { value: 'INVALID_SCOPUS_ID' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Recovery Metadata/i }));

    await waitFor(() => {
      expect(screen.getByText(/Scopus Author ID must be an 8 to 12 digit numeric identifier/i)).toBeInTheDocument();
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  it('5. Successfully saves metadata repair and updates record', async () => {
    const updateSpy = vi.spyOn(samaAdminService, 'updateHistoricalRecoveryMetadata').mockResolvedValue({
      ...historicalCert,
      scopus_id: '57211122233',
      storage_key: 'sama_veda/certificates/repaired_000002.pdf',
    });

    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000002')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Recovery Metadata/i }));

    const scopusInput = screen.getByPlaceholderText(/e\.g\. 57201234567/i);
    fireEvent.change(scopusInput, { target: { value: '57211122233' } });

    const storageKeyInput = screen.getByPlaceholderText(/e\.g\. sama_veda\/certificates\/CSJMU_SAMIKSHA_2026_000001\.pdf/i);
    fireEvent.change(storageKeyInput, { target: { value: 'sama_veda/certificates/repaired_000002.pdf' } });

    fireEvent.click(screen.getByRole('button', { name: /Save Recovery Metadata/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('cert-hist-002', expect.objectContaining({
        scopus_id: '57211122233',
        storage_key: 'sama_veda/certificates/repaired_000002.pdf',
      }));
      expect(screen.getByText(/Recovery metadata and PDF storage references updated successfully/i)).toBeInTheDocument();
    });
  });

  it('6. DetailsModal renders "Edit Recovery Metadata" and opens repair modal', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000002')).toBeInTheDocument();
    });

    // Find Details button for the historical certificate
    const detailsButtons = screen.getAllByRole('button', { name: /Details/i });
    // Click historical certificate's Details button (second card)
    fireEvent.click(detailsButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/Certificate Details — CSJMU\/SAMIKSHA\/2026\/000002/i)).toBeInTheDocument();
    });

    // In DetailsModal, verify "Edit Recovery Metadata" button is present (along with card button = 2 total)
    const editBtns = screen.getAllByRole('button', { name: /Edit Recovery Metadata/i });
    expect(editBtns.length).toBe(2);

    // Click the one inside the DetailsModal
    fireEvent.click(editBtns[1]);

    await waitFor(() => {
      expect(screen.getByText(/Edit Recovery Metadata — CSJMU\/SAMIKSHA\/2026\/000002/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. 57201234567/i)).toHaveValue('57209998888');
    });
  });

  it('7. Historical certificate with non-standard response shape still reliably renders action', async () => {
    // Exact shape where is_legacy is undefined, status is REVOKED, but origin is historical
    const oddShapeCert = {
      id: 'cert-odd-003',
      certificate_number: 'CSJMU/SAMIKSHA/2026/000003',
      origin: 'historical' as const,
      status: 'REVOKED' as const,
      title: 'Historical Revoked Certificate',
      research_title: 'Bio-Polymer Recovery',
      recipient_name: 'Dr. Edge Case',
      created_at: '2026-05-01T00:00:00Z',
      download_count: 0,
      publication_details: {
        is_historical_archive: true,
      },
    };

    vi.spyOn(samaAdminService, 'getCertificates').mockResolvedValue({
      items: [oddShapeCert],
      total: 1,
    });

    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/SAMIKSHA/2026/000003')).toBeInTheDocument();
    });

    const editBtn = screen.getByRole('button', { name: /Edit Recovery Metadata/i });
    expect(editBtn).toBeInTheDocument();
  });
});
