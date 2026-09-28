import React from 'react';
import { CSJMU_INSTITUTION } from './types';
import { CsjmuLogo } from './CsjmuLogo';

export interface UniversityBrandProps {
  size?: 'sm' | 'md' | 'lg';
  showHindiName?: boolean;
  showAccreditation?: boolean;
  theme?: 'dark' | 'light';
  className?: string;
}

/**
 * Reusable official CSJMU University Brand component.
 * Displays the official Chhatrapati Shahu Ji Maharaj University logo and institutional typography.
 * Establishes clear institutional governance context without overwhelming product branding.
 */
export const UniversityBrand: React.FC<UniversityBrandProps> = ({
  size = 'md',
  showHindiName = true,
  showAccreditation = true,
  theme = 'dark',
  className = '',
}) => {
  const logoSize = size === 'lg' ? 48 : size === 'sm' ? 28 : 36;
  const isLight = theme === 'light';
  const primaryTextColor = isLight ? 'var(--vyasa-primary, #0f2b48)' : '#ffffff';
  const hindiTextColor = isLight ? 'var(--vyasa-text-muted, #6b7280)' : 'var(--vyasa-gold-border, #ecdfba)';

  return (
    <div
      className={`university-brand ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
      }}
    >
      <CsjmuLogo size={logoSize} />

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: size === 'lg' ? '14px' : size === 'sm' ? '11px' : '12px',
              fontWeight: 600,
              color: primaryTextColor,
              letterSpacing: '0.2px',
              lineHeight: 1.2,
            }}
          >
            {CSJMU_INSTITUTION.nameEnglish}
          </span>
          {showAccreditation && CSJMU_INSTITUTION.accreditation && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '3px',
                backgroundColor: isLight ? 'var(--vyasa-primary-surface, #eff5fa)' : 'rgba(255, 255, 255, 0.1)',
                border: isLight ? '1px solid var(--vyasa-primary-border, #cadbef)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: isLight ? 'var(--vyasa-primary, #0f2b48)' : '#ffffff',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {CSJMU_INSTITUTION.accreditation}
            </span>
          )}
        </div>

        {showHindiName && (
          <span
            className="vyasa-devanagari"
            lang="hi"
            style={{
              fontSize: size === 'lg' ? '12px' : size === 'sm' ? '10px' : '11px',
              color: hindiTextColor,
              marginTop: '1px',
              lineHeight: 1.2,
            }}
          >
            {CSJMU_INSTITUTION.nameHindi}
          </span>
        )}
      </div>
    </div>
  );
};
