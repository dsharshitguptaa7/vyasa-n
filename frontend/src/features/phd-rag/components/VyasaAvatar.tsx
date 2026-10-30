import React from 'react';
import vyasaAssistantLogo from '../../../../../assets/branding/vyasa/vyasa_assistant.png';

export type AvatarState = 'welcome' | 'thinking' | 'speaking' | 'paused' | 'idle';

export interface VyasaAvatarProps {
  state?: AvatarState;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
  className?: string;
  statusText?: string;
  showEqualizer?: boolean;
}

export const VyasaAvatar: React.FC<VyasaAvatarProps> = ({
  state = 'idle',
  size = 'md',
  alt = 'VYASA AI Assistant Logo',
  className = '',
  statusText,
  showEqualizer = false,
}) => {
  const pixelSizes = {
    sm: 36,
    md: 48,
    lg: 76,
  };

  const currentPx = pixelSizes[size];

  // Halo class mapping
  const haloClass =
    state === 'welcome'
      ? 'vyasa-avatar-halo--welcome'
      : state === 'thinking'
      ? 'vyasa-avatar-halo--thinking'
      : state === 'speaking'
      ? 'vyasa-avatar-halo--speaking'
      : state === 'paused'
      ? 'vyasa-avatar-halo--paused'
      : '';

  return (
    <div
      className={`vyasa-avatar-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* Connected Knowledge Nodes SVG Backdrop for Welcome State */}
      {state === 'welcome' && (
        <svg
          aria-hidden="true"
          className="vyasa-node-cluster"
          viewBox="0 0 160 160"
          style={{
            position: 'absolute',
            width: `${currentPx * 1.8}px`,
            height: `${currentPx * 1.8}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 0,
            overflow: 'visible',
          }}
        >
          {/* Subtle constellation lines */}
          <line x1="30" y1="40" x2="80" y2="25" stroke="#d97706" strokeWidth="1" strokeOpacity="0.28" strokeDasharray="3 3" />
          <line x1="80" y1="25" x2="130" y2="45" stroke="#d97706" strokeWidth="1" strokeOpacity="0.28" strokeDasharray="3 3" />
          <line x1="80" y1="135" x2="135" y2="115" stroke="#0d766e" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 3" />
          <line x1="25" y1="115" x2="80" y2="135" stroke="#0d766e" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 3" />
          <line x1="25" y1="115" x2="30" y2="40" stroke="#d97706" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="2 2" />
          <line x1="130" y1="45" x2="135" y2="115" stroke="#d97706" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="2 2" />

          {/* Academic Nodes */}
          <circle cx="30" cy="40" r="3.5" fill="#d97706" fillOpacity="0.4" />
          <circle cx="80" cy="25" r="4" fill="#b2811a" fillOpacity="0.45" />
          <circle cx="130" cy="45" r="3.5" fill="#d97706" fillOpacity="0.4" />
          <circle cx="135" cy="115" r="3.5" fill="#0d766e" fillOpacity="0.4" />
          <circle cx="80" cy="135" r="4" fill="#0d766e" fillOpacity="0.4" />
          <circle cx="25" cy="115" r="3.5" fill="#0d766e" fillOpacity="0.4" />
        </svg>
      )}

      {/* Orbiting Satellite Node during Thinking State */}
      {state === 'thinking' && (
        <div
          className="vyasa-thinking-orbit"
          aria-hidden="true"
          style={{
            position: 'absolute',
            width: `${currentPx + 16}px`,
            height: `${currentPx + 16}px`,
            borderRadius: '50%',
            border: '1.5px dashed rgba(217, 119, 6, 0.45)',
            pointerEvents: 'none',
            zIndex: 0,
            top: '-4px',
            left: '-4px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-3.5px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#d97706',
              boxShadow: '0 0 6px rgba(217, 119, 6, 0.7)',
            }}
          />
        </div>
      )}

      {/* Main Sage Avatar Container with Dynamic Halo */}
      <div
        className={`vyasa-avatar-container ${haloClass}`}
        style={{
          width: `${currentPx + 8}px`,
          height: `${currentPx + 8}px`,
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          position: 'relative',
          zIndex: 1,
          boxSizing: 'border-box',
          padding: '4px',
        }}
      >
        <img
          src={vyasaAssistantLogo}
          alt={alt}
          style={{
            width: `${currentPx}px`,
            height: `${currentPx}px`,
            objectFit: 'contain',
            display: 'block',
            margin: '0 auto',
            borderRadius: '50%',
          }}
        />

        {/* Floating Soundwave Equalizer Badge for Speaking/Paused */}
        {(state === 'speaking' || state === 'paused' || showEqualizer) && (
          <div
            aria-label={state === 'speaking' ? 'Voice reading active' : 'Voice reading paused'}
            className={`vyasa-equalizer ${state === 'speaking' ? 'vyasa-equalizer--playing' : 'vyasa-equalizer--paused'}`}
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-6px',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              padding: '2px 5px',
              zIndex: 2,
            }}
          >
            <div className="vyasa-equalizer-bar bar-1" />
            <div className="vyasa-equalizer-bar bar-2" />
            <div className="vyasa-equalizer-bar bar-3" />
            <div className="vyasa-equalizer-bar bar-4" />
          </div>
        )}
      </div>

      {/* Optional Status Label below */}
      {statusText && (
        <span
          style={{
            marginTop: '8px',
            fontSize: '0.82rem',
            color: state === 'thinking' ? '#92400e' : '#475569',
            fontWeight: 500,
          }}
        >
          {statusText}
        </span>
      )}
    </div>
  );
};
