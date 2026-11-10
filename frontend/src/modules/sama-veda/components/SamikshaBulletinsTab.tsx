import React, { useState, useMemo, useEffect } from 'react';
import { Badge, Button, EmptyState, SectionHeading, Input, Select, AppIcon } from '@vyasa/ui';
import { PublicBulletin, PublicPublication, samaVedaService } from '../services/samaVedaService';
import { SamikshaPdfViewer } from './SamikshaPdfViewer';

interface SamikshaBulletinsTabProps {
  bulletins: PublicBulletin[];
  onDownloadBulletin: (bulletin: PublicBulletin) => void;
  downloadingId?: string | null;
  publications?: PublicPublication[];
}

export const SamikshaBulletinsTab: React.FC<SamikshaBulletinsTabProps> = ({
  bulletins,
  onDownloadBulletin,
  downloadingId,
  publications = [],
}) => {
  // Volume Selection state (null means All Volumes)
  const [selectedVolume, setSelectedVolume] = useState<number | null>(null);

  // Dedicated Issue Detail view state
  const [selectedIssueDetail, setSelectedIssueDetail] = useState<PublicBulletin | null>(null);

  // Dedicated Fullscreen In-Browser PDF Reader state
  const [pdfReadingIssue, setPdfReadingIssue] = useState<PublicBulletin | null>(null);

  // Discovery & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [authorSearch, setAuthorSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedIssueNum, setSelectedIssueNum] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  // Table of Contents state for the active issue detail
  const [issuePubs, setIssuePubs] = useState<PublicPublication[]>([]);
  const [loadingIssuePubs, setLoadingIssuePubs] = useState(false);
  const [tocSearch, setTocSearch] = useState('');
  const [tocCategory, setTocCategory] = useState('');
  const [expandedAbstracts, setExpandedAbstracts] = useState<Record<string, boolean>>({});

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Group bulletins dynamically by volume
  const volumes = useMemo(() => {
    const map = new Map<
      number,
      {
        volume_number: number;
        years: Set<string>;
        issues: PublicBulletin[];
        totalPublications: number;
        periods: string[];
      }
    >();

    for (const b of bulletins) {
      if (!map.has(b.volume_number)) {
        map.set(b.volume_number, {
          volume_number: b.volume_number,
          years: new Set(),
          issues: [],
          totalPublications: 0,
          periods: [],
        });
      }
      const vol = map.get(b.volume_number)!;
      vol.issues.push(b);
      vol.totalPublications += b.publication_count || 0;
      if (b.publication_period && !vol.periods.includes(b.publication_period)) {
        vol.periods.push(b.publication_period);
      }
      // Extract year from publication_period or published_at
      const yrMatch = b.publication_period?.match(/\b(20\d\d)\b/);
      if (yrMatch) {
        vol.years.add(yrMatch[1]);
      } else if (b.published_at) {
        vol.years.add(String(new Date(b.published_at).getFullYear()));
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.volume_number - a.volume_number)
      .map((v) => ({
        ...v,
        issues: v.issues.sort((a, b) => b.issue_number - a.issue_number),
        yearDisplay: v.years.size > 0 ? Array.from(v.years).sort().join(', ') : 'Current',
        periodDisplay: v.periods.join(' • '),
      }));
  }, [bulletins]);

  // Derived filter options from actual data
  const filterOptions = useMemo(() => {
    const yearSet = new Set<string>();
    const issueNumSet = new Set<string>();
    const periodSet = new Set<string>();

    for (const b of bulletins) {
      const yrMatch = b.publication_period?.match(/\b(20\d\d)\b/);
      if (yrMatch) yearSet.add(yrMatch[1]);
      else if (b.published_at) yearSet.add(String(new Date(b.published_at).getFullYear()));

      if (b.issue_number) issueNumSet.add(String(b.issue_number));
      if (b.publication_period?.trim()) periodSet.add(b.publication_period.trim());
    }

    return {
      years: Array.from(yearSet).sort().reverse(),
      issueNums: Array.from(issueNumSet).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)),
      periods: Array.from(periodSet).sort(),
    };
  }, [bulletins]);

  // Filtered Bulletins list
  const filteredBulletins = useMemo(() => {
    return bulletins.filter((b) => {
      if (selectedVolume !== null && b.volume_number !== selectedVolume) {
        return false;
      }
      if (selectedIssueNum && String(b.issue_number) !== selectedIssueNum) {
        return false;
      }
      if (selectedPeriod && b.publication_period?.toLowerCase() !== selectedPeriod.toLowerCase()) {
        return false;
      }
      if (selectedYear) {
        const matchesPeriodYear = b.publication_period?.includes(selectedYear);
        const matchesPublishedYear = b.published_at
          ? String(new Date(b.published_at).getFullYear()) === selectedYear
          : false;
        if (!matchesPeriodYear && !matchesPublishedYear) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = b.title?.toLowerCase().includes(q);
        const matchesPeriod = b.publication_period?.toLowerCase().includes(q);
        const matchesVolume = `volume ${b.volume_number}`.includes(q) || `vol ${b.volume_number}`.includes(q);
        const matchesIssue = `issue ${b.issue_number}`.includes(q);
        if (!matchesTitle && !matchesPeriod && !matchesVolume && !matchesIssue) return false;
      }
      if (authorSearch.trim()) {
        const authorQ = authorSearch.toLowerCase().trim();
        const hasAuthor = publications.some(
          (p) =>
            p.bulletin_id === b.id &&
            (p.author_display?.toLowerCase().includes(authorQ) ||
              p.author_links?.some((al) => al.author_name?.toLowerCase().includes(authorQ)))
        );
        if (!hasAuthor) return false;
      }
      return true;
    });
  }, [
    bulletins,
    selectedVolume,
    selectedIssueNum,
    selectedPeriod,
    selectedYear,
    searchQuery,
    authorSearch,
    publications,
  ]);

  // Total publications recorded across all issues
  const totalPublicationsArchived = useMemo(() => {
    return bulletins.reduce((acc, b) => acc + (b.publication_count || 0), 0);
  }, [bulletins]);

  // Fetch publications for active issue detail
  useEffect(() => {
    if (!selectedIssueDetail) {
      setIssuePubs([]);
      return;
    }

    // Populate from preloaded publications first
    const preloaded = publications.filter((p) => p.bulletin_id === selectedIssueDetail.id);
    if (preloaded.length > 0) {
      setIssuePubs(preloaded);
    }

    let isMounted = true;
    const fetchIssueArticles = async () => {
      try {
        setLoadingIssuePubs(true);
        const res = await samaVedaService.getPublications({
          bulletin_id: selectedIssueDetail.id,
          limit: 200,
        });
        if (isMounted && res?.items && res.items.length > 0) {
          setIssuePubs(res.items);
        }
      } catch {
        // preserve preloaded if API fails
      } finally {
        if (isMounted) setLoadingIssuePubs(false);
      }
    };

    fetchIssueArticles();

    return () => {
      isMounted = false;
    };
  }, [selectedIssueDetail, publications]);

  // Filter Table of Contents publications within issue detail
  const filteredIssuePubs = useMemo(() => {
    return issuePubs.filter((p) => {
      if (tocCategory && p.category?.toLowerCase() !== tocCategory.toLowerCase()) {
        return false;
      }
      if (tocSearch.trim()) {
        const q = tocSearch.toLowerCase().trim();
        const matchesTitle = p.title?.toLowerCase().includes(q);
        const matchesAuthor = p.author_display?.toLowerCase().includes(q);
        const matchesJournal = p.source_journal?.toLowerCase().includes(q);
        const matchesDoi = p.doi?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesAuthor && !matchesJournal && !matchesDoi) return false;
      }
      return true;
    });
  }, [issuePubs, tocSearch, tocCategory]);

  const tocCategories = useMemo(() => {
    const set = new Set<string>();
    issuePubs.forEach((p) => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set).sort();
  }, [issuePubs]);

  const isAnyFilterActive =
    Boolean(searchQuery || authorSearch || selectedYear || selectedIssueNum || selectedPeriod || selectedVolume !== null);

  const resetAllFilters = () => {
    setSearchQuery('');
    setAuthorSearch('');
    setSelectedYear('');
    setSelectedIssueNum('');
    setSelectedPeriod('');
    setSelectedVolume(null);
  };

  // Click on publication count opens Table of Contents
  const handleOpenTableOfContents = (b: PublicBulletin) => {
    setSelectedIssueDetail(b);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
      {/* 1. Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <SectionHeading
            eyebrow="Institutional Publications"
            title="CSJMU Research Bulletins"
            description="Official periodic research bulletin volumes celebrating scholarly publications and intellectual property."
          />
        </div>

        {/* Archival Telemetry Strip */}
        {bulletins.length > 0 && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignSelf: 'flex-start' }}>
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <AppIcon name="book-open" size={15} color="#0d766e" />
              <div style={{ fontSize: '12px', color: '#475569' }}>
                <strong style={{ color: '#0f2b48' }}>{volumes.length}</strong> Volumes
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <AppIcon name="file-text" size={15} color="#0284c7" />
              <div style={{ fontSize: '12px', color: '#475569' }}>
                <strong style={{ color: '#0f2b48' }}>{bulletins.length}</strong> Published Issues
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <AppIcon name="shield" size={15} color="#f59e0b" />
              <div style={{ fontSize: '12px', color: '#475569' }}>
                <strong style={{ color: '#0f2b48' }}>{totalPublicationsArchived}</strong> Verified Works
              </div>
            </div>
          </div>
        )}
      </div>

      {bulletins.length === 0 ? (
        <EmptyState
          title="No Research Bulletins Published"
          description="Bulletins will appear here once officially published by the Directorate of Research."
        />
      ) : selectedIssueDetail ? (
        /* =========================================================================
         * 2. DEDICATED ISSUE DETAIL VIEW
         * ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Breadcrumb Navigation & Back Action */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingBottom: '8px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <nav
              aria-label="Issue Breadcrumb"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#64748b' }}
            >
              <button
                type="button"
                onClick={() => setSelectedIssueDetail(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#0d766e',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span>CSJMU Research Bulletins</span>
              </button>
              <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
              <span style={{ color: '#0f2b48', fontWeight: 600 }}>Volume {selectedIssueDetail.volume_number}</span>
              <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
              <span style={{ color: '#0d766e', fontWeight: 700 }}>Issue {selectedIssueDetail.issue_number}</span>
            </nav>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIssueDetail(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span>&larr; Back to Volumes Archive</span>
            </Button>
          </div>

          {/* Issue Hero Showcase Card */}
          <div
            className="samiksha-card"
            style={{
              padding: 0,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            }}
          >
            {/* Left Cover Artwork */}
            <div
              className="samiksha-journal-cover"
              style={{
                borderRadius: '16px 0 0 16px',
                padding: '36px 30px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '320px',
              }}
            >
              <div className="samiksha-journal-cover-watermark" aria-hidden="true">
                <AppIcon name="book-open" size={260} color="#ffffff" />
              </div>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: '#f59e0b',
                    letterSpacing: '0.12em',
                    marginBottom: '8px',
                  }}
                >
                  Chhatrapati Shahu Ji Maharaj University
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#38bdf8',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  Official Research Bulletin
                </div>
                <h2
                  style={{
                    fontSize: '32px',
                    fontWeight: 900,
                    color: '#ffffff',
                    margin: '12px 0 6px 0',
                    lineHeight: 1.15,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Volume {selectedIssueDetail.volume_number}
                </h2>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#2dd4bf',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Issue {selectedIssueDetail.issue_number}
                </div>
              </div>

              <div style={{ position: 'relative', zIndex: 1, marginTop: '24px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <span>{selectedIssueDetail.publication_period}</span>
                </div>
              </div>
            </div>

            {/* Right Metadata & Action Deck */}
            <div style={{ padding: '32px 34px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <Badge variant="teal">Official Edition</Badge>
                  <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 600 }}>
                    {(selectedIssueDetail.file_size_bytes / (1024 * 1024)).toFixed(1)} MB PDF
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginTop: '18px' }}>
                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Publication Coverage
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f2b48', marginTop: '4px' }}>
                      {selectedIssueDetail.publication_period}
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                      Verified Content
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0d766e', marginTop: '4px' }}>
                      {selectedIssueDetail.publication_count} Scholarly Works
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.6, marginTop: '16px' }}>
                  Comprehensive institutional compilation documenting verified peer-reviewed publications, Scopus-indexed research,
                  and faculty achievements across science, technology, medicine, and humanities at CSJMU.
                </p>
              </div>

              {/* Actions: Read Online Primary, Download PDF Secondary */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setPdfReadingIssue(selectedIssueDetail)}
                  style={{
                    flex: 1,
                    minWidth: '180px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '11px 22px',
                    background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    color: '#ffffff',
                    border: '1px solid #14b8a6',
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                  title="Read this issue in the integrated digital reader"
                >
                  <AppIcon name="book-open" size={16} color="#ffffff" />
                  <span>Read Online</span>
                </button>

                <Button
                  variant="outline"
                  onClick={() => onDownloadBulletin(selectedIssueDetail)}
                  disabled={downloadingId === selectedIssueDetail.id}
                  aria-label={`Download ${selectedIssueDetail.title}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '11px 20px',
                    fontSize: '13.5px',
                  }}
                >
                  {downloadingId === selectedIssueDetail.id ? 'Preparing Download...' : 'Download Bulletin PDF \u2193'}
                </Button>
              </div>
            </div>
          </div>

          {/* Table of Contents Header & Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div className="samiksha-eyebrow">
                  <AppIcon name="layers" size={13} color="#0d766e" />
                  <span>Curated Scholarly Index</span>
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48', margin: 0 }}>
                  Table of Contents &bull; Issue {selectedIssueDetail.issue_number}
                </h3>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                Showing {filteredIssuePubs.length} of {selectedIssueDetail.publication_count || issuePubs.length} publications
              </div>
            </div>

            {/* In-Issue Filter Bar */}
            <div className="samiksha-filter-bar">
              <div style={{ flex: 1, minWidth: '240px' }}>
                <Input
                  placeholder="Filter articles in this issue by title, author, or journal..."
                  value={tocSearch}
                  onChange={(e) => setTocSearch(e.target.value)}
                  aria-label="Filter table of contents"
                />
              </div>

              {tocCategories.length > 0 && (
                <div style={{ width: '180px' }}>
                  <Select
                    value={tocCategory}
                    onChange={(e) => setTocCategory(e.target.value)}
                    options={[
                      { label: 'All Categories', value: '' },
                      ...tocCategories.map((c) => ({ label: c, value: c })),
                    ]}
                    aria-label="Filter by article category"
                  />
                </div>
              )}

              {(tocSearch || tocCategory) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTocSearch('');
                    setTocCategory('');
                  }}
                >
                  Reset
                </Button>
              )}
            </div>

            {/* Table of Contents Articles */}
            {loadingIssuePubs && issuePubs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#0d766e', fontWeight: 600 }}>
                Loading verified articles included in this issue edition...
              </div>
            ) : filteredIssuePubs.length === 0 ? (
              <div
                style={{
                  padding: '36px',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  textAlign: 'center',
                  color: '#64748b',
                }}
              >
                No publications found matching your filter criteria within this issue.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {filteredIssuePubs.map((pub, idx) => {
                  const isExpanded = !!expandedAbstracts[pub.id];

                  return (
                    <div key={pub.id} className="samiksha-toc-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontFamily: 'monospace',
                              background: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 700,
                              color: '#475569',
                            }}
                          >
                            #{pub.serial_no || idx + 1}
                          </span>
                          <Badge variant="teal">{pub.category || 'Article'}</Badge>
                        </div>

                        {pub.doi && (
                          <a
                            href={`https://doi.org/${pub.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '11.5px',
                              color: '#0d766e',
                              background: '#f0fdfa',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              border: '1px solid #99f6e4',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            DOI: {pub.doi} &nearr;
                          </a>
                        )}
                      </div>

                      <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2b48', margin: '4px 0 2px 0', lineHeight: 1.35 }}>
                        {pub.title}
                      </h4>

                      <div style={{ fontSize: '13.5px', color: '#1e293b', fontWeight: 600 }}>
                        {pub.author_display}
                      </div>

                      <div style={{ fontSize: '12.5px', color: '#64748b', fontStyle: 'italic' }}>
                        {pub.source_journal}
                      </div>

                      {pub.author_links && pub.author_links.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
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
                        <div style={{ marginTop: '4px' }}>
                          <p
                            style={{
                              fontSize: '12.5px',
                              color: '#64748b',
                              margin: 0,
                              lineHeight: 1.55,
                              display: isExpanded ? 'block' : '-webkit-box',
                              WebkitLineClamp: isExpanded ? 'none' : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: isExpanded ? 'visible' : 'hidden',
                            }}
                          >
                            {pub.abstract}
                          </p>
                          {pub.abstract.length > 140 && (
                            <button
                              type="button"
                              onClick={() => toggleAbstract(pub.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0d766e',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: '2px 0 0 0',
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
        </div>
      ) : (
        /* =========================================================================
         * 3. MAIN ARCHIVE & VOLUME DISCOVERY EXPERIENCE
         * ========================================================================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {/* Discovery & Multi-Filter Control Dock */}
          <div className="samiksha-filter-bar">
            <div style={{ flex: 1, minWidth: '240px' }}>
              <Input
                placeholder="Search bulletin titles, periods, or volume numbers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search research bulletins"
              />
            </div>

            <div style={{ width: '180px' }}>
              <Input
                placeholder="Filter by author..."
                value={authorSearch}
                onChange={(e) => setAuthorSearch(e.target.value)}
                aria-label="Filter bulletins by author"
              />
            </div>

            {filterOptions.years.length > 0 && (
              <div style={{ width: '130px' }}>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  options={[
                    { label: 'All Years', value: '' },
                    ...filterOptions.years.map((y) => ({ label: y, value: y })),
                  ]}
                  aria-label="Filter by year"
                />
              </div>
            )}

            {filterOptions.issueNums.length > 0 && (
              <div style={{ width: '130px' }}>
                <Select
                  value={selectedIssueNum}
                  onChange={(e) => setSelectedIssueNum(e.target.value)}
                  options={[
                    { label: 'All Issues', value: '' },
                    ...filterOptions.issueNums.map((i) => ({ label: `Issue ${i}`, value: i })),
                  ]}
                  aria-label="Filter by issue number"
                />
              </div>
            )}

            {filterOptions.periods.length > 0 && (
              <div style={{ width: '190px' }}>
                <Select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  options={[
                    { label: 'All Periods', value: '' },
                    ...filterOptions.periods.map((p) => ({ label: p, value: p })),
                  ]}
                  aria-label="Filter by publication period"
                />
              </div>
            )}

            {isAnyFilterActive && (
              <Button variant="outline" size="sm" onClick={resetAllFilters}>
                Reset
              </Button>
            )}
          </div>

          {/* Volume Selection Architecture */}
          {volumes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f2b48', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Volume Archive
                </div>
                {selectedVolume !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedVolume(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0d766e',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    View All Volumes &rarr;
                  </button>
                )}
              </div>

              <div className="samiksha-volume-grid">
                {volumes.map((vol) => {
                  const isSelected = selectedVolume === vol.volume_number;

                  return (
                    <div
                      key={vol.volume_number}
                      className={`samiksha-volume-card ${isSelected ? 'is-active' : ''}`}
                      onClick={() => setSelectedVolume(isSelected ? null : vol.volume_number)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedVolume(isSelected ? null : vol.volume_number);
                        }
                      }}
                      title={`Filter issues for Volume ${vol.volume_number}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            color: isSelected ? '#0d766e' : '#b2811a',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                          }}
                        >
                          Year {vol.yearDisplay}
                        </span>
                        <Badge variant={isSelected ? 'teal' : 'neutral'}>
                          {vol.issues.length} {vol.issues.length === 1 ? 'Issue' : 'Issues'} Available
                        </Badge>
                      </div>

                      <div>
                        <h4 style={{ fontSize: '20px', fontWeight: 800, color: '#0f2b48', margin: '4px 0 2px 0' }}>
                          Volume {vol.volume_number}
                        </h4>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                          {vol.periodDisplay || 'Academic Period'}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '13px',
                          color: isSelected ? '#0d766e' : '#475569',
                          fontWeight: 700,
                          paddingTop: '8px',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>{vol.totalPublications} Publications</span>
                        <span style={{ fontSize: '12px', color: isSelected ? '#0d766e' : '#94a3b8' }}>
                          {isSelected ? 'Active Filter \u2713' : 'Select \u2192'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Issue Cards Catalog */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                Showing {filteredBulletins.length} of {bulletins.length} publication issues
                {selectedVolume !== null && ` for Volume ${selectedVolume}`}
              </div>
            </div>

            {filteredBulletins.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  textAlign: 'center',
                }}
              >
                <AppIcon name="search" size={32} color="#94a3b8" />
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0f2b48', margin: '12px 0 4px 0' }}>
                  No Matching Bulletin Issues Found
                </h4>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                  No published research issues match your current volume, period, or search criteria.
                </p>
                <Button variant="outline" size="sm" onClick={resetAllFilters}>
                  Clear All Filters
                </Button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
                {filteredBulletins.map((b) => {
                  const fileSizeMb = (b.file_size_bytes / (1024 * 1024)).toFixed(1);
                  const isDownloading = downloadingId === b.id;

                  return (
                    <div
                      key={b.id}
                      className="samiksha-card samiksha-interactive-lift"
                      style={{
                        padding: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      {/* Editorial Digital Journal Cover Header (No duplication below) */}
                      <div
                        className="samiksha-journal-cover"
                        style={{
                          minHeight: '135px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '20px 22px',
                        }}
                      >
                        <div className="samiksha-journal-cover-watermark" aria-hidden="true">
                          <AppIcon name="book-open" size={150} color="#ffffff" />
                        </div>

                        <div style={{ position: 'relative', zIndex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.12em',
                                color: '#f59e0b',
                                fontWeight: 800,
                              }}
                            >
                              CSJMU Research Bulletin
                            </span>
                            <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600 }}>
                              {fileSizeMb} MB PDF
                            </span>
                          </div>

                          <div style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                            Volume {b.volume_number} &bull; Issue {b.issue_number}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#2dd4bf', fontWeight: 600, marginTop: '3px' }}>
                            {b.publication_period}
                          </div>
                        </div>
                      </div>

                      {/* Card Body Content: Clean User-Friendly Metadata */}
                      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: '#64748b',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Academic Period: {b.publication_period}
                          </span>
                        </div>

                        {/* Interactive Publication Count Element */}
                        <div>
                          <button
                            type="button"
                            onClick={() => handleOpenTableOfContents(b)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '13px',
                              color: '#0d766e',
                              fontWeight: 700,
                              background: '#f0fdfa',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              border: '1px solid #99f6e4',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                            }}
                            title="Click to view the publication Table of Contents"
                          >
                            <AppIcon name="layers" size={14} color="#0d766e" />
                            <span>{b.publication_count} Publications Included &rarr;</span>
                          </button>
                        </div>

                        <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                          Official publication compilation cataloging peer-reviewed discoveries and faculty achievements.
                        </p>
                      </div>

                      {/* Prominent Action Bar: Read Online Primary, Download PDF Secondary */}
                      <div
                        style={{
                          padding: '16px 22px',
                          background: '#f8fafc',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {/* Primary Action: Read Online in Integrated Reader */}
                        <button
                          type="button"
                          onClick={() => setPdfReadingIssue(b)}
                          style={{
                            width: '100%',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '11px 18px',
                            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                            color: '#ffffff',
                            border: '1px solid #14b8a6',
                            borderRadius: '10px',
                            fontSize: '13.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)',
                            transition: 'all 0.15s ease',
                          }}
                          title="Read this issue in the integrated digital reader"
                        >
                          <AppIcon name="book-open" size={16} color="#ffffff" />
                          <span>Read Online</span>
                        </button>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {/* Secondary Action: Download PDF */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDownloadBulletin(b)}
                            disabled={isDownloading}
                            aria-label={`Download ${b.title}`}
                            style={{ flex: 1, justifyContent: 'center', fontSize: '12.5px' }}
                          >
                            {isDownloading ? 'Preparing...' : 'Download PDF \u2193'}
                          </Button>

                          {/* Tertiary Action: View Details */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedIssueDetail(b)}
                            style={{ flex: 1, justifyContent: 'center', color: '#0d766e', borderColor: '#99f6e4', fontSize: '12.5px' }}
                          >
                            View Issue Details &rarr;
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
       * 4. PROPER IN-BROWSER DIGITAL PDF VIEWER
       * ========================================================================= */}
      {pdfReadingIssue && (
        <SamikshaPdfViewer
          bulletin={pdfReadingIssue}
          onClose={() => setPdfReadingIssue(null)}
          onDownload={() => onDownloadBulletin(pdfReadingIssue)}
        />
      )}
    </div>
  );
};
