import React from 'react';
import { Button, Badge, VyasaLogo } from '@vyasa/ui';
import { CsjmuLogo, CSJMU_INSTITUTION, VYASA_BRAND } from '@vyasa/ui/branding';

interface HeroSectionProps {
  onEnterEcosystem: () => void;
  onExplorePillars: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onEnterEcosystem,
  onExplorePillars,
}) => {
  return (
    <section className="vyasa-hero-scholarly">
      {/* 1. Institutional Context Pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 18px',
          backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
          border: '1px solid var(--vyasa-gold-border, #ecdfba)',
          borderRadius: 'var(--vyasa-radius-pill, 9999px)',
          marginBottom: '28px',
          boxShadow: 'var(--vyasa-shadow-sm, 0 1px 2px rgba(0,0,0,0.04))',
        }}
      >
        <CsjmuLogo size={26} />
        <span
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--vyasa-primary, #0f2b48)',
            letterSpacing: '0.2px',
          }}
        >
          {CSJMU_INSTITUTION.nameEnglish}
        </span>
        <Badge variant="gold" size="sm">
          State University
        </Badge>
      </div>

      {/* 2. Visual Relationship: CSJMU Institutional Seal + Prominent Official VYASA Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          marginBottom: '24px',
          padding: '8px 16px',
        }}
      >
        <div style={{ textAlign: 'center' }} title={CSJMU_INSTITUTION.nameEnglish}>
          <CsjmuLogo size={68} />
        </div>

        <div
          style={{
            width: '1.5px',
            height: '60px',
            backgroundColor: 'var(--vyasa-border, #e3dcd1)',
          }}
          aria-hidden="true"
        />

        {/* Visually prominent official VYASA Logo */}
        <div style={{ textAlign: 'center' }} title={VYASA_BRAND.productName}>
          <VyasaLogo size={88} />
        </div>
      </div>

      {/* 3. Category Eyebrow */}
      <div>
        <span className="vyasa-hero-scholarly__eyebrow">
          <Badge variant="teal" size="sm">AI-Assisted</Badge>
          Research &amp; Institutional Governance Ecosystem
        </span>
      </div>

      {/* 4. Product Name */}
      <h1 className="vyasa-hero-scholarly__title">{VYASA_BRAND.productName}</h1>

      {/* 5. Exact Hindi Tagline */}
      <div className="vyasa-hero-scholarly__tagline" lang="hi">
        {VYASA_BRAND.taglineHindi}
      </div>

      {/* 6. Concise Ecosystem Narrative */}
      <p className="vyasa-hero-scholarly__lead">
        The official digital research, knowledge, and AI-assisted governance platform of{' '}
        <strong>Chhatrapati Shahu Ji Maharaj University, Kanpur</strong>. VYASA unifies institutional
        oversight, scholarly inquiry, and student services into an interconnected suite of modular
        digital pillars.
      </p>

      {/* 7. Primary Actions */}
      <div className="vyasa-hero-scholarly__actions">
        <Button variant="primary" size="lg" onClick={onEnterEcosystem}>
          Enter Ecosystem
        </Button>
        <Button variant="outline" size="lg" onClick={onExplorePillars}>
          Explore Pillars
        </Button>
      </div>
    </section>
  );
};
