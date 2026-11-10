import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HeroSection } from '../components/HeroSection';

describe('Hero Section - Indian National Flag on Golden Rod Suite', () => {
  const renderHero = () => {
    return render(
      <MemoryRouter>
        <HeroSection onEnterEcosystem={() => {}} onExploreVision={() => {}} />
      </MemoryRouter>
    );
  };

  it('1. Renders the Indian National Flag attached directly inside the architectural watermark SVG in Section 1', () => {
    renderHero();

    const flagCloth = screen.getByTestId('hero-national-flag');
    expect(flagCloth).toBeInTheDocument();
    expect(flagCloth).toHaveAttribute('role', 'img');
    expect(flagCloth).toHaveAttribute('aria-label', 'National Flag of India');
  });

  it('2. Uses the existing thin vertical golden rod at x=300 as the flagpole anchoring into the arc', () => {
    const { container } = renderHero();

    const watermark = container.querySelector('.vyasa-landing-hero__bg-watermark');
    const domeSvg = watermark?.querySelector('.vyasa-landing-hero__dome-svg');
    expect(domeSvg).toBeInTheDocument();

    // Existing vertical golden rod at x=300 extended downward
    const goldenRod = domeSvg?.querySelector('path[d="M300 8 L300 86"]');
    expect(goldenRod).toBeInTheDocument();
    expect(goldenRod).toHaveAttribute('stroke-width', '2.5');

    // Finial sphere at top of rod
    const finialSphere = domeSvg?.querySelector('circle[cx="300"][cy="8"]');
    expect(finialSphere).toBeInTheDocument();

    // Verify NO separately created HTML flagpole or duplicate pole exists
    const separatePole = container.querySelector('.vyasa-landing-hero__flagpole');
    expect(separatePole).toBeNull();
  });

  it('3. Flag attaches to upper end of golden rod at x=300 and extends horizontally to the RIGHT with 3:2 ratio', () => {
    const { container } = renderHero();

    const flagGroup = container.querySelector('.vyasa-landing-hero__flag-cloth');
    expect(flagGroup).toBeInTheDocument();

    const rects = flagGroup?.querySelectorAll('rect');
    expect(rects).toBeDefined();

    // Stripes start at x=300 (hoist pinned to the rod) and extend 90 units to the right (~72px on desktop)
    const saffron = rects?.[0];
    const white = rects?.[1];
    const green = rects?.[2];

    expect(saffron).toHaveAttribute('x', '300');
    expect(saffron).toHaveAttribute('y', '10');
    expect(saffron).toHaveAttribute('width', '90');
    expect(saffron).toHaveAttribute('fill', '#FF671F');

    expect(white).toHaveAttribute('x', '300');
    expect(white).toHaveAttribute('y', '30');
    expect(white).toHaveAttribute('width', '90');
    expect(white).toHaveAttribute('fill', '#FFFFFF');

    expect(green).toHaveAttribute('x', '300');
    expect(green).toHaveAttribute('y', '50');
    expect(green).toHaveAttribute('width', '90');
    expect(green).toHaveAttribute('fill', '#046A38');
  });

  it('4. Features an accurate Ashoka Chakra with exactly 24 spokes in Navy Blue', () => {
    const { container } = renderHero();

    const flagGroup = container.querySelector('.vyasa-landing-hero__flag-cloth');
    const chakraGroup = flagGroup?.querySelector('g[transform="translate(345, 40)"]');
    expect(chakraGroup).toBeInTheDocument();

    // 24 Spoke lines
    const spokes = chakraGroup?.querySelectorAll('line');
    expect(spokes).toHaveLength(24);

    spokes?.forEach((spoke, idx) => {
      const transform = spoke.getAttribute('transform');
      expect(transform).toBe(`rotate(${idx * 15})`);
    });

    // Outer rim & hub circles in navy blue (#000080)
    const circles = chakraGroup?.querySelectorAll('circle');
    expect(circles?.[0]).toHaveAttribute('stroke', '#000080'); // outer rim
    expect(circles?.[1]).toHaveAttribute('fill', '#000080');   // hub
  });

  it('5. Preserves the decorative golden semi-circular arc and removes unintended extra horizontal lines', () => {
    const { container } = renderHero();

    const watermark = container.querySelector('.vyasa-landing-hero__bg-watermark');
    const domeSvg = watermark?.querySelector('.vyasa-landing-hero__dome-svg');

    // The symmetrical golden arc path
    const arcPath = domeSvg?.querySelector('path[d="M300 70 C335 70 365 98 375 138 L225 138 C235 98 265 70 300 70 Z"]');
    expect(arcPath).toBeInTheDocument();
    expect(arcPath).toHaveAttribute('stroke', 'rgba(212, 160, 23, 0.18)');

    // Verify unintended extra horizontal line (line x1=170) is completely removed
    const extraLine = domeSvg?.querySelector('line[x1="170"]');
    expect(extraLine).toBeNull();
  });

  it('6. Organizes the hero into 4 logical vertical sections with complete content preserved', () => {
    const { container } = renderHero();

    // Section 1: Flag and Decorative Arc
    expect(container.querySelector('[data-testid="hero-section-arc"]')).toBeInTheDocument();

    // Section 2: University Identity
    expect(container.querySelector('[data-testid="hero-section-identity"]')).toBeInTheDocument();
    expect(screen.getByTestId('hero-institution-identity')).toBeInTheDocument();
    expect(screen.getByText('Chhatrapati Shahu Ji Maharaj University, Kanpur')).toBeInTheDocument();

    // Section 3: Institutional Branding
    expect(container.querySelector('[data-testid="hero-section-branding"]')).toBeInTheDocument();
    expect(screen.getByTestId('hero-institutional-seals')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'VYASAᴺ' })).toBeInTheDocument();

    // Section 4: Hero Content & CTAs
    expect(container.querySelector('[data-testid="hero-section-content"]')).toBeInTheDocument();
    expect(screen.getByText('ज्ञान से शोध तक, AI के साथ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enter VYASA.*Research Ecosystem/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'VYASA AI Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore the Vision/i })).toBeInTheDocument();
  });
});
