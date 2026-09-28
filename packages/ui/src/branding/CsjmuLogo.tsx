import React, { useState } from 'react';
import { CSJMU_INSTITUTION } from './types';
import defaultCsjmuLogo from '../../../../assets/branding/csjmu/csjmu-logo.png';

export interface CsjmuLogoProps {
  size?: number;
  className?: string;
  src?: string;
}

/**
 * Official Institutional Logo component for Chhatrapati Shahu Ji Maharaj University, Kanpur.
 * Loads directly from the official centralized asset: assets/branding/csjmu/csjmu-logo.png
 * Preserves the official artwork without alteration, distortion, or artificial recreation.
 */
export const CsjmuLogo: React.FC<CsjmuLogoProps> = ({
  size = 48,
  className = '',
  src,
}) => {
  const [imageError, setImageError] = useState(false);
  const resolvedSrc = src || defaultCsjmuLogo;

  return (
    <div
      className={`csjmu-logo-container ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      title={CSJMU_INSTITUTION.nameEnglish}
    >
      {!imageError && resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={CSJMU_INSTITUTION.nameEnglish}
          onError={() => setImageError(true)}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        /* Dignified institutional fallback if image asset is unavailable */
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'var(--vyasa-surface-warm, #fdfbf7)',
            border: '1.5px solid var(--vyasa-gold, #b2811a)',
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '2px',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontSize: `${Math.max(8, Math.round(size * 0.22))}px`,
              fontWeight: 700,
              color: 'var(--vyasa-primary, #0f2b48)',
              letterSpacing: '0.5px',
              lineHeight: 1,
            }}
          >
            CSJMU
          </span>
          <span
            style={{
              fontSize: `${Math.max(6, Math.round(size * 0.14))}px`,
              color: 'var(--vyasa-text-muted, #6b7280)',
              marginTop: '1px',
            }}
          >
            Kanpur
          </span>
        </div>
      )}
    </div>
  );
};
