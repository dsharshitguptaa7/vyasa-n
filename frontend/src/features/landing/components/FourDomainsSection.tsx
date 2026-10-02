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
        <div className="vyasa-domains-hub-grid">
          {/* Top Domain: Rig Veda */}
          <div className="vyasa-domains-cell--top">
            <div className="vyasa-domain-card vyasa-domain-card--conceptual">
              <div className="vyasa-domain-header">
                <h3 className="vyasa-domain-title">Rig Veda</h3>
                <Badge variant="neutral" size="sm">Conceptual Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Research &amp; Knowledge Creation</div>
              <p className="vyasa-domain-role">
                The research and knowledge creation dimension of the VYASAᴺ Research Ecosystem.
              </p>
              <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #6b7280)', fontStyle: 'italic' }}>
                Future Development &bull; Conceptual Domain
              </div>
            </div>
          </div>

          {/* Left Domain: Sama Veda */}
          <div className="vyasa-domains-cell--left">
            <div className="vyasa-domain-card vyasa-domain-card--conceptual">
              <div className="vyasa-domain-header">
                <h3 className="vyasa-domain-title">Sama Veda</h3>
                <Badge variant="neutral" size="sm">Conceptual Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Research Recognition &amp; Communication</div>
              <p className="vyasa-domain-role">
                The recognition, communication and dissemination dimension of research.
              </p>
              <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #6b7280)', fontStyle: 'italic' }}>
                Future Development &bull; Conceptual Domain
              </div>
            </div>
          </div>

          {/* Center Hub: VYASA Emblem & Core Hub */}
          <div className="vyasa-domains-cell--center">
            <VyasaLogo size={52} />
            <div
              style={{
                fontFamily: 'var(--vyasa-font-scholarly)',
                fontSize: '18px',
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
                marginTop: '4px',
              }}
            >
              {VYASA_BRAND.taglineHindi}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'var(--vyasa-text-muted, #6b7280)',
                marginTop: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              Institutional Core Hub
            </div>
          </div>

          {/* Right Domain: Yajur Veda */}
          <div className="vyasa-domains-cell--right">
            <div className="vyasa-domain-card vyasa-domain-card--conceptual">
              <div className="vyasa-domain-header">
                <h3 className="vyasa-domain-title">Yajur Veda</h3>
                <Badge variant="neutral" size="sm">Conceptual Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Research Administration &amp; Incentives</div>
              <p className="vyasa-domain-role">
                The administrative and institutional support dimension of research.
              </p>
              <div style={{ fontSize: '11px', color: 'var(--vyasa-text-muted, #6b7280)', fontStyle: 'italic' }}>
                Future Development &bull; Conceptual Domain
              </div>
            </div>
          </div>

          {/* Bottom Domain: Atharva Veda (Operational Domain) */}
          <div className="vyasa-domains-cell--bottom">
            <div className="vyasa-domain-card vyasa-domain-card--operational">
              <div className="vyasa-domain-header">
                <h3 className="vyasa-domain-title" style={{ color: 'var(--vyasa-teal, #0d766e)' }}>
                  Atharva Veda
                </h3>
                <Badge variant="teal" size="sm">Operational Domain</Badge>
              </div>
              <div className="vyasa-domain-dimension">Grievance Redressal &amp; Institutional Well-Being</div>
              <p className="vyasa-domain-role">
                The institutional responsiveness, grievance redressal and well-being dimension.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(13, 118, 110, 0.15)',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--vyasa-teal, #0d766e)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span>Subsystem: NIVARAN-AI</span>
                  <AppIcon name="arrow-right" size={12} color="var(--vyasa-teal, #0d766e)" />
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  aria-label="Open Atharva Veda / NIVARAN-AI"
                  onClick={() => navigate('/modules/atharva-veda/nivaran')}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Open Atharva Veda / NIVARAN-AI</span>
                    <AppIcon name="arrow-right" size={14} />
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
