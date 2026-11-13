import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../context/AuthContext';
import { samaAdminService } from '../services/samaAdminService';
import CertificatesPage from '../pages/sama/CertificatesPage';
import type { CertificateSignatoryItem } from '../types/sama';

const mockSignatories: CertificateSignatoryItem[] = [
  {
    id: 'sig-dean-1',
    authority_type: 'DEAN_RD',
    signatory_name: 'Prof. (Dr.) Rajesh Kumar',
    designation: 'Dean – Research & Development',
    department: 'Research & Development Cell, CSJMU Kanpur',
    signature_image_path: 'sama_veda/signatures/dean_sig.png',
    signature_asset_version: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'sig-vc-1',
    authority_type: 'VICE_CHANCELLOR',
    signatory_name: 'Prof. Vinay Kumar Pathak',
    designation: 'Vice Chancellor',
    department: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    signature_image_path: null, // Test case without uploaded asset
    signature_asset_version: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockAuth = () => {
  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
    user: {
      id: 'usr-1',
      email: 'superadmin@csjmu.ac.in',
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

describe('Signing Authorities & Digital Signature Management Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();

    vi.spyOn(samaAdminService, 'getCertificateStats').mockResolvedValue({
      total: 0,
      draft: 0,
      in_review: 0,
      approved: 0,
      issued: 0,
      revoked: 0,
      superseded: 0,
      verified_lookups: 0,
    });
    vi.spyOn(samaAdminService, 'getCertificates').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 12 });
    vi.spyOn(samaAdminService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaAdminService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaAdminService, 'getTemplates').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getSignatories').mockResolvedValue({ items: mockSignatories, total: mockSignatories.length });
    vi.spyOn(samaAdminService, 'createSignatory').mockResolvedValue({
      id: 'sig-new',
      authority_type: 'DEAN_RD',
      signatory_name: 'Prof. New Dean',
      designation: 'Dean – R&D',
      signature_asset_version: 1,
      is_active: true,
    });
    vi.spyOn(samaAdminService, 'updateSignatory').mockResolvedValue({
      ...mockSignatories[0],
      signatory_name: 'Prof. (Dr.) Rajesh Kumar Updated',
    });
    vi.spyOn(samaAdminService, 'toggleSignatoryActive').mockResolvedValue({
      ...mockSignatories[0],
      is_active: false,
    });
    vi.spyOn(samaAdminService, 'uploadSignatorySignature').mockResolvedValue({
      ...mockSignatories[1],
      signature_image_path: 'sama_veda/signatures/vc_sig.png',
      signature_asset_version: 2,
    });
    vi.spyOn(samaAdminService, 'deleteSignatory').mockResolvedValue({
      action: 'soft_deleted',
      message: 'Authority deactivated safely.',
      referenced_approvals: 1,
    });
  });

  it('navigates to Signing Authorities tab and renders authorities with signature status', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    // Switch to Signing Authorities tab
    const tabBtn = screen.getByRole('button', { name: /Signing Authorities/i });
    fireEvent.click(tabBtn);

    await waitFor(() => {
      expect(screen.getByText('Prof. (Dr.) Rajesh Kumar')).toBeInTheDocument();
      expect(screen.getByText('Prof. Vinay Kumar Pathak')).toBeInTheDocument();
    });

    // Both authorities display version indicators
    expect(screen.getAllByText(/v1/i).length).toBeGreaterThanOrEqual(1);

    // VC has no signature asset warning
    expect(screen.getByText(/No signature uploaded/i)).toBeInTheDocument();
  });

  it('opens Add Signing Authority modal and creates new authority', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Signing Authorities/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Signing Authority/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Signing Authority/i }));

    await waitFor(() => {
      expect(screen.getByText('Institutional Authority Role *')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('e.g. Prof. (Dr.) Rajesh Kumar'), {
      target: { value: 'Prof. New Dean' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g. Dean – Research & Development'), {
      target: { value: 'Dean – R&D' },
    });

    const submitBtn = screen.getByRole('button', { name: /Create Authority/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(samaAdminService.createSignatory).toHaveBeenCalledWith(
        expect.objectContaining({
          signatory_name: 'Prof. New Dean',
          designation: 'Dean – R&D',
        })
      );
    });
  });

  it('opens Upload Signature modal and handles asset upload', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Signing Authorities/i }));

    await waitFor(() => {
      expect(screen.getByText('Prof. Vinay Kumar Pathak')).toBeInTheDocument();
    });

    // Click upload signature for VC
    const uploadButtons = screen.getAllByRole('button', { name: /Upload Signature/i });
    fireEvent.click(uploadButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Upload Signature: Prof\. Vinay Kumar Pathak/i)).toBeInTheDocument();
    });

    // Select file
    const file = new File(['fake-png-bytes'], 'vc_signature.png', { type: 'image/png' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } });
    }

    const confirmUploadBtn = screen.getByRole('button', { name: /Confirm & Upload Signature/i });
    fireEvent.click(confirmUploadBtn);

    await waitFor(() => {
      expect(samaAdminService.uploadSignatorySignature).toHaveBeenCalledWith(
        'sig-vc-1',
        expect.any(File)
      );
    });
  });

  it('toggles authority active state and triggers safe deletion dialog', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Signing Authorities/i }));

    await waitFor(() => {
      expect(screen.getByText('Prof. (Dr.) Rajesh Kumar')).toBeInTheDocument();
    });

    // Click Deactivate
    const deactivateBtns = screen.getAllByRole('button', { name: /Deactivate/i });
    fireEvent.click(deactivateBtns[0]);

    await waitFor(() => {
      expect(samaAdminService.toggleSignatoryActive).toHaveBeenCalledWith('sig-dean-1');
    });

    // Click Delete -> opens safe deletion modal
    const deleteBtns = screen.getAllByRole('button', { name: /Delete/i });
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Institutional Dependency Check:/i)).toBeInTheDocument();
    });

    const confirmDeleteBtn = screen.getByRole('button', { name: /Confirm Safe Deletion/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(samaAdminService.deleteSignatory).toHaveBeenCalledWith('sig-dean-1');
    });
  });
});
