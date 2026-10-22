import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthoritiesPage } from '../pages/atharva/AuthoritiesPage';
import { SubjectClustersPage } from '../pages/atharva/SubjectClustersPage';
import { SubjectsPage } from '../pages/atharva/SubjectsPage';
import { GrievanceClustersPage } from '../pages/atharva/GrievanceClustersPage';
import { GrievanceCategoriesPage } from '../pages/atharva/GrievanceCategoriesPage';
import { AuditLogsPage } from '../pages/atharva/AuditLogsPage';
import { atharvaAdminService } from '../services/atharvaAdminService';
import {
  Authority,
  SubjectCluster,
  Subject,
  GrievanceCluster,
  Category,
  PaginatedAuditLogs,
  RoutingSimulationResult,
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

const mockSubjects: Subject[] = [
  {
    id: 'sub-1',
    name: 'Computer Science & Engineering',
    code: 'CSE-01',
    subject_cluster_id: 'sc-1',
    cluster_name: 'Computer Science & IT',
    cluster_number: 101,
    is_active: true,
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

const mockSimResult: RoutingSimulationResult = {
  status: 'ROUTED',
  routing_type: 'CLUSTER',
  category_name: 'Delayed Fellowship Disbursal',
  target_authority_id: 'auth-2',
  target_authority_name: 'Dr. Sunita Patel',
  target_authority_role: 'ASSOCIATE_DEAN',
  cluster_name: 'Fellowship & Scholarship Affairs',
  cluster_number: 201,
  path_taken: [
    'Category: Delayed Fellowship Disbursal -> routing_type: CLUSTER',
    'Cluster #201: Fellowship & Scholarship Affairs -> Associate Dean: Dr. Sunita Patel (ASSOCIATE_DEAN)',
    'Active check passed -> Destination Authority assigned.',
  ],
  warnings: [],
  fallback_used: false,
};

describe('Atharva Veda Admin Configuration UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. AuthoritiesPage: renders authorities, filters, toggle confirmation, and opens Add Authority modal', async () => {
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

    // Cancel deactivate modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Click + Add Authority button
    const addBtn = screen.getByRole('button', { name: /\+ Add Authority/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Provision Institutional Authority')).toBeInTheDocument();
      expect(screen.getByText(/Officer Name \*/i)).toBeInTheDocument();
    });
  });

  it('2. SubjectClustersPage: renders clusters, opens reassign modal and opens Add Cluster modal', async () => {
    vi.spyOn(atharvaAdminService, 'getSubjectClusters').mockResolvedValue(mockSubjectClusters);
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <SubjectClustersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Computer Science & IT/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/101/).length).toBeGreaterThanOrEqual(1);
    });

    // Click Reassign Dean button
    const reassignBtn = screen.getByRole('button', { name: /Reassign Dean/i });
    fireEvent.click(reassignBtn);

    // Modal appears with prompt warning
    await waitFor(() => {
      expect(screen.getByText(/Reconfigure Assistant Dean: Computer Science & IT/i)).toBeInTheDocument();
      expect(screen.getByText(/Future coursework and disciplinary grievances mapped to this cluster/i)).toBeInTheDocument();
    });

    // Cancel reassign modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Click + Add Cluster button
    const addBtn = screen.getByRole('button', { name: /\+ Add Cluster/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Create Academic Subject Cluster')).toBeInTheDocument();
      expect(screen.getByText(/Cluster Name \*/i)).toBeInTheDocument();
    });
  });

  it('3. GrievanceClustersPage: renders grievance clusters, opens reassign modal and Add Cluster modal', async () => {
    vi.spyOn(atharvaAdminService, 'getGrievanceClusters').mockResolvedValue(mockGrievanceClusters);
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);

    render(
      <MemoryRouter>
        <GrievanceClustersPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Fellowship & Scholarship Affairs/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/201/).length).toBeGreaterThanOrEqual(1);
    });

    // Click Reassign Dean button
    const reassignBtn = screen.getByRole('button', { name: /Reassign Dean/i });
    fireEvent.click(reassignBtn);

    // Modal appears with prompt warning
    await waitFor(() => {
      expect(screen.getByText(/Reconfigure Associate Dean: Fellowship & Scholarship Affairs/i)).toBeInTheDocument();
      expect(screen.getByText(/Future grievances categorized under this cluster will route directly to this officer/i)).toBeInTheDocument();
    });

    // Cancel reassign modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Click + Add Cluster button
    const addBtn = screen.getByRole('button', { name: /\+ Add Cluster/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Create Grievance Functional Cluster')).toBeInTheDocument();
      expect(screen.getByText(/Cluster Domain Name \*/i)).toBeInTheDocument();
    });
  });

  it('4. SubjectsPage: renders subjects and opens Add Subject and Re-map modals', async () => {
    vi.spyOn(atharvaAdminService, 'getSubjects').mockResolvedValue(mockSubjects);
    vi.spyOn(atharvaAdminService, 'getSubjectClusters').mockResolvedValue(mockSubjectClusters);

    render(
      <MemoryRouter>
        <SubjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Computer Science & Engineering')).toBeInTheDocument();
      expect(screen.getByText(/CSE-01/)).toBeInTheDocument();
    });

    // Click Re-map button
    const remapBtn = screen.getByRole('button', { name: /Re-map/i });
    fireEvent.click(remapBtn);

    await waitFor(() => {
      expect(screen.getByText(/Re-map Faculty Cluster: Computer Science & Engineering/i)).toBeInTheDocument();
      expect(screen.getByText(/Target Subject Cluster \*/i)).toBeInTheDocument();
    });

    // Cancel remap
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Click + Add Subject button
    const addBtn = screen.getByRole('button', { name: /\+ Add Subject/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Add New Academic Subject')).toBeInTheDocument();
      expect(screen.getByText(/Subject Name \*/i)).toBeInTheDocument();
    });
  });

  it('5. GrievanceCategoriesPage: renders categories, opens Add modal, and tests dynamic routing simulation', async () => {
    vi.spyOn(atharvaAdminService, 'getCategories').mockResolvedValue(mockCategories);
    vi.spyOn(atharvaAdminService, 'getGrievanceClusters').mockResolvedValue(mockGrievanceClusters);
    vi.spyOn(atharvaAdminService, 'getAuthorities').mockResolvedValue(mockAuthorities);
    vi.spyOn(atharvaAdminService, 'getSubjects').mockResolvedValue(mockSubjects);
    const simSpy = vi.spyOn(atharvaAdminService, 'simulateRouting').mockResolvedValue(mockSimResult);

    render(
      <MemoryRouter>
        <GrievanceCategoriesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Delayed Fellowship Disbursal')).toBeInTheDocument();
    });

    // Click Route button
    const routeBtn = screen.getByRole('button', { name: /^Route$/i });
    fireEvent.click(routeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Configure Routing: Delayed Fellowship Disbursal/i)).toBeInTheDocument();
      expect(screen.getByText(/Routing Strategy/i)).toBeInTheDocument();
    });

    // Cancel route modal
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    // Click Simulate Routing Engine button
    const simBtn = screen.getByRole('button', { name: /🔍 Simulate Routing Engine/i });
    fireEvent.click(simBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dynamic Routing Simulation & Decision Path Inspector/i)).toBeInTheDocument();
    });

    // Run Simulation
    const runSimBtn = screen.getByRole('button', { name: /Run Simulation/i });
    fireEvent.click(runSimBtn);

    await waitFor(() => {
      expect(simSpy).toHaveBeenCalledWith({
        category_id: 'cat-1',
        subject_id: null,
      });
      expect(screen.getByText('Simulation Result:')).toBeInTheDocument();
      expect(screen.getByText('ROUTED')).toBeInTheDocument();
      expect(screen.getAllByText(/Dr\. Sunita Patel/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Decision Path Traced:/)).toBeInTheDocument();
    });
  });

  it('6. AuditLogsPage: renders audit logs and displays details modal with json diff', async () => {
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
