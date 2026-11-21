import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { CamProjectsPage } from '../pages/sama/CamProjectsPage';
import { samaAdminService } from '../services/samaAdminService';
import {
  extractPrimaryPIName,
  formatInvestigatorNames,
  normalizeInvestigatorNames,
} from '../utils/investigators';
import type { CamProjectRecord } from '../types/sama';

// Mock auth helper
vi.mock('../../../auth/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'usr-admin-1',
      email: 'admin@csjmu.ac.in',
      first_name: 'CAM-AI',
      last_name: 'Admin',
      roles: ['super_admin'],
      permissions: ['sama:read', 'sama:content:edit', 'sama:publish', 'sama:admin'],
    },
    isAuthenticated: true,
  }),
}));

describe('Investigator Utilities Contract', () => {
  it('extractPrimaryPIName extracts authoritative PI name from string or object array', () => {
    // 1. String primary
    expect(extractPrimaryPIName('Dr. Alok Gupta', undefined)).toBe('Dr. Alok Gupta');

    // 2. Object array (backend format)
    expect(
      extractPrimaryPIName(undefined, [
        { name: 'Dr. Alok Gupta', department: 'CSE', school: 'UIET' },
      ])
    ).toBe('Dr. Alok Gupta');

    // 3. String array
    expect(extractPrimaryPIName(undefined, ['Dr. Alok Gupta'])).toBe('Dr. Alok Gupta');

    // 4. Fallback when empty or null
    expect(extractPrimaryPIName('', [])).toBeNull();
    expect(extractPrimaryPIName(undefined, undefined)).toBeNull();
  });

  it('formatInvestigatorNames formats object arrays and NEVER outputs [object Object]', () => {
    // 1. Array of structured objects (typical DB format)
    const structuredCoPis = [
      { name: 'Dr. Bina Patel', department: 'AI Lab' },
      { name: 'Dr. Chetan Sharma', school: 'UIET' },
    ];
    const formatted = formatInvestigatorNames(structuredCoPis);
    expect(formatted).toBe('Dr. Bina Patel, Dr. Chetan Sharma');
    expect(formatted).not.toContain('[object Object]');

    // 2. Array of plain strings
    expect(formatInvestigatorNames(['Dr. Bina Patel', 'Dr. Chetan Sharma'])).toBe(
      'Dr. Bina Patel, Dr. Chetan Sharma'
    );

    // 3. Comma-separated string
    expect(formatInvestigatorNames('Dr. Bina Patel, Dr. Chetan Sharma')).toBe(
      'Dr. Bina Patel, Dr. Chetan Sharma'
    );

    // 4. Empty/null
    expect(formatInvestigatorNames([])).toBe('');
    expect(formatInvestigatorNames(null)).toBe('');
  });

  it('normalizeInvestigatorNames extracts cleaned string array without object artifacts', () => {
    const raw = [
      { name: ' Dr. Alpha ' },
      'Dr. Beta',
      { full_name: 'Dr. Gamma' },
      null,
      '',
    ];
    expect(normalizeInvestigatorNames(raw as any)).toEqual([
      'Dr. Alpha',
      'Dr. Beta',
      'Dr. Gamma',
    ]);
  });
});

