import React from 'react';
import { VYASA_BRAND } from './types';
import { VyasaLogo } from '../components/Brand/VyasaLogo';

export interface VyasaBrandProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  theme?: 'dark' | 'light';
  onClick?: () => void;
  className?: string;
}

/**
 * Reusable official VYASA brand component.
 * Displays the official VYASA logo artwork with the exact Hindi tagline.
 * Visually prominent with appropriate padding and clear-space.
 */
export const VyasaBrand: React.FC<VyasaBrandProps> = ({
  size = 'md',
  showTagline = true,
  theme = 'dark',
  onClick,
  className = '',
}) => {
  const logoHeight = size === 'lg' ? 64 : size === 'sm' ? 36 : 46;
  const isLight = theme === 'light';
  const taglineColor = isLight ? 'var(--vyasa-saffron, #c85602)' : 'var(--vyasa-gold-border, #ecdfba)';

  return (
    <div
      className={`vyasa-brand-container ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
      }}
      aria-label={`${VYASA_BRAND.productName} - ${VYASA_BRAND.taglineHindi}`}
    >
      {/* Official VYASA Logo Artwork */}
      <VyasaLogo size={logoHeight} />

      {/* Exact Hindi Tagline */}
      {showTagline && (
        <span
          className="vyasa-devanagari"
          lang="hi"
          style={{
            fontSize: size === 'lg' ? '13px' : size === 'sm' ? '10px' : '11px',
            fontWeight: 500,
            color: taglineColor,
            marginTop: '4px',
            lineHeight: 1.25,
            paddingLeft: '2px',
          }}
        >
          {VYASA_BRAND.taglineHindi}
        </span>
      )}
    </div>
  );
};
