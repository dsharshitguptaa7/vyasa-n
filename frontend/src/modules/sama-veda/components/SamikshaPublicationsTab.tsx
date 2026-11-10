import React, { useMemo, useState } from 'react';
import { Badge, Input, Select, EmptyState, Button, AppIcon } from '@vyasa/ui';
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
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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

  const quickCategories = ['Article', 'Review', 'Book Chapter', 'Conference Paper'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header Eyebrow */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="samiksha-eyebrow">
            <AppIcon name="book-open" size={13} color="#0d766e" />
            <span>Scholarly Literature Catalog</span>
          </div>
          <h2 className="samiksha-section-title">
            Publications Archive
          </h2>
          <p className="samiksha-section-desc">
            Explore peer-reviewed publications, Scopus-indexed research, and faculty contributions across CSJMU departments.
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="samiksha-filter-bar">
        <div style={{ flex: 1, minWidth: '260px' }}>
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

      {/* Quick Category Chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Filter by type:</span>
        <button
          type="button"
          onClick={() => onPubCategoryChange('')}
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            border: pubCategory === '' ? '1px solid #0d766e' : '1px solid #e2e8f0',
            background: pubCategory === '' ? '#f0fdfa' : '#ffffff',
            color: pubCategory === '' ? '#0d766e' : '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          All
        </button>
        {quickCategories.map((qc) => {
          const isSelected = pubCategory.toLowerCase() === qc.toLowerCase();
          return (
            <button
              key={qc}
              type="button"
              onClick={() => onPubCategoryChange(isSelected ? '' : qc)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                border: isSelected ? '1px solid #0d766e' : '1px solid #e2e8f0',
                background: isSelected ? '#f0fdfa' : '#ffffff',
                color: isSelected ? '#0d766e' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {qc}
            </button>
          );
        })}
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
            const isExpanded = !!expandedAbstracts[pub.id];

            return (
              <div
                key={pub.id}
                className="samiksha-card samiksha-interactive-lift"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '24px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #99f6e4',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>DOI: {pub.doi} &nearr;</span>
                    </a>
                  )}
                </div>

                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f2b48', margin: '4px 0 2px 0', lineHeight: 1.4 }}>
                  {pub.title}
                </h3>

                <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 600 }}>
                  {pub.author_display}
                </div>

                <div style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic' }}>
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
                          padding: '3px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontWeight: 500,
                        }}
                      >
                        {link.author_name || 'Scholar'} {link.department ? `(${link.department})` : ''}
                      </span>
                    ))}
                  </div>
                )}

                {pub.abstract && (
                  <div style={{ marginTop: '4px' }}>
                    <p
                      style={{
                        fontSize: '13px',
                        color: '#64748b',
                        margin: 0,
                        lineHeight: 1.6,
                        display: isExpanded ? 'block' : '-webkit-box',
                        WebkitLineClamp: isExpanded ? 'none' : 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: isExpanded ? 'visible' : 'hidden',
                      }}
                    >
                      {pub.abstract}
                    </p>
                    {pub.abstract.length > 180 && (
                      <button
                        type="button"
                        onClick={() => toggleAbstract(pub.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#0d766e',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: '4px 0 0 0',
                        }}
                      >
                        {isExpanded ? 'Show less \u2191' : 'Read abstract \u2193'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
