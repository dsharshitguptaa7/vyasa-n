import React from 'react';
import { EmptyState, SectionHeading } from '@vyasa/ui';
import { PublicFellowship } from '../services/samaVedaService';

interface SamikshaFellowshipsTabProps {
  fellowships: PublicFellowship[];
}

export const SamikshaFellowshipsTab: React.FC<SamikshaFellowshipsTabProps> = ({ fellowships }) => {
  const totalScholars = fellowships.reduce((acc, f) => acc + (f.active_scholars_count || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeading
        eyebrow="Doctoral Research Schemes"
        title="Active University Fellowships"
        description="Active doctoral scholar fellowships supported by government funding agencies and university fellowship schemes."
      />

      {fellowships.length > 0 && (
        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
          Cumulative cohort: <strong style={{ color: '#0d766e' }}>{totalScholars} active scholars</strong> across {fellowships.length} institutional schemes
        </div>
      )}

      {fellowships.length === 0 ? (
        <EmptyState
          title="No Fellowship Schemes Recorded"
          description="Fellowship telemetry will be displayed here."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
          {fellowships.map((f) => (
            <div
              key={f.id}
              style={{
                background: '#ffffff',
                padding: '28px 24px',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(15, 43, 72, 0.03)',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#b2811a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {f.scheme_code || 'Scheme Code'}
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48', margin: '8px 0', lineHeight: 1.3 }}>
                {f.scheme_name}
              </h3>
              <div style={{ fontSize: '38px', fontWeight: 800, color: '#0d766e', marginTop: '14px' }}>
                {f.active_scholars_count}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', fontWeight: 500 }}>
                Active Doctoral Scholars
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
