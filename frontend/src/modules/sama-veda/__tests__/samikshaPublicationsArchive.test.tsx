import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SamikshaPublicationsTab } from '../components/SamikshaPublicationsTab';
import { PublicPublication, PublicBulletin, IssuePublicationCount } from '../services/samaVedaService';

const mockBulletins: PublicBulletin[] = [
  {
    id: 'bull-1',
    volume_number: 1,
    issue_number: 1,
    title: 'CSJMU Research Bulletin Vol 1 Issue 1',
    publication_period: 'Jan – Jun 2025',
    publication_count: 12,
    file_size_bytes: 4000000,
    checksum_sha256: 'abc1',
    published_at: '2025-06-30T00:00:00Z',
  },
  {
    id: 'bull-2',
    volume_number: 1,
    issue_number: 2,
    title: 'CSJMU Research Bulletin Vol 1 Issue 2',
    publication_period: 'Jul – Dec 2025',
    publication_count: 18,
    file_size_bytes: 4500000,
    checksum_sha256: 'abc2',
    published_at: '2025-12-31T00:00:00Z',
  },
  {
    id: 'bull-3',
    volume_number: 2,
    issue_number: 1,
    title: 'CSJMU Research Bulletin Vol 2 Issue 1',
    publication_period: 'Jan – Jun 2026',
    publication_count: 15,
    file_size_bytes: 5000000,
    checksum_sha256: 'abc3',
    published_at: '2026-06-30T00:00:00Z',
  },
];

const mockIssueCounts: IssuePublicationCount[] = [
  {
    bulletin_id: 'bull-1',
    volume_number: 1,
    issue_number: 1,
    title: 'CSJMU Research Bulletin Vol 1 Issue 1',
    publication_count: 12,
  },
  {
    bulletin_id: 'bull-2',
    volume_number: 1,
    issue_number: 2,
    title: 'CSJMU Research Bulletin Vol 1 Issue 2',
    publication_count: 18,
  },
  {
    bulletin_id: 'bull-3',
    volume_number: 2,
    issue_number: 1,
    title: 'CSJMU Research Bulletin Vol 2 Issue 1',
    publication_count: 15,
  },
];

const mockPublications: PublicPublication[] = [
  {
    id: 'p1',
    bulletin_id: 'bull-1',
    volume_number: 1,
    issue_number: 1,
    serial_no: 1,
    slug: 'v1-i1-r001',
    title: 'Quantum Computing Fundamentals',
    source_journal: 'Journal of Physics',
    category: 'Article',
    author_display: 'Dr. A. Sharma',
    authors_complete: true,
    published_at: '2025-03-01T00:00:00Z',
    created_at: '2025-03-01T00:00:00Z',
    is_featured: false,
    author_links: [],
  },
  {
    id: 'p2',
    bulletin_id: 'bull-1',
    volume_number: 1,
    issue_number: 1,
    serial_no: 2,
    slug: 'v1-i1-r002',
    title: 'Renewable Solar Energy Review',
    source_journal: 'Energy Reports',
    category: 'Review',
    author_display: 'Dr. B. Verma',
    authors_complete: true,
    published_at: '2025-04-10T00:00:00Z',
    created_at: '2025-04-10T00:00:00Z',
    is_featured: false,
    author_links: [],
  },
  {
    id: 'p3',
    bulletin_id: 'bull-2',
    volume_number: 1,
    issue_number: 2,
    serial_no: 1,
    slug: 'v1-i2-r001',
    title: 'Deep Learning in Agriculture',
    source_journal: 'IEEE Transactions',
    category: 'Article',
    author_display: 'Prof. C. Gupta',
    authors_complete: true,
    published_at: '2025-08-15T00:00:00Z',
    created_at: '2025-08-15T00:00:00Z',
    is_featured: false,
    author_links: [],
  },
  {
    id: 'p4',
    bulletin_id: 'bull-3',
    volume_number: 2,
    issue_number: 1,
    serial_no: 1,
    slug: 'v2-i1-r001',
    title: 'Advanced Robotics and Automation',
    source_journal: 'Robotics Today',
    category: 'Article',
    author_display: 'Dr. D. Singh',
    authors_complete: true,
    published_at: '2026-02-20T00:00:00Z',
    created_at: '2026-02-20T00:00:00Z',
    is_featured: false,
    author_links: [],
  },
];

