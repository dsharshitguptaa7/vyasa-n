import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../context/AuthContext';
import { samaAdminService } from '../services/samaAdminService';
import CertificatesPage from '../pages/sama/CertificatesPage';
import type { CertificateStatsRecord, FelicitationCertificateItem } from '../types/sama';

const mockStats: CertificateStatsRecord = {
  total_certificates: 73,
  total_issued: 6,
  draft_certificates: 0,
  pending_approvals: 55,
  scheduled_certificates: 12,
  issued_certificates: 4,
  revoked_certificates: 2,
  reissued_certificates: 0,
  total_researchers_linked: 18,
};

const makeMockPendingCert = (i: number, status: 'PENDING_DEAN_APPROVAL' | 'PENDING_VC_APPROVAL'): FelicitationCertificateItem => ({
  id: `cert-pending-${i}`,
  certificate_number: `CSJMU/2026/PEND-${i.toString().padStart(3, '0')}`,
  status,
  title: 'Certificate of Appreciation & Research Excellence',
  research_title: `Exemplary Research Paper ${i}`,
  authors: [
    {
      author_name_snapshot: `Pending Scholar ${i}`,
      academic_title_snapshot: null,
      department_snapshot: 'Department of Physics',
      scopus_id_snapshot: `57000${i.toString().padStart(2, '0')}`,
      author_role: 'First Author',
      author_order: 1,
    },
  ],
  created_at: '2026-03-01T00:00:00Z',
});

const mock55PendingCerts: FelicitationCertificateItem[] = [
  ...Array.from({ length: 30 }, (_, i) => makeMockPendingCert(i + 1, 'PENDING_DEAN_APPROVAL')),
  ...Array.from({ length: 25 }, (_, i) => makeMockPendingCert(i + 31, 'PENDING_VC_APPROVAL')),
];

const mock6IssuedCerts: FelicitationCertificateItem[] = [
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `cert-issued-${i + 1}`,
    certificate_number: `CSJMU/2026/ISSUE-${(i + 1).toString().padStart(3, '0')}`,
    status: 'ISSUED' as const,
    is_revoked: false,
    title: 'Certificate of Appreciation & Research Excellence',
    research_title: `Issued Active Paper ${i + 1}`,
    authors: [
      {
        author_name_snapshot: `Active Scholar ${i + 1}`,
        department_snapshot: 'Department of Chemistry',
        author_role: 'Author',
        author_order: 1,
      },
    ],
    created_at: '2026-03-01T00:00:00Z',
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `cert-revoked-${i + 1}`,
    certificate_number: `CSJMU/2026/REV-${(i + 1).toString().padStart(3, '0')}`,
    status: 'REVOKED' as const,
    is_revoked: true,
    revocation_reason: `Revoked for data correction ${i + 1}`,
    title: 'Certificate of Appreciation & Research Excellence',
    research_title: `Revoked Paper ${i + 1}`,
    authors: [
      {
        author_name_snapshot: `Revoked Scholar ${i + 1}`,
        department_snapshot: 'Department of Law',
        author_role: 'Author',
        author_order: 1,
      },
    ],
    created_at: '2026-02-01T00:00:00Z',
  })),
];

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

