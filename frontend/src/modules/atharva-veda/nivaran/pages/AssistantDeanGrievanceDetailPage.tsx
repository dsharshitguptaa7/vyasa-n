import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import {
  AssistantDeanForwardRequest,
  AssistantDeanGrievanceDetailResponse,
  AssistantDeanResolveRequest,
  CommitteeRequestPayload,
  DocumentRequestItem,
} from '../types/grievance';
import { ForwardConfirmationModal } from '../components/ForwardConfirmationModal';
import { ResolveGrievanceModal } from '../components/ResolveGrievanceModal';
import { RequestDocumentModal } from '../components/RequestDocumentModal';
import { RequestCommitteeModal } from '../components/RequestCommitteeModal';
import { ClosedCaseEFileCard } from '../components/ClosedCaseEFileCard';
import './CaseReview.css';

export const AssistantDeanGrievanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dossier, setDossier] = useState<AssistantDeanGrievanceDetailResponse | null>(null);
  const [docRequests, setDocRequests] = useState<DocumentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal open states
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [isRequestDocOpen, setIsRequestDocOpen] = useState(false);
  const [isRequestCommitteeOpen, setIsRequestCommitteeOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const [detailData, reqDocs] = await Promise.all([
        grievanceService.getAssistantDeanGrievanceDetail(id),
        grievanceService.getGrievanceDocumentRequests(id),
      ]);
      setDossier(detailData);
      setDocRequests(reqDocs);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load grievance dossier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleResolveSubmit = async (payload: AssistantDeanResolveRequest) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.resolveAssistantDeanGrievance(id, payload);
      setSuccessMsg('Grievance has been successfully resolved under Assistant Dean jurisdiction.');
      setIsResolveOpen(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleForwardSubmit = async (payload: AssistantDeanForwardRequest) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.forwardAssistantDeanGrievance(id, payload);
      setSuccessMsg('Grievance successfully forwarded to Stage 2 authority with verified justifications.');
      setIsForwardOpen(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestDocSubmit = async (items: DocumentRequestItem[]) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.requestGrievanceDocuments(id, { items });
      setSuccessMsg('Evidentiary document request issued. Grievance transitioned to AWAITING_INFORMATION.');
      setIsRequestDocOpen(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommitteeSubmit = async (payload: CommitteeRequestPayload) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.requestCommitteeCreation(id, payload);
      setSuccessMsg('Inquiry committee formation request submitted successfully.');
      setIsRequestCommitteeOpen(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <LoadingState message="Loading Assistant Dean grievance dossier..." />
      </PageContainer>
    );
  }

  if (!dossier) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card variant="default">
          <p style={{ color: '#b91c1c', textAlign: 'center' }}>
            Case dossier could not be found or you lack Assistant Dean jurisdiction.
          </p>
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/cases')}>
              Return to Queue
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const isResolvedOrClosed = dossier.status === 'RESOLVED' || dossier.status === 'CLOSED';
  const canAct = !isResolvedOrClosed && (dossier.status as string) !== 'FORWARDED';
  const canForward = Boolean(dossier.can_forward || dossier.routing?.can_forward) && canAct;
  const nextTargetName =
    dossier.stage2_routing_preview?.target_authority_name ||
    dossier.routing?.next_authority_name ||
    'Stage 2 Authority';

  const categoryDisplayName = (dossier.final_category_name || dossier.category_name || '').replace(/_/g, ' ');

  return (
    <PageContainer style={{ padding: '36px 0 80px' }}>
      {/* 1. Stately Case Review Header */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/modules/atharva-veda/nivaran/assistant-dean/cases')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <AppIcon name="arrow-left" size={13} /> Back to Docket
          </Button>

          {canAct && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsResolveOpen(true)}
                disabled={actionLoading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <AppIcon name="check-circle" size={14} /> Resolve Grievance
              </Button>
              {canForward && (
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => setIsForwardOpen(true)}
                  disabled={actionLoading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <AppIcon name="arrow-right" size={14} /> Forward Case
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="nivaran-case-header__title-row">
          <div className="nivaran-case-icon-chip" aria-hidden="true">
            <AppIcon name="file-text" size={18} color="var(--vyasa-navy, #1b2a4a)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="nivaran-case-heading">
                Case Review &bull; {dossier.grievance_id}
              </h1>
              <Badge
                variant={
                  dossier.status === 'RESOLVED'
                    ? 'teal'
                    : (dossier.status as string) === 'AWAITING_INFORMATION'
                    ? 'saffron'
                    : 'teal'
                }
              >
                {dossier.status}
              </Badge>
              <Badge variant="gold">Stage 1 Review</Badge>
            </div>

            <p className="nivaran-case-meta" style={{ marginTop: '6px' }}>
              <span className="nivaran-case-meta__item">
                Subject: <strong>{dossier.subject_name}</strong>
                {dossier.subject_cluster_name && <span> ({dossier.subject_cluster_name})</span>}
              </span>
              <span className="nivaran-case-meta__separator">&bull;</span>
              <span className="nivaran-case-meta__item">
                Category: <strong>{categoryDisplayName}</strong>
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="alert-circle" size={16} color="#b91c1c" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            color: '#166534',
            marginBottom: '20px',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <AppIcon name="check-circle" size={16} color="#166534" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Official Sealed E-File (Rendered when grievance is CLOSED) */}
      {dossier.status === 'CLOSED' && (
        <ClosedCaseEFileCard grievanceId={dossier.id} />
      )}

      {/* Main Grid */}
      <div className="nivaran-dossier-grid" style={{ marginBottom: '24px' }}>
        {/* Left Column: Dossier Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          {/* Grievance Summary Card */}
          <div className="nivaran-card nivaran-card--gold">
            <div className="nivaran-card__header">
              <div className="nivaran-card__header-left">
                <div className="nivaran-card__header-chip nivaran-card__header-chip--gold" aria-hidden="true">
                  <AppIcon name="user" size={16} color="var(--vyasa-gold-hover, #a16207)" />
                </div>
                <div>
                  <h3 className="nivaran-card__title">Scholar &amp; Grievance Particulars</h3>
                  <p className="nivaran-card__subtitle">Verified applicant profile and primary grievance dossier</p>
                </div>
              </div>
              <Badge
                variant={dossier.priority === 'HIGH' ? 'saffron' : dossier.priority === 'CRITICAL' ? 'primary' : 'teal'}
                size="sm"
              >
                {dossier.priority}
              </Badge>
            </div>

            <div className="nivaran-card__body">
              {/* Title Callout Box */}
              <div className="nivaran-case-title-box">
                <div className="nivaran-case-title-box__label">Grievance Title</div>
                <h4 className="nivaran-case-title-box__text">{dossier.title}</h4>
              </div>

              {/* 2-Column Info Grid */}
              <div className="nivaran-particulars-grid">
                <div className="nivaran-field-item">
                  <div className="nivaran-field-label">Scholar / Applicant</div>
                  <div className="nivaran-field-value">{dossier.applicant_name}</div>
                  <div className="nivaran-field-sub">{dossier.applicant_email}</div>
                  {dossier.student_registration_number && (
                    <div className="nivaran-field-sub">
                      Roll / Reg: <strong>{dossier.student_registration_number}</strong>
                    </div>
                  )}
                </div>

                <div className="nivaran-field-item">
                  <div className="nivaran-field-label">Academic Subject &amp; Cluster</div>
                  <div className="nivaran-field-value">{dossier.subject_name}</div>
                  <div className="nivaran-field-sub">
                    {dossier.subject_cluster_name || 'Academic Cluster'}
                  </div>
                </div>

                <div className="nivaran-field-item">
                  <div className="nivaran-field-label">Grievance Category</div>
                  <div className="nivaran-field-value">{categoryDisplayName}</div>
                  {dossier.category_reviewed && (
                    <div style={{ fontSize: '12px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      <AppIcon name="check-circle" size={12} color="#059669" />
                      <span>Ratified during Manager Triage</span>
                    </div>
                  )}
                </div>

                <div className="nivaran-field-item">
                  <div className="nivaran-field-label">Submission Timestamp</div>
                  <div className="nivaran-field-value" style={{ fontSize: '13px', fontWeight: 500 }}>
                    {new Date(dossier.created_at).toLocaleString()}
                  </div>
                  <div className="nivaran-field-sub">
                    Status: <strong>{dossier.status}</strong>
                  </div>
                </div>
              </div>

              {/* Statement of Grievance */}
              <div style={{ marginTop: '20px' }}>
                <div className="nivaran-field-label">Detailed Statement of Grievance</div>
                <div className="nivaran-statement-box">
                  {dossier.description}
                </div>
              </div>
            </div>
          </div>

          {/* Resolution Details Card (if resolved) */}
          {dossier.resolution_summary && (
            <div className="nivaran-card" style={{ borderLeft: '4px solid #16a34a' }}>
              <div className="nivaran-card__header">
                <div className="nivaran-card__header-left">
                  <div className="nivaran-card__header-chip nivaran-card__header-chip--teal" aria-hidden="true">
                    <AppIcon name="check-circle" size={16} color="#16a34a" />
                  </div>
                  <div>
                    <h3 className="nivaran-card__title" style={{ color: '#166534' }}>
                      Official Resolution Determination
                    </h3>
                    <p className="nivaran-card__subtitle">
                      Determined under Assistant Dean Jurisdiction
                      {dossier.resolved_at && (
                        <span> &bull; {new Date(dossier.resolved_at).toLocaleString()}</span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge variant="teal" size="sm">Resolved</Badge>
              </div>

              <div className="nivaran-card__body">
                <div
                  style={{
                    padding: '14px 16px',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    fontSize: '13.5px',
                    lineHeight: '1.65',
                    color: '#14532d',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {dossier.resolution_summary}
                </div>
              </div>
            </div>
          )}

          {/* Evidentiary Attachments Card */}
          <div className="nivaran-card">
            <div className="nivaran-card__header">
              <div className="nivaran-card__header-left">
                <div className="nivaran-card__header-chip" aria-hidden="true">
                  <AppIcon name="clipboard" size={16} color="var(--vyasa-navy, #1b2a4a)" />
                </div>
                <div>
                  <h3 className="nivaran-card__title">Attached Evidentiary Records ({dossier.documents.length})</h3>
                  <p className="nivaran-card__subtitle">Authenticated documentation submitted by scholar</p>
                </div>
              </div>
            </div>

            <div className="nivaran-card__body">
              {dossier.documents.length === 0 ? (
                <div className="nivaran-empty-state">
                  <div className="nivaran-empty-state__icon" aria-hidden="true">
                    <AppIcon name="file-text" size={24} />
                  </div>
                  <p className="nivaran-empty-state__text">
                    No attachments uploaded with this submission.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dossier.documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <AppIcon name="file-text" size={18} color="var(--vyasa-navy, #1b2a4a)" />
                        <div>
                          <strong style={{ color: 'var(--vyasa-navy)' }}>{doc.file_name}</strong>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Type: {doc.document_type} &bull; {(doc.file_size_bytes / 1024).toFixed(1)} KB &bull;{' '}
                            {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Badge variant="teal" size="sm">Evidence</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Evidentiary Document Requests Card */}
          <div className="nivaran-card">
            <div className="nivaran-card__header">
              <div className="nivaran-card__header-left">
                <div className="nivaran-card__header-chip" aria-hidden="true">
                  <AppIcon name="file-text" size={16} color="var(--vyasa-navy, #1b2a4a)" />
                </div>
                <div>
                  <h3 className="nivaran-card__title">Evidentiary Document Requests ({docRequests.length})</h3>
                  <p className="nivaran-card__subtitle">Formal records requested from scholar or department</p>
                </div>
              </div>
            </div>

            <div className="nivaran-card__body">
              {docRequests.length === 0 ? (
                <div className="nivaran-empty-state">
                  <div className="nivaran-empty-state__icon" aria-hidden="true">
                    <AppIcon name="clipboard" size={24} />
                  </div>
                  <p className="nivaran-empty-state__text">
                    No additional evidentiary records have been formally requested for this grievance.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {docRequests.map((req, idx) => (
                    <div
                      key={req.id || idx}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: req.status === 'FULFILLED' ? '#f0fdf4' : '#fffbeb',
                        border: req.status === 'FULFILLED' ? '1px solid #bbf7d0' : '1px solid #fde68a',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--vyasa-navy)' }}>{req.document_name}</strong>
                        <Badge variant={req.status === 'FULFILLED' ? 'teal' : 'saffron'} size="sm">
                          {req.status || 'PENDING'}
                        </Badge>
                      </div>
                      {req.description && (
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                          {req.description}
                        </div>
                      )}
                      {req.deadline && (
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '3px' }}>
                          Due by: {req.deadline}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Audit History Timeline */}
          <div className="nivaran-card">
            <div className="nivaran-card__header">
              <div className="nivaran-card__header-left">
                <div className="nivaran-card__header-chip" aria-hidden="true">
                  <AppIcon name="clock" size={16} color="var(--vyasa-navy, #1b2a4a)" />
                </div>
                <div>
                  <h3 className="nivaran-card__title">Audit Ledger &amp; Status Timeline</h3>
                  <p className="nivaran-card__subtitle">Immutable jurisdictional history and state transitions</p>
                </div>
              </div>
            </div>

            <div className="nivaran-card__body">
              {dossier.history.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
                  No state transition history recorded.
                </p>
              ) : (
                <div className="nivaran-timeline">
                  {dossier.history.map((h) => (
                    <div key={h.id} className="nivaran-timeline-node">
                      <div className="nivaran-timeline-node__main">
                        <div className="nivaran-timeline-node__header">
                          <span className="nivaran-timeline-node__transition">
                            {h.from_status ? `${h.from_status} \u2192 ` : ''}{h.to_status}
                          </span>
                          <span className="nivaran-timeline-node__time">
                            {new Date(h.created_at).toLocaleString()}
                          </span>
                        </div>
                        {h.remarks && (
                          <div className="nivaran-timeline-node__remarks">
                            {h.remarks}
                          </div>
                        )}
                        <div className="nivaran-timeline-node__actor">
                          Actor: <strong>{h.actor_type}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Actions & Stage 2 Routing Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          {/* Stage 2 Routing Preview Card */}
          <div className="nivaran-card nivaran-card--gold">
            <div className="nivaran-card__header">
              <div className="nivaran-card__header-left">
                <div className="nivaran-card__header-chip nivaran-card__header-chip--gold" aria-hidden="true">
                  <AppIcon name="arrow-right" size={16} color="var(--vyasa-gold-hover, #a16207)" />
                </div>
                <div>
                  <h3 className="nivaran-card__title">Stage 2 Escalation Target</h3>
                  <p className="nivaran-card__subtitle">Configured appellate or category jurisdiction</p>
                </div>
              </div>
            </div>

            <div className="nivaran-card__body">
              {dossier.stage2_routing_preview ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div className="nivaran-field-label">Escalation Authority</div>
                    <div style={{ fontWeight: 700, color: 'var(--vyasa-navy)', fontSize: '15px' }}>
                      {dossier.stage2_routing_preview.target_authority_name}
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                      {dossier.stage2_routing_preview.target_authority_email}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Badge variant="teal" size="sm">
                      {dossier.stage2_routing_preview.target_authority_role.replace(/_/g, ' ')}
                    </Badge>
                    <Badge variant="saffron" size="sm">
                      {dossier.stage2_routing_preview.routing_type.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--vyasa-navy)',
                      backgroundColor: 'rgba(212, 160, 23, 0.06)',
                      border: '1px solid rgba(212, 160, 23, 0.18)',
                      borderRadius: '4px',
                      padding: '10px 12px',
                      lineHeight: '1.5',
                    }}
                  >
                    {dossier.stage2_routing_preview.routing_type === 'FIXED_AUTHORITY'
                      ? 'This category bypasses Associate Dean clusters and routes directly to the designated institutional authority.'
                      : 'This category routes to the appointed Associate Dean of the Grievance Cluster.'}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  No Stage 2 escalation target configured for this category.
                </div>
              )}

              {!dossier.can_forward && dossier.forward_blocked_reason && (
                <div
                  style={{
                    marginTop: '14px',
                    padding: '12px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#b91c1c',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                  }}
                >
                  <AppIcon name="alert-circle" size={16} color="#b91c1c" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong>Escalation Blocked:</strong> {dossier.forward_blocked_reason}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Jurisdictional Actions Card */}
          <div className="nivaran-card nivaran-card--primary">
            <div className="nivaran-card__header">
              <div className="nivaran-card__header-left">
                <div className="nivaran-card__header-chip" aria-hidden="true">
                  <AppIcon name="scale" size={16} color="var(--vyasa-navy, #1b2a4a)" />
                </div>
                <div>
                  <h3 className="nivaran-card__title">Jurisdictional Determinations</h3>
                  <p className="nivaran-card__subtitle">Official statutory actions and disposition powers</p>
                </div>
              </div>
            </div>

            <div className="nivaran-card__body">
              {canAct ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Button
                    variant="primary"
                    onClick={() => setIsResolveOpen(true)}
                    disabled={actionLoading}
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <AppIcon name="check-circle" size={15} /> Direct Resolution
                  </Button>

                  {canForward ? (
                    <Button
                      variant="gold"
                      onClick={() => setIsForwardOpen(true)}
                      disabled={actionLoading}
                      style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <AppIcon name="arrow-right" size={15} /> Forward to {nextTargetName}
                    </Button>
                  ) : (
                    <div
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#64748b',
                      }}
                    >
                      <strong>Forwarding Unavailable:</strong>{' '}
                      {dossier.forward_blocked_reason || 'Terminal routing: this category has no higher escalation authority.'}
                    </div>
                  )}

                  <div className="nivaran-action-divider">
                    <span>Investigative Measures</span>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => setIsRequestDocOpen(true)}
                    disabled={actionLoading}
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <AppIcon name="file-text" size={15} /> Request Evidentiary Documents
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setIsRequestCommitteeOpen(true)}
                    disabled={actionLoading}
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <AppIcon name="users" size={15} /> Request Inquiry Committee
                  </Button>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '13px',
                    color: '#166534',
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AppIcon name="check-circle" size={16} color="#166534" />
                  <span>Grievance has been finalized under Assistant Dean jurisdiction. No pending determinations required.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ResolveGrievanceModal
        isOpen={isResolveOpen}
        onClose={() => setIsResolveOpen(false)}
        onSubmit={handleResolveSubmit}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />

      <ForwardConfirmationModal
        isOpen={isForwardOpen}
        onClose={() => setIsForwardOpen(false)}
        onSubmit={handleForwardSubmit}
        routingPreview={dossier.stage2_routing_preview}
        loading={actionLoading}
      />

      <RequestDocumentModal
        isOpen={isRequestDocOpen}
        onClose={() => setIsRequestDocOpen(false)}
        onSubmit={handleRequestDocSubmit}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />

      <RequestCommitteeModal
        isOpen={isRequestCommitteeOpen}
        onClose={() => setIsRequestCommitteeOpen(false)}
        onSubmit={handleCommitteeSubmit}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />
    </PageContainer>
  );
};
