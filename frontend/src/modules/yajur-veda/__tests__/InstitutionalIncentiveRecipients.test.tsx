import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { InstitutionalIncentiveRecipients } from '../components/InstitutionalIncentiveRecipients';
import { AnudaanPublicSanctionOut } from '../types/anudaan';

describe('InstitutionalIncentiveRecipients Component Tests', () => {
  const mockSanctions: AnudaanPublicSanctionOut[] = [
    {
      id: 'sanc-1',
      researcher_name: 'Dr. Mohit Kumar',
      department_name: 'xyz',
      publication_title: 'zbjzkjxnk zzkkzlnz kzjhkmz ,',
      quartile: 'Q3',
      sanctioned_amount: 3000.0,
      academic_year: '2026-2027',
      volume_number: 2,
      issue_number: 2,
      sanction_date: '2026-03-10',
    },
    {
      id: 'sanc-2',
      researcher_name: 'Subrat Mishra',
      department_name: null, // missing department
      publication_title: 'From Nature to Nanomedicine: The Promise and Challenges of Nanocellulose-Based Drug Delivery Systems',
      quartile: 'Q2',
      sanctioned_amount: 4000.0,
      academic_year: '2026-2027',
      volume_number: 2,
      issue_number: 3,
      sanction_date: '2026-04-15',
    },
    {
      id: 'sanc-3',
      researcher_name: 'Subrat Mishra', // second sanction for same researcher
      department_name: 'Materials Science',
      publication_title: 'Advanced Bio-Polymer Hydrogels for Tissue Regeneration',
      project_title: 'Bio-Polymer Innovations',
      quartile: 'Q1',
      sanctioned_amount: 5000.0,
      academic_year: '2026-2027',
      volume_number: null, // missing cycle/volume/issue
      issue_number: null,
      sanction_date: '2026-05-20',
    },
  ];

  it('1. Renders all published incentive records regardless of cycle association', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    // Title and Subtitle
    expect(screen.getByText('Institutional Incentive Recipients')).toBeInTheDocument();
    expect(
      screen.getByText(/Recognising researchers whose scholarly contributions have received official institutional incentive sanctions/i)
    ).toBeInTheDocument();

    // All 3 records must appear
    expect(screen.getByText('Dr. Mohit Kumar')).toBeInTheDocument();
    expect(screen.getAllByText('Subrat Mishra').length).toBe(2); // Both records for Subrat Mishra appear
    expect(screen.getByText('zbjzkjxnk zzkkzlnz kzjhkmz ,')).toBeInTheDocument();
    expect(
      screen.getByText('From Nature to Nanomedicine: The Promise and Challenges of Nanocellulose-Based Drug Delivery Systems')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Advanced Bio-Polymer Hydrogels for Tissue Regeneration')
    ).toBeInTheDocument();
  });

  it('2. Correctly calculates summary statistics without deduplicating multiple legitimate sanctions', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    // Unique researchers: 2 (Dr. Mohit Kumar and Subrat Mishra)
    expect(screen.getByText('Unique Scholars Recognised')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Published sanction entries: 3
    expect(screen.getByText('Published Sanction Entries')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);

    // Total sanctioned grants: 3000 + 4000 + 5000 = 12,000
    expect(screen.getByText('Total Sanctioned Grants')).toBeInTheDocument();
    expect(screen.getByText(/12,000/i)).toBeInTheDocument();

    // Quartile distribution: Q1: 1, Q2: 1, Q3: 1, Q4: 0
    expect(screen.getByText(/Q1: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Q2: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Q3: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Q4: 0/i)).toBeInTheDocument();
  });

  it('3. Handles missing department and missing volume/issue with graceful fallbacks', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    // Record 2 has missing department -> shows fallback "Department not specified"
    expect(screen.getByText('Department not specified')).toBeInTheDocument();

    // Record 3 has missing volume/issue -> shows fallback "Direct Sanction"
    expect(screen.getByText('Direct Sanction')).toBeInTheDocument();

    // Record 1 has Volume 2 Issue 2 -> shows cycle badge
    expect(screen.getByText(/VOLUME 2 — ISSUE 2/i)).toBeInTheDocument();
  });

  it('4. Filters records dynamically by Quartile and updates summary metrics', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    const quartileSelect = screen.getByLabelText(/Filter by Quartile/i);

    // Filter to Q1 only (only 1 record: Subrat Mishra's second sanction)
    fireEvent.change(quartileSelect, { target: { value: 'Q1' } });

    expect(screen.getByText('Advanced Bio-Polymer Hydrogels for Tissue Regeneration')).toBeInTheDocument();
    expect(screen.queryByText('Dr. Mohit Kumar')).not.toBeInTheDocument();
    expect(screen.queryByText(/From Nature to Nanomedicine/i)).not.toBeInTheDocument();

    // Stats should update to 1 entry, 1 unique researcher, ₹ 5,000
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1); // entries
    expect(screen.getAllByText(/5,000/i).length).toBeGreaterThanOrEqual(1); // amount
  });

  it('5. Filters records dynamically by Volume & Issue', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    const volIssueSelect = screen.getByLabelText(/Filter by Volume and Issue/i);

    // Filter to Volume 2 · Issue 3 (Subrat Mishra's first paper)
    fireEvent.change(volIssueSelect, { target: { value: '2-3' } });

    expect(screen.getByText(/From Nature to Nanomedicine/i)).toBeInTheDocument();
    expect(screen.queryByText('Dr. Mohit Kumar')).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced Bio-Polymer Hydrogels for Tissue Regeneration')).not.toBeInTheDocument();
  });

  it('6. Filters records by search query in real-time', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    const searchInput = screen.getByLabelText(/Search incentive records/i);

    // Search by title keyword "Nanomedicine"
    fireEvent.change(searchInput, { target: { value: 'Nanomedicine' } });

    expect(screen.getByText(/From Nature to Nanomedicine/i)).toBeInTheDocument();
    expect(screen.queryByText('Dr. Mohit Kumar')).not.toBeInTheDocument();
  });

  it('7. Toggles between Cards and Table views cleanly', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={mockSanctions}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    const tableToggleBtn = screen.getByRole('button', { name: /Table view/i });
    fireEvent.click(tableToggleBtn);

    // Table elements should now be visible
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Publication Title')).toBeInTheDocument();
    expect(screen.getByText('Sanctioned Amount')).toBeInTheDocument();

    const cardsToggleBtn = screen.getByRole('button', { name: /Cards view/i });
    fireEvent.click(cardsToggleBtn);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('8. Renders empty state only when filtered record set is empty', () => {
    render(
      <InstitutionalIncentiveRecipients
        sanctions={[]}
        showcaseCycles={null}
        loading={false}
        selectedYear="2026-2027"
        onYearChange={vi.fn()}
      />
    );

    expect(
      screen.getByText(/No published felicitation cycles found for this period. No published institutional incentive records match the selected criteria./i)
    ).toBeInTheDocument();
  });
});
