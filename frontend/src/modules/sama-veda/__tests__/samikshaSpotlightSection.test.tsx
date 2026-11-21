import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SamikshaSpotlightSection, parseResearcherFromSpotlight } from '../components/SamikshaSpotlightSection';
import { PublicSpotlight, PublicAuthor } from '../services/samaVedaService';

const mockAuthors: PublicAuthor[] = [
  {
    id: 'auth-1',
    full_name: 'Prof. Nand Lal',
    department: 'Department of Life Sciences',
    institutional_affiliation: 'Professor & Dean of Academic Research',
    scopus_id: '57190000001',
    is_verified: true,
  },
  {
    id: 'auth-2',
    full_name: 'Dr. Shilpa Deshpande',
    department: 'Department of Biotechnology',
    institutional_affiliation: 'Associate Professor & Lab Director',
    scopus_id: '57190000002',
    is_verified: true,
  },
  {
    id: 'auth-3',
    full_name: 'Dr. Arvind Sharma',
    department: 'Department of Physics',
    institutional_affiliation: 'Assistant Professor',
    scopus_id: '57190000003',
    is_verified: true,
  },
];

const mockSpotlights: PublicSpotlight[] = [
  {
    id: 'spot-1',
    headline: 'Researcher Spotlight: Prof. Nand Lal',
    summary: 'Pioneering plant biotechnology breakthroughs that improve crop resilience under arid conditions.',
    media_type: 'video',
    media_url: 'storage/sama_veda/spotlights/nand_lal.jpg',
    video_embed_url: 'https://example.com/videos/nand_lal_interview.mp4',
    display_order: 1,
    author_id: 'auth-1',
  } as any,
  {
    id: 'spot-2',
    headline: 'Faculty Spotlight: Dr. Shilpa Deshpande - CRISPR Gene Editing',
    summary: 'Developing affordable gene therapies for pediatric rare genetic disorders in northern India.',
    media_type: 'video',
    media_url: 'storage/sama_veda/spotlights/shilpa.jpg',
    video_embed_url: 'https://example.com/videos/shilpa_portrait_reel.mp4',
    display_order: 2,
    author_id: 'auth-2',
  } as any,
  {
    id: 'spot-3',
    headline: 'Breakthrough in Quantum Coherence at Ambient Temperatures',
    summary: 'Dr. Arvind Sharma and the condensed matter team achieve a milestone in room-temperature quantum storage.',
    media_type: 'video',
    media_url: 'storage/sama_veda/spotlights/quantum.jpg',
    video_embed_url: 'https://example.com/videos/quantum_lab.mp4',
    display_order: 3,
    author_id: 'auth-3',
  } as any,
  {
    id: 'spot-4',
    headline: 'Researcher Spotlight: Dr. Meera Verma',
    summary: 'Advances in polymer composites for aerospace applications.',
    media_type: 'video',
    media_url: 'storage/sama_veda/spotlights/meera.jpg',
    video_embed_url: 'https://example.com/videos/meera.mp4',
    display_order: 4,
  } as any,
];

describe('SamikshaSpotlightSection UI/UX Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Renders editorial section heading with authoritative typography and supporting text', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
      />
    );

    // Section Eyebrow, Title, and Supporting Narrative
    expect(screen.getByText(/RESEARCH STORIES · PEOPLE BEHIND THE DISCOVERIES/i)).toBeInTheDocument();
    expect(screen.getByText('Researchers. Ideas. Impact.')).toBeInTheDocument();
    expect(
      screen.getByText('Conversations with the minds shaping research, innovation and academic excellence at CJSU.')
    ).toBeInTheDocument();
  });

  it('2. Prioritizes researcher name and academic identity over generic spotlight labels', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
      />
    );

    // Researcher names are prominently rendered
    expect(screen.getAllByText('Prof. Nand Lal').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Dr. Shilpa Deshpande')).toBeInTheDocument();
    expect(screen.getByText('Dr. Arvind Sharma')).toBeInTheDocument();

    // Academic departments and designations are displayed
    expect(screen.getAllByText('Department of Life Sciences').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Department of Biotechnology')).toBeInTheDocument();
    expect(screen.getByText('Department of Physics')).toBeInTheDocument();
  });

  it('3. Renders featured interview showcase with prominent media container and editorial details', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
      />
    );

    // Featured Conversation badge
    expect(screen.getByText('Featured Conversation')).toBeInTheDocument();
    expect(screen.getByText('Watch Full Interview')).toBeInTheDocument();

    // Remaining interviews appear in gallery
    expect(screen.getAllByText('Watch Interview').length).toBe(3);
  });

  it('4. Supports configurable featured selection and disabling featured layout', () => {
    // When enableFeatured is false, all spotlights render in the grid
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
        enableFeatured={false}
      />
    );

    expect(screen.queryByText('Featured Conversation')).not.toBeInTheDocument();
    expect(screen.getAllByText('Watch Interview').length).toBe(4);
  });

  it('5. Opens video playback modal on thumbnail or CTA click and supports keyboard dismiss', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
      />
    );

    // Initially modal is not rendered
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Click on Watch Full Interview button
    fireEvent.click(screen.getByText('Watch Full Interview'));

    // Modal is opened
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText(/Close interview video/i)).toBeInTheDocument();

    // Press Escape key to close modal
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('6. Closes modal when close button is clicked', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
      />
    );

    // Click on card Watch Interview button
    const watchButtons = screen.getAllByText('Watch Interview');
    fireEvent.click(watchButtons[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click close button
    fireEvent.click(screen.getByLabelText(/Close interview video/i));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('7. Returns null without throwing or breaking layout when spotlights array is empty', () => {
    const { container } = render(
      <SamikshaSpotlightSection
        spotlights={[]}
        authors={mockAuthors}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('8. Successfully parses researcher metadata when author is not in directory', () => {
    const parsed = parseResearcherFromSpotlight(
      {
        id: 'spot-custom',
        headline: 'Researcher Spotlight: Dr. Alok Kumar',
        summary: 'Pioneering work in composite materials at the Department of Materials Science.',
        media_type: 'video',
        display_order: 1,
      },
      []
    );

    expect(parsed.name).toBe('Dr. Alok Kumar');
    expect(parsed.headline).toContain('Academic Excellence');
  });
});
