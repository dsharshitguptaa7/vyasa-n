import React from 'react';
import { UniversityBrand } from './UniversityBrand';
import { VyasaLogo } from '../components/Brand/VyasaLogo';
import { CSJMU_INSTITUTION, VYASA_BRAND } from './types';

export interface InstitutionalHeaderProps {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onLogoClick?: () => void;
  className?: string;
  subBrand?: React.ReactNode;
  contextualNav?: React.ReactNode;
}

/**
 * Canonical Institutional Header component for VYASA-N Ecosystem.
 * Adheres to the established two-tier institutional design system:
 * Tier 1: CSJMU Institutional Affiliation Bar (#081726)
 * Accent: Solid Antique Gold Divider (1.5px)
 * Tier 2: Primary Ecosystem Masthead (#061524)
 * Tier 3: Optional Contextual Navigation Bar
 */
export const InstitutionalHeader: React.FC<InstitutionalHeaderProps> = ({
  children,
  actions,
  onLogoClick,
  className = '',
  subBrand,
  contextualNav,
}) => {
  return (
    <header className={`vyasa-institutional-header ${className}`} style={{ position: 'sticky', top: 0, zIndex: 60, width: '100%' }}>
      {/* Tier 1: CSJMU Institutional Affiliation Bar */}
      <div
        className="csjmu-top-bar"
        style={{
          backgroundColor: '#081726',
          color: '#ffffff',
          padding: '8px 0',
          fontSize: '12px',
          transition: 'all 0.25s ease',
        }}
      >
        <div
          className="vyasa-page-container csjmu-top-bar__inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <UniversityBrand size="md" showAccreditation={true} theme="dark" />
          <div
            className="csjmu-top-bar__meta"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              fontSize: '11.5px',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <span
              className="csjmu-top-bar__location"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.02em',
                fontWeight: 500,
              }}
            >
              {CSJMU_INSTITUTION.location}
            </span>
          </div>
        </div>
      </div>

      {/* Solid Antique Gold Accent Divider Line */}
      <div
        className="vyasa-masthead-divider"
        aria-hidden="true"
        style={{
          height: '1.5px',
          background: 'var(--vyasa-gold, #b2811a)',
          width: '100%',
        }}
      />

      {/* Tier 2: Primary Ecosystem Masthead */}
      <div
        className="vyasa-public-masthead vyasa-masthead"
        style={{
          backgroundColor: '#061524',
          color: '#ffffff',
          borderBottom: '1px solid rgba(236, 223, 186, 0.12)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          position: 'relative',
        }}
      >
        <div
          className="vyasa-page-container vyasa-public-masthead__inner vyasa-masthead__inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '64px',
            gap: '16px',
          }}
        >
          {/* Prominent Official VYASA Brand Lockup */}
          <div
            className="vyasa-public-logo-lockup"
            onClick={onLogoClick}
            role="button"
            tabIndex={0}
            style={{
              display: 'inline-flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
              textDecoration: 'none',
              outline: 'none',
              padding: '4px 6px',
              borderRadius: '8px',
              transition: 'background 0.2s ease',
            }}
          >
            <VyasaLogo size={42} />
            {subBrand ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  className="vyasa-public-logo-tagline vyasa-devanagari"
                  lang="hi"
                  style={{
                    fontFamily: "var(--vyasa-font-devanagari), 'Noto Sans Devanagari', sans-serif",
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--vyasa-gold-border, #ecdfba)',
                    lineHeight: 1.2,
                  }}
                >
                  {VYASA_BRAND.taglineHindi}
                </span>
                <div style={{ width: '1px', height: '32px', backgroundColor: 'rgba(236, 223, 186, 0.25)' }} />
                {subBrand}
              </div>
            ) : (
              <div
                className="vyasa-public-logo-text"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  lineHeight: 1.2,
                }}
              >
                <span
                  className="vyasa-public-logo-title"
                  style={{
                    fontFamily: "var(--vyasa-font-scholarly), 'Cinzel', serif",
                    fontSize: '14.5px',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: 'var(--vyasa-gold, #c89528)',
                    textTransform: 'uppercase',
                  }}
                >
                  VYASAᴺ ECOSYSTEM
                </span>
                <span
                  className="vyasa-public-logo-tagline"
                  lang="hi"
                  style={{
                    fontFamily: "var(--vyasa-font-devanagari), 'Noto Sans Devanagari', sans-serif",
                    fontSize: '11px',
                    fontWeight: 500,
                    color: 'var(--vyasa-gold-border, #ecdfba)',
                    marginTop: '2px',
                    lineHeight: 1.2,
                  }}
                >
                  {VYASA_BRAND.taglineHindi}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Slot */}
          {children && (
            <div className="vyasa-masthead__nav" style={{ position: 'relative', overflow: 'visible' }}>
              {children}
            </div>
          )}

          {/* Action CTAs */}
          {actions && <div className="vyasa-masthead__actions">{actions}</div>}
        </div>
      </div>

      {/* Tier 3: Contextual Navigation Bar */}
      {contextualNav && (
        <div className="vyasa-context-nav">
          {contextualNav}
        </div>
      )}
    </header>
  );
};
