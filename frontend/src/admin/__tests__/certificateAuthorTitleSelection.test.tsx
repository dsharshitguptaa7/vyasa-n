import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as AuthContextModule from '../../context/AuthContext';
import { samaAdminService } from '../services/samaAdminService';
import { CertificatesPage } from '../pages/sama/CertificatesPage';
import type {
  AuthorRecord,
  BulletinRecord,
  CertificateRecord,
  CertificateTemplateItem,
  CertificateSignatoryItem,
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
    hasPermission: () => true,
    switchPersona: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('mock-jwt-token'),
    ...overrides,
  };

  vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(defaultAuth);
  return defaultAuth;
};

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
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    created_at: '2026-01-10T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
  },
  {
    id: 'auth-2',
    full_name: 'Prof. Ananya Roy',
    name: 'Prof. Ananya Roy',
    email: 'aroy@csjmu.ac.in',
    department: 'Life Sciences',
    designation: 'Professor',
    scopus_id: '59258716900',
    scopus_author_id: '59258716900',
    is_verified: true,
    is_scopus_verified: true,
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  },
  {
    id: 'auth-3',
    full_name: 'Ramesh Sharma',
    name: 'Ramesh Sharma',
    email: 'rsharma@csjmu.ac.in',
    department: 'Physics',
    designation: 'Assistant Professor',
    scopus_id: '57299999999',
    scopus_author_id: '57299999999',
    is_verified: true,
    is_scopus_verified: true,
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    created_at: '2026-02-05T00:00:00Z',
    updated_at: '2026-02-05T00:00:00Z',
  },
];

const mockBulletins: BulletinRecord[] = [
  {
    id: 'bull-1',
    title: 'CSJMU Research Bulletin Vol 2 Issue 1',
    slug: 'csjmu-rb-v2-i1',
    volume: 2,
    volume_number: 2,
    issue: 1,
    issue_number: 1,
    publication_month: 'January',
    publication_year: 2026,
    status: 'published',
    is_active: true,
    created_at: '2026-01-20T00:00:00Z',
  },
];

