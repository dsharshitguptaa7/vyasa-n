import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SamikshaErrorBoundary } from '../components/SamikshaErrorBoundary';
import { SamaVedaDashboardPage } from '../pages/SamaVedaDashboardPage';
import { samaVedaService } from '../services/samaVedaService';
import { parseResearcherFromSpotlight } from '../components/SamikshaSpotlightSection';

const ProblematicChild: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Simulated widget rendering failure');
  }
  return <div data-testid="child-content">Child rendered successfully</div>;
};

describe('SamikshaErrorBoundary Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Suppress console.error in tests for expected thrown errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children normally when there are no exceptions', () => {
    render(
      <SamikshaErrorBoundary title="Test Section">
        <ProblematicChild shouldThrow={false} />
      </SamikshaErrorBoundary>
    );

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child rendered successfully')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('catches render errors and displays institutional fallback UI without crashing', () => {
    render(
      <SamikshaErrorBoundary title="Research Analytics" isolate>
        <ProblematicChild shouldThrow={true} />
      </SamikshaErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Research Analytics Temporarily Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected display issue occurred in this section/i)).toBeInTheDocument();
    expect(screen.getByText('Retry Component')).toBeInTheDocument();
    expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
  });

  it('resets error state when clicking Retry Component', () => {
    let shouldThrow = true;
    const onResetMock = vi.fn();

    const { rerender } = render(
      <SamikshaErrorBoundary title="Spotlight Widget" onReset={onResetMock}>
        <ProblematicChild shouldThrow={shouldThrow} />
      </SamikshaErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Set child to not throw before clicking retry
    shouldThrow = false;
    rerender(
      <SamikshaErrorBoundary title="Spotlight Widget" onReset={onResetMock}>
        <ProblematicChild shouldThrow={false} />
      </SamikshaErrorBoundary>
    );

    const retryBtn = screen.getByText('Retry Component');
    fireEvent.click(retryBtn);

    expect(onResetMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('safely parses spotlights with null or undefined headline or summary without throwing', () => {
    const malformedSpotlight: any = {
      id: 'spot-malformed',
      headline: null,
      summary: null,
      media_type: 'video',
      media_url: null,
      video_embed_url: null,
      display_order: 0,
    };

    expect(() => {
      const parsed = parseResearcherFromSpotlight(malformedSpotlight, []);
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe('Distinguished Faculty Researcher');
    }).not.toThrow();
  });

  it('handles partial analytics data where summary is undefined without crashing SamaVedaDashboardPage', async () => {
    // Return empty analytics response missing summary object entirely
    vi.spyOn(samaVedaService, 'getOverviewAnalytics').mockResolvedValue({} as any);
    vi.spyOn(samaVedaService, 'getBulletins').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getCamProjects').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getFellowships').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getSpotlights').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(samaVedaService, 'getPublications').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });
    vi.spyOn(samaVedaService, 'getAuthors').mockResolvedValue({ items: [], total: 0, skip: 0, limit: 100 });

    const { container } = render(
      <MemoryRouter initialEntries={['/modules/sama-veda']}>
        <SamaVedaDashboardPage />
      </MemoryRouter>
    );

    // Initial render is visible
    expect(screen.getByText(/समीक्षा • Research/i)).toBeInTheDocument();

    // After async loading completes, verify page is still completely intact and NOT blank
    await waitFor(() => {
      expect(screen.getByText(/समीक्षा • Research/i)).toBeInTheDocument();
    });

    expect(container.innerHTML).not.toBe('');
    expect(screen.getByRole('navigation', { name: /SAMIKSHA Sections/i })).toBeInTheDocument();
  });
});
