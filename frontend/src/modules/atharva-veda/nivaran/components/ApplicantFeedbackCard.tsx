import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@vyasa/ui';
import { phase6dService } from '../services/phase6dService';
import { GrievanceFeedbackResponse } from '../types/phase6d';

interface ApplicantFeedbackCardProps {
  grievanceId: string;
  isApplicantOwner: boolean;
  onFeedbackSubmitted?: (feedback: GrievanceFeedbackResponse) => void;
}

export const ApplicantFeedbackCard: React.FC<ApplicantFeedbackCardProps> = ({
  grievanceId,
  isApplicantOwner,
  onFeedbackSubmitted,
}) => {
  const [existingFeedback, setExistingFeedback] = useState<GrievanceFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [rating, setRating] = useState<number>(5);
  const [timelinessRating, setTimelinessRating] = useState<number>(5);
  const [fairnessRating, setFairnessRating] = useState<number>(5);
  const [feedbackText, setFeedbackText] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    async function loadFeedback() {
      try {
        setLoading(true);
        const fb = await phase6dService.getFeedback(grievanceId);
        if (isMounted) {
          setExistingFeedback(fb);
        }
      } catch {
        // Ignored, may not have feedback yet
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadFeedback();
    return () => {
      isMounted = false;
    };
  }, [grievanceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      const created = await phase6dService.submitFeedback(grievanceId, {
        rating,
        timeliness_rating: timelinessRating,
        fairness_rating: fairnessRating,
        feedback_text: feedbackText.trim() ? feedbackText.trim() : undefined,
      });
      setExistingFeedback(created);
      setSuccessMsg('Your feedback has been submitted successfully to the institutional review board.');
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(created);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStarSelector = (
    label: string,
    value: number,
    onChange: (val: number) => void
  ) => {
    return (
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-text-primary, #1e293b)' }}>
            {label}
          </span>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#d97706' }}>
            {value} / 5 Stars
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              style={{
                background: star <= value ? '#fef3c7' : '#f8fafc',
                border: star <= value ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
                color: star <= value ? '#b45309' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              ★ {star}
            </button>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card variant="gold-accent" title="Applicant Resolution Feedback" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '16px', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          Checking feedback status...
        </div>
      </Card>
    );
  }

  // Already submitted view
  if (existingFeedback) {
    return (
      <Card variant="gold-accent" title="Applicant Resolution Feedback" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Badge variant="teal">Feedback Recorded</Badge>
            <span style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>
              Submitted on {new Date(existingFeedback.created_at).toLocaleString()}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              padding: '12px',
              backgroundColor: '#f8fafc',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>Overall Resolution Quality</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                ★ {existingFeedback.rating} / 5
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>Response Timeliness</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                ★ {existingFeedback.timeliness_rating} / 5
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--vyasa-text-secondary)' }}>Fairness & Process Equity</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                ★ {existingFeedback.fairness_rating} / 5
              </div>
            </div>
          </div>

          {existingFeedback.feedback_text && (
            <div style={{ marginTop: '8px' }}>
              <span style={{ color: 'var(--vyasa-text-secondary)', fontWeight: 600 }}>Applicant Remarks:</span>
              <p
                style={{
                  margin: '6px 0 0',
                  padding: '12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  color: '#334155',
                  fontStyle: 'italic',
                }}
              >
                "{existingFeedback.feedback_text}"
              </p>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // Not owner: viewing only
  if (!isApplicantOwner) {
    return (
      <Card variant="gold-accent" title="Applicant Resolution Feedback" style={{ marginBottom: '24px' }}>
        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          Awaiting applicant evaluation. Feedback has not been submitted by the applicant yet.
        </div>
      </Card>
    );
  }

  // Form view for applicant owner
  return (
    <Card variant="gold-accent" title="Share Your Resolution Feedback" style={{ marginBottom: '24px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          This grievance has been resolved by the designated university authority. Please rate your experience to help the Manager and Institutional Oversight maintain accountability.
        </p>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              color: '#b91c1c',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f0fdf4',
              color: '#15803d',
              borderRadius: '6px',
              border: '1px solid #bbf7d0',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            {successMsg}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {renderStarSelector('Overall Resolution Quality', rating, setRating)}
          {renderStarSelector('Response Timeliness', timelinessRating, setTimelinessRating)}
          {renderStarSelector('Fairness & Procedural Equity', fairnessRating, setFairnessRating)}
        </div>

        <div style={{ marginTop: '8px' }}>
          <label
            htmlFor="feedback-comments"
            style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--vyasa-text-primary, #1e293b)', marginBottom: '6px' }}
          >
            Additional Comments or Observations (Optional)
          </label>
          <textarea
            id="feedback-comments"
            rows={3}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share any additional observations regarding the resolution or process..."
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid var(--vyasa-border, #cbd5e1)',
              fontSize: '13px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <Button variant="primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting Feedback...' : 'Submit Resolution Feedback'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
