import React, { useEffect, useState } from 'react';
import { PageContainer, Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { ApplicantLayout } from '../../../../features/applicant';
import { MainLayout } from '../../../../components/layout/MainLayout';
import { grievanceService } from '../services/grievanceService';
import { GrievanceDetailResponse } from '../types/grievance';
import { useAuth } from '../../../../context/AuthContext';

import { ApplicantFeedbackCard } from '../components/ApplicantFeedbackCard';
import { ClosedCaseEFileCard } from '../components/ClosedCaseEFileCard';
import './CaseReview.css';

const formatFileSize = (bytes?: number | null): string => {
  if (bytes === undefined || bytes === null || isNaN(Number(bytes)) || Number(bytes) <= 0) {
    return 'Attached File';
  }
  const kb = Number(bytes) / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${kb.toFixed(1)} KB`;
};

const getStatusBadgeVariant = (status: string): 'teal' | 'saffron' | 'neutral' | 'primary' => {
  switch (status?.toUpperCase()) {
    case 'RESOLVED':
    case 'CLOSED':
      return 'teal';
    case 'SUBMITTED':
    case 'PENDING_REVIEW':
    case 'AWAITING_INFORMATION':
      return 'saffron';
    case 'ASSIGNED':
    case 'IN_PROGRESS':
    case 'UNDER_INVESTIGATION':
      return 'teal';
    case 'ESCALATED':
      return 'primary';
    default:
      return 'neutral';
  }
};

const getPriorityBadgeVariant = (priority: string): 'saffron' | 'neutral' => {
  switch (priority?.toUpperCase()) {
    case 'CRITICAL':
    case 'URGENT':
    case 'HIGH':
      return 'saffron';
    default:
      return 'neutral';
  }
};

export const ApplicantGrievanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthority } = useAuth();
  const isAdminOrManager = Boolean(
    user?.roles?.some((r) => ['administrator', 'admin', 'manager'].includes(r.toLowerCase()))
  );

  const [dossier, setDossier] = useState<GrievanceDetailResponse | null>(null);
  const isApplicantOwner = Boolean(user && dossier && dossier.applicant_id === user.id);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadDetail() {
      if (!id) return;
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await grievanceService.getGrievanceDetail(id);
        setDossier(data);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to retrieve grievance dossier.');
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [id]);

  const ContentWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (isAuthority || isAdminOrManager) {
      return (
        <MainLayout currentTab="pillars" onSelectTab={() => navigate('/')} onSignInClick={() => navigate('/authority/login')}>
          <PageContainer style={{ padding: '32px 0 60px' }}>{children}</PageContainer>
        </MainLayout>
      );
    }
    return <ApplicantLayout activeTab="my-grievances">{children}</ApplicantLayout>;
  };

  if (loading) {
    return (
      <ContentWrapper>
        <LoadingState message="Loading grievance details and activity history..." />
      </ContentWrapper>
    );
  }

  if (errorMsg || !dossier) {
    return (
      <ContentWrapper>
        <div className="nivaran-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <AppIcon name="alert-circle" size={24} />
          </div>
          <h3 style={{ color: '#991b1b', margin: '0 0 10px', fontSize: '18px', fontWeight: 600 }}>
            Grievance Details Unavailable
          </h3>
          <p style={{ color: 'var(--vyasa-text-secondary, #64748b)', marginBottom: '24px', maxWidth: '480px', margin: '0 auto 24px' }}>
            {errorMsg || 'The requested grievance record was not found or access was restricted.'}
          </p>
          <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}>
            &larr; Back to My Grievances
          </Button>
        </div>
      </ContentWrapper>
    );
  }

  return (
    <ContentWrapper>
      {/* 1. Stately Breadcrumb Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#64748b', marginBottom: '18px' }}>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--vyasa-navy, #0f2b48)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <AppIcon name="layout-dashboard" size={13} color="var(--vyasa-navy, #0f2b48)" />
          <span>NIVARAN Dashboard</span>
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <button
          type="button"
          onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
          style={{ background: 'none', border: 'none', padding: 0, color: 'var(--vyasa-navy, #0f2b48)', fontWeight: 600, cursor: 'pointer' }}
        >
          My Grievances
        </button>
        <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>
        <span style={{ color: '#64748b', fontWeight: 500 }}>
          Case #{dossier.grievance_id}
        </span>
      </div>

      {/* 2. Stately Case Review Header */}
      <div className="nivaran-case-header">
        <div className="nivaran-case-header__top-bar">
          <div className="nivaran-case-header__title-row">
            <div className="nivaran-case-icon-chip" aria-hidden="true">
              <AppIcon name="file-text" size={20} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 className="nivaran-case-heading">
                  {dossier.grievance_id}
                </h1>
                <Badge variant={getStatusBadgeVariant(dossier.status)}>
                  {dossier.status}
                </Badge>
                <Badge variant={getPriorityBadgeVariant(dossier.priority)}>
                  {dossier.priority} Priority
                </Badge>
              </div>

              <p className="nivaran-case-meta" style={{ marginTop: '6px' }}>
                <span className="nivaran-case-meta__item">
                  <AppIcon name="clock" size={13} color="var(--vyasa-text-muted, #64748b)" />
                  Submitted: <strong>{new Date(dossier.created_at).toLocaleString()}</strong>
                </span>
                <span className="nivaran-case-meta__separator">&bull;</span>
                <span className="nivaran-case-meta__item">
                  <AppIcon name="clock" size={13} color="var(--vyasa-text-muted, #64748b)" />
                  Updated: <strong>{new Date(dossier.updated_at).toLocaleString()}</strong>
                </span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {(isAuthority || isAdminOrManager) && dossier.status === 'PENDING_REVIEW' && (
              <Button
                variant="primary"
                onClick={() => navigate(`/modules/atharva-veda/nivaran/manager/review/${dossier.id}`)}
              >
                Review &amp; Assign Case &rarr;
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <AppIcon name="arrow-left" size={13} /> Back to List
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Top Information Cards Grid (Grievance Details & Review Assignment) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Card A: Grievance Information */}
        <div className="nivaran-card nivaran-card--gold">
          <div className="nivaran-card__header">
            <div className="nivaran-card__header-left">
              <div className="nivaran-card__header-chip nivaran-card__header-chip--gold" aria-hidden="true">
                <AppIcon name="file-text" size={16} color="var(--vyasa-gold-hover, #a16207)" />
              </div>
              <div>
                <h3 className="nivaran-card__title">Grievance Information</h3>
                <p className="nivaran-card__subtitle">Submitted subject, category, and applicant details</p>
              </div>
            </div>
            <Badge variant="neutral" size="sm">Record</Badge>
          </div>

          <div className="nivaran-card__body">
            {/* Title Callout Box */}
            <div className="nivaran-case-title-box">
              <div className="nivaran-case-title-box__label">Grievance Title</div>
              <h4 className="nivaran-case-title-box__text">{dossier.title}</h4>
            </div>

            {/* 2-Column Particulars Grid */}
            <div className="nivaran-particulars-grid">
              <div className="nivaran-field-item">
                <div className="nivaran-field-label">Academic Subject</div>
                <div className="nivaran-field-value">{dossier.subject_name}</div>
                {dossier.subject_cluster_name && (
                  <div className="nivaran-field-sub">{dossier.subject_cluster_name}</div>
                )}
              </div>

              <div className="nivaran-field-item">
                <div className="nivaran-field-label">Submitted Category</div>
                <div className="nivaran-field-value">
                  <span className="nivaran-category-chip">{dossier.category_name}</span>
                </div>
              </div>

              <div className="nivaran-field-item">
                <div className="nivaran-field-label">Applicant</div>
                <div className="nivaran-field-value">{dossier.applicant_name}</div>
                <div className="nivaran-field-sub">{dossier.applicant_email}</div>
              </div>

              <div className="nivaran-field-item">
                <div className="nivaran-field-label">Registration / Roll No.</div>
                <div className="nivaran-field-value">
                  {dossier.student_registration_number ? (
                    <span className="nivaran-tracking-pill">{dossier.student_registration_number}</span>
                  ) : (
                    <span style={{ color: 'var(--vyasa-text-muted, #94a3b8)', fontStyle: 'italic', fontSize: '13px' }}>Not recorded</span>
                  )}
                </div>
              </div>
            </div>

            {/* Adjusted Category Callout (if overridden by manager) */}
            {dossier.final_category_name && dossier.final_category_name !== dossier.category_name && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  backgroundColor: '#fffbeb',
                  borderRadius: '6px',
                  border: '1px solid #fef08a',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <AppIcon name="alert-circle" size={16} color="#b45309" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ color: '#92400e', fontWeight: 600, fontSize: '13px' }}>
                    Adjusted Category: <span style={{ textDecoration: 'underline' }}>{dossier.final_category_name}</span>
                  </div>
                  {dossier.category_override_reason && (
                    <div style={{ fontSize: '12px', color: '#78350f', marginTop: '3px' }}>
                      Reason: {dossier.category_override_reason}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card B: Review & Assignment */}
        <div className="nivaran-card">
          <div className="nivaran-card__header">
            <div className="nivaran-card__header-left">
              <div className="nivaran-card__header-chip nivaran-card__header-chip--teal" aria-hidden="true">
                <AppIcon name="shield" size={16} color="#0d9488" />
              </div>
              <div>
                <h3 className="nivaran-card__title">Review &amp; Assignment</h3>
                <p className="nivaran-card__subtitle">Automatic classification and authority allocation</p>
              </div>
            </div>
            <Badge variant="teal" size="sm">System State</Badge>
          </div>

          <div className="nivaran-card__body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* AI Classification Block */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(2, 132, 199, 0.05)',
                borderRadius: '6px',
                border: '1px solid rgba(2, 132, 199, 0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ fontWeight: 600, color: '#0369a1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AppIcon name="settings" size={14} color="#0369a1" />
                  <span>
                    Automatic Review{' '}
                    <span className="sr-only">AI Automated Processing</span>
                  </span>
                </div>
                {dossier.ai_confidence !== undefined && dossier.ai_confidence !== null && (
                  <Badge variant="teal" size="sm">{(dossier.ai_confidence * 100).toFixed(0)}% Confidence</Badge>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#0c4a6e' }}>
                Suggested Category: <strong>{dossier.ai_suggested_category_name || 'N/A'}</strong>
              </div>
            </div>

            {/* Assigned Authority */}
            <div className="nivaran-field-item">
              <div className="nivaran-field-label">Assigned Authority</div>
              {dossier.assigned_authority_name ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '6px',
                    border: '1px solid var(--vyasa-border, #e2e8f0)',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(27, 42, 74, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--vyasa-navy, #1b2a4a)',
                      }}
                    >
                      <AppIcon name="user" size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy, #1b2a4a)', fontSize: '13.5px' }}>
                        {dossier.assigned_authority_name}
                      </div>
                    </div>
                  </div>
                  {dossier.assigned_authority_role && (
                    <Badge variant="teal" size="sm">
                      {dossier.assigned_authority_role.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#fbfaf7',
                    borderRadius: '6px',
                    border: '1px dashed #cbd5e1',
                    fontSize: '13px',
                    color: 'var(--vyasa-text-secondary, #64748b)',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AppIcon name="clock" size={14} color="#94a3b8" />
                  <span>Awaiting Initial Review &amp; Assignment</span>
                </div>
              )}
            </div>

            {/* Verification Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <span className="nivaran-field-label" style={{ margin: 0 }}>Category Review Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                {dossier.category_reviewed ? (
                  <>
                    <AppIcon name="check-circle" size={14} color="#059669" />
                    <strong style={{ color: '#059669' }}>Verified by Manager</strong>
                  </>
                ) : (
                  <>
                    <AppIcon name="clock" size={14} color="#d97706" />
                    <span style={{ color: '#d97706', fontWeight: 500 }}>Pending Manager Review</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Detailed Statement of Grievance */}
      <div className="nivaran-card" style={{ marginBottom: '24px' }}>
        <div className="nivaran-card__header">
          <div className="nivaran-card__header-left">
            <div className="nivaran-card__header-chip" aria-hidden="true">
              <AppIcon name="book-open" size={16} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <h3 className="nivaran-card__title">Statement of Grievance</h3>
              <p className="nivaran-card__subtitle">Detailed facts and context submitted by the applicant</p>
            </div>
          </div>
        </div>

        <div className="nivaran-card__body">
          <div className="nivaran-statement-box">
            {dossier.description}
          </div>
        </div>
      </div>

      {/* 5. Attached Documents & Evidence */}
      <div className="nivaran-card" style={{ marginBottom: '24px' }}>
        <div className="nivaran-card__header">
          <div className="nivaran-card__header-left">
            <div className="nivaran-card__header-chip" aria-hidden="true">
              <AppIcon name="clipboard" size={16} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <h3 className="nivaran-card__title">Attached Documents &amp; Evidence ({dossier.documents.length})</h3>
              <p className="nivaran-card__subtitle">Authenticated documentation submitted with this grievance</p>
            </div>
          </div>
          {dossier.documents.length > 0 && (
            <Badge variant="teal" size="sm">{dossier.documents.length} File{dossier.documents.length > 1 ? 's' : ''}</Badge>
          )}
        </div>

        <div className="nivaran-card__body">
          {dossier.documents.length === 0 ? (
            <div className="nivaran-empty-state">
              <div className="nivaran-empty-state__icon" aria-hidden="true">
                <AppIcon name="file-text" size={24} />
              </div>
              <p className="nivaran-empty-state__text">
                No supporting documents were attached to this grievance submission.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dossier.documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--vyasa-border, #e2e8f0)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    flexWrap: 'wrap',
                    gap: '12px',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 240px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(27, 42, 74, 0.05)',
                        border: '1px solid rgba(27, 42, 74, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--vyasa-navy, #1b2a4a)',
                        flexShrink: 0,
                      }}
                    >
                      <AppIcon name="file-text" size={18} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--vyasa-navy, #1b2a4a)', wordBreak: 'break-word' }}>
                        {doc.file_name}
                      </div>
                      <div style={{ color: 'var(--vyasa-text-secondary, #64748b)', fontSize: '12px', marginTop: '2px' }}>
                        {formatFileSize(doc.file_size_bytes)}
                        {doc.mime_type && ` • ${doc.mime_type}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {doc.content_hash && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: 'var(--vyasa-text-muted, #64748b)',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '3px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        Verification Hash: <code>{doc.content_hash.slice(0, 16)}...</code>
                      </span>
                    )}
                    <Badge variant="teal" size="sm">Evidence</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. Official Sealed E-File (Rendered when grievance is CLOSED) */}
      {dossier.status === 'CLOSED' && (
        <ClosedCaseEFileCard grievanceId={dossier.id} />
      )}

      {/* 7. Applicant Resolution Feedback (Rendered when grievance is RESOLVED or CLOSED) */}
      {(dossier.status === 'RESOLVED' || dossier.status === 'CLOSED') && (
        <ApplicantFeedbackCard
          grievanceId={dossier.id}
          isApplicantOwner={isApplicantOwner}
        />
      )}

      {/* 8. Refined Status History Timeline Card */}
      <div className="nivaran-card">
        <div className="nivaran-card__header">
          <div className="nivaran-card__header-left">
            <div className="nivaran-card__header-chip" aria-hidden="true">
              <AppIcon name="clock" size={16} color="var(--vyasa-navy, #1b2a4a)" />
            </div>
            <div>
              <h3 className="nivaran-card__title">
                Status History{' '}
                <span className="sr-only">Lifecycle Status History (Immutable Audit Trail)</span>
              </h3>
              <p className="nivaran-card__subtitle">Chronological audit trail of updates and actions taken</p>
            </div>
          </div>
          {dossier.history.length > 0 && (
            <Badge variant="neutral" size="sm">{dossier.history.length} Event{dossier.history.length > 1 ? 's' : ''}</Badge>
          )}
        </div>

        <div className="nivaran-card__body">
          {dossier.history.length === 0 ? (
            <div className="nivaran-empty-state">
              <div className="nivaran-empty-state__icon" aria-hidden="true">
                <AppIcon name="clock" size={24} />
              </div>
              <p className="nivaran-empty-state__text">No status transitions recorded yet.</p>
            </div>
          ) : (
            <div className="nivaran-timeline">
              {dossier.history.map((h, idx) => (
                <div key={h.id || idx} className="nivaran-timeline-node">
                  <div className="nivaran-timeline-node__main">
                    <div className="nivaran-timeline-node__header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="nivaran-timeline-node__transition">
                          {h.from_status ? (
                            <>
                              <span>{h.from_status}</span>
                              <span style={{ color: '#94a3b8', margin: '0 4px' }}>&rarr;</span>
                            </>
                          ) : null}
                          <span style={{ color: 'var(--vyasa-navy, #1b2a4a)', fontWeight: 700 }}>
                            {h.to_status}
                          </span>
                        </span>
                        <Badge variant="neutral" size="sm">{h.actor_type}</Badge>
                      </div>
                      <span className="nivaran-timeline-node__time">
                        {new Date(h.created_at).toLocaleString()}
                      </span>
                    </div>

                    {h.remarks && (
                      <div className="nivaran-timeline-node__remarks">
                        {h.remarks}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ContentWrapper>
  );
};

