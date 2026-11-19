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
      first_name: 'Test',
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

describe('CertificatesPage - Manual Certificate Number & Verification Identifier Overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();

    vi.spyOn(samaAdminService, 'getCertificateStats').mockResolvedValue({
      total_certificates: 10,
      total_issued: 8,
      draft_certificates: 0,
      pending_approvals: 2,
      scheduled_certificates: 0,
      issued_certificates: 8,
      revoked_certificates: 0,
      reissued_certificates: 0,
      total_researchers_linked: 5,
    });
    vi.spyOn(samaAdminService, 'getCertificates').mockResolvedValue({
      items: [
        {
          id: 'cert-prev-1',
          certificate_number: 'CSJMU/RD/2026/V1-I1/001',
          title: 'Initial Cert',
          status: 'ISSUED',
        } as any,
      ],
      total: 1,
    });
    vi.spyOn(samaAdminService, 'getTemplates').mockResolvedValue({
      items: [
        { id: 'tpl-1', code: 'DEFAULT', name: 'Default Landscape', is_default: true, certificate_type: 'RESEARCH_PUBLICATION' },
      ],
      total: 1,
    });
    vi.spyOn(samaAdminService, 'getSignatories').mockResolvedValue({
      items: [
        { id: 'sig-1', authority_type: 'DEAN_RD', signatory_name: 'Prof. Rajesh Kumar', is_active: true },
        { id: 'sig-2', authority_type: 'VICE_CHANCELLOR', signatory_name: 'Prof. Vinay Kumar Pathak', is_active: true },
      ],
      total: 2,
    });
    vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({
      items: [{ id: 'b-1', title: 'Volume 1 Issue 1', volume_number: 1, issue_number: 1, publication_period: 'Jan-Jun 2026' }],
      total: 1,
    });
    vi.spyOn(samaAdminService, 'getPublications').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getAuthors').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'issueCertificate').mockResolvedValue({
      id: 'cert-1',
      certificate_number: 'CSJMU/RECOVERED/2026/007',
      status: 'ISSUED',
      scheduled_issue_date: '2026-11-19',
    });
  });

  it('renders optional manual override fields and live verification preview in Step 4', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/RD/2026/V1-I1/001')).toBeInTheDocument();
    });

    // Open Wizard
    const newBtn = screen.getByRole('button', { name: /New Joint Certificate/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByText('Create Joint Institutional Certificate')).toBeInTheDocument();
    });

    // Step 1: Select Volume
    const volumeSelect = screen.getByDisplayValue(/Select Volume/i);
    fireEvent.change(volumeSelect, { target: { value: '1' } });

    const nextBtn1 = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn1);

    // Step 2: Add Manual Author
    await waitFor(() => {
      expect(screen.getByText(/Recipient Authors/i)).toBeInTheDocument();
    });
    const authorInput = screen.getByPlaceholderText('e.g. Ramesh Chandra Verma');
    fireEvent.change(authorInput, { target: { value: 'Dr. Test Author' } });

    const addAuthorBtn = screen.getByRole('button', { name: /\+ Add Author/i });
    fireEvent.click(addAuthorBtn);

    const nextBtn2 = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn2);

    // Step 3: Enter Research Title
    await waitFor(() => {
      expect(screen.getByText(/Research Paper \/ Publication Title/i)).toBeInTheDocument();
    });
    const titleInput = screen.getByPlaceholderText(/Exploring the dielectric/i);
    fireEvent.change(titleInput, { target: { value: 'Novel Quantum Computing Architecture' } });

    const nextBtn3 = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn3);

    // Step 4: Review & Issue
    await waitFor(() => {
      expect(screen.getByText('Review & Issue')).toBeInTheDocument();
      expect(screen.getByText('Manual Identifiers & Legacy QR Restoration (Optional)')).toBeInTheDocument();
      expect(screen.getByText('Certificate Number (Optional)')).toBeInTheDocument();
      expect(screen.getByText('Verification Identifier (Optional)')).toBeInTheDocument();
    });

    // Check placeholders and helper text
    const placeholders = screen.getAllByPlaceholderText('Auto-generated if left blank');
    expect(placeholders).toHaveLength(2);
    expect(screen.getByText(/Leave blank to generate automatically. Enter a value only when a specific certificate number is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Leave blank to generate automatically. Enter an existing identifier to restore a previously printed QR verification URL/i)).toBeInTheDocument();

    const certNumInput = placeholders[0];
    const identInput = placeholders[1];

    // Enter manual certificate number
    fireEvent.change(certNumInput, { target: { value: 'CSJMU/RECOVERED/2026/007' } });

    // Paste full URL into identifier field
    fireEvent.change(identInput, {
      target: { value: 'https://vyasa-n.csjmu.ac.in/verify/ef6f4ff26b0944f5a76477ac7094cbd5' },
    });

    // Verify URL extraction notice and resolved preview
    await waitFor(() => {
      expect(screen.getByText(/Extracted verification identifier: "ef6f4ff26b0944f5a76477ac7094cbd5"/i)).toBeInTheDocument();
      expect(screen.getByText('Resolved Verification URL:')).toBeInTheDocument();
      expect(screen.getByText(new RegExp('verify/ef6f4ff26b0944f5a76477ac7094cbd5'))).toBeInTheDocument();
    });
  });
});
