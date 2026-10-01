import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, AppIcon } from '@vyasa/ui';
import { CSJMU_INSTITUTION, VYASA_BRAND } from '@vyasa/ui/branding';

interface FinalVisionSectionProps {
  onEnterEcosystem?: () => void;
}

export const FinalVisionSection: React.FC<FinalVisionSectionProps> = ({ onEnterEcosystem }) => {
  const navigate = useNavigate();

  const handleEnter = onEnterEcosystem || (() => navigate('/applicant/login'));

  return (
    <section id="closing" className="vyasa-closing-section">
      <div className="vyasa-story-divider" aria-hidden="true" />

      <div
        style={{
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--vyasa-gold, #b2811a)',
          marginBottom: '18px',
        }}
      >
        The Vision Continues
      </div>

      <div className="vyasa-closing-equation">
        <span>Research</span>
        <span>+</span>
        <span>Administration</span>
        <span>+</span>
        <span>Recognition</span>
        <span>+</span>
        <span>Responsiveness</span>
      </div>

      <div className="vyasa-closing-arrow" aria-hidden="true">
        <AppIcon name="chevron-down" size={20} color="var(--vyasa-gold, #b2811a)" />
      </div>

      <h2 className="vyasa-closing-brand">{VYASA_BRAND.productName}</h2>

      <div className="vyasa-closing-tagline" lang="hi">
        {VYASA_BRAND.taglineHindi}
      </div>

      <div className="vyasa-closing-inst">
        {CSJMU_INSTITUTION.nameEnglish}
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" size="lg" onClick={handleEnter}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>Enter VYASA Ecosystem</span>
            <AppIcon name="arrow-right" size={16} />
          </span>
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => navigate('/modules/atharva-veda/nivaran')}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <span>Explore NIVARAN-AI</span>
            <AppIcon name="arrow-right" size={16} />
          </span>
        </Button>
      </div>
    </section>
  );
};

export default FinalVisionSection;
