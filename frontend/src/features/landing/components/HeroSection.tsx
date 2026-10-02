import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, VyasaLogo, AppIcon } from '@vyasa/ui';
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
      {/* 1. Institutional Context Pill */}
      <div>
        <div className="vyasa-landing-hero__eyebrow">
          <CsjmuLogo size={24} />
          <span>{CSJMU_INSTITUTION.nameEnglish}</span>
          <Badge variant="gold" size="sm">
            Research &amp; Development
          </Badge>
        </div>
      </div>

      {/* 2. Visual Relationship: CSJMU Institutional Seal + VYASA Official Emblem (Visually Balanced) */}
      <div className="vyasa-landing-hero__seals" data-testid="hero-institutional-seals">
        <div
          className="vyasa-landing-hero__seal-wrap vyasa-landing-hero__seal-wrap--csjmu"
          title={CSJMU_INSTITUTION.nameEnglish}
        >
          <CsjmuLogo size={104} className="vyasa-landing-hero__seal--csjmu" />
        </div>

        <div className="vyasa-landing-hero__divider" aria-hidden="true" />

        <div
          className="vyasa-landing-hero__seal-wrap vyasa-landing-hero__seal-wrap--vyasa"
          title={VYASA_BRAND.productName}
        >
          <VyasaLogo size={72} className="vyasa-landing-hero__seal--vyasa" />
        </div>
      </div>

      {/* 3. Product Name (Editorial Typography) */}
      <h1 className="vyasa-landing-hero__title">{VYASA_BRAND.productName}</h1>

      {/* 4. Exact Hindi Tagline */}
      <div className="vyasa-landing-hero__tagline" lang="hi">
        {VYASA_BRAND.taglineHindi}
      </div>

      {/* 5. Main Heading */}
      <h2 className="vyasa-landing-hero__secondary">
        An AI-assisted Research, Innovation &amp; Institutional Governance Ecosystem
      </h2>

      {/* 6. Supporting Statement */}
      <p className="vyasa-landing-hero__statement">
        &ldquo;A step toward making Research &amp; Development more connected, transparent, secure, intelligent and responsive.&rdquo;
      </p>

      {/* 7. Primary Actions */}
      <div className="vyasa-landing-hero__actions">
        <Button variant="primary" size="lg" onClick={onEnterEcosystem}>
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
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>VYASA AI Assistant</span>
            <AppIcon name="arrow-right" size={16} />
          </span>
        </Button>
        <Button variant="outline" size="lg" onClick={handleScrollToVision}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>Explore the Vision</span>
            <AppIcon name="chevron-down" size={16} />
          </span>
        </Button>
      </div>
    </section>
  );
};


export default HeroSection;
