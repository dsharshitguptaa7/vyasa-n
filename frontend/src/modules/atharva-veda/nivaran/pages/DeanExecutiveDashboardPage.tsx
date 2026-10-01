import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, Badge, Button, LoadingState, EmptyState } from '@vyasa/ui';
import { grievanceService } from '../services/grievanceService';
import {
  DeanDashboardDataResponse,
  DeanDashboardFilterParams,
  ExecutiveLedgerResponse,
  ExecutiveLedgerRow,
} from '../types/deanDashboard';
import './CaseReview.css';

// Formatter to clean up enum strings (e.g., 'ASSISTANT_DEAN' -> 'Assistant Dean', 'Course_Work' -> 'Course Work')
const formatLabel = (str?: string): string => {
  if (!str) return '—';
  return str.replace(/_/g, ' ');
};

export const DeanExecutiveDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [dashboardData, setDashboardData] = useState<DeanDashboardDataResponse | null>(null);
  const [ledgerData, setLedgerData] = useState<ExecutiveLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Active Authority Tab in Section 7
  const [authorityTab, setAuthorityTab] = useState<'assistant' | 'associate' | 'manager' | 'fixed' | 'all'>('assistant');

  // Global Filter State
  const [dateRange, setDateRange] = useState<'ALL' | '7D' | '30D' | '90D'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [subjectClusterFilter, setSubjectClusterFilter] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [authorityFilter, setAuthorityFilter] = useState<string>('');
  const [agingBucketFilter, setAgingBucketFilter] = useState<string>('');

  // Ledger Search & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerSortBy] = useState<string>('created_at');
  const [ledgerSortDir] = useState<'asc' | 'desc'>('desc');

  const buildFilterParams = useCallback((): DeanDashboardFilterParams => {
    const params: DeanDashboardFilterParams = {};
    const now = new Date();
    if (dateRange === '7D') {
      params.start_date = new Date(now.getTime() - 7 * 86400000).toISOString();
    } else if (dateRange === '30D') {
      params.start_date = new Date(now.getTime() - 30 * 86400000).toISOString();
    } else if (dateRange === '90D') {
      params.start_date = new Date(now.getTime() - 90 * 86400000).toISOString();
    }

    if (statusFilter !== 'ALL') params.status = statusFilter;
    if (priorityFilter !== 'ALL') params.priority = priorityFilter;
    if (levelFilter !== 'ALL') params.current_level = levelFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    if (subjectClusterFilter) params.subject_cluster_id = subjectClusterFilter;
    if (subjectFilter) params.subject_id = subjectFilter;
    if (authorityFilter) params.authority_id = authorityFilter;
    if (agingBucketFilter) params.aging_bucket = agingBucketFilter;

    return params;
  }, [
    dateRange,
    statusFilter,
    priorityFilter,
    levelFilter,
    categoryFilter,
    subjectClusterFilter,
    subjectFilter,
    authorityFilter,
    agingBucketFilter,
  ]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const filters = buildFilterParams();
      const [dashRes, ledgRes] = await Promise.all([
        grievanceService.getDeanExecutiveDashboard(filters),
        grievanceService.getDeanDashboardCases({
          ...filters,
          page: 1,
          page_size: 15,
          search: searchQuery.trim() || undefined,
          sort_by: ledgerSortBy,
          sort_dir: ledgerSortDir,
        }),
      ]);
      setDashboardData(dashRes);
      setLedgerData(ledgRes);
      setLedgerPage(1);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve Dean Command Center analytics.');
    } finally {
      setLoading(false);
    }
  };

  const loadLedgerOnly = async (page: number) => {
    try {
      setLedgerLoading(true);
      const filters = buildFilterParams();
      const res = await grievanceService.getDeanDashboardCases({
        ...filters,
        page,
        page_size: 15,
        search: searchQuery.trim() || undefined,
        sort_by: ledgerSortBy,
        sort_dir: ledgerSortDir,
      });
      setLedgerData(res);
      setLedgerPage(page);
    } catch (err) {
      console.error('Failed to load ledger rows:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [
    dateRange,
    statusFilter,
    priorityFilter,
    levelFilter,
    categoryFilter,
    subjectClusterFilter,
    subjectFilter,
    authorityFilter,
    agingBucketFilter,
  ]);

  const handleResetFilters = () => {
    setDateRange('ALL');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setLevelFilter('ALL');
    setCategoryFilter('');
    setSubjectClusterFilter('');
    setSubjectFilter('');
    setAuthorityFilter('');
    setAgingBucketFilter('');
    setSearchQuery('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLedgerOnly(1);
  };

  const hasActiveFilters =
    dateRange !== 'ALL' ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    levelFilter !== 'ALL' ||
    categoryFilter !== '' ||
    subjectClusterFilter !== '' ||
    subjectFilter !== '' ||
    authorityFilter !== '' ||
    agingBucketFilter !== '' ||
    searchQuery !== '';

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'URGENT':
      case 'HIGH':
        return 'saffron';
      default:
        return 'teal';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'teal';
      case 'ESCALATED':
      case 'REOPENED':
        return 'saffron';
      default:
        return 'primary';
    }
  };

  if (loading && !dashboardData) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <LoadingState message="Loading Dean Executive Command Center... Aggregating university redressal metrics and authority workloads." />
      </PageContainer>
    );
  }

  const kpis = dashboardData?.kpis;
  const pipeline = dashboardData?.workflow_pipeline || [];
  const bottlenecks = dashboardData?.bottlenecks || [];
  const aging = dashboardData?.aging_distribution || [];
  const filtersMeta = dashboardData?.filters_metadata;

  return (
    <PageContainer style={{ padding: '32px 0 60px' }}>
      {/* 1. EXECUTIVE HEADER */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--vyasa-navy)' }}>
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading" style={{ fontSize: '22px' }}>
                  Dean Executive Command Center
                </h1>
                <Badge variant="primary">CHHATRAPATI SHAHU JI MAHARAJ UNIVERSITY</Badge>
                <Badge variant="saffron">EXECUTIVE OVERSIGHT</Badge>
                {lastUpdated && (
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                    &bull; Last updated: <strong>{lastUpdated} IST</strong>
                  </span>
                )}
              </div>
              <p className="nivaran-case-meta" style={{ marginTop: '4px' }}>
                <span className="nivaran-case-meta__item">
                  Comprehensive institutional redressal intelligence, stage-by-stage workflow progression, authority workload distribution, and administrative surveillance.
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleResetFilters} data-testid="reset-filters-btn">
                ✕ Reset All Filters
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={loadDashboard} data-testid="refresh-dashboard-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Refresh Command Center
            </Button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '14px 18px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '24px', fontSize: '13px' }}>
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {/* 2. GLOBAL FILTER BAR */}
      <Card style={{ marginBottom: '24px', padding: '16px 20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vyasa-navy)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Executive Filters:
          </div>

          {/* Date Range Buttons */}
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e2e8f0', padding: '2px', borderRadius: '6px' }}>
            {(['ALL', '7D', '30D', '90D'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDateRange(range)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: dateRange === range ? 'var(--vyasa-navy)' : 'transparent',
                  color: dateRange === range ? '#ffffff' : '#475569',
                  transition: 'all 0.15s ease',
                }}
              >
                {range === 'ALL' ? 'All Time' : range}
              </button>
            ))}
          </div>

          {/* Current Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Workflow Stages</option>
            <option value="MANAGER">Central Manager</option>
            <option value="ASSISTANT_DEAN">Assistant Dean</option>
            <option value="ASSOCIATE_DEAN">Associate Dean</option>
            <option value="FIXED_AUTHORITY">Fixed Authority</option>
            <option value="DEAN">Dean Executive</option>
            <option value="RESOLVED">Resolved / Closed</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Statuses</option>
            {filtersMeta?.statuses.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
          >
            <option value="ALL">All Priorities</option>
            {filtersMeta?.priorities.map((pr) => (
              <option key={pr} value={pr}>{pr}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', maxWidth: '200px' }}
          >
            <option value="">All Categories</option>
            {filtersMeta?.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Subject Cluster Filter */}
          <select
            value={subjectClusterFilter}
            onChange={(e) => setSubjectClusterFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', maxWidth: '200px' }}
          >
            <option value="">All Subject Clusters</option>
            {filtersMeta?.subject_clusters.map((sc) => (
              <option key={sc.id} value={sc.id}>{sc.name}</option>
            ))}
          </select>

          {/* Aging Bucket Filter */}
          <select
            value={agingBucketFilter}
            onChange={(e) => setAgingBucketFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
          >
            <option value="">All Aging Buckets</option>
            <option value="<24h">&lt; 24 Hours</option>
            <option value="1-3d">1–3 Days</option>
            <option value="4-7d">4–7 Days</option>
            <option value="8-14d">8–14 Days</option>
            <option value="15-30d">15–30 Days</option>
            <option value="30+d">30+ Days</option>
          </select>
        </div>
      </Card>

      {/* 3. TOP EXECUTIVE KPI CARDS (8 COLUMNS RESPONSIVE) */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          { label: 'TOTAL INTAKE', val: kpis?.total_cases || 0, sub: 'All recorded', bg: '#ffffff', border: '#e2e8f0', click: () => handleResetFilters() },
          { label: 'ACTIVE / OPEN', val: kpis?.active_cases || 0, sub: 'Under redressal', bg: '#eff6ff', border: '#bfdbfe', click: () => setStatusFilter('ALL') },
          { label: 'PENDING QUEUE', val: kpis?.pending_cases || 0, sub: 'Awaiting action', bg: '#fffbeb', border: '#fde68a', click: () => setStatusFilter('ASSIGNED') },
          { label: 'IN PROGRESS', val: kpis?.in_progress_cases || 0, sub: 'Active inquiry', bg: '#f0fdf4', border: '#bbf7d0', click: () => setStatusFilter('IN_PROGRESS') },
          { label: 'RESOLVED', val: kpis?.resolved_cases || 0, sub: `${kpis?.resolution_rate || 0}% rate • avg ${kpis?.avg_resolution_time_display || '0h'}`, bg: '#ecfdf5', border: '#a7f3d0', click: () => setStatusFilter('RESOLVED') },
          { label: 'ESCALATED', val: kpis?.escalated_cases || 0, sub: 'Higher review', bg: '#faf5ff', border: '#e9d5ff', click: () => setStatusFilter('ESCALATED') },
          { label: 'AWAITING INFO', val: kpis?.awaiting_info_cases || 0, sub: 'Evidentiary requests', bg: '#fef3c7', border: '#fcd34d', click: () => setStatusFilter('AWAITING_INFORMATION') },
          { label: 'CRITICAL / URGENT', val: kpis?.critical_urgent_cases || 0, sub: 'High risk cases', bg: '#fff1f2', border: '#fecdd3', click: () => setPriorityFilter('HIGH') },
        ].map((card, idx) => (
          <div
            key={idx}
            onClick={card.click}
            style={{
              padding: '16px 14px',
              backgroundColor: card.bg,
              border: `1px solid ${card.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            title="Click to filter ledger"
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--vyasa-navy)', lineHeight: 1.1, marginBottom: '4px' }}>
              {card.val}
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              {card.sub}
            </div>
          </div>
        ))}
      </section>

      {/* 4. WORKFLOW PIPELINE / FUNNEL */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Workflow Progression & Active Pipeline
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
              Actual case distribution at each administrative tier with dwell times and share of active workload.
            </p>
          </div>
          <Badge variant="teal">{kpis?.active_cases || 0} ACTIVE CASES</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
          {pipeline.map((stage) => {
            const isSelected = levelFilter === stage.stage_key;
            return (
              <div
                key={stage.stage_key}
                onClick={() => setLevelFilter(isSelected ? 'ALL' : stage.stage_key)}
                style={{
                  padding: '14px 12px',
                  backgroundColor: isSelected ? '#e0f2fe' : '#f8fafc',
                  border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {stage.order}. {stage.stage_name}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--vyasa-navy)', marginBottom: '2px' }}>
                  {stage.current_count}
                </div>
                <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginBottom: '4px' }}>
                  {stage.percentage_of_active}% workload
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>
                  Dwell: <strong>{stage.avg_dwell_display}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 5. "WHERE ARE CASES STUCK?" BOTTLENECK ANALYSIS */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {bottlenecks.map((b) => (
          <div
            key={b.level}
            onClick={() => setLevelFilter(b.level)}
            style={{
              padding: '16px 18px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: b.total_pending > 0 ? '4px solid #f59e0b' : '4px solid #10b981',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vyasa-navy)', textTransform: 'uppercase' }}>
                {b.level_label}
              </span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: b.total_pending > 0 ? '#b45309' : '#047857' }}>
                {b.total_pending} Pending
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
              Oldest: <strong>{b.oldest_case_age_display}</strong> {b.oldest_case_tracking_id && `(${b.oldest_case_tracking_id})`}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
              Average Age: <strong>{b.avg_stage_age_display}</strong>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Median: {b.median_stage_age_display} | Max: {b.max_stage_age_display}
            </div>
          </div>
        ))}
      </section>

      {/* 6. PENDING AGING ANALYSIS */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Pending Aging Analysis (Elapsed Time)
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
              Analytical duration buckets based on elapsed hours since submission. Click any bucket to filter cases.
            </p>
          </div>
          {agingBucketFilter && (
            <Button variant="ghost" size="sm" onClick={() => setAgingBucketFilter('')}>
              ✕ Clear Aging Filter ({agingBucketFilter})
            </Button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {aging.map((b) => {
            const isSelected = agingBucketFilter === b.bucket_key;
            return (
              <div
                key={b.bucket_key}
                data-testid={`aging-bucket-${b.bucket_key}`}
                onClick={() => setAgingBucketFilter(isSelected ? '' : b.bucket_key)}
                style={{
                  padding: '14px',
                  backgroundColor: isSelected ? '#fef3c7' : '#f8fafc',
                  border: isSelected ? '2px solid #d97706' : '1px solid #e2e8f0',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{b.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--vyasa-navy)' }}>{b.count}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                  {b.percentage}% of active queue
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {Object.entries(b.by_level).map(([lvl, cnt]) => (
                    <span
                      key={lvl}
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '4px',
                        color: '#475569',
                      }}
                    >
                      {lvl.slice(0, 5)}: {cnt}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 7. OPERATIONAL AUTHORITY WORKLOAD PANELS */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Administrative Authority Workload Surveillance
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
              Operational caseload metrics across administrative tiers. Factual workload distribution (no rankings).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
            {[
              { id: 'assistant', label: 'Assistant Deans' },
              { id: 'associate', label: 'Associate Deans' },
              { id: 'manager', label: 'Manager Triage' },
              { id: 'fixed', label: 'Fixed Authorities' },
              { id: 'all', label: 'All Authorities' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAuthorityTab(tab.id as any)}
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: authorityTab === tab.id ? '#ffffff' : 'transparent',
                  color: authorityTab === tab.id ? 'var(--vyasa-navy)' : '#64748b',
                  boxShadow: authorityTab === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: Assistant Deans */}
        {authorityTab === 'assistant' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Assistant Dean</th>
                  <th style={{ padding: '10px' }}>Subject Cluster</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>In Progress</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Awaiting Info</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Resolved</th>
                  <th style={{ padding: '10px' }}>Oldest Case</th>
                  <th style={{ padding: '10px' }}>Avg Pending Age</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.assistant_dean_panel.map((ad) => (
                  <tr
                    key={ad.authority_id}
                    onClick={() => setAuthorityFilter(ad.authority_id)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>{ad.name}</td>
                    <td style={{ padding: '10px', color: '#475569' }}>{ad.subject_cluster_name}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{ad.active_cases}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: ad.pending > 0 ? '#b45309' : '#059669', fontWeight: 700 }}>{ad.pending}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{ad.in_progress}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{ad.awaiting_information}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#047857' }}>{ad.resolved}</td>
                    <td style={{ padding: '10px' }}>{ad.oldest_case_display} {ad.oldest_case_tracking_id && `(${ad.oldest_case_tracking_id})`}</td>
                    <td style={{ padding: '10px' }}>{ad.avg_pending_age_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Associate Deans */}
        {authorityTab === 'associate' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Associate Dean</th>
                  <th style={{ padding: '10px' }}>Grievance Cluster</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>In Progress</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Awaiting Info</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Resolved</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Escalated to Dean</th>
                  <th style={{ padding: '10px' }}>Oldest Case</th>
                  <th style={{ padding: '10px' }}>Avg Age</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.associate_dean_panel.map((ad) => (
                  <tr
                    key={ad.authority_id}
                    onClick={() => setAuthorityFilter(ad.authority_id)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>{ad.name}</td>
                    <td style={{ padding: '10px', color: '#475569' }}>{ad.grievance_cluster_name}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{ad.active_cases}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: ad.pending > 0 ? '#b45309' : '#059669', fontWeight: 700 }}>{ad.pending}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{ad.in_progress}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{ad.awaiting_information}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#047857' }}>{ad.resolved}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#7c3aed', fontWeight: 700 }}>{ad.escalated_to_dean}</td>
                    <td style={{ padding: '10px' }}>{ad.oldest_case_display}</td>
                    <td style={{ padding: '10px' }}>{ad.avg_age_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Manager Triage */}
        {authorityTab === 'manager' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Awaiting AI Review</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--vyasa-navy)' }}>{dashboardData?.manager_triage.awaiting_ai_review || 0}</div>
              </div>
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Awaiting Ratification</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706' }}>{dashboardData?.manager_triage.awaiting_category_ratification || 0}</div>
              </div>
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Category Ratified</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669' }}>{dashboardData?.manager_triage.category_ratified || 0}</div>
              </div>
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Category Overridden</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed' }}>{dashboardData?.manager_triage.category_overridden || 0}</div>
              </div>
              <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>AI Accuracy %</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>{dashboardData?.manager_triage.ai_accuracy_percentage || 0}%</div>
              </div>
            </div>

            {dashboardData?.manager_triage.recent_overrides && dashboardData.manager_triage.recent_overrides.length > 0 && (
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--vyasa-navy)', margin: '0 0 8px' }}>
                  Recent Category Overrides by Manager:
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                        <th style={{ padding: '8px' }}>Tracking ID</th>
                        <th style={{ padding: '8px' }}>Grievance Title</th>
                        <th style={{ padding: '8px' }}>AI Recommended</th>
                        <th style={{ padding: '8px' }}>Manager Final</th>
                        <th style={{ padding: '8px' }}>AI Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardData.manager_triage.recent_overrides.map((ov, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', fontWeight: 600 }}>{ov.grievance_id}</td>
                          <td style={{ padding: '8px' }}>{ov.title}</td>
                          <td style={{ padding: '8px', color: '#64748b' }}>{ov.ai_predicted_category}</td>
                          <td style={{ padding: '8px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>{ov.manager_final_category}</td>
                          <td style={{ padding: '8px' }}>{ov.confidence_score ? `${(ov.confidence_score * 100).toFixed(1)}%` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Fixed Authorities */}
        {authorityTab === 'fixed' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Category</th>
                  <th style={{ padding: '10px' }}>Designated Authority</th>
                  <th style={{ padding: '10px' }}>Role</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Resolved</th>
                  <th style={{ padding: '10px' }}>Oldest Case</th>
                  <th style={{ padding: '10px' }}>Avg Age</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.fixed_authorities.map((fa, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', fontWeight: 700, color: 'var(--vyasa-navy)' }}>{fa.category_name}</td>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{fa.authority_name}</td>
                    <td style={{ padding: '10px' }}><Badge variant="teal">{fa.authority_role}</Badge></td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{fa.active_cases}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: fa.pending_cases > 0 ? '#b45309' : '#059669', fontWeight: 700 }}>{fa.pending_cases}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#047857' }}>{fa.resolved_cases}</td>
                    <td style={{ padding: '10px' }}>{fa.oldest_case_display}</td>
                    <td style={{ padding: '10px' }}>{fa.avg_age_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 5: All Authorities Matrix */}
        {authorityTab === 'all' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '10px' }}>Authority</th>
                  <th style={{ padding: '10px' }}>Role</th>
                  <th style={{ padding: '10px' }}>Department / Cluster</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Assigned</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Pending</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>In Progress</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>Resolved</th>
                  <th style={{ padding: '10px' }}>Oldest Active</th>
                  <th style={{ padding: '10px' }}>Avg Age</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.authority_workloads.map((auth) => (
                  <tr
                    key={auth.authority_id}
                    onClick={() => setAuthorityFilter(auth.authority_id)}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>{auth.name}</td>
                    <td style={{ padding: '10px' }}><Badge variant="teal">{auth.role}</Badge></td>
                    <td style={{ padding: '10px', color: '#475569' }}>{auth.department_or_cluster}</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontWeight: 700 }}>{auth.assigned_count}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: auth.pending_count > 0 ? '#b45309' : '#059669', fontWeight: 700 }}>{auth.pending_count}</td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>{auth.in_progress_count}</td>
                    <td style={{ padding: '10px', textAlign: 'center', color: '#047857' }}>{auth.resolved_count}</td>
                    <td style={{ padding: '10px' }}>{auth.oldest_case_age_display}</td>
                    <td style={{ padding: '10px' }}>{auth.avg_case_age_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 8. ANALYTICS DUAL GRID: CATEGORIES & CLUSTERS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Category Analytics */}
        <Card style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 12px' }}>
            Category Distribution &amp; Turnaround
          </h3>
          <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Category</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Total</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Share %</th>
                  <th style={{ padding: '6px' }}>Avg Age</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.category_analytics.map((cat) => (
                  <tr
                    key={cat.category_id}
                    onClick={() => setCategoryFilter(cat.category_id)}
                    style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '6px', fontWeight: 600 }}>{cat.category_name}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>{cat.total_count}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: cat.active_count > 0 ? '#b45309' : '#059669' }}>{cat.active_count}</td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{cat.percentage}%</td>
                    <td style={{ padding: '6px' }}>{cat.avg_age_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Grievance Cluster Analytics */}
        <Card style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 12px' }}>
            Grievance Clusters &amp; Associate Dean Routing
          </h3>
          <div style={{ overflowX: 'auto', maxHeight: '280px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                  <th style={{ padding: '6px' }}>Cluster</th>
                  <th style={{ padding: '6px' }}>Associate Dean</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Resolved</th>
                  <th style={{ padding: '6px' }}>Oldest</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.grievance_cluster_analytics.map((gc) => (
                  <tr key={gc.cluster_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '6px', fontWeight: 600 }}>Cluster {gc.cluster_number}: {gc.cluster_name}</td>
                    <td style={{ padding: '6px', color: '#475569' }}>{gc.assigned_associate_dean_name}</td>
                    <td style={{ padding: '6px', textAlign: 'center', fontWeight: 700 }}>{gc.active_count}</td>
                    <td style={{ padding: '6px', textAlign: 'center', color: '#047857' }}>{gc.resolved_count}</td>
                    <td style={{ padding: '6px' }}>{gc.oldest_case_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 9. INTAKE VELOCITY & RESOLUTION TRENDS (14-DAY) */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 12px' }}>
          Intake Velocity &amp; Resolution Trends (Last 14 Days)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', gap: '8px', minWidth: '650px', alignItems: 'flex-end', height: '140px', paddingBottom: '24px', borderBottom: '1px solid #e2e8f0' }}>
            {dashboardData?.time_trends.map((pt, idx) => (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                  {/* Submitted Bar */}
                  <div
                    style={{
                      width: '8px',
                      height: `${Math.min(100, (pt.submitted_count || 0) * 18 + 4)}px`,
                      backgroundColor: '#3b82f6',
                      borderRadius: '2px 2px 0 0',
                    }}
                    title={`Submitted: ${pt.submitted_count}`}
                  />
                  {/* Resolved Bar */}
                  <div
                    style={{
                      width: '8px',
                      height: `${Math.min(100, (pt.resolved_count || 0) * 18 + 4)}px`,
                      backgroundColor: '#10b981',
                      borderRadius: '2px 2px 0 0',
                    }}
                    title={`Resolved: ${pt.resolved_count}`}
                  />
                  {/* Escalated Bar */}
                  <div
                    style={{
                      width: '8px',
                      height: `${Math.min(100, (pt.escalated_count || 0) * 18 + 4)}px`,
                      backgroundColor: '#a855f7',
                      borderRadius: '2px 2px 0 0',
                    }}
                    title={`Escalated: ${pt.escalated_count}`}
                  />
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px', whiteSpace: 'nowrap' }}>
                  {pt.period}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11px', color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '2px' }} />
            Submitted
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '2px' }} />
            Resolved
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '10px', height: '10px', backgroundColor: '#a855f7', borderRadius: '2px' }} />
            Escalated
          </span>
        </div>
      </Card>

      {/* 10. OPERATIONAL SURVEILLANCE DUAL GRID: ATTENTION & RECENT ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Dean Attention Required */}
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#991b1b', margin: 0 }}>
              ⚠ Immediate Attention Required ({dashboardData?.attention_items.length || 0})
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Objective criteria alerts</span>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(!dashboardData?.attention_items || dashboardData.attention_items.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                ✓ No immediate high-risk alerts. All active cases within expected thresholds.
              </div>
            ) : (
              dashboardData.attention_items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${item.id}`)}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--vyasa-navy)' }}>{item.tracking_id}</span>
                    <Badge variant={getPriorityBadgeVariant(item.priority)}>{item.priority}</Badge>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#991b1b', marginBottom: '2px' }}>
                    {item.urgency_reason}
                  </div>
                  <div style={{ fontSize: '11px', color: '#475569' }}>
                    {item.title} &bull; Currently with: <strong>{item.current_authority_name}</strong> ({item.aging_days}d old)
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent Activity Feed */}
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: 0 }}>
              Recent Institutional Activity Stream
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Audit log trail</span>
          </div>

          <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(!dashboardData?.recent_activities || dashboardData.recent_activities.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b', fontSize: '12px' }}>
                No recent activity recorded.
              </div>
            ) : (
              dashboardData.recent_activities.map((act) => (
                <div key={act.id} style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <strong style={{ color: 'var(--vyasa-navy)' }}>{act.tracking_id}</strong>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{act.timestamp_display}</span>
                  </div>
                  <div style={{ color: '#334155' }}>{act.description}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                    Actor: {act.actor_name} <Badge variant="teal">{act.actor_role}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 11. ROUTING HEALTH & INTEGRITY BANNER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: dashboardData?.routing_health.is_healthy ? '#f0fdf4' : '#fffbeb',
          border: dashboardData?.routing_health.is_healthy ? '1px solid #bbf7d0' : '1px solid #fde68a',
          borderRadius: '8px',
          marginBottom: '24px',
          fontSize: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>{dashboardData?.routing_health.is_healthy ? '✓' : '⚠️'}</span>
          <span style={{ fontWeight: 700, color: dashboardData?.routing_health.is_healthy ? '#047857' : '#b45309' }}>
            Institutional Routing Integrity:
          </span>
          <span style={{ color: '#475569' }}>
            {dashboardData?.routing_health.is_healthy
              ? 'All active cases assigned to designated authorities. Taxonomy configurations validated.'
              : `${dashboardData?.routing_health.grievances_without_active_assignment} active cases unassigned; review authority configurations.`}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Active Assignments: <strong>{dashboardData?.routing_health.grievances_with_active_assignment}</strong>
        </div>
      </div>

      {/* 12. EXECUTIVE GRIEVANCE LEDGER (PAGINATED & SEARCHABLE) */}
      <div className="nivaran-docket-table-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Executive Grievance Ledger
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
              Comprehensive searchable case database responding dynamically to active executive cross-filters.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="nivaran-docket-search-wrap">
            <span className="nivaran-docket-search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search ID, title, keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="nivaran-docket-search-input"
            />
            <Button type="submit" variant="primary" size="sm" style={{ marginLeft: '6px' }}>
              Search
            </Button>
          </form>
        </div>

        {ledgerLoading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
            Updating grievance ledger...
          </div>
        ) : (!ledgerData?.items || ledgerData.items.length === 0) ? (
          <EmptyState
            title="No matching grievances found"
            description="No institutional grievances match the selected filter criteria or search query."
            action={<Button variant="outline" size="sm" onClick={handleResetFilters}>Reset All Filters</Button>}
          />
        ) : (
          <div>
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table className="nivaran-docket-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px' }}>Tracking ID</th>
                    <th>Subject &amp; Category</th>
                    <th style={{ width: '130px' }}>Current Stage</th>
                    <th>Handling Authority</th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Priority</th>
                    <th style={{ textAlign: 'center', width: '110px' }}>Status</th>
                    <th style={{ width: '90px' }}>Total Age</th>
                    <th style={{ width: '90px' }}>Stage Age</th>
                    <th style={{ width: '160px' }}>Last Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.items.map((row: ExecutiveLedgerRow) => (
                    <tr
                      key={row.id}
                      className="nivaran-docket-row"
                      onClick={() => navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${row.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="nivaran-docket-cell">
                        <span className="nivaran-tracking-pill">
                          {row.tracking_id}
                        </span>
                      </td>
                      <td className="nivaran-docket-cell">
                        <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)', lineHeight: 1.35 }}>{row.title}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>{formatLabel(row.subject_name)}</span>
                          <span>&bull;</span>
                          <span className="nivaran-category-chip" title={formatLabel(row.category_name)}>
                            {formatLabel(row.category_name)}
                          </span>
                        </div>
                      </td>
                      <td className="nivaran-docket-cell">
                        <Badge variant="primary" size="sm">{formatLabel(row.current_level)}</Badge>
                      </td>
                      <td className="nivaran-docket-cell">
                        <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)' }}>{row.current_authority_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{formatLabel(row.current_authority_role)}</div>
                      </td>
                      <td className="nivaran-docket-cell" style={{ textAlign: 'center' }}>
                        <Badge variant={getPriorityBadgeVariant(row.priority)} size="sm">{row.priority}</Badge>
                      </td>
                      <td className="nivaran-docket-cell" style={{ textAlign: 'center' }}>
                        <Badge variant={getStatusBadgeVariant(row.status)} size="sm">{formatLabel(row.status)}</Badge>
                      </td>
                      <td className="nivaran-docket-cell" style={{ fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                        {row.total_age_display}
                      </td>
                      <td className="nivaran-docket-cell" style={{ color: '#64748b' }}>
                        {row.current_stage_age_display}
                      </td>
                      <td className="nivaran-docket-cell" style={{ color: '#475569', fontSize: '11px' }}>
                        <div>{row.last_action}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>{row.last_action_display}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="nivaran-docket-pagination">
              <div>
                Showing <strong>{((ledgerPage - 1) * 15) + 1}</strong> to <strong>{Math.min(ledgerPage * 15, ledgerData.total)}</strong> of <strong>{ledgerData.total}</strong> cases
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage <= 1}
                  onClick={() => loadLedgerOnly(ledgerPage - 1)}
                >
                  &larr; Previous
                </Button>
                <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 600, fontSize: '12px' }}>
                  Page {ledgerPage} of {ledgerData.total_pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={ledgerPage >= ledgerData.total_pages}
                  onClick={() => loadLedgerOnly(ledgerPage + 1)}
                >
                  Next &rarr;
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};
export default DeanExecutiveDashboardPage;
