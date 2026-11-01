import React, { useState, useMemo } from 'react';
import { Badge, Button, EmptyState, SectionHeading, Input } from '@vyasa/ui';
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
  const [searchQuery, setSearchQuery] = useState('');

  // Total metrics across all bulletins
  const totalPublicationsInBulletins = useMemo(() => {
    return bulletins.reduce((acc, b) => acc + (b.publication_count || 0), 0);
  }, [bulletins]);

  // Filter bulletins by search query (volume, issue, title, or period)
  const filteredBulletins = useMemo(() => {
    if (!searchQuery.trim()) return bulletins;
    const q = searchQuery.toLowerCase().trim();
    return bulletins.filter((b) => {
      const titleMatch = b.title?.toLowerCase().includes(q);
      const periodMatch = b.publication_period?.toLowerCase().includes(q);
      const volMatch = `volume ${b.volume_number}`.includes(q) || `vol ${b.volume_number}`.includes(q);
      const issueMatch = `issue ${b.issue_number}`.includes(q);
      return titleMatch || periodMatch || volMatch || issueMatch;
    });
  }, [bulletins, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Institutional Heading */}
      <SectionHeading
        eyebrow="Institutional Publications"
        title="CSJMU Research Bulletins"
        description="Official periodic research bulletin volumes celebrating scholarly publications, patents, and faculty intellectual output."
      />

      {/* Overview Stats & Search Bar */}
      {bulletins.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            padding: '16px 22px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Quick Stats Pill Strip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1d4ed8',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
                  Published Editions
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f2b48' }}>
                  {bulletins.length} {bulletins.length === 1 ? 'Volume' : 'Volumes'}
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '32px', background: '#cbd5e1' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#f0fdfa',
                  border: '1px solid #ccfbf1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0d766e',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
                  Documented Works
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0d766e' }}>
                  {totalPublicationsInBulletins} Publications
                </div>
              </div>
            </div>
          </div>

          {/* Quick Filter Search Input */}
          {bulletins.length > 2 && (
            <div style={{ minWidth: '240px', maxWidth: '340px', flex: 1 }}>
              <Input
                placeholder="Search volumes or periods..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter bulletin volumes"
              />
            </div>
          )}
        </div>
      )}

      {/* Bulletin Catalog */}
      {bulletins.length === 0 ? (
        <EmptyState
          title="No Research Bulletins Published"
          description="Bulletins will appear here once officially published by the Directorate of Research."
        />
      ) : filteredBulletins.length === 0 ? (
        <EmptyState
          title="No Matching Bulletin Found"
          description={`No bulletin volumes match "${searchQuery}". Try searching for another period or volume number.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
              Clear Search
            </Button>
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '24px',
          }}
        >
          {filteredBulletins.map((b) => {
            const fileSizeMb = (b.file_size_bytes / (1024 * 1024)).toFixed(1);
            const isDownloading = downloadingId === b.id;

            return (
              <div
                key={b.id}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 16px rgba(15, 43, 72, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  overflow: 'hidden',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = '0 12px 28px -4px rgba(15, 43, 72, 0.1), 0 6px 12px -2px rgba(15, 43, 72, 0.04)';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(15, 43, 72, 0.05)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                {/* Scholarly Top Header Accent Banner */}
                <div
                  style={{
                    height: '5px',
                    background: 'linear-gradient(90deg, #0d766e 0%, #0f2b48 100%)',
                    width: '100%',
                  }}
                />

                <div style={{ padding: '24px 24px 20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {/* Top Bar: Volume Badge + File Tag */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Badge variant="teal">
                      Volume {b.volume_number} • Issue {b.issue_number}
                    </Badge>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: '#f1f5f9',
                        padding: '4px 9px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#475569',
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>PDF • {fileSizeMb} MB</span>
                    </div>
                  </div>

                  {/* Header Title Section */}
                  <div>
                    <h3
                      style={{
                        fontSize: '19px',
                        fontWeight: 800,
                        color: '#0f2b48',
                        margin: '0 0 6px 0',
                        lineHeight: 1.35,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {b.title}
                    </h3>

                    {/* Publication Period with Calendar Icon */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '13px',
                        color: '#64748b',
                        marginTop: '4px',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      <span>
                        <strong style={{ color: '#475569' }}>Period:</strong> {b.publication_period}
                      </span>
                    </div>
                  </div>

                  {/* Publications Highlight Box */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%)',
                      border: '1px solid #ccfbf1',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0d766e',
                          boxShadow: '0 1px 3px rgba(13, 118, 110, 0.1)',
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0d766e', fontWeight: 700 }}>
                          Scholarly Records
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48' }}>
                          Included Publications
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#0d766e' }}>
                      {b.publication_count}
                    </div>
                  </div>

                  {/* Institutional Authenticity Badge (Clean verification without raw hashes) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      fontSize: '12px',
                      color: '#475569',
                      padding: '8px 12px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <span>
                      Official Archival Release &bull; Directorate of Research
                    </span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  style={{
                    padding: '0 24px 22px 24px',
                  }}
                >
                  <Button
                    variant="primary"
                    onClick={() => onDownloadBulletin(b)}
                    disabled={isDownloading}
                    aria-label={`Download ${b.title}`}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '11px 18px',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {isDownloading ? (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          style={{
                            animation: 'spin 1s linear infinite',
                          }}
                        >
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                        </svg>
                        <span>Preparing Download...</span>
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span>Download Bulletin PDF ({fileSizeMb} MB)</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
