import React, { useState, useEffect } from 'react';
import { Modal, Button, AppIcon } from '@vyasa/ui';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: React.ReactNode;
  affectedRecord?: string | { title: string; subtitle?: string; id?: string };
  variant?: 'danger' | 'warning' | 'primary';
  confirmLabel?: string;
  cancelLabel?: string;
  isIrreversible?: boolean;
  irreversibleWarning?: string;
  requiredConfirmationText?: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * ConfirmDialog: Institutional confirmation dialog for high-consequence,
 * destructive, or irreversible actions (e.g., permanent deletion, deactivation,
 * certificate revocation, authority reassignments).
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  affectedRecord,
  variant = 'danger',
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isIrreversible = variant === 'danger',
  irreversibleWarning = 'This action cannot be undone. Associated audit logs and state changes will be permanently recorded.',
  requiredConfirmationText,
  loading = false,
  error = null,
  className = '',
}) => {
  const [typedConfirmation, setTypedConfirmation] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTypedConfirmation('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmationMatched =
    !requiredConfirmationText ||
    typedConfirmation.trim().toLowerCase() === requiredConfirmationText.trim().toLowerCase();

  const isConfirmDisabled = loading || !isConfirmationMatched;

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;
    await onConfirm();
  };

  const recordTitle =
    typeof affectedRecord === 'string'
      ? affectedRecord
      : affectedRecord?.title || null;
  const recordSubtitle =
    typeof affectedRecord === 'object' ? affectedRecord?.subtitle : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AppIcon
            name={variant === 'primary' ? 'info' : 'alert-circle'}
            size={18}
            color={variant === 'danger' ? '#dc2626' : variant === 'warning' ? '#d97706' : '#0f2b48'}
          />
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f2b48' }}>{title}</span>
        </div>
      }
      className={`vyasa-confirm-dialog vyasa-modal--md ${className}`.trim()}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%' }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'outline' : 'primary'}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            style={
              variant === 'danger'
                ? {
                    color: '#dc2626',
                    borderColor: '#fca5a5',
                    backgroundColor: isConfirmDisabled ? '#fef2f2' : '#fee2e2',
                  }
                : undefined
            }
          >
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Error notification */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#991b1b',
              fontSize: '13px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <AppIcon name="alert-circle" size={16} color="#991b1b" />
            <span>{error}</span>
          </div>
        )}

        {/* Affected Record Card */}
        {recordTitle && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              Affected Record
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f2b48', marginTop: '2px' }}>
              {recordTitle}
            </div>
            {recordSubtitle && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {recordSubtitle}
              </div>
            )}
          </div>
        )}

        {/* Informational Message */}
        {message && (
          <div style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
            {message}
          </div>
        )}

        {/* Irreversible Action Warning */}
        {isIrreversible && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '12.5px',
              lineHeight: 1.45,
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
            }}
          >
            <AppIcon name="alert-circle" size={16} color="#d97706" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong>Irreversible Action:</strong> {irreversibleWarning}
            </div>
          </div>
        )}

        {/* Required Confirmation Text Input */}
        {requiredConfirmationText && (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px',
              }}
            >
              Please type <strong>{requiredConfirmationText}</strong> to confirm:
            </label>
            <input
              type="text"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={`Type "${requiredConfirmationText}"`}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
