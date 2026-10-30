import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SamaVedaDashboardPage } from '../pages/SamaVedaDashboardPage';
import { samaVedaService } from '../services/samaVedaService';

describe('SamaVedaPublicPortal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders portal header, overview cards, and navigation tabs', async () => {
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

    expect(screen.getByText('University Research Felicitation & Recognition')).toBeInTheDocument();
    expect(screen.getByText('Sama Veda • Research Recognition & Communication')).toBeInTheDocument();
    expect(screen.getByText(/SAMIKSHA • Research, Recognition & Innovation Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/Discover\. Research\. Inspire\./i)).toBeInTheDocument();

    // Verify CTAs
    expect(screen.getByRole('button', { name: /Explore Research/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore Felicitations/i })).toBeInTheDocument();

    // Verify all 7 navigation tabs
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publications Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Research Bulletins' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Researcher Directory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Certificate Verification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CAM-AI Projects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fellowship Schemes' })).toBeInTheDocument();
  });

  it('handles certificate verification for authentic certificate', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    const verifySpy = vi.spyOn(samaVedaService, 'verifyCertificate').mockResolvedValue({
      certificate_number: 'CERT-2026-001',
      issued_at: '2026-04-20T10:00:00Z',
      is_revoked: false,
      author: {
        id: 'auth-1',
        full_name: 'Dr. Shilpa Deshpande',
        department: 'Biotechnology',
        is_verified: true,
      },
      publication: {
        id: 'pub-1',
        title: 'Gen AI Speech Recovery',
        category: 'Article',
        source_journal: 'Journal of AI',
      },
      sha256_checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      is_download_allowed: true,
    });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    // Switch to Certificate Verification tab
    const certTabBtn = screen.getByRole('button', { name: 'Certificate Verification' });
    fireEvent.click(certTabBtn);

    expect(screen.getByText('Verify Felicitation Certificate')).toBeInTheDocument();

    const input = screen.getByPlaceholderText(/Enter Certificate Number/i);
    fireEvent.change(input, { target: { value: 'CERT-2026-001' } });

    const submitBtn = screen.getByText('Verify Authenticity');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith('CERT-2026-001');
      expect(screen.getByText('VALID & AUTHENTIC')).toBeInTheDocument();
      expect(screen.getByText(/Dr\. Shilpa Deshpande/)).toBeInTheDocument();
      expect(screen.getByText('Download Certificate Copy ↓')).toBeInTheDocument();
    });
  });

  it('handles certificate verification for revoked certificate and blocks download', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    vi.spyOn(samaVedaService, 'verifyCertificate').mockResolvedValue({
      certificate_number: 'CERT-REVOKED-099',
      issued_at: '2026-01-10T10:00:00Z',
      is_revoked: true,
      revoked_at: '2026-03-01T10:00:00Z',
      revocation_reason: 'Paper withdrawn by publisher',
      sha256_checksum: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
      is_download_allowed: false,
    });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    const certTabBtn = screen.getByRole('button', { name: 'Certificate Verification' });
    fireEvent.click(certTabBtn);

    const input = screen.getByPlaceholderText(/Enter Certificate Number/i);
    fireEvent.change(input, { target: { value: 'CERT-REVOKED-099' } });
    fireEvent.click(screen.getByText('Verify Authenticity'));

    await waitFor(() => {
      expect(screen.getByText('REVOKED')).toBeInTheDocument();
      expect(screen.getByText(/Paper withdrawn by publisher/)).toBeInTheDocument();
    });

    // Ensure download button is NOT rendered for revoked certificate
    expect(screen.queryByText('Download Certificate Copy ↓')).not.toBeInTheDocument();
  });

  it('displays empty state when publication catalog has no approved records', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 30 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    const pubTabBtn = screen.getByRole('button', { name: 'Publications Archive' });
    fireEvent.click(pubTabBtn);

    await waitFor(() => {
      expect(screen.getByText('No Published Research Records Visible')).toBeInTheDocument();
    });
  });

  it('degrades gracefully when one endpoint fails, showing available data and notice', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockRejectedValue(new Error('500 Internal Server Error'));
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({
      items: [
        {
          id: 'cam-1',
          title: 'Robotic Surgery AI',
          domain: 'Health',
          category: 'Major',
          status: 'Ongoing',
          principal_investigators: [],
          co_investigators: [],
        },
      ],
      total: 1,
    });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({
      items: [
        {
          id: 'fel-1',
          scheme_code: 'JRF',
          scheme_name: 'Junior Research Fellowship',
          active_scholars_count: 24,
        },
      ],
      total: 1,
    });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    // Verify graceful notice for Bulletins failure
    await waitFor(() => {
      expect(screen.getByText(/Notice: Data for Bulletins could not be loaded/i)).toBeInTheDocument();
    });

    // Verify CAM-AI tab is still interactive and functional
    const camTabBtn = screen.getByRole('button', { name: 'CAM-AI Projects' });
    fireEvent.click(camTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Robotic Surgery AI')).toBeInTheDocument();
    });
  });

  it('remains interactive and non-blocking when all overview endpoints fail', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockRejectedValue(new Error('Network error'));
    vi.spyOn(samaVedaService, 'getCamProjects').mockRejectedValue(new Error('Network error'));
    vi.spyOn(samaVedaService, 'getFellowships').mockRejectedValue(new Error('Network error'));
    vi.spyOn(samaVedaService, 'getSpotlights').mockRejectedValue(new Error('Network error'));
    vi.spyOn(samaVedaService, 'getPublications').mockRejectedValue(new Error('Network error'));
    vi.spyOn(samaVedaService, 'getAuthors').mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Public research records are currently initializing/i)).toBeInTheDocument();
    });

    // Ensure tabs still render and can be clicked
    expect(screen.getByRole('button', { name: 'Certificate Verification' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publications Archive' })).toBeInTheDocument();
  });

  it('renders interactive analytics dashboard with real publication and category data', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({
      items: [
        {
          id: 'b-1',
          volume_number: 1,
          issue_number: 1,
          title: 'CSJMU Research Bulletin Vol 1 Issue 1',
          publication_period: 'Jan - Jun 2025',
          publication_count: 52,
          file_size_bytes: 4500000,
          checksum_sha256: 'abc123sha256',
        },
      ],
      total: 1,
    });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({
      items: [
        {
          id: 'auth-1',
          full_name: 'Dr. Ramesh Sharma',
          department: 'Computer Science',
          is_verified: true,
          scopus_id: '57211111111',
        },
      ],
      total: 1,
      skip: 0,
      limit: 100,
    });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({
      items: [
        {
          id: 'pub-1',
          bulletin_id: 'b-1',
          serial_no: 1,
          slug: 'novel-deep-learning',
          title: 'Novel Deep Learning for Medical Diagnostics',
          source_journal: 'IEEE Transactions on Neural Networks',
          category: 'Article',
          author_display: 'Dr. Ramesh Sharma',
          authors_complete: true,
          published_at: '2025-03-15T10:00:00Z',
          created_at: '2025-03-15T10:00:00Z',
          is_featured: true,
          doi: '10.1109/TNNLS.2025.1234567',
          author_links: [],
        },
      ],
      total: 1,
      skip: 0,
      limit: 100,
    });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    // Verify analytics section title
    await waitFor(() => {
      expect(screen.getByText('Scholarly Output & Recognition Metrics')).toBeInTheDocument();
      expect(screen.getByText('1. Publication Growth Trends')).toBeInTheDocument();
      expect(screen.getByText('2. Output by Research Category')).toBeInTheDocument();
      expect(screen.getByText('3. Recognition & Verification')).toBeInTheDocument();
      expect(screen.getByText('4. Research Bulletin Volumes')).toBeInTheDocument();
    });

    // Verify Category Bar for "Article" exists and is clickable
    const articleBar = screen.getByText('Article');
    expect(articleBar).toBeInTheDocument();
    fireEvent.click(articleBar);

    // After clicking the category, it should navigate to Publications tab
    await waitFor(() => {
      expect(screen.getByText('Novel Deep Learning for Medical Diagnostics')).toBeInTheDocument();
    });
  });

  it('renders official Research Recognition & Felicitations experience with gallery', async () => {
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({
      items: [
        {
          id: 'pub-honored',
          bulletin_id: 'b-1',
          serial_no: 10,
          slug: 'quantum-cryptography',
          title: 'Quantum Cryptography in University Networks',
          source_journal: 'Physical Review Letters',
          category: 'Article',
          author_display: 'Prof. Anjali Verma',
          authors_complete: true,
          published_at: '2025-05-10T10:00:00Z',
          created_at: '2025-05-10T10:00:00Z',
          is_featured: true,
          author_links: [{ author_id: 'auth-2', author_name: 'Prof. Anjali Verma', author_order: 1, is_corresponding: true, department: 'Physics' }],
        },
      ],
      total: 1,
      skip: 0,
      limit: 100,
    });

    render(
      <MemoryRouter>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    // Click Certificate Verification tab
    fireEvent.click(screen.getByRole('button', { name: 'Certificate Verification' }));

    // Check institutional recognition heading
    expect(screen.getByText('Research Recognition & Felicitations')).toBeInTheDocument();
    expect(screen.getByText(/Recognising scholarly contributions, research achievements/i)).toBeInTheDocument();

    // Check gallery contains honored publication
    await waitFor(() => {
      expect(screen.getByText('Quantum Cryptography in University Networks')).toBeInTheDocument();
      expect(screen.getByText('Prof. Anjali Verma')).toBeInTheDocument();
    });

    // Click "View Details" to open recognition detail dialog
    fireEvent.click(screen.getByText('View Details →'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Institutional Felicitation Record #10/i)).toBeInTheDocument();
      expect(screen.getByText(/Hold a printed certificate for this research/i)).toBeInTheDocument();
    });
  });
});
