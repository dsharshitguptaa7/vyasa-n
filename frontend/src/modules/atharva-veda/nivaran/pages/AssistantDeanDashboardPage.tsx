import React, { useEffect, useState } from 'react';
import { Badge, Button, LoadingState, EmptyState, AppIcon, CsjmuLogo } from '@vyasa/ui';
import { useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import { GrievancePriority, GrievanceSummaryItem } from '../types/grievance';
import { useAuth } from '../../../../context/AuthContext';
import { VyasaPortalLayout } from '../../../../features/dashboard/components/VyasaPortalLayout';
import './CaseReview.css';

// Formatter to convert database enum strings like "Course_Work" -> "Course Work"
const formatLabel = (str?: string): string => {
  if (!str) return '—';
  return str.replace(/_/g, ' ');
};

export const AssistantDeanDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, displayName, authorityDesignation } = useAuth();

  const [cases, setCases] = useState<GrievanceSummaryItem[]>([]);
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

  const loadQueue = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await grievanceService.getAssistantDeanQueue({
        page,
        page_size: pageSize,
        status_filter: statusFilter === 'ALL' ? undefined : statusFilter,
        search: search.trim() || undefined,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
      });
      setCases(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages || 1);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve Assistant Dean queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [page, statusFilter, priorityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadQueue();
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

  // Quick stats calculation
  const pendingCount = cases.filter(
    (c) => c.status === 'ASSIGNED' || c.status === 'UNDER_INVESTIGATION'
  ).length;
  const awaitingInfoCount = cases.filter((c) => (c.status as string) === 'AWAITING_INFORMATION').length;
  const resolvedCount = cases.filter((c) => c.status === 'RESOLVED').length;

  const authorityFullName = displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Assistant Dean');

  return (
    <VyasaPortalLayout
      activeItem="services"
      onSelectProfile={() => navigate('/profile')}
      onSelectHelp={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
        {/* 0. Clean Institutional Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#64748b',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>VYASA Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/dashboard')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          NIVARAN
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>Authority Docket</span>
      </nav>

      {/* 1. Institutional Welcome & Jurisdictional Header */}
      <div className="nivaran-case-header">
        {/* Architectural building watermark */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: '160px',
            top: 0,
            bottom: 0,
            width: '260px',
            opacity: 0.04,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <AppIcon name="building" size={200} color="#0f2b48" />
        </div>

        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip">
              <CsjmuLogo size={36} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--vyasa-gold, #b2811a)',
                  marginBottom: '2px',
                }}
              >
                Chhatrapati Shahu Ji Maharaj University, Kanpur
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  Assistant Dean &bull; Subject Cluster Docket
                </h1>
                <Badge variant="teal">{total} Total Cases</Badge>
                <Badge variant="saffron">Stage 1 Jurisdictional Authority</Badge>
              </div>
              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  Academic grievance ledger partitioned by designated subject discipline
                </span>
                {authorityDesignation && (
                  <>
                    <span className="nivaran-case-meta__separator">&bull;</span>
                    <span className="nivaran-case-meta__item" style={{ color: 'var(--vyasa-navy, #0f2b48)', fontWeight: 600 }}>
                      Jurisdiction: {authorityDesignation}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', zIndex: 1 }}>
            {/* Academic Session Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                }}
              >
                <AppIcon name="clock" size={15} />
              </div>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                  Academic Session
                </div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f2b48', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span>2026–27</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                </div>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => loadQueue()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh Ledger
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Authority Identity & Jurisdiction Summary Strip */}
      <div
        data-testid="authority-identity-summary"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
          {/* Account Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="user" size={15} color="#b2811a" />
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Appointed Authority
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                {authorityFullName}
              </span>
            </div>
          </div>

          {/* Institutional Email */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="mail" size={15} color="#2563eb" />
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Official Email
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#334155' }}>
                {user?.email || '—'}
              </span>
            </div>
          </div>

          {/* Jurisdiction Scope */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="scale" size={15} color="#0d9488" />
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                Jurisdiction Scope
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                {authorityDesignation || 'Designated Subject Cluster'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/committees')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--vyasa-primary, #0f2b48)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#eff6ff';
            e.currentTarget.style.borderColor = '#93c5fd';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#f8fafc';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          <span>Committees &amp; Inquiries</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
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

      {/* 3. Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid">
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total In Jurisdiction</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clipboard" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{total}</div>
          <div className="nivaran-docket-kpi__subtext">All assigned &amp; historical cases</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Under Active Review</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clock" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#b45309' }}>{pendingCount}</div>
          <div className="nivaran-docket-kpi__subtext">Assigned or investigating</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Awaiting Information</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="file-text" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#0284c7' }}>{awaitingInfoCount}</div>
          <div className="nivaran-docket-kpi__subtext">Document requests pending</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Resolved By Asst. Dean</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="check-circle" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#047857' }}>{resolvedCount}</div>
          <div className="nivaran-docket-kpi__subtext">Direct determinations committed</div>
        </div>
      </div>

      {/* 3. Refined Docket Filter & Search Toolbar */}
      <div className="nivaran-docket-toolbar">
        {/* Status Filter Tabs */}
        <div className="nivaran-docket-tabs">
          {[
            { label: 'All Cases', value: 'ALL' },
            { label: 'Assigned', value: 'ASSIGNED' },
            { label: 'Investigating', value: 'UNDER_INVESTIGATION' },
            { label: 'Awaiting Info', value: 'AWAITING_INFORMATION' },
            { label: 'Resolved', value: 'RESOLVED' },
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
            <option value="URGENT">Urgent Priority</option>
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
              placeholder="Search tracking # or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="nivaran-docket-search-input"
            />
            <Button size="sm" variant="outline" type="submit" style={{ marginLeft: '6px' }}>
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* 4. Docket Ledger Data Table */}
      {loading ? (
        <LoadingState message="Loading Assistant Dean case ledger..." />
      ) : cases.length === 0 ? (
        <EmptyState
          title="No Matching Grievances Found"
          description="There are currently no active grievances matching the selected filters in your subject cluster jurisdiction."
        />
      ) : (
        <div className="nivaran-docket-table-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="nivaran-docket-table">
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Tracking #</th>
                  <th>Title &amp; Subject</th>
                  <th style={{ width: '210px' }}>Grievance Category</th>
                  <th style={{ width: '100px' }}>Priority</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '110px' }}>Submitted</th>
                  <th style={{ width: '130px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id} className="nivaran-docket-row">
                    {/* Monospace Tracking Badge */}
                    <td className="nivaran-docket-cell">
                      <span className="nivaran-tracking-pill">
                        {item.grievance_id || item.id}
                      </span>
                    </td>

                    {/* Title with Subject Discipline Subtext */}
                    <td className="nivaran-docket-cell">
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)', lineHeight: 1.35 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Subject:</span>
                        <strong style={{ color: '#475569' }}>{formatLabel(item.subject_name)}</strong>
                      </div>
                    </td>

                    {/* Formatted Category Name */}
                    <td className="nivaran-docket-cell">
                      <span className="nivaran-category-chip" title={formatLabel(item.final_category_name || item.category_name)}>
                        {formatLabel(item.final_category_name || item.category_name)}
                      </span>
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
                            : (item.status as string) === 'AWAITING_INFORMATION'
                            ? 'saffron'
                            : 'teal'
                        }
                        size="sm"
                      >
                        {formatLabel(item.status)}
                      </Badge>
                    </td>

                    {/* Date */}
                    <td className="nivaran-docket-cell" style={{ color: '#64748b', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Review Action Button */}
                    <td className="nivaran-docket-cell" style={{ textAlign: 'right' }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${item.id}`)}
                      >
                        Review Case &rarr;
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stately Pagination Footnote */}
          <div className="nivaran-docket-pagination">
            <span>
              Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({total} total docket records)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                &larr; Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next &rarr;
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </VyasaPortalLayout>
  );
};

