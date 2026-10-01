import React, { useEffect, useState } from 'react';
import { PageContainer, Card, Badge, Button, LoadingState } from '@vyasa/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { grievanceService } from '../services/grievanceService';
import {
  GrievanceDetailResponse,
  GrievancePriority,
  RoutingPreviewResponse,
  TaxonomyCategoryItem,
} from '../types/grievance';

export const ManagerGrievanceReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dossier, setDossier] = useState<GrievanceDetailResponse | null>(null);
  const [categories, setCategories] = useState<TaxonomyCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Review Form State
  const [confirmCategory, setConfirmCategory] = useState<boolean>(true);
  const [overrideCategoryId, setOverrideCategoryId] = useState<string>('');
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [priority, setPriority] = useState<GrievancePriority>('MEDIUM');
  const [remarks, setRemarks] = useState<string>('');

  // Live Routing Preview State
  const [routingPreview, setRoutingPreview] = useState<RoutingPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        setLoading(true);
        setErrorMsg(null);
        const [grv, cats] = await Promise.all([
          grievanceService.getGrievanceDetail(id),
          grievanceService.getTaxonomyCategories(),
        ]);
        setDossier(grv);
        setCategories(cats);
        setPriority(grv.priority);

        // Pre-select override category to AI suggestion or first available if different
        const initialOverrideCat = grv.ai_suggested_category_id || cats[0]?.id || '';
        setOverrideCategoryId(initialOverrideCat);

        // Fetch initial preview
        fetchRoutingPreview(id, undefined);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load case data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  const fetchRoutingPreview = async (caseId: string, catId?: string) => {
    try {
      setPreviewLoading(true);
      setPreviewError(null);
      const preview = await grievanceService.previewRouting(caseId, catId);
      setRoutingPreview(preview);
    } catch (err: unknown) {
      setPreviewError(err instanceof Error ? err.message : 'Failed to calculate routing destination.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Re-fetch preview when category mode or override category changes
  const handleModeChange = (isConfirm: boolean) => {
    setConfirmCategory(isConfirm);
    if (!id) return;
    if (isConfirm) {
      fetchRoutingPreview(id, undefined);
    } else if (overrideCategoryId) {
      fetchRoutingPreview(id, overrideCategoryId);
    }
  };

  const handleOverrideCategoryChange = (catId: string) => {
    setOverrideCategoryId(catId);
    if (!id) return;
    fetchRoutingPreview(id, catId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!confirmCategory && (!overrideCategoryId || !overrideReason.trim())) {
      setErrorMsg('Override reason is mandatory when altering grievance category.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      await grievanceService.reviewAndAssignGrievance(id, {
        confirm_category: confirmCategory,
        override_category_id: confirmCategory ? undefined : overrideCategoryId,
        override_reason: confirmCategory ? undefined : overrideReason.trim(),
        priority,
        remarks: remarks.trim() || undefined,
      });

      setSuccessMsg('Grievance successfully triaged, categorized, and assigned to accountable authority.');
      setTimeout(() => {
        navigate('/modules/atharva-veda/nivaran/manager/queue');
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to commit triage assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <LoadingState message="Loading case dossier and calculating dynamic routing..." />
      </PageContainer>
    );
  }

  if (!dossier) {
    return (
      <PageContainer style={{ padding: '40px 0' }}>
        <Card variant="default">
          <p style={{ color: '#b91c1c', textAlign: 'center' }}>Case not found.</p>
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ padding: '40px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--vyasa-navy)' }}>
              Manager Triage &bull; {dossier.grievance_id}
            </h2>
            <Badge variant="teal">{dossier.status}</Badge>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
            Ratify or override category and assign case to accountable Stage 1 Assistant Dean.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/modules/atharva-veda/nivaran/manager/queue')}>
          &larr; Back to Queue
        </Button>
      </div>

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            color: '#166534',
            marginBottom: '20px',
            fontSize: '13px',
          }}
        >
          &check; {successMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Case Dossier Summary */}
        <Card variant="gold-accent" title="Submitted Particulars">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Title:</span>{' '}
              <strong>{dossier.title}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Scholar / Applicant:</span>{' '}
              <strong>{dossier.applicant_name}</strong> ({dossier.applicant_email})
            </div>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Academic Subject:</span>{' '}
              <strong>{dossier.subject_name}</strong>
              {dossier.subject_cluster_name && (
                <span> ({dossier.subject_cluster_name})</span>
              )}
            </div>
            <div>
              <span style={{ color: 'var(--vyasa-text-secondary)' }}>Applicant Category:</span>{' '}
              <strong>{dossier.category_name}</strong>
            </div>
            <div style={{ padding: '10px', backgroundColor: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
              <div style={{ fontWeight: 600, color: '#0369a1', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>AI Model Recommendation (TF-IDF + LR)</span>
                {dossier.category_reviewed && (
                  <Badge variant={dossier.category_overridden ? "gold" : "teal"}>
                    {dossier.category_overridden ? "Manager Overridden" : "Ratified"}
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>Suggested Category: <strong>{dossier.ai_suggested_category_name || dossier.category_name || 'N/A'}</strong></span>
                {dossier.ai_confidence !== undefined && dossier.ai_confidence !== null && (
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        dossier.ai_confidence >= 0.8
                          ? '#065f46'
                          : dossier.ai_confidence >= 0.6
                          ? '#b45309'
                          : '#64748b',
                    }}
                  >
                    &bull; Confidence: {(dossier.ai_confidence * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginTop: '6px' }}>
              <span style={{ color: 'var(--vyasa-text-secondary)', display: 'block', marginBottom: '4px' }}>
                Statement of Facts:
              </span>
              <div
                style={{
                  maxHeight: '160px',
                  overflowY: 'auto',
                  padding: '10px',
                  backgroundColor: '#fafafa',
                  borderRadius: '4px',
                  border: '1px solid var(--vyasa-border)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                {dossier.description}
              </div>
            </div>
          </div>
        </Card>

        {/* Manager Action & Routing Decision Form */}
        <Card variant="default" title="Triage Decision &amp; Dynamic Assignment">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            {/* Category Ratification or Override Selection */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
                Category Ratification Decision *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="categoryDecision"
                    checked={confirmCategory}
                    onChange={() => handleModeChange(true)}
                  />
                  <span>
                    <strong>Confirm Category:</strong> {dossier.category_name}
                  </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="categoryDecision"
                    checked={!confirmCategory}
                    onChange={() => handleModeChange(false)}
                  />
                  <span>
                    <strong>Override Category</strong> (Correct classification)
                  </span>
                </label>
              </div>
            </div>

            {/* Override Category Selector & Justification */}
            {!confirmCategory && (
              <div style={{ padding: '12px', backgroundColor: '#fffbeb', borderRadius: '6px', border: '1px solid #fef08a' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', color: '#92400e' }}>
                  New Grievance Category *
                </label>
                <select
                  value={overrideCategoryId}
                  onChange={(e) => handleOverrideCategoryChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--vyasa-border)',
                    fontSize: '13px',
                    backgroundColor: '#fff',
                    marginBottom: '10px',
                  }}
                  required
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} &bull; Route: {cat.routing_type}
                    </option>
                  ))}
                </select>

                <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#92400e' }}>
                  Override Justification * (Audit Requirement)
                </label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  placeholder="State the institutional reason for re-categorizing this grievance..."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #fde047',
                    fontSize: '12px',
                    boxSizing: 'border-box',
                  }}
                  required
                />
              </div>
            )}

            {/* Dynamic Routing Destination Live Preview */}
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#f8fafc',
                borderRadius: '6px',
                border: '1px solid var(--vyasa-border)',
              }}
            >
              <div style={{ fontWeight: 600, color: 'var(--vyasa-navy)', marginBottom: '4px' }}>
                Dynamic Routing Destination Preview (Stage 1: Subject Assistant Dean)
              </div>
              <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: 'var(--vyasa-text-secondary)' }}>
                Under NIVARAN-AI sequential routing, cases route first to the Subject Assistant Dean. Category routing occurs downstream upon Assistant Dean forward.
              </p>
              {previewLoading ? (
                <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
                  Calculating accountable authority...
                </div>
              ) : previewError ? (
                <div style={{ fontSize: '12px', color: '#dc2626' }}>
                  &times; {previewError}
                </div>
              ) : routingPreview ? (
                <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
                  <div>
                    Accountable Authority:{' '}
                    <strong>{routingPreview.target_authority_name}</strong>
                  </div>
                  <div>
                    Role &amp; Jurisdiction:{' '}
                    <Badge variant="teal">{routingPreview.target_authority_role}</Badge>{' '}
                    <span style={{ color: 'var(--vyasa-text-secondary)' }}>
                      ({routingPreview.routing_type})
                    </span>
                  </div>
                  <div style={{ color: 'var(--vyasa-text-secondary)' }}>
                    Email: {routingPreview.target_authority_email}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Priority Adjustment */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
                Priority Adjustment
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as GrievancePriority)}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vyasa-border)',
                  fontSize: '13px',
                  backgroundColor: '#fff',
                }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Triage Remarks */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>
                Triage Instructions / Remarks (Optional)
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Specific guidance for the assigned authority..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--vyasa-border)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={submitting || previewLoading || !!previewError}
            >
              {submitting ? 'Assigning Case...' : 'Confirm & Route to Authority'}
            </Button>
          </form>
        </Card>
      </div>
    </PageContainer>
  );
};
