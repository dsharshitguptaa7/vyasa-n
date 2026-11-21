import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
      screen.getByText(/Conversations with the minds shaping research, innovation and academic excellence at CSJMU\./i)
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

  it('8. Successfully parses researcher metadata when author is not in directory using actual headline', () => {
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
    // Actual headline is preserved, not replaced with generic fake text
    expect(parsed.headline).toBe('Researcher Spotlight: Dr. Alok Kumar');
    expect(parsed.summary).toBe('Pioneering work in composite materials at the Department of Materials Science.');
    // Fabricated fallback labels must not exist
    expect(parsed.designation).not.toBe('Faculty Researcher & Principal Investigator');
    expect(parsed.department).not.toBe('Department of Advanced Research & Innovation');
  });

  it('9. Correctly supports PhD Scholars and Research Scholars without assuming faculty or PI status', () => {
    const phdSpotlight: PublicSpotlight = {
      id: 'spot-phd',
      headline: 'Ph.D. Scholar Priya Sharma - Solar Cell Innovations',
      summary: 'Doctoral research focusing on perovskite solar cells and clean energy applications.',
      media_url: 'storage/sama_veda/spotlights/priya.jpg',
      display_order: 1,
    };

    const parsedPhd = parseResearcherFromSpotlight(phdSpotlight, []);
    expect(parsedPhd.name).toBe('Priya Sharma');
    expect(parsedPhd.contributorType).toBe('phd_scholar');
    expect(parsedPhd.designation).toBe('PhD Scholar');
    // Must never assume faculty or PI
    expect(parsedPhd.designation).not.toContain('Faculty');
    expect(parsedPhd.designation).not.toContain('Principal Investigator');

    const jrfSpotlight: PublicSpotlight = {
      id: 'spot-jrf',
      headline: 'Research Scholar Ankit Mishra - Natural Language Processing',
      summary: 'Junior Research Fellow (JRF) working on low-resource Indic language models.',
      media_url: 'storage/sama_veda/spotlights/ankit.jpg',
      display_order: 2,
    };

    const parsedJrf = parseResearcherFromSpotlight(jrfSpotlight, []);
    expect(parsedJrf.name).toBe('Ankit Mishra');
    expect(parsedJrf.contributorType).toBe('research_scholar');
    expect(parsedJrf.designation).toBe('Junior Research Fellow (JRF)');
    expect(parsedJrf.designation).not.toContain('Faculty');
  });

  it('10. Gracefully handles spotlights with missing optional fields without fabricating metadata', () => {
    const minimalSpotlight: PublicSpotlight = {
      id: 'spot-sparse',
      headline: 'Annual Research Symposium Highlights',
      media_url: null,
      video_embed_url: 'https://example.com/videos/symposium.mp4',
      display_order: 1,
    };

    const parsed = parseResearcherFromSpotlight(minimalSpotlight, []);
    expect(parsed.headline).toBe('Annual Research Symposium Highlights');
    // No invented person or fake department/designation
    expect(parsed.name).toBeUndefined();
    expect(parsed.designation).toBeUndefined();
    expect(parsed.department).toBeUndefined();
    expect(parsed.researchArea).toBeUndefined();
    expect(parsed.summary).toBeUndefined();

    // Renders gracefully without crashes or fabricated labels
    render(
      <SamikshaSpotlightSection
        spotlights={[minimalSpotlight]}
        authors={[]}
        enableFeatured={false}
      />
    );

    expect(screen.getByText('Annual Research Symposium Highlights')).toBeInTheDocument();
    expect(screen.queryByText(/Distinguished Faculty Researcher/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Department of Advanced Research & Innovation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Faculty Researcher & Principal Investigator/i)).not.toBeInTheDocument();
    expect(screen.getByText('Watch Interview')).toBeInTheDocument();
  });

  it('11. Initial load state transition: Empty initial spotlights followed by API resolution renders successfully without React hook count error', () => {
    // This specifically tests the root cause of ISSUE 1:
    // When spotlights is initially empty and then populated asynchronously,
    // all hooks must execute consistently on both renders without throwing "Rendered more hooks than previous render".
    const { rerender } = render(
      <SamikshaSpotlightSection
        spotlights={[]}
        authors={mockAuthors}
        loading={false}
      />
    );

    // Initial render is null (empty data)
    expect(screen.queryByText('Researchers. Ideas. Impact.')).not.toBeInTheDocument();

    // Rerender when async API fetch settles with spotlight records
    expect(() => {
      rerender(
        <SamikshaSpotlightSection
          spotlights={mockSpotlights}
          authors={mockAuthors}
          loading={false}
        />
      );
    }).not.toThrow();

    // Content is now displayed without any Error Boundary intervention or retry requirement
    expect(screen.getByText('Researchers. Ideas. Impact.')).toBeInTheDocument();
    expect(screen.getByText('Featured Conversation')).toBeInTheDocument();
    expect(screen.getAllByText('Prof. Nand Lal').length).toBeGreaterThanOrEqual(1);
  });

  it('12. Renders institutional loading state when loading is true and data is being fetched', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={[]}
        authors={[]}
        loading={true}
      />
    );

    expect(screen.getByTestId('spotlight-loading-skeleton')).toBeInTheDocument();
    expect(screen.getByText(/Loading researcher spotlights/i)).toBeInTheDocument();
    expect(screen.getByText('Researchers. Ideas. Impact.')).toBeInTheDocument();
  });

  it('13. Simplified Video Player UI: Renders clean white modal with native video controls and no artificial badges or dark panels', () => {
    render(
      <SamikshaSpotlightSection
        spotlights={mockSpotlights}
        authors={mockAuthors}
      />
    );

    // Click on featured interview
    fireEvent.click(screen.getByText('Watch Full Interview'));

    // Modal dialog is present
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Modal card has clean white background (#ffffff)
    const modalContainer = dialog.querySelector('.samiksha-video-modal-container') as HTMLElement;
    expect(modalContainer).toBeInTheDocument();
    expect(modalContainer.style.backgroundColor).toBe('rgb(255, 255, 255)');

    // Header has researcher name and simple close button
    expect(within(dialog).getByText('Prof. Nand Lal')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Close interview video/i)).toBeInTheDocument();

    // Native HTML5 video player with native controls
    const video = dialog.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.controls).toBe(true);
    expect(video.style.objectFit).toBe('contain');

    // Artificial badges like "Academic Interview" or "Verified Contributor" must NOT be in the modal
    expect(screen.queryByText('Academic Interview')).not.toBeInTheDocument();
    expect(screen.queryByText('Verified Contributor')).not.toBeInTheDocument();
  });

  it('14. Orientation handling: Portrait videos adjust container max-width and preserve portrait aspect ratio', () => {
    // spot-2 has a portrait reel URL
    render(
      <SamikshaSpotlightSection
        spotlights={[mockSpotlights[1]]}
        authors={mockAuthors}
        enableFeatured={false}
      />
    );

    fireEvent.click(screen.getByText('Watch Interview'));

    const dialog = screen.getByRole('dialog');
    const modalContainer = dialog.querySelector('.samiksha-video-modal-container') as HTMLElement;
    expect(modalContainer).toBeInTheDocument();
    // Portrait max-width is constrained to 440px to prevent wide empty black player
    expect(modalContainer.style.maxWidth).toBe('440px');

    const video = dialog.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.style.aspectRatio).toBe('9/16');
  });
});
