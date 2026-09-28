import React from 'react';
import { VyasaLogo } from './VyasaLogo';
import { VyasaWordmark } from './VyasaWordmark';

export interface VyasaBrandHeaderProps {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  onLogoClick?: () => void;
  className?: string;
}

export const VyasaBrandHeader: React.FC<VyasaBrandHeaderProps> = ({
  children,
  actions,
  onLogoClick,
  className = '',
}) => {
  return (
    <header className={`vyasa-masthead ${className}`}>
      <div className="vyasa-masthead__accent-bar" aria-hidden="true" />
      <div className="vyasa-page-container vyasa-masthead__inner">
        <div
          className="vyasa-logo-link"
          onClick={onLogoClick}
          role={onLogoClick ? 'button' : undefined}
          tabIndex={onLogoClick ? 0 : undefined}
          style={{ cursor: onLogoClick ? 'pointer' : 'default' }}
        >
          <VyasaLogo size={42} />
          <VyasaWordmark theme="dark" showTagline={true} />
        </div>

        {children && <div className="vyasa-masthead__nav">{children}</div>}

        {actions && <div className="vyasa-masthead__actions">{actions}</div>}
      </div>
    </header>
  );
};
