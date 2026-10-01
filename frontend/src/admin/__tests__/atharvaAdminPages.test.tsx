import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthoritiesPage } from '../pages/atharva/AuthoritiesPage';
import { SubjectClustersPage } from '../pages/atharva/SubjectClustersPage';
import { GrievanceClustersPage } from '../pages/atharva/GrievanceClustersPage';
import { GrievanceCategoriesPage } from '../pages/atharva/GrievanceCategoriesPage';
import { AuditLogsPage } from '../pages/atharva/AuditLogsPage';
import { atharvaAdminService } from '../services/atharvaAdminService';
import {
  Authority,
  SubjectCluster,
  GrievanceCluster,
  Category,
  PaginatedAuditLogs,
} from '../types/atharva';

const mockAuthorities: Authority[] = [
  {
    id: 'auth-1',
    vyasa_user_id: 'user-1',
    role: 'ASSISTANT_DEAN',
    name_snapshot: 'Dr. Ramesh Sharma',
    email_snapshot: 'ramesh@csjmu.ac.in',
    phone_snapshot: '9876543210',
    designation: 'Assistant Dean (Engineering)',
    department: 'Engineering & Technology',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'auth-2',
    vyasa_user_id: 'user-2',
    role: 'ASSOCIATE_DEAN',
    name_snapshot: 'Dr. Sunita Patel',
    email_snapshot: 'sunita@csjmu.ac.in',
    phone_snapshot: null,
    designation: 'Associate Dean (Academic Affairs)',
    department: 'Academics',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockSubjectClusters: SubjectCluster[] = [
  {
    id: 'sc-1',
    cluster_number: 101,
    name: 'Computer Science & IT',
    description: 'Computing sciences faculty cluster',
    is_active: true,
    assistant_dean_id: 'auth-1',
    assistant_dean: mockAuthorities[0],
    subject_count: 5,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockGrievanceClusters: GrievanceCluster[] = [
  {
    id: 'gc-1',
    cluster_number: 201,
    name: 'Fellowship & Scholarship Affairs',
    description: 'Financial disbursals and grant inquiries',
    is_active: true,
    associate_dean_id: 'auth-2',
    associate_dean: mockAuthorities[1],
    category_count: 3,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'Delayed Fellowship Disbursal',
    routing_type: 'CLUSTER',
    grievance_cluster_id: 'gc-1',
    cluster_name: 'Fellowship & Scholarship Affairs',
    cluster_number: 201,
    fixed_authority_id: null,
    fixed_authority_name: null,
    fixed_authority_role: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const mockAuditLogs: PaginatedAuditLogs = {
  total: 1,
  logs: [
    {
      id: 'log-1',
      user_id: 'user-admin',
      user_email: 'admin@csjmu.ac.in',
      module: 'atharva_veda',
      action: 'taxonomy.update_assistant_dean_mapping',
      entity_name: 'SubjectCluster',
      entity_id: 'sc-1',
      details: {
        cluster_name: 'Computer Science & IT',
        old_assistant_dean_id: null,
        new_assistant_dean_id: 'auth-1',
      },
      ip_address: '127.0.0.1',
      created_at: '2026-01-01T12:00:00Z',
    },
  ],
};

describe('Atharva Veda Admin Configuration UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. AuthoritiesPage: renders authorities, filters, and opens toggle confirmation modal', async () => {
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <AuthoritiesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dr. Ramesh Sharma')).toBeInTheDocument();
      expect(screen.getByText('Dr. Sunita Patel')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Authorities')).toBeInTheDocument();
    expect(screen.getByText('Active Authorities')).toBeInTheDocument();

    // Click Deactivate button on first authority
    const deactivateButtons = screen.getAllByRole('button', { name: /Deactivate/i });
    fireEvent.click(deactivateButtons[0]);

    // Modal appears with impact warning
    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to deactivate/i)).toBeInTheDocument();
      expect(screen.getByText(/Warning:/i)).toBeInTheDocument();
    });
  });

  it('2. SubjectClustersPage: renders clusters and opens reassign modal with routing impact notice', async () => {
    vi.spyOn(atharvaAdminService, 'getSubjectClusters').mockResolvedValue(mockSubjectClusters);
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <SubjectClustersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Computer Science & IT')).toBeInTheDocument();
      expect(screen.getByText('#101')).toBeInTheDocument();
    });

    // Click Reassign Dean button
    const reassignBtn = screen.getByRole('button', { name: /Reassign Dean/i });
    fireEvent.click(reassignBtn);

    // Modal appears with prompt warning
    await waitFor(() => {
      expect(screen.getByText(/Administrative Notice:/i)).toBeInTheDocument();
      expect(screen.getByText(/Changing this mapping will immediately affect future subject-based routing/i)).toBeInTheDocument();
    });
  });

  it('3. GrievanceClustersPage: renders grievance clusters and opens reassign modal with notice', async () => {
    vi.spyOn(atharvaAdminService, 'getGrievanceClusters').mockResolvedValue(mockGrievanceClusters);
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <GrievanceClustersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Fellowship & Scholarship Affairs')).toBeInTheDocument();
      expect(screen.getByText('#201')).toBeInTheDocument();
    });

    // Click Reassign Dean button
    const reassignBtn = screen.getByRole('button', { name: /Reassign Dean/i });
    fireEvent.click(reassignBtn);

    // Modal appears with prompt warning
    await waitFor(() => {
      expect(screen.getByText(/Administrative Warning:/i)).toBeInTheDocument();
      expect(screen.getByText(/Changing this mapping will affect future category-based routing/i)).toBeInTheDocument();
    });
  });

  it('4. GrievanceCategoriesPage: renders categories and opens configure routing modal', async () => {
    vi.spyOn(atharvaAdminService, 'getCategories').mockResolvedValue(mockCategories);
    vi.spyOn(atharvaAdminService, 'getGrievanceClusters').mockResolvedValue(mockGrievanceClusters);
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <GrievanceCategoriesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Delayed Fellowship Disbursal')).toBeInTheDocument();
    });

    // Click Configure Routing button
    const configBtn = screen.getByRole('button', { name: /Configure Routing/i });
    fireEvent.click(configBtn);

    await waitFor(() => {
      expect(screen.getByText(/Configure Routing: Delayed Fellowship Disbursal/i)).toBeInTheDocument();
      expect(screen.getByText(/Routing Strategy/i)).toBeInTheDocument();
    });
  });

  it('5. AuditLogsPage: renders audit logs and displays details modal with json diff', async () => {
    vi.spyOn(atharvaAdminService, 'getAuditLogs').mockResolvedValue(mockAuditLogs);

    render(
      <MemoryRouter>
        <AuditLogsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('taxonomy.update_assistant_dean_mapping')).toBeInTheDocument();
      expect(screen.getByText('SubjectCluster')).toBeInTheDocument();
      expect(screen.getByText('admin@csjmu.ac.in')).toBeInTheDocument();
    });

    // Click View Diff button
    const diffBtn = screen.getByRole('button', { name: /View Diff/i });
    fireEvent.click(diffBtn);

    await waitFor(() => {
      expect(screen.getByText(/Event Payload & Mutation Diff/i)).toBeInTheDocument();
      expect(screen.getAllByText(/sc-1/i).length).toBeGreaterThanOrEqual(1);
    });
  });
});
