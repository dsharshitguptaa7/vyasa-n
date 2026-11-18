import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SamikshaResearchersTab } from '../components/SamikshaResearchersTab';
import { PublicAuthor, PublicPublication } from '../services/samaVedaService';

const mockAuthors: PublicAuthor[] = [
  {
    id: 'auth-1',
    full_name: 'Dr. Anand Kumar',
    department: 'Department of Computer Science & Engineering',
    institutional_affiliation: 'Chhatrapati Shahu Ji Maharaj University, Kanpur',
    scopus_id: '59358782100',
    is_verified: true,
  },
  {
    id: 'auth-2',
    full_name: 'Prof. Sunita Sharma',
    department: 'Department of Biotechnology',
    institutional_affiliation: 'CSJMU Kanpur',
    scopus_id: '57210984561',
    is_verified: false,
  },
  {
    id: 'auth-3',
    full_name: 'Rajesh Verma',
    department: '',
    institutional_affiliation: '',
    scopus_id: '',
    is_verified: true,
  },
];

const mockPublications: PublicPublication[] = [
  {
    id: 'pub-1',
    title: 'Quantum Computing Protocols in Distributed Cryptography',
    authors_text: 'Dr. Anand Kumar, Dr. Sunita Sharma',
    journal_name: 'IEEE Transactions on Quantum Engineering',
    publication_year: 2026,
    author_links: [
      { author_id: 'auth-1', author_name: 'Dr. Anand Kumar' },
      { author_id: 'auth-2', author_name: 'Prof. Sunita Sharma' },
    ],
  },
];

describe('SamikshaResearchersTab - Faculty Researcher Directory Suite', () => {
  it('1. Renders directory header with title, summary, and telemetry counters', () => {
    const handleSearch = vi.fn();
    render(
      <SamikshaResearchersTab
        authors={mockAuthors}
        totalAuthors={3}
        authorSearch=""
        onAuthorSearchChange={handleSearch}
        publications={mockPublications}
      />
    );

    // Section title
    expect(screen.getByRole('heading', { name: /Faculty Researcher Directory/i })).toBeInTheDocument();

    // Results summary header
    const summaryEl = screen.getByText(/Showing/i).closest('div');
    expect(summaryEl?.textContent).toContain('Showing');
    expect(summaryEl?.textContent).toContain('3');
    expect(summaryEl?.textContent).toContain('researchers');

    // Telemetry counters
    expect(screen.getByText('Total Researchers')).toBeInTheDocument();
    expect(screen.getByText('Verified Faculty')).toBeInTheDocument();
  });

  it('2. Renders researcher cards with avatar initials, clean name, and department', () => {
    render(
      <SamikshaResearchersTab
        authors={mockAuthors}
        totalAuthors={3}
        authorSearch=""
        onAuthorSearchChange={vi.fn()}
        publications={mockPublications}
      />
    );

    // Names
    expect(screen.getByText('Dr. Anand Kumar')).toBeInTheDocument();
    expect(screen.getByText('Prof. Sunita Sharma')).toBeInTheDocument();
    expect(screen.getByText('Rajesh Verma')).toBeInTheDocument();

    // Departments (use getAllByText because it also appears in filter dropdown options)
    expect(screen.getAllByText('Department of Computer Science & Engineering').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Department of Biotechnology').length).toBeGreaterThanOrEqual(1);

    // Initials in avatar
    expect(screen.getByText('AK')).toBeInTheDocument();
    expect(screen.getByText('SS')).toBeInTheDocument();
    expect(screen.getByText('RV')).toBeInTheDocument();
  });

  it('3. Renders verified and provisional badges accurately from backend status', () => {
    render(
      <SamikshaResearchersTab
        authors={mockAuthors}
        totalAuthors={3}
        authorSearch=""
        onAuthorSearchChange={vi.fn()}
      />
    );

    // Verified badges (auth-1 and auth-3 are verified)
    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges.length).toBe(2);

    // Provisional badge (auth-2 is provisional)
    const provisionalBadges = screen.getAllByText('Provisional');
    expect(provisionalBadges.length).toBe(1);
  });

  it('4. Renders Scopus ID cleanly without raw HTML entities (&nearr;) and with valid link', () => {
    const { container } = render(
      <SamikshaResearchersTab
        authors={mockAuthors}
        totalAuthors={3}
        authorSearch=""
        onAuthorSearchChange={vi.fn()}
      />
    );

    // Check clean display of Scopus IDs
    expect(screen.getByText('Scopus ID: 59358782100')).toBeInTheDocument();
    expect(screen.getByText('Scopus ID: 57210984561')).toBeInTheDocument();

    // CRITICAL: Ensure no raw "&nearr;" or "&amp;nearr;" entity text appears anywhere in the rendered DOM
    expect(container.innerHTML).not.toContain('&nearr;');
    expect(container.innerHTML).not.toContain('&amp;nearr;');
    expect(screen.queryByText(/&nearr;/i)).not.toBeInTheDocument();

    // Verify external link attributes
    const scopusLinks = screen.getAllByRole('link', { name: /Scopus ID/i });
    expect(scopusLinks.length).toBe(2);

    const firstLink = scopusLinks[0];
    expect(firstLink).toHaveAttribute(
      'href',
      'https://www.scopus.com/authid/detail.uri?authorId=59358782100'
    );
    expect(firstLink).toHaveAttribute('target', '_blank');
    expect(firstLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('5. Renders card footer actions and handles Certificates & Works callbacks', () => {
    const onSelectCertificates = vi.fn();
    const onSelectPublications = vi.fn();

    render(
      <SamikshaResearchersTab
        authors={mockAuthors}
        totalAuthors={3}
        authorSearch=""
        onAuthorSearchChange={vi.fn()}
        publications={mockPublications}
        onSelectAuthorCertificates={onSelectCertificates}
        onSelectAuthorPublications={onSelectPublications}
      />
    );

    // Publication count
    expect(screen.getAllByText(/1 Felicitated Work/i).length).toBe(2);
    expect(screen.getByText(/Affiliated Scholar/i)).toBeInTheDocument();

    // Click Certificates button
    const certButtons = screen.getAllByRole('button', { name: /Certificates/i });
    expect(certButtons.length).toBe(3);
    fireEvent.click(certButtons[0]);
    expect(onSelectCertificates).toHaveBeenCalledWith('Dr. Anand Kumar');

    // Click Works button
    const worksButtons = screen.getAllByRole('button', { name: /Works/i });
    expect(worksButtons.length).toBe(3);
    fireEvent.click(worksButtons[1]);
    expect(onSelectPublications).toHaveBeenCalledWith('Prof. Sunita Sharma');
  });

  it('6. Filters researchers by verification status and search input', () => {
    const handleSearchChange = vi.fn();
    render(
      <SamikshaResearchersTab
        authors={mockAuthors}
        totalAuthors={3}
        authorSearch="Kumar"
        onAuthorSearchChange={handleSearchChange}
      />
    );

    // Search input has value
    const searchInput = screen.getByPlaceholderText(/Search researchers by name/i);
    expect(searchInput).toHaveValue('Kumar');

    // Filter by verification status
    const statusSelect = screen.getByLabelText(/Filter by verification status/i);
    fireEvent.change(statusSelect, { target: { value: 'provisional' } });

    // Only Sunita Sharma is provisional
    expect(screen.getByText('Prof. Sunita Sharma')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Anand Kumar')).not.toBeInTheDocument();
    expect(screen.queryByText('Rajesh Verma')).not.toBeInTheDocument();
  });
});
