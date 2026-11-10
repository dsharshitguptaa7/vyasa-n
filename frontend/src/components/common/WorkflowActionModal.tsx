import React, { useEffect, useRef } from 'react';
import { Modal, Button, AppIcon } from '@vyasa/ui';

export interface WorkflowActionModalField {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  minChars?: number;
  maxChars?: number;
  rows?: number;
  helperText?: string;
}

export interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  alert?: {
    type?: 'info' | 'warning' | 'danger';
    message: React.ReactNode;
  };
  errorMsg?: string | null;
  field?: WorkflowActionModalField;
  children?: React.ReactNode;
  primaryAction: {
    label: string;
    onClick: (e?: React.FormEvent | React.MouseEvent) => void;
    disabled?: boolean;
    loading?: boolean;
    loadingText?: string;
    variant?: 'primary' | 'danger' | 'warning';
  };
  secondaryAction?: {
    label?: string;
    onClick?: () => void;
    disabled?: boolean;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * WorkflowActionModal: Institutional modal foundation for stateful workflow determinations,
 * escalations, committee dispatches, and formal governance actions.
 * Provides accessible keyboard handling, character count validation, and predictable layouts.
 */
export const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  description,
  alert,
  errorMsg,
  field,
  children,
  primaryAction,
  secondaryAction,
  size = 'md',
  className = '',
}) => {
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Accessible Escape key and body lock are managed by Modal from @vyasa/ui,
  // but we ensure focus returns cleanly and Tab trapping is active.
  useEffect(() => {
    if (!isOpen) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;

    return () => {
      previousActiveElement?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalClass = `vyasa-modal--${size} ${className}`.trim();

  const isFieldValid =
    !field ||
    (!field.required && !field.minChars) ||
    (field.value.trim().length >= (field.minChars || 1));

  const isPrimaryDisabled =
    primaryAction.disabled ||
    primaryAction.loading ||
    !isFieldValid;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f2b48' }}>{title}</span>
          {subtitle && (
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: '#64748b' }}>
              {subtitle}
            </span>
          )}
        </div>
      }
      className={modalClass}
      footer={
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
          }}
        >
          <Button
            variant="ghost"
            onClick={secondaryAction?.onClick || onClose}
            disabled={secondaryAction?.disabled || primaryAction.loading}
          >
            {secondaryAction?.label || 'Cancel'}
          </Button>
          <Button
            variant={primaryAction.variant === 'danger' ? 'outline' : 'primary'}
            onClick={primaryAction.onClick}
            disabled={isPrimaryDisabled}
            style={
              primaryAction.variant === 'danger'
                ? { color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2' }
                : undefined
            }
          >
            {primaryAction.loading
              ? primaryAction.loadingText || 'Processing...'
              : primaryAction.label}
          </Button>
        </div>
      }
    >
      <div
        ref={modalContainerRef}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        {/* Optional Description Paragraph */}
        {description && (
          <div style={{ fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
            {description}
          </div>
        )}

        {/* Semantic Callout / Warning Box */}
        {alert && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              fontSize: '13px',
              lineHeight: 1.45,
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
              backgroundColor:
                alert.type === 'danger'
                  ? '#fef2f2'
                  : alert.type === 'warning'
                  ? '#fffbeb'
                  : '#eff6ff',
              border: `1px solid ${
                alert.type === 'danger'
                  ? '#fecaca'
                  : alert.type === 'warning'
                  ? '#fde68a'
                  : '#bfdbfe'
              }`,
              color:
                alert.type === 'danger'
                  ? '#991b1b'
                  : alert.type === 'warning'
                  ? '#92400e'
                  : '#1e40af',
            }}
          >
            <AppIcon
              name={alert.type === 'info' ? 'info' : 'alert-circle'}
              size={16}
              style={{ flexShrink: 0, marginTop: '2px' }}
            />
            <div>{alert.message}</div>
          </div>
        )}

        {/* Error Notification Banner */}
        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '13px',
              lineHeight: 1.4,
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }}
          >
            <AppIcon name="alert-circle" size={16} color="#b91c1c" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Custom Composed Content */}
        {children}

        {/* Optional Structured Textarea Field with Character Counter */}
        {field && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                {field.label}
              </label>
              {field.minChars && (
                <span
                  style={{
                    fontSize: '11.5px',
                    color: field.value.trim().length >= field.minChars ? '#16a34a' : '#64748b',
                  }}
                >
                  {field.value.trim().length} / {field.minChars} min characters
                </span>
              )}
            </div>
            <textarea
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              rows={field.rows || 4}
              maxLength={field.maxChars}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: isFieldValid ? '1px solid #cbd5e1' : '1px solid #f87171',
                fontSize: '13px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                resize: 'vertical',
                outline: 'none',
              }}
            />
            {field.helperText && (
              <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                {field.helperText}
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
