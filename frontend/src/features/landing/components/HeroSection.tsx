import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, VyasaLogo, AppIcon } from '@vyasa/ui';
import { CsjmuLogo, CSJMU_INSTITUTION, VYASA_BRAND } from '@vyasa/ui/branding';

interface HeroSectionProps {
  onEnterEcosystem: () => void;
  onExploreVision?: () => void;
}

const ASHOKA_CHAKRA_SPOKES = Array.from({ length: 24 }, (_, i) => (
  <line
    key={i}
    x1="0"
    y1="-1.7"
    x2="0"
    y2="-7.75"
    transform={`rotate(${i * 15})`}
  />
));

export const HeroSection: React.FC<HeroSectionProps> = ({
  onEnterEcosystem,
  onExploreVision,
}) => {
  const navigate = useNavigate();
  const handleScrollToVision = onExploreVision || (() => {
    document.getElementById('vision')?.scrollIntoView({ behavior: 'smooth' });
  });

  const handleEnterEcosystem = () => {
    const pillarsEl = document.getElementById('operational-pillars');
    if (pillarsEl) {
      pillarsEl.scrollIntoView({ behavior: 'smooth' });
    } else {
      onEnterEcosystem();
    }
  };

  return (
    <section id="overview" data-testid="landing-overview-section" className="vyasa-landing-hero">
      <div className="vyasa-landing-hero__inner">
        {/* SECTION 1 — FLAG AND DECORATIVE ARC */}
        <div className="vyasa-landing-hero__section-arc" data-testid="hero-section-arc">
          <div className="vyasa-landing-hero__bg-watermark" aria-hidden="true">
            <svg
              viewBox="0 0 600 148"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="vyasa-landing-hero__dome-svg"
            >
              <defs>
                <linearGradient id="vyasaFlagSheen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
                  <stop offset="35%" stopColor="#ffffff" stopOpacity="0.25" />
                  <stop offset="65%" stopColor="#000000" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.18" />
                </linearGradient>
                <filter id="vyasaFlagShadow" x="-5%" y="-5%" width="120%" height="130%">
                  <feDropShadow dx="0.5" dy="1.2" stdDeviation="1.2" floodColor="#0f2b48" floodOpacity="0.16" />
                </filter>
              </defs>

              {/* Symmetrical Classical Dome Arc (Framing the pedestal beneath the flagpole) */}
              <path
                d="M300 82 C335 82 365 110 375 150 L225 150 C235 110 265 82 300 82 Z"
                stroke="rgba(212, 160, 23, 0.18)"
                strokeWidth="1.2"
                fill="rgba(212, 160, 23, 0.015)"
              />

              {/* Indian National Flag attached directly to the upper end of the golden rod, extending to the RIGHT */}
              <g
                className="vyasa-landing-hero__flag-cloth"
                role="img"
                aria-label="National Flag of India"
                data-testid="hero-national-flag"
                filter="url(#vyasaFlagShadow)"
              >
                {/* Saffron (Kesari) stripe */}
                <rect x="300" y="10" width="90" height="20" fill="#FF671F" />
                {/* White stripe */}
                <rect x="300" y="30" width="90" height="20" fill="#FFFFFF" />
                {/* India Green stripe */}
                <rect x="300" y="50" width="90" height="20" fill="#046A38" />

                {/* Ashoka Chakra: Navy Blue, exactly 24 spokes, centered in the white stripe */}
                <g transform="translate(345, 40)">
                  {/* Outer circle rim */}
                  <circle cx="0" cy="0" r="7.75" stroke="#000080" strokeWidth="1.1" fill="none" />
                  {/* Central hub disk */}
                  <circle cx="0" cy="0" r="1.7" fill="#000080" />
                  {/* Core point */}
                  <circle cx="0" cy="0" r="0.55" fill="#FFFFFF" />
                  {/* 24 Spokes */}
                  <g stroke="#000080" strokeWidth="0.55" strokeLinecap="round">
                    {ASHOKA_CHAKRA_SPOKES}
                  </g>
                </g>

                {/* Fabric sheen overlay */}
                <rect x="300" y="10" width="90" height="60" fill="url(#vyasaFlagSheen)" />
                {/* Fine hem border */}
                <rect
                  x="300"
                  y="10"
                  width="90"
                  height="60"
                  fill="none"
                  stroke="rgba(0, 0, 0, 0.06)"
                  strokeWidth="0.5"
                />
              </g>

              {/* Existing Thin Vertical Golden Rod (Acting as the actual flagpole, extended downward) */}
              <path
                d="M300 -2 L300 80"
                stroke="rgba(212, 160, 23, 0.85)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="300" cy="8" r="3.5" fill="rgba(212, 160, 23, 0.95)" />
            </svg>
          </div>
        </div>

        {/* SECTION 2 — UNIVERSITY IDENTITY */}
        <div className="vyasa-landing-hero__section-identity" data-testid="hero-section-identity">
          <div className="vyasa-landing-hero__institution" data-testid="hero-institution-identity">
            <div className="vyasa-landing-hero__inst-logo-wrap">
              <CsjmuLogo size={36} className="vyasa-landing-hero__inst-logo" />
            </div>
            <div className="vyasa-landing-hero__inst-details">
              <span className="vyasa-landing-hero__inst-name">
                {CSJMU_INSTITUTION.nameEnglish}
              </span>
              <span className="vyasa-landing-hero__inst-badge">
                {CSJMU_INSTITUTION.accreditation}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 3 — INSTITUTIONAL BRANDING */}
        <div className="vyasa-landing-hero__section-branding" data-testid="hero-section-branding">
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

          <h1 className="vyasa-landing-hero__title">{VYASA_BRAND.productName}</h1>
        </div>

        {/* SECTION 4 — HERO CONTENT */}
        <div className="vyasa-landing-hero__section-content" data-testid="hero-section-content">
          {/* Exact Hindi Tagline */}
          <div className="vyasa-landing-hero__tagline" lang="hi">
            {VYASA_BRAND.taglineHindi}
          </div>

          {/* Main Positioning Statement */}
          <h2 className="vyasa-landing-hero__secondary">
            An AI-assisted Research, Innovation &amp; Institutional Governance Ecosystem
          </h2>

          {/* Supporting Statements */}
          <p className="vyasa-landing-hero__statement">
            &ldquo;A step toward making Research &amp; Development more connected, transparent, secure, intelligent and responsive.&rdquo;
          </p>

          <p className="vyasa-landing-hero__sub-statement">
            An integrated institutional ecosystem connecting research recognition, academic communication, and transparent grievance redressal at Chhatrapati Shahu Ji Maharaj University, Kanpur.
          </p>

          {/* Primary Actions */}
          <div className="vyasa-landing-hero__actions">
            <Button
              variant="primary"
              size="lg"
              onClick={handleEnterEcosystem}
              className="vyasa-hero-btn vyasa-hero-btn--primary"
            >
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

            <Button
              variant="outline"
              size="lg"
              onClick={handleScrollToVision}
              className="vyasa-hero-btn vyasa-hero-btn--outline"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span>Explore the Vision</span>
                <AppIcon name="chevron-down" size={16} />
              </span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