const mockTemplates: CertificateTemplateItem[] = [
  {
    id: 'tpl-1',
    code: 'DEFAULT_CSJMU_PUBLICATION_A4',
    name: 'CSJMU Standard Publication Certificate (A4 Landscape)',
    description: 'Official university publication recognition certificate template',
    certificate_type: 'RESEARCH_PUBLICATION',
    orientation: 'LANDSCAPE',
    is_active: true,
    is_default: true,
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockSignatories: CertificateSignatoryItem[] = [
  {
    id: 'sig-1',
    authority_type: 'DEAN_RD',
    signatory_name: 'Prof. (Dr.) Rajesh Kumar',
    designation: 'Dean – Research & Development',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const mockCertificates: CertificateRecord[] = [
  {
    id: 'cert-1',
    certificate_number: 'CSJMU/RD/2026/V2-I1/001',
    bulletin_id: 'bull-1',
    author_id: 'auth-99',
    verification_hash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
    is_revoked: false,
    created_at: '2026-01-25T00:00:00Z',
    author_name: 'Dr. Existing Saved Author',
    bulletin_title: 'CSJMU Research Bulletin Vol 2 Issue 1',
    authors: [
      {
        id: 'cauth-1',
        certificate_id: 'cert-1',
        researcher_id: 'auth-99',
        author_name_snapshot: 'Dr. Existing Saved Author',
        academic_title_snapshot: null,
        scopus_id_snapshot: '57200000099',
        affiliation_snapshot: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
        department_snapshot: 'Computer Applications',
        author_order: 1,
        author_role: 'First Author',
        created_at: '2026-01-25T00:00:00Z',
      },
    ],
  },
];

describe('Create Joint Institutional Certificate - Author Title Selection Behavior', { timeout: 15000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();

    vi.spyOn(samaAdminService, 'getPublications').mockResolvedValue({
      items: [],
      total: 0,
      skip: 0,
      limit: 15,
    });
    vi.spyOn(samaAdminService, 'getCertificates').mockResolvedValue({
      items: mockCertificates,
      total: mockCertificates.length,
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
    vi.spyOn(samaAdminService, 'getTemplates').mockResolvedValue({
      items: mockTemplates,
      total: mockTemplates.length,
    });
    vi.spyOn(samaAdminService, 'getSignatories').mockResolvedValue({
      items: mockSignatories,
      total: mockSignatories.length,
    });
    vi.spyOn(samaAdminService, 'getCertificateStats').mockResolvedValue({
      total: 1,
      draft: 0,
      in_review: 0,
      approved: 0,
      issued: 1,
      revoked: 0,
    });
  });

  const navigateToStep2 = async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/RD/2026/V2-I1/001')).toBeInTheDocument();
    });

    // Open Wizard
    const newBtn = screen.getByRole('button', { name: /New Joint Certificate/i });
    fireEvent.click(newBtn);

    await waitFor(() => {
      expect(screen.getByText('Create Joint Institutional Certificate')).toBeInTheDocument();
    });

    // Select bulletin volume in Step 1 (automatically selects the single issue if only 1 matches)
    const volumeSelect = screen.getByDisplayValue(/Select Volume/i);
    fireEvent.change(volumeSelect, { target: { value: '2' } });

    // Click Next → Step 2
    const nextBtn = screen.getByRole('button', { name: /Next Step/i });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(screen.getByText(/Search Institutional Directory/i)).toBeInTheDocument();
    });
  };

  it('1. Selecting a directory researcher with profile title "Dr." results in certificate title "None"', async () => {
    await navigateToStep2();

    // Verify Title selector for directory author defaults to "None"
    const dirTitleSelect = screen.getByLabelText('Directory Author Title');
    expect(dirTitleSelect).toHaveValue('None');

    // Search for "Vikram" (profile: Dr. Vikram Chandra)
    const searchInput = screen.getByPlaceholderText(/Search by researcher name, department, or Scopus ID/i);
    fireEvent.change(searchInput, { target: { value: 'Vikram' } });

    await waitFor(() => {
      expect(screen.getByText('Dr. Vikram Chandra')).toBeInTheDocument();
    });

    // Add author from directory
    const addBtn = screen.getByRole('button', { name: /^\+ Add$/ });
    fireEvent.click(addBtn);

    // Verify added recipient in the list has Title "None"
    await waitFor(() => {
      const authorTitleSelect = screen.getByLabelText('Author Title for Dr. Vikram Chandra');
      expect(authorTitleSelect).toHaveValue('None');
    });

    // Verify researcher identity, department, affiliation, Scopus ID, and role remain correctly populated
    expect(screen.getByText('Dr. Vikram Chandra')).toBeInTheDocument();
    expect(screen.getByText(/Computer Applications • Chhatrapati Shahu Ji Maharaj University, Kanpur/i)).toBeInTheDocument();
    expect(screen.getByText('Scopus: 57200000001')).toBeInTheDocument();
    expect(screen.getAllByText('First Author').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Directory')).toBeInTheDocument();
  });

  it('2. Selecting a directory researcher with profile title "Prof." results in certificate title "None"', async () => {
    await navigateToStep2();

    // Search for "Ananya" (profile: Prof. Ananya Roy)
    const searchInput = screen.getByPlaceholderText(/Search by researcher name, department, or Scopus ID/i);
    fireEvent.change(searchInput, { target: { value: 'Ananya' } });

    await waitFor(() => {
      expect(screen.getByText('Prof. Ananya Roy')).toBeInTheDocument();
    });

    // Add author from directory
    const addBtn = screen.getByRole('button', { name: /^\+ Add$/ });
    fireEvent.click(addBtn);

    // Verify added recipient has Title "None" and NOT "Prof."
    await waitFor(() => {
      const authorTitleSelect = screen.getByLabelText('Author Title for Prof. Ananya Roy');
      expect(authorTitleSelect).toHaveValue('None');
    });

    expect(screen.getByText('Prof. Ananya Roy')).toBeInTheDocument();
    expect(screen.getByText(/Life Sciences • Chhatrapati Shahu Ji Maharaj University, Kanpur/i)).toBeInTheDocument();
    expect(screen.getByText('Scopus: 59258716900')).toBeInTheDocument();
  });

  it('3. Manual Entry defaults to "None" as title', async () => {
    await navigateToStep2();

    // Check manual author title select
    const manualTitleSelect = screen.getByLabelText('Manual Author Title');
    expect(manualTitleSelect).toHaveValue('None');

    // Fill in manual author details
    const nameInput = screen.getByPlaceholderText(/e\.g\. Ramesh Chandra Verma/i);
    fireEvent.change(nameInput, { target: { value: 'Suresh Kumar' } });

    const addManualBtn = screen.getByRole('button', { name: /\+ Add Author/i });
    fireEvent.click(addManualBtn);

    // Verify added author has Title "None"
    await waitFor(() => {
      const authorTitleSelect = screen.getByLabelText('Author Title for Suresh Kumar');
      expect(authorTitleSelect).toHaveValue('None');
    });

    // Verify manual author title select resets to "None"
    expect(manualTitleSelect).toHaveValue('None');
  });

  it('4. Explicitly selecting "Prof." or "Er." preserves the selected title', async () => {
    await navigateToStep2();

    // Test explicit title via Directory Title selector before adding
    const dirTitleSelect = screen.getByLabelText('Directory Author Title');
    fireEvent.change(dirTitleSelect, { target: { value: 'Prof.' } });

    const searchInput = screen.getByPlaceholderText(/Search by researcher name, department, or Scopus ID/i);
    fireEvent.change(searchInput, { target: { value: 'Ramesh' } });

    await waitFor(() => {
      expect(screen.getByText('Ramesh Sharma')).toBeInTheDocument();
    });

    const addBtn = screen.getByRole('button', { name: /^\+ Add$/ });
    fireEvent.click(addBtn);

    await waitFor(() => {
      const authorTitleSelect = screen.getByLabelText('Author Title for Ramesh Sharma');
      expect(authorTitleSelect).toHaveValue('Prof.');
    });

    // Test explicit selection of "Er." in recipient row
    const authorTitleSelect = screen.getByLabelText('Author Title for Ramesh Sharma');
    fireEvent.change(authorTitleSelect, { target: { value: 'Er.' } });
    expect(authorTitleSelect).toHaveValue('Er.');

    // Test explicit title via Manual Entry
    const manualTitleSelect = screen.getByLabelText('Manual Author Title');
    fireEvent.change(manualTitleSelect, { target: { value: 'Er.' } });

    const nameInput = screen.getByPlaceholderText(/e\.g\. Ramesh Chandra Verma/i);
    fireEvent.change(nameInput, { target: { value: 'Kavita Singh' } });

    const addManualBtn = screen.getByRole('button', { name: /\+ Add Author/i });
    fireEvent.click(addManualBtn);

    await waitFor(() => {
      const addedKavitaTitleSelect = screen.getByLabelText('Author Title for Kavita Singh');
      expect(addedKavitaTitleSelect).toHaveValue('Er.');
    });
  });

  it('5. Existing saved certificates remain unchanged', async () => {
    render(
      <MemoryRouter>
        <CertificatesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('CSJMU/RD/2026/V2-I1/001')).toBeInTheDocument();
      expect(screen.getByText('Dr. Existing Saved Author')).toBeInTheDocument();
      expect(screen.getByText('[Scopus: 57200000099]')).toBeInTheDocument();
    });
  });
});
