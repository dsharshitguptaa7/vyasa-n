import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState, AppIcon } from '@vyasa/ui';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ResolveGrievanceModal } from '../components/ResolveGrievanceModal';
import { ForwardToDeanModal } from '../components/ForwardToDeanModal';
import { RequestDocumentModal } from '../components/RequestDocumentModal';
import { RequestCommitteeModal } from '../components/RequestCommitteeModal';
import { ClosedCaseEFileCard } from '../components/ClosedCaseEFileCard';
import { grievanceService } from '../services/grievanceService';
import {
  AssociateDeanForwardRequest,
  AssociateDeanGrievanceDetailResponse,
  AssociateDeanResolveRequest,
  DocumentRequestItem,
} from '../types/grievance';

export const AssociateDeanGrievanceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dossier, setDossier] = useState<AssociateDeanGrievanceDetailResponse | null>(null);
  const [docRequests, setDocRequests] = useState<DocumentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isCommitteeModalOpen, setIsCommitteeModalOpen] = useState(false);

  // Inline escalation form state
  const [inlineRemarks, setInlineRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadCase = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setErrorMsg(null);
      const [caseData, docReqs] = await Promise.all([
        grievanceService.getAssociateDeanGrievanceDetail(id),
        grievanceService.getGrievanceDocumentRequests(id).catch(() => []),
      ]);
      setDossier(caseData);
      setDocRequests(docReqs);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Case dossier could not be found or you lack Associate Dean jurisdiction.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [id]);

  const handleResolveSubmit = async (payload: AssociateDeanResolveRequest) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.resolveAssociateDeanGrievance(id, payload);
      setActionSuccessMsg('Grievance has been formally resolved.');
      setIsResolveModalOpen(false);
      await loadCase();
    } finally {
      setActionLoading(false);
    }
  };

  const handleForwardSubmit = async (payload: AssociateDeanForwardRequest) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.forwardAssociateDeanGrievance(id, payload);
      setActionSuccessMsg('Grievance has been successfully escalated to Dean R&D (Executive Tier).');
      setIsForwardModalOpen(false);
      await loadCase();
    } finally {
      setActionLoading(false);
    }
  };

  const handleInlineEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineRemarks.trim() || !id) return;
    try {
      setActionLoading(true);
      await grievanceService.forwardAssociateDeanGrievance(id, {
        reason: inlineRemarks.trim(),
        remarks: inlineRemarks.trim(),
      });
      setActionSuccessMsg('Grievance has been successfully escalated to Dean R&D with institutional remarks.');
      setInlineRemarks('');
      await loadCase();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to escalate grievance.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocRequestSubmit = async (payload: any) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.requestAssociateDeanDocuments(id, {
        documents: payload.documents || [{ document_name: payload.document_name, description: payload.description }],
        deadline: payload.deadline,
      });
      setActionSuccessMsg('Document request dispatched to applicant.');
      setIsDocModalOpen(false);
      await loadCase();
    } finally {
      setActionLoading(false);
    }
  };

  const handleCommitteeRequestSubmit = async (payload: any) => {
    if (!id) return;
    try {
      setActionLoading(true);
      await grievanceService.requestAssociateDeanCommittee(id, {
        justification: payload.reason || payload.justification,
        proposed_scope: payload.proposed_scope,
        supporting_remarks: payload.supporting_remarks,
      });
      setActionSuccessMsg('Inquiry committee request submitted for executive sanction.');
      setIsCommitteeModalOpen(false);
      await loadCase();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <LoadingState message="Loading case dossier and jurisdiction records..." />
      </PageContainer>
    );
  }

  if (errorMsg || !dossier) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card style={{ padding: '36px', textAlign: 'center', borderColor: '#fca5a5' }}>
          <div style={{ color: '#ef4444', fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
            Access Restricted or Dossier Not Found
          </div>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
            {errorMsg || 'The requested grievance is not assigned to your Associate Dean cluster jurisdiction.'}
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/modules/atharva-veda/nivaran/associate-dean/dashboard')}
          >
            Return to Queue
          </Button>
        </Card>
      </PageContainer>
    );
  }

  const isResolvedOrClosed = dossier.status === 'RESOLVED' || dossier.status === 'CLOSED';
  const canAct = !isResolvedOrClosed && (dossier.status as string) !== 'ESCALATED';
  const canForward = Boolean(dossier.can_forward || dossier.routing?.can_forward) && canAct;
  const targetDean = dossier.stage3_dean_preview
    ? {
        id: dossier.stage3_dean_preview.target_authority_id,
        name: dossier.stage3_dean_preview.target_authority_name,
        role: dossier.stage3_dean_preview.target_authority_role,
        email: dossier.stage3_dean_preview.target_authority_email,
      }
    : dossier.next_authority || null;

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '20px' }}>
        <Link
          to="/modules/atharva-veda/nivaran/associate-dean/dashboard"
          style={{ textDecoration: 'none', color: '#64748b', fontSize: '14px', fontWeight: 500 }}
        >
          &larr; Back to Associate Dean Docket
        </Link>
      </div>

      {actionSuccessMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '6px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#047857',
            fontSize: '14px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{actionSuccessMsg}</span>
          <button
            onClick={() => setActionSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#047857', cursor: 'pointer', fontSize: '16px' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <Card style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <Badge variant="teal">STAGE 2 CLUSTER JURISDICTION</Badge>
              <span style={{ fontFamily: 'monospace', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
                {dossier.grievance_id}
              </span>
              <Badge
                variant={
                  dossier.status === 'RESOLVED'
                    ? 'teal'
                    : (dossier.status as string) === 'ESCALATED'
                    ? 'primary'
                    : 'saffron'
                }
              >
                {dossier.status}
              </Badge>
              <Badge variant={dossier.priority === 'HIGH' || dossier.priority === 'URGENT' ? 'saffron' : 'teal'}>
                {dossier.priority}
              </Badge>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 }}>
              {dossier.title}
            </h1>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
              Submitted on{' '}
              {new Date(dossier.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>

          {/* Action Buttons in Header */}
          {canAct && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                onClick={() => setIsResolveModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <AppIcon name="check-circle" size={14} /> Direct Resolution
              </Button>
              {canForward && (
                <Button
                  variant="outline"
                  onClick={() => setIsForwardModalOpen(true)}
                >
                  &rarr; Escalate to Dean R&D
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={() => setIsDocModalOpen(true)}
              >
                + Request Documents
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsCommitteeModalOpen(true)}
              >
                + Request Committee
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Official Sealed E-File (Rendered when grievance is CLOSED) */}
      {dossier.status === 'CLOSED' && (
        <ClosedCaseEFileCard grievanceId={dossier.id} />
      )}

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Left Column: Grievance Statement & Applicant */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Particulars Card */}
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>
              Grievance Particulars & Classification
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Full Grievance Statement
                </span>
                <p style={{ color: '#334155', marginTop: '6px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {dossier.description}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                    Academic Subject
                  </span>
                  <strong style={{ color: '#1e293b' }}>{dossier.subject_name || 'Academic Subject'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                    Final Grievance Category
                  </span>
                  <strong style={{ color: '#1e293b' }}>
                    {dossier.final_category_name || dossier.category_name || 'General Category'}
                  </strong>
                </div>
              </div>

              {(dossier as any).ai_classification && (
                <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                      AI Triage Prediction
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563eb' }}>
                      {(((dossier as any).ai_classification.confidence_score || 0) * 100).toFixed(0)}% Match
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#1e293b' }}>
                    {(dossier as any).ai_classification.predicted_category_name || 'Categorized by ML Pipeline'}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Applicant Info Card */}
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>
              Applicant & Academic Profile
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '14px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Full Name
                </span>
                <strong style={{ color: '#1e293b' }}>{dossier.applicant_name || 'Scholar Applicant'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Roll / Registration No.
                </span>
                <span style={{ fontFamily: 'monospace', color: '#334155' }}>
                  {(dossier as any).applicant_roll_number || dossier.student_registration_number || 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Official Email
                </span>
                <span style={{ color: '#334155' }}>{dossier.applicant_email || 'student@csjmu.ac.in'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Department / Program
                </span>
                <span style={{ color: '#334155' }}>{(dossier as any).applicant_department || dossier.subject_cluster_name || dossier.subject_name || 'University Scholar'}</span>
              </div>
            </div>
          </Card>

          {/* Supporting Evidence Card */}
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>
              Evidentiary Attachments ({dossier.documents?.length || 0})
            </h2>
            {dossier.documents && dossier.documents.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dossier.documents.map((doc, idx) => (
                  <div
                    key={doc.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                        {doc.file_name || `Evidence Document ${idx + 1}`}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(0)} KB` : 'Verified attachment'}
                      </div>
                    </div>
                    {doc.file_path && (
                      <a
                        href={doc.file_path}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}
                      >
                        View &darr;
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                No initial evidentiary files attached to this grievance submission.
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Actions & Destination Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Stage 3 Escalation Target Card */}
          <Card style={{ padding: '24px', borderLeft: '4px solid #8b5cf6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Stage 3 Executive Destination
              </span>
              <Badge variant="teal">EXECUTIVE TIER</Badge>
            </div>
            {targetDean ? (
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>
                  {targetDean.name}
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  Dean of Research & Development &bull; {targetDean.email}
                </div>
                <div style={{ fontSize: '12px', color: '#8b5cf6', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>&#10003; Configured Dean authority is active and mapped for executive escalation</span>
                </div>
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                Dean routing target is currently unconfigured or terminal.
              </div>
            )}
          </Card>

          {/* Jurisdictional Determinations & Direct Resolution */}
          {canAct && (
            <Card style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                Jurisdictional Determinations
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                Execute decisive redressal or escalate with institutional justification to Dean R&D.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Direct Resolution Button */}
                <div style={{ padding: '14px', borderRadius: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
                    Direct Redressal Resolution
                  </div>
                  <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '10px' }}>
                    Commit formal resolution summary and directives directly within Associate Dean authority.
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setIsResolveModalOpen(true)}
                    disabled={actionLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <AppIcon name="check-circle" size={14} /> Direct Resolution
                  </Button>
                </div>

                {/* Escalation to Dean R&D */}
                {canForward && (
                  <div style={{ padding: '14px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
                      Escalate to Dean R&D (Executive Tier)
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      Case will be transferred to {targetDean?.name || 'Dean R&D'} with your institutional remarks.
                    </div>

                    <form onSubmit={handleInlineEscalateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <textarea
                        rows={3}
                        value={inlineRemarks}
                        onChange={(e) => setInlineRemarks(e.target.value)}
                        placeholder="Provide detailed justification explaining why Dean R&D intervention is required..."
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                        }}
                        disabled={actionLoading}
                      />
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={actionLoading || !inlineRemarks.trim()}
                        >
                          {actionLoading ? 'Escalating...' : 'Escalate to Dean R&D \u2192'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setIsForwardModalOpen(true)}
                          disabled={actionLoading}
                        >
                          Open Detailed Modal
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Document & Committee Auxiliaries */}
                <div style={{ display: 'flex', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <Button
                    variant="ghost"
                    style={{ flex: 1 }}
                    onClick={() => setIsDocModalOpen(true)}
                    disabled={actionLoading}
                  >
                    Request Evidentiary Documents
                  </Button>
                  <Button
                    variant="ghost"
                    style={{ flex: 1 }}
                    onClick={() => setIsCommitteeModalOpen(true)}
                    disabled={actionLoading}
                  >
                    Request Inquiry Committee
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Official Resolution Card (When Resolved) */}
          {isResolvedOrClosed && (
            <Card style={{ padding: '24px', borderLeft: '4px solid #10b981', background: '#f0fdf4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                  Formal Case Resolution Record
                </span>
                <Badge variant="teal">{dossier.status}</Badge>
              </div>
              <div style={{ fontSize: '14px', color: '#166534', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '14px' }}>
                {dossier.resolution_summary || 'Direct resolution committed under institutional authority.'}
              </div>
              {dossier.resolved_at && (
                <div style={{ fontSize: '12px', color: '#15803d' }}>
                  Resolved on{' '}
                  {new Date(dossier.resolved_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Pending Document Requests */}
          {docRequests.length > 0 && (
            <Card style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1e293b', marginBottom: '12px' }}>
                Evidentiary Document Requests ({docRequests.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {docRequests.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{req.document_name}</strong>
                      <Badge variant={req.status === 'UPLOADED' ? 'teal' : 'saffron'}>
                        {req.status || 'PENDING'}
                      </Badge>
                    </div>
                    {req.description && (
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        {req.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Status History & Audit Timeline */}
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>
              Case Timeline & Audit History
            </h2>
            {dossier.history && dossier.history.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {dossier.history.map((entry, idx) => (
                  <div
                    key={entry.id || idx}
                    style={{
                      paddingLeft: '14px',
                      borderLeft: '2px solid #cbd5e1',
                      position: 'relative',
                    }}
                  >
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                      {entry.from_status} &rarr; {entry.to_status}
                    </div>
                    {entry.remarks && (
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', lineHeight: 1.5 }}>
                        {entry.remarks}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      {entry.created_at
                        ? new Date(entry.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                No historical workflow transitions recorded.
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Action Modals */}
      <ResolveGrievanceModal
        isOpen={isResolveModalOpen}
        onClose={() => setIsResolveModalOpen(false)}
        onSubmit={handleResolveSubmit}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />

      <ForwardToDeanModal
        isOpen={isForwardModalOpen}
        onClose={() => setIsForwardModalOpen(false)}
        onSubmit={handleForwardSubmit}
        targetDean={targetDean}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />

      <RequestDocumentModal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        onSubmit={handleDocRequestSubmit}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />

      <RequestCommitteeModal
        isOpen={isCommitteeModalOpen}
        onClose={() => setIsCommitteeModalOpen(false)}
        onSubmit={handleCommitteeRequestSubmit}
        grievanceId={dossier.grievance_id}
        loading={actionLoading}
      />
    </PageContainer>
  );
};
