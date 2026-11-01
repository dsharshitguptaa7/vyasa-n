import React from 'react';
import { Badge, Button, EmptyState, SectionHeading } from '@vyasa/ui';
import { PublicBulletin } from '../services/samaVedaService';

interface SamikshaBulletinsTabProps {
  bulletins: PublicBulletin[];
  onDownloadBulletin: (bulletin: PublicBulletin) => void;
  downloadingId?: string | null;
}

export const SamikshaBulletinsTab: React.FC<SamikshaBulletinsTabProps> = ({
  bulletins,
  onDownloadBulletin,
  downloadingId,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeading
        eyebrow="Institutional Publications"
        title="CSJMU Research Bulletins"
        description="Official periodic research bulletin volumes celebrating scholarly publications and intellectual property."
      />

      {bulletins.length === 0 ? (
        <EmptyState
          title="No Research Bulletins Published"
          description="Bulletins will appear here once officially published by the Directorate of Research."
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {bulletins.map((b) => {
            const fileSizeMb = (b.file_size_bytes / (1024 * 1024)).toFixed(1);
            const isDownloading = downloadingId === b.id;

            return (
              <div
                key={b.id}
                style={{
                  background: '#ffffff',
                  padding: '26px',
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '18px',
                  boxShadow: '0 2px 10px rgba(15, 43, 72, 0.04)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <Badge variant="teal">Volume {b.volume_number} • Issue {b.issue_number}</Badge>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>{fileSizeMb} MB</span>
                  </div>

                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f2b48', margin: '8px 0 6px 0', lineHeight: 1.35 }}>
                    {b.title}
                  </h3>

                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    <strong>Period:</strong> {b.publication_period}
                  </div>

                  <div style={{ fontSize: '13.5px', color: '#0d766e', fontWeight: 700, marginTop: '8px' }}>
                    {b.publication_count} Publications Included
                  </div>

                  {b.checksum_sha256 && (
                    <div
                      style={{
                        marginTop: '12px',
                        fontSize: '11px',
                        color: '#64748b',
                        fontFamily: 'monospace',
                        background: '#f8fafc',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        wordBreak: 'break-all',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>SHA-256:</span> {b.checksum_sha256.substring(0, 24)}...
                    </div>
                  )}
                </div>

                <Button
                  variant="primary"
                  onClick={() => onDownloadBulletin(b)}
                  disabled={isDownloading}
                  aria-label={`Download ${b.title}`}
                >
                  {isDownloading ? 'Preparing Download...' : 'Download Bulletin PDF \u2193'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
