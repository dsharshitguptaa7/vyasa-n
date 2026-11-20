import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type {
  AnudaanPublicShowcaseCyclesResponse,
  AnudaanPublicFelicitationCycleOut,
  AnudaanPublicSanctionOut,
} from '../types/anudaan';
import './FelicitationShowcase.css';

interface FelicitationShowcaseProps {
  showcaseCycles: AnudaanPublicShowcaseCyclesResponse | null;
  loading: boolean;
  selectedYear: string;
  onYearChange?: (year: string) => void;
  availableYears?: string[];
}

export const FelicitationShowcase: React.FC<FelicitationShowcaseProps> = ({
  showcaseCycles,
  loading,
  selectedYear,
  onYearChange,
  availableYears,
}) => {
  // Quartile filter state
  const [selectedQuartile, setSelectedQuartile] = useState<string>('ALL');

  // Active Issue / Cycle ID
  const [activeCycleId, setActiveCycleId] = useState<string>('');

  // Spotlight index within the selected issue
  const [spotlightIndex, setSpotlightIndex] = useState<number>(0);

  // Hover / Focus pause flags
  const [isIssueNavHovered, setIsIssueNavHovered] = useState<boolean>(false);
  const [isSpotlightHovered, setIsSpotlightHovered] = useState<boolean>(false);

  // Reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);

  // Touch coordinates for mobile swipe
  const touchStartXRef = useRef<number | null>(null);

  // References for auto-advance timers
  const issueTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spotlightTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navScrollRef = useRef<HTMLDivElement | null>(null);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  // 1. Group and sort all published cycles (newest Volume & Issue first)
  const sortedCycles: AnudaanPublicFelicitationCycleOut[] = useMemo(() => {
    if (!showcaseCycles) return [];

    const all = [
      ...(showcaseCycles.completed_cycles || []),
      ...(showcaseCycles.upcoming_cycles || []),
    ];

    // De-duplicate by cycle ID just in case
    const uniqueMap = new Map<string, AnudaanPublicFelicitationCycleOut>();
    for (const c of all) {
      if (!uniqueMap.has(c.id)) {
        uniqueMap.set(c.id, c);
      }
    }

    const uniqueList = Array.from(uniqueMap.values());

    // Sort newest first: volume_number DESC, then issue_number DESC
    uniqueList.sort((a, b) => {
      if (b.volume_number !== a.volume_number) {
        return b.volume_number - a.volume_number;
      }
      return b.issue_number - a.issue_number;
    });

    return uniqueList;
  }, [showcaseCycles]);

  // Cycles with published sanctions vs upcoming ceremonies without sanctions
  const cyclesWithSanctions = useMemo(() => {
    return sortedCycles.filter((c) => c.sanctions && c.sanctions.length > 0);
  }, [sortedCycles]);

  const upcomingWithoutSanctions = useMemo(() => {
    return sortedCycles.filter((c) => (!c.sanctions || c.sanctions.length === 0));
  }, [sortedCycles]);

  // Set default active cycle when sortedCycles change (prefer newest cycle with published sanctions)
  useEffect(() => {
    if (sortedCycles.length > 0) {
      if (!activeCycleId || !sortedCycles.some((c) => c.id === activeCycleId)) {
        const defaultCycle = cyclesWithSanctions.length > 0 ? cyclesWithSanctions[0] : sortedCycles[0];
        setActiveCycleId(defaultCycle.id);
        setSpotlightIndex(0);
      }
    } else {
      setActiveCycleId('');
      setSpotlightIndex(0);
    }
  }, [sortedCycles, cyclesWithSanctions, activeCycleId]);

  // Currently active cycle
  const activeCycle = useMemo(() => {
    return sortedCycles.find((c) => c.id === activeCycleId) || sortedCycles[0] || null;
  }, [sortedCycles, activeCycleId]);

  // 2. Compute aggregate showcase statistics across all published records for this period
  const aggregateStats = useMemo(() => {
    let totalIncentive = 0;
    const distinctResearchers = new Set<string>();
    const quartiles: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    let totalSanctions = 0;

    for (const c of sortedCycles) {
      if (c.sanctions && c.sanctions.length > 0) {
        for (const s of c.sanctions) {
          totalSanctions += 1;
          totalIncentive += Number(s.sanctioned_amount || 0);
          if (s.researcher_name) {
            distinctResearchers.add(s.researcher_name.trim().toLowerCase());
          }
          if (s.quartile && quartiles[s.quartile] !== undefined) {
            quartiles[s.quartile] += 1;
          }
        }
      }
    }

    return {
      totalResearchers: distinctResearchers.size,
      totalIncentive,
      totalCycles: sortedCycles.length,
      quartiles,
      totalSanctions,
    };
  }, [sortedCycles]);

  // 3. Filtered sanctions for the active cycle based on selected quartile
  const activeFilteredSanctions = useMemo(() => {
    if (!activeCycle || !activeCycle.sanctions) return [];
    if (selectedQuartile === 'ALL') return activeCycle.sanctions;
    return activeCycle.sanctions.filter((s) => s.quartile === selectedQuartile);
  }, [activeCycle, selectedQuartile]);

  // Reset spotlight index when active cycle or quartile filter changes
  useEffect(() => {
    setSpotlightIndex(0);
  }, [activeCycleId, selectedQuartile]);

  // Clamp spotlight index if filtered list changes
  useEffect(() => {
    if (spotlightIndex >= activeFilteredSanctions.length && activeFilteredSanctions.length > 0) {
      setSpotlightIndex(0);
    }
  }, [activeFilteredSanctions.length, spotlightIndex]);

  // 4. Issue Auto-Advance: every 11s if multiple cycles exist, not hovered, and reduced motion not set
  const handleNextIssue = useCallback(() => {
    if (sortedCycles.length <= 1) return;
    const currentIndex = sortedCycles.findIndex((c) => c.id === activeCycleId);
    const nextIndex = (currentIndex + 1) % sortedCycles.length;
    setActiveCycleId(sortedCycles[nextIndex].id);
  }, [sortedCycles, activeCycleId]);

  const handlePrevIssue = useCallback(() => {
    if (sortedCycles.length <= 1) return;
    const currentIndex = sortedCycles.findIndex((c) => c.id === activeCycleId);
    const prevIndex = (currentIndex - 1 + sortedCycles.length) % sortedCycles.length;
    setActiveCycleId(sortedCycles[prevIndex].id);
  }, [sortedCycles, activeCycleId]);

  useEffect(() => {
    if (issueTimerRef.current) clearInterval(issueTimerRef.current);

    if (
      sortedCycles.length > 1 &&
      !isIssueNavHovered &&
      !prefersReducedMotion
    ) {
      issueTimerRef.current = setInterval(() => {
        handleNextIssue();
      }, 11000); // 11 seconds (within 10-12s spec)
    }

    return () => {
      if (issueTimerRef.current) clearInterval(issueTimerRef.current);
    };
  }, [sortedCycles.length, isIssueNavHovered, prefersReducedMotion, handleNextIssue]);

  // 5. Researcher Spotlight Auto-Rotation: every 7.5s inside selected issue if multiple researchers exist
  const handleNextSpotlight = useCallback(() => {
    if (activeFilteredSanctions.length <= 1) return;
    setSpotlightIndex((prev) => (prev + 1) % activeFilteredSanctions.length);
  }, [activeFilteredSanctions.length]);

  const handlePrevSpotlight = useCallback(() => {
    if (activeFilteredSanctions.length <= 1) return;
    setSpotlightIndex((prev) => (prev - 1 + activeFilteredSanctions.length) % activeFilteredSanctions.length);
  }, [activeFilteredSanctions.length]);

  useEffect(() => {
    if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);

    if (
      activeFilteredSanctions.length > 1 &&
      !isSpotlightHovered &&
      !prefersReducedMotion
    ) {
      spotlightTimerRef.current = setInterval(() => {
        handleNextSpotlight();
      }, 7500); // 7.5 seconds (within 7-8s spec)
    }

    return () => {
      if (spotlightTimerRef.current) clearInterval(spotlightTimerRef.current);
    };
  }, [activeFilteredSanctions.length, isSpotlightHovered, prefersReducedMotion, handleNextSpotlight]);

  // 6. Mobile Touch Swipe Handlers for Spotlight
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartXRef.current - touchEndX;

    if (Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNextSpotlight();
      } else {
        handlePrevSpotlight();
      }
    }
    touchStartXRef.current = null;
  };

  // Helper formatting functions
  const formatCurrency = (val: number | string | undefined): string => {
    const num = Number(val || 0);
    return num.toLocaleString('en-IN');
  };

  // Helper for Quartile Pill
  const renderQuartileBadge = (q: string | undefined) => {
    const qNorm = (q || 'Q1').toUpperCase();
    let badgeClass = 'vyasa-showcase__quartile-pill--q1';
    if (qNorm === 'Q2') badgeClass = 'vyasa-showcase__quartile-pill--q2';
    else if (qNorm === 'Q3') badgeClass = 'vyasa-showcase__quartile-pill--q3';
    else if (qNorm === 'Q4') badgeClass = 'vyasa-showcase__quartile-pill--q4';

    return (
      <span
        className={`vyasa-showcase__quartile-pill ${badgeClass}`}
        style={{ fontSize: '0.8rem', padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}
      >
        {qNorm}
      </span>
    );
  };

  // Current featured researcher
  const featuredResearcher: AnudaanPublicSanctionOut | null =
    activeFilteredSanctions[spotlightIndex] || null;

  return (
    <div className="vyasa-showcase" id="institutional-felicitation-showcase">
      {/* =================================================================== */}
      {/* A. SHOWCASE HEADER & INSTITUTIONAL STATISTICS */}
      {/* =================================================================== */}
      <div className="vyasa-showcase__header">
        <div className="vyasa-showcase__title-row">
          <div>
            <h3 className="vyasa-showcase__title">
              Institutional Felicitation Showcase (Volume &amp; Issue)
            </h3>
            <p className="vyasa-showcase__subtitle">
              Celebrating scholarly contributions and institutional research excellence across university publication cycles.
            </p>
          </div>

          {/* Academic Year and Quartile Filters */}
          <div className="vyasa-showcase__filter-group">
            {onYearChange && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="vyasa-showcase__filter-label">Period:</span>
                <select
                  className="vyasa-showcase__select"
                  value={selectedYear}
                  onChange={(e) => onYearChange(e.target.value)}
                  aria-label="Filter showcase by Academic Year"
                >
                  <option value="ALL">All Periods (Consolidated)</option>
                  {(availableYears || ['2026-2027', '2025-2026']).map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="vyasa-showcase__filter-label">Quartile:</span>
              <select
                className="vyasa-showcase__select"
                value={selectedQuartile}
                onChange={(e) => setSelectedQuartile(e.target.value)}
                aria-label="Filter showcase by Quartile"
              >
                <option value="ALL">All Quartiles</option>
                <option value="Q1">Q1 (Highest Impact)</option>
                <option value="Q2">Q2</option>
                <option value="Q3">Q3</option>
                <option value="Q4">Q4</option>
              </select>
            </div>
          </div>
        </div>

        {/* Global Statistics Grid (Rendered when cycles exist) */}
        {sortedCycles.length > 0 && (
          <div className="vyasa-showcase__stats-grid">
            <div className="vyasa-showcase__stat-item">
              <div className="vyasa-showcase__stat-label">Scholars Recognised</div>
              <div className="vyasa-showcase__stat-value">{aggregateStats.totalResearchers}</div>
            </div>

            <div className="vyasa-showcase__stat-item">
              <div className="vyasa-showcase__stat-label">Total Sanctioned Incentives</div>
              <div className="vyasa-showcase__stat-value">
                ₹ {formatCurrency(aggregateStats.totalIncentive)}
              </div>
            </div>

            <div className="vyasa-showcase__stat-item">
              <div className="vyasa-showcase__stat-label">Felicitation Cycles</div>
              <div className="vyasa-showcase__stat-value">{aggregateStats.totalCycles}</div>
            </div>

            <div className="vyasa-showcase__stat-item">
              <div className="vyasa-showcase__stat-label">Quartile Distribution</div>
              <div className="vyasa-showcase__quartiles-row">
                <span className="vyasa-showcase__quartile-pill vyasa-showcase__quartile-pill--q1">
                  Q1: {aggregateStats.quartiles.Q1}
                </span>
                <span className="vyasa-showcase__quartile-pill vyasa-showcase__quartile-pill--q2">
                  Q2: {aggregateStats.quartiles.Q2}
                </span>
                <span className="vyasa-showcase__quartile-pill vyasa-showcase__quartile-pill--q3">
                  Q3: {aggregateStats.quartiles.Q3}
                </span>
                <span className="vyasa-showcase__quartile-pill vyasa-showcase__quartile-pill--q4">
                  Q4: {aggregateStats.quartiles.Q4}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* LOADING OR EMPTY FALLBACK STATES */}
      {/* =================================================================== */}
      {loading ? (
        <div className="vyasa-showcase__empty-box">
          Loading institutional felicitation showcase...
        </div>
      ) : sortedCycles.length === 0 ? (
        <div className="vyasa-showcase__empty-box">
          No published felicitation cycles found for this period.
        </div>
      ) : (
        <>
          {/* =================================================================== */}
          {/* B. ISSUE NAVIGATION SYSTEM */}
          {/* =================================================================== */}
          <div
            className="vyasa-showcase__nav-section"
            onMouseEnter={() => setIsIssueNavHovered(true)}
            onMouseLeave={() => setIsIssueNavHovered(false)}
            onFocus={() => setIsIssueNavHovered(true)}
            onBlur={() => setIsIssueNavHovered(false)}
            role="region"
            aria-label="Felicitation Issue Navigation"
          >
            {sortedCycles.length > 1 && (
              <button
                type="button"
                className="vyasa-showcase__arrow-btn"
                onClick={handlePrevIssue}
                title="Previous Issue"
                aria-label="Previous Felicitation Issue"
              >
                ‹
              </button>
            )}

            <div className="vyasa-showcase__nav-scroll" ref={navScrollRef}>
              {sortedCycles.map((c) => {
                const isActive = c.id === activeCycleId;
                const hasSanctions = c.sanctions && c.sanctions.length > 0;
                const isUpcomingWithoutSanctions = c.status === 'UPCOMING' && !hasSanctions;

                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`vyasa-showcase__issue-tab ${isActive ? 'vyasa-showcase__issue-tab--active' : ''}`}
                    onClick={() => {
                      setActiveCycleId(c.id);
                      setSpotlightIndex(0);
                    }}
                    aria-selected={isActive}
                    role="tab"
                  >
                    <span>Volume {c.volume_number} · Issue {c.issue_number}</span>
                    {isUpcomingWithoutSanctions ? (
                      <span className="vyasa-showcase__issue-tag vyasa-showcase__issue-tag--upcoming">
                        Upcoming
                      </span>
                    ) : (
                      <span className="vyasa-showcase__issue-tag vyasa-showcase__issue-tag--completed">
                        {c.sanctions.length} {c.sanctions.length === 1 ? 'Scholar' : 'Scholars'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {sortedCycles.length > 1 && (
              <button
                type="button"
                className="vyasa-showcase__arrow-btn"
                onClick={handleNextIssue}
                title="Next Issue"
                aria-label="Next Felicitation Issue"
              >
                ›
              </button>
            )}
          </div>

          {/* =================================================================== */}
          {/* SELECTED ISSUE BANNER & METADATA */}
          {/* =================================================================== */}
          {activeCycle && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        backgroundColor: '#0B2545',
                        color: '#FFFFFF',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 6,
                        letterSpacing: '0.04em',
                      }}
                    >
                      VOLUME {activeCycle.volume_number} — ISSUE {activeCycle.issue_number}
                    </span>
                    <span
                      style={{
                        backgroundColor: activeCycle.status === 'COMPLETED' ? '#ECFDF5' : '#FEF3C7',
                        color: activeCycle.status === 'COMPLETED' ? '#065F46' : '#92400E',
                        border: `1px solid ${activeCycle.status === 'COMPLETED' ? '#A7F3D0' : '#FDE68A'}`,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {activeCycle.status}
                    </span>
                    {activeCycle.academic_year && (
                      <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        Academic Year: {activeCycle.academic_year}
                      </span>
                    )}
                  </div>

                  <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0B2545', margin: '8px 0 4px' }}>
                    {activeCycle.display_title || `Research Felicitation Assembly (Vol. ${activeCycle.volume_number}, Iss. ${activeCycle.issue_number})`}
                  </h4>
                  {activeCycle.description && (
                    <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0, maxWidth: 740, lineHeight: 1.5 }}>
                      {activeCycle.description}
                    </p>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Issue Sanction Total
                  </div>
                  <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#065F46', marginTop: 2 }}>
                    ₹ {formatCurrency(activeCycle.total_sanctioned_amount)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                    {activeCycle.total_researchers} Researchers · {activeCycle.sanction_count} Sanctions
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* C. RESEARCHER SPOTLIGHT CAROUSEL */}
          {/* =================================================================== */}
          {activeCycle && activeCycle.sanctions && activeCycle.sanctions.length === 0 ? (
            /* Cycle has no sanctions recorded yet (Upcoming Ceremony) */
            <div className="vyasa-showcase__notice" role="note">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <h5 className="vyasa-showcase__notice-title">Institutional Notice</h5>
                <p className="vyasa-showcase__notice-text">
                  Nominations / sanctions for this cycle are currently being finalized. Sanction details will be published following the felicitation ceremony.
                </p>
              </div>
            </div>
          ) : activeFilteredSanctions.length === 0 ? (
            /* Cycle has sanctions, but none match the quartile filter */
            <div className="vyasa-showcase__empty-box" style={{ padding: '32px' }}>
              No recognized researchers match quartile filter <strong>{selectedQuartile}</strong> for this issue.
            </div>
          ) : featuredResearcher ? (
            /* Active Researcher Spotlight Card */
            <div
              className="vyasa-showcase__spotlight-wrapper"
              onMouseEnter={() => setIsSpotlightHovered(true)}
              onMouseLeave={() => setIsSpotlightHovered(false)}
              onFocus={() => setIsSpotlightHovered(true)}
              onBlur={() => setIsSpotlightHovered(false)}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              role="region"
              aria-roledescription="carousel"
              aria-label={`Researcher Spotlight for Volume ${activeCycle?.volume_number} Issue ${activeCycle?.issue_number}`}
            >
              {/* Spotlight Header Bar */}
              <div className="vyasa-showcase__spotlight-banner">
                <div className="vyasa-showcase__spotlight-eyebrow">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2563EB' }} />
                  <span>Researcher Spotlight • Vol {activeCycle?.volume_number} Iss {activeCycle?.issue_number}</span>
                </div>
                <div className="vyasa-showcase__spotlight-counter">
                  Scholar {spotlightIndex + 1} of {activeFilteredSanctions.length}
                </div>
              </div>

              {/* Spotlight Card Body */}
              <div className="vyasa-showcase__spotlight-card">
                <div className="vyasa-showcase__spotlight-content">
                  <div className="vyasa-showcase__researcher-details">
                    <h4 className="vyasa-showcase__researcher-name">
                      {featuredResearcher.researcher_name}
                    </h4>

                    {featuredResearcher.department_name ? (
                      <div className="vyasa-showcase__department">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                        </svg>
                        <span>{featuredResearcher.department_name}</span>
                      </div>
                    ) : (
                      <div className="vyasa-showcase__department">
                        <span>Recognized Faculty Scholar</span>
                      </div>
                    )}

                    <div className="vyasa-showcase__pub-box">
                      <div className="vyasa-showcase__pub-label">Recognized Publication</div>
                      <div className="vyasa-showcase__pub-title">
                        “{featuredResearcher.publication_title}”
                      </div>
                      {featuredResearcher.project_title && (
                        <div className="vyasa-showcase__project-title">
                          <strong>Associated Project:</strong> {featuredResearcher.project_title}
                        </div>
                      )}
                    </div>

                    <div className="vyasa-showcase__spotlight-meta-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Indexed Tier:</span>
                        {renderQuartileBadge(featuredResearcher.quartile)}
                      </div>

                      {featuredResearcher.academic_year && (
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          <strong>Period:</strong> {featuredResearcher.academic_year}
                        </div>
                      )}

                      {featuredResearcher.felicitation_date && (
                        <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          <strong>Ceremony Date:</strong> {featuredResearcher.felicitation_date}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Sanction Card */}
                  <div className="vyasa-showcase__amount-card">
                    <div className="vyasa-showcase__amount-label">Incentive Sanctioned</div>
                    <div className="vyasa-showcase__amount-value">
                      ₹ {formatCurrency(featuredResearcher.sanctioned_amount)}
                    </div>
                    <div className="vyasa-showcase__amount-subtext">
                      Approved Executive University Grant
                    </div>
                  </div>
                </div>
              </div>

              {/* Spotlight Controls Footer */}
              <div className="vyasa-showcase__spotlight-footer">
                <div className="vyasa-showcase__dots-row" role="tablist" aria-label="Spotlight slide indicators">
                  {activeFilteredSanctions.map((s, idx) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`vyasa-showcase__dot ${idx === spotlightIndex ? 'vyasa-showcase__dot--active' : ''}`}
                      onClick={() => setSpotlightIndex(idx)}
                      title={`Go to researcher ${idx + 1}: ${s.researcher_name}`}
                      aria-label={`Slide ${idx + 1} of ${activeFilteredSanctions.length}`}
                      aria-selected={idx === spotlightIndex}
                      role="tab"
                    />
                  ))}
                </div>

                {activeFilteredSanctions.length > 1 && (
                  <div className="vyasa-showcase__spotlight-actions">
                    <button
                      type="button"
                      className="vyasa-showcase__arrow-btn"
                      onClick={handlePrevSpotlight}
                      title="Previous Researcher"
                      aria-label="Previous Researcher"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="vyasa-showcase__arrow-btn"
                      onClick={handleNextSpotlight}
                      title="Next Researcher"
                      aria-label="Next Researcher"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* =================================================================== */}
          {/* D. COMPLETE RECIPIENT LIST ("Researchers Recognized in This Issue") */}
          {/* =================================================================== */}
          {activeCycle && activeFilteredSanctions.length > 0 && (
            <div className="vyasa-showcase__recipients-section">
              <div className="vyasa-showcase__recipients-header">
                <h4 className="vyasa-showcase__recipients-title">
                  <span>Researchers Recognized in This Issue</span>
                  <span className="vyasa-showcase__badge-count">
                    {activeFilteredSanctions.length} {activeFilteredSanctions.length === 1 ? 'Recipient' : 'Recipients'}
                  </span>
                </h4>
                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Select any card below to spotlight scholar profile
                </div>
              </div>

              <div className="vyasa-showcase__recipients-grid">
                {activeFilteredSanctions.map((s, idx) => {
                  const isFeatured = idx === spotlightIndex;
                  return (
                    <div
                      key={s.id}
                      className={`vyasa-showcase__recipient-card ${isFeatured ? 'vyasa-showcase__recipient-card--active' : ''}`}
                      onClick={() => setSpotlightIndex(idx)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSpotlightIndex(idx);
                        }
                      }}
                      aria-label={`View details for ${s.researcher_name}`}
                    >
                      <div>
                        <div className="vyasa-showcase__card-top">
                          <div>
                            <h5 className="vyasa-showcase__card-name">{s.researcher_name}</h5>
                            {s.department_name && (
                              <div className="vyasa-showcase__card-dept">{s.department_name}</div>
                            )}
                          </div>
                          {renderQuartileBadge(s.quartile)}
                        </div>

                        <div className="vyasa-showcase__card-title">
                          “<span>{s.publication_title}</span>”
                        </div>
                      </div>

                      <div className="vyasa-showcase__card-bottom">
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 600 }}>
                            Sanctioned Sum
                          </div>
                          <div className="vyasa-showcase__card-amount">
                            ₹ {formatCurrency(s.sanctioned_amount)}
                          </div>
                        </div>

                        {isFeatured ? (
                          <span className="vyasa-showcase__card-active-label">★ In Spotlight</span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#2563EB', fontWeight: 600 }}>
                            Spotlight &rarr;
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming Ceremonies without Sanctions (rendered when active cycle is completed) */}
          {upcomingWithoutSanctions.filter((c) => c.id !== activeCycleId).length > 0 && (
            <div style={{ marginTop: 32 }}>
              {upcomingWithoutSanctions
                .filter((c) => c.id !== activeCycleId)
                .map((c) => (
                  <div key={c.id} className="vyasa-showcase__notice" role="note" style={{ marginBottom: 16 }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <span
                          style={{
                            backgroundColor: '#B45309',
                            color: '#FFFFFF',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 4,
                            letterSpacing: '0.04em',
                          }}
                        >
                          VOLUME {c.volume_number} — ISSUE {c.issue_number}
                        </span>
                        <span
                          style={{
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            border: '1px solid #FDE68A',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                          }}
                        >
                          UPCOMING CEREMONY
                        </span>
                        {c.academic_year && (
                          <span style={{ fontSize: '0.78rem', color: '#78350F', fontWeight: 600 }}>
                            {c.academic_year}
                          </span>
                        )}
                      </div>
                      <h5 className="vyasa-showcase__notice-title" style={{ marginTop: 4 }}>
                        {c.display_title || `Upcoming Research Felicitation Ceremony (Vol. ${c.volume_number}, Iss. ${c.issue_number})`}
                      </h5>
                      <p className="vyasa-showcase__notice-text">
                        Nominations / sanctions for this cycle are currently being finalized. Sanction details will be published following the felicitation ceremony.
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
