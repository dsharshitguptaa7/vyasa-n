import React, { useState } from 'react';
import { Modal, Button, Badge } from '@vyasa/ui';
import { AssociateDeanForwardRequest } from '../types/grievance';

interface ForwardToDeanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AssociateDeanForwardRequest) => Promise<void>;
  targetDean?: {
    id: string;
    name: string;
    role: string;
    email: string;
  } | null;
  grievanceId?: string;
  loading?: boolean;
}

export const ForwardToDeanModal: React.FC<ForwardToDeanModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  targetDean,
  grievanceId,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValid = reason.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg('Institutional justification is required (minimum 5 characters).');
      return;
    }

    setErrorMsg(null);
    try {
      await onSubmit({
        reason: reason.trim(),
        remarks: remarks.trim() || undefined,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to escalate grievance to Dean.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Escalate Grievance to Dean R&D • ${grievanceId || 'Case'}`}
      className="vyasa-modal--md"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? 'Submitting Escalation...' : 'Confirm Escalation to Dean \u2192'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Target Destination Card */}
        <div
          style={{
            padding: '14px',
            borderRadius: '6px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Stage 3 Escalation Destination
            </span>
            <Badge variant="teal">EXECUTIVE TIER</Badge>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            {targetDean?.name || 'Prof. Namita Tiwari'}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
            Dean of Research & Development &bull; {targetDean?.email || 'research@csjmu.ac.in'}
          </div>
        </div>

        {/* Justification Textarea */}
        <div>
          <label
            htmlFor="dean-escalate-reason"
            style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
          >
            Institutional Escalation Justification <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            id="dean-escalate-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why higher-tier intervention by Dean R&D is required for this grievance..."
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            disabled={loading}
          />
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            Minimum 5 characters. This justification will be recorded in official status history.
          </div>
        </div>

        {/* Optional Remarks */}
        <div>
          <label
            htmlFor="dean-escalate-remarks"
            style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
          >
            Additional Case Notes / Remarks (Optional)
          </label>
          <textarea
            id="dean-escalate-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Additional notes for executive records..."
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            disabled={loading}
          />
        </div>
      </div>
    </Modal>
  );
};
