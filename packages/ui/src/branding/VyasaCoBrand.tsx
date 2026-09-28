import React from 'react';
import { CSJMU_INSTITUTION, VYASA_BRAND } from './types';
import { CsjmuLogo } from './CsjmuLogo';
import { VyasaLogo } from '../components/Brand/VyasaLogo';

export interface VyasaCoBrandProps {
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  showInstitutionSubtext?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Unified Co-Branding lockup combining:
 * 1. Chhatrapati Shahu Ji Maharaj University, Kanpur (CSJMU)
 * 2. VYASA Ecosystem Brand
 * 3. Exact Hindi Tagline: "ज्ञान से शोध तक, AI के साथ"
 */
export const VyasaCoBrand: React.FC<VyasaCoBrandProps> = ({
  theme = 'dark',
  size = 'md',
  showTagline = true,
  showInstitutionSubtext = true,
  className = '',
  onClick,
}) => {
  const isLight = theme === 'light';
  const logoSize = size === 'lg' ? 52 : size === 'sm' ? 36 : 44;
  const csjmuSize = size === 'lg' ? 48 : size === 'sm' ? 32 : 40;

  const titleColor = isLight ? 'var(--vyasa-primary, #0f2b48)' : '#ffffff';
  const taglineColor = isLight ? 'var(--vyasa-saffron, #c85602)' : 'var(--vyasa-gold-border, #ecdfba)';
  const subtextColor = isLight ? 'var(--vyasa-text-muted, #6b7280)' : 'rgba(255, 255, 255, 0.7)';
  const dividerColor = isLight ? 'var(--vyasa-border, #e3dcd1)' : 'rgba(255, 255, 255, 0.2)';

  return (
    <div
      className={`vyasa-co-brand ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'lg' ? '16px' : '12px',
        cursor: onClick ? 'pointer' : 'default',
        textDecoration: 'none',
      }}
    >
      {/* University Logo */}
      <CsjmuLogo size={csjmuSize} />

      {/* Elegant Vertical Divider */}
      <div
        style={{
          width: '1px',
          height: `${Math.round(logoSize * 0.75)}px`,
          backgroundColor: dividerColor,
        }}
        aria-hidden="true"
      />

      {/* VYASA Logo */}
      <VyasaLogo size={logoSize} />

      {/* Brand Text Block */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            className="vyasa-wordmark__title"
            style={{
              fontFamily: 'var(--vyasa-font-scholarly)',
              fontSize: size === 'lg' ? '28px' : size === 'sm' ? '20px' : '24px',
              fontWeight: 700,
              color: titleColor,
              letterSpacing: '0.08em',
              lineHeight: 1,
            }}
          >
            {VYASA_BRAND.productName}
          </span>
          {showInstitutionSubtext && (
            <span
              style={{
                fontSize: size === 'sm' ? '10px' : '11px',
                fontWeight: 600,
                color: subtextColor,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {CSJMU_INSTITUTION.shortName}
            </span>
          )}
        </div>

        {/* Exact Hindi Tagline */}
        {showTagline && (
          <span
            className="vyasa-devanagari"
            lang="hi"
            style={{
              fontSize: size === 'lg' ? '13px' : '11px',
              fontWeight: 500,
              color: taglineColor,
              marginTop: '3px',
              lineHeight: 1.25,
            }}
          >
            {VYASA_BRAND.taglineHindi}
          </span>
        )}
      </div>
    </div>
  );
};
