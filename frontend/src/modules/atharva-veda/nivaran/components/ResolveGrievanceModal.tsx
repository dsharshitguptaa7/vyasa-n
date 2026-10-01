import React, { useState } from 'react';
import { Modal, Button } from '@vyasa/ui';
import { AssistantDeanResolveRequest } from '../types/grievance';

interface ResolveGrievanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: AssistantDeanResolveRequest) => Promise<void>;
  grievanceId?: string;
  loading?: boolean;
}

export const ResolveGrievanceModal: React.FC<ResolveGrievanceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  grievanceId,
  loading = false,
}) => {
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValid = resolutionNotes.trim().length >= 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg('Resolution summary is required (minimum 3 characters).');
      return;
    }

    setErrorMsg(null);
    try {
      await onSubmit({
        resolution_notes: resolutionNotes.trim(),
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to resolve grievance.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Direct Resolution • ${grievanceId || 'Grievance'}`}
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
            {loading ? 'Submitting Resolution...' : 'Commit Formal Resolution'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          By committing this resolution under Assistant Dean jurisdiction, this grievance will be marked as{' '}
          <strong>RESOLVED</strong>. The resolution summary will be archived in the official audit record and
          notified to the applicant and department.
        </p>

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

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Official Resolution Summary &amp; Determination *
          </label>
          <textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Record the official resolution determination, academic remedial actions taken, and directives issued..."
            rows={5}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '4px',
              border: isValid ? '1px solid #d1d5db' : '1px solid #f87171',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px' }}>
            <span style={{ color: isValid ? 'var(--vyasa-text-muted)' : '#b91c1c' }}>
              Minimum 3 characters required.
            </span>
            <span style={{ color: 'var(--vyasa-text-muted)' }}>{resolutionNotes.trim().length} chars</span>
          </div>
        </div>
      </form>
    </Modal>
  );
};
