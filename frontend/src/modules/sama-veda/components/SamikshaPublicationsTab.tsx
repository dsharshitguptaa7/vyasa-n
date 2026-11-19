import React, { useMemo, useState, useCallback } from 'react';
import { Badge, Input, Select, EmptyState, Button, AppIcon } from '@vyasa/ui';
import { PublicPublication, PublicBulletin, IssuePublicationCount } from '../services/samaVedaService';

export interface SamikshaPublicationsTabProps {
  publications: PublicPublication[];
  totalPublications: number;
  pubSearch: string;
  onPubSearchChange: (val: string) => void;
  pubCategory: string;
  onPubCategoryChange: (val: string) => void;
  selectedYear?: string;
  onSelectedYearChange?: (val: string) => void;
  bulletins?: PublicBulletin[];
  issueCounts?: IssuePublicationCount[];
  selectedVolume?: string;
  onSelectedVolumeChange?: (val: string) => void;
  selectedIssue?: string;
  onSelectedIssueChange?: (val: string) => void;
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
  bulletins = [],
  issueCounts = [],
  selectedVolume,
  onSelectedVolumeChange,
  selectedIssue,
  onSelectedIssueChange,
}) => {
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});
  const [internalVolume, setInternalVolume] = useState('');
  const [internalIssue, setInternalIssue] = useState('');

  const currentVolume = selectedVolume !== undefined ? selectedVolume : internalVolume;
  const currentIssue = selectedIssue !== undefined ? selectedIssue : internalIssue;

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

  // Helper to resolve bulletin mapping
  const bulletinMap = useMemo(() => {
    const map: Record<string, PublicBulletin> = {};
    (bulletins || []).forEach((b) => {
      map[b.id] = b;
    });
    return map;
  }, [bulletins]);

  // Helper to extract volume and issue for a publication
  const getPubVolIssue = useCallback(
    (p: PublicPublication): { vol: number | null; iss: number | null } => {
      if (p.volume_number !== undefined && p.volume_number !== null) {
        return { vol: p.volume_number, iss: p.issue_number ?? null };
      }
      if (p.bulletin_id && bulletinMap[p.bulletin_id]) {
        const b = bulletinMap[p.bulletin_id];
        return { vol: b.volume_number, iss: b.issue_number };
      }
      // Fallback: parse from slug e.g. v2-i1-r048, csjmu-rb-v2-i1
      const match = p.slug?.match(/v(\d+)[-_]i(\d+)/i);
      if (match) {
        return { vol: parseInt(match[1], 10), iss: parseInt(match[2], 10) };
      }
      return { vol: null, iss: null };
    },
    [bulletinMap]
  );

  // Compute issue-wise summaries from issueCounts, bulletins, or publications
  const issueSummaries = useMemo(() => {
    if (issueCounts && issueCounts.length > 0) {
      return [...issueCounts].sort((a, b) => {
        if (a.volume_number !== b.volume_number) {
          return a.volume_number - b.volume_number;
        }
        return a.issue_number - b.issue_number;
      });
    }

    if (bulletins && bulletins.length > 0) {
      return bulletins
        .map((b) => {
          let count = b.publication_count || 0;
          if (count === 0 && publications.length > 0) {
            count = publications.filter((p) => {
              const { vol, iss } = getPubVolIssue(p);
              return vol === b.volume_number && iss === b.issue_number;
            }).length;
          }
          return {
            bulletin_id: b.id,
            volume_number: b.volume_number,
            issue_number: b.issue_number,
            title: b.title || `Volume ${b.volume_number} — Issue ${b.issue_number}`,
            publication_count: count,
          };
        })
        .sort((a, b) => {
          if (a.volume_number !== b.volume_number) {
            return a.volume_number - b.volume_number;
          }
          return a.issue_number - b.issue_number;
        });
    }

    // Derive from publications list
    const groupMap: Record<string, { vol: number; iss: number; count: number }> = {};
    publications.forEach((p) => {
      const { vol, iss } = getPubVolIssue(p);
      if (vol !== null && iss !== null) {
        const key = `${vol}-${iss}`;
        if (!groupMap[key]) {
          groupMap[key] = { vol, iss, count: 0 };
        }
        groupMap[key].count += 1;
      }
    });

    return Object.values(groupMap)
      .map((g) => ({
        bulletin_id: undefined,
        volume_number: g.vol,
        issue_number: g.iss,
        title: `Volume ${g.vol} — Issue ${g.iss}`,
        publication_count: g.count,
      }))
      .sort((a, b) => {
        if (a.volume_number !== b.volume_number) {
          return a.volume_number - b.volume_number;
        }
        return a.issue_number - b.issue_number;
      });
  }, [issueCounts, bulletins, publications, getPubVolIssue]);

  // Distinct available volumes
  const availableVolumes = useMemo(() => {
    const volSet = new Set<number>();
    issueSummaries.forEach((s) => volSet.add(s.volume_number));
    return Array.from(volSet).sort((a, b) => a - b);
  }, [issueSummaries]);

  // Available issues for the selected volume (with publication counts in labels)
  const availableIssuesForSelectedVolume = useMemo(() => {
    if (!currentVolume) {
      // If no volume is selected, show unique issues across all volumes
      const issSet = new Set<number>();
      issueSummaries.forEach((s) => issSet.add(s.issue_number));
      return Array.from(issSet)
        .sort((a, b) => a - b)
        .map((iss) => {
          const totalInIssue = issueSummaries
            .filter((s) => s.issue_number === iss)
            .reduce((acc, curr) => acc + curr.publication_count, 0);
          return {
            issue_number: iss,
            label: `Issue ${iss} (${totalInIssue} ${totalInIssue === 1 ? 'publication' : 'publications'})`,
            count: totalInIssue,
          };
        });
    }

    const volNum = parseInt(currentVolume, 10);
    return issueSummaries
      .filter((s) => s.volume_number === volNum)
      .sort((a, b) => a.issue_number - b.issue_number)
      .map((s) => ({
        issue_number: s.issue_number,
        label: `Issue ${s.issue_number} (${s.publication_count} ${s.publication_count === 1 ? 'publication' : 'publications'})`,
        count: s.publication_count,
      }));
  }, [issueSummaries, currentVolume]);

  const handleVolumeChange = (newVol: string) => {
    if (onSelectedVolumeChange) {
      onSelectedVolumeChange(newVol);
    } else {
      setInternalVolume(newVol);
    }

    // Check if currently selected issue is valid for new volume
    if (newVol) {
      const volNum = parseInt(newVol, 10);
      const validIssues = issueSummaries
        .filter((s) => s.volume_number === volNum)
        .map((s) => String(s.issue_number));
      if (currentIssue && !validIssues.includes(currentIssue)) {
        if (onSelectedIssueChange) {
          onSelectedIssueChange('');
        } else {
          setInternalIssue('');
        }
      }
    } else {
      // Volume cleared -> reset issue
      if (onSelectedIssueChange) {
        onSelectedIssueChange('');
      } else {
        setInternalIssue('');
      }
    }
  };

  const handleIssueChange = (newIss: string) => {
    if (onSelectedIssueChange) {
      onSelectedIssueChange(newIss);
    } else {
      setInternalIssue(newIss);
    }
  };

  // Filter publications by Search, Category, Year, Volume, and Issue
  const displayedPublications = useMemo(() => {
    let list = publications;

    if (pubSearch && pubSearch.trim()) {
      const q = pubSearch.trim().toLowerCase();
      list = list.filter((p) => {
        return (
          p.title?.toLowerCase().includes(q) ||
          p.slug?.toLowerCase().includes(q) ||
          p.source_journal?.toLowerCase().includes(q) ||
          p.author_display?.toLowerCase().includes(q)
        );
      });
    }

    if (pubCategory) {
      const cat = pubCategory.toLowerCase();
      list = list.filter((p) => p.category?.toLowerCase() === cat);
    }

    if (selectedYear) {
      list = list.filter((p) => {
        const d = p.published_at || p.created_at;
        if (!d) return false;
        return new Date(d).getFullYear() === parseInt(selectedYear, 10);
      });
    }

    if (currentVolume) {
      const volNum = parseInt(currentVolume, 10);
      list = list.filter((p) => {
        const { vol } = getPubVolIssue(p);
        return vol === volNum;
      });
    }

    if (currentIssue) {
      const issNum = parseInt(currentIssue, 10);
      list = list.filter((p) => {
        const { iss } = getPubVolIssue(p);
        return iss === issNum;
      });
    }

    return list;
  }, [publications, pubSearch, pubCategory, selectedYear, currentVolume, currentIssue, getPubVolIssue]);

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
        {/* Search Input */}
        <div style={{ flex: 1, minWidth: '220px' }}>
          <Input
            placeholder="Search by publication title, author, or journal..."
            value={pubSearch}
            onChange={(e) => onPubSearchChange(e.target.value)}
            aria-label="Search publications"
          />
        </div>

        {/* Category Filter */}
        <div style={{ width: '160px' }}>
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

        {/* Volume Filter */}
        <div style={{ width: '150px' }}>
          <Select
            value={currentVolume}
            onChange={(e) => handleVolumeChange(e.target.value)}
            options={[
              { label: 'All Volumes', value: '' },
              ...availableVolumes.map((vol) => ({
                label: `Volume ${vol}`,
                value: String(vol),
              })),
            ]}
            aria-label="Filter by volume"
          />
        </div>

        {/* Issue Filter */}
        <div style={{ width: '170px' }}>
          <Select
            value={currentIssue}
            onChange={(e) => handleIssueChange(e.target.value)}
            disabled={!currentVolume && availableIssuesForSelectedVolume.length === 0}
            options={[
              { label: 'All Issues', value: '' },
              ...availableIssuesForSelectedVolume.map((iss) => ({
                label: iss.label,
                value: String(iss.issue_number),
              })),
            ]}
            aria-label="Filter by issue"
          />
        </div>

        {/* Year Filter */}
        {years.length > 0 && onSelectedYearChange && (
          <div style={{ width: '130px' }}>
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

        {/* Reset Button */}
        {(pubSearch || pubCategory || selectedYear || currentVolume || currentIssue) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onPubSearchChange('');
              onPubCategoryChange('');
              if (onSelectedYearChange) onSelectedYearChange('');
              handleVolumeChange('');
              handleIssueChange('');
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

      {/* Issue-wise Publication Distribution Summary */}
      {issueSummaries.length > 0 && (
        <div
          data-testid="publication-distribution-summary"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="layers" size={15} color="#0d766e" />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Publication Distribution
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                &bull; Explore by Research Bulletin Editions
              </span>
            </div>
            {(currentVolume || currentIssue) && (
              <button
                type="button"
                onClick={() => {
                  handleVolumeChange('');
                  handleIssueChange('');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0d766e',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Clear Bulletin Filters
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: '10px',
            }}
          >
            {issueSummaries.map((item) => {
              const isExactActive =
                currentVolume === String(item.volume_number) &&
                currentIssue === String(item.issue_number);
              const isVolActive =
                currentVolume === String(item.volume_number) && !currentIssue;

              return (
                <button
                  key={`${item.volume_number}-${item.issue_number}`}
                  type="button"
                  onClick={() => {
                    if (isExactActive) {
                      handleVolumeChange('');
                      handleIssueChange('');
                    } else {
                      handleVolumeChange(String(item.volume_number));
                      handleIssueChange(String(item.issue_number));
                    }
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: isExactActive
                      ? '1.5px solid #0d766e'
                      : isVolActive
                      ? '1px solid #99f6e4'
                      : '1px solid #e2e8f0',
                    backgroundColor: isExactActive
                      ? '#f0fdfa'
                      : isVolActive
                      ? '#f8fafc'
                      : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  title={`Filter by Volume ${item.volume_number} — Issue ${item.issue_number}`}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span
                      style={{
                        fontSize: '12.5px',
                        fontWeight: 700,
                        color: isExactActive ? '#0d766e' : '#1e293b',
                      }}
                    >
                      Volume {item.volume_number} — Issue {item.issue_number}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {item.title || `Vol ${item.volume_number} Iss ${item.issue_number}`}
                    </span>
                  </div>
                  <Badge variant={isExactActive ? 'teal' : 'neutral'}>
                    {item.publication_count} {item.publication_count === 1 ? 'paper' : 'papers'}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

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
            {currentVolume && ` • Vol ${currentVolume}`}
            {currentIssue && ` Issue ${currentIssue}`}
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
                    {pub.volume_number !== undefined && pub.volume_number !== null && (
                      <span style={{ fontSize: '11px', color: '#0d766e', background: '#f0fdfa', border: '1px solid #99f6e4', padding: '1px 7px', borderRadius: '4px', fontWeight: 600 }}>
                        Vol {pub.volume_number} {pub.issue_number ? `• Iss ${pub.issue_number}` : ''}
                      </span>
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
                        {isExpanded ? 'Show less ↑' : 'Read abstract ↓'}
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
