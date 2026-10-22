import React, { useEffect, useState } from 'react';
import { Modal, Button } from '@vyasa/ui';
import { CommitteeRequestPayload, EligibleAuthorityItem } from '../types/grievance';
import { grievanceService } from '../services/grievanceService';

interface RequestCommitteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CommitteeRequestPayload) => Promise<void>;
  grievanceId?: string;
  callerRole?: 'ASSISTANT_DEAN' | 'ASSOCIATE_DEAN' | 'DEAN';
  loading?: boolean;
}

export const RequestCommitteeModal: React.FC<RequestCommitteeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  grievanceId,
  callerRole = 'ASSISTANT_DEAN',
  loading = false,
}) => {
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('');
  const [rolesInput, setRolesInput] = useState('Department Head, External Subject Expert, Faculty Observer');
  const [targetAuthorityId, setTargetAuthorityId] = useState<string>('');
  const [authorities, setAuthorities] = useState<EligibleAuthorityItem[]>([]);
  const [loadingAuthorities, setLoadingAuthorities] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    const fetchAuthorities = async () => {
      try {
        setLoadingAuthorities(true);
        if (typeof grievanceService.getEligibleAuthorities !== 'function') {
          return;
        }
        const auths = await grievanceService.getEligibleAuthorities();
        if (!mounted) return;
        setAuthorities(auths);

        if (callerRole === 'ASSOCIATE_DEAN') {
          // Associate Dean must request from Dean ONLY
          const dean = auths.find((a) => a.role === 'DEAN');
          if (dean) setTargetAuthorityId(dean.id);
        } else if (callerRole === 'ASSISTANT_DEAN') {
          // Assistant Dean can select Associate Dean or Dean
          const eligible = auths.filter((a) => a.role === 'ASSOCIATE_DEAN' || a.role === 'DEAN');
          if (eligible.length > 0 && !targetAuthorityId) {
            setTargetAuthorityId(eligible[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load eligible authorities for committee request', err);
      } finally {
        if (mounted) setLoadingAuthorities(false);
      }
    };

    fetchAuthorities();
    return () => {
      mounted = false;
    };
  }, [isOpen, callerRole]);

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
        justification: reason.trim(),
        target_authority_id: targetAuthorityId || undefined,
        proposed_scope: scope.trim() || undefined,
        proposed_member_roles: proposedRoles.length > 0 ? proposedRoles : undefined,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to request committee formation.');
    }
  };

  const eligibleRecipients =
    callerRole === 'ASSOCIATE_DEAN'
      ? authorities.filter((a) => a.role === 'DEAN')
      : authorities.filter((a) => a.role === 'ASSOCIATE_DEAN' || a.role === 'DEAN');

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
          {callerRole === 'ASSOCIATE_DEAN'
            ? 'Associate Deans can request formal committee constitution from the Dean. Approval allows authorised committee creation.'
            : 'Assistant Deans can request formal committee constitution from an Associate Dean or Dean.'}
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

        {/* Intended Recipient Selection */}
        <div>
          <label htmlFor="target-authority-select" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Intended Recipient Authority *
          </label>
          {loadingAuthorities ? (
            <div style={{ fontSize: '13px', color: '#64748b' }}>Loading eligible authorities...</div>
          ) : callerRole === 'ASSOCIATE_DEAN' ? (
            <div
              id="target-authority-select"
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                color: '#334155',
              }}
            >
              <strong>Dean (Executive Academic Authority)</strong> &mdash; Dean R&amp;D / Academic Affairs
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                Note: Under the institutional permission matrix, Associate Deans must request committee formation directly from the Dean.
              </div>
            </div>
          ) : (
            <select
              id="target-authority-select"
              value={targetAuthorityId}
              onChange={(e) => setTargetAuthorityId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                backgroundColor: '#fff',
              }}
            >
              <option value="">-- Select Associate Dean or Dean --</option>
              {eligibleRecipients.map((auth) => (
                <option key={auth.id} value={auth.id}>
                  {auth.name} ({auth.role.replace('_', ' ')} — {auth.department || auth.designation || 'Academic Authority'})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label htmlFor="request-committee-reason" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Justification &amp; Terms of Inquiry *
          </label>
          <textarea
            id="request-committee-reason"
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
            Proposed Inquiry Scope / Terms of Reference (Optional)
          </label>
          <textarea
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Outline specific terms of reference, key witnesses to hear, and targeted outcomes..."
            rows={2}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '13px',
              fontFamily: 'inherit',
            }}
          />
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
