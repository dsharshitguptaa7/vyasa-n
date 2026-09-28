import React from 'react';

export interface VyasaWordmarkProps {
  theme?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export const VyasaWordmark: React.FC<VyasaWordmarkProps> = ({
  theme = 'dark',
  size = 'md',
  showTagline = true,
  className = '',
}) => {
  const sizeClass = size === 'lg' ? 'vyasa-wordmark--lg' : size === 'sm' ? 'vyasa-wordmark--sm' : '';
  const themeClass = theme === 'light' ? 'vyasa-wordmark--light' : '';

  return (
    <div className={`vyasa-wordmark ${themeClass} ${sizeClass} ${className}`}>
      <span className="vyasa-wordmark__title">VYASA</span>
      {showTagline && (
        <span className="vyasa-wordmark__tagline vyasa-devanagari" lang="hi">
          ज्ञान से शोध तक, AI के साथ
        </span>
      )}
    </div>
  );
};
