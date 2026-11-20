import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { FelicitationShowcase } from '../components/FelicitationShowcase';
import { AnudaanPublicFelicitationCycleOut, AnudaanPublicShowcaseCyclesResponse } from '../types/anudaan';

describe('FelicitationShowcase Component Tests', () => {
  const mockCycleVol2Iss3: AnudaanPublicFelicitationCycleOut = {
    id: 'cycle-vol2-iss3',
    volume_number: 2,
    issue_number: 3,
    display_title: 'Autumn Research Felicitation Ceremony 2026',
    status: 'COMPLETED',
    felicitation_date: '2026-10-15',
    academic_year: '2026-2027',
    description: 'Celebrating high-impact Scopus publications for Autumn 2026.',
    total_sanctioned_amount: 175000.0,
    total_researchers: 2,
    sanction_count: 2,
    gallery_items: [],
    sanctions: [
      {
        id: 'sanc-1',
        researcher_name: 'Dr. Anita Roy',
        department_name: 'Computer Science & Engineering',
        publication_title: 'Neural Architecture Search for Edge Computing',
        project_title: 'Smart Edge AI Lab',
        quartile: 'Q1',
        sanctioned_amount: 100000.0,
        academic_year: '2026-2027',
        felicitation_date: '2026-10-15',
      },
      {
        id: 'sanc-2',
        researcher_name: 'Dr. Vikram Patel',
        department_name: 'Physics',
        publication_title: 'Topological Insulators in 2D Superlattices',
        quartile: 'Q2',
        sanctioned_amount: 75000.0,
        academic_year: '2026-2027',
        felicitation_date: '2026-10-15',
      },
    ],
  };

  const mockCycleVol2Iss2: AnudaanPublicFelicitationCycleOut = {
    id: 'cycle-vol2-iss2',
    volume_number: 2,
    issue_number: 2,
    display_title: 'Spring Research Honors 2026',
    status: 'COMPLETED',
    felicitation_date: '2026-04-10',
    academic_year: '2025-2026',
    description: 'Spring ceremony honoring peer-reviewed research papers.',
    total_sanctioned_amount: 50000.0,
    total_researchers: 1,
    sanction_count: 1,
    gallery_items: [],
    sanctions: [
      {
        id: 'sanc-3',
        researcher_name: 'Dr. Sunita Rao',
        department_name: 'Chemistry',
        publication_title: 'Novel Nanocatalysts for Clean Energy',
        quartile: 'Q1',
        sanctioned_amount: 50000.0,
        academic_year: '2025-2026',
        felicitation_date: '2026-04-10',
      },
    ],
  };

  const mockUpcomingCycle: AnudaanPublicFelicitationCycleOut = {
    id: 'cycle-vol2-iss4',
    volume_number: 2,
    issue_number: 4,
    display_title: 'Winter Research Convocation 2026',
    status: 'UPCOMING',
    academic_year: '2026-2027',
    sanctions: [],
    total_sanctioned_amount: 0,
    total_researchers: 0,
    sanction_count: 0,
    gallery_items: [],
  };

  const createShowcaseResponse = (
    completed: AnudaanPublicFelicitationCycleOut[] = [],
    upcoming: AnudaanPublicFelicitationCycleOut[] = []
  ): AnudaanPublicShowcaseCyclesResponse => ({
    total_cycles: completed.length + upcoming.length,
    completed_cycles: completed,
    upcoming_cycles: upcoming,
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('1. Renders empty state gracefully when no cycles are provided', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    expect(screen.getByText(/Institutional Felicitation Showcase/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No published felicitation cycles found for this period/i)
    ).toBeInTheDocument();
  });

  it('2. Groups records by Volume and Issue and calculates aggregate stats accurately', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3, mockCycleVol2Iss2], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    // Header and Subtitle
    expect(screen.getByText(/Institutional Felicitation Showcase/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Celebrating scholarly contributions and institutional research excellence/i)
    ).toBeInTheDocument();

    // Aggregate statistics across both cycles
    // Total distinct researchers: 3 (Anita, Vikram, Sunita)
    expect(screen.getByText('Scholars Recognised')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Total incentive: 100,000 + 75,000 + 50,000 = 2,25,000
    expect(screen.getByText(/2,25,000/i)).toBeInTheDocument();

    // Total cycles: 2
    expect(screen.getByText('Felicitation Cycles')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Quartile distribution: Q1 = 2 (Anita, Sunita), Q2 = 1 (Vikram)
    expect(screen.getByText(/Q1: 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Q2: 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Q3: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Q4: 0/i)).toBeInTheDocument();

    // Issue navigation buttons
    expect(screen.getByText(/Volume 2 · Issue 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Volume 2 · Issue 2/i)).toBeInTheDocument();
  });

  it('3. Renders the Researcher Spotlight carousel and complete recipient list for the active issue', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3, mockCycleVol2Iss2], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    // Volume 2 Issue 3 is newest and should be active initially
    expect(screen.getByText(/Vol 2 Iss 3/i)).toBeInTheDocument();

    const spotlight = screen.getByRole('region', { name: /Researcher Spotlight/i });

    // Spotlight initially shows first researcher in Vol 2 Iss 3: Dr. Anita Roy
    expect(within(spotlight).getByText('Dr. Anita Roy')).toBeInTheDocument();
    expect(within(spotlight).getByText('Computer Science & Engineering')).toBeInTheDocument();
    expect(within(spotlight).getByText(/Neural Architecture Search for Edge Computing/i)).toBeInTheDocument();
    expect(within(spotlight).getByText(/Smart Edge AI Lab/i)).toBeInTheDocument();
    expect(within(spotlight).getByText(/1,00,000/i)).toBeInTheDocument();

    // Recipient list section below spotlight
    expect(screen.getByText(/Researchers Recognized in This Issue/i)).toBeInTheDocument();
    expect(screen.getAllByText('Dr. Vikram Patel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Physics').length).toBeGreaterThan(0);
    expect(screen.getByText('Topological Insulators in 2D Superlattices')).toBeInTheDocument();
  });

  it('4. Allows switching active issue via issue navigation tabs', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3, mockCycleVol2Iss2], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    // Click Volume 2 Issue 2 tab
    const vol2Iss2Tab = screen.getByRole('tab', { name: /Volume 2 · Issue 2/i });
    fireEvent.click(vol2Iss2Tab);

    // Active issue should now be Volume 2 Issue 2
    const spotlight = screen.getByRole('region', { name: /Researcher Spotlight/i });
    expect(within(spotlight).getByText('Dr. Sunita Rao')).toBeInTheDocument();
    expect(within(spotlight).getByText('Chemistry')).toBeInTheDocument();
    expect(within(spotlight).getByText(/Novel Nanocatalysts for Clean Energy/i)).toBeInTheDocument();
    expect(within(spotlight).getByText(/50,000/i)).toBeInTheDocument();

    // Dr. Anita Roy is in Vol 2 Iss 3 and should no longer be in the active spotlight
    expect(within(spotlight).queryByText('Dr. Anita Roy')).not.toBeInTheDocument();
  });

  it('5. Rotates Spotlight carousel automatically every 7.5 seconds and supports manual next/prev navigation', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    const spotlight = screen.getByRole('region', { name: /Researcher Spotlight/i });

    // Initially Dr. Anita Roy is in the spotlight
    expect(within(spotlight).getByText('Dr. Anita Roy')).toBeInTheDocument();

    // Advance timer by 7.5 seconds
    act(() => {
      vi.advanceTimersByTime(7500);
    });

    // Now Dr. Vikram Patel should be in the spotlight
    expect(within(spotlight).getByText('Dr. Vikram Patel')).toBeInTheDocument();

    // Advance another 7.5 seconds to wrap back
    act(() => {
      vi.advanceTimersByTime(7500);
    });
    expect(within(spotlight).getByText('Dr. Anita Roy')).toBeInTheDocument();

    // Manual navigation buttons
    const nextBtn = screen.getByRole('button', { name: /Next Researcher/i });
    fireEvent.click(nextBtn);
    expect(within(spotlight).getByText('Dr. Vikram Patel')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /Previous Researcher/i });
    fireEvent.click(prevBtn);
    expect(within(spotlight).getByText('Dr. Anita Roy')).toBeInTheDocument();
  });

  it('6. Pauses spotlight auto-rotation on mouse hover and resumes on mouse leave', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    const carousel = screen.getByRole('region', { name: /Researcher Spotlight/i });

    // Hover over carousel
    fireEvent.mouseEnter(carousel);

    // Advance 10 seconds while hovered
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should still be on Dr. Anita Roy (paused)
    expect(within(carousel).getByText('Dr. Anita Roy')).toBeInTheDocument();

    // Leave hover
    fireEvent.mouseLeave(carousel);

    // Advance 7.5 seconds after hover ended
    act(() => {
      vi.advanceTimersByTime(7500);
    });

    // Should advance to Dr. Vikram Patel
    expect(within(carousel).getByText('Dr. Vikram Patel')).toBeInTheDocument();
  });

  it('7. Filters spotlight and recipient list by Quartile', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    const quartileSelect = screen.getByLabelText(/Filter showcase by Quartile/i);

    // Filter to Q2 only
    fireEvent.change(quartileSelect, { target: { value: 'Q2' } });

    const spotlight = screen.getByRole('region', { name: /Researcher Spotlight/i });

    // In Vol 2 Iss 3, only Vikram Patel is Q2
    expect(within(spotlight).getByText('Dr. Vikram Patel')).toBeInTheDocument();
    expect(within(spotlight).queryByText('Dr. Anita Roy')).not.toBeInTheDocument();

    // Filter to Q4 (none in this cycle)
    fireEvent.change(quartileSelect, { target: { value: 'Q4' } });
    expect(screen.getByText(/No recognized researchers match quartile filter/i)).toBeInTheDocument();

    // Reset to ALL
    fireEvent.change(quartileSelect, { target: { value: 'ALL' } });
    expect(within(spotlight).getByText('Dr. Anita Roy')).toBeInTheDocument();
  });

  it('8. Handles touch swipe navigation on mobile devices', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3], [])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    const carousel = screen.getByRole('region', { name: /Researcher Spotlight/i });

    // Simulate swipe left (next)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 100 }] });

    expect(within(carousel).getByText('Dr. Vikram Patel')).toBeInTheDocument();

    // Simulate swipe right (prev)
    fireEvent.touchStart(carousel, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 200 }] });

    expect(within(carousel).getByText('Dr. Anita Roy')).toBeInTheDocument();
  });

  it('9. Handles upcoming cycle notice correctly', () => {
    render(
      <FelicitationShowcase
        showcaseCycles={createShowcaseResponse([mockCycleVol2Iss3], [mockUpcomingCycle])}
        loading={false}
        selectedYear="2026-2027"
      />
    );

    // Upcoming cycle with no sanctions rendered in notice section
    expect(
      screen.getByText(/Nominations \/ sanctions for this cycle are currently being finalized/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Winter Research Convocation 2026')).toBeInTheDocument();
  });
});
