import React, { useState } from 'react';
import { Modal, Button, Badge } from '@vyasa/ui';
import {
  AssistantDeanForwardRequest,
  ForwardingConfirmationPayload,
  RoutingPreviewResponse,
} from '../types/grievance';

interface ForwardConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AssistantDeanForwardRequest) => Promise<void>;
  routingPreview?: RoutingPreviewResponse | null;
  loading?: boolean;
}

export const ForwardConfirmationModal: React.FC<ForwardConfirmationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  routingPreview,
  loading = false,
}) => {
  const [checkboxes, setCheckboxes] = useState({
    reviewed_student_submission: false,
    reviewed_prior_history: false,
    reviewed_regulations: false,
    verified_no_conflict: false,
    confirmed_jurisdiction: false,
    confirmed_recommendations_actionable: false,
  });

  const [reasonsJustification, setReasonsJustification] = useState('');
  const [preliminaryFindings, setPreliminaryFindings] = useState('');
  const [specificQuestions, setSpecificQuestions] = useState('');
  const [forwardingNotes, setForwardingNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const checkedCount = Object.values(checkboxes).filter(Boolean).length;
  const allCheckboxesChecked = checkedCount === 6;

  const reasonsValid = reasonsJustification.trim().length >= 5;
  const findingsValid = preliminaryFindings.trim().length >= 5;
  const questionsValid = specificQuestions.trim().length >= 5;
  const isFormValid = allCheckboxesChecked && reasonsValid && findingsValid && questionsValid;

  const handleCheckboxChange = (key: keyof typeof checkboxes) => {
    setCheckboxes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFormSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
    if (!isFormValid || loading) {
      if (!isFormValid) {
        setErrorMsg('All 6 affirmations must be checked and all 3 justifications must have at least 5 characters.');
      }
      return;
    }

    setErrorMsg(null);
    const confirmation: ForwardingConfirmationPayload = {
      reasons_justification: reasonsJustification.trim(),
      preliminary_findings: preliminaryFindings.trim(),
      specific_questions: specificQuestions.trim(),
      reviewed_student_submission: checkboxes.reviewed_student_submission,
      reviewed_prior_history: checkboxes.reviewed_prior_history,
      reviewed_regulations: checkboxes.reviewed_regulations,
      verified_no_conflict: checkboxes.verified_no_conflict,
      confirmed_jurisdiction: checkboxes.confirmed_jurisdiction,
      confirmed_recommendations_actionable: checkboxes.confirmed_recommendations_actionable,
    };

    try {
      await onSubmit({
        target_authority_id: routingPreview?.target_authority_id,
        forwarding_notes: forwardingNotes.trim() || undefined,
        confirmation,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to forward grievance.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Forward Grievance — Stage 2 Routing Escalation"
      className="vyasa-modal--lg"
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Validation Status Indicator */}
          <div style={{ flex: '1 1 auto', minWidth: '240px' }}>
            {!isFormValid ? (
              <span
                style={{
                  fontSize: '12px',
                  color: '#b45309',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 500,
                }}
              >
                <span role="img" aria-label="warning">⚠️</span>
                <span>
                  {!allCheckboxesChecked
                    ? `Affirmations incomplete (${checkedCount}/6 checked)`
                    : !reasonsValid
                    ? 'Reasons for Escalation requires min. 5 chars'
                    : !findingsValid
                    ? 'Preliminary Findings requires min. 5 chars'
                    : 'Specific Questions requires min. 5 chars'}
                </span>
              </span>
            ) : (
              <span
                style={{
                  fontSize: '12px',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
              >
                <span>✓</span>
                <span>All 6 affirmations and 3 justifications validated</span>
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
            <Button variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleFormSubmit}
              disabled={!isFormValid || loading}
              data-testid="forward-grievance-submit-btn"
            >
              {loading ? 'Forwarding Grievance...' : 'Forward Grievance'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        onSubmit={handleFormSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Stage 2 Dynamic Routing Target Card */}
        {routingPreview && (
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              fontSize: '13px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: '#1e40af',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '6px',
              }}
            >
              Stage 2 Escalation Destination (Category Dynamic Route)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ color: '#1e293b' }}>
                Target Authority: <strong>{routingPreview.target_authority_name}</strong>
              </span>
              <Badge variant="teal" size="sm">{routingPreview.target_authority_role}</Badge>
              <Badge variant="saffron" size="sm">{routingPreview.routing_type}</Badge>
              <span style={{ color: '#64748b' }}>({routingPreview.target_authority_email})</span>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Part 1: Affirmations */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            <h4
              style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--vyasa-navy)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontWeight: 700,
              }}
            >
              Part 1: Institutional Verification Affirmations (All 6 Required)
            </h4>
            <Badge variant={allCheckboxesChecked ? 'teal' : 'saffron'} size="sm">
              {checkedCount} / 6 Verified
            </Badge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: checkboxes.reviewed_student_submission ? '#f0fdf4' : '#f8fafc',
                border: checkboxes.reviewed_student_submission ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={checkboxes.reviewed_student_submission}
                onChange={() => handleCheckboxChange('reviewed_student_submission')}
                style={{ marginTop: '2px', accentColor: 'var(--vyasa-primary)' }}
              />
              <span style={{ lineHeight: '1.5', color: '#1e293b' }}>
                1. I have thoroughly reviewed the student's submission, timeline, and all attached evidence.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: checkboxes.reviewed_prior_history ? '#f0fdf4' : '#f8fafc',
                border: checkboxes.reviewed_prior_history ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={checkboxes.reviewed_prior_history}
                onChange={() => handleCheckboxChange('reviewed_prior_history')}
                style={{ marginTop: '2px', accentColor: 'var(--vyasa-primary)' }}
              />
              <span style={{ lineHeight: '1.5', color: '#1e293b' }}>
                2. I have verified prior grievance history and institutional records relevant to this scholar.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: checkboxes.reviewed_regulations ? '#f0fdf4' : '#f8fafc',
                border: checkboxes.reviewed_regulations ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={checkboxes.reviewed_regulations}
                onChange={() => handleCheckboxChange('reviewed_regulations')}
                style={{ marginTop: '2px', accentColor: 'var(--vyasa-primary)' }}
              />
              <span style={{ lineHeight: '1.5', color: '#1e293b' }}>
                3. I have consulted the relevant CSJMU academic ordinances, rules, and departmental guidelines.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: checkboxes.verified_no_conflict ? '#f0fdf4' : '#f8fafc',
                border: checkboxes.verified_no_conflict ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={checkboxes.verified_no_conflict}
                onChange={() => handleCheckboxChange('verified_no_conflict')}
                style={{ marginTop: '2px', accentColor: 'var(--vyasa-primary)' }}
              />
              <span style={{ lineHeight: '1.5', color: '#1e293b' }}>
                4. I certify that I have no personal, academic, or professional conflict of interest in this matter.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: checkboxes.confirmed_jurisdiction ? '#f0fdf4' : '#f8fafc',
                border: checkboxes.confirmed_jurisdiction ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={checkboxes.confirmed_jurisdiction}
                onChange={() => handleCheckboxChange('confirmed_jurisdiction')}
                style={{ marginTop: '2px', accentColor: 'var(--vyasa-primary)' }}
              />
              <span style={{ lineHeight: '1.5', color: '#1e293b' }}>
                5. I confirm that resolution of this matter requires escalation to Stage 2 authority jurisdiction.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: '6px',
                backgroundColor: checkboxes.confirmed_recommendations_actionable ? '#f0fdf4' : '#f8fafc',
                border: checkboxes.confirmed_recommendations_actionable ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="checkbox"
                checked={checkboxes.confirmed_recommendations_actionable}
                onChange={() => handleCheckboxChange('confirmed_recommendations_actionable')}
                style={{ marginTop: '2px', accentColor: 'var(--vyasa-primary)' }}
              />
              <span style={{ lineHeight: '1.5', color: '#1e293b' }}>
                6. I have formulated clear, actionable preliminary findings and specific questions for the receiving authority.
              </span>
            </label>
          </div>
        </div>

        {/* Part 2: Mandatory Justifications */}
        <div>
          <h4
            style={{
              margin: '0 0 10px',
              fontSize: '13px',
              color: 'var(--vyasa-navy)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 700,
            }}
          >
            Part 2: Mandatory Justifications (Min. 5 Characters Each)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Field 1: Reasons for Escalation */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Reasons for Escalation <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: reasonsValid ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                  {reasonsValid ? '✓ Valid' : `${reasonsJustification.trim().length}/5 min characters`}
                </span>
              </div>
              <textarea
                value={reasonsJustification}
                onChange={(e) => setReasonsJustification(e.target.value)}
                placeholder="Explain why this grievance cannot be resolved at the Assistant Dean level..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: reasonsValid ? '1px solid #cbd5e1' : '1px solid #fca5a5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Field 2: Preliminary Findings */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Preliminary Findings <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: findingsValid ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                  {findingsValid ? '✓ Valid' : `${preliminaryFindings.trim().length}/5 min characters`}
                </span>
              </div>
              <textarea
                value={preliminaryFindings}
                onChange={(e) => setPreliminaryFindings(e.target.value)}
                placeholder="Summarize initial verification findings, facts established, and departmental inputs..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: findingsValid ? '1px solid #cbd5e1' : '1px solid #fca5a5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Field 3: Specific Questions */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Specific Questions / Actions for Stage 2 Authority <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: questionsValid ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                  {questionsValid ? '✓ Valid' : `${specificQuestions.trim().length}/5 min characters`}
                </span>
              </div>
              <textarea
                value={specificQuestions}
                onChange={(e) => setSpecificQuestions(e.target.value)}
                placeholder="Specify what determinations or executive approvals are required..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: questionsValid ? '1px solid #cbd5e1' : '1px solid #fca5a5',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
            </div>

            {/* Field 4: Additional Notes (Optional) */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Additional Forwarding Notes (Optional)
              </label>
              <input
                type="text"
                value={forwardingNotes}
                onChange={(e) => setForwardingNotes(e.target.value)}
                placeholder="Optional brief remarks for the receiving authority..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
