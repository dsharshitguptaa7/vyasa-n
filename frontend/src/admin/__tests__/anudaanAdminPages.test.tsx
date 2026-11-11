import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnudaanImpactPage } from '../pages/anudaan/AnudaanImpactPage';
import { AnudaanSanctionRegisterPage } from '../pages/anudaan/AnudaanSanctionRegisterPage';
import { AnudaanGalleryPage } from '../pages/anudaan/AnudaanGalleryPage';
import { AnudaanConfigPage } from '../pages/anudaan/AnudaanConfigPage';
import { anudaanAdminService } from '../services/anudaanAdminService';

// Mock AdminLayout so we don't need full auth/context providers
vi.mock('../components/AdminLayout', () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="admin-layout">{children}</div>,
}));

describe('ANUDAAN Phase 4.3.5 — Admin Management Screens Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockImpactStats = {
    reporting_academic_year: '2025-2026',
    total_claims_received: 35,
    claims_approved: 20,
    claims_under_review: 12,
    claims_rejected: 3,
    researchers_benefited: 18,
    total_incentive_disbursed_inr: 650000.0,
    disbursement_status: 'VERIFIED',
    academic_years_available: ['2025-2026'],
  };

  const mockDisbursements = [
    {
      id: 'disb-1',
      application_id: 'app-uuid-1',
      application_number: 'ANU-2025-ABCD',
      applicant_name: 'Dr. Test Author',
      author_id: 'author-uuid-1',
      disbursement_reference: 'NEFT-2025-110022',
      amount: 50000.0,
      disbursement_date: '2025-11-01',
      academic_year: '2025-2026',
      payment_method: 'NEFT',
      verification_status: 'RECORDED',
      reversal_reason: null,
      notes: 'Initial claim release',
      recorded_by_id: 'admin-1',
      verified_by_id: null,
      created_at: '2025-11-01T10:00:00Z',
      updated_at: '2025-11-01T10:00:00Z',
    },
  ];

  describe('AnudaanImpactPage', () => {
    it('1. Renders metrics dashboard and bank disbursement ledger', async () => {
      vi.spyOn(anudaanAdminService, 'getImpactStats').mockResolvedValue(mockImpactStats);
      vi.spyOn(anudaanAdminService, 'getDisbursements').mockResolvedValue({
        total: 1,
        total_amount_inr: 50000.0,
        items: mockDisbursements,
      });

      render(
        <BrowserRouter>
          <AnudaanImpactPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Bank Incentive Disbursement Ledger/i)).toBeInTheDocument();
        expect(screen.getByText('NEFT-2025-110022')).toBeInTheDocument();
        expect(screen.getByText(/₹ 50,000/i)).toBeInTheDocument();
        expect(screen.getByText('RECORDED')).toBeInTheDocument();
      });
    });

    it('2. Verifies a disbursement record', async () => {
      vi.spyOn(anudaanAdminService, 'getImpactStats').mockResolvedValue(mockImpactStats);
      vi.spyOn(anudaanAdminService, 'getDisbursements').mockResolvedValue({
        total: 1,
        total_amount_inr: 50000.0,
        items: mockDisbursements,
      });

      const verifySpy = vi.spyOn(anudaanAdminService, 'verifyDisbursement').mockResolvedValue({
        ...mockDisbursements[0],
        verification_status: 'VERIFIED',
      });

      render(
        <BrowserRouter>
          <AnudaanImpactPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('NEFT-2025-110022')).toBeInTheDocument();
      });

      const verifyBtn = screen.getByRole('button', { name: /Verify/i });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verify Bank Disbursement/i)).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole('button', { name: /Confirm Verification/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(verifySpy).toHaveBeenCalledWith('disb-1', '');
      });
    });
  });

  describe('AnudaanSanctionRegisterPage', () => {
    const mockSanctionList = {
      total: 1,
      total_sanctioned_inr: 50000.0,
      items: [
        {
          id: 'sanc-1',
          researcher_name: 'Dr. Ramesh Sharma',
          department_name: 'Physics',
          publication_title: 'Quantum 2D Materials',
          publication_doi: '10.1038/s41586-026-00123-x',
          quartile: 'Q1' as const,
          sanctioned_amount: 50000.0,
          academic_year: '2025-2026',
          sanction_date: '2026-02-10',
          remarks: 'Order VC/RES/2026/042',
          is_published: true,
          application_id: 'app-1',
          application_number: 'ANU-2026-N1E2W',
          author_id: null,
          created_at: '2026-02-10T10:00:00Z',
          updated_at: '2026-02-10T10:00:00Z',
        },
      ],
    };

    it('3. Renders Sanction Register with KPIs, table, and published records', async () => {
      vi.spyOn(anudaanAdminService, 'getImpactStats').mockResolvedValue(mockImpactStats);
      vi.spyOn(anudaanAdminService, 'getSanctions').mockResolvedValue(mockSanctionList);

      render(
        <BrowserRouter>
          <AnudaanSanctionRegisterPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Incentive Sanction Register')).toBeInTheDocument();
        expect(screen.getByText('Dr. Ramesh Sharma')).toBeInTheDocument();
        expect(screen.getByText('Quantum 2D Materials')).toBeInTheDocument();
        expect(screen.getByText('Published')).toBeInTheDocument();
      });
    });

    it('4. Opens Add Sanction Entry modal and pre-fills form', async () => {
      vi.spyOn(anudaanAdminService, 'getImpactStats').mockResolvedValue(mockImpactStats);
      vi.spyOn(anudaanAdminService, 'getSanctions').mockResolvedValue(mockSanctionList);

      render(
        <BrowserRouter>
          <AnudaanSanctionRegisterPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Dr. Ramesh Sharma')).toBeInTheDocument();
      });

      const addBtn = screen.getByRole('button', { name: /Add Sanction Entry/i });
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(screen.getByText('Record University Incentive Sanction')).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/e\.g\. Dr\. Ramesh Sharma/i)).toBeInTheDocument();
      });
    });

    it('5. Toggles publication status of a sanction entry', async () => {
      vi.spyOn(anudaanAdminService, 'getImpactStats').mockResolvedValue(mockImpactStats);
      vi.spyOn(anudaanAdminService, 'getSanctions').mockResolvedValue(mockSanctionList);
      const toggleSpy = vi.spyOn(anudaanAdminService, 'toggleSanctionPublish').mockResolvedValue({
        ...mockSanctionList.items[0],
        is_published: false,
      });

      render(
        <BrowserRouter>
          <AnudaanSanctionRegisterPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Unpublish')).toBeInTheDocument();
      });

      const unpubBtn = screen.getByRole('button', { name: /Unpublish/i });
      fireEvent.click(unpubBtn);

      await waitFor(() => {
        expect(toggleSpy).toHaveBeenCalledWith('sanc-1', false);
      });
    });
  });

  describe('AnudaanGalleryPage', () => {
    const mockGalleryList = {
      total: 1,
      items: [
        {
          id: 'gal-1',
          title: 'CSJMU Research Awards',
          event_name: 'Felicitation Day 2025',
          event_date: '2025-10-10',
          academic_year: '2025-2026',
          description: 'Top research recognition ceremony.',
          researcher_name: 'Dr. Anand Kumar',
          researcher_designation: 'Professor',
          department_name: 'Physics',
          has_consent: true,
          is_featured: true,
          is_published: true,
          display_order: 1,
          images: [],
          created_at: '2025-10-10T10:00:00Z',
          updated_at: '2025-10-10T10:00:00Z',
        },
      ],
    };

    it('3. Renders gallery list and metadata', async () => {
      vi.spyOn(anudaanAdminService, 'getGalleryItems').mockResolvedValue(mockGalleryList);

      render(
        <BrowserRouter>
          <AnudaanGalleryPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('CSJMU Research Awards')).toBeInTheDocument();
        expect(screen.getByText(/Felicitation Day 2025/i)).toBeInTheDocument();
        expect(screen.getByText(/Dr. Anand Kumar/i)).toBeInTheDocument();
        expect(screen.getByText(/Consent Verified/i)).toBeInTheDocument();
      });
    });
  });

  describe('AnudaanConfigPage', () => {
    it('4. Loads public configuration and saves updates', async () => {
      vi.spyOn(anudaanAdminService, 'getConfig').mockResolvedValue({
        id: 'cfg-1',
        config_key: 'global_showcase',
        impact_section_enabled: true,
        gallery_section_enabled: true,
        active_academic_year: '2025-2026',
        custom_banner_note: 'Official CSJMU incentive program.',
        updated_at: '2026-11-11T10:00:00Z',
      });

      const updateSpy = vi.spyOn(anudaanAdminService, 'updateConfig').mockResolvedValue({
        id: 'cfg-1',
        config_key: 'global_showcase',
        impact_section_enabled: false,
        gallery_section_enabled: true,
        active_academic_year: '2025-2026',
        custom_banner_note: 'Official CSJMU incentive program.',
        updated_at: '2026-11-11T10:05:00Z',
      });

      render(
        <BrowserRouter>
          <AnudaanConfigPage />
        </BrowserRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/ANUDAAN Public Showcase Configuration/i)).toBeInTheDocument();
        expect(screen.getByDisplayValue('Official CSJMU incentive program.')).toBeInTheDocument();
      });

      // Toggle impact checkbox off
      const impactCheckbox = screen.getByLabelText(/Section B: Institutional Incentive Impact Dashboard/i);
      fireEvent.click(impactCheckbox);

      // Save changes
      const saveBtn = screen.getByRole('button', { name: /Save Configuration/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            impact_section_enabled: false,
          })
        );
      });
    });
  });
});
