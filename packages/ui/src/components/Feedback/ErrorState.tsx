import React, { useState } from 'react';
import { Button } from '../Button';

export interface ErrorStateProps {
  title?: string;
  message?: React.ReactNode;
  error?: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * ErrorState: Institutional error state component presenting dignified,
 * human-readable messaging suitable for scholars, staff, and authorities.
 * Shields users from raw database exceptions and offers a safe retry path.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to Load Content',
  message = 'An unexpected issue occurred while retrieving this record. Please try again or contact support if the issue persists.',
  error,
  onRetry,
  retryLabel = 'Try Again',
  action,
  showBack = false,
  onBack,
  className = '',
  style,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  // Derive human-readable string from unknown error without leaking internal traces
  const technicalMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : null;

  return (
    <div
      className={`vyasa-error-state ${className}`.trim()}
      role="alert"
      style={{
        textAlign: 'center',
        padding: '36px 24px',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        maxWidth: '560px',
        margin: '24px auto',
        ...style,
      }}
    >
      {/* Institutional Error Icon */}
      <div
        className="vyasa-error-state__icon"
        aria-hidden="true"
        style={{
          width: '44px',
          height: '44px',
          margin: '0 auto 14px',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          style={{ width: '38px', height: '38px' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 7.5h.008v.008H12v-.008z"
          />
        </svg>
      </div>

      <h3
        style={{
          margin: '0 0 8px',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#991b1b',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      <div
        style={{
          fontSize: '13.5px',
          color: '#475569',
          lineHeight: 1.5,
          marginBottom: '20px',
        }}
      >
        {message}
      </div>

      {/* Primary & Secondary Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {showBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack || (() => window.history.back())}
          >
            Go Back
          </Button>
        )}

        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}

        {action}
      </div>

      {/* Expandable Technical Details (Shielded from regular view) */}
      {technicalMessage && (
        <div style={{ marginTop: '20px', textAlign: 'left' }}>
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '11.5px',
              color: '#64748b',
              cursor: 'pointer',
              textDecoration: 'underline',
              display: 'block',
              margin: '0 auto',
            }}
          >
            {showDetails ? 'Hide Diagnostic Details' : 'Show Diagnostic Details'}
          </button>
          {showDetails && (
            <pre
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '11px',
                color: '#334155',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {technicalMessage}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
