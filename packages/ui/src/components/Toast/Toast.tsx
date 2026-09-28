import React from 'react';

export interface ToastProps {
  title: string;
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger';
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  title,
  message,
  variant = 'info',
  onClose,
  className = '',
}) => {
  return (
    <div className={`vyasa-toast vyasa-toast--${variant} ${className}`} role="status">
      <div style={{ flex: 1 }}>
        <div className="vyasa-toast__title">{title}</div>
        {message && <div className="vyasa-toast__message">{message}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="vyasa-btn vyasa-btn--ghost vyasa-btn--sm"
          style={{ padding: '2px 6px', fontSize: '14px', lineHeight: 1 }}
          aria-label="Dismiss toast"
        >
          &times;
        </button>
      )}
    </div>
  );
};
