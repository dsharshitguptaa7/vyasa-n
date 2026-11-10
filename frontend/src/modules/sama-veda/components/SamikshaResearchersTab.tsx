import React, { useState, useMemo } from 'react';
import { Badge, Button, Input, Select, EmptyState, AppIcon } from '@vyasa/ui';
import { PublicAuthor, PublicPublication } from '../services/samaVedaService';

interface SamikshaResearchersTabProps {
  authors: PublicAuthor[];
  totalAuthors: number;
  authorSearch: string;
  onAuthorSearchChange: (val: string) => void;
  publications?: PublicPublication[];
  onSelectAuthorPublications?: (authorName: string) => void;
  onSelectAuthorCertificates?: (authorName: string) => void;
}

export const SamikshaResearchersTab: React.FC<SamikshaResearchersTabProps> = ({
  authors,
  totalAuthors,
  authorSearch,
  onAuthorSearchChange,
  publications = [],
  onSelectAuthorPublications,
  onSelectAuthorCertificates,
}) => {
  const [selectedDept, setSelectedDept] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'provisional'>('all');

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    authors.forEach((a) => {
      if (a.department?.trim()) set.add(a.department.trim());
    });
    return Array.from(set).sort();
  }, [authors]);

  // Derive publication counts map if available
  const authorPubCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pub of publications) {
      if (pub.author_links) {
        for (const link of pub.author_links) {
          if (link.author_id) {
            counts[link.author_id] = (counts[link.author_id] || 0) + 1;
          }
          if (link.author_name) {
            counts[link.author_name.toLowerCase()] = (counts[link.author_name.toLowerCase()] || 0) + 1;
          }
        }
      }
    }
    return counts;
  }, [publications]);

  // Filtered Authors
  const filteredAuthors = useMemo(() => {
    return authors.filter((a) => {
      if (selectedDept && a.department?.toLowerCase() !== selectedDept.toLowerCase()) {
        return false;
      }
      if (verificationFilter === 'verified' && !a.is_verified) {
        return false;
      }
      if (verificationFilter === 'provisional' && a.is_verified) {
        return false;
      }
      return true;
    });
  }, [authors, selectedDept, verificationFilter]);

  const verifiedCount = authors.filter((a) => a.is_verified).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header Summary */}
      <div
        style={{
          background: 'linear-gradient(135deg, #061325 0%, #0a1f3d 60%, #0d3852 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 8px 24px -4px rgba(6, 19, 37, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#38bdf8',
              letterSpacing: '0.08em',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="users" size={13} color="#38bdf8" />
            <span>Academic Directory</span>
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
            Faculty &amp; Scholar Directory
          </h2>
          <p style={{ fontSize: '14px', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.5 }}>
            Official register of university researchers, faculty investigators, and Scopus-indexed authors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              textAlign: 'center',
              minWidth: '110px',
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8' }}>{totalAuthors}</div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Total Researchers</div>
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(8px)',
              padding: '12px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              textAlign: 'center',
              minWidth: '110px',
            }}
          >
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#2dd4bf' }}>
              {verifiedCount}
            </div>
            <div style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>Verified Faculty</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="samiksha-filter-bar">
        <div style={{ flex: 1, minWidth: '260px' }}>
          <Input
            placeholder="Search researchers by name, department, or Scopus ID..."
            value={authorSearch}
            onChange={(e) => onAuthorSearchChange(e.target.value)}
            aria-label="Search researchers"
          />
        </div>

        {departments.length > 0 && (
          <div style={{ width: '220px' }}>
            <Select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              options={[
                { label: 'All Departments', value: '' },
                ...departments.map((d) => ({ label: d, value: d })),
              ]}
              aria-label="Filter by department"
            />
          </div>
        )}

        <div style={{ width: '160px' }}>
          <Select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value as any)}
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Verified Only', value: 'verified' },
              { label: 'Provisional Only', value: 'provisional' },
            ]}
            aria-label="Filter by verification status"
          />
        </div>

        {(authorSearch || selectedDept || verificationFilter !== 'all') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onAuthorSearchChange('');
              setSelectedDept('');
              setVerificationFilter('all');
            }}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* Counter */}
      <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
        Showing {filteredAuthors.length} of {totalAuthors} faculty researchers
      </div>

      {/* Directory Grid */}
      {filteredAuthors.length === 0 ? (
        <EmptyState
          title="No Researchers Found"
          description="Researcher profiles will appear here as publications and institutional Scopus IDs are linked. Try resetting search filters."
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredAuthors.map((auth) => {
            const pubCount = authorPubCounts[auth.id] || authorPubCounts[auth.full_name?.toLowerCase()] || 0;
            const initials = auth.full_name
              ? auth.full_name
                  .replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s*/i, '')
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              : 'RS';

            return (
              <div
                key={auth.id}
                className="samiksha-card samiksha-interactive-lift"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  padding: '24px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: auth.is_verified
                            ? 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)'
                            : 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '14px',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div>
                        <h3
                          style={{
                            fontSize: '16.5px',
                            fontWeight: 700,
                            color: '#0f2b48',
                            margin: 0,
                            lineHeight: 1.3,
                          }}
                        >
                          {auth.full_name}
                        </h3>
                        <div style={{ fontSize: '12.5px', color: '#0d766e', fontWeight: 600, marginTop: '2px' }}>
                          {auth.department || 'Department of Research & Development'}
                        </div>
                      </div>
                    </div>
                    {auth.is_verified ? (
                      <Badge variant="teal">Verified</Badge>
                    ) : (
                      <Badge variant="neutral">Provisional</Badge>
                    )}
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', paddingLeft: '54px' }}>
                    {auth.institutional_affiliation || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                  </div>

                  {auth.scopus_id && (
                    <div style={{ paddingLeft: '54px', marginTop: '10px' }}>
                      <a
                        href={`https://www.scopus.com/authid/detail.uri?authorId=${auth.scopus_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '11.5px',
                          color: '#0d766e',
                          fontFamily: 'monospace',
                          background: '#f0fdfa',
                          border: '1px solid #99f6e4',
                          padding: '4px 9px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                        title="View Scopus Author Profile"
                      >
                        <span>Scopus ID: {auth.scopus_id} &nearr;</span>
                      </a>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '12.5px',
                  }}
                >
                  <span style={{ color: '#64748b' }}>
                    {pubCount > 0 ? (
                      <strong style={{ color: '#0f2b48' }}>{pubCount} Felicitated Works</strong>
                    ) : (
                      'Affiliated Scholar'
                    )}
                  </span>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {onSelectAuthorCertificates && (
                      <button
                        type="button"
                        onClick={() => onSelectAuthorCertificates(auth.full_name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#b45309',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '12px',
                        }}
                        title="Search Certificates for this author"
                      >
                        Certificates &rarr;
                      </button>
                    )}
                    {onSelectAuthorPublications && (
                      <button
                        type="button"
                        onClick={() => onSelectAuthorPublications(auth.full_name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0d766e',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '12px',
                        }}
                      >
                        Works &rarr;
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
