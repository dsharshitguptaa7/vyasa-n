import React, { useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  hint,
  error,
  options,
  placeholder,
  id,
  className = '',
  containerClassName = '',
  required,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;

  return (
    <div className={`vyasa-form-group ${containerClassName}`}>
      {label && (
        <label htmlFor={selectId} className="vyasa-label">
          <span>
            {label}
            {required && <span style={{ color: 'var(--vyasa-saffron)', marginLeft: '4px' }}>*</span>}
          </span>
        </label>
      )}

      <select
        id={selectId}
        className={`vyasa-select ${error ? 'vyasa-select--error' : ''} ${className}`}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        aria-invalid={!!error}
        required={required}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

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
