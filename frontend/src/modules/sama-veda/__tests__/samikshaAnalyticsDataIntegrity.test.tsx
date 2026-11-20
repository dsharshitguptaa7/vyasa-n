import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SamikshaAnalytics } from '../components/SamikshaAnalytics';
import { SamikshaResearchersTab } from '../components/SamikshaResearchersTab';
import { OverviewAnalyticsData } from '../services/samaVedaService';

const mockAnalyticsData: OverviewAnalyticsData = {
  summary: {
    total_publications: 15,
    total_researchers: 279,
    verified_faculty: 60,
    provisional_scholars: 219,
    total_bulletins: 3,
    cam_grants: 4,
    active_fellows: 12,
  },
  category_distribution: [
    { name: 'Article', count: 10, percentage: 66.7 },
    { name: 'Review', count: 3, percentage: 20.0 },
    { name: 'Book Chapter', count: 2, percentage: 13.3 },
  ],
  yearly_trends: [
    { year: '2024', count: 4 },
    { year: '2025', count: 5 },
    { year: '2026', count: 6 },
  ],
  researcher_breakdown: {
    total_researchers: 279,
    verified_faculty: 60,
    provisional_scholars: 219,
  },
  bulletin_volumes: [
    {
      id: 'bull-1',
      volume_number: 2,
      issue_number: 1,
      label: 'Vol 2 Iss 1',
      title: 'Volume 2 • Issue 1',
      period: 'January – March 2026',
      actual_publication_count: 5,
      archival_count: 91,
      file_size_bytes: 5244378,
    },
    {
      id: 'bull-2',
      volume_number: 2,
      issue_number: 2,
      label: 'Vol 2 Iss 2',
      title: 'Volume 2 • Issue 2',
      period: 'April – June 2026',
      actual_publication_count: 10,
      archival_count: 197,
      file_size_bytes: 6913000,
    },
  ],
  indexing_metrics: {
    doi_indexed: 9,
    direct_peer_reviewed: 6,
  },
  reconciliation: {
    total_publications: 15,
    category_sum: 15,
    yearly_sum: 15,
    bulletin_actual_sum: 15,
    categories_reconciled: true,
    bulletins_reconciled: true,
  },
  generated_at: '2026-11-20T10:00:00Z',
};

