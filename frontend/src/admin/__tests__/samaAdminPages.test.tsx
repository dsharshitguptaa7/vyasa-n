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
  {
    id: 'auth-2',
    full_name: 'Aamena Zaidi',
    name: 'Aamena Zaidi',
    email: 'azaidi@csjmu.ac.in',
    department: 'Life Sciences',
    designation: 'Assistant Professor',
    scopus_id: '59258716900',
    scopus_author_id: '59258716900',
    is_verified: false,
    is_scopus_verified: false,
    created_at: '2026-02-01T00:00:00Z',
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
    vi.spyOn(samaAdminService, 'getCertificateStats').mockResolvedValue({
      total: 1,
      draft: 0,
      in_review: 0,
      approved: 0,
      issued: 1,
      revoked: 0,
      superseded: 0,
      verified_lookups: 10,
    });
    vi.spyOn(samaAdminService, 'getTemplates').mockResolvedValue({
      items: [],
      total: 0,
    });
    vi.spyOn(samaAdminService, 'getSignatories').mockResolvedValue({
      items: [],
      total: 0,
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

    it('supports multi-selection and bulk delete for authorized Super Admin', async () => {
      mockAuth({
        user: {
          id: 'usr-super',
          email: 'admin@csjmu.ac.in',
          first_name: 'Super',
          last_name: 'Admin',
          role: 'super_admin',
          roles: ['super_admin'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isAdmin: true,
        isSuperAdmin: true,
      });

      const bulkDeleteSpy = vi
        .spyOn(samaAdminService, 'bulkDeletePublications')
        .mockResolvedValue({
          deleted_count: 2,
          deleted_ids: ['pub-1', 'pub-2'],
          failed_count: 0,
          failed_items: [],
          total_requested: 2,
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

      // Select All checkbox
      const selectAllCheckbox = screen.getByLabelText('Select all publications on this page');
      fireEvent.click(selectAllCheckbox);

      // Verify bulk action banner appears
      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
        expect(screen.getByText(/publications selected/i)).toBeInTheDocument();
      });

      // Find and click Bulk Delete button
      const bulkDeleteBtn = screen.getByRole('button', { name: /Bulk Delete/i });
      expect(bulkDeleteBtn).not.toBeDisabled();
      fireEvent.click(bulkDeleteBtn);

      // Verify confirmation modal opens
      await waitFor(() => {
        expect(screen.getByText('Institutional Safeguard Notice:')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmDeleteBtn = screen.getByRole('button', { name: /Delete .* Entries Permanently/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(bulkDeleteSpy).toHaveBeenCalled();
      });
    });

    it('restricts bulk delete action for non-super-admin editors', async () => {
      mockAuth({
        user: {
          id: 'usr-editor',
          email: 'editor@csjmu.ac.in',
          first_name: 'Editor',
          last_name: 'User',
          role: 'sama_content_editor',
          roles: ['sama_content_editor'],
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

      // Select row 1
      const row1Checkbox = screen.getByLabelText('Select publication quantum-ml-agri');
      fireEvent.click(row1Checkbox);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
      });

      const bulkDeleteBtn = screen.getByRole('button', { name: /Bulk Delete/i });
      expect(bulkDeleteBtn).toBeDisabled();
    });

    it('supports multi-selection and bulk status update for authorized admin', async () => {
      mockAuth({
        user: {
          id: 'usr-admin',
          email: 'admin@csjmu.ac.in',
          first_name: 'Sama',
          last_name: 'Admin',
          role: 'sama_content_admin',
          roles: ['sama_content_admin'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isAdmin: true,
        isSuperAdmin: false,
      });

      const bulkStatusSpy = vi
        .spyOn(samaAdminService, 'bulkUpdatePublicationStatus')
        .mockResolvedValue({
          updated_count: 1,
          updated_ids: ['pub-1'],
          failed_count: 0,
          failed_items: [],
          total_requested: 1,
          new_status: 'archived',
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

      // Select row 1
      const row1Checkbox = screen.getByLabelText('Select publication quantum-ml-agri');
      fireEvent.click(row1Checkbox);

      // Verify bulk action banner appears
      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
      });

      // Find and click Change Status button
      const changeStatusBtn = screen.getByRole('button', { name: /Change Status/i });
      expect(changeStatusBtn).not.toBeDisabled();
      fireEvent.click(changeStatusBtn);

      // Verify bulk status modal opens
      await waitFor(() => {
        expect(screen.getByTestId('bulk-status-modal')).toBeInTheDocument();
        expect(screen.getByText(/You are about to update the lifecycle status of/i)).toBeInTheDocument();
      });

      // Confirm button disabled when no status selected
      const confirmBtn = screen.getByRole('button', { name: /Confirm Bulk Status Update/i });
      expect(confirmBtn).toBeDisabled();

      // Select target status
      const selectStatus = screen.getByTestId('bulk-status-select');
      fireEvent.change(selectStatus, { target: { value: 'archived' } });

      // Confirmation summary visible and confirm button enabled
      expect(screen.getByText(/Confirmation Summary:/i)).toBeInTheDocument();
      expect(confirmBtn).not.toBeDisabled();

      // Submit
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(bulkStatusSpy).toHaveBeenCalledWith(['pub-1'], 'archived');
      });
    });

    it('disables Change Status button in bulk action banner for users without publish permissions', async () => {
      mockAuth({
        user: {
          id: 'usr-editor',
          email: 'editor@csjmu.ac.in',
          first_name: 'Editor',
          last_name: 'User',
          role: 'sama_content_editor',
          roles: ['sama_content_editor'],
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

      // Select row 1
      const row1Checkbox = screen.getByLabelText('Select publication quantum-ml-agri');
      fireEvent.click(row1Checkbox);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
      });

      const changeStatusBtn = screen.getByRole('button', { name: /Change Status/i });
      expect(changeStatusBtn).toBeDisabled();
    });

    it('preserves selection when bulk status update fails', async () => {
      mockAuth({
        user: {
          id: 'usr-admin',
          email: 'admin@csjmu.ac.in',
          first_name: 'Admin',
          last_name: 'User',
          role: 'administrator',
          roles: ['administrator'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isAdmin: true,
        isSuperAdmin: false,
      });

      vi.spyOn(samaAdminService, 'bulkUpdatePublicationStatus').mockRejectedValueOnce(
        new Error('Network connectivity lost')
      );

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

      const row1Checkbox = screen.getByLabelText('Select publication quantum-ml-agri');
      fireEvent.click(row1Checkbox);

      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Change Status/i }));

      await waitFor(() => {
        expect(screen.getByTestId('bulk-status-modal')).toBeInTheDocument();
      });

      const selectStatus = screen.getByTestId('bulk-status-select');
      fireEvent.change(selectStatus, { target: { value: 'published' } });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Bulk Status Update/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText('Network connectivity lost')).toBeInTheDocument();
      });

      // Modal is still open with error, selection is preserved
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);

      // Verify row is STILL selected and bulk action banner still shows
      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
        expect(row1Checkbox).toBeChecked();
      });
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

    it('supports multi-selection and bulk delete for authors', async () => {
      mockAuth({
        user: {
          id: 'usr-admin',
          email: 'admin@csjmu.ac.in',
          first_name: 'Content',
          last_name: 'Admin',
          role: 'sama_content_admin',
          roles: ['sama_content_admin'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isAdmin: true,
        isSuperAdmin: false,
      });

      const bulkDeleteSpy = vi
        .spyOn(samaAdminService, 'bulkDeleteAuthors')
        .mockResolvedValue({
          deleted_count: 2,
          deleted_ids: ['auth-1', 'auth-2'],
          failed_count: 0,
          failed_items: [],
          total_requested: 2,
        });

      render(
        <MemoryRouter>
          <AuthorsPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dr. Vikram Chandra')).toBeInTheDocument();
        expect(screen.getByText('Aamena Zaidi')).toBeInTheDocument();
      });

      // Select All checkbox
      const selectAllCheckbox = screen.getByLabelText('Select all authors on this page');
      fireEvent.click(selectAllCheckbox);

      // Verify bulk actions banner appears
      await waitFor(() => {
        expect(screen.getByTestId('bulk-actions-banner')).toBeInTheDocument();
        expect(screen.getByText(/authors selected/i)).toBeInTheDocument();
      });

      // Find and click Bulk Delete button
      const bulkDeleteBtn = screen.getByRole('button', { name: /Bulk Delete/i });
      expect(bulkDeleteBtn).not.toBeDisabled();
      fireEvent.click(bulkDeleteBtn);

      // Verify confirmation modal opens
      await waitFor(() => {
        expect(screen.getByText('Institutional Safeguard Notice:')).toBeInTheDocument();
      });

      // Confirm deletion
      const confirmDeleteBtn = screen.getByRole('button', { name: /Delete .* Profiles Permanently/i });
      fireEvent.click(confirmDeleteBtn);

      await waitFor(() => {
        expect(bulkDeleteSpy).toHaveBeenCalledWith(
          expect.arrayContaining(['auth-1', 'auth-2'])
        );
      });
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

      const pdfBtn = screen.getByTitle('Download Official PDF');
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
        expect(screen.getByText(/Permanent Action:/i)).toBeInTheDocument();
      });

      const submitRevokeBtn = screen.getByRole('button', { name: /Permanently Revoke/i });
      expect(submitRevokeBtn).toBeDisabled(); // Disabled until reason is typed (min 5 chars)

      const reasonInput = screen.getByPlaceholderText(
        'e.g. Journal retraction or institutional correction'
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

      expect(screen.queryByRole('button', { name: /Revoke/i })).not.toBeInTheDocument();
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

    it('renders Target Bulletin dropdown dynamically for publications and disables preview until selection', async () => {
      vi.spyOn(samaAdminService, 'getImportBatches').mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      const getBulletinsSpy = vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({
        total: 2,
        items: [
          {
            id: 'bull-101',
            volume_number: 1,
            issue_number: 1,
            title: 'Inaugural Research Edition',
            publication_period: 'Jan - Jun 2026',
            file_path: 'bulletins/v1-i1.pdf',
            file_size_bytes: 1024,
            publication_count: 5,
            is_active: true,
            status: 'published',
            created_at: '2026-01-01T00:00:00Z',
          },
          {
            id: 'bull-102',
            volume_number: 1,
            issue_number: 2,
            title: 'Monsoon Research Edition',
            publication_period: 'Jul - Dec 2026',
            file_path: 'bulletins/v1-i2.pdf',
            file_size_bytes: 2048,
            publication_count: 10,
            is_active: true,
            status: 'published',
            created_at: '2026-07-01T00:00:00Z',
          },
        ],
      });

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText('Custom File Import (JSON / CSV / Excel)'));

      await waitFor(() => {
        expect(getBulletinsSpy).toHaveBeenCalled();
        expect(screen.getByLabelText('Target Bulletin *')).toBeInTheDocument();
      });

      const bulletinSelect = screen.getByLabelText('Target Bulletin *') as HTMLSelectElement;
      // Default value is empty string (no bulletin selected by default)
      expect(bulletinSelect.value).toBe('');
      expect(screen.getByText('Select the bulletin in which these publications will be imported')).toBeInTheDocument();

      // Dynamic options are loaded
      expect(screen.getByText(/Volume 1 — Issue 1 \(Inaugural Research Edition • Jan - Jun 2026\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Volume 1 — Issue 2 \(Monsoon Research Edition • Jul - Dec 2026\)/i)).toBeInTheDocument();

      // Preview button is disabled without bulletin selection
      const previewBtn = screen.getByRole('button', { name: /Generate Dry-Run Preview/i });
      expect(previewBtn).toBeDisabled();
    });

    it('sends selected bulletin ID in preview and execute requests and updates context on change', async () => {
      vi.spyOn(samaAdminService, 'getImportBatches').mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      vi.spyOn(samaAdminService, 'getBulletins').mockResolvedValue({
        total: 1,
        items: [
          {
            id: 'bull-101',
            volume_number: 2,
            issue_number: 1,
            title: 'Spring Research Edition',
            publication_period: 'Jan - Jun 2026',
            file_path: 'bulletins/v2-i1.pdf',
            file_size_bytes: 1024,
            publication_count: 5,
            is_active: true,
            status: 'published',
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
      });

      const previewSpy = vi.spyOn(samaAdminService, 'previewImport').mockResolvedValue({
        batch_id: 'batch-preview-01',
        batch_number: 'IMP-PUB-20261119-001',
        entity_type: 'publications',
        mode: 'preview',
        total_rows: 2,
        create_count: 2,
        update_count: 0,
        skip_count: 0,
        review_count: 0,
        fail_count: 0,
        errors: [],
        items: [],
        reconciliation_summary: {},
        target_bulletin_id: 'bull-101',
        target_bulletin_title: 'Volume 2 — Issue 1 (Spring Research Edition)',
      });

      const executeSpy = vi.spyOn(samaAdminService, 'executeImport').mockResolvedValue({
        batch_id: 'batch-preview-01',
        batch_number: 'IMP-PUB-20261119-001',
        entity_type: 'publications',
        status: 'completed',
        total_rows: 2,
        created_count: 2,
        updated_count: 0,
        skipped_count: 0,
        failed_count: 0,
        review_count: 0,
        target_bulletin_id: 'bull-101',
      });

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText('Custom File Import (JSON / CSV / Excel)'));

      await waitFor(() => {
        expect(screen.getByLabelText('Target Bulletin *')).toBeInTheDocument();
      });

      // 1. Select bulletin
      const bulletinSelect = screen.getByLabelText('Target Bulletin *');
      fireEvent.change(bulletinSelect, { target: { value: 'bull-101' } });
      expect((bulletinSelect as HTMLSelectElement).value).toBe('bull-101');

      // 2. Select file
      const file = new File(['[{"title": "Quantum ML"}]'], 'papers.json', { type: 'application/json' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      // 3. Button becomes enabled
      const previewBtn = screen.getByRole('button', { name: /Generate Dry-Run Preview/i });
      expect(previewBtn).not.toBeDisabled();

      // 4. Click Preview -> previewImport called with target bulletin ID
      fireEvent.click(previewBtn);
      await waitFor(() => {
        expect(previewSpy).toHaveBeenCalledWith('publications', file, 'bull-101');
      });

      // 5. Preview summary displays target bulletin information
      await waitFor(() => {
        expect(screen.getByTestId('preview-bulletin-summary')).toBeInTheDocument();
        expect(screen.getByText(/Volume 2 — Issue 1 \(Spring Research Edition\)/i)).toBeInTheDocument();
        expect(screen.getByText('All publications in this import batch will be assigned to the selected bulletin.')).toBeInTheDocument();
      });

      // 6. Click Execute Batch Import -> Modal opens showing target bulletin context
      const execBtn = screen.getByRole('button', { name: /Execute Batch Import/i });
      fireEvent.click(execBtn);

      await waitFor(() => {
        const modalInfo = screen.getByTestId('modal-bulletin-assignment-info');
        expect(modalInfo).toBeInTheDocument();
        expect(modalInfo).toHaveTextContent(/Volume 2 — Issue 1/i);
        expect(modalInfo).toHaveTextContent(/2 record\(s\)/i);
      });

      // 7. Confirm execution -> executeImport called with batch ID and target bulletin ID
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Execute Import/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(executeSpy).toHaveBeenCalledWith('batch-preview-01', 'bull-101');
      });
    });

    it('does not require bulletin selection for non-publication imports', async () => {
      vi.spyOn(samaAdminService, 'getImportBatches').mockResolvedValue({
        items: [],
        total: 0,
        skip: 0,
        limit: 10,
      });

      const previewSpy = vi.spyOn(samaAdminService, 'previewImport').mockResolvedValue({
        batch_id: 'batch-preview-auth',
        batch_number: 'IMP-AUT-20261119-001',
        entity_type: 'authors',
        mode: 'preview',
        total_rows: 1,
        create_count: 1,
        update_count: 0,
        skip_count: 0,
        review_count: 0,
        fail_count: 0,
        errors: [],
        items: [],
        reconciliation_summary: {},
      });

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText('Custom File Import (JSON / CSV / Excel)'));

      await waitFor(() => {
        expect(screen.getByLabelText('Target Bulletin *')).toBeInTheDocument();
      });

      // Switch entity type to authors
      const entitySelect = screen.getByRole('combobox', { name: '' }) || document.querySelector('select');
      // Find the entity select
      const selects = screen.getAllByRole('combobox');
      const targetEntitySelect = selects[0];
      fireEvent.change(targetEntitySelect, { target: { value: 'authors' } });

      // Target bulletin dropdown is now hidden
      expect(screen.queryByLabelText('Target Bulletin *')).not.toBeInTheDocument();

      // Upload file
      const file = new File(['[{"name": "Dr. Verma"}]'], 'authors.json', { type: 'application/json' });
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Preview button is enabled without needing a bulletin
      const previewBtn = screen.getByRole('button', { name: /Generate Dry-Run Preview/i });
      expect(previewBtn).not.toBeDisabled();

      fireEvent.click(previewBtn);
      await waitFor(() => {
        expect(previewSpy).toHaveBeenCalledWith('authors', file, undefined);
      });
    });

    it('displays bulk import guidelines, supported formats, and downloadable templates', async () => {
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

      const customTab = screen.getByText('Custom File Import (JSON / CSV / Excel)');
      fireEvent.click(customTab);

      await waitFor(() => {
        expect(screen.getByTestId('import-guidelines-section')).toBeInTheDocument();
        expect(screen.getByText(/Supported File Formats:/i)).toBeInTheDocument();
        expect(screen.getByText(/✓ JSON \(\.json\)/i)).toBeInTheDocument();
        expect(screen.getByText(/✓ CSV \(\.csv\)/i)).toBeInTheDocument();
        expect(screen.getByText(/✓ Excel \(\.xlsx \/ \.xls\)/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Expected Column Headers (CSV / Excel) or JSON Keys:')).toBeInTheDocument();
      expect(screen.getByText('Download JSON Template')).toBeInTheDocument();
      expect(screen.getByText('Download CSV Template')).toBeInTheDocument();

      // Bulletin Assignment dedicated section
      const bulletinInfo = screen.getByTestId('bulletin-assignment-info');
      expect(bulletinInfo).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 5, name: 'Bulletin Assignment' })).toBeInTheDocument();
      expect(bulletinInfo).toHaveTextContent(/bulletin_id is automatically assigned by the system during import based on the selected target bulletin/i);
      expect(bulletinInfo).toHaveTextContent(/You do not need to include bulletin_id in your JSON or CSV file/i);
      expect(bulletinInfo).toHaveTextContent(/All publications in a bulk import will be associated with the selected bulletin/i);
      expect(screen.getByText('Target bulletin must be selected during the import process.')).toBeInTheDocument();
      expect(screen.getByText('Bulletin ID is resolved internally from the selected bulletin.')).toBeInTheDocument();
      expect(bulletinInfo).toHaveTextContent(/bulletin_id is not required in the uploaded file/i);
      expect(screen.getByText('All imported records will be linked to the selected bulletin.')).toBeInTheDocument();

      // System-managed fields note
      const systemFieldsNote = screen.getByTestId('system-managed-fields-note');
      expect(systemFieldsNote).toBeInTheDocument();
      expect(systemFieldsNote).toHaveTextContent(/System-managed fields:/i);
      expect(systemFieldsNote).toHaveTextContent(/Fields such as bulletin_id are assigned internally during import and are not part of the publication upload schema/i);

      // Template guidance note
      const templateGuidance = screen.getByTestId('template-guidance-note');
      expect(templateGuidance).toBeInTheDocument();
      expect(templateGuidance).toHaveTextContent(/JSON and CSV files contain publication-level information only/i);
      expect(templateGuidance).toHaveTextContent(/The same uploaded file can be reused for a different bulletin/i);
      expect(templateGuidance).toHaveTextContent(/no database IDs should be manually added to the template/i);
    });

    it('supports batch selection and bulk delete for Super Admin', async () => {
      mockAuth({
        user: {
          id: 'usr-super',
          email: 'admin@csjmu.ac.in',
          first_name: 'Super',
          last_name: 'Admin',
          role: 'super_admin',
          roles: ['super_admin'],
          is_active: true,
          is_verified: true,
          created_at: '2026-01-01T00:00:00Z',
        },
        isAdmin: true,
        isSuperAdmin: true,
      });

      vi.spyOn(samaAdminService, 'getImportBatches').mockResolvedValue({
        items: [
          {
            id: 'batch-1',
            batch_number: 'IMP-PUB-20261026-001',
            entity_type: 'publications',
            source_filename: 'papers.json',
            file_format: 'json',
            mode: 'execute',
            status: 'completed',
            total_rows: 5,
            created_count: 5,
            updated_count: 0,
            skipped_count: 0,
            failed_count: 0,
            review_count: 0,
            created_at: '2026-10-26T10:00:00Z',
          },
        ],
        total: 1,
        skip: 0,
        limit: 10,
      });

      const bulkDeleteBatchesSpy = vi
        .spyOn(samaAdminService, 'bulkDeleteImportBatches')
        .mockResolvedValue({
          deleted_count: 1,
          deleted_ids: ['batch-1'],
          failed_count: 0,
          failed_items: [],
          total_requested: 1,
        });

      render(
        <MemoryRouter>
          <ImportPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('IMP-PUB-20261026-001')).toBeInTheDocument();
      });

      const batchCheckbox = screen.getByLabelText('Select batch IMP-PUB-20261026-001');
      fireEvent.click(batchCheckbox);

      await waitFor(() => {
        expect(screen.getByTestId('batch-bulk-actions-banner')).toBeInTheDocument();
      });

      const deleteBatchesBtn = screen.getByRole('button', { name: /Bulk Delete Batches/i });
      fireEvent.click(deleteBatchesBtn);

      await waitFor(() => {
        expect(screen.getByText('Institutional Action Notice:')).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: /Delete 1 Batches/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(bulkDeleteBatchesSpy).toHaveBeenCalledWith(['batch-1']);
      });
    });
  });
});
