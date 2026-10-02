import React from 'react';
import { Card, SectionHeading, Badge } from '@vyasa/ui';
import { CsjmuLogo, CSJMU_INSTITUTION } from '@vyasa/ui/branding';

export const UniversityIdentitySection: React.FC = () => {
  return (
    <section id="institution" style={{ margin: '64px 0' }}>
      <SectionHeading
        align="center"
        eyebrow="Institutional Authority"
        title="Anchored at CSJMU Kanpur"
        description="VYASAᴺ is conceived, governed, and deployed under the auspices of Chhatrapati Shahu Ji Maharaj University, Kanpur."
      />

      <Card
        variant="gold-accent"
        className="vyasa-institution-card"
        style={{
          backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
          padding: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            padding: '24px',
            flexWrap: 'wrap',
          }}
        >
          {/* Official University Seal */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <CsjmuLogo size={84} />
          </div>

          {/* Institutional Narrative */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  margin: 0,
                  letterSpacing: '0.2px',
                }}
              >
                {CSJMU_INSTITUTION.nameEnglish}
              </h3>
              <Badge variant="gold" size="sm">
                State University
              </Badge>
            </div>

            <div
              className="vyasa-devanagari"
              lang="hi"
              style={{
                fontSize: '14px',
                color: 'var(--vyasa-saffron, #c85602)',
                fontWeight: 500,
                marginBottom: '14px',
              }}
            >
              {CSJMU_INSTITUTION.nameHindi}
            </div>

            <p
              style={{
                fontSize: '14px',
                color: 'var(--vyasa-text-secondary, #4b5565)',
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              Located in {CSJMU_INSTITUTION.location}, the university serves as the apex academic and
              governing institution for the VYASAᴺ Research Ecosystem. Through this digital platform, CSJMU
              advances its institutional commitment to rigorous academic standards, accountable public
              governance, and state-of-the-art technological adoption for scholars and students.
            </p>

            <div
              style={{
                display: 'flex',
                gap: '16px',
                marginTop: '16px',
                fontSize: '13px',
                color: 'var(--vyasa-text-muted, #6b7280)',
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>Campus:</strong> Kalyanpur, Kanpur
              </span>
              <span>&bull;</span>
              <span>
                <strong>Jurisdiction:</strong> Uttar Pradesh
              </span>
              <span>&bull;</span>
              <span>
                <strong>Ecosystem Role:</strong> Core Governance &amp; Policy Authority
              </span>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};
