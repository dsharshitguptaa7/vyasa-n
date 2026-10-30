import React, { useState, useMemo } from 'react';
import { Badge, Button, Input, Select, EmptyState } from '@vyasa/ui';
import { PublicAuthor, PublicPublication } from '../services/samaVedaService';

interface SamikshaResearchersTabProps {
  authors: PublicAuthor[];
  totalAuthors: number;
  authorSearch: string;
  onAuthorSearchChange: (val: string) => void;
  publications?: PublicPublication[];
  onSelectAuthorPublications?: (authorName: string) => void;
}

export const SamikshaResearchersTab: React.FC<SamikshaResearchersTabProps> = ({
  authors,
  totalAuthors,
  authorSearch,
  onAuthorSearchChange,
  publications = [],
  onSelectAuthorPublications,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Summary */}
      <div
        style={{
          background: 'linear-gradient(135deg, #091e33 0%, #0f2b48 100%)',
          borderRadius: '14px',
          padding: '24px 28px',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
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
            }}
          >
            Academic Directory
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
            Faculty &amp; Scholar Directory
          </h2>
          <p style={{ fontSize: '13.5px', color: '#cbd5e1', margin: '4px 0 0 0' }}>
            Official register of university researchers, faculty investigators, and Scopus-indexed authors.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#38bdf8' }}>{totalAuthors}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Researchers</div>
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '10px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--vyasa-teal-border, #99f6e4)' }}>
              {verifiedCount}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Verified Faculty</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
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
            gap: '16px',
          }}
        >
          {filteredAuthors.map((auth) => {
            const pubCount = authorPubCounts[auth.id] || authorPubCounts[auth.full_name?.toLowerCase()] || 0;

            return (
              <div
                key={auth.id}
                style={{
                  background: '#ffffff',
                  padding: '22px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 2px 8px rgba(15, 43, 72, 0.03)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <h3
                      style={{
                        fontSize: '16.5px',
                        fontWeight: 700,
                        color: '#0f2b48',
                        margin: 0,
                      }}
                    >
                      {auth.full_name}
                    </h3>
                    {auth.is_verified ? (
                      <Badge variant="teal">Verified</Badge>
                    ) : (
                      <Badge variant="neutral">Provisional</Badge>
                    )}
                  </div>

                  <div style={{ fontSize: '13px', color: '#0d766e', fontWeight: 600, marginTop: '4px' }}>
                    {auth.department || 'Department of Research & Development'}
                  </div>

                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {auth.institutional_affiliation || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                  </div>

                  {auth.scopus_id && (
                    <div
                      style={{
                        marginTop: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11.5px',
                        color: '#0d766e',
                        fontFamily: 'monospace',
                        background: '#f0fdfa',
                        border: '1px solid #99f6e4',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      <span>Scopus ID:</span>
                      <a
                        href={`https://www.scopus.com/authid/detail.uri?authorId=${auth.scopus_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#0d766e', fontWeight: 700, textDecoration: 'none' }}
                        title="View Scopus Author Profile"
                      >
                        {auth.scopus_id} &nearr;
                      </a>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '10px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: '#64748b' }}>
                    {pubCount > 0 ? (
                      <strong style={{ color: '#0f2b48' }}>{pubCount} Felicitated Works</strong>
                    ) : (
                      'Affiliated Scholar'
                    )}
                  </span>

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
                      }}
                    >
                      View Works &rarr;
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
