import React, { useEffect, useState } from 'react';
import { Modal, Button } from '@vyasa/ui';
import {
  CommitteeDirectCreatePayload,
  CommitteeMemberCreateItem,
  EligibleAuthorityItem,
} from '../types/grievance';
import { grievanceService } from '../services/grievanceService';

interface FormCommitteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CommitteeDirectCreatePayload) => Promise<void>;
  grievanceId?: string;
  grievanceUuid: string;
  approvedRequestId?: string;
  loading?: boolean;
}

export const FormCommitteeModal: React.FC<FormCommitteeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  grievanceId,
  grievanceUuid,
  approvedRequestId,
  loading = false,
}) => {
  const [committeeName, setCommitteeName] = useState('');
  const [termsOfReference, setTermsOfReference] = useState('');
  const [chairpersonId, setChairpersonId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [authorities, setAuthorities] = useState<EligibleAuthorityItem[]>([]);
  const [loadingAuths, setLoadingAuths] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setCommitteeName(`Inquiry Committee — Case ${grievanceId || ''}`);
    setErrorMsg(null);

    let mounted = true;
    const fetchAuthorities = async () => {
      try {
        setLoadingAuths(true);
        if (typeof grievanceService.getEligibleAuthorities !== 'function') {
          return;
        }
        const list = await grievanceService.getEligibleAuthorities();
        if (!mounted) return;
        setAuthorities(list);

        // Pre-select first authority as chairperson if none chosen
        if (list.length > 0 && !chairpersonId) {
          setChairpersonId(list[0].id);
        }
      } catch (err) {
        console.warn('Failed to load eligible authorities for committee formation', err);
      } finally {
        if (mounted) setLoadingAuths(false);
      }
    };

    fetchAuthorities();
    return () => {
      mounted = false;
    };
  }, [isOpen, grievanceId]);

  const toggleMember = (authId: string) => {
    if (authId === chairpersonId) return; // Chairperson is added automatically
    setSelectedMemberIds((prev) =>
      prev.includes(authId) ? prev.filter((id) => id !== authId) : [...prev, authId]
    );
  };

  const isValid =
    committeeName.trim().length >= 3 &&
    Boolean(chairpersonId) &&
    selectedMemberIds.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setErrorMsg('Please specify committee title, chairperson, and at least one member.');
      return;
    }

    setErrorMsg(null);
    const membersPayload: CommitteeMemberCreateItem[] = [
      { authority_id: chairpersonId, member_role: 'CHAIRPERSON' },
      ...selectedMemberIds
        .filter((id) => id !== chairpersonId)
        .map((id) => ({
          authority_id: id,
          member_role: 'MEMBER' as const,
        })),
    ];

    try {
      await onSubmit({
        grievance_id: grievanceUuid,
        committee_name: committeeName.trim(),
        terms_of_reference: termsOfReference.trim() || undefined,
        chairperson_id: chairpersonId,
        members: membersPayload,
        creation_request_id: approvedRequestId || undefined,
      });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to form committee.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Direct Committee Formation &bull; ${grievanceId || 'Grievance'}`}
      className="vyasa-modal--lg"
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
            {loading ? 'Constituting Committee...' : 'Form Inquiry Committee'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          Direct committee formation constitutes a formal inquiry panel within authorised institutional jurisdiction.
          Appointed authorities will receive official NIVARAN notifications and case docket access.
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

        {/* Committee Title */}
        <div>
          <label htmlFor="direct-committee-name" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Committee Name / Title *
          </label>
          <input
            id="direct-committee-name"
            type="text"
            value={committeeName}
            onChange={(e) => setCommitteeName(e.target.value)}
            placeholder="e.g. Departmental Fact-Finding Inquiry Committee"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '4px',
              border: '1px solid #d1d5db',
              fontSize: '13px',
            }}
          />
        </div>

        {/* Terms of Reference */}
        <div>
          <label htmlFor="direct-committee-tor" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Terms &amp; Purpose of Inquiry
          </label>
          <textarea
            id="direct-committee-tor"
            value={termsOfReference}
            onChange={(e) => setTermsOfReference(e.target.value)}
            placeholder="Specify terms of reference, investigation mandate, timelines, and reporting requirements..."
            rows={3}
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

        {/* Chairperson Selection */}
        <div>
          <label htmlFor="direct-committee-chair" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Chairperson / Convenor *
          </label>
          {loadingAuths ? (
            <div style={{ fontSize: '13px', color: '#64748b' }}>Loading authorities...</div>
          ) : (
            <select
              id="direct-committee-chair"
              value={chairpersonId}
              onChange={(e) => {
                const newChair = e.target.value;
                setChairpersonId(newChair);
                // remove from regular members if chosen as chairperson
                setSelectedMemberIds((prev) => prev.filter((id) => id !== newChair));
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '4px',
                border: '1px solid #d1d5db',
                fontSize: '13px',
                backgroundColor: '#fff',
              }}
            >
              <option value="">-- Select Chairperson --</option>
              {authorities.map((auth) => (
                <option key={auth.id} value={auth.id}>
                  {auth.name} ({auth.role.replace('_', ' ')} &mdash; {auth.department || auth.designation || 'Academic Authority'})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Additional Committee Members */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Appointed Committee Members * (Select at least 1)
          </label>
          <div
            style={{
              maxHeight: '160px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              backgroundColor: '#f8fafc',
            }}
          >
            {authorities
              .filter((a) => a.id !== chairpersonId)
              .map((auth) => {
                const isSelected = selectedMemberIds.includes(auth.id);
                return (
                  <label
                    key={auth.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? '#e0f2fe' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMember(auth.id)}
                    />
                    <span>
                      <strong>{auth.name}</strong> ({auth.role.replace('_', ' ')} &mdash; {auth.department || auth.designation || 'Authority'})
                    </span>
                  </label>
                );
              })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Selected: {selectedMemberIds.length} member(s) + 1 chairperson
          </div>
        </div>

        {approvedRequestId && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              fontSize: '12px',
              color: '#166534',
            }}
          >
            &bull; Linking to Approved Request ID: <code>{approvedRequestId}</code>
          </div>
        )}
      </form>
    </Modal>
  );
};
