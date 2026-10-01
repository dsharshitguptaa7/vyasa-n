import React from 'react';
import { clsx } from '../../utils';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  title,
  subtitle,
  headerAction,
}) => {
  return (
    <div className={clsx('vy-card', className)}>
      {(title || subtitle || headerAction) && (
        <div className="vy-card__header">
          <div>
            {title && <h3 className="vy-card__title">{title}</h3>}
            {subtitle && <p className="vy-card__subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div className="vy-card__action">{headerAction}</div>}
        </div>
      )}
      <div className="vy-card__body">{children}</div>
    </div>
  );
};
