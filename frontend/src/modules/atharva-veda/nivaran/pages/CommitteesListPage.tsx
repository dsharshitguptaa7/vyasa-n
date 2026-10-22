import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Badge, Button, PageContainer, LoadingState, EmptyState } from '@vyasa/ui';
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
  const { isDean, isAssociateDean, isAssistantDean, authorityDesignation } = useAuth();

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
    <PageContainer style={{ padding: '32px 0 60px' }}>
      {/* 1. Scholarly Jurisdictional Header */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--vyasa-navy)' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading" style={{ fontSize: '21px' }}>
                  Committees &bull; Committee Management System
                </h1>
                <Badge variant="teal">{metrics?.total_committees ?? committees.length} Total Committees</Badge>
                <Badge variant="saffron">CSJMU Statutory Redressal</Badge>
              </div>
              <p className="nivaran-case-meta" style={{ marginTop: '4px' }}>
                <span className="nivaran-case-meta__item">
                  Institutional governance bodies, fact-finding panels &amp; statutory committee workspaces
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

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="nivaran-docket-kpi__value">{metrics?.total_committees ?? committees.length}</div>
          <div className="nivaran-docket-kpi__subtext">Authorized Institutional Scope</div>
        </div>

        <div className="nivaran-docket-kpi nivaran-docket-kpi--emerald">
          <div className="nivaran-docket-kpi__header">
            <span className="nivaran-docket-kpi__label">Active Committees</span>
            <div className="nivaran-docket-kpi__icon-bubble">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
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
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M9 15l2 2 4-4" />
              </svg>
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
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
    </PageContainer>
  );
};
