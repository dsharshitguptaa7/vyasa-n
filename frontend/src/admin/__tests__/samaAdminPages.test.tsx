import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../context/AuthContext';
import { samaAdminService } from '../services/samaAdminService';

import {
  SamaOverviewPage,
  PublicationsPage,
  AuthorsPage,
  BulletinsPage,
  CertificatesPage,
  CamProjectsPage,
  SpotlightsPage,
  ImportPage,
} from '../index';

import type {
  PublicationRecord,
  AuthorRecord,
  BulletinRecord,
  CertificateRecord,
  CamProjectRecord,
  SpotlightRecord,
  SamaOverviewStats,
} from '../types/sama';

// Mock auth helper
const mockAuth = (overrides: Partial<AuthContextModule.AuthContextValue> = {}) => {
  const defaultAuth: AuthContextModule.AuthContextValue = {
    user: {
      id: 'usr-1',
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
    displayName: 'Test Admin',
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

// Mock data fixtures
const mockStats: SamaOverviewStats = {
  totalPublications: 42,
  publishedPublications: 35,
  draftPublications: 7,
  totalAuthors: 18,
  verifiedAuthors: 12,
  totalBulletins: 5,
  activeBulletins: 4,
  totalCertificates: 12,
  revokedCertificates: 1,
  totalCamProjects: 4,
  activeCamProjects: 3,
  totalSpotlights: 3,
  activeSpotlights: 2,
};

const mockPublications: PublicationRecord[] = [
  {
    id: 'pub-1',
    slug: 'quantum-ml-agri',
    serial_no: 1,
    title: 'Quantum Machine Learning in Agricultural Remote Sensing',
    source_journal: 'IEEE Transactions on Geoscience',
    journal_name: 'IEEE Transactions on Geoscience',
    category: 'Article',
    author_display: 'Dr. Vikram Chandra et al.',
    publication_year: 2026,
    doi: '10.1109/TGRS.2026.001',
    scopus_indexed: true,
    status: 'published',
    created_at: '2026-01-15T00:00:00Z',
  },
];

const mockAuthors: AuthorRecord[] = [
  {
    id: 'auth-1',
    full_name: 'Dr. Vikram Chandra',
    name: 'Dr. Vikram Chandra',
    email: 'vchandra@csjmu.ac.in',
    department: 'Computer Applications',
    designation: 'Associate Professor',
    scopus_id: '57200000001',
    scopus_author_id: '57200000001',
    is_verified: true,
    is_scopus_verified: true,
    scopus_h_index: 14,
    created_at: '2026-01-10T00:00:00Z',
  },
];

const mockBulletins: BulletinRecord[] = [
  {
    id: 'bull-1',
    title: 'CSJMU Research Bulletin Vol 2 Issue 1',
    slug: 'csjmu-rb-v2-i1',
    volume: 2,
    issue: 1,
    publication_month: 'January',
    publication_year: 2026,
    status: 'published',
    is_active: true,
    created_at: '2026-01-20T00:00:00Z',
  },
];

const mockCertificates: CertificateRecord[] = [
  {
    id: 'cert-1',
    certificate_number: 'CSJMU/RD/2026/V2-I1/001',
    bulletin_id: 'bull-1',
    author_id: 'auth-1',
    verification_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    is_revoked: false,
    created_at: '2026-01-25T00:00:00Z',
    author_name: 'Dr. Vikram Chandra',
    bulletin_title: 'CSJMU Research Bulletin Vol 2 Issue 1',
  },
];

const mockCamProjects: CamProjectRecord[] = [
  {
    id: 'cam-1',
    project_title: 'Autonomous Crop Disease Detection with Edge AI',
    category: 'major',
    domain: 'Computer Vision',
    principal_investigator: 'Dr. Vikram Chandra',
    co_investigators: ['Dr. Ananya Roy'],
    funding_amount: 500000,
    funding_amount_display: '₹5,00,000',
    status: 'awarded',
    sanction_year: 2026,
    created_at: '2026-02-01T00:00:00Z',
  },
];

const mockSpotlights: SpotlightRecord[] = [
  {
    id: 'spot-1',
    headline: 'Faculty Spotlight: Patent Granted on Nanocatalysts',
    summary: 'CSJMU faculty achieves patent for green chemical synthesis.',
    media_type: 'photo',
    display_order: 1,
    is_active: true,
    created_at: '2026-02-10T00:00:00Z',
  },
];

describe('Sama Veda CMS Admin Pages Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();

    // Default service mocks
    vi.spyOn(samaAdminService, 'getOverviewStats').mockResolvedValue(mockStats);
    vi.spyOn(samaAdminService, 'getPublications').mockResolvedValue({
      items: mockPublications,
      total: mockPublications.length,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'getAuthors').mockResolvedValue({
      items: mockAuthors,
      total: mockAuthors.length,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({
      items: mockBulletins,
      total: mockBulletins.length,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'getCertificates').mockResolvedValue({
      items: mockCertificates,
      total: mockCertificates.length,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'getCamProjects').mockResolvedValue({
      items: mockCamProjects,
      total: mockCamProjects.length,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'getSpotlights').mockResolvedValue({
      items: mockSpotlights,
      total: mockSpotlights.length,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'downloadCertificate').mockResolvedValue(new Blob());
  });

  // 1. Sama Overview Page
  describe('SamaOverviewPage', () => {
    it('renders overview stats cards correctly', async () => {
      render(
        <MemoryRouter>
          <SamaOverviewPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Content Management Console')).toBeInTheDocument();
      });

      expect(
        screen.getByText(/Sama Veda • Central Research Recognition & Communication/i)
      ).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument(); // Publications count
      expect(screen.getByText('18')).toBeInTheDocument(); // Authors count
    });
  });

  // 2. Publications Page
  describe('PublicationsPage', () => {
    it('renders publication table and allows search input', async () => {
      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText('Quantum Machine Learning in Agricultural Remote Sensing')
        ).toBeInTheDocument();
      });

      expect(screen.getByText(/IEEE Transactions on Geoscience/i)).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('Search by title, DOI, author, or slug...');
      fireEvent.change(searchInput, { target: { value: 'Quantum' } });
      expect(searchInput).toHaveValue('Quantum');
    });

    it('opens status change modal and submits updated status', async () => {
      const updateStatusSpy = vi
        .spyOn(samaAdminService, 'updatePublicationStatus')
        .mockResolvedValue({ ...mockPublications[0], status: 'archived' });

      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Status' })[0]).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByRole('button', { name: 'Status' })[0]);

      await waitFor(() => {
        expect(screen.getByText(/Update Publication Status/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Status Update/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(updateStatusSpy).toHaveBeenCalled();
      });
    });

    it('renders empty state when publication catalog is empty', async () => {
      vi.spyOn(samaAdminService, 'getPublications').mockResolvedValueOnce({
        items: [],
        total: 0,
        skip: 0,
        limit: 15,
      });

      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('No Research Publications Found')).toBeInTheDocument();
      });
    });

    it('renders error banner and retry action when loading publications fails, without displaying empty state', async () => {
      const getPubsSpy = vi.spyOn(samaAdminService, 'getPublications').mockRejectedValueOnce(
        new Error('Database query timed out')
      );

      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to load publications catalog')).toBeInTheDocument();
        expect(screen.getByText('Database query timed out')).toBeInTheDocument();
      });

      // Verify Retry button is present and EmptyState is NOT shown
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeInTheDocument();
      expect(screen.queryByText('No Research Publications Found')).toBeNull();

      // Trigger Retry
      getPubsSpy.mockResolvedValueOnce({
        items: mockPublications,
        total: mockPublications.length,
        skip: 0,
        limit: 15,
      });

      fireEvent.click(retryBtn);

      await waitFor(() => {
        expect(
          screen.getByText('Quantum Machine Learning in Agricultural Remote Sensing')
        ).toBeInTheDocument();
      });
    });

    it('supports publication filtering by category and status', async () => {
      const getPubsSpy = vi.spyOn(samaAdminService, 'getPublications');

      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText('Quantum Machine Learning in Agricultural Remote Sensing')
        ).toBeInTheDocument();
      });

      // Select status filter
      const selects = screen.getAllByRole('combobox');
      // First is status, second is category
      fireEvent.change(selects[0], { target: { value: 'published' } });

      await waitFor(() => {
        expect(getPubsSpy).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'published' })
        );
      });

      // Select category filter
      fireEvent.change(selects[1], { target: { value: 'Article' } });

      await waitFor(() => {
        expect(getPubsSpy).toHaveBeenCalledWith(
          expect.objectContaining({ category: 'Article' })
        );
      });
    });

    it('supports publication creation flow for authorized Super Admin', async () => {
      const createPubSpy = vi.spyOn(samaAdminService, 'createPublication').mockResolvedValueOnce({
        id: 'pub-new',
        slug: 'v2-i1-r049',
        serial_no: 49,
        title: 'Neural Networks for Hydrological Forecasting',
        source_journal: 'Journal of Hydrology',
        category: 'Article',
        author_display: 'Dr. Vikram Chandra',
        authors_complete: true,
        status: 'draft',
        is_featured: false,
        created_at: '2026-02-15T00:00:00Z',
        updated_at: '2026-02-15T00:00:00Z',
      });

      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ Add Publication' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: '+ Add Publication' }));

      await waitFor(() => {
        expect(screen.getByText('Add Research Publication')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('e.g. v2-i1-r048'), {
        target: { value: 'v2-i1-r049' },
      });
      fireEvent.change(screen.getByPlaceholderText('Complete scholarly article title'), {
        target: { value: 'Neural Networks for Hydrological Forecasting' },
      });
      fireEvent.change(screen.getByPlaceholderText('Journal or conference name'), {
        target: { value: 'Journal of Hydrology' },
      });
      fireEvent.change(screen.getByPlaceholderText('e.g. Kumar C.S., Sharma N., Patel R.'), {
        target: { value: 'Dr. Vikram Chandra' },
      });

      const submitBtn = screen.getByRole('button', { name: 'Create Publication' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createPubSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            slug: 'v2-i1-r049',
            title: 'Neural Networks for Hydrological Forecasting',
            source_journal: 'Journal of Hydrology',
          })
        );
      });
    });

    it('restricts Add Publication action for non-admin viewers', async () => {
      mockAuth({
        user: {
          id: 'usr-readonly',
          email: 'viewer@csjmu.ac.in',
          first_name: 'Viewer',
          last_name: 'User',
          role: 'applicant',
          roles: ['applicant'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isAdmin: false,
        isSuperAdmin: false,
      });

      render(
        <MemoryRouter>
          <PublicationsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText('Quantum Machine Learning in Agricultural Remote Sensing')
        ).toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: '+ Add Publication' })).toBeNull();
    });
  });

  // 3. Authors Page
  describe('AuthorsPage', () => {
    it('renders author list and opens Scopus review modal', async () => {
      render(
        <MemoryRouter>
          <AuthorsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dr. Vikram Chandra')).toBeInTheDocument();
      });

      expect(screen.getByText(/57200000001/)).toBeInTheDocument();

      const reviewBtn = screen.getByRole('button', { name: /Review/i });
      fireEvent.click(reviewBtn);

      await waitFor(() => {
        expect(screen.getByText('Scopus Identity Review: Dr. Vikram Chandra')).toBeInTheDocument();
      });

      expect(screen.getByText(/Confirmed Scopus Identifier/i)).toBeInTheDocument();
    });
  });

  // 4. Bulletins Page
  describe('BulletinsPage', () => {
    it('renders bulletins catalog and open new bulletin modal', async () => {
      render(
        <MemoryRouter>
          <BulletinsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU Research Bulletin Vol 2 Issue 1')).toBeInTheDocument();
      });

      const newBulletinBtn = screen.getByRole('button', { name: /\+ Add Bulletin Edition/i });
      fireEvent.click(newBulletinBtn);

      await waitFor(() => {
        expect(screen.getByText(/Add Research Bulletin Edition/i)).toBeInTheDocument();
      });
    });
  });

  // 5. Certificates Page
  describe('CertificatesPage', () => {
    it('renders certificate records with status and download action', async () => {
      render(
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU/RD/2026/V2-I1/001')).toBeInTheDocument();
      });

      const pdfBtn = screen.getByTitle('Download Certificate PDF');
      fireEvent.click(pdfBtn);

      await waitFor(() => {
        expect(samaAdminService.downloadCertificate).toHaveBeenCalledWith(
          'cert-1',
          'CSJMU_RD_2026_V2-I1_001.pdf'
        );
      });
    });

    it('enables revocation for Super Admin and requires mandatory reason', async () => {
      mockAuth({
        user: {
          id: 'usr-1',
          email: 'admin@csjmu.ac.in',
          first_name: 'Super',
          last_name: 'Admin',
          role: 'super_admin',
          roles: ['super_admin'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isSuperAdmin: true,
      });

      render(
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Revoke/i })).toBeInTheDocument();
      });

      const revokeBtn = screen.getByRole('button', { name: /Revoke/i });
      expect(revokeBtn).not.toBeDisabled();
      fireEvent.click(revokeBtn);

      await waitFor(() => {
        expect(screen.getByText('Important Institutional Action:')).toBeInTheDocument();
      });

      const submitRevokeBtn = screen.getByRole('button', { name: /Confirm Revocation/i });
      expect(submitRevokeBtn).toBeDisabled(); // Disabled until reason is typed

      const reasonInput = screen.getByPlaceholderText(
        'Provide detailed institutional justification for this revocation...'
      );
      fireEvent.change(reasonInput, {
        target: { value: 'Publication retracted due to duplicate submission.' },
      });

      expect(submitRevokeBtn).not.toBeDisabled();
    });

    it('disables revocation for non-super-admin editors', async () => {
      mockAuth({
        user: {
          id: 'usr-2',
          email: 'editor@csjmu.ac.in',
          first_name: 'Content',
          last_name: 'Editor',
          role: 'sama_content_editor',
          roles: ['sama_content_editor'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isSuperAdmin: false,
      });

      render(
        <MemoryRouter>
          <CertificatesPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU/RD/2026/V2-I1/001')).toBeInTheDocument();
      });

      const revokeBtn = screen.getByTitle(
        'Revocation is strictly restricted to Super Administrators'
      );
      expect(revokeBtn).toBeDisabled();
    });
  });

  // 6. CAM Projects Page
  describe('CamProjectsPage', () => {
    it('renders CAM-AI projects and displays grant badges', async () => {
      render(
        <MemoryRouter>
          <CamProjectsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText('Autonomous Crop Disease Detection with Edge AI')
        ).toBeInTheDocument();
      });

      expect(screen.getByText('Major Grant')).toBeInTheDocument();
      expect(screen.getByText('₹5,00,000')).toBeInTheDocument();
    });
  });

  // 7. Spotlights Page
  describe('SpotlightsPage', () => {
    it('renders researcher spotlights with active toggle', async () => {
      const updateSpotlightSpy = vi
        .spyOn(samaAdminService, 'updateSpotlight')
        .mockResolvedValue({ ...mockSpotlights[0], is_active: false });

      render(
        <MemoryRouter>
          <SpotlightsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(
          screen.getByText('Faculty Spotlight: Patent Granted on Nanocatalysts')
        ).toBeInTheDocument();
      });

      const toggleBtn = screen.getByTitle('Click to toggle status');
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(updateSpotlightSpy).toHaveBeenCalledWith('spot-1', { is_active: false });
      });
    });
  });

  // 8. Data Import & Historical Reconciliation Page
  describe('ImportPage', () => {
    it('renders historical portfolio tab and runs simulation preview', async () => {
      vi.spyOn(samaAdminService, 'getImportBatches').mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      const bundleSpy = vi.spyOn(samaAdminService, 'importHistoricalBundle').mockResolvedValue({
        batch_number: 'IMP-BUNDLE-20261026-TEST01',
        dry_run: true,
        source_dir: 'C:\\Projects\\Harshit_Portfolio\\research.felicitation.csjmu',
        entities: {
          bulletins: { created: 2 },
          publications: { created: 207, skipped: 0 },
          cam_projects: { created: 6 },
        },
      });

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Historical Data Import & Reconciliation')).toBeInTheDocument();
      expect(screen.getByText('Historical Research Felicitation Portfolio')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Run Historical Dry-Run Preview')).toBeInTheDocument();
      });

      const simBtn = screen.getByText('Run Historical Dry-Run Preview');
      fireEvent.click(simBtn);

      await waitFor(() => {
        expect(bundleSpy).toHaveBeenCalledWith({ dry_run: true });
        expect(screen.getByText('Historical Bundle Simulation: IMP-BUNDLE-20261026-TEST01')).toBeInTheDocument();
      });

      expect(screen.getByText('Execute Historical Import')).toBeInTheDocument();
    });

    it('switches to custom file import tab', async () => {
      vi.spyOn(samaAdminService, 'getImportBatches').mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Custom File Import (JSON / CSV / Excel)')).toBeInTheDocument();
      });

      const customTab = screen.getByText('Custom File Import (JSON / CSV / Excel)');
      fireEvent.click(customTab);

      await waitFor(() => {
        expect(screen.getByText('Upload Single Entity Batch')).toBeInTheDocument();
        expect(screen.getByText('Generate Dry-Run Preview')).toBeInTheDocument();
      });
    });
  });
});
