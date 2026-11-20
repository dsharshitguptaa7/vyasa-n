import React, { useState, useMemo } from 'react';
import type {
  AnudaanPublicSanctionOut,
  AnudaanPublicShowcaseCyclesResponse,
} from '../types/anudaan';
import './InstitutionalIncentiveRecipients.css';

interface InstitutionalIncentiveRecipientsProps {
  sanctions: AnudaanPublicSanctionOut[];
  showcaseCycles: AnudaanPublicShowcaseCyclesResponse | null;
  loading: boolean;
  selectedYear: string;
  onYearChange: (year: string) => void;
  availableYears?: string[];
  totalSanctionsFromStats?: number;
}

export const InstitutionalIncentiveRecipients: React.FC<InstitutionalIncentiveRecipientsProps> = ({
  sanctions,
  showcaseCycles,
  loading,
  selectedYear,
  onYearChange,
  availableYears,
  totalSanctionsFromStats,
}) => {
  // Local filtering states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedQuartile, setSelectedQuartile] = useState<string>('ALL');
  const [selectedVolIssue, setSelectedVolIssue] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Format currency in Indian locale (₹)
  const formatCurrency = (val: number | string | undefined): string => {
    const num = Number(val || 0);
    return num.toLocaleString('en-IN');
  };

  // Helper for Quartile Pill
  const renderQuartileBadge = (q: string | undefined) => {
    const qNorm = (q || 'Q1').toUpperCase();
    let badgeClass = 'vyasa-quartile-pill--q1';
    if (qNorm === 'Q2') badgeClass = 'vyasa-quartile-pill--q2';
    else if (qNorm === 'Q3') badgeClass = 'vyasa-quartile-pill--q3';
    else if (qNorm === 'Q4') badgeClass = 'vyasa-quartile-pill--q4';

    return <span className={`vyasa-quartile-pill ${badgeClass}`}>{qNorm}</span>;
  };

  // Unify and enrich published sanctions from public API and cycle metadata
  const allSanctions: AnudaanPublicSanctionOut[] = useMemo(() => {
    // If stats explicitly report 0 published sanctions, treat dataset as empty
    if (totalSanctionsFromStats === 0) return [];

    const map = new Map<string, AnudaanPublicSanctionOut>();

    // 1. Add all direct published sanction entries
    for (const s of sanctions) {
      map.set(s.id, { ...s });
    }

    // 2. Enrich with Volume and Issue from completed cycles if present
    if (showcaseCycles?.completed_cycles) {
      for (const c of showcaseCycles.completed_cycles) {
        if (c.sanctions) {
          for (const s of c.sanctions) {
            const existing = map.get(s.id);
            if (existing) {
              if (!existing.volume_number && c.volume_number) existing.volume_number = c.volume_number;
              if (!existing.issue_number && c.issue_number) existing.issue_number = c.issue_number;
              if (!existing.cycle_display_title && c.display_title) existing.cycle_display_title = c.display_title;
              if (!existing.felicitation_date && c.felicitation_date) existing.felicitation_date = c.felicitation_date;
            } else {
              map.set(s.id, {
                ...s,
                volume_number: s.volume_number || c.volume_number,
                issue_number: s.issue_number || c.issue_number,
                cycle_display_title: s.cycle_display_title || c.display_title,
                felicitation_date: s.felicitation_date || c.felicitation_date,
              });
            }
          }
        }
      }
    }

    return Array.from(map.values());
  }, [sanctions, showcaseCycles, totalSanctionsFromStats]);

  // Extract distinct Volume & Issue pairs present in actual records
  const availableVolIssues = useMemo(() => {
    const set = new Map<string, { volume: number; issue: number; label: string }>();
    for (const s of allSanctions) {
      if (s.volume_number && s.issue_number) {
        const key = `${s.volume_number}-${s.issue_number}`;
        if (!set.has(key)) {
          set.set(key, {
            volume: s.volume_number,
            issue: s.issue_number,
            label: `Volume ${s.volume_number} · Issue ${s.issue_number}`,
          });
        }
      }
    }
    return Array.from(set.values()).sort((a, b) => {
      if (b.volume !== a.volume) return b.volume - a.volume;
      return b.issue - a.issue;
    });
  }, [allSanctions]);

  // Dynamic filter application across all published sanction records
  const filteredSanctions = useMemo(() => {
    return allSanctions.filter((s) => {
      // 1. Quartile Filter
      if (selectedQuartile !== 'ALL' && s.quartile !== selectedQuartile) {
        return false;
      }

      // 2. Volume & Issue Filter
      if (selectedVolIssue !== 'ALL') {
        const [volStr, issStr] = selectedVolIssue.split('-');
        if (
          s.volume_number !== Number(volStr) ||
          s.issue_number !== Number(issStr)
        ) {
          return false;
        }
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (s.researcher_name || '').toLowerCase();
        const title = (s.publication_title || '').toLowerCase();
        const dept = (s.department_name || '').toLowerCase();
        const proj = (s.project_title || '').toLowerCase();
        if (
          !name.includes(q) &&
          !title.includes(q) &&
          !dept.includes(q) &&
          !proj.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allSanctions, selectedQuartile, selectedVolIssue, searchQuery]);

  // Dynamically calculated summary statistics
  const summaryStats = useMemo(() => {
    let totalAmount = 0;
    const uniqueResearchersSet = new Set<string>();
    const quartiles: Record<string, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

    for (const s of filteredSanctions) {
      totalAmount += Number(s.sanctioned_amount || 0);
      if (s.researcher_name) {
        uniqueResearchersSet.add(s.researcher_name.trim().toLowerCase());
      }
      if (s.quartile && quartiles[s.quartile] !== undefined) {
        quartiles[s.quartile] += 1;
      }
    }

    return {
      uniqueResearchers: uniqueResearchersSet.size,
      totalEntries: filteredSanctions.length,
      totalAmount,
      quartiles,
    };
  }, [filteredSanctions]);

  const upcomingCycles = showcaseCycles?.upcoming_cycles || [];

  return (
    <div className="vyasa-recipients" id="institutional-incentive-recipients">
      {/* =================================================================== */}
      {/* 1. SECTION HEADER */}
      {/* =================================================================== */}
      <div className="vyasa-recipients__header">
        <div className="vyasa-recipients__title-row">
          <div>
            <div className="vyasa-recipients__eyebrow">
              <span>Institutional Felicitation Showcase (Volume &amp; Issue)</span>
            </div>
            <h3 className="vyasa-recipients__title">
              Institutional Incentive Recipients
            </h3>
            <p className="vyasa-recipients__subtitle">
              Recognising researchers whose scholarly contributions have received official institutional incentive sanctions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* View Mode Toggle */}
            <div style={{ display: 'flex', border: '1px solid #CBD5E1', borderRadius: 6, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'cards' ? '#0B2545' : '#FFFFFF',
                  color: viewMode === 'cards' ? '#FFFFFF' : '#475569',
                }}
                aria-label="Cards view"
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'table' ? '#0B2545' : '#FFFFFF',
                  color: viewMode === 'table' ? '#FFFFFF' : '#475569',
                }}
                aria-label="Table view"
              >
                Table
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. DYNAMIC SUMMARY STATISTICS BANNER */}
      {/* =================================================================== */}
      {filteredSanctions.length > 0 && (
        <div className="vyasa-recipients__stats-grid">
          {/* Stat 1: Unique Researchers */}
          <div className="vyasa-recipients__stat-item">
            <div className="vyasa-recipients__stat-label">Unique Scholars Recognised</div>
            <div className="vyasa-recipients__stat-value">{summaryStats.uniqueResearchers}</div>
          </div>

          {/* Stat 2: Total Sanctions Count */}
          <div className="vyasa-recipients__stat-item">
            <div className="vyasa-recipients__stat-label">Published Sanction Entries</div>
            <div className="vyasa-recipients__stat-value">{summaryStats.totalEntries}</div>
          </div>

          {/* Stat 3: Total Sanctioned Amount */}
          <div className="vyasa-recipients__stat-item">
            <div className="vyasa-recipients__stat-label">Total Sanctioned Grants</div>
            <div className="vyasa-recipients__stat-value vyasa-recipients__stat-value--amount">
              ₹ {formatCurrency(summaryStats.totalAmount)}
            </div>
          </div>

          {/* Stat 4: Quartile Distribution */}
          <div className="vyasa-recipients__stat-item">
            <div className="vyasa-recipients__stat-label">Quartile Distribution</div>
            <div className="vyasa-recipients__quartiles-row">
              <span className="vyasa-quartile-pill vyasa-quartile-pill--q1">
                Q1: {summaryStats.quartiles.Q1}
              </span>
              <span className="vyasa-quartile-pill vyasa-quartile-pill--q2">
                Q2: {summaryStats.quartiles.Q2}
              </span>
              <span className="vyasa-quartile-pill vyasa-quartile-pill--q3">
                Q3: {summaryStats.quartiles.Q3}
              </span>
              <span className="vyasa-quartile-pill vyasa-quartile-pill--q4">
                Q4: {summaryStats.quartiles.Q4}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. MULTI-DIMENSIONAL FILTERS BAR */}
      {/* =================================================================== */}
      <div className="vyasa-recipients__filters-bar">
        <div className="vyasa-recipients__filters-left">
          {/* Search Box */}
          <div className="vyasa-recipients__search-box">
            <svg
              className="vyasa-recipients__search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="vyasa-recipients__search-input"
              placeholder="Search researcher, publication, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search incentive records"
            />
          </div>

          {/* Academic Year Filter */}
          <div className="vyasa-recipients__select-group">
            <label htmlFor="recipients-year-select" className="vyasa-recipients__filter-label">
              Academic Year:
            </label>
            <select
              id="recipients-year-select"
              className="vyasa-recipients__select"
              value={selectedYear}
              onChange={(e) => onYearChange(e.target.value)}
              aria-label="Filter by Academic Year"
            >
              <option value="ALL">All Periods (Consolidated)</option>
              {(availableYears || ['2026-2027', '2025-2026']).map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Quartile Filter */}
          <div className="vyasa-recipients__select-group">
            <label htmlFor="recipients-quartile-select" className="vyasa-recipients__filter-label">
              Quartile:
            </label>
            <select
              id="recipients-quartile-select"
              className="vyasa-recipients__select"
              value={selectedQuartile}
              onChange={(e) => setSelectedQuartile(e.target.value)}
              aria-label="Filter by Quartile"
            >
              <option value="ALL">All Quartiles</option>
              <option value="Q1">Q1 (Highest Impact)</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </div>

          {/* Volume & Issue Filter (if available) */}
          {availableVolIssues.length > 0 && (
            <div className="vyasa-recipients__select-group">
              <label htmlFor="recipients-vol-select" className="vyasa-recipients__filter-label">
                Showcase Cycle:
              </label>
              <select
                id="recipients-vol-select"
                className="vyasa-recipients__select"
                value={selectedVolIssue}
                onChange={(e) => setSelectedVolIssue(e.target.value)}
                aria-label="Filter by Volume and Issue"
              >
                <option value="ALL">All Volumes &amp; Issues</option>
                {availableVolIssues.map((v) => (
                  <option key={`${v.volume}-${v.issue}`} value={`${v.volume}-${v.issue}`}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Records Count Badge */}
        <div className="vyasa-recipients__records-count">
          Showing <strong>{filteredSanctions.length}</strong> of{' '}
          <strong>{allSanctions.length}</strong> published records
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. RECIPIENT RECORDS LISTING */}
      {/* =================================================================== */}
      {loading ? (
        <div className="vyasa-recipients__empty-box">
          Loading institutional incentive recipient records...
        </div>
      ) : filteredSanctions.length === 0 ? (
        <div className="vyasa-recipients__empty-box">
          No published felicitation cycles found for this period. No published institutional incentive records match the selected criteria.
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="vyasa-recipients__grid">
          {filteredSanctions.map((s) => (
            <div key={s.id} className="vyasa-recipients__card">
              <div>
                {/* Top Card Row */}
                <div className="vyasa-recipients__card-top">
                  <div>
                    <h4 className="vyasa-recipients__card-researcher">
                      {s.researcher_name}
                    </h4>
                    <div
                      className={`vyasa-recipients__card-dept ${
                        !s.department_name ? 'vyasa-recipients__card-dept--missing' : ''
                      }`}
                    >
                      {s.department_name ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                            <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                          </svg>
                          <span>{s.department_name}</span>
                        </>
                      ) : (
                        <span>Department not specified</span>
                      )}
                    </div>
                  </div>

                  {renderQuartileBadge(s.quartile)}
                </div>

                {/* Publication Details */}
                <div className="vyasa-recipients__card-pub-box">
                  <div className="vyasa-recipients__card-pub-label">Recognised Publication</div>
                  <div className="vyasa-recipients__card-pub-title">
                    &ldquo;<span>{s.publication_title}</span>&rdquo;
                  </div>
                  {s.project_title && (
                    <div className="vyasa-recipients__card-project">
                      <strong>Project / Lab:</strong> {s.project_title}
                    </div>
                  )}
                </div>

                {/* Metadata Row */}
                <div className="vyasa-recipients__card-meta-row">
                  <div>
                    {s.volume_number && s.issue_number ? (
                      <span className="vyasa-recipients__cycle-tag">
                        VOLUME {s.volume_number} — ISSUE {s.issue_number}
                      </span>
                    ) : (
                      <span className="vyasa-recipients__cycle-tag vyasa-recipients__cycle-tag--direct">
                        Direct Sanction
                      </span>
                    )}
                  </div>

                  <div>
                    <strong>Period:</strong> {s.academic_year}
                  </div>
                </div>
              </div>

              {/* Footer Row */}
              <div className="vyasa-recipients__card-footer">
                <div>
                  <div className="vyasa-recipients__amount-label">Sanctioned Amount</div>
                  <div className="vyasa-recipients__amount-value">
                    ₹ {formatCurrency(s.sanctioned_amount)}
                  </div>
                </div>

                <div className="vyasa-recipients__date-badge">
                  {s.sanction_date && (
                    <span>
                      Sanctioned: <strong>{String(s.sanction_date)}</strong>
                    </span>
                  )}
                  {s.felicitation_date && (
                    <span>
                      Ceremony: <strong>{String(s.felicitation_date)}</strong>
                    </span>
                  )}
                  {s.cycle_status && (
                    <span style={{ fontSize: '0.7rem', color: '#047857', fontWeight: 700 }}>
                      ✓ {s.cycle_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Structured Table View */
        <div className="vyasa-recipients__table-wrapper">
          <table className="vyasa-recipients__table">
            <thead>
              <tr>
                <th>Researcher</th>
                <th>Department</th>
                <th>Publication Title</th>
                <th>Quartile</th>
                <th>Volume &amp; Issue</th>
                <th>Period</th>
                <th>Sanction Date</th>
                <th>Sanctioned Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredSanctions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong style={{ color: '#0B2545', fontSize: '0.95rem' }}>
                      {s.researcher_name}
                    </strong>
                    {s.project_title && (
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: 2 }}>
                        {s.project_title}
                      </div>
                    )}
                  </td>
                  <td>
                    {s.department_name || (
                      <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>
                        Department not specified
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 360, minWidth: 260 }}>
                    <div style={{ fontWeight: 600, color: '#1E293B', lineHeight: 1.4 }}>
                      &ldquo;<span>{s.publication_title}</span>&rdquo;
                    </div>
                  </td>
                  <td>{renderQuartileBadge(s.quartile)}</td>
                  <td>
                    {s.volume_number && s.issue_number ? (
                      <span className="vyasa-recipients__cycle-tag">
                        VOLUME {s.volume_number} — ISSUE {s.issue_number}
                      </span>
                    ) : (
                      <span className="vyasa-recipients__cycle-tag vyasa-recipients__cycle-tag--direct">
                        Direct Sanction
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{s.academic_year}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                      {s.sanction_date || s.felicitation_date || '—'}
                    </span>
                  </td>
                  <td>
                    <strong style={{ color: '#047857', fontSize: '1rem' }}>
                      ₹ {formatCurrency(s.sanctioned_amount)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. UPCOMING CEREMONIES NOTICE (IF ANY CYCLE IS SCHEDULED) */}
      {/* =================================================================== */}
      {upcomingCycles.length > 0 && (
        <div style={{ marginTop: 28 }}>
          {upcomingCycles.map((c) => (
            <div key={c.id} className="vyasa-recipients__notice" role="note">
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
                      Academic Year: {c.academic_year}
                    </span>
                  )}
                </div>
                <h5 className="vyasa-recipients__notice-title">
                  {c.display_title || `Upcoming Research Felicitation Ceremony (Vol. ${c.volume_number}, Iss. ${c.issue_number})`}
                </h5>
                <p className="vyasa-recipients__notice-text">
                  Nominations / sanctions for this cycle are currently being finalized in accordance with CSJMU Research Incentive Guidelines. Sanction details will be published following the felicitation ceremony.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
