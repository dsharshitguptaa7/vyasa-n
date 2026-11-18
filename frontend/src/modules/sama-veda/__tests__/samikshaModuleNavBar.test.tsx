import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SamaVedaDashboardPage } from '../pages/SamaVedaDashboardPage';
import { samaVedaService } from '../services/samaVedaService';
import { AuthProvider } from '../../../context/AuthContext';

describe('SAMIKSHA Module Navigation Bar UI Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
  });

  const renderDashboard = (initialRoute = '/modules/sama-veda') => {
    return render(
      <AuthProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/modules/sama-veda" element={<SamaVedaDashboardPage />} />
            <Route path="/modules/sama-veda/:tab" element={<SamaVedaDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    );
  };

  it('1. Renders horizontal navigation bar with all 7 tabs in proper sequence', async () => {
    renderDashboard();

    const nav = screen.getByRole('navigation', { name: 'SAMIKSHA Sections' });
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('samiksha-nav-bar');

    const expectedTabs = [
      'Overview',
      'Publications Archive',
      'Research Bulletins',
      'Researcher Directory',
      'Certificate Verification',
      'CAM-AI Projects',
      'Fellowship Schemes',
    ];

    const tabButtons = within(nav).getAllByRole('button');
    expect(tabButtons.length).toBe(7);
    expectedTabs.forEach((tab, index) => {
      expect(tabButtons[index]).toHaveTextContent(tab);
      expect(tabButtons[index]).toHaveClass('samiksha-nav-btn');
    });
  });

  it('2. Active tab starts at Overview, sets aria-current="page", and has is-active class', async () => {
    renderDashboard('/modules/sama-veda');

    const overviewBtn = screen.getByRole('button', { name: 'Overview' });
    expect(overviewBtn).toHaveClass('is-active');
    expect(overviewBtn).toHaveAttribute('aria-current', 'page');

    const fellowshipBtn = screen.getByRole('button', { name: 'Fellowship Schemes' });
    expect(fellowshipBtn).not.toHaveClass('is-active');
    expect(fellowshipBtn).not.toHaveAttribute('aria-current');
  });

  it('3. Clicking middle tab (Researcher Directory) updates active tab and invokes scrollIntoView', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    renderDashboard('/modules/sama-veda');

    const directoryBtn = screen.getByRole('button', { name: 'Researcher Directory' });
    fireEvent.click(directoryBtn);

    await waitFor(() => {
      expect(directoryBtn).toHaveClass('is-active');
      expect(directoryBtn).toHaveAttribute('aria-current', 'page');
    });

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  });

  it('4. Deep-linking to last tab (Fellowship Schemes) marks it active and visible without clipping', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    renderDashboard('/modules/sama-veda/fellowships');

    const fellowshipBtn = await screen.findByRole('button', { name: 'Fellowship Schemes' });
    expect(fellowshipBtn).toHaveClass('is-active');
    expect(fellowshipBtn).toHaveAttribute('aria-current', 'page');

    const overviewBtn = screen.getByRole('button', { name: 'Overview' });
    expect(overviewBtn).not.toHaveClass('is-active');

    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('5. Navigation buttons support keyboard focus and accessible SVG icons', async () => {
    renderDashboard('/modules/sama-veda');

    const tabButtons = screen.getAllByRole('button', {
      name: (name) => ['Overview', 'CAM-AI Projects', 'Fellowship Schemes'].some((t) => name.includes(t)),
    });

    tabButtons.forEach((btn) => {
      btn.focus();
      expect(document.activeElement).toBe(btn);
      const icon = btn.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('vyasa-icon');
    });
  });
});
