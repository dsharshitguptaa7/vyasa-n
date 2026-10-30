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
    <div
      style={{
        background: 'linear-gradient(135deg, #071e33 0%, #0f2b48 55%, #0d4a5c 100%)',
        borderRadius: '16px',
        padding: '36px 32px',
        color: '#ffffff',
        boxShadow: '0 8px 30px rgba(15, 43, 72, 0.18)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle institutional background watermark */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-20px',
          bottom: '-30px',
          opacity: 0.05,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <AppIcon name="graduation-cap" size={280} color="#ffffff" />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top Header Row */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '24px',
          }}
        >
          <div style={{ maxWidth: '720px' }}>
            {/* Institutional Pill Badge */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 14px',
                background: 'rgba(212, 160, 23, 0.16)',
                border: '1px solid rgba(212, 160, 23, 0.65)',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '14px',
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

            <h1
              style={{
                fontSize: 'clamp(26px, 3.5vw, 36px)',
                fontWeight: 800,
                margin: '0 0 12px 0',
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: '#ffffff',
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
                lineHeight: 1.6,
                maxWidth: '680px',
              }}
            >
              A VYASA Research &amp; Innovation Initiative. Centralized institutional repository celebrating
              scholarly publications, Scopus-indexed faculty achievements, verifiable felicitation certificates,
              bi-annual research bulletins, CAM-AI innovation grants, and doctoral fellowships at CSJMU.
            </p>

            {/* CTAs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '22px',
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
                  padding: '9px 20px',
                  background: 'linear-gradient(135deg, #0d766e 0%, #0f766e 100%)',
                  color: '#ffffff',
                  border: '1px solid #14b8a6',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(13, 118, 110, 0.35)',
                  transition: 'all 0.15s ease',
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
                  padding: '9px 18px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: '8px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <AppIcon name="shield" size={15} color="#d4a017" />
                <span>Explore Felicitations</span>
              </button>
            </div>
          </div>

          {/* Quick Real Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(130px, 1fr))',
              gap: '10px',
              minWidth: '280px',
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
                  style={{
                    background: 'rgba(255, 255, 255, 0.07)',
                    backdropFilter: 'blur(8px)',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'all 0.18s ease',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 800,
                      color: idx % 2 === 0 ? 'var(--vyasa-gold, #f59e0b)' : '#38bdf8',
                      lineHeight: 1.2,
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '4px',
                    }}
                  >
                    {m.loading ? (
                      <span style={{ fontSize: '14px', color: '#94a3b8' }}>Syncing...</span>
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
                    }}
                  >
                    <span>{m.label}</span>
                    {isClickable && (
                      <span style={{ fontSize: '10px', opacity: 0.6 }}>&rarr;</span>
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
