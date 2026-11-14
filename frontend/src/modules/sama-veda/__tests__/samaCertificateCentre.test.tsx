import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SamaVedaDashboardPage } from '../pages/SamaVedaDashboardPage';
import { samaVedaService } from '../services/samaVedaService';

describe('SAMIKSHA Certificate Centre - Researcher Discovery & Download', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Certificate Centre with Scopus ID discovery input and verification methods', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    // Navigate to Certificate Verification tab
    fireEvent.click(screen.getByRole('button', { name: 'Certificate Verification' }));

    await waitFor(() => {
      // Check Certificate Centre heading and Scopus input
      expect(screen.getByText('Certificate Download & Verification Centre')).toBeInTheDocument();
      expect(screen.getByText('Download Your Research Certificates')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your registered Scopus ID/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Find My Certificates' })).toBeInTheDocument();

      // Check Public Verification section
      expect(screen.getByText('Verify Felicitation Certificate')).toBeInTheDocument();
      expect(screen.getByText('Method A: Certificate Number')).toBeInTheDocument();
      expect(screen.getByText('Method B: Instant QR Code Scan')).toBeInTheDocument();
    });
  }, 15000);

  it('handles Scopus ID discovery with auth challenge and OTP dispatch', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    const discoverSpy = vi.spyOn(samaVedaService, 'discoverResearcherCertificates').mockResolvedValue({
      challenge: {
        status: 'AUTH_REQUIRED',
        requires_authentication: true,
        researcher: {
          id: 'auth-123',
          full_name: 'Dr. Ramesh Chandra Verma',
          department: 'Computer Science',
          institutional_affiliation: 'CSJMU, Kanpur',
          scopus_id: '57218492000',
          has_registered_user: true,
          masked_email: 'r***a@csjmu.ac.in',
        },
        message: 'Identity verification required.',
      },
    });

    const sendOtpSpy = vi.spyOn(samaVedaService, 'sendResearcherOtp').mockResolvedValue({
      success: true,
      masked_email: 'r***a@csjmu.ac.in',
      message: 'Code sent.',
    });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Certificate Verification' }));

    const scopusInput = screen.getByPlaceholderText(/Enter your registered Scopus ID/i);
    fireEvent.change(scopusInput, { target: { value: '57218492000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find My Certificates' }));

    await waitFor(() => {
      expect(discoverSpy).toHaveBeenCalledWith('57218492000', undefined);
      expect(screen.getByText('Researcher Identity Verification Required')).toBeInTheDocument();
      expect(screen.getByText(/Dr\. Ramesh Chandra Verma/i)).toBeInTheDocument();
      expect(screen.getByText(/Send Code to r\*\*\*a@csjmu\.ac\.in/i)).toBeInTheDocument();
    });

    // Click Send Code
    fireEvent.click(screen.getByText(/Send Code to r\*\*\*a@csjmu\.ac\.in/i));

    await waitFor(() => {
      expect(sendOtpSpy).toHaveBeenCalledWith('57218492000');
      expect(screen.getByPlaceholderText(/Enter 6-digit verification code/i)).toBeInTheDocument();
    });
  });

  it('renders discovered certificates separated into Research Work and Incentive categories with download action', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    vi.spyOn(samaVedaService, 'discoverResearcherCertificates').mockResolvedValue({
      data: {
        researcher: {
          id: 'res-1',
          full_name: 'Dr. Shilpa Deshpande',
          department: 'Biotechnology',
          institutional_affiliation: 'CSJMU, Kanpur',
          scopus_id: '57200000003',
        },
        research_certificates: [
          {
            id: 'cert-1',
            certificate_number: 'CSJMU/SAMA/2026/00101',
            title: 'Certificate of Research Excellence',
            certificate_type: 'RESEARCH_PUBLICATION',
            category: 'RESEARCH_WORK',
            publication_title: 'CRISPR Gene Editing in Drought-Resistant Crops',
            issue_date: '01 March 2026',
            issued_at: '2026-03-01T00:00:00Z',
            status: 'ISSUED',
            is_revoked: false,
            verification_token: 'tok-101',
            verification_url: '/verify/tok-101',
            is_download_allowed: true,
            download_url: '/api/modules/sama-veda/certificates/verify/tok-101/download',
          },
        ],
        incentive_certificates: [],
        anudaan_incentives: {
          total_applications: 1,
          approved_count: 1,
          pdf_certificates_available: false,
          message: 'Official PDF incentive certificates have not yet been generated in SAMIKSHA for approved incentive records.',
        },
      },
    });

    const downloadSpy = vi.spyOn(samaVedaService, 'downloadCertificate').mockResolvedValue();

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Certificate Verification' }));

    const scopusInput = screen.getByPlaceholderText(/Enter your registered Scopus ID/i);
    fireEvent.change(scopusInput, { target: { value: '57200000003' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find My Certificates' }));

    await waitFor(() => {
      expect(screen.getByText('Dr. Shilpa Deshpande')).toBeInTheDocument();
      expect(screen.getByText('Research Work Certificates')).toBeInTheDocument();
      expect(screen.getByText('CSJMU/SAMA/2026/00101')).toBeInTheDocument();
      expect(screen.getByText(/CRISPR Gene Editing/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Download PDF ↓' })).toBeInTheDocument();
    });

    // Test download click
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF ↓' }));
    expect(downloadSpy).toHaveBeenCalledWith('tok-101', 'CSJMU_SAMA_2026_00101.pdf');

    // Switch to Incentive Certificates category
    fireEvent.click(screen.getByText('Incentive Certificates'));

    await waitFor(() => {
      expect(screen.getByText('Research Publication Incentive Records Status')).toBeInTheDocument();
      expect(screen.getByText(/Official PDF incentive certificates have not yet been generated/i)).toBeInTheDocument();
      expect(screen.getByText(/Total Incentive Applications:/i)).toBeInTheDocument();
    });
  });
});
