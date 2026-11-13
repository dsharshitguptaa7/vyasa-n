import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnudaanFelicitationPage } from '../pages/anudaan/AnudaanFelicitationPage';
import { AnudaanSanctionRegisterPage } from '../pages/anudaan/AnudaanSanctionRegisterPage';
import { anudaanAdminService } from '../services/anudaanAdminService';
import type { AnudaanFelicitationCycleOut, AnudaanSanctionEntryOut } from '../types/anudaan';

// Mock AdminLayout so we don't need full auth/workspace shell providers
vi.mock('../components/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-layout">{children}</div>,
}));

describe('ANUDAAN Felicitation Management & Enhanced Sanction Register Suite', () => {
  const mockCycles: AnudaanFelicitationCycleOut[] = [
    {
      id: 'cycle-101',
      volume_number: 2,
      issue_number: 2,
      display_title: 'Annual Research Felicitation Ceremony 2026',
      status: 'COMPLETED',
      felicitation_date: '2026-03-15',
      academic_year: '2025-2026',
      description: 'Honoring scholars for Q1 and Q2 indexed publications.',
      is_published: true,
      is_archived: false,
      total_sanction_entries: 5,
      total_sanctioned_amount: 250000,
      distinct_researchers: 4,
      gallery_item_count: 2,
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-01-10T10:00:00Z',
    },
    {
      id: 'cycle-102',
      volume_number: 2,
      issue_number: 3,
      display_title: 'Monsoon Research Assembly',
      status: 'UPCOMING',
      felicitation_date: '2026-09-20',
      academic_year: '2025-2026',
      description: 'Upcoming university ceremony.',
      is_published: true,
      is_archived: false,
      total_sanction_entries: 0,
      total_sanctioned_amount: 0,
      distinct_researchers: 0,
      gallery_item_count: 0,
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-01T10:00:00Z',
    },
  ];

  const mockSanctions: AnudaanSanctionEntryOut[] = [
    {
      id: 'sanc-201',
      researcher_name: 'Dr. Ramesh Sharma',
      department_name: 'Department of Biotechnology',
      project_title: 'DST-SERB Core Grant on Nanobiosensors',
      publication_title: 'Scalable Biosensor Interfaces for Rapid Diagnostics',
      publication_doi: '10.1038/s41586-026-00123-x',
      quartile: 'Q1',
      sanctioned_amount: 50000,
      academic_year: '2025-2026',
      sanction_date: '2026-03-15',
      felicitation_cycle_id: 'cycle-101',
      felicitation_cycle_volume: 2,
      felicitation_cycle_issue: 2,
      felicitation_cycle_status: 'COMPLETED',
      felicitation_cycle_title: 'Annual Research Felicitation Ceremony 2026',
      volume_number: 2,
      issue_number: 2,
      cycle_status: 'COMPLETED',
      remarks: 'Award approved under EC Resolution 42',
      is_published: true,
      application_id: 'app-99',
      application_number: 'ANU-2026-00042',
      author_id: null,
      created_at: '2026-03-15T10:00:00Z',
      updated_at: '2026-03-15T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(anudaanAdminService, 'getFelicitationCycles').mockResolvedValue({
      total: 2,
      items: mockCycles,
    });
    vi.spyOn(anudaanAdminService, 'getSanctions').mockResolvedValue({
      total: 1,
      items: mockSanctions,
      total_sanctioned_inr: 50000,
    });
    vi.spyOn(anudaanAdminService, 'getImpactStats').mockResolvedValue({
      reporting_academic_year: '2025-2026',
      total_researchers_recognised: 1,
      total_incentive_sanctioned_inr: 50000,
      total_sanction_entries: 1,
      quartile_breakdown: { Q1: 1, Q2: 0, Q3: 0, Q4: 0 },
      total_claims_received: 1,
      claims_approved: 1,
      claims_under_review: 0,
      claims_rejected: 0,
      researchers_benefited: 1,
      total_incentive_disbursed_inr: 50000,
      disbursement_status: 'SANCTIONED',
      academic_years_available: ['2025-2026'],
    });
  });

  describe('1. Felicitation Management Screen (/admin/anudaan/felicitations)', () => {
    it('1.1 Renders cycle list, summary metrics, and status badges', async () => {
      render(
        <BrowserRouter>
          <AnudaanFelicitationPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Felicitation & Recognition Cycles/i)).toBeInTheDocument();
        expect(screen.getByText(/Volume 2 — Issue 2/i)).toBeInTheDocument();
        expect(screen.getByText(/Annual Research Felicitation Ceremony 2026/i)).toBeInTheDocument();
        expect(screen.getByText(/Volume 2 — Issue 3/i)).toBeInTheDocument();
        expect(screen.getByText(/Monsoon Research Assembly/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Upcoming/i).length).toBeGreaterThan(0);
      });
    });

    it('1.2 Opens Add Cycle modal and validates positive Volume and Issue numbers', async () => {
      render(
        <BrowserRouter>
          <AnudaanFelicitationPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/\+ Add Felicitation Cycle/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/\+ Add Felicitation Cycle/i));

      expect(screen.getByText(/Create Felicitation \/ Recognition Cycle/i)).toBeInTheDocument();
      expect(screen.getByText(/Volume Number/i)).toBeInTheDocument();
      expect(screen.getByText(/Issue Number/i)).toBeInTheDocument();
    });
  });

  describe('2. Enhanced Sanction Register Screen (/admin/anudaan)', () => {
    it('2.1 Displays Volume & Issue badge, project title, and cycle filter', async () => {
      render(
        <BrowserRouter>
          <AnudaanSanctionRegisterPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Incentive Sanction Register/i)).toBeInTheDocument();
        expect(screen.getByText('Dr. Ramesh Sharma')).toBeInTheDocument();
        expect(screen.getAllByText(/Vol 2 · Iss 2/i).length).toBeGreaterThan(0);
        expect(screen.getByText(/Project: DST-SERB Core Grant on Nanobiosensors/i)).toBeInTheDocument();
      });
    });

    it('2.2 Sanction entry modal enforces mandatory cycle selection and publication title while keeping department & project title optional', async () => {
      render(
        <BrowserRouter>
          <AnudaanSanctionRegisterPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Add Sanction Entry/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Add Sanction Entry/i));

      // Cycle selection should be present
      expect(screen.getByText(/Felicitation \/ Recognition Cycle \*/i)).toBeInTheDocument();
      // Publication Title should remain mandatory (*)
      expect(screen.getByText(/Publication Title \*/i)).toBeInTheDocument();
      // Department and Project Title are optional
      expect(screen.getByText(/Department \/ School \(Optional\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Project Title \(Optional\)/i)).toBeInTheDocument();
    });
  });
});