describe('SamikshaPublicationsTab Bulletin Volume, Issue & Counts Architecture', () => {
  it('loads distinct volumes dynamically and filters publications by volume', () => {
    render(
      <SamikshaPublicationsTab
        publications={mockPublications}
        totalPublications={mockPublications.length}
        pubSearch=""
        onPubSearchChange={vi.fn()}
        pubCategory=""
        onPubCategoryChange={vi.fn()}
        bulletins={mockBulletins}
        issueCounts={mockIssueCounts}
      />
    );

    // Check Volume dropdown exists
    const volumeSelect = screen.getByLabelText('Filter by volume');
    expect(volumeSelect).toBeInTheDocument();

    // Verify options are dynamic and distinct: All Volumes, Volume 1, Volume 2
    const options = Array.from((volumeSelect as HTMLSelectElement).options).map((o) => o.text);
    expect(options).toEqual(['All Volumes', 'Volume 1', 'Volume 2']);

    // Initially all 4 publications are visible
    expect(screen.getByText('Quantum Computing Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Renewable Solar Energy Review')).toBeInTheDocument();
    expect(screen.getByText('Deep Learning in Agriculture')).toBeInTheDocument();
    expect(screen.getByText('Advanced Robotics and Automation')).toBeInTheDocument();

    // Select Volume 2
    fireEvent.change(volumeSelect, { target: { value: '2' } });

    // Only Volume 2 publication should be displayed
    expect(screen.getByText('Advanced Robotics and Automation')).toBeInTheDocument();
    expect(screen.queryByText('Quantum Computing Fundamentals')).toBeNull();
    expect(screen.queryByText('Renewable Solar Energy Review')).toBeNull();
    expect(screen.queryByText('Deep Learning in Agriculture')).toBeNull();

    // Select All Volumes again
    fireEvent.change(volumeSelect, { target: { value: '' } });
    expect(screen.getByText('Quantum Computing Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Advanced Robotics and Automation')).toBeInTheDocument();
  });

  it('populates issue options corresponding to selected volume with publication counts', () => {
    render(
      <SamikshaPublicationsTab
        publications={mockPublications}
        totalPublications={mockPublications.length}
        pubSearch=""
        onPubSearchChange={vi.fn()}
        pubCategory=""
        onPubCategoryChange={vi.fn()}
        bulletins={mockBulletins}
        issueCounts={mockIssueCounts}
      />
    );

    const volumeSelect = screen.getByLabelText('Filter by volume');
    const issueSelect = screen.getByLabelText('Filter by issue');

    // Select Volume 1
    fireEvent.change(volumeSelect, { target: { value: '1' } });

    // Verify Volume 1 issues with publication counts in labels
    const optionsVol1 = Array.from((issueSelect as HTMLSelectElement).options).map((o) => o.text);
    expect(optionsVol1).toEqual([
      'All Issues',
      'Issue 1 (12 publications)',
      'Issue 2 (18 publications)',
    ]);

    // Select Issue 2
    fireEvent.change(issueSelect, { target: { value: '2' } });

    // Only publication p3 (Vol 1, Issue 2) should remain
    expect(screen.getByText('Deep Learning in Agriculture')).toBeInTheDocument();
    expect(screen.queryByText('Quantum Computing Fundamentals')).toBeNull();
    expect(screen.queryByText('Advanced Robotics and Automation')).toBeNull();

    // Switching to Volume 2 should reset Issue 2 since Volume 2 has only Issue 1
    fireEvent.change(volumeSelect, { target: { value: '2' } });

    // Issue select should now only have All Issues and Issue 1 (15 publications)
    const optionsVol2 = Array.from((issueSelect as HTMLSelectElement).options).map((o) => o.text);
    expect(optionsVol2).toEqual(['All Issues', 'Issue 1 (15 publications)']);
    expect((issueSelect as HTMLSelectElement).value).toBe('');

    // Volume 2 publications displayed
    expect(screen.getByText('Advanced Robotics and Automation')).toBeInTheDocument();
  });

  it('renders Publication Distribution summary section and allows clicking an issue to apply filters', () => {
    render(
      <SamikshaPublicationsTab
        publications={mockPublications}
        totalPublications={mockPublications.length}
        pubSearch=""
        onPubSearchChange={vi.fn()}
        pubCategory=""
        onPubCategoryChange={vi.fn()}
        bulletins={mockBulletins}
        issueCounts={mockIssueCounts}
      />
    );

    // Verify Publication Distribution section
    expect(screen.getByTestId('publication-distribution-summary')).toBeInTheDocument();
    expect(screen.getByText('Publication Distribution')).toBeInTheDocument();

    // Check each issue card exists with correct count
    expect(screen.getByText('Volume 1 — Issue 1')).toBeInTheDocument();
    expect(screen.getByText('12 papers')).toBeInTheDocument();
    expect(screen.getByText('Volume 1 — Issue 2')).toBeInTheDocument();
    expect(screen.getByText('18 papers')).toBeInTheDocument();
    expect(screen.getByText('Volume 2 — Issue 1')).toBeInTheDocument();
    expect(screen.getByText('15 papers')).toBeInTheDocument();

    // Click Volume 1 — Issue 2 summary item
    const v1i2Btn = screen.getByRole('button', { name: /Volume 1 — Issue 2/i });
    fireEvent.click(v1i2Btn);

    // Filter selects should be updated
    const volumeSelect = screen.getByLabelText('Filter by volume') as HTMLSelectElement;
    const issueSelect = screen.getByLabelText('Filter by issue') as HTMLSelectElement;
    expect(volumeSelect.value).toBe('1');
    expect(issueSelect.value).toBe('2');

    // Only publication in Vol 1 Issue 2 is displayed
    expect(screen.getByText('Deep Learning in Agriculture')).toBeInTheDocument();
    expect(screen.queryByText('Quantum Computing Fundamentals')).toBeNull();

    // Clear Bulletin Filters button should appear and reset filters
    const clearBtn = screen.getByText('Clear Bulletin Filters');
    fireEvent.click(clearBtn);

    expect(volumeSelect.value).toBe('');
    expect(issueSelect.value).toBe('');
    expect(screen.getByText('Quantum Computing Fundamentals')).toBeInTheDocument();
    expect(screen.getByText('Advanced Robotics and Automation')).toBeInTheDocument();
  });

  it('supports composable multi-facet filtering (Volume + Issue + Category + Year) and Reset action', () => {
    const onSearchChange = vi.fn();
    const onCategoryChange = vi.fn();
    const onYearChange = vi.fn();

    const { rerender } = render(
      <SamikshaPublicationsTab
        publications={mockPublications}
        totalPublications={mockPublications.length}
        pubSearch=""
        onPubSearchChange={onSearchChange}
        pubCategory=""
        onPubCategoryChange={onCategoryChange}
        selectedYear=""
        onSelectedYearChange={onYearChange}
        bulletins={mockBulletins}
        issueCounts={mockIssueCounts}
      />
    );

    // Apply Volume 1
    const volumeSelect = screen.getByLabelText('Filter by volume');
    fireEvent.change(volumeSelect, { target: { value: '1' } });

    // Apply Issue 1
    const issueSelect = screen.getByLabelText('Filter by issue');
    fireEvent.change(issueSelect, { target: { value: '1' } });

    // Apply Year 2025
    rerender(
      <SamikshaPublicationsTab
        publications={mockPublications}
        totalPublications={mockPublications.length}
        pubSearch=""
        onPubSearchChange={onSearchChange}
        pubCategory="Article"
        onPubCategoryChange={onCategoryChange}
        selectedYear="2025"
        onSelectedYearChange={onYearChange}
        bulletins={mockBulletins}
        issueCounts={mockIssueCounts}
      />
    );

    // Only p1 matches: Vol 1, Issue 1, Category Article, Year 2025
    expect(screen.getByText('Quantum Computing Fundamentals')).toBeInTheDocument();
    expect(screen.queryByText('Renewable Solar Energy Review')).toBeNull(); // Category is Review
    expect(screen.queryByText('Deep Learning in Agriculture')).toBeNull(); // Issue is 2
    expect(screen.queryByText('Advanced Robotics and Automation')).toBeNull(); // Vol is 2

    // Check record count banner
    expect(
      screen.getByText(/Showing 1 of 4 published research records.*Vol 1 Issue 1.*2025/i)
    ).toBeInTheDocument();

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: 'Reset' });
    fireEvent.click(resetBtn);

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onCategoryChange).toHaveBeenCalledWith('');
    expect(onYearChange).toHaveBeenCalledWith('');
    expect((volumeSelect as HTMLSelectElement).value).toBe('');
    expect((issueSelect as HTMLSelectElement).value).toBe('');
  });

  it('renders empty state when no publications match volume and issue filter', () => {
    render(
      <SamikshaPublicationsTab
        publications={mockPublications}
        totalPublications={mockPublications.length}
        pubSearch=""
        onPubSearchChange={vi.fn()}
        pubCategory="Book"
        onPubCategoryChange={vi.fn()}
        bulletins={mockBulletins}
        issueCounts={mockIssueCounts}
      />
    );

    // No publications are category "Book"
    expect(screen.getByText('No Published Research Records Visible')).toBeInTheDocument();
  });
});