describe('CMS Certificate Management — Approval Queue & Issued Ledger Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();

    vi.spyOn(samaAdminService, 'getCertificateStats').mockResolvedValue(mockStats);
    vi.spyOn(samaAdminService, 'getAuthors').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getPublications').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getTemplates').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaAdminService, 'getSignatories').mockResolvedValue({ items: [], total: 0 });

    vi.spyOn(samaAdminService, 'getCertificates').mockImplementation(async (params) => {
      if (params?.scope === 'approvals') {
        const skip = params?.skip ?? 0;
        const limit = params?.limit ?? 10;
        let filtered = mock55PendingCerts;
        if (params?.approval_stage === 'DEAN') {
          filtered = filtered.filter((c) => c.status === 'PENDING_DEAN_APPROVAL');
        } else if (params?.approval_stage === 'VC') {
          filtered = filtered.filter((c) => c.status === 'PENDING_VC_APPROVAL');
        }
        return {
          total: filtered.length,
          items: filtered.slice(skip, skip + limit),
          skip,
          limit,
        };
      }

      // Default ledger
      const skip = params?.skip ?? 0;
      const limit = params?.limit ?? 12;
      return {
        total: mock6IssuedCerts.length,
        items: mock6IssuedCerts.slice(skip, skip + limit),
        skip,
        limit,
      };
    });
  });

  it('1. Renders accurate KPI cards according to defined counting rules', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    // Total Issued should show 6 (matching issued + revoked + superseded), with 73 in registry
    await waitFor(() => {
      expect(screen.getByText('Total Issued')).toBeInTheDocument();
      expect(screen.getByText('73 in registry')).toBeInTheDocument();
      expect(screen.getAllByText('Issued & Active')[0]).toBeInTheDocument();
      expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
      expect(screen.getAllByText('Revoked')[0]).toBeInTheDocument();
      expect(screen.getAllByText('55')[0]).toBeInTheDocument();
    });
  });

  it('2. Approval Queue loads all 55 pending certificates and displays accurate pagination and no false empty state', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    // Switch to Approval Queue tab
    const approvalsTab = await screen.findByRole('button', { name: /approval queue/i });
    fireEvent.click(approvalsTab);

    // Must NOT display "All Approvals Cleared"
    await waitFor(() => {
      expect(screen.queryByText('All Approvals Cleared')).not.toBeInTheDocument();
    });

    // Should display the first page of pending certificates (10 items) and pagination
    await waitFor(() => {
      expect(screen.getByText('CSJMU/2026/PEND-001')).toBeInTheDocument();
      const pageInfo = screen.getByTestId('approval-pagination-info');
      expect(pageInfo).toHaveTextContent('Showing 1 to 10 of 55 pending certificates');
      const pageNum = screen.getByTestId('approval-page-info');
      expect(pageNum).toHaveTextContent('Page 1 of 6');
    });

    // Navigate to Page 2
    const nextBtn = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(samaAdminService.getCertificates).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'approvals',
          skip: 10,
          limit: 10,
        })
      );
      expect(screen.getByText('CSJMU/2026/PEND-011')).toBeInTheDocument();
      const pageInfo = screen.getByTestId('approval-pagination-info');
      expect(pageInfo).toHaveTextContent('Showing 11 to 20 of 55 pending certificates');
      const pageNum = screen.getByTestId('approval-page-info');
      expect(pageNum).toHaveTextContent('Page 2 of 6');
    });
  });

  it('3. Filters Approval Queue by stage (Dean R&D vs Vice Chancellor)', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    const approvalsTab = await screen.findByRole('button', { name: /approval queue/i });
    fireEvent.click(approvalsTab);

    // Click "Awaiting Dean R&D" stage filter
    const deanStageBtn = await screen.findByRole('button', { name: /awaiting dean r&d/i });
    fireEvent.click(deanStageBtn);

    await waitFor(() => {
      expect(samaAdminService.getCertificates).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'approvals',
          approval_stage: 'DEAN',
        })
      );
      const pageInfo = screen.getByTestId('approval-pagination-info');
      expect(pageInfo).toHaveTextContent('Showing 1 to 10 of 30 pending certificates');
    });

    // Click "Awaiting Vice Chancellor" stage filter
    const vcStageBtn = screen.getByRole('button', { name: /awaiting vice chancellor/i });
    fireEvent.click(vcStageBtn);

    await waitFor(() => {
      expect(samaAdminService.getCertificates).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'approvals',
          approval_stage: 'VC',
        })
      );
      const pageInfo = screen.getByTestId('approval-pagination-info');
      expect(pageInfo).toHaveTextContent('Showing 1 to 10 of 25 pending certificates');
    });
  });

  it('4. Displays empty state in Approval Queue only when actual pending count is 0', async () => {
    vi.spyOn(samaAdminService, 'getCertificates').mockImplementation(async (params) => {
      if (params?.scope === 'approvals') {
        return { total: 0, items: [] };
      }
      return { total: 6, items: mock6IssuedCerts };
    });

    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    const approvalsTab = await screen.findByRole('button', { name: /approval queue/i });
    fireEvent.click(approvalsTab);

    await waitFor(() => {
      expect(screen.getByText('All Approvals Cleared')).toBeInTheDocument();
      expect(
        screen.getByText('No certificates are currently awaiting Dean R&D or Vice Chancellor authorization.')
      ).toBeInTheDocument();
    });
  });

  it('5. Issued Ledger loads all issued records and displays pagination controls', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    // Initial Ledger view
    await waitFor(() => {
      expect(screen.getByText('CSJMU/2026/ISSUE-001')).toBeInTheDocument();
      expect(screen.getByText('CSJMU/2026/REV-001')).toBeInTheDocument();
      const pageInfo = screen.getByTestId('ledger-pagination-info');
      expect(pageInfo).toHaveTextContent('Showing 1 to 6 of 6 certificates');
      const pageNum = screen.getByTestId('ledger-page-info');
      expect(pageNum).toHaveTextContent('Page 1 of 1');
    });
  });
});
