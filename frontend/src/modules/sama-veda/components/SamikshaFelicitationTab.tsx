import React, { useState, useMemo } from 'react';
import { Badge, Button, Input, Select, EmptyState, AppIcon, SectionHeading } from '@vyasa/ui';
import {
  CertificateVerificationResult,
  PublicPublication,
  PublicBulletin,
  PublicAuthor,
} from '../services/samaVedaService';

interface SamikshaFelicitationTabProps {
  // Verification states
  certQuery: string;
  onCertQueryChange: (val: string) => void;
  onVerifyCertificate: (e: React.FormEvent) => void;
  certLoading: boolean;
  certError: string | null;
  certResult: CertificateVerificationResult | null;
  onDownloadCertificate: () => void;
  // Recognition records (publications awarded felicitation in bulletins)
  publications: PublicPublication[];
  totalPublications: number;
  bulletins: PublicBulletin[];
  authors: PublicAuthor[];
}

export const SamikshaFelicitationTab: React.FC<SamikshaFelicitationTabProps> = ({
  certQuery,
  onCertQueryChange,
  onVerifyCertificate,
  certLoading,
  certError,
  certResult,
  onDownloadCertificate,
  publications,
  totalPublications,
  bulletins,
  authors,
}) => {
  // Search & Filtering for Recognition Gallery
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCategory, setGalleryCategory] = useState('');
  const [gallerySort, setGallerySort] = useState<'newest' | 'oldest'>('newest');

  // Detail Modal State
  const [selectedRecord, setSelectedRecord] = useState<PublicPublication | null>(null);

  // Filtered & Sorted Recognition Gallery
  const filteredGallery = useMemo(() => {
    let result = [...publications];

    if (gallerySearch.trim()) {
      const q = gallerySearch.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.author_display?.toLowerCase().includes(q) ||
          p.source_journal?.toLowerCase().includes(q) ||
          p.doi?.toLowerCase().includes(q)
      );
    }

    if (galleryCategory) {
      result = result.filter((p) => p.category?.toLowerCase() === galleryCategory.toLowerCase());
    }

    result.sort((a, b) => {
      const dateA = new Date(a.published_at || a.created_at).getTime() || 0;
      const dateB = new Date(b.published_at || b.created_at).getTime() || 0;
      return gallerySort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [publications, gallerySearch, galleryCategory, gallerySort]);

  // Unique categories for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    publications.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [publications]);

  const verifiedAuthorsCount = authors.filter((a) => a.is_verified).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* 1. Official Institutional Recognition Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #091e33 0%, #0f2b48 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#ffffff',
          boxShadow: '0 4px 16px rgba(15, 43, 72, 0.12)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                background: 'rgba(212, 160, 23, 0.2)',
                border: '1px solid #d4a017',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#f59e0b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '10px',
              }}
            >
              <AppIcon name="shield" size={13} color="#f59e0b" />
              <span>Official Institutional Recognition</span>
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#ffffff' }}>
              Research Recognition &amp; Felicitations
            </h2>
            <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0, lineHeight: 1.5, maxWidth: '640px' }}>
              Recognising scholarly contributions, research achievements, and academic excellence across all university faculties.
            </p>
          </div>

          {/* Institutional Verified Badges */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--vyasa-gold, #f59e0b)' }}>
                {totalPublications > 0 ? totalPublications : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Felicitated Works</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8' }}>
                {verifiedAuthorsCount > 0 ? verifiedAuthorsCount : authors.length > 0 ? authors.length : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Recognized Faculty</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                padding: '12px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#4ade80' }}>
                {bulletins.length > 0 ? bulletins.length : '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Official Bulletins</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Certificate Verification Section */}
      <div
        id="certificate-verification"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '28px',
          boxShadow: '0 4px 16px rgba(15, 43, 72, 0.04)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <SectionHeading
            align="center"
            eyebrow="Cryptographic Verification"
            title="Verify Felicitation Certificate"
            description="Enter the certificate registration number printed on your official CSJMU Felicitation Certificate."
          />
        </div>

        <form
          onSubmit={onVerifyCertificate}
          style={{
            display: 'flex',
            gap: '12px',
            background: '#f8fafc',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            maxWidth: '720px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          <div style={{ flex: 1 }}>
            <Input
              placeholder="Enter Certificate Number (e.g. CERTIFICATES FINAL-1, 01-01)..."
              value={certQuery}
              onChange={(e) => onCertQueryChange(e.target.value)}
              aria-label="Certificate Registration Number"
            />
          </div>
          <Button variant="primary" type="submit" disabled={certLoading || !certQuery.trim()}>
            {certLoading ? 'Verifying...' : 'Verify Authenticity'}
          </Button>
        </form>

        {certError && (
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              width: '100%',
              padding: '16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AppIcon name="alert-circle" size={18} color="#991b1b" />
            <div>
              <strong>Verification Result:</strong> {certError}
            </div>
          </div>
        )}

        {certResult && (
          <div
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              width: '100%',
              background: '#ffffff',
              border: `2px solid ${certResult.is_revoked ? '#ef4444' : '#10b981'}`,
              borderRadius: '16px',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                  Certificate Registration Number
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48', fontFamily: 'monospace', marginTop: '2px' }}>
                  {certResult.certificate_number}
                </div>
              </div>
              <Badge variant={certResult.is_revoked ? 'saffron' : 'teal'}>
                {certResult.is_revoked ? 'REVOKED' : 'VALID & AUTHENTIC'}
              </Badge>
            </div>

            {certResult.is_revoked ? (
              <div
                style={{
                  padding: '14px 18px',
                  background: '#fef2f2',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  color: '#991b1b',
                  fontSize: '13px',
                  lineHeight: 1.5,
                }}
              >
                <strong>Revocation Notice:</strong> This certificate was officially revoked on{' '}
                {certResult.revoked_at ? new Date(certResult.revoked_at).toLocaleDateString() : 'record'}.
                Reason: {certResult.revocation_reason || 'Administrative notice'}.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: '#334155' }}>
                {certResult.author && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Awarded Researcher:</strong>
                    <span>
                      {certResult.author.full_name} ({certResult.author.department || 'CSJMU'})
                    </span>
                  </div>
                )}
                {certResult.publication && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Research Publication:</strong>
                    <span>{certResult.publication.title}</span>
                  </div>
                )}
                {certResult.bulletin && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Bulletin Edition:</strong>
                    <span>
                      {certResult.bulletin.title} ({certResult.bulletin.publication_period})
                    </span>
                  </div>
                )}
                {certResult.issued_at && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <strong style={{ color: '#0f2b48', minWidth: '150px' }}>Date of Issuance:</strong>
                    <span>{new Date(certResult.issued_at).toLocaleDateString()}</span>
                  </div>
                )}

                <div
                  style={{
                    wordBreak: 'break-all',
                    fontSize: '11px',
                    color: '#64748b',
                    fontFamily: 'monospace',
                    background: '#f8fafc',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    marginTop: '4px',
                  }}
                >
                  <strong>SHA-256 Digest:</strong> {certResult.sha256_checksum}
                </div>

                {certResult.is_download_allowed && (
                  <div style={{ paddingTop: '8px' }}>
                    <Button variant="teal" onClick={onDownloadCertificate}>
                      Download Certificate Copy &darr;
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Felicitation Recognition Gallery */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: '#0d766e',
                letterSpacing: '0.08em',
                marginBottom: '4px',
              }}
            >
              Institutional Honor Roll
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48', margin: 0 }}>
              Recognised Research Contributions Gallery
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Scholarly achievements felicitated by the Directorate of Research and documented in University Bulletins.
            </p>
          </div>

          {/* Gallery Search & Filter Bar */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ width: '240px' }}>
              <Input
                placeholder="Search recognized authors or titles..."
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
              />
            </div>
            {categories.length > 0 && (
              <div style={{ width: '160px' }}>
                <Select
                  value={galleryCategory}
                  onChange={(e) => setGalleryCategory(e.target.value)}
                  options={[
                    { label: 'All Categories', value: '' },
                    ...categories.map((c) => ({ label: c, value: c })),
                  ]}
                />
              </div>
            )}
            <div style={{ width: '130px' }}>
              <Select
                value={gallerySort}
                onChange={(e) => setGallerySort(e.target.value as 'newest' | 'oldest')}
                options={[
                  { label: 'Newest First', value: 'newest' },
                  { label: 'Oldest First', value: 'oldest' },
                ]}
              />
            </div>
            {(gallerySearch || galleryCategory) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setGallerySearch('');
                  setGalleryCategory('');
                }}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Gallery Cards */}
        {filteredGallery.length === 0 ? (
          <EmptyState
            title="No Matching Recognition Records"
            description="No felicitation records match the specified search or category criteria. Try adjusting your filters."
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px',
            }}
          >
            {filteredGallery.map((pub) => {
              const pubDate = pub.published_at || pub.created_at;
              const formattedDate = pubDate ? new Date(pubDate).toLocaleDateString() : null;

              return (
                <div
                  key={pub.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px',
                    boxShadow: '0 2px 8px rgba(15, 43, 72, 0.04)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Badge variant="teal">{pub.category || 'Research Work'}</Badge>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                        {formattedDate || 'Felicitated'}
                      </span>
                    </div>

                    <h4
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#0f2b48',
                        margin: '4px 0 0 0',
                        lineHeight: 1.4,
                      }}
                    >
                      {pub.title}
                    </h4>

                    <div style={{ fontSize: '13px', color: '#0d766e', fontWeight: 600 }}>
                      {pub.author_display}
                    </div>

                    <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                      {pub.source_journal}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '10px',
                      borderTop: '1px solid #f1f5f9',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(pub)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0d766e',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      View Details &rarr;
                    </button>

                    {pub.doi && (
                      <a
                        href={`https://doi.org/${pub.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '11.5px',
                          color: '#b2811a',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        DOI &nearr;
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Felicitation Detail Modal */}
      {selectedRecord && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="felicitation-detail-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 43, 72, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '32px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <Badge variant="teal">{selectedRecord.category || 'Article'}</Badge>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  Institutional Felicitation Record #{selectedRecord.serial_no}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '22px',
                  lineHeight: 1,
                  color: '#64748b',
                  cursor: 'pointer',
                }}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>

            <h3
              id="felicitation-detail-title"
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#0f2b48',
                margin: '0 0 12px 0',
                lineHeight: 1.35,
              }}
            >
              {selectedRecord.title}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#334155' }}>
              <div>
                <strong>Awarded Author(s):</strong> {selectedRecord.author_display}
              </div>
              {selectedRecord.author_links && selectedRecord.author_links.length > 0 && (
                <div>
                  <strong>Institutional Affiliation:</strong>{' '}
                  {selectedRecord.author_links.map((al) => `${al.author_name || 'Scholar'} (${al.department || 'CSJMU'})`).join(', ')}
                </div>
              )}
              <div>
                <strong>Indexed Journal:</strong> {selectedRecord.source_journal}
              </div>
              {selectedRecord.doi && (
                <div>
                  <strong>DOI:</strong>{' '}
                  <a
                    href={`https://doi.org/${selectedRecord.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#0d766e', fontWeight: 600 }}
                  >
                    {selectedRecord.doi}
                  </a>
                </div>
              )}
              {selectedRecord.published_at && (
                <div>
                  <strong>Felicitation Date:</strong> {new Date(selectedRecord.published_at).toLocaleDateString()}
                </div>
              )}
              {selectedRecord.abstract && (
                <div style={{ marginTop: '8px' }}>
                  <strong>Abstract:</strong>
                  <p style={{ margin: '4px 0 0 0', lineHeight: 1.6, color: '#64748b' }}>
                    {selectedRecord.abstract}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Verify Certificate Prompt */}
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f2b48' }}>
                  Hold a printed certificate for this research?
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Verify the printed certificate number using the official cryptographic validator above.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedRecord(null);
                  const el = document.getElementById('certificate-verification');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Verify in Tool &uarr;
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
