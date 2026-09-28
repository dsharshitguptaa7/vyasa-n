import React from 'react';

export interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
  className = '',
}) => {
  const spinnerSize = size === 'sm' ? 18 : size === 'lg' ? 36 : 26;

  return (
    <div className={`vyasa-loading ${className}`} role="status" aria-live="polite">
      <div
        className="vyasa-spinner"
        style={{ width: `${spinnerSize}px`, height: `${spinnerSize}px` }}
      />
      {message && <span style={{ fontSize: size === 'sm' ? '12px' : '14px' }}>{message}</span>}
    </div>
  );
};
