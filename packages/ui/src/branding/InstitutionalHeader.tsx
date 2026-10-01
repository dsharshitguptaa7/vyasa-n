import React from 'react';
import { UniversityBrand } from './UniversityBrand';
import { VyasaBrand } from './VyasaBrand';
import { CSJMU_INSTITUTION } from './types';

export interface InstitutionalHeaderProps {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onLogoClick?: () => void;
  className?: string;
  subBrand?: React.ReactNode;
}

/**
 * Standard Institutional Header component for VYASA Core and all future pillars.
 * Consumes the official VYASA logo and CSJMU logo assets.
 * Visually balances the prominent VYASA product identity with CSJMU governance authority.
 */
export const InstitutionalHeader: React.FC<InstitutionalHeaderProps> = ({
  children,
  actions,
  onLogoClick,
  className = '',
  subBrand,
}) => {
  return (
    <header className={`vyasa-institutional-header ${className}`} style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      {/* 1. Top Institutional Affiliation Bar */}
      <div
        className="csjmu-top-bar"
        style={{
          backgroundColor: '#0a1d30',
          color: '#ffffff',
          borderBottom: '1px solid rgba(236, 223, 186, 0.2)',
          padding: '6px 0',
          fontSize: '12px',
        }}
      >
        <div
          className="vyasa-page-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <UniversityBrand size="sm" showAccreditation={true} theme="dark" />
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>
            {CSJMU_INSTITUTION.location}
          </div>
        </div>
      </div>

      {/* 2. Primary Ecosystem Navigation Bar */}
      <div
        className="vyasa-masthead"
        style={{
          backgroundColor: 'var(--vyasa-primary, #0f2b48)',
          color: '#ffffff',
          borderBottom: '2px solid var(--vyasa-gold, #b2811a)',
        }}
      >
        <div className="vyasa-masthead__accent-bar" aria-hidden="true" />
        <div
          className="vyasa-page-container vyasa-masthead__inner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            paddingBottom: '8px',
          }}
        >
          {/* Prominent Official VYASA Brand Lockup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <VyasaBrand size="md" showTagline={true} onClick={onLogoClick} />
            {subBrand && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '1px', height: '36px', backgroundColor: 'rgba(236, 223, 186, 0.35)' }} />
                {subBrand}
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
    </header>
  );
};
