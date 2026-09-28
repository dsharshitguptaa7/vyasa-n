import React from 'react';
import { PageContainer } from '../components/Layout/PageContainer';
import { CSJMU_INSTITUTION, VYASA_BRAND } from './types';
import { CsjmuLogo } from './CsjmuLogo';
import { VyasaLogo } from '../components/Brand/VyasaLogo';

export interface InstitutionalFooterProps {
  children?: React.ReactNode;
  onSelectTab?: (tab: string) => void;
  className?: string;
}

/**
 * Standard Institutional Footer component for VYASA Core and all future pillars.
 * Consumes the official VYASA logo and CSJMU logo assets.
 * Maintains institutional fidelity, clear-space, and exact bilingual typography.
 */
export const InstitutionalFooter: React.FC<InstitutionalFooterProps> = ({
  children,
  onSelectTab,
  className = '',
}) => {
  return (
    <footer className={`vyasa-institutional-footer ${className}`} style={{ backgroundColor: 'var(--vyasa-primary, #0f2b48)' }}>
      <PageContainer>
        <div className="vyasa-institutional-footer__top">
          {/* Official Co-Brand Block */}
          <div style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <CsjmuLogo size={48} />
              <div
                style={{
                  width: '1px',
                  height: '38px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }}
                aria-hidden="true"
              />
              <VyasaLogo size={42} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#ffffff',
                  letterSpacing: '0.2px',
                }}
              >
                {CSJMU_INSTITUTION.nameEnglish}
              </span>

              <span
                className="vyasa-devanagari"
                lang="hi"
                style={{
                  fontSize: '13px',
                  color: 'var(--vyasa-gold-border, #ecdfba)',
                  marginTop: '2px',
                }}
              >
                {CSJMU_INSTITUTION.nameHindi}
              </span>

              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '10px 0 0 0',
                  lineHeight: 1.6,
                }}
              >
                An institutional technology ecosystem established by Chhatrapati Shahu Ji Maharaj
                University, Kanpur. Unifying scholarly research, academic knowledge, and transparent
                governance through AI-assisted workflows.
              </p>
            </div>
          </div>

          {/* Navigation Slot or Default Links */}
          {children || (
            <div style={{ display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--vyasa-gold-border, #ecdfba)',
                    marginBottom: '10px',
                  }}
                >
                  Ecosystem
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', opacity: 0.85 }}>
                  <a
                    href="#overview"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('overview');
                    }}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    Overview
                  </a>
                  <a
                    href="#pillars"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('pillars');
                    }}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    Modular Pillars
                  </a>
                  <a
                    href="#values"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('overview');
                      setTimeout(() => {
                        document.getElementById('values')?.scrollIntoView({ behavior: 'smooth' });
                      }, 50);
                    }}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    Mission &amp; Values
                  </a>
                  <a
                    href="#institution"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('overview');
                      setTimeout(() => {
                        document.getElementById('institution')?.scrollIntoView({ behavior: 'smooth' });
                      }, 50);
                    }}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    CSJMU Kanpur
                  </a>
                </div>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--vyasa-gold-border, #ecdfba)',
                    marginBottom: '10px',
                  }}
                >
                  Governance &amp; Portals
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', opacity: 0.85 }}>
                  <a
                    href="#applicant"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('applicant');
                    }}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    Applicant Portal
                  </a>
                  <a
                    href="#governance"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('governance');
                    }}
                    style={{ color: '#ffffff', textDecoration: 'none' }}
                  >
                    Institutional Authority
                  </a>
                  <a
                    href="#system"
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectTab?.('system');
                    }}
                    style={{
                      color: 'var(--vyasa-gold-border, #ecdfba)',
                      textDecoration: 'none',
                      fontSize: '12px',
                      marginTop: '4px',
                    }}
                  >
                    &bull; System Diagnostics (/system)
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Attribution Bar */}
        <div className="vyasa-institutional-footer__bottom">
          <span>
            &copy; {new Date().getFullYear()} {CSJMU_INSTITUTION.nameEnglish}. All rights reserved.
          </span>
          <span className="vyasa-devanagari" lang="hi" style={{ color: 'var(--vyasa-gold-border, #ecdfba)' }}>
            {VYASA_BRAND.productName} — {VYASA_BRAND.taglineHindi}
          </span>
        </div>
      </PageContainer>
    </footer>
  );
};
