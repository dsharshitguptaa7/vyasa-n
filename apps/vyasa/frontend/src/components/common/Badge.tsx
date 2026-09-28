import React from 'react';
import { clsx } from '../../utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
}) => {
  return (
    <span className={clsx('vy-badge', `vy-badge--${variant}`, `vy-badge--${size}`)}>
      {children}
    </span>
  );
};
