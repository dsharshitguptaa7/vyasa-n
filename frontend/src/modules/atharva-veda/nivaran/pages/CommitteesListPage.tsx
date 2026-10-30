import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, LoadingState, EmptyState, AppIcon } from '@vyasa/ui';
import { useAuth } from '../../../../context/AuthContext';
import { FormCommitteeModal } from '../components/FormCommitteeModal';
import { RequestCommitteeModal } from '../components/RequestCommitteeModal';
import { committeeService } from '../services/committeeService';
import {
  CommitteeItem,
  CommitteeOverviewMetrics,
  CommitteeCreationRequestItem,
} from '../types/committee';
import { CommitteeDirectCreatePayload, CommitteeRequestPayload } from '../types/grievance';
import './CaseReview.css';

export const CommitteesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, displayName, isDean, isAssociateDean, isAssistantDean, authorityDesignation } = useAuth();

  const [activeTab, setActiveTab] = useState<'active' | 'dissolved' | 'pending_requests'>('active');
  const [requestSubFilter, setRequestSubFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [metrics, setMetrics] = useState<CommitteeOverviewMetrics | null>(null);
  const [committees, setCommittees] = useState<CommitteeItem[]>([]);
  const [allRequests, setAllRequests] = useState<CommitteeCreationRequestItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const canDirectForm = isDean || isAssociateDean;
  const canRequest = isAssociateDean || isAssistantDean;
  const authorityFullName = displayName || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Appointed Authority');

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [metricsData, allCommittees, requestsData] = await Promise.all([
        committeeService.getOverviewMetrics().catch((e) => {
          console.warn('Failed to load metrics:', e);
          return null;
        }),
        committeeService.listCommittees().catch((e) => {
          console.warn('Failed to load committees:', e);
          return [];
        }),
        canDirectForm || canRequest
          ? committeeService.listRequests().catch((e) => {
              console.warn('Failed to load requests:', e);
              return [];
            })
          : Promise.resolve([]),
      ]);

      if (metricsData) setMetrics(metricsData);
      setCommittees(allCommittees);
      setAllRequests(requestsData);
    } catch (err: any) {
      console.error('Failed to load committees data:', err);
      setErrorMsg('Failed to load committee records. Please verify network or credentials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered committees by search and active/dissolved status
  const filteredCommittees = useMemo(() => {
    const targetStatus = activeTab === 'active' ? 'ACTIVE' : 'DISSOLVED';
    const list = committees.filter((c) => c.status === targetStatus);

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((c) => {
      const matchName = c.committee_name.toLowerCase().includes(q);
      const matchChair = c.chairperson_name?.toLowerCase().includes(q);
      const matchGrievance = c.grievance_tracking_id?.toLowerCase().includes(q);
      const matchMembers = c.members?.some((m) => m.authority_name.toLowerCase().includes(q));
      return matchName || matchChair || matchGrievance || matchMembers;
    });
  }, [committees, activeTab, searchQuery]);

  // Consistently filtered pending requests (status === 'PENDING')
  const pendingRequests = useMemo(() => {
    return allRequests.filter((r) => r.request_status === 'PENDING');
  }, [allRequests]);

  // Aligned count for Pending Requests KPI and tab badge
  const pendingCount = metrics?.pending_requests ?? pendingRequests.length;

  // Requests displayed in the pending tab according to the sub-filter
  const displayedRequests = useMemo(() => {
    if (requestSubFilter === 'ALL') {
      return allRequests;
    }
    return pendingRequests;
  }, [allRequests, pendingRequests, requestSubFilter]);

  const handleFormDirectSubmit = async (payload: CommitteeDirectCreatePayload) => {
    try {
      setModalLoading(true);
      await committeeService.formCommitteeDirect(payload);
      setIsFormModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to form committee.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleRequestSubmit = async (payload: CommitteeRequestPayload) => {
    try {
      setModalLoading(true);
      if (!payload.target_authority_id && !payload.justification) {
        alert('Please fill required fields.');
        return;
      }
      setIsRequestModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to submit committee request.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleReviewAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_CLARIFICATION') => {
    const remarks = prompt(
      action === 'APPROVE'
        ? 'Enter approval remarks (optional):'
        : `Enter remarks for ${action.replace('_', ' ').toLowerCase()} (required):`
    );
    if (action !== 'APPROVE' && (!remarks || !remarks.trim())) {
      alert('Remarks are required for this action.');
      return;
    }

    try {
      await committeeService.reviewRequest(requestId, {
        action,
        remarks: remarks?.trim() || undefined,
      });
      alert(`Request has been ${action.toLowerCase().replace('_', ' ')}d successfully.`);
      await loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Review failed.');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px 48px 20px', boxSizing: 'border-box' }}>
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
        <span style={{ color: '#64748b', fontWeight: 500 }}>Committees Workspace</span>
      </nav>

      {/* 1. Canonical Institutional Header with Watermark */}
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
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="users" size={20} color="var(--vyasa-navy, #1b2a4a)" />
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
                  Committees &bull; Committee Management System
                </h1>
                <Badge variant="teal">{metrics?.total_committees ?? committees.length} Total Committees</Badge>
                <Badge variant="saffron">CSJMU Statutory Redressal</Badge>
              </div>
              <p className="nivaran-case-meta">
                <span className="nivaran-case-meta__item">
                  Institutional governance bodies, fact-finding panels &amp; statutory committee workspaces
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

            {canRequest && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRequestModalOpen(true)}
                style={{ fontWeight: 600 }}
              >
                + Request Committee Formation
              </Button>
            )}
            {canDirectForm && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsFormModalOpen(true)}
                style={{ fontWeight: 600 }}
              >
                + Directly Form Committee
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => loadData()}>
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
                Governance Scope
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f2b48' }}>
                {authorityDesignation || 'Institutional Statutory Committees'}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/student-records')}
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
          <span>Student Master Records</span>
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

      {/* 2. Structured Executive Metric Cards */}
      <div className="nivaran-docket-kpi-grid">
        <div className="nivaran-docket-kpi nivaran-docket-kpi--navy">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Total Committees</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="users" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{metrics?.total_committees ?? committees.length}</div>
          <div className="nivaran-docket-kpi__subtext">Authorized Institutional Scope</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Active Committees</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="check-circle" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#059669' }}>
            {metrics?.active_committees ?? committees.filter((c) => c.status === 'ACTIVE').length}
          </div>
          <div className="nivaran-docket-kpi__subtext">Currently Operational</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Dissolved Committees</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="file-text" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#64748b' }}>
            {metrics?.dissolved_committees ?? committees.filter((c) => c.status === 'DISSOLVED').length}
          </div>
          <div className="nivaran-docket-kpi__subtext">Preserved Historical Records</div>
        </div>

        {(canDirectForm || canRequest) && (
          <div className="nivaran-docket-kpi nivaran-docket-kpi--amber">
            <div className="nivaran-docket-kpi__header">
              <span className="nivaran-docket-kpi__label">Pending Requests</span>
              <div className="nivaran-docket-kpi__icon-bubble">
                <AppIcon name="clock" size={16} />
              </div>
            </div>
            <div className="nivaran-docket-kpi__value" style={{ color: '#b45309' }}>
              {pendingCount}
            </div>
            <div className="nivaran-docket-kpi__subtext">Awaiting Formation Review</div>
          </div>
        )}

        <div className="nivaran-docket-kpi" style={{ '--kpi-accent': '#8b5cf6' } as React.CSSProperties}>
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Votes Requiring Action</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clipboard" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#8b5cf6' }}>
            {metrics?.pending_polls_for_user ?? 0}
          </div>
          <div className="nivaran-docket-kpi__subtext">Pending Ballot Action</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--sky">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Upcoming Meetings</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <AppIcon name="clock" size={16} />
            </div>
          </div>
          <div className="nivaran-docket-kpi__value" style={{ color: '#0284c7' }}>
            {metrics?.upcoming_meetings ?? 0}
          </div>
          <div className="nivaran-docket-kpi__subtext">Scheduled Sessions</div>
        </div>
      </div>

      {/* 3. Refined Docket Filter & Search Toolbar */}
      <div className="nivaran-docket-toolbar">
        {/* Category Tabs */}
        <div className="nivaran-docket-tabs">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`nivaran-docket-tab-btn ${activeTab === 'active' ? 'nivaran-docket-tab-btn--active' : ''}`}
          >
            Active Committees ({committees.filter((c) => c.status === 'ACTIVE').length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dissolved')}
            className={`nivaran-docket-tab-btn ${activeTab === 'dissolved' ? 'nivaran-docket-tab-btn--active' : ''}`}
          >
            Dissolved Committees ({committees.filter((c) => c.status === 'DISSOLVED').length})
          </button>

          {(canDirectForm || canRequest) && (
            <button
              type="button"
              onClick={() => setActiveTab('pending_requests')}
              className={`nivaran-docket-tab-btn ${activeTab === 'pending_requests' ? 'nivaran-docket-tab-btn--active' : ''}`}
            >
              Pending Requests ({pendingCount})
            </button>
          )}
        </div>

        {/* Search Filter */}
        {activeTab !== 'pending_requests' && (
          <div className="nivaran-docket-controls">
            <div className="nivaran-docket-search-wrap">
              <span className="nivaran-docket-search-icon">
                <AppIcon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder="Search by name, chairperson, member, case..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="nivaran-docket-search-input"
                style={{ width: '280px' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <LoadingState message="Loading authorized committee workspaces..." />
      ) : activeTab === 'pending_requests' ? (
        // Pending Requests View
        <div>
          {/* Sub-filter bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div className="nivaran-docket-tabs" style={{ background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setRequestSubFilter('PENDING')}
                className={`nivaran-docket-tab-btn ${requestSubFilter === 'PENDING' ? 'nivaran-docket-tab-btn--active' : ''}`}
              >
                Awaiting Review ({pendingRequests.length})
              </button>
              <button
                type="button"
                onClick={() => setRequestSubFilter('ALL')}
                className={`nivaran-docket-tab-btn ${requestSubFilter === 'ALL' ? 'nivaran-docket-tab-btn--active' : ''}`}
              >
                All Requests ({allRequests.length})
              </button>
            </div>

            {canRequest && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsRequestModalOpen(true)}
                style={{ fontWeight: 600 }}
              >
                + Request Committee Formation
              </Button>
            )}
          </div>

          {displayedRequests.length === 0 ? (
            <EmptyState
              title={requestSubFilter === 'PENDING' ? 'No Pending Formation Requests' : 'No Formation Requests On Record'}
              description={
                requestSubFilter === 'PENDING'
                  ? 'There are currently no committee formation requests awaiting review within your jurisdiction.'
                  : 'No historical or active formation requests exist within your authorized scope.'
              }
              action={
                canRequest && !canDirectForm ? (
                  <Button variant="primary" size="sm" onClick={() => setIsRequestModalOpen(true)}>
                    + Request Committee Formation
                  </Button>
                ) : null
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {displayedRequests.map((req) => (
                <Card key={req.id} variant="default" style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--vyasa-navy)' }}>
                          Case {req.grievance_tracking_id || req.grievance_id}
                        </span>
                        <Badge
                          variant={
                            req.request_status === 'APPROVED'
                              ? 'teal'
                              : req.request_status === 'REJECTED'
                              ? 'neutral'
                              : req.request_status === 'CLARIFICATION_REQUESTED'
                              ? 'saffron'
                              : 'gold'
                          }
                        >
                          {req.request_status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--vyasa-text-secondary)', marginBottom: '8px' }}>
                        <strong>Requested by:</strong> {req.requested_by_name} ({req.requested_by_role}) &bull;{' '}
                        <strong>Target:</strong> {req.target_authority_name || 'Dean Office'} &bull;{' '}
                        <strong>Date:</strong> {new Date(req.created_at).toLocaleDateString()}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--vyasa-navy)', margin: '0 0 8px 0', lineHeight: 1.5 }}>
                        <strong>Justification:</strong> {req.justification}
                      </p>
                      {req.review_remarks && (
                        <p style={{ fontSize: '12px', color: '#b45309', margin: 0, fontStyle: 'italic' }}>
                          <strong>Review Remarks:</strong> {req.review_remarks}
                        </p>
                      )}
                    </div>

                    {/* Review Actions */}
                    {canDirectForm && req.request_status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleReviewAction(req.id, 'APPROVE')}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewAction(req.id, 'REQUEST_CLARIFICATION')}
                        >
                          Clarification
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReviewAction(req.id, 'REJECT')}
                          style={{ color: '#b91c1c' }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Committees List View (Active or Dissolved)
        <div>
          {filteredCommittees.length === 0 ? (
            <EmptyState
              title={
                searchQuery
                  ? 'No Matching Committees Found'
                  : activeTab === 'active'
                  ? 'No Active Committees'
                  : 'No Dissolved Committees'
              }
              description={
                activeTab === 'active'
                  ? 'No active committees found within your authorized scope.'
                  : 'No dissolved committees are on record within your authorized jurisdiction.'
              }
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')}>
                    Clear Search Filter
                  </Button>
                ) : activeTab === 'active' ? (
                  canDirectForm ? (
                    <Button variant="primary" size="sm" onClick={() => setIsFormModalOpen(true)}>
                      + Directly Form Committee
                    </Button>
                  ) : canRequest ? (
                    <Button variant="primary" size="sm" onClick={() => setIsRequestModalOpen(true)}>
                      + Request Committee Formation
                    </Button>
                  ) : null
                ) : null
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredCommittees.map((comm) => (
                <Card
                  key={comm.id}
                  variant="default"
                  style={{
                    padding: '20px',
                    transition: 'all 0.2s ease',
                    borderLeft: comm.status === 'ACTIVE' ? '4px solid #059669' : '4px solid #94a3b8',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ flex: '1 1 500px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--vyasa-navy)', margin: 0 }}>
                          {comm.committee_name}
                        </h2>
                        <Badge variant={comm.status === 'ACTIVE' ? 'teal' : 'neutral'}>
                          {comm.status}
                        </Badge>
                        {comm.grievance_tracking_id && (
                          <span
                            onClick={() => navigate(`/modules/atharva-veda/nivaran/grievance/${comm.grievance_id}`)}
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--vyasa-navy)',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                            }}
                          >
                            Case: {comm.grievance_tracking_id}
                          </span>
                        )}
                      </div>

                      {comm.terms_of_reference && (
                        <p
                          style={{
                            fontSize: '13px',
                            color: 'var(--vyasa-text-secondary)',
                            margin: '0 0 10px 0',
                            lineHeight: 1.5,
                          }}
                        >
                          <strong>Terms of Reference:</strong> {comm.terms_of_reference}
                        </p>
                      )}

                      {/* Chairperson & Membership */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                          flexWrap: 'wrap',
                          fontSize: '12px',
                          color: 'var(--vyasa-text-secondary)',
                          marginBottom: '12px',
                        }}
                      >
                        <div>
                          <strong>Chairperson:</strong> {comm.chairperson_name} ({comm.chairperson_role || 'Authority'})
                        </div>
                        <div>
                          <strong>Chartered:</strong> {new Date(comm.chartered_at).toLocaleDateString()}
                        </div>
                        {comm.disbanded_at && (
                          <div style={{ color: '#64748b' }}>
                            <strong>Dissolved:</strong> {new Date(comm.disbanded_at).toLocaleDateString()}
                            {comm.dissolution_reason && ` (${comm.dissolution_reason})`}
                          </div>
                        )}
                      </div>

                      {/* Members Avatars / Chips */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--vyasa-text-secondary)', textTransform: 'uppercase' }}>
                          Members ({comm.members_count || comm.members.length}):
                        </span>
                        {comm.members.slice(0, 4).map((m) => (
                          <span
                            key={m.id}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: '#e2e8f0',
                              color: 'var(--vyasa-navy)',
                              fontWeight: 500,
                            }}
                          >
                            {m.authority_name} ({m.member_role})
                          </span>
                        ))}
                        {comm.members.length > 4 && (
                          <span style={{ fontSize: '11px', color: 'var(--vyasa-text-secondary)' }}>
                            +{comm.members.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right column: metrics badges and workspace action */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                          💬 {comm.messages_count} msgs
                        </span>
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                          🗳️ {comm.polls_count} polls
                        </span>
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                          📅 {comm.meetings_count} meetings
                        </span>
                        <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
                          📁 {comm.documents_count} docs
                        </span>
                      </div>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/modules/atharva-veda/nivaran/committees/${comm.id}`)}
                        style={{ fontWeight: 600 }}
                      >
                        Open Workspace &rarr;
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form Committee Modal */}
      {canDirectForm && (
        <FormCommitteeModal
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          onSubmit={handleFormDirectSubmit}
          grievanceUuid={committees[0]?.grievance_id || ''}
          loading={modalLoading}
        />
      )}

      {/* Request Committee Modal */}
      {canRequest && (
        <RequestCommitteeModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          onSubmit={handleRequestSubmit}
          loading={modalLoading}
        />
      )}
    </div>
  );
};
