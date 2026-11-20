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
  const logoSize = size === 'lg' ? 42 : size === 'sm' ? 26 : 32;
  const isLight = theme === 'light';
  const primaryTextColor = isLight ? 'var(--vyasa-primary, #0f2b48)' : '#ffffff';
  const hindiTextColor = isLight ? 'var(--vyasa-text-muted, #6b7280)' : 'var(--vyasa-gold-border, #ecdfba)';

  return (
    <div
      className={`university-brand ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size === 'lg' ? '12px' : size === 'sm' ? '8px' : '10px',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div className="university-brand__logo-wrap" style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        <CsjmuLogo size={logoSize} />
      </div>

      <div
        className="university-brand__content"
        style={{
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          flex: 1,
          gap: '2px',
          boxSizing: 'border-box',
        }}
      >
        <div
          className="university-brand__heading-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <span
            className="university-brand__name-en"
            style={{
              fontSize: size === 'lg' ? '14px' : size === 'sm' ? '11px' : '12px',
              fontWeight: 600,
              color: primaryTextColor,
              letterSpacing: '0.2px',
              lineHeight: 1.25,
              whiteSpace: 'normal',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
            }}
          >
            {CSJMU_INSTITUTION.nameEnglish}
          </span>
          {showAccreditation && CSJMU_INSTITUTION.accreditation && (
            <span
              className="university-brand__subtitle university-brand__accreditation"
              style={{
                fontSize: size === 'lg' ? '11px' : size === 'sm' ? '9.5px' : '10px',
                padding: '1.5px 6px',
                borderRadius: '4px',
                backgroundColor: isLight ? 'var(--vyasa-primary-surface, #eff5fa)' : 'rgba(255, 255, 255, 0.08)',
                border: isLight ? '1px solid var(--vyasa-primary-border, #cadbef)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: isLight ? 'var(--vyasa-primary, #0f2b48)' : '#ffffff',
                fontWeight: 500,
                lineHeight: 1.35,
                whiteSpace: 'normal',
                wordBreak: 'normal',
                overflowWrap: 'break-word',
                display: 'inline-block',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              {CSJMU_INSTITUTION.accreditation}
            </span>
          )}
        </div>

        {showHindiName && (
          <span
            className="vyasa-devanagari university-brand__name-hi"
            lang="hi"
            style={{
              fontSize: size === 'lg' ? '12px' : size === 'sm' ? '10px' : '11px',
              color: hindiTextColor,
              marginTop: '1px',
              lineHeight: 1.35,
              whiteSpace: 'normal',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
            }}
          >
            {CSJMU_INSTITUTION.nameHindi}
          </span>
        )}
      </div>
    </div>
  );
};
