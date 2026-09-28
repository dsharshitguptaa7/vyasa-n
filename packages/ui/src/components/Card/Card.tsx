import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: 'default' | 'scholarly' | 'gold-accent' | 'saffron-accent';
  isInteractive?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  variant = 'default',
  isInteractive = false,
  className = '',
  style,
  onClick,
}) => {
  const variantClass = variant !== 'default' ? `vyasa-card--${variant}` : '';
  const interactiveClass = isInteractive ? 'vyasa-card--interactive' : '';

  return (
    <div
      className={`vyasa-card ${variantClass} ${interactiveClass} ${className}`}
      style={style}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {(title || subtitle || headerAction) && (
        <div className="vyasa-card__header">
          <div>
            {title && <h3 className="vyasa-card__title">{title}</h3>}
            {subtitle && <p className="vyasa-card__subtitle">{subtitle}</p>}
          </div>
          {headerAction && <div className="vyasa-card__action">{headerAction}</div>}
        </div>
      )}

      <div className="vyasa-card__body">{children}</div>

      {footer && <div className="vyasa-card__footer">{footer}</div>}
    </div>
  );
};
