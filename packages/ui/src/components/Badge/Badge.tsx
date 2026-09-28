import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'saffron' | 'gold' | 'teal' | 'neutral';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
}) => {
  return (
    <span className={`vyasa-badge vyasa-badge--${variant} vyasa-badge--${size} ${className}`}>
      {icon && <span className="vyasa-badge__icon">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
