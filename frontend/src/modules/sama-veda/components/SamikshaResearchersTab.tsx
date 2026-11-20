import React, { useState, useMemo } from 'react';
import { Button, Input, Select, EmptyState, AppIcon } from '@vyasa/ui';
import { PublicAuthor, PublicPublication } from '../services/samaVedaService';

interface SamikshaResearchersTabProps {
  authors: PublicAuthor[];
  totalAuthors: number;
  authorSearch: string;
  onAuthorSearchChange: (val: string) => void;
  publications?: PublicPublication[];
  onSelectAuthorPublications?: (authorName: string) => void;
  onSelectAuthorCertificates?: (authorName: string) => void;
  authoritativeVerifiedCount?: number;
  authoritativeTotalCount?: number;
}

export const SamikshaResearchersTab: React.FC<SamikshaResearchersTabProps> = ({
  authors,
  totalAuthors,
  authorSearch,
  onAuthorSearchChange,
  publications = [],
  onSelectAuthorPublications,
  onSelectAuthorCertificates,
  authoritativeVerifiedCount,
  authoritativeTotalCount,
}) => {
  const [selectedDept, setSelectedDept] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'provisional'>('all');

  const effectiveTotal = authoritativeTotalCount ?? (totalAuthors > 0 ? totalAuthors : authors.length);
  const effectiveVerified = authoritativeVerifiedCount !== undefined
    ? authoritativeVerifiedCount
    : authors.filter((a) => a.is_verified).length;

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Institutional Directory Header */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
          boxShadow: '0 2px 10px rgba(15, 43, 72, 0.03)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: '#0d9488',
              letterSpacing: '0.08em',
              marginBottom: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AppIcon name="users" size={13} color="#0d9488" />
            <span>Institutional Registry</span>
          </div>
          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              margin: 0,
              color: '#0f2b48',
              letterSpacing: '-0.02em',
            }}
          >
            Faculty Researcher Directory
          </h2>
          <p
            style={{
              fontSize: '13.5px',
              color: '#64748b',
              margin: '4px 0 0 0',
              lineHeight: 1.5,
            }}
          >
            Official university registry of affiliated researchers, verified faculty investigators, and Scopus-indexed scholars.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: '#f8fafc',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              minWidth: '105px',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48' }}>{effectiveTotal}</div>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Total Researchers</div>
          </div>
          <div
            style={{
              background: '#f0fdfa',
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #ccfbf1',
              textAlign: 'center',
              minWidth: '105px',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0d9488' }}>{effectiveVerified}</div>
            <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 600 }}>Verified Faculty</div>
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

      {/* Results Summary Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: '#475569',
          fontWeight: 600,
          padding: '0 2px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AppIcon name="users" size={14} color="#64748b" />
          <span>
            Showing <strong style={{ color: '#0f2b48' }}>{filteredAuthors.length}</strong> of{' '}
            <strong style={{ color: '#0f2b48' }}>{totalAuthors}</strong> researchers
          </span>
        </div>
        {filteredAuthors.length !== totalAuthors && (
          <span style={{ fontSize: '12px', color: '#0d9488', fontWeight: 500 }}>
            Filters Active
          </span>
        )}
      </div>

      {/* Directory Grid */}
      {filteredAuthors.length === 0 ? (
        <EmptyState
          title="No Researchers Found"
          description="Researcher profiles will appear here as publications and institutional Scopus IDs are linked. Try resetting search filters."
        />
      ) : (
        <div className="samiksha-researcher-grid">
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
              <div key={auth.id} className="samiksha-researcher-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Identity & Verification Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: auth.is_verified ? '#f0fdfa' : '#f8fafc',
                          border: auth.is_verified ? '1.5px solid #99f6e4' : '1.5px solid #e2e8f0',
                          color: auth.is_verified ? '#0d9488' : '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '14px',
                          letterSpacing: '0.02em',
                          flexShrink: 0,
                          userSelect: 'none',
                        }}
                        aria-hidden="true"
                      >
                        {initials}
                      </div>

                      {/* Name & Department */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h3
                          style={{
                            fontSize: '15.5px',
                            fontWeight: 700,
                            color: '#0f2b48',
                            margin: 0,
                            lineHeight: 1.35,
                            wordBreak: 'break-word',
                          }}
                        >
                          {auth.full_name}
                        </h3>
                        {auth.department && !auth.department.toLowerCase().includes('department of research') && (
                          <div
                            style={{
                              fontSize: '12.5px',
                              color: '#0d766e',
                              fontWeight: 600,
                              marginTop: '3px',
                              lineHeight: 1.3,
                              wordBreak: 'break-word',
                            }}
                          >
                            {auth.department}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Verification Status Badge */}
                    <div style={{ flexShrink: 0 }}>
                      {auth.is_verified ? (
                        <span
                          className="samiksha-pill-badge teal"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                          }}
                        >
                          <AppIcon name="check-circle" size={11} color="#0d9488" />
                          <span>Verified</span>
                        </span>
                      ) : (
                        <span
                          className="samiksha-pill-badge amber"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                          }}
                        >
                          <AppIcon name="clock" size={11} color="#b45309" />
                          <span>Provisional</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Institutional Affiliation */}
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#64748b',
                      lineHeight: 1.4,
                      paddingLeft: '56px',
                      wordBreak: 'break-word',
                    }}
                  >
                    {auth.institutional_affiliation || 'Chhatrapati Shahu Ji Maharaj University, Kanpur'}
                  </div>

                  {/* Scopus ID */}
                  {auth.scopus_id && (
                    <div style={{ paddingLeft: '56px' }}>
                      <a
                        href={`https://www.scopus.com/authid/detail.uri?authorId=${auth.scopus_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="samiksha-scopus-chip"
                        title={`View Scopus Author Profile for ${auth.full_name} (opens in new tab)`}
                        aria-label={`Scopus ID ${auth.scopus_id}, opens author profile in a new tab`}
                      >
                        <span>Scopus ID: {auth.scopus_id}</span>
                        <AppIcon name="external-link" size={12} color="#0d766e" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '12px',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '12px',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ color: '#64748b' }}>
                    {pubCount > 0 ? (
                      <strong style={{ color: '#0f2b48', fontWeight: 600 }}>
                        {pubCount} Felicitated {pubCount === 1 ? 'Work' : 'Works'}
                      </strong>
                    ) : (
                      'Affiliated Scholar'
                    )}
                  </span>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {onSelectAuthorCertificates && (
                      <button
                        type="button"
                        onClick={() => onSelectAuthorCertificates(auth.full_name)}
                        className="samiksha-card-action-btn"
                        style={{ color: '#b45309' }}
                        title={`Search Certificates for ${auth.full_name}`}
                      >
                        <span>Certificates</span>
                        <AppIcon name="chevron-right" size={12} color="#b45309" />
                      </button>
                    )}
                    {onSelectAuthorPublications && (
                      <button
                        type="button"
                        onClick={() => onSelectAuthorPublications(auth.full_name)}
                        className="samiksha-card-action-btn"
                        style={{ color: '#0d766e' }}
                        title={`View Works by ${auth.full_name}`}
                      >
                        <span>Works</span>
                        <AppIcon name="chevron-right" size={12} color="#0d766e" />
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
