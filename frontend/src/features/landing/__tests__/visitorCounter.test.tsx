import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { InstitutionalReachSection } from '../components/InstitutionalReachSection';
import { LandingPage } from '../LandingPage';
import { visitorService } from '../../../services/visitorService';

describe('InstitutionalReachSection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('1. Renders loading state initially without crashing', () => {
    // Delay resolution to capture skeleton state
    vi.spyOn(visitorService, 'getOrTrackVisitor').mockReturnValue(
      new Promise(() => {}) // never resolves in this test
    );

    render(<InstitutionalReachSection />);

    expect(screen.getByRole('region', { name: /VYASA Institutional Reach/i })).toBeInTheDocument();
    expect(screen.getByText(/VYASAⁿ — Institutional Reach/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Visitors/i)).toBeInTheDocument();
    expect(screen.getByText(/Today's Visitors/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Loading total visitors/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Loading today's visitors/i)).toBeInTheDocument();
  });

  it('2. Loads and displays real backend visitor metrics', async () => {
    vi.spyOn(visitorService, 'getOrTrackVisitor').mockResolvedValue({
      total_visitors: 4812,
      today_visitors: 142,
      date: '2026-11-11',
      timezone: 'Asia/Kolkata',
    });

    render(<InstitutionalReachSection />);

    await waitFor(() => {
      expect(screen.getByTestId('total-visitors-count')).toBeInTheDocument();
    });

    // Wait for the subtle animation to complete or settle
    await waitFor(() => {
      expect(screen.getByTestId('reach-card-total')).toHaveTextContent(/4,812/);
      expect(screen.getByTestId('reach-card-today')).toHaveTextContent(/142/);
    });

    expect(screen.getByText(/Verified Lifetime Reach/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Calendar Day \(IST\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Asia\/Kolkata \(IST \/ UTC\+05:30\)/i)).toBeInTheDocument();
  });

  it('3. Gracefully displays fallback state if API fails without crashing', async () => {
    vi.spyOn(visitorService, 'getOrTrackVisitor').mockRejectedValue(new Error('Network error'));

    render(<InstitutionalReachSection />);

    await waitFor(() => {
      expect(screen.getByTestId('reach-card-total')).toHaveTextContent('—');
      expect(screen.getByTestId('reach-card-today')).toHaveTextContent('—');
    });

    // Heading and labels remain visible and clean
    expect(screen.getByText(/VYASAⁿ — Institutional Reach/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Visitors/i)).toBeInTheDocument();
    expect(screen.getByText(/Today's Visitors/i)).toBeInTheDocument();
  });

  it('4. Preserves exactly 12 sections on LandingPage (zero test regression)', () => {
    vi.spyOn(visitorService, 'getOrTrackVisitor').mockResolvedValue({
      total_visitors: 100,
      today_visitors: 10,
      date: '2026-11-11',
      timezone: 'Asia/Kolkata',
    });

    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );

    const sections = Array.from(document.querySelectorAll('section'));
    expect(sections.length).toBe(12);

    // Verify Institutional Reach is rendered inside LandingPage
    expect(document.getElementById('institutional-reach')).toBeInTheDocument();
  });
});
