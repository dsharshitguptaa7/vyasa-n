import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionHeading, Badge, Button, VyasaLogo, AppIcon } from '@vyasa/ui';
import { VYASA_BRAND } from '@vyasa/ui/branding';

export const FourDomainsSection: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section id="domains" className="vyasa-story-section">
      <SectionHeading
        align="center"
        eyebrow="Ecosystem Architecture"
        title="The Four Domains of VYASAᴺ"
        description="The ecosystem has been conceptually organized around the four Vedas, with each domain carrying an independent institutional role."
      />

      <div className="vyasa-story-divider" aria-hidden="true" />

      {/* Centered Hub & 4 Domains Composition */}
      <div className="vyasa-domains-composition">
        {/* Architectural Network Connectors (Concentric Orbit & Axis Spoke Lines) */}
        <div className="vyasa-domains-connectors" aria-hidden="true">
          <svg className="vyasa-domains-connectors-svg" viewBox="0 0 1040 680" fill="none">
            {/* Concentric Vedic Orbital Rings */}
            <circle
              cx="520"
              cy="340"
              r="240"
              stroke="rgba(212, 160, 23, 0.22)"
              strokeWidth="1.5"
              strokeDasharray="5 7"
            />
            <circle
              cx="520"
              cy="340"
              r="145"
              stroke="rgba(15, 43, 72, 0.08)"
              strokeWidth="1"
            />

            {/* Vertical Spoke Axis: Rig Veda (Top) to Atharva Veda (Bottom) */}
            <line
              x1="520"
              y1="160"
              x2="520"
              y2="520"
              stroke="rgba(212, 160, 23, 0.3)"
              strokeWidth="1.5"
            />

            {/* Horizontal Spoke Axis: Sama Veda (Left) to Yajur Veda (Right) */}
            <line
              x1="320"
              y1="340"
              x2="720"
              y2="340"
              stroke="rgba(212, 160, 23, 0.3)"
              strokeWidth="1.5"
            />

            {/* Cardinal Node Markers */}
            <circle cx="520" cy="220" r="4.5" fill="#b2811a" opacity="0.8" />
            <circle cx="520" cy="460" r="4.5" fill="#0d766e" opacity="0.9" />
            <circle cx="400" cy="340" r="4.5" fill="#b2811a" opacity="0.8" />
            <circle cx="640" cy="340" r="4.5" fill="#b2811a" opacity="0.8" />
          </svg>
        </div>

        <div className="vyasa-domains-hub-grid">
          {/* Top Domain: Rig Veda */}
          <div className="vyasa-domains-cell--top">
            <div className="vyasa-domain-card vyasa-domain-card--conceptual">
              <div className="vyasa-domain-header">
                <div className="vyasa-domain-title-wrap">
                  <span className="vyasa-domain-icon" aria-hidden="true">
                    <AppIcon name="book-open" size={15} />
                  </span>
                  <h3 className="vyasa-domain-title">Rig Veda</h3>
                </div>
                <Badge variant="neutral" size="sm">Conceptual Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Research &amp; Knowledge Creation</div>
              <p className="vyasa-domain-role">
                The research and knowledge creation dimension of the VYASAᴺ Research Ecosystem.
              </p>
              <div className="vyasa-domain-footnote">
                <span className="vyasa-domain-footnote-dot" aria-hidden="true" />
                <span>Future Development &bull; Conceptual Domain</span>
              </div>
            </div>
          </div>

          {/* Left Domain: Sama Veda */}
          <div className="vyasa-domains-cell--left">
            <div className="vyasa-domain-card vyasa-domain-card--conceptual">
              <div className="vyasa-domain-header">
                <div className="vyasa-domain-title-wrap">
                  <span className="vyasa-domain-icon" aria-hidden="true">
                    <AppIcon name="globe" size={15} />
                  </span>
                  <h3 className="vyasa-domain-title">Sama Veda</h3>
                </div>
                <Badge variant="neutral" size="sm">Conceptual Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Research Recognition &amp; Communication</div>
              <p className="vyasa-domain-role">
                The recognition, communication and dissemination dimension of research.
              </p>
              <div className="vyasa-domain-footnote">
                <span className="vyasa-domain-footnote-dot" aria-hidden="true" />
                <span>Future Development &bull; Conceptual Domain</span>
              </div>
            </div>
          </div>

          {/* Center Hub: VYASA Emblem & Core Hub */}
          <div className="vyasa-domains-cell--center">
            <VyasaLogo size={58} />
            <div
              style={{
                fontFamily: 'var(--vyasa-font-scholarly)',
                fontSize: '19px',
                fontWeight: 800,
                color: 'var(--vyasa-primary, #0f2b48)',
                letterSpacing: '0.12em',
                marginTop: '10px',
              }}
            >
              {VYASA_BRAND.productName}
            </div>
            <div
              className="vyasa-devanagari"
              lang="hi"
              style={{
                fontSize: '11px',
                color: 'var(--vyasa-saffron, #c85602)',
                fontWeight: 600,
                marginTop: '3px',
              }}
            >
              {VYASA_BRAND.taglineHindi}
            </div>
            <div className="vyasa-domains-hub-badge">
              Institutional Core Hub
            </div>
          </div>

          {/* Right Domain: Yajur Veda */}
          <div className="vyasa-domains-cell--right">
            <div className="vyasa-domain-card vyasa-domain-card--conceptual">
              <div className="vyasa-domain-header">
                <div className="vyasa-domain-title-wrap">
                  <span className="vyasa-domain-icon" aria-hidden="true">
                    <AppIcon name="building" size={15} />
                  </span>
                  <h3 className="vyasa-domain-title">Yajur Veda</h3>
                </div>
                <Badge variant="neutral" size="sm">Conceptual Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Research Administration &amp; Incentives</div>
              <p className="vyasa-domain-role">
                The administrative and institutional support dimension of research.
              </p>
              <div className="vyasa-domain-footnote">
                <span className="vyasa-domain-footnote-dot" aria-hidden="true" />
                <span>Future Development &bull; Conceptual Domain</span>
              </div>
            </div>
          </div>

          {/* Bottom Domain: Atharva Veda (Operational Domain) */}
          <div className="vyasa-domains-cell--bottom">
            <div className="vyasa-domain-card vyasa-domain-card--operational">
              <div className="vyasa-domain-header">
                <div className="vyasa-domain-title-wrap">
                  <span className="vyasa-domain-icon" aria-hidden="true">
                    <AppIcon name="shield" size={15} />
                  </span>
                  <h3 className="vyasa-domain-title" style={{ color: 'var(--vyasa-teal, #0d766e)' }}>
                    Atharva Veda
                  </h3>
                </div>
                <Badge variant="teal" size="sm">Operational Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Grievance Redressal &amp; Institutional Well-Being</div>
              <p className="vyasa-domain-role">
                The institutional responsiveness, grievance redressal and well-being dimension.
              </p>
              <div className="vyasa-domain-action-row">
                <span className="vyasa-domain-subsystem-link">
                  <span>Subsystem: NIVARAN-AI</span>
                  <AppIcon name="arrow-right" size={12} color="var(--vyasa-teal, #0d766e)" />
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  aria-label="Open Atharva Veda / NIVARAN-AI"
                  onClick={() => navigate('/modules/atharva-veda/nivaran')}
                  className="vyasa-domain-action-btn"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Open Atharva Veda / NIVARAN-AI</span>
                    <AppIcon name="arrow-right" size={13} />
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FourDomainsSection;
