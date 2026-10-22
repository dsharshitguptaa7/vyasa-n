import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { grievanceService } from '../services/grievanceService';
import {
  DeanDashboardDataResponse,
  DeanDashboardFilterParams,
  ExecutiveLedgerResponse,
} from '../types/deanDashboard';
import {
  CommitteeDirectCreatePayload,
  CommitteeRequestDetailedItem,
  CommitteeResponseItem,
} from '../types/grievance';
import { FormCommitteeModal } from '../components/FormCommitteeModal';
import { DeanTrendChart } from '../components/dashboard/DeanTrendChart';
import { DeanCategoryChart } from '../components/dashboard/DeanCategoryChart';
import { DeanPriorityDonutChart } from '../components/dashboard/DeanPriorityDonutChart';
import { DeanActivityFeed } from '../components/dashboard/DeanActivityFeed';
import { DeanLedgerTable } from '../components/dashboard/DeanLedgerTable';
import './CaseReview.css';

// Formatter to clean up enum strings (e.g., 'ASSISTANT_DEAN' -> 'Assistant Dean', 'Course_Work' -> 'Course Work')
const formatLabel = (str?: string): string => {
  if (!str) return '—';
  return str.replace(/_/g, ' ');
};

export const DeanExecutiveDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const ledgerSectionRef = useRef<HTMLDivElement>(null);

  // State
  const [dashboardData, setDashboardData] = useState<DeanDashboardDataResponse | null>(null);
  const [ledgerData, setLedgerData] = useState<ExecutiveLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Active Authority Tab in Section 4
  const [authorityTab, setAuthorityTab] = useState<'assistant' | 'associate' | 'manager' | 'fixed' | 'all'>('assistant');

  // Committee Formation Requests & Panels
  const [commRequests, setCommRequests] = useState<CommitteeRequestDetailedItem[]>([]);
  const [committees, setCommittees] = useState<CommitteeResponseItem[]>([]);
  const [isFormCommitteeOpen, setIsFormCommitteeOpen] = useState(false);
  const [selectedApprovedRequestId, setSelectedApprovedRequestId] = useState<string | undefined>(undefined);
  const [targetGrievanceUuid, setTargetGrievanceUuid] = useState<string>('');
  const [targetGrievanceId, setTargetGrievanceId] = useState<string>('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [committeeActionLoading, setCommitteeActionLoading] = useState(false);

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

  // Ledger Search, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [ledgerPage, setLedgerPage] = useState<number>(1);
  const [ledgerSortBy, setLedgerSortBy] = useState<string>('created_at');
  const [ledgerSortDir, setLedgerSortDir] = useState<'asc' | 'desc'>('desc');

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
      const [dashRes, ledgRes, commReqs, comms] = await Promise.all([
        grievanceService.getDeanExecutiveDashboard(filters),
        grievanceService.getDeanDashboardCases({
          ...filters,
          page: 1,
          page_size: 15,
          search: searchQuery.trim() || undefined,
          sort_by: ledgerSortBy,
          sort_dir: ledgerSortDir,
        }),
        typeof grievanceService.getCommitteeRequests === 'function'
          ? grievanceService.getCommitteeRequests().catch(() => [])
          : Promise.resolve([]),
        typeof grievanceService.getCommittees === 'function'
          ? grievanceService.getCommittees().catch(() => [])
          : Promise.resolve([]),
      ]);
      setDashboardData(dashRes);
      setLedgerData(ledgRes);
      setCommRequests(commReqs);
      setCommittees(comms);
      setLedgerPage(1);
      setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve Dean Command Center analytics.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = async (
    requestId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION',
    remarks?: string
  ) => {
    try {
      setCommitteeActionLoading(true);
      await grievanceService.reviewCommitteeRequest(requestId, { action, remarks });
      setActionSuccessMsg(`Committee request ${action.toLowerCase().replace('_', ' ')} successfully.`);
      const reqs = typeof grievanceService.getCommitteeRequests === 'function'
        ? await grievanceService.getCommitteeRequests().catch(() => [])
        : [];
      setCommRequests(reqs);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to review committee request.');
    } finally {
      setCommitteeActionLoading(false);
    }
  };

  const handleDirectCommitteeSubmit = async (payload: CommitteeDirectCreatePayload) => {
    try {
      setCommitteeActionLoading(true);
      await grievanceService.formCommitteeDirect(payload);
      setActionSuccessMsg('Inquiry committee formed successfully under Dean executive sanction.');
      setIsFormCommitteeOpen(false);
      setSelectedApprovedRequestId(undefined);
      const [reqs, comms] = await Promise.all([
        typeof grievanceService.getCommitteeRequests === 'function'
          ? grievanceService.getCommitteeRequests().catch(() => [])
          : Promise.resolve([]),
        typeof grievanceService.getCommittees === 'function'
          ? grievanceService.getCommittees().catch(() => [])
          : Promise.resolve([]),
      ]);
      setCommRequests(reqs);
      setCommittees(comms);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to form committee.');
    } finally {
      setCommitteeActionLoading(false);
    }
  };

  const loadLedgerOnly = async (page: number, sortBy = ledgerSortBy, sortDir = ledgerSortDir) => {
    try {
      setLedgerLoading(true);
      const filters = buildFilterParams();
      const res = await grievanceService.getDeanDashboardCases({
        ...filters,
        page,
        page_size: 15,
        search: searchQuery.trim() || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      setLedgerData(res);
      setLedgerPage(page);
    } catch (err) {
      console.error('Failed to load ledger rows:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleSortChange = (col: string) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (ledgerSortBy === col) {
      nextDir = ledgerSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      nextDir = col === 'created_at' || col === 'total_age_hours' || col === 'stage_age_hours' ? 'desc' : 'asc';
    }
    setLedgerSortBy(col);
    setLedgerSortDir(nextDir);
    loadLedgerOnly(1, col, nextDir);
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

  const ExecutiveSectionHeader: React.FC<{
    number: string;
    title: string;
    subtitle: string;
    badge?: string;
    badgeVariant?: 'primary' | 'teal' | 'saffron' | 'neutral';
  }> = ({ number, title, subtitle, badge, badgeVariant = 'primary' }) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        marginTop: '28px',
        paddingBottom: '10px',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            letterSpacing: '0.6px',
            color: 'var(--vyasa-navy)',
            backgroundColor: '#e2e8f0',
            padding: '3px 8px',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        >
          SECTION {number}
        </span>
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: 0, letterSpacing: '-0.2px' }}>
            {title}
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
            {subtitle}
          </p>
        </div>
      </div>
      {badge && <Badge variant={badgeVariant}>{badge}</Badge>}
    </div>
  );

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

      {/* 2. GLOBAL EXECUTIVE FILTER BAR */}
      <Card style={{ marginBottom: '24px', padding: '18px 20px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(27, 42, 74, 0.04)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Top Row: Context & Date Horizon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--vyasa-navy)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--vyasa-navy)' }} />
                Executive Filters
              </span>

              {/* Date Range Selection Pill Group */}
              <div style={{ display: 'inline-flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                {(['ALL', '7D', '30D', '90D'] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setDateRange(range)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      backgroundColor: dateRange === range ? 'var(--vyasa-navy)' : 'transparent',
                      color: dateRange === range ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease',
                      boxShadow: dateRange === range ? '0 1px 2px rgba(27, 42, 74, 0.15)' : 'none',
                    }}
                  >
                    {range === 'ALL' ? 'All Time' : range}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Filters Tag & Reset Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {hasActiveFilters ? (
                <>
                  <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700, backgroundColor: '#e0f2fe', padding: '3px 8px', borderRadius: '4px' }}>
                    Active Filters Applied
                  </span>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    data-testid="reset-filters-btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: '4px 6px',
                    }}
                  >
                    ✕ Reset All Filters
                  </button>
                </>
              ) : (
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                  Showing full institutional scope
                </span>
              )}
            </div>
          </div>

          {/* Bottom Row: 6-Column Structured Filter Dimensions Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '10px' }}>
            {/* 1. Stage */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Stage
              </label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: levelFilter !== 'ALL' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: levelFilter !== 'ALL' ? '#f0f9ff' : '#ffffff',
                  color: levelFilter !== 'ALL' ? '#0369a1' : '#334155',
                  fontWeight: levelFilter !== 'ALL' ? 700 : 500,
                  outline: 'none',
                }}
              >
                <option value="ALL">All Workflow Stages</option>
                <option value="MANAGER">Central Manager</option>
                <option value="ASSISTANT_DEAN">Assistant Dean</option>
                <option value="ASSOCIATE_DEAN">Associate Dean</option>
                <option value="FIXED_AUTHORITY">Fixed Authority</option>
                <option value="DEAN">Dean Executive</option>
                <option value="RESOLVED">Resolved / Closed</option>
              </select>
            </div>

            {/* 2. Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: statusFilter !== 'ALL' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: statusFilter !== 'ALL' ? '#f0f9ff' : '#ffffff',
                  color: statusFilter !== 'ALL' ? '#0369a1' : '#334155',
                  fontWeight: statusFilter !== 'ALL' ? 700 : 500,
                  outline: 'none',
                }}
              >
                <option value="ALL">All Statuses</option>
                {filtersMeta?.statuses.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {/* 3. Priority */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: priorityFilter !== 'ALL' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: priorityFilter !== 'ALL' ? '#f0f9ff' : '#ffffff',
                  color: priorityFilter !== 'ALL' ? '#0369a1' : '#334155',
                  fontWeight: priorityFilter !== 'ALL' ? 700 : 500,
                  outline: 'none',
                }}
              >
                <option value="ALL">All Priorities</option>
                {filtersMeta?.priorities.map((pr) => (
                  <option key={pr} value={pr}>{pr}</option>
                ))}
              </select>
            </div>

            {/* 4. Category */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: categoryFilter ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: categoryFilter ? '#f0f9ff' : '#ffffff',
                  color: categoryFilter ? '#0369a1' : '#334155',
                  fontWeight: categoryFilter ? 700 : 500,
                  outline: 'none',
                }}
              >
                <option value="">All Categories</option>
                {filtersMeta?.categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 5. Subject Cluster */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Subject Cluster
              </label>
              <select
                value={subjectClusterFilter}
                onChange={(e) => setSubjectClusterFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: subjectClusterFilter ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: subjectClusterFilter ? '#f0f9ff' : '#ffffff',
                  color: subjectClusterFilter ? '#0369a1' : '#334155',
                  fontWeight: subjectClusterFilter ? 700 : 500,
                  outline: 'none',
                }}
              >
                <option value="">All Subject Clusters</option>
                {filtersMeta?.subject_clusters.map((sc) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>

            {/* 6. Aging Bucket */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Aging Bucket
              </label>
              <select
                value={agingBucketFilter}
                onChange={(e) => setAgingBucketFilter(e.target.value)}
                style={{
                  padding: '7px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: agingBucketFilter ? '1px solid #0284c7' : '1px solid #cbd5e1',
                  backgroundColor: agingBucketFilter ? '#f0f9ff' : '#ffffff',
                  color: agingBucketFilter ? '#0369a1' : '#334155',
                  fontWeight: agingBucketFilter ? 700 : 500,
                  outline: 'none',
                }}
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
          </div>

          {/* Active Filter Dimensions Interactive Chips */}
          {hasActiveFilters && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Active Dimensions:</span>
              {dateRange !== 'ALL' && (
                <span
                  onClick={() => setDateRange('ALL')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove horizon filter"
                >
                  Horizon: {dateRange} ✕
                </span>
              )}
              {levelFilter !== 'ALL' && (
                <span
                  onClick={() => setLevelFilter('ALL')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove stage filter"
                >
                  Stage: {levelFilter} ✕
                </span>
              )}
              {statusFilter !== 'ALL' && (
                <span
                  onClick={() => setStatusFilter('ALL')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove status filter"
                >
                  Status: {statusFilter} ✕
                </span>
              )}
              {priorityFilter !== 'ALL' && (
                <span
                  onClick={() => setPriorityFilter('ALL')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove priority filter"
                >
                  Priority: {priorityFilter} ✕
                </span>
              )}
              {categoryFilter && (
                <span
                  onClick={() => setCategoryFilter('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove category filter"
                >
                  Category: {filtersMeta?.categories.find((c) => c.id === categoryFilter)?.name || categoryFilter} ✕
                </span>
              )}
              {subjectClusterFilter && (
                <span
                  onClick={() => setSubjectClusterFilter('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove cluster filter"
                >
                  Cluster: {filtersMeta?.subject_clusters.find((sc) => sc.id === subjectClusterFilter)?.name || subjectClusterFilter} ✕
                </span>
              )}
              {agingBucketFilter && (
                <span
                  onClick={() => setAgingBucketFilter('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove aging filter"
                >
                  Aging: {agingBucketFilter} ✕
                </span>
              )}
              {authorityFilter && (
                <span
                  onClick={() => setAuthorityFilter('')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Remove authority filter"
                >
                  Authority Filtered ✕
                </span>
              )}
              {searchQuery && (
                <span
                  onClick={() => {
                    setSearchQuery('');
                    loadLedgerOnly(1);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Clear search query"
                >
                  Search: "{searchQuery}" ✕
                </span>
              )}
              <button
                type="button"
                onClick={handleResetFilters}
                data-testid="reset-filters-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '3px 6px',
                  marginLeft: '4px',
                }}
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* 3. SECTION 1: EXECUTIVE OVERVIEW */}
      <ExecutiveSectionHeader
        number="01"
        title="Executive Overview & Primary Milestones"
        subtitle="High-level institutional caseload counters, resolution velocity, and active pipeline volume."
        badge="8 CORE METRICS"
      />

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        {[
          // ROW 1: PRIMARY INSTITUTIONAL MILESTONES
          {
            key: 'TOTAL',
            label: 'TOTAL INTAKE',
            val: kpis?.total_cases || 0,
            sub: 'All recorded institutional intake',
            tag: 'OVERALL',
            accent: 'var(--vyasa-navy)',
            tagBg: '#f1f5f9',
            tagColor: '#334155',
            isActive: !hasActiveFilters,
            click: () => handleResetFilters(),
          },
          {
            key: 'ACTIVE',
            label: 'ACTIVE / OPEN',
            val: kpis?.active_cases || 0,
            sub: 'Under redressal in active queue',
            tag: 'IN PIPELINE',
            accent: '#2563eb',
            tagBg: '#eff6ff',
            tagColor: '#1d4ed8',
            isActive: statusFilter === 'ALL' && hasActiveFilters,
            click: () => setStatusFilter('ALL'),
          },
          {
            key: 'CRITICAL',
            label: 'CRITICAL / URGENT',
            val: kpis?.critical_urgent_cases || 0,
            sub: 'High risk • executive intervention',
            tag: 'PRIORITY',
            accent: '#e11d48',
            tagBg: '#fff1f2',
            tagColor: '#be123c',
            isActive: priorityFilter === 'HIGH' || priorityFilter === 'CRITICAL',
            click: () => setPriorityFilter('HIGH'),
          },
          {
            key: 'RESOLVED',
            label: 'RESOLVED',
            val: kpis?.resolved_cases || 0,
            sub: `${kpis?.resolution_rate || 0}% rate • avg ${kpis?.avg_resolution_time_display || '0h'}`,
            tag: 'COMPLETED',
            accent: '#059669',
            tagBg: '#ecfdf5',
            tagColor: '#047857',
            isActive: statusFilter === 'RESOLVED',
            click: () => setStatusFilter('RESOLVED'),
          },

          // ROW 2: OPERATIONAL WORKFLOW TIERS
          {
            key: 'PENDING',
            label: 'PENDING QUEUE',
            val: kpis?.pending_cases || 0,
            sub: 'Awaiting initial authority triage',
            tag: 'QUEUED',
            accent: '#d97706',
            tagBg: '#fffbeb',
            tagColor: '#b45309',
            isActive: statusFilter === 'ASSIGNED',
            click: () => setStatusFilter('ASSIGNED'),
          },
          {
            key: 'IN_PROGRESS',
            label: 'IN PROGRESS',
            val: kpis?.in_progress_cases || 0,
            sub: 'Active investigation & redressal',
            tag: 'INQUIRY',
            accent: '#0284c7',
            tagBg: '#f0f9ff',
            tagColor: '#0369a1',
            isActive: statusFilter === 'IN_PROGRESS',
            click: () => setStatusFilter('IN_PROGRESS'),
          },
          {
            key: 'ESCALATED',
            label: 'ESCALATED',
            val: kpis?.escalated_cases || 0,
            sub: 'Higher review • Dean oversight',
            tag: 'ESCALATED',
            accent: '#7c3aed',
            tagBg: '#faf5ff',
            tagColor: '#6b21a8',
            isActive: statusFilter === 'ESCALATED',
            click: () => setStatusFilter('ESCALATED'),
          },
          {
            key: 'AWAITING',
            label: 'AWAITING INFO',
            val: kpis?.awaiting_info_cases || 0,
            sub: 'Evidentiary requests to scholars',
            tag: 'EVIDENCE',
            accent: '#f59e0b',
            tagBg: '#fef3c7',
            tagColor: '#92400e',
            isActive: statusFilter === 'AWAITING_INFORMATION',
            click: () => setStatusFilter('AWAITING_INFORMATION'),
          },
        ].map((card, idx) => (
          <div
            key={idx}
            onClick={card.click}
            style={{
              padding: '18px 18px 16px',
              backgroundColor: '#ffffff',
              borderTop: `3px solid ${card.accent}`,
              borderRight: `1px solid ${card.isActive ? card.accent : '#e2e8f0'}`,
              borderBottom: `1px solid ${card.isActive ? card.accent : '#e2e8f0'}`,
              borderLeft: `1px solid ${card.isActive ? card.accent : '#e2e8f0'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: card.isActive ? `0 4px 14px ${card.accent}22` : '0 1px 3px rgba(27, 42, 74, 0.04)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
            title="Click to filter ledger by this metric"
          >
            {/* Top row: Metric name and Tag badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                {card.label}
              </span>
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: card.tagBg,
                  color: card.tagColor,
                  letterSpacing: '0.3px',
                }}
              >
                {card.tag}
              </span>
            </div>

            {/* Stately Metric Number */}
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--vyasa-navy)', lineHeight: 1.1, marginBottom: '6px' }}>
              {card.val}
            </div>

            {/* Subtitle Scope & Filter Affordance */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35 }}>
                {card.sub}
              </span>
              <span style={{ fontSize: '10px', color: card.accent, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {card.isActive ? '● Active' : 'Filter →'}
              </span>
            </div>
          </div>
        ))}
      </section>

      {/* 4. SECTION 2: RESEARCH & GRIEVANCE ANALYTICS */}
      <ExecutiveSectionHeader
        number="02"
        title="Institutional Analytics & Workload Trajectories"
        subtitle="14-day velocity trends, risk stratification, ranked category volumes, and jurisdictional cluster matrix."
        badge="INTERACTIVE ANALYTICS"
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Chart 1: Intake Velocity & Resolution Trends (14-Day Multi-Series Interactive Chart) */}
        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Intake Velocity &amp; Resolution Trends (Last 14 Days)
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Daily institutional workload trajectories with interactive series toggles, tooltips, and backlog surveillance.
            </p>
          </div>
          <DeanTrendChart
            data={dashboardData?.time_trends || []}
          />
        </Card>

        {/* Chart 2: Priority & Institutional Risk Composition (Interactive SVG Donut) */}
        <Card style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Institutional Risk &amp; Priority Breakdown
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
              Risk stratification across active and historical intakes. Click any segment to filter records.
            </p>
          </div>
          <DeanPriorityDonutChart
            priorityCounts={dashboardData?.priority_analysis?.counts || {}}
            selectedPriority={priorityFilter !== 'ALL' ? priorityFilter : undefined}
            onSelectPriority={(p) => setPriorityFilter(p)}
            totalCases={kpis?.total_cases}
          />
        </Card>
      </div>

      {/* Dual Grid: Category Volume & Grievance Clusters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Category Distribution & Turnaround (Interactive Ranked Horizontal Bars) */}
        <Card style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
            Category Distribution &amp; Turnaround
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>
            Ranked categories with active vs resolved distribution. Click any bar to drill down.
          </p>
          <DeanCategoryChart
            categories={dashboardData?.category_analytics || []}
            selectedCategoryId={categoryFilter}
            onSelectCategory={(id) => setCategoryFilter(id === categoryFilter ? '' : id)}
          />
        </Card>

        {/* Grievance Clusters & Associate Dean Routing Matrix */}
        <Card style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
            Grievance Clusters &amp; Associate Dean Routing
          </h3>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#64748b' }}>
            Jurisdictional cluster distribution and operational Associate Dean performance.
          </p>
          <div style={{ overflowX: 'auto', maxHeight: '310px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left', backgroundColor: '#f8fafc' }}>
                  <th style={{ padding: '8px' }}>Cluster</th>
                  <th style={{ padding: '8px' }}>Associate Dean</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Active</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Resolved</th>
                  <th style={{ padding: '8px' }}>Oldest</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData?.grievance_cluster_analytics.map((gc) => (
                  <tr
                    key={gc.cluster_id}
                    onClick={() => setAuthorityFilter(gc.assigned_associate_dean_name ? gc.cluster_id : '')}
                    style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--vyasa-navy)' }}>
                      Cluster {gc.cluster_number}: {gc.cluster_name}
                    </td>
                    <td style={{ padding: '8px', color: '#475569' }}>{gc.assigned_associate_dean_name}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: gc.active_count > 0 ? '#b45309' : '#059669' }}>
                      {gc.active_count}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#047857' }}>{gc.resolved_count}</td>
                    <td style={{ padding: '8px' }}>{gc.oldest_case_display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 5. SECTION 3: WORKFLOW MONITORING & BOTTLENECK SURVEILLANCE */}
      <ExecutiveSectionHeader
        number="03"
        title="Workflow Progression & Bottleneck Surveillance"
        subtitle="Stage-by-stage pipeline velocity, dwell duration diagnostics, and analytical aging distribution."
        badge="SLA SURVEILLANCE"
      />

      {/* Workflow Progression & Funnel */}
      <Card style={{ marginBottom: '24px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: '0 0 4px' }}>
              Workflow Progression &amp; Active Pipeline
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
              Actual case distribution at each administrative tier with dwell times and share of active workload. Click any stage to filter.
            </p>
          </div>
          <Badge variant="teal">{kpis?.active_cases || 0} ACTIVE CASES</Badge>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          {pipeline.map((stage) => {
            const isSelected = levelFilter === stage.stage_key;
            return (
              <div
                key={stage.stage_key}
                onClick={() => setLevelFilter(isSelected ? 'ALL' : stage.stage_key)}
                style={{
                  padding: '14px 12px',
                  backgroundColor: isSelected ? '#e0f2fe' : '#ffffff',
                  border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.15)' : '0 1px 3px rgba(27, 42, 74, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 700, color: isSelected ? '#0369a1' : '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {stage.order}. {stage.stage_name}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--vyasa-navy)', marginBottom: '2px' }}>
                  {stage.current_count}
                </div>
                <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600, marginBottom: '6px' }}>
                  {stage.percentage_of_active}% workload
                </div>
                <div style={{ height: '3px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, stage.percentage_of_active)}%`, backgroundColor: isSelected ? '#0284c7' : 'var(--vyasa-navy)', transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>
                  Dwell: <strong>{stage.avg_dwell_display}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* "Where are cases stuck?" Bottleneck Analysis */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {bottlenecks.map((b) => (
          <div
            key={b.level}
            onClick={() => setLevelFilter(b.level)}
            style={{
              padding: '16px 18px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderTop: b.total_pending > 0 ? '3px solid #f59e0b' : '3px solid #10b981',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(27, 42, 74, 0.04)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--vyasa-navy)', textTransform: 'uppercase' }}>
                {b.level_label}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: b.total_pending > 0 ? '#fffbeb' : '#ecfdf5',
                  color: b.total_pending > 0 ? '#b45309' : '#047857',
                }}
              >
                {b.total_pending} Pending
              </span>
            </div>

            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '4px' }}>
              Oldest: <strong>{b.oldest_case_age_display}</strong> {b.oldest_case_tracking_id && <span style={{ color: '#64748b' }}>({b.oldest_case_tracking_id})</span>}
            </div>
            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '6px' }}>
              Average Dwell: <strong>{b.avg_stage_age_display}</strong>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
              Median: {b.median_stage_age_display} &bull; Max: {b.max_stage_age_display}
            </div>
          </div>
        ))}
      </section>

      {/* Pending Aging Analysis */}
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
            let slaColor = '#059669';
            if (b.bucket_key === '1-3d') slaColor = '#0284c7';
            else if (b.bucket_key === '4-7d') slaColor = '#6366f1';
            else if (b.bucket_key === '8-14d') slaColor = '#d97706';
            else if (b.bucket_key === '15-30d') slaColor = '#ea580c';
            else if (b.bucket_key === '30+d') slaColor = '#e11d48';

            return (
              <div
                key={b.bucket_key}
                data-testid={`aging-bucket-${b.bucket_key}`}
                onClick={() => setAgingBucketFilter(isSelected ? '' : b.bucket_key)}
                style={{
                  padding: '14px',
                  backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
                  borderTop: `3px solid ${slaColor}`,
                  borderRight: `1px solid ${isSelected ? slaColor : '#e2e8f0'}`,
                  borderBottom: `1px solid ${isSelected ? slaColor : '#e2e8f0'}`,
                  borderLeft: `1px solid ${isSelected ? slaColor : '#e2e8f0'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: isSelected ? `0 4px 12px ${slaColor}20` : '0 1px 3px rgba(27, 42, 74, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>{b.label}</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--vyasa-navy)' }}>{b.count}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                  {b.percentage}% of active queue
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {Object.entries(b.by_level).map(([lvl, cnt]) => (
                    <span
                      key={lvl}
                      style={{
                        fontSize: '9.5px',
                        padding: '1px 5px',
                        backgroundColor: '#f1f5f9',
                        borderRadius: '4px',
                        color: '#475569',
                        fontWeight: 600,
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

      {/* 6. SECTION 4: DEPARTMENTAL & AUTHORITY PERFORMANCE */}
      <ExecutiveSectionHeader
        number="04"
        title="Administrative Authority Surveillance & Governance"
        subtitle="Workload caseload distribution across Assistant Deans, Associate Deans, Managers, and designated statutory authorities."
        badge="AUTHORITY MATRIX"
      />

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

          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
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
                  padding: '6px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: authorityTab === tab.id ? 'var(--vyasa-navy)' : 'transparent',
                  color: authorityTab === tab.id ? '#ffffff' : '#475569',
                  boxShadow: authorityTab === tab.id ? '0 1px 2px rgba(27, 42, 74, 0.15)' : 'none',
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

      {/* Executive Committee Governance & Formation Requests Section */}
      <Card style={{ marginBottom: '24px', padding: '20px', borderLeft: '4px solid var(--vyasa-navy)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: 0 }}>
              Executive Committee Governance &amp; Formation Requests ({commRequests.length})
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              Review committee formation petitions from Assistant Deans and Associate Deans, grant executive sanction, and directly constitute inquiry panels.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedApprovedRequestId(undefined);
              const firstCase = ledgerData?.items[0];
              if (firstCase) {
                setTargetGrievanceUuid(firstCase.id);
                setTargetGrievanceId(firstCase.tracking_id);
              }
              setIsFormCommitteeOpen(true);
            }}
          >
            + Form Inquiry Committee Directly
          </Button>
        </div>

        {actionSuccessMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '6px',
              color: '#166534',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{actionSuccessMsg}</span>
            <button
              onClick={() => setActionSuccessMsg(null)}
              style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', fontSize: '16px' }}
            >
              &times;
            </button>
          </div>
        )}

        {commRequests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b', fontSize: '13px' }}>
            ✓ No committee formation requests pending executive sanction.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {commRequests.map((req) => (
              <div
                key={req.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong>Case:</strong> {req.grievance_tracking_id || req.grievance_id} &bull;{' '}
                    <strong>Requested by:</strong> {req.requested_by_name} ({req.requested_by_role})
                    {req.target_authority_name && (
                      <span style={{ color: '#64748b' }}> &rarr; Intended Recipient: {req.target_authority_name}</span>
                    )}
                  </div>
                  <Badge
                    variant={
                      req.request_status === 'APPROVED'
                        ? 'teal'
                        : req.request_status === 'REJECTED'
                        ? 'saffron'
                        : 'neutral'
                    }
                  >
                    {req.request_status}
                  </Badge>
                </div>

                <div style={{ marginTop: '8px', color: '#334155', lineHeight: 1.5 }}>
                  <strong>Justification:</strong> {req.justification}
                </div>

                {req.review_remarks && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#b91c1c' }}>
                    <strong>Review Remarks:</strong> {req.review_remarks}
                  </div>
                )}

                {/* Review Controls for Dean */}
                {(req.request_status === 'PENDING' || req.request_status === 'CLARIFICATION_REQUESTED') && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={committeeActionLoading}
                      onClick={() => handleReviewRequest(req.id, 'APPROVE')}
                    >
                      Approve Request
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={committeeActionLoading}
                      onClick={() => {
                        const rem = window.prompt('Specify clarification needed from requester:');
                        if (rem) handleReviewRequest(req.id, 'REQUEST_CLARIFICATION', rem);
                      }}
                    >
                      Request Clarification
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={committeeActionLoading}
                      onClick={() => {
                        const rem = window.prompt('Specify reason for rejection:');
                        if (rem) handleReviewRequest(req.id, 'REJECT', rem);
                      }}
                      style={{ color: '#dc2626' }}
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {/* Form Committee under Approved Request */}
                {req.request_status === 'APPROVED' && !req.committee_id && (
                  <div style={{ marginTop: '10px' }}>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={committeeActionLoading}
                      onClick={() => {
                        setSelectedApprovedRequestId(req.id);
                        setTargetGrievanceUuid(req.grievance_id);
                        setTargetGrievanceId(req.grievance_tracking_id || req.grievance_id);
                        setIsFormCommitteeOpen(true);
                      }}
                    >
                      Constitute Inquiry Committee Under Sanction &rarr;
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Existing Active Committees Sub-panel */}
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: '#475569', margin: 0, textTransform: 'uppercase' }}>
              Active University Inquiry Panels ({committees.length})
            </h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/committees')}
            >
              Open Committees Directory &amp; Governance &rarr;
            </Button>
          </div>
          {committees.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
              {committees.map((comm) => (
                <div
                  key={comm.id}
                  onClick={() => navigate(`/modules/atharva-veda/nivaran/committees/${comm.id}`)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd',
                    backgroundColor: '#f0f9ff',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: '#0369a1' }}>{comm.committee_name}</strong>
                    <Badge variant="teal">{comm.status}</Badge>
                  </div>
                  <div style={{ color: '#0369a1', marginTop: '4px' }}>
                    Chairperson: {comm.chairperson_name}
                  </div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>
                    Members ({comm.members.length}): {comm.members.map((m) => m.authority_name).join(', ')}
                  </div>
                  <div style={{ color: '#0284c7', marginTop: '4px', fontWeight: 600, fontSize: '11px' }}>
                    Open Dedicated Workspace &rarr;
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              No active inquiry panels currently operating.
            </div>
          )}
        </div>
      </Card>

      {/* 7. SECTION 5: OPERATIONAL SURVEILLANCE & RECENT ACTIVITY DUAL GRID */}
      <ExecutiveSectionHeader
        number="05"
        title="Operational Surveillance & Institutional Audit Trail"
        subtitle="Objective criteria alerts requiring urgent executive intervention alongside real-time institutional event trail."
        badge="SURVEILLANCE"
      />

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

        {/* Recent Activity Feed (Using Enhanced DeanActivityFeed) */}
        <Card style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--vyasa-navy)', margin: 0 }}>
              Recent Institutional Activity Stream
            </h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Audit log trail</span>
          </div>

          <DeanActivityFeed
            activities={dashboardData?.recent_activities || []}
            onSelectCase={(trackingId) => {
              setSearchQuery(trackingId);
              loadLedgerOnly(1);
              if (ledgerSectionRef.current) {
                ledgerSectionRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          />
        </Card>
      </div>

      {/* 8. ROUTING HEALTH & INTEGRITY BANNER */}
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

      {/* 9. SECTION 6: DETAILED RECORDS (EXECUTIVE GRIEVANCE LEDGER) */}
      <ExecutiveSectionHeader
        number="06"
        title="Enterprise Grievance Ledger & Detailed Records"
        subtitle="Searchable, multi-column sortable, paginated case database reflecting all active institutional cross-filters."
        badge="CROSS-FILTERED"
      />

      <div ref={ledgerSectionRef}>
        <DeanLedgerTable
          ledgerData={ledgerData}
          loading={ledgerLoading}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          sortBy={ledgerSortBy}
          sortDir={ledgerSortDir}
          onSortChange={handleSortChange}
          currentPage={ledgerPage}
          onPageChange={(page) => loadLedgerOnly(page)}
          onRowClick={(id) => navigate(`/modules/atharva-veda/nivaran/assistant-dean/grievance/${id}`)}
          onResetFilters={handleResetFilters}
          formatLabel={formatLabel}
          getPriorityBadgeVariant={getPriorityBadgeVariant}
          getStatusBadgeVariant={getStatusBadgeVariant}
        />
      </div>

      {targetGrievanceUuid && (
        <FormCommitteeModal
          isOpen={isFormCommitteeOpen}
          onClose={() => setIsFormCommitteeOpen(false)}
          onSubmit={handleDirectCommitteeSubmit}
          grievanceId={targetGrievanceId}
          grievanceUuid={targetGrievanceUuid}
          approvedRequestId={selectedApprovedRequestId}
          loading={committeeActionLoading}
        />
      )}
    </PageContainer>
  );
};

export default DeanExecutiveDashboardPage;
