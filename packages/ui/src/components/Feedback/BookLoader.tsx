import React from 'react';

export interface BookLoaderProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Institutional Book-Page Loading Animation.
 * Uses the established VYASA palette: Deep Navy (#0f2b48), Warm Ivory (#faf7f2), and Muted Gold (#b2811a).
 * Fully respects prefers-reduced-motion preferences.
 */
export const BookLoader: React.FC<BookLoaderProps> = ({
  message = 'Loading...',
  size = 'md',
  className = '',
}) => {
  const scale = size === 'sm' ? 0.75 : size === 'lg' ? 1.35 : 1;

  return (
    <div
      className={`vyasa-book-loader ${className}`}
      role="status"
      aria-live="polite"
    >
      <div
        className="vyasa-book-loader__book"
        style={{ transform: `scale(${scale})` }}
        aria-hidden="true"
      >
        <div className="vyasa-book-loader__cover" />
        <div className="vyasa-book-loader__page-left">
          <div className="vyasa-book-loader__line" />
          <div className="vyasa-book-loader__line" />
          <div className="vyasa-book-loader__line vyasa-book-loader__line--short" />
        </div>
        <div className="vyasa-book-loader__page-right">
          <div className="vyasa-book-loader__line" />
          <div className="vyasa-book-loader__line" />
          <div className="vyasa-book-loader__line vyasa-book-loader__line--short" />
        </div>
        <div className="vyasa-book-loader__page-flipping">
          <div className="vyasa-book-loader__line" />
          <div className="vyasa-book-loader__line" />
          <div className="vyasa-book-loader__line vyasa-book-loader__line--short" />
        </div>
        <div className="vyasa-book-loader__spine" />
      </div>

      {message && (
        <span
          className="vyasa-book-loader__message"
          style={{ fontSize: size === 'sm' ? '12px' : size === 'lg' ? '16px' : '14px' }}
        >
          {message}
        </span>
      )}
    </div>
  );
};
