import React, { useState } from 'react';
import { Modal, Button } from '@vyasa/ui';
import { CommitteeRequestPayload } from '../types/grievance';

interface RequestCommitteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CommitteeRequestPayload) => Promise<void>;
  grievanceId?: string;
  loading?: boolean;
}

export const RequestCommitteeModal: React.FC<RequestCommitteeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  grievanceId,
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [rolesInput, setRolesInput] = useState('Department Head, External Subject Expert, Faculty Observer');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isValid = reason.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg('Justification for committee formation is required (min. 5 characters).');
      return;
    }

    setErrorMsg(null);
    const proposedRoles = rolesInput
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    try {
      await onSubmit({
        reason: reason.trim(),
        proposed_member_roles: proposedRoles.length > 0 ? proposedRoles : undefined,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request committee formation.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Request Committee Formation &bull; ${grievanceId || 'Grievance'}`}
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
            {loading ? 'Submitting Request...' : 'Submit Committee Formation Request'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          Requesting an inquiry committee creates a formal recommendation for higher university leadership
          (Associate Dean / Dean) to constitute an ad-hoc committee for investigation.
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
            Justification &amp; Scope of Inquiry *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why an ad-hoc fact-finding inquiry committee is required to resolve this dispute..."
            rows={4}
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
              Minimum 5 characters required.
            </span>
            <span style={{ color: 'var(--vyasa-text-muted)' }}>{reason.trim().length} chars</span>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Proposed Member Roles / Designations (Comma-separated)
          </label>
          <input
            type="text"
            value={rolesInput}
            onChange={(e) => setRolesInput(e.target.value)}
            placeholder="e.g., Head of Department, External Evaluator, Student Representative"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '13px',
            }}
          />
        </div>
      </form>
    </Modal>
  );
};