describe('CAM-AI Projects CMS Page - Data Integrity & Update Flow', () => {
  const mockProjects: CamProjectRecord[] = [
    {
      id: 'cam-project-101',
      title: 'Autonomous Drone Crop Monitoring System',
      project_title: 'Autonomous Drone Crop Monitoring System',
      category: 'Major',
      domain: 'Agri-Tech & Edge AI',
      // Backend returns principal_investigators array of objects
      principal_investigators: [
        { name: 'Dr. Sneha Verma', department: 'Computer Science', school: 'UIET' },
      ],
      // Backend returns co_investigators array of objects
      co_investigators: [
        { name: 'Dr. Rahul Sharma', department: 'Agriculture Sciences' },
        { name: 'Dr. Anita Roy', department: 'Electronics' },
      ],
      funding_amount_inr: 750000,
      funding_amount: 750000,
      funding_display: '₹7,50,000',
      status: 'Ongoing',
      sanction_year: 2026,
      created_at: '2026-01-15T10:00:00Z',
    },
    {
      id: 'cam-project-102',
      title: 'Healthcare AI Diagnostics for Rural Clinics',
      category: 'Minor',
      domain: 'Biomedical AI',
      principal_investigator: 'Dr. Vikram Chandra',
      co_investigators: ['Dr. Meera Nambiar'],
      funding_amount_inr: 250000,
      status: 'Sanctioned',
      sanction_year: 2025,
      created_at: '2025-11-20T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(samaAdminService, 'getCamProjects').mockResolvedValue({
      items: mockProjects,
      total: mockProjects.length,
      skip: 0,
      limit: 15,
    });
  });

  it('renders project list with correct PI and Co-PI without [object Object] or Not assigned', async () => {
    render(
      <MemoryRouter>
        <CamProjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Autonomous Drone Crop Monitoring System')
      ).toBeInTheDocument();
    });

    // 1. Authoritative PI should show Dr. Sneha Verma, NEVER "Not assigned"
    expect(screen.getByText('PI: Dr. Sneha Verma')).toBeInTheDocument();
    expect(screen.queryByText('PI: Not assigned')).not.toBeInTheDocument();

    // 2. Co-PIs should show names, NEVER "[object Object]"
    expect(
      screen.getByText('Co-PIs: Dr. Rahul Sharma, Dr. Anita Roy')
    ).toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();

    // 3. Funding formatted
    expect(screen.getByText('₹7,50,000')).toBeInTheDocument();

    // 4. Second project with string PI and string Co-PI
    expect(screen.getByText('PI: Dr. Vikram Chandra')).toBeInTheDocument();
    expect(screen.getByText('Co-PIs: Dr. Meera Nambiar')).toBeInTheDocument();
  });

  it('opens Edit modal and cleanly populates PI and Co-PI form fields without [object Object]', async () => {
    render(
      <MemoryRouter>
        <CamProjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Autonomous Drone Crop Monitoring System')
      ).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /^Edit$/i });
    fireEvent.click(editButtons[0]);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByText('Edit CAM-AI Project')).toBeInTheDocument();
    });

    // Check input values
    const piInput = screen.getByLabelText(/Principal Investigator/i) as HTMLInputElement;
    expect(piInput.value).toBe('Dr. Sneha Verma');

    const coPiInput = screen.getByLabelText(/Co-Investigators/i) as HTMLInputElement;
    expect(coPiInput.value).toBe('Dr. Rahul Sharma, Dr. Anita Roy');
    expect(coPiInput.value).not.toContain('[object Object]');
  });

  it('updates CAM-AI project successfully without 500 or serialization errors', async () => {
    const updateSpy = vi
      .spyOn(samaAdminService, 'updateCamProject')
      .mockResolvedValue({
        ...mockProjects[0],
        domain: 'Advanced Edge AI & Robotics',
      });

    render(
      <MemoryRouter>
        <CamProjectsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText('Autonomous Drone Crop Monitoring System')
      ).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /^Edit$/i });
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit CAM-AI Project')).toBeInTheDocument();
    });

    // Change domain
    const domainInput = screen.getByLabelText(/Research Domain/i);
    fireEvent.change(domainInput, {
      target: { value: 'Advanced Edge AI & Robotics' },
    });

    // Click Update Project
    const updateButton = screen.getByRole('button', { name: /Update Project/i });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });

    // Verify payload sent
    const calledPayload = updateSpy.mock.calls[0][1];
    expect(calledPayload.domain).toBe('Advanced Edge AI & Robotics');
    expect(calledPayload.title).toBe('Autonomous Drone Crop Monitoring System');
    // Ensure co_investigators preserved metadata
    expect(calledPayload.co_investigators).toEqual([
      { name: 'Dr. Rahul Sharma', department: 'Agriculture Sciences' },
      { name: 'Dr. Anita Roy', department: 'Electronics' },
    ]);
  });
});
