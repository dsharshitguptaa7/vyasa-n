import React, { useEffect, useState } from 'react';
import { PageContainer, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import { AssociateDeanDashboardStats, GrievancePriority, GrievanceSummaryItem } from '../types/grievance';
import { useAuth } from '../../../../context/AuthContext';
import './CaseReview.css';

// Formatter to convert database enum strings like "Course_Work" -> "Course Work"
const formatLabel = (str?: string): string => {
  if (!str) return '—';
  return str.replace(/_/g, ' ');
};

export const AssociateDeanDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { authorityDesignation } = useAuth();

  const [cases, setCases] = useState<GrievanceSummaryItem[]>([]);
  const [stats, setStats] = useState<AssociateDeanDashboardStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const [statsRes, queueRes] = await Promise.all([
        grievanceService.getAssociateDeanDashboard().catch(() => null),
        grievanceService.getAssociateDeanGrievances({
          page,
          page_size: pageSize,
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          search: search.trim() || undefined,
          priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        }),
      ]);
      setStats(statsRes);
      setCases(queueRes.items);
      setTotal(queueRes.total);
      setTotalPages(Math.max(1, Math.ceil(queueRes.total / pageSize)));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve Associate Dean dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [page, statusFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadDashboardData();
  };

  const getPriorityBadgeVariant = (priority: GrievancePriority): 'saffron' | 'teal' => {
    switch (priority) {
      case 'URGENT':
      case 'HIGH':
        return 'saffron';
      case 'MEDIUM':
      case 'LOW':
      default:
        return 'teal';
    }
  };

  const pendingCount = stats?.pending ?? cases.filter(
    (c) => (c.status as string) === 'ASSIGNED' || (c.status as string) === 'PENDING_REVIEW'
  ).length;
  const inProgressCount = stats?.in_progress ?? cases.filter(
    (c) => (c.status as string) === 'IN_PROGRESS' || (c.status as string) === 'AWAITING_INFORMATION'
  ).length;
  const resolvedCount = stats?.resolved ?? cases.filter((c) => (c.status as string) === 'RESOLVED' || (c.status as string) === 'CLOSED').length;
  const escalatedCount = stats?.escalated ?? cases.filter((c) => (c.status as string) === 'ESCALATED').length;

  return (
    <PageContainer style={{ padding: '32px 0 60px' }}>
      {/* 1. Stately Scholarly Header */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--vyasa-navy)' }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading" style={{ fontSize: '21px' }}>
                  Associate Dean Jurisdictional Docket
                </h1>
                <Badge variant="teal">STAGE 2 JURISDICTION</Badge>
                {stats?.grievance_cluster_name && (
                  <Badge variant="teal">{stats.grievance_cluster_name}</Badge>
                )}
              </div>
              <p className="nivaran-case-meta" style={{ marginTop: '4px' }}>
                <span className="nivaran-case-meta__item">
                  Category cluster adjudication, evidence appraisal, direct redressal, and Dean R&amp;D escalation control.
                </span>
                {authorityDesignation && (
                  <>
                    <span className="nivaran-case-meta__separator">&bull;</span>
                    <span className="nivaran-case-meta__item" style={{ color: 'var(--vyasa-navy)', fontWeight: 600 }}>
                      Jurisdiction: {authorityDesignation}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              disabled={loading}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh Docket
            </Button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total Docket Cases</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{stats?.total_assigned ?? total}</div>
          <div className="nivaran-docket-kpi__subtext">Jurisdictionally assigned</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Pending Review</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#d97706' }}>{pendingCount}</div>
          <div className="nivaran-docket-kpi__subtext">Awaiting assessment</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">In Progress / Inquiry</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#0284c7' }}>{inProgressCount}</div>
          <div className="nivaran-docket-kpi__subtext">Under examination</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Formally Resolved</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#059669' }}>{resolvedCount}</div>
          <div className="nivaran-docket-kpi__subtext">Direct redressal committed</div>
        </div>

        <div className="nivaran-docket-kpi" style={{ '--kpi-accent': '#7c3aed' } as React.CSSProperties}>
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Escalated to Dean</span>
            <div className="nivaran-docket-kpi__icon-bubble" style={{ color: '#7c3aed' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 11 12 6 7 11" />
                <polyline points="17 18 12 13 7 18" />
              </svg>
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#7c3aed' }}>{escalatedCount}</div>
          <div className="nivaran-docket-kpi__subtext">Executive review tier</div>
        </div>
      </div>

      {/* 3. Refined Toolbar & Filter Controls */}
      <div className="nivaran-docket-toolbar">
        {/* Status Tabs */}
        <div className="nivaran-docket-tabs">
          {[
            { label: 'All Cases', value: 'ALL' },
            { label: 'Pending Review', value: 'PENDING' },
            { label: 'In Progress', value: 'IN_PROGRESS' },
            { label: 'Resolved', value: 'RESOLVED' },
            { label: 'Escalated to Dean', value: 'ESCALATED' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={`nivaran-docket-tab-btn ${statusFilter === tab.value ? 'nivaran-docket-tab-btn--active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority Select & Search Form */}
        <div className="nivaran-docket-controls">
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="nivaran-docket-select"
            aria-label="Filter by priority"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Critical / Urgent</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          <form onSubmit={handleSearchSubmit} className="nivaran-docket-search-wrap">
            <span className="nivaran-docket-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by Case ID, applicant, or keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nivaran-docket-search-input"
            />
            <Button size="sm" variant="primary" type="submit" style={{ marginLeft: '6px' }}>
              Filter Queue
            </Button>
            {search && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setPage(1);
                  loadDashboardData();
                }}
                style={{ marginLeft: '4px' }}
              >
                Clear
              </Button>
            )}
          </form>
        </div>
      </div>

      {/* 4. Docket Ledger Data Table */}
      {loading ? (
        <LoadingState message="Loading jurisdictional docket..." />
      ) : errorMsg ? (
        <div className="nivaran-docket-table-card" style={{ padding: '32px', textAlign: 'center', borderColor: '#fca5a5' }}>
          <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Error Accessing Docket
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>{errorMsg}</p>
          <Button variant="primary" onClick={loadDashboardData}>
            Retry Request
          </Button>
        </div>
      ) : cases.length === 0 ? (
        <div className="nivaran-docket-table-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <EmptyState
            title="No Jurisdictional Grievances Found"
            description={
              search || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'No grievances matched your active filter parameters. Try clearing filters.'
                : 'There are currently no grievances assigned to your Associate Dean cluster jurisdiction.'
            }
          />
        </div>
      ) : (
        <div className="nivaran-docket-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="nivaran-docket-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Case ID</th>
                  <th>Grievance Particulars</th>
                  <th style={{ width: '220px' }}>Subject &amp; Cluster</th>
                  <th style={{ width: '100px' }}>Priority</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '110px' }}>Submitted</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id} className="nivaran-docket-row">
                    {/* Monospace Tracking Badge */}
                    <td className="nivaran-docket-cell">
                      <span className="nivaran-tracking-pill">
                        {item.grievance_id}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="nivaran-docket-cell">
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)', lineHeight: 1.35 }}>
                        {item.title}
                      </div>
                    </td>

                    {/* Subject & Cluster */}
                    <td className="nivaran-docket-cell">
                      <div style={{ color: 'var(--vyasa-navy)', fontWeight: 600, fontSize: '13px' }}>
                        {formatLabel(item.subject_name) || 'Academic Subject'}
                      </div>
                      <div style={{ marginTop: '3px' }}>
                        <span className="nivaran-category-chip" title={formatLabel(item.final_category_name || item.category_name)}>
                          {formatLabel(item.final_category_name || item.category_name || 'Category')}
                        </span>
                      </div>
                    </td>

                    {/* Priority Badge */}
                    <td className="nivaran-docket-cell">
                      <Badge variant={getPriorityBadgeVariant(item.priority)} size="sm">
                        {item.priority}
                      </Badge>
                    </td>

                    {/* Status Badge */}
                    <td className="nivaran-docket-cell">
                      <Badge
                        variant={
                          item.status === 'RESOLVED' || item.status === 'CLOSED'
                            ? 'teal'
                            : (item.status as string) === 'ESCALATED'
                            ? 'primary'
                            : 'saffron'
                        }
                        size="sm"
                      >
                        {formatLabel(item.status)}
                      </Badge>
                    </td>

                    {/* Submitted Date */}
                    <td className="nivaran-docket-cell" style={{ color: '#64748b', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      {item.created_at
                        ? new Date(item.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>

                    {/* Actions */}
                    <td className="nivaran-docket-cell" style={{ textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() =>
                          navigate(`/modules/atharva-veda/nivaran/associate-dean/grievance/${item.id}`)
                        }
                      >
                        Review Dossier &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stately Pagination Footnote */}
          {totalPages > 1 && (
            <div className="nivaran-docket-pagination">
              <span>
                Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total cases)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr; Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next &rarr;
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
};

