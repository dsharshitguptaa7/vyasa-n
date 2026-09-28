import React from 'react';
import { CSJMU_INSTITUTION } from './types';
import { CsjmuLogo } from './CsjmuLogo';

export interface UniversityMastheadProps {
  className?: string;
  showHindiName?: boolean;
  logoSize?: number;
}

/**
 * Top-level institutional masthead identifying Chhatrapati Shahu Ji Maharaj University, Kanpur.
 * Displayed at the very top of VYASA Core and all integrating pillars.
 */
export const UniversityMasthead: React.FC<UniversityMastheadProps> = ({
  className = '',
  showHindiName = true,
  logoSize = 36,
}) => {
  return (
    <div
      className={`csjmu-masthead ${className}`}
      style={{
        backgroundColor: '#0a1d30',
        color: '#ffffff',
        borderBottom: '1px solid rgba(236, 223, 186, 0.25)',
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
        {/* Left: CSJMU identification */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CsjmuLogo size={logoSize} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '0.2px',
                fontSize: '12px',
              }}
            >
              {CSJMU_INSTITUTION.nameEnglish}
            </span>
            {showHindiName && (
              <span
                className="vyasa-devanagari"
                lang="hi"
                style={{
                  fontSize: '11px',
                  color: 'var(--vyasa-gold-border, #ecdfba)',
                  lineHeight: 1.2,
                }}
              >
                {CSJMU_INSTITUTION.nameHindi}
              </span>
            )}
          </div>
        </div>

        {/* Right: State University Accreditation & Location */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.75)',
          }}
        >
          {CSJMU_INSTITUTION.accreditation && (
            <span
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                padding: '2px 8px',
                borderRadius: '3px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontWeight: 500,
              }}
            >
              {CSJMU_INSTITUTION.accreditation}
            </span>
          )}
          <span>{CSJMU_INSTITUTION.location}</span>
        </div>
      </div>
    </div>
  );
};
