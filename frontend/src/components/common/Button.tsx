import React from 'react';
import { clsx } from '../../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}) => {
  return (
    <button
      className={clsx('vy-btn', `vy-btn--${variant}`, `vy-btn--${size}`, className)}
      {...props}
    >
      {children}
    </button>
  );
};
