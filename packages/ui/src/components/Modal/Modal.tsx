import React, { useEffect } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = '',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="vyasa-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className={`vyasa-modal ${className}`}>
        <div className="vyasa-modal__header">
          <h3 className="vyasa-modal__title">{title}</h3>
          <button
            type="button"
            className="vyasa-btn vyasa-btn--ghost vyasa-btn--sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ padding: '4px 8px', fontSize: '18px', lineHeight: 1 }}
          >
            &times;
          </button>
        </div>

        <div className="vyasa-modal__body">{children}</div>

        {footer && <div className="vyasa-modal__footer">{footer}</div>}
      </div>
    </div>
  );
};