describe('Research Intelligence Overview Data Integrity Suite', () => {
  it('1. Output by Research Category reconciles with total publications and displays correct counts', () => {
    const handleSelectCategory = vi.fn();

    render(
      <SamikshaAnalytics
        analyticsData={mockAnalyticsData}
        publications={[]}
        totalPublications={15}
        bulletins={[]}
        authors={[]}
        totalAuthors={279}
        camProjects={[]}
        onSelectCategory={handleSelectCategory}
      />
    );

    // Verify Category names and reconciled counts
    expect(screen.getByText('Article')).toBeInTheDocument();
    expect(screen.getByText('10 (67%)')).toBeInTheDocument();

    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('3 (20%)')).toBeInTheDocument();

    expect(screen.getByText('Book Chapter')).toBeInTheDocument();
    expect(screen.getByText('2 (13%)')).toBeInTheDocument();

    // Verify click triggers category selection callback
    fireEvent.click(screen.getByText('Article'));
    expect(handleSelectCategory).toHaveBeenCalledWith('Article');
  });

  it('2. Verified Faculty count is authoritative (60) and does not conflate people with papers into "Records"', () => {
    const handleSelectAuthors = vi.fn();

    render(
      <SamikshaAnalytics
        analyticsData={mockAnalyticsData}
        publications={[]}
        totalPublications={15}
        bulletins={[]}
        authors={[]}
        totalAuthors={279}
        camProjects={[]}
        onSelectAuthorsTab={handleSelectAuthors}
      />
    );

    // The center label of the Donut must say "Researchers", NEVER "Records"
    expect(screen.getByText('279')).toBeInTheDocument();
    expect(screen.getByText('Researchers')).toBeInTheDocument();
    expect(screen.queryByText('Records')).not.toBeInTheDocument();

    // Verified Faculty and Provisional Scholars are present with exact authoritative counts
    expect(screen.getByText('Verified Faculty')).toBeInTheDocument();
    expect(screen.getByText('60 (22%)')).toBeInTheDocument();

    expect(screen.getByText('Provisional Scholars')).toBeInTheDocument();
    expect(screen.getByText('219 (78%)')).toBeInTheDocument();

    // Scholarly indexing & grants are distinct entity indicators
    expect(screen.getByText('Scopus / DOI Indexed').parentElement).toHaveTextContent(/9\s*works/);
    expect(screen.getByText('Peer-Reviewed Direct').parentElement).toHaveTextContent(/6\s*works/);
    expect(screen.getByText('CAM-AI Grants').parentElement).toHaveTextContent(/4\s*awards/);
  });

  it('3. Reconciles Verified Faculty metrics between Overview and Researcher Directory', () => {
    render(
      <SamikshaResearchersTab
        authors={[]}
        totalAuthors={279}
        authoritativeVerifiedCount={60}
        authoritativeTotalCount={279}
        authorSearch=""
        onAuthorSearchChange={vi.fn()}
      />
    );

    // Directory header displays identical authoritative counters
    expect(screen.getAllByText('279').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Researchers')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('Verified Faculty')).toBeInTheDocument();
  });

  it('4. Research Bulletin Volumes displays live cataloged publications (5 & 10) and distinguishes print index', () => {
    const handleSelectBulletin = vi.fn();

    render(
      <SamikshaAnalytics
        analyticsData={mockAnalyticsData}
        publications={[]}
        totalPublications={15}
        bulletins={[]}
        authors={[]}
        totalAuthors={279}
        camProjects={[]}
        onSelectBulletin={handleSelectBulletin}
      />
    );

    expect(screen.getByText(/Vol 2 Iss 1/)).toBeInTheDocument();
    expect(screen.getByText(/5 works/)).toBeInTheDocument();
    expect(screen.getByText(/\(91 print index\)/)).toBeInTheDocument();

    expect(screen.getByText(/Vol 2 Iss 2/)).toBeInTheDocument();
    expect(screen.getByText(/10 works/)).toBeInTheDocument();
    expect(screen.getByText(/\(197 print index\)/)).toBeInTheDocument();

    // Clicking bulletin triggers callback
    fireEvent.click(screen.getByText(/Vol 2 Iss 1/));
    expect(handleSelectBulletin).toHaveBeenCalledWith('bull-1');
  });

  it('5. Publication Growth Trends displays all historical years from authoritative data', () => {
    const handleSelectYear = vi.fn();

    render(
      <SamikshaAnalytics
        analyticsData={mockAnalyticsData}
        publications={[]}
        totalPublications={15}
        bulletins={[]}
        authors={[]}
        totalAuthors={279}
        camProjects={[]}
        onSelectYear={handleSelectYear}
      />
    );

    expect(screen.getByText('2024')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();

    fireEvent.click(screen.getByText('2025'));
    expect(handleSelectYear).toHaveBeenCalledWith('2025');
  });

  it('6. Handles empty dataset gracefully without NaN, dividing by zero, or crashing', () => {
    const emptyAnalyticsData: OverviewAnalyticsData = {
      summary: {
        total_publications: 0,
        total_researchers: 0,
        verified_faculty: 0,
        provisional_scholars: 0,
        total_bulletins: 0,
        cam_grants: 0,
        active_fellows: 0,
      },
      category_distribution: [],
      yearly_trends: [],
      researcher_breakdown: {
        total_researchers: 0,
        verified_faculty: 0,
        provisional_scholars: 0,
      },
      bulletin_volumes: [],
      indexing_metrics: {
        doi_indexed: 0,
        direct_peer_reviewed: 0,
      },
      reconciliation: {
        total_publications: 0,
        category_sum: 0,
        yearly_sum: 0,
        bulletin_actual_sum: 0,
        categories_reconciled: true,
        bulletins_reconciled: true,
      },
      generated_at: '2026-11-20T10:00:00Z',
    };

    render(
      <SamikshaAnalytics
        analyticsData={emptyAnalyticsData}
        publications={[]}
        totalPublications={0}
        bulletins={[]}
        authors={[]}
        totalAuthors={0}
        camProjects={[]}
      />
    );

    expect(screen.getByText('No historical publication year records available.')).toBeInTheDocument();
    expect(screen.getByText('No category records currently available.')).toBeInTheDocument();
    expect(screen.getByText('No verified recognition records available.')).toBeInTheDocument();
    expect(screen.getByText('No published research bulletins recorded.')).toBeInTheDocument();
  });
});
