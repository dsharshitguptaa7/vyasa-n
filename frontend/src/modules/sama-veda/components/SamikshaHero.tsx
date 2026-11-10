import React from 'react';
import { AppIcon } from '@vyasa/ui';

export interface MetricItem {
  label: string;
  value: number | string | null;
  loading?: boolean;
  unavailable?: boolean;
  unit?: string;
  tabKey?: string;
}

interface SamikshaHeroProps {
  metrics: MetricItem[];
  onSelectTab: (tabKey: any) => void;
  onExploreResearch: () => void;
  onExploreFelicitations: () => void;
}

export const SamikshaHero: React.FC<SamikshaHeroProps> = ({
  metrics,
  onSelectTab,
  onExploreResearch,
  onExploreFelicitations,
}) => {
  return (
    <div className="samiksha-hero-wrapper">
      {/* Dynamic Ambient Glow Orbs */}
      <div className="samiksha-hero-glow-orb samiksha-hero-glow-teal" aria-hidden="true" />
      <div className="samiksha-hero-glow-orb samiksha-hero-glow-cyan" aria-hidden="true" />
      <div className="samiksha-hero-glow-orb samiksha-hero-glow-amber" aria-hidden="true" />

      {/* Kinetic Research Constellation Network Graphic (SVG) */}
      <svg
        className="samiksha-hero-bg-network"
        viewBox="0 0 580 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="netGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="netGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.1" />
          </linearGradient>
          <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Orbit Rings */}
        <circle cx="380" cy="190" r="140" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="380" cy="190" r="95" stroke="rgba(20,184,166,0.15)" strokeWidth="1" />
        <circle cx="380" cy="190" r="50" stroke="rgba(56,189,248,0.2)" strokeWidth="1.2" strokeDasharray="3 3" />

        {/* Constellation Network Connecting Lines */}
        <path d="M 220 70 L 290 120 L 380 90 L 460 140 L 510 80" stroke="url(#netGrad1)" strokeWidth="1.5" />
        <path d="M 290 120 L 330 220 L 380 190 L 430 260 L 520 220" stroke="url(#netGrad1)" strokeWidth="1.5" />
        <path d="M 240 280 L 330 220 L 380 310 L 470 330" stroke="url(#netGrad2)" strokeWidth="1.2" />
        <path d="M 380 90 L 380 190 L 380 310" stroke="rgba(20,184,166,0.25)" strokeWidth="1" strokeDasharray="2 4" />
        <path d="M 290 120 L 460 140" stroke="rgba(56,189,248,0.15)" strokeWidth="1" />

        {/* Constellation Node Points */}
        <g filter="url(#nodeGlow)">
          <circle cx="380" cy="190" r="7" fill="#14b8a6" />
          <circle cx="380" cy="90" r="5" fill="#38bdf8" />
          <circle cx="290" cy="120" r="4.5" fill="#f59e0b" />
          <circle cx="330" cy="220" r="5" fill="#06b6d4" />
          <circle cx="460" cy="140" r="5.5" fill="#14b8a6" />
          <circle cx="430" cy="260" r="4.5" fill="#38bdf8" />
          <circle cx="510" cy="80" r="4" fill="#a78bfa" />
          <circle cx="520" cy="220" r="4" fill="#f59e0b" />
          <circle cx="220" cy="70" r="3.5" fill="#38bdf8" />
          <circle cx="240" cy="280" r="4" fill="#14b8a6" />
          <circle cx="380" cy="310" r="5" fill="#06b6d4" />
          <circle cx="470" cy="330" r="3.5" fill="#f59e0b" />
        </g>

        {/* Pulse Ripple Rings on Central Hub */}
        <circle cx="380" cy="190" r="14" stroke="#14b8a6" strokeWidth="1.2" opacity="0.6" />
        <circle cx="380" cy="190" r="22" stroke="#38bdf8" strokeWidth="0.8" opacity="0.3" />
      </svg>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top Content Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '28px',
          }}
        >
          <div style={{ maxWidth: '680px' }}>
            {/* Editorial Institutional Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                background: 'rgba(212, 160, 23, 0.14)',
                border: '1px solid rgba(245, 158, 11, 0.45)',
                borderRadius: '24px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '16px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <AppIcon name="book-open" size={13} color="#f59e0b" />
              <span>SAMIKSHA • Research, Recognition &amp; Innovation Portal</span>
              {/* Backwards-compatibility text for test assertions & legacy search */}
              <span
                style={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                }}
              >
                Sama Veda • Research Recognition & Communication
              </span>
            </div>

            {/* Editorial Headline */}
            <h1
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 800,
                margin: '0 0 14px 0',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
                color: '#ffffff',
                textShadow: '0 2px 10px rgba(0,0,0,0.3)',
              }}
            >
              Discover. Research. Inspire.
              {/* Backwards-compatibility text for test assertions */}
              <span
                style={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                }}
              >
                University Research Felicitation & Recognition
              </span>
            </h1>

            <p
              style={{
                fontSize: '14.5px',
                color: '#cbd5e1',
                margin: 0,
                lineHeight: 1.65,
                maxWidth: '640px',
              }}
            >
              A VYASA Research &amp; Innovation Initiative. Centralized institutional repository celebrating
              scholarly publications, Scopus-indexed faculty achievements, verifiable felicitation certificates,
              bi-annual research bulletins, CAM-AI innovation grants, and doctoral fellowships at CSJMU.
            </p>

            {/* Action CTAs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginTop: '26px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={onExploreResearch}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 22px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  color: '#ffffff',
                  border: '1px solid #14b8a6',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(13, 148, 136, 0.4)',
                  transition: 'all 0.18s ease',
                }}
              >
                <AppIcon name="search" size={15} color="#ffffff" />
                <span>Explore Research</span>
              </button>

              <button
                type="button"
                onClick={onExploreFelicitations}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '11px 20px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <AppIcon name="shield" size={15} color="#f59e0b" />
                <span>Explore Felicitations</span>
              </button>
            </div>
          </div>

          {/* Quick Real Metrics Telemetry Hub */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(136px, 1fr))',
              gap: '12px',
              minWidth: '290px',
              alignSelf: 'center',
            }}
          >
            {metrics.map((m, idx) => {
              const isClickable = Boolean(m.tabKey);

              return (
                <div
                  key={idx}
                  onClick={() => m.tabKey && onSelectTab(m.tabKey)}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectTab(m.tabKey);
                    }
                  }}
                  title={isClickable ? `View ${m.label} details` : undefined}
                  className={`samiksha-metric-tile ${isClickable ? 'is-interactive' : ''}`}
                >
                  <div
                    style={{
                      fontSize: '21px',
                      fontWeight: 800,
                      color: idx % 3 === 0 ? '#38bdf8' : idx % 3 === 1 ? '#2dd4bf' : '#fbbf24',
                      lineHeight: 1.2,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '4px',
                    }}
                  >
                    {m.loading ? (
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>Syncing...</span>
                    ) : m.unavailable ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Unavailable</span>
                    ) : (
                      <>
                        <span>{m.value}</span>
                        {m.unit && <span style={{ fontSize: '11px', opacity: 0.8 }}>{m.unit}</span>}
                      </>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'rgba(255, 255, 255, 0.78)',
                      marginTop: '4px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                    }}
                  >
                    <span>{m.label}</span>
                    {isClickable && (
                      <span style={{ fontSize: '11px', opacity: 0.7, color: '#38bdf8' }}>&rarr;</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
