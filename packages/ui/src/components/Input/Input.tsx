import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  hint,
  error,
  id,
  className = '',
  containerClassName = '',
  required,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className={`vyasa-form-group ${containerClassName}`}>
      {label && (
        <label htmlFor={inputId} className="vyasa-label">
          <span>
            {label}
            {required && <span style={{ color: 'var(--vyasa-saffron)', marginLeft: '4px' }}>*</span>}
          </span>
        </label>
      )}

      <input
        id={inputId}
        className={`vyasa-input ${error ? 'vyasa-input--error' : ''} ${className}`}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        aria-invalid={!!error}
        required={required}
        {...props}
      />

      {hint && !error && (
        <span id={hintId} className="vyasa-form-hint">
          {hint}
        </span>
      )}

      {error && (
        <span id={errorId} className="vyasa-form-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
