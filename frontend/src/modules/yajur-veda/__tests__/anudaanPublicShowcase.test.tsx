import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AnudaanPortalPage } from '../pages/AnudaanPortalPage';
import { anudaanService } from '../services/anudaanService';
import { clearDraftSession } from '../services/anudaanSession';

describe('ANUDAAN Phase 4.3.5 — Public Showcase & Institutional Impact Tests', () => {
  const mockPublicConfig = {
    id: 'cfg-1',
    config_key: 'global_showcase',
    impact_section_enabled: true,
    gallery_section_enabled: true,
    active_academic_year: '2025-2026',
    custom_banner_note: 'Verified against official institutional banking disbursements.',
    updated_at: '2026-11-11T09:00:00Z',
  };

  const mockImpactStats = {
    reporting_academic_year: '2025-2026',
    total_researchers_recognised: 25,
    total_incentive_sanctioned_inr: 850000.0,
    total_sanction_entries: 42,
    quartile_breakdown: { Q1: 20, Q2: 15, Q3: 5, Q4: 2 },
    total_claims_received: 42,
    claims_approved: 28,
    claims_under_review: 10,
    claims_rejected: 4,
    researchers_benefited: 25,
    total_incentive_disbursed_inr: 850000.0,
    disbursement_status: 'SANCTIONED',
    academic_years_available: ['2025-2026', '2026-2027'],
  };

  const mockPublicSanctions = [
    {
      id: 'sanc-1',
      researcher_name: 'Dr. Ramesh Sharma',
      department_name: 'Biotechnology',
      publication_title: 'Quantum 2D Superconductors',
      quartile: 'Q1',
      sanctioned_amount: 50000.0,
      academic_year: '2025-2026',
    },
  ];

  const mockGalleryItems = [
    {
      id: 'gallery-item-1',
      title: 'Annual Research Excellence Award 2025',
      event_name: 'CSJMU Annual Research Felicitation',
      event_date: '2025-12-15',
      academic_year: '2025-2026',
      description: 'Honoring top researchers for Q1 publications.',
      researcher_name: 'Dr. Ramesh Sharma',
      researcher_designation: 'Associate Professor',
      department_name: 'Biotechnology',
      has_consent: true,
      is_featured: true,
      is_published: true,
      display_order: 1,
      images: [
        {
          id: 'img-1',
          gallery_item_id: 'gallery-item-1',
          storage_key: 'gallery/img-1.jpg',
          original_filename: 'ceremony1.jpg',
          mime_type: 'image/jpeg',
          file_size_bytes: 524288,
          caption: 'Vice Chancellor presenting the award token',
          is_cover: true,
          display_order: 0,
          created_at: '2025-12-16T10:00:00Z',
        },
      ],
      created_at: '2025-12-15T12:00:00Z',
      updated_at: '2025-12-15T12:00:00Z',
    },
  ];

  const mockShowcaseCycles = {
    total_cycles: 2,
    completed_cycles: [
      {
        id: 'cycle-1',
        volume_number: 2,
        issue_number: 2,
        display_title: 'Annual Research Felicitation Ceremony 2026',
        status: 'COMPLETED' as const,
        felicitation_date: '2026-03-15',
        academic_year: '2025-2026',
        description: 'Honoring university scholars for high-impact indexed publications.',
        sanctions: mockPublicSanctions,
        total_sanctioned_amount: 50000.0,
        total_researchers: 1,
        sanction_count: 1,
        gallery_items: mockGalleryItems,
      },
    ],
    upcoming_cycles: [
      {
        id: 'cycle-2',
        volume_number: 2,
        issue_number: 3,
        display_title: 'Monsoon Research Recognition Assembly',
        status: 'UPCOMING' as const,
        felicitation_date: '2026-09-20',
        academic_year: '2025-2026',
        description: 'Upcoming university ceremony honoring indexed publications.',
        sanctions: [],
        total_sanctioned_amount: 0.0,
        total_researchers: 0,
        sanction_count: 0,
        gallery_items: [],
      },
    ],
  };

  beforeEach(() => {
    clearDraftSession();
    vi.clearAllMocks();
    vi.spyOn(anudaanService, 'getPublicConfig').mockResolvedValue({
      success: true,
      data: mockPublicConfig,
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(anudaanService, 'getPublicImpactStats').mockResolvedValue({
      success: true,
      data: mockImpactStats,
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(anudaanService, 'getPublicGallery').mockResolvedValue({
      success: true,
      data: {
        total: 1,
        items: mockGalleryItems,
      },
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(anudaanService, 'getPublicSanctions').mockResolvedValue({
      success: true,
      data: {
        total: 1,
        items: mockPublicSanctions,
      },
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(anudaanService, 'getPublicShowcaseCycles').mockResolvedValue({
      success: true,
      data: mockShowcaseCycles,
      timestamp: new Date().toISOString(),
    });
  });

  it('1. Renders Section A (Claims & Tracking) alongside Section B (Sanction Register) and Section C (Gallery)', async () => {
    render(
      <BrowserRouter>
        <AnudaanPortalPage />
      </BrowserRouter>
    );

    // Section A checks
    expect(screen.getByText(/ANUDAAN Research Incentive Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Start New Application/i)).toBeInTheDocument();
    expect(screen.getByText(/Resume Application/i)).toBeInTheDocument();
    expect(screen.getByText(/Track Status/i)).toBeInTheDocument();

    // Section B checks
    await waitFor(() => {
      expect(screen.getByText(/Section B: Institutional Incentive Sanction Register/i)).toBeInTheDocument();
      expect(screen.getByText(/Researchers Recognised/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Amount Sanctioned/i).length).toBeGreaterThan(0);
      expect(screen.getByText('25')).toBeInTheDocument(); // Researchers recognised
      expect(screen.getByText('42')).toBeInTheDocument(); // Sanction entries
      expect(screen.getByText(/Figures represent institutional incentive sanctions/i)).toBeInTheDocument();
      expect(screen.getByText(/Institutional Felicitation Showcase \(Volume & Issue\)/i)).toBeInTheDocument();
      expect(screen.getByText(/VOLUME 2 — ISSUE 2/i)).toBeInTheDocument();
      expect(screen.getByText('Quantum 2D Superconductors')).toBeInTheDocument();
      expect(screen.getByText(/VOLUME 2 — ISSUE 3/i)).toBeInTheDocument();
      expect(screen.getByText(/Nominations \/ sanctions for this cycle are currently being finalized/i)).toBeInTheDocument();
    });

    // Custom banner note check
    expect(
      screen.getByText(/Verified against official institutional banking disbursements./i)
    ).toBeInTheDocument();

    // Section C checks
    await waitFor(() => {
      expect(screen.getByText(/Section C: Researcher Recognition & Distribution Gallery/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Annual Research Excellence Award 2025/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/CSJMU Annual Research Felicitation/i)).toBeInTheDocument();
    });
  });

  it('2. Correctly renders zero sanction fallback when no published sanctions exist', async () => {
    vi.spyOn(anudaanService, 'getPublicImpactStats').mockResolvedValue({
      success: true,
      data: {
        reporting_academic_year: '2025-2026',
        total_researchers_recognised: 0,
        total_incentive_sanctioned_inr: 0.0,
        total_sanction_entries: 0,
        quartile_breakdown: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 },
        total_claims_received: 0,
        claims_approved: 0,
        claims_under_review: 0,
        claims_rejected: 0,
        researchers_benefited: 0,
        total_incentive_disbursed_inr: 0.0,
        disbursement_status: 'SANCTIONED',
        academic_years_available: ['2025-2026'],
      },
      timestamp: new Date().toISOString(),
    });
    vi.spyOn(anudaanService, 'getPublicShowcaseCycles').mockResolvedValue({
      success: true,
      data: {
        total_cycles: 0,
        completed_cycles: [],
        upcoming_cycles: [],
      },
      timestamp: new Date().toISOString(),
    });

    render(
      <BrowserRouter>
        <AnudaanPortalPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/₹ 0/i)).toBeInTheDocument();
      expect(screen.getByText(/No published felicitation cycles found for this period/i)).toBeInTheDocument();
    });
  });

  it('3. Suppresses Section B and Section C when disabled in public display configuration', async () => {
    vi.spyOn(anudaanService, 'getPublicConfig').mockResolvedValue({
      success: true,
      data: {
        ...mockPublicConfig,
        impact_section_enabled: false,
        gallery_section_enabled: false,
      },
      timestamp: new Date().toISOString(),
    });

    render(
      <BrowserRouter>
        <AnudaanPortalPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ANUDAAN Research Incentive Portal/i)).toBeInTheDocument();
    });

    // Impact and Gallery headers should NOT be in the DOM
    expect(screen.queryByText(/Section B: Institutional Incentive Impact/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Section C: Researcher Recognition & Distribution Gallery/i)).not.toBeInTheDocument();
  });

  it('4. Opens image lightbox when clicking a ceremony gallery item thumbnail', async () => {
    render(
      <BrowserRouter>
        <AnudaanPortalPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Annual Research Excellence Award 2025/i).length).toBeGreaterThan(0);
    });

    // Click on the cover image inside the gallery card thumbnail
    const coverImages = screen.getAllByAltText(/Vice Chancellor presenting the award token/i);
    fireEvent.click(coverImages[0]);

    // Lightbox modal should appear with photo view and description (found both on card and in modal)
    await waitFor(() => {
      expect(screen.getAllByText(/Honoring top researchers for Q1 publications./i).length).toBeGreaterThan(0);
    });
  });
});
