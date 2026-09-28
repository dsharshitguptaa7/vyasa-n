import React, { useState } from 'react';
import defaultVyasaLogo from '../../../../../assets/branding/vyasa/vyasa-logo.png';

export interface VyasaLogoProps {
  size?: number; // Target height in pixels
  className?: string;
  src?: string;
  alt?: string;
}

/**
 * Official VYASA Logo component.
 * Uses the official centralized VYASA logo asset from: assets/branding/vyasa/vyasa-logo.png
 * Never recreates the logo with text, drawings, or substitute icons.
 * Maintains the exact native aspect ratio without distortion.
 */
export const VyasaLogo: React.FC<VyasaLogoProps> = ({
  size = 48,
  className = '',
  src,
  alt = 'VYASA',
}) => {
  const [imageError, setImageError] = useState(false);
  const resolvedSrc = src || defaultVyasaLogo;

  // Native aspect ratio is approx 1.5:1 (width:height)
  const calculatedWidth = Math.round(size * 1.5);

  return (
    <div
      className={`vyasa-logo-wrapper ${className}`}
      style={{
        height: `${size}px`,
        width: `${calculatedWidth}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-label="VYASA Official Emblem"
    >
      {!imageError && resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt}
          onError={() => setImageError(true)}
          style={{
            height: `${size}px`,
            width: 'auto',
            maxWidth: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />
      ) : (
        /* Fallback if file is unavailable */
        <div
          style={{
            height: `${size}px`,
            width: `${calculatedWidth}px`,
            backgroundColor: 'var(--vyasa-primary, #0f2b48)',
            color: '#ffffff',
            borderRadius: 'var(--vyasa-radius-sm, 4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: `${Math.max(12, Math.round(size * 0.4))}px`,
            letterSpacing: '1px',
          }}
        >
          VYASA
        </div>
      )}
    </div>
  );
};
