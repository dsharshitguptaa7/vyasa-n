import React from 'react';
import { SectionHeading, Badge } from '@vyasa/ui';
import { CsjmuLogo, CSJMU_INSTITUTION } from '@vyasa/ui/branding';

export const BuiltAtCsjmuSection: React.FC = () => {
  return (
    <section id="csjmu" className="vyasa-story-section">
      <SectionHeading
        align="center"
        eyebrow="Institutional Provenance"
        title="Designed, Developed &amp; Evolved at CSJMU Kanpur"
        description="Conceived and nurtured within the University's own research and governance fabric."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      <div className="vyasa-csjmu-panel">
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <CsjmuLogo size={96} />
        </div>

        <div className="vyasa-csjmu-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
            <h3 className="vyasa-csjmu-heading">{CSJMU_INSTITUTION.nameEnglish}</h3>
            <Badge variant="gold" size="sm">Research &amp; Development</Badge>
          </div>

          <div className="vyasa-csjmu-subheading" lang="hi">
            {CSJMU_INSTITUTION.nameHindi}
          </div>

          <p className="vyasa-csjmu-text">
            VYASAᴺ is being envisioned and developed within {CSJMU_INSTITUTION.nameEnglish}, as an
            institutional research and innovation initiative.
          </p>
          <p className="vyasa-csjmu-text">
            Rather than treating technology as an external layer, the ecosystem is being developed
            around the University&apos;s own research, governance and institutional requirements.
          </p>

          {/* Compact, Understated Attribution */}
          <div
            className="vyasa-attribution-block"
            data-testid="vyasa-attribution"
            style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--vyasa-gold-border, #ecdfba)',
            }}
          >
            <div
              className="vyasa-attribution-label"
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--vyasa-gold, #b2811a)',
                marginBottom: '3px',
              }}
            >
              VYASAᴺ &mdash; Design &amp; Development
            </div>
            <div
              className="vyasa-attribution-person"
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: 'var(--vyasa-primary, #0f2b48)',
                marginBottom: '2px',
              }}
            >
              Harshit Gupta
            </div>
            <div
              className="vyasa-attribution-credential"
              style={{
                fontSize: '0.85rem',
                color: 'var(--vyasa-text-secondary, #4b5565)',
              }}
            >
              M.Sc. Mathematics with AI &amp; Data Science &middot; {CSJMU_INSTITUTION.nameEnglish}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BuiltAtCsjmuSection;
