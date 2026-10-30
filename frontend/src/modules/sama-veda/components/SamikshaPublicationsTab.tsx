import React, { useMemo } from 'react';
import { Badge, Input, Select, EmptyState, Button } from '@vyasa/ui';
import { PublicPublication } from '../services/samaVedaService';

interface SamikshaPublicationsTabProps {
  publications: PublicPublication[];
  totalPublications: number;
  pubSearch: string;
  onPubSearchChange: (val: string) => void;
  pubCategory: string;
  onPubCategoryChange: (val: string) => void;
  selectedYear?: string;
  onSelectedYearChange?: (val: string) => void;
}

export const SamikshaPublicationsTab: React.FC<SamikshaPublicationsTabProps> = ({
  publications,
  totalPublications,
  pubSearch,
  onPubSearchChange,
  pubCategory,
  onPubCategoryChange,
  selectedYear = '',
  onSelectedYearChange,
}) => {
  // Extract unique years from publications
  const years = useMemo(() => {
    const set = new Set<string>();
    publications.forEach((p) => {
      const d = p.published_at || p.created_at;
      if (d) {
        try {
          const yr = new Date(d).getFullYear();
          if (!isNaN(yr) && yr > 1990 && yr < 2100) set.add(String(yr));
        } catch {
          // ignore
        }
      }
    });
    return Array.from(set).sort().reverse();
  }, [publications]);

  // Client-side year filter if selectedYear is active
  const displayedPublications = useMemo(() => {
    if (!selectedYear) return publications;
    return publications.filter((p) => {
      const d = p.published_at || p.created_at;
      if (!d) return false;
      return new Date(d).getFullYear() === parseInt(selectedYear, 10);
    });
  }, [publications, selectedYear]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Search and Filters Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          background: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: '240px' }}>
          <Input
            placeholder="Search by publication title, author, or journal..."
            value={pubSearch}
            onChange={(e) => onPubSearchChange(e.target.value)}
            aria-label="Search publications"
          />
        </div>

        <div style={{ width: '180px' }}>
          <Select
            value={pubCategory}
            onChange={(e) => onPubCategoryChange(e.target.value)}
            options={[
              { label: 'All Categories', value: '' },
              { label: 'Article', value: 'Article' },
              { label: 'Review', value: 'Review' },
              { label: 'Book Chapter', value: 'Book Chapter' },
              { label: 'Conference Paper', value: 'Conference Paper' },
            ]}
            aria-label="Filter by category"
          />
        </div>

        {years.length > 0 && onSelectedYearChange && (
          <div style={{ width: '140px' }}>
            <Select
              value={selectedYear}
              onChange={(e) => onSelectedYearChange(e.target.value)}
              options={[
                { label: 'All Years', value: '' },
                ...years.map((y) => ({ label: y, value: y })),
              ]}
              aria-label="Filter by publication year"
            />
          </div>
        )}

        {(pubSearch || pubCategory || selectedYear) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onPubSearchChange('');
              onPubCategoryChange('');
              if (onSelectedYearChange) onSelectedYearChange('');
            }}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Catalog List */}
      {displayedPublications.length === 0 ? (
        <EmptyState
          title="No Published Research Records Visible"
          description="Publications remain in review or unapproved state. Once published by the editorial committee, approved publications will be displayed here."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Showing {displayedPublications.length} of {totalPublications} published research records
            {selectedYear && ` for academic year ${selectedYear}`}
          </div>

          {displayedPublications.map((pub) => {
            const pubDate = pub.published_at || pub.created_at;
            const formattedDate = pubDate ? new Date(pubDate).toLocaleDateString() : null;

            return (
              <div
                key={pub.id}
                style={{
                  background: '#ffffff',
                  padding: '22px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 2px 8px rgba(15, 43, 72, 0.03)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Badge variant="teal">{pub.category || 'Article'}</Badge>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>#{pub.serial_no}</span>
                    {formattedDate && (
                      <span style={{ fontSize: '12px', color: '#64748b' }}>&bull; {formattedDate}</span>
                    )}
                  </div>
                  {pub.doi && (
                    <a
                      href={`https://doi.org/${pub.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '12px',
                        color: '#0d766e',
                        textDecoration: 'none',
                        fontWeight: 600,
                        background: '#f0fdfa',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid #99f6e4',
                      }}
                    >
                      DOI: {pub.doi} &nearr;
                    </a>
                  )}
                </div>

                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: '#0f2b48', margin: '4px 0 2px 0', lineHeight: 1.4 }}>
                  {pub.title}
                </h3>

                <div style={{ fontSize: '13.5px', color: '#334155', fontWeight: 600 }}>
                  {pub.author_display}
                </div>

                <div style={{ fontSize: '12.5px', color: '#64748b', fontStyle: 'italic' }}>
                  {pub.source_journal}
                </div>

                {pub.author_links && pub.author_links.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {pub.author_links.map((link) => (
                      <span
                        key={link.author_id}
                        style={{
                          fontSize: '11px',
                          color: '#475569',
                          background: '#f8fafc',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {link.author_name || 'Scholar'} {link.department ? `(${link.department})` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {pub.abstract && (
                  <p style={{ fontSize: '13px', color: '#64748b', margin: '6px 0 0 0', lineHeight: 1.6 }}>
                    {pub.abstract}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
