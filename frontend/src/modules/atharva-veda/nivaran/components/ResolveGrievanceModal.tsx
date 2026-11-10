import React, { useState } from 'react';
import { WorkflowActionModal } from '../../../../components/common/WorkflowActionModal';
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

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();
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
    <WorkflowActionModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Direct Resolution • ${grievanceId || 'Grievance'}`}
      size="md"
      description={
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary)' }}>
          By committing this resolution under Assistant Dean jurisdiction, this grievance will be marked as{' '}
          <strong>RESOLVED</strong>. The resolution summary will be archived in the official audit record and
          notified to the applicant and department.
        </p>
      }
      errorMsg={errorMsg}
      field={{
        label: 'Official Resolution Summary & Determination *',
        value: resolutionNotes,
        onChange: setResolutionNotes,
        placeholder: 'Record the official resolution determination, academic remedial actions taken, and directives issued...',
        rows: 5,
        minChars: 3,
        required: true,
        helperText: 'Minimum 3 characters required.',
      }}
      primaryAction={{
        label: 'Commit Formal Resolution',
        onClick: handleSubmit,
        disabled: !isValid,
        loading,
        loadingText: 'Submitting Resolution...',
      }}
      secondaryAction={{
        label: 'Cancel',
        onClick: onClose,
        disabled: loading,
      }}
    />
  );
};
