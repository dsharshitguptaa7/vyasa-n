import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import { GrievanceDetailResponse } from '../types/grievance';
import { useAuth } from '../../../../context/AuthContext';

import { ApplicantFeedbackCard } from '../components/ApplicantFeedbackCard';
import { ClosedCaseEFileCard } from '../components/ClosedCaseEFileCard';

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

  if (loading) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <LoadingState message="Retrieving grievance dossier and cryptographic history..." />
      </PageContainer>
    );
  }

  if (errorMsg || !dossier) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card variant="default">
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ color: '#b91c1c', margin: '0 0 12px' }}>Dossier Unavailable</h3>
            <p style={{ color: 'var(--vyasa-text-secondary)', marginBottom: '20px' }}>
              {errorMsg || 'The requested grievance record was not found or access was restricted.'}
            </p>
            <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}>
              &larr; Back to My Grievances
            </Button>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: 'var(--vyasa-navy)' }}>
              {dossier.grievance_id}
            </h2>
            <Badge variant="teal">{dossier.status}</Badge>
            <Badge variant="saffron">{dossier.priority} Priority</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Registered on {new Date(dossier.created_at).toLocaleString()} &bull; Last updated {new Date(dossier.updated_at).toLocaleString()}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {(isAuthority || isAdminOrManager) && dossier.status === 'PENDING_REVIEW' && (
            <Button
              variant="primary"
              onClick={() => navigate(`/modules/atharva-veda/nivaran/manager/review/${dossier.id}`)}
            >
              Triage &amp; Assign Case &rarr;
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/my-grievances')}>
            &larr; Back to List
          </Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Case Metadata */}
        <Card variant="gold-accent" title="Grievance Particulars">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Title:</span>{' '}
              <strong>{dossier.title}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Academic Subject:</span>{' '}
              <strong>{dossier.subject_name}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Submitted Category:</span>{' '}
              <strong>{dossier.category_name}</strong>
            </div>
            {dossier.final_category_name && dossier.final_category_name !== dossier.category_name && (
              <div style={{ padding: '8px', backgroundColor: '#fffbeb', borderRadius: '4px', border: '1px solid #fef08a' }}>
                <span style={{ color: '#b45309', fontWeight: 600 }}>Overridden Category:</span>{' '}
                <strong>{dossier.final_category_name}</strong>
                {dossier.category_override_reason && (
                  <div style={{ fontSize: '12px', color: '#92400e', marginTop: '4px' }}>
                    Reason: {dossier.category_override_reason}
                  </div>
                )}
              </div>
            )}
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Applicant:</span>{' '}
              <strong>{dossier.applicant_name}</strong> ({dossier.applicant_email})
            </div>
            {dossier.student_registration_number && (
              <div>
                <span style={{ color: 'var(--vyasa-text-secondary)' }}>Registration Number:</span>{' '}
                <code>{dossier.student_registration_number}</code>
              </div>
            )}
          </div>
        </Card>

        {/* AI Processing & Dynamic Assignment */}
        <Card variant="default" title="Triage &amp; Accountability">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            {/* AI Classification Block */}
            <div style={{ padding: '10px 14px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
              <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>AI Automated Processing</span>
                {dossier.ai_confidence !== undefined && dossier.ai_confidence !== null && (
                  <Badge variant="teal">{(dossier.ai_confidence * 100).toFixed(0)}% Confidence</Badge>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#0c4a6e' }}>
                Suggested Category: <strong>{dossier.ai_suggested_category_name || 'N/A'}</strong>
              </div>
            </div>

            {/* Assigned Authority */}
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Assigned Authority:</span>{' '}
              {dossier.assigned_authority_name ? (
                <div style={{ marginTop: '4px', padding: '8px 12px', backgroundColor: '#f9fafb', borderRadius: '4px', border: '1px solid var(--vyasa-border)' }}>
                  <strong>{dossier.assigned_authority_name}</strong>
                  {dossier.assigned_authority_role && (
                    <span style={{ marginLeft: '8px' }}>
                      <Badge variant="neutral">{dossier.assigned_authority_role}</Badge>
                    </span>
                  )}
                </div>
              ) : (
                <span style={{ fontStyle: 'italic', color: 'var(--vyasa-text-secondary)' }}>
                  Awaiting Manager Triage Assignment
                </span>
              )}
            </div>

            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Category Reviewed by Manager:</span>{' '}
              <strong>{dossier.category_reviewed ? 'Yes' : 'Pending Review'}</strong>
            </div>
          </div>
        </Card>
      </div>

      {/* Description / Statement of Facts */}
      <Card variant="default" title="Statement of Facts" style={{ marginBottom: '24px' }}>
        <div
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.7,
            color: '#1f2937',
            fontSize: '14px',
            backgroundColor: '#fafafa',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid var(--vyasa-border)',
          }}
        >
          {dossier.description}
        </div>
      </Card>

      {/* Supporting Documents */}
      {dossier.documents.length > 0 && (
        <Card variant="default" title="Attached Documents &amp; Evidence" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {dossier.documents.map((doc) => (
              <div
                key={doc.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--vyasa-border)',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                <div>
                  <strong>{doc.file_name}</strong>{' '}
                  <span style={{ color: 'var(--vyasa-text-secondary)', fontSize: '12px' }}>
                    ({(doc.file_size_bytes / 1024).toFixed(1)} KB &bull; {doc.mime_type})
                  </span>
                </div>
                {doc.content_hash && (
                  <span style={{ fontSize: '11px', color: 'var(--vyasa-text-muted)' }}>
                    SHA-256: <code>{doc.content_hash.slice(0, 16)}...</code>
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Official Sealed E-File (Rendered when grievance is CLOSED) */}
      {dossier.status === 'CLOSED' && (
        <ClosedCaseEFileCard grievanceId={dossier.id} />
      )}

      {/* Applicant Resolution Feedback (Rendered when grievance is RESOLVED or CLOSED) */}
      {(dossier.status === 'RESOLVED' || dossier.status === 'CLOSED') && (
        <ApplicantFeedbackCard
          grievanceId={dossier.id}
          isApplicantOwner={isApplicantOwner}
        />
      )}

      {/* Immutable Status History Audit Trail */}
      <Card variant="default" title="Lifecycle Status History (Immutable Audit Trail)">
        {dossier.history.length === 0 ? (
          <p style={{ color: 'var(--vyasa-text-secondary)', fontSize: '13px' }}>No history records logged yet.</p>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '24px' }}>
            <div
              style={{
                position: 'absolute',
                top: '8px',
                bottom: '8px',
                left: '7px',
                width: '2px',
                backgroundColor: 'var(--vyasa-border)',
              }}
            />
            {dossier.history.map((h, idx) => (
              <div
                key={h.id || idx}
                style={{
                  position: 'relative',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: '-24px',
                    top: '4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: idx === dossier.history.length - 1 ? 'var(--vyasa-navy)' : '#9ca3af',
                    border: '2px solid #ffffff',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>
                    {h.from_status ? `${h.from_status} \u2192 ` : ''}
                    {h.to_status}
                  </strong>
                  <Badge variant="neutral">{h.actor_type}</Badge>
                  <span style={{ color: 'var(--vyasa-text-secondary)', fontSize: '12px' }}>
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                </div>
                {h.remarks && (
                  <p style={{ margin: '4px 0 0', color: 'var(--vyasa-text-secondary)', fontSize: '12px' }}>
                    {h.remarks}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </PageContainer>
  );
};
