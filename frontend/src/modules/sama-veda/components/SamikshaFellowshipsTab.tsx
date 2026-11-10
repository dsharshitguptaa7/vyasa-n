import React from 'react';
import { EmptyState, SectionHeading, AppIcon } from '@vyasa/ui';
import { PublicFellowship } from '../services/samaVedaService';

interface SamikshaFellowshipsTabProps {
  fellowships: PublicFellowship[];
}

export const SamikshaFellowshipsTab: React.FC<SamikshaFellowshipsTabProps> = ({ fellowships }) => {
  const totalScholars = fellowships.reduce((acc, f) => acc + (f.active_scholars_count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <SectionHeading
        eyebrow="Doctoral Research Schemes"
        title="Active University Fellowships"
        description="Active doctoral scholar fellowships supported by government funding agencies and university fellowship schemes."
      />

      {fellowships.length > 0 && (
        <div
          style={{
            fontSize: '13.5px',
            color: '#475569',
            fontWeight: 600,
            background: '#ffffff',
            padding: '12px 18px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 6px rgba(15, 43, 72, 0.02)',
          }}
        >
          <AppIcon name="graduation-cap" size={16} color="#0d766e" />
          <span>
            Cumulative cohort: <strong style={{ color: '#0d766e' }}>{totalScholars} active scholars</strong> across {fellowships.length} institutional schemes
          </span>
        </div>
      )}

      {fellowships.length === 0 ? (
        <EmptyState
          title="No Fellowship Schemes Recorded"
          description="Fellowship telemetry will be displayed here."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '22px' }}>
          {fellowships.map((f) => (
            <div
              key={f.id}
              className="samiksha-card samiksha-interactive-lift"
              style={{
                textAlign: 'center',
                padding: '32px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    color: '#b2811a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    background: '#fcf7eb',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    display: 'inline-block',
                    border: '1px solid #ecdfba',
                  }}
                >
                  {f.scheme_code || 'Scheme Code'}
                </div>
                <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#0f2b48', margin: '14px 0 0 0', lineHeight: 1.35 }}>
                  {f.scheme_name}
                </h3>
              </div>

              <div>
                <div
                  style={{
                    fontSize: '44px',
                    fontWeight: 900,
                    color: '#0d766e',
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {f.active_scholars_count}
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>
                  Active Doctoral Scholars
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
