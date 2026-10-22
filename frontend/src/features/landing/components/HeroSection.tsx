import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, VyasaLogo, AppIcon } from '@vyasa/ui';
import { CsjmuLogo, CSJMU_INSTITUTION, VYASA_BRAND } from '@vyasa/ui/branding';

interface HeroSectionProps {
  onEnterEcosystem: () => void;
  onExploreVision?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onEnterEcosystem,
  onExploreVision,
}) => {
  const navigate = useNavigate();
  const handleScrollToVision = onExploreVision || (() => {
    document.getElementById('vision')?.scrollIntoView({ behavior: 'smooth' });
  });

  return (
    <section id="overview" data-testid="landing-overview-section" className="vyasa-landing-hero">
      {/* Decorative Architectural Watermark (CSJMU Classical Dome & Pinnacle) */}
      <div className="vyasa-landing-hero__bg-watermark" aria-hidden="true">
        <svg
          viewBox="0 0 600 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="vyasa-landing-hero__dome-svg"
        >
          {/* Subtle Classical Arch & Dome Motifs (confined to upper background only, never colliding with typography) */}
          <path
            d="M300 30 C335 30 365 58 375 98 L225 98 C235 58 265 30 300 30 Z"
            stroke="rgba(212, 160, 23, 0.2)"
            strokeWidth="1.5"
            fill="rgba(212, 160, 23, 0.025)"
          />
          <path d="M300 12 L300 30" stroke="rgba(212, 160, 23, 0.35)" strokeWidth="2" />
          <circle cx="300" cy="10" r="3" fill="rgba(212, 160, 23, 0.4)" />
          {/* Delicate Arch Ribs */}
          <path d="M220 98 Q300 68 380 98" stroke="rgba(15, 43, 72, 0.06)" strokeWidth="1" />
          <line x1="170" y1="98" x2="430" y2="98" stroke="rgba(212, 160, 23, 0.15)" strokeWidth="1" />
        </svg>
      </div>

      <div className="vyasa-landing-hero__inner">
        {/* 1. Visual Relationship: CSJMU Institutional Seal + VYASA Official Emblem (Visually Balanced) */}
        <div className="vyasa-landing-hero__seals" data-testid="hero-institutional-seals">
          <div
            className="vyasa-landing-hero__seal-wrap vyasa-landing-hero__seal-wrap--csjmu"
            title={CSJMU_INSTITUTION.nameEnglish}
          >
            <CsjmuLogo size={84} className="vyasa-landing-hero__seal--csjmu" />
          </div>

          <div className="vyasa-landing-hero__divider" aria-hidden="true" />

          <div
            className="vyasa-landing-hero__seal-wrap vyasa-landing-hero__seal-wrap--vyasa"
            title={VYASA_BRAND.productName}
          >
            <VyasaLogo size={64} className="vyasa-landing-hero__seal--vyasa" />
          </div>
        </div>

        {/* 2. Product Name (Editorial Typography) */}
        <h1 className="vyasa-landing-hero__title">{VYASA_BRAND.productName}</h1>

        {/* 3. Exact Hindi Tagline */}
        <div className="vyasa-landing-hero__tagline" lang="hi">
          {VYASA_BRAND.taglineHindi}
        </div>

        {/* 4. Main Heading */}
        <h2 className="vyasa-landing-hero__secondary">
          An AI-assisted Research, Innovation &amp; Institutional Governance Ecosystem
        </h2>

        {/* 5. Supporting Statement */}
        <p className="vyasa-landing-hero__statement">
          &ldquo;A step toward making Research &amp; Development more connected, transparent, secure, intelligent and responsive.&rdquo;
        </p>

        <p className="vyasa-landing-hero__sub-statement">
          Unifying scholarly research, academic knowledge, and transparent governance through AI-enabled workflows at CSJMU, Kanpur.
        </p>

        {/* 6. Primary Actions */}
        <div className="vyasa-landing-hero__actions">
          <Button variant="primary" size="lg" onClick={onEnterEcosystem} className="vyasa-hero-btn vyasa-hero-btn--primary">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span>Enter VYASAᴺ Research Ecosystem</span>
              <AppIcon name="arrow-right" size={16} />
            </span>
          </Button>

          <Button
            variant="gold"
            size="lg"
            onClick={() => {
              navigate('/phd-admission');
            }}
            className="vyasa-hero-btn vyasa-hero-btn--gold"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span>VYASA AI Assistant</span>
              <AppIcon name="arrow-right" size={16} />
            </span>
          </Button>

          <Button variant="outline" size="lg" onClick={handleScrollToVision} className="vyasa-hero-btn vyasa-hero-btn--outline">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <span>Explore the Vision</span>
              <AppIcon name="chevron-down" size={16} />
            </span>
          </Button>
        </div>

        {/* 7. Institutional Accreditation Badge */}
        <div className="vyasa-landing-hero__floating-badge">
          <CsjmuLogo size={32} />
          <div>
            <div className="vyasa-landing-hero__badge-title">Chhatrapati Shahu Ji Maharaj University, Kanpur</div>
            <div className="vyasa-landing-hero__badge-meta">State University of Uttar Pradesh</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

