import React from 'react';

export type IconName =
  | 'user'
  | 'building'
  | 'shield'
  | 'graduation-cap'
  | 'bell'
  | 'file-text'
  | 'clipboard'
  | 'check-circle'
  | 'alert-circle'
  | 'clock'
  | 'search'
  | 'settings'
  | 'log-out'
  | 'layout-dashboard'
  | 'grid'
  | 'layers'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-right'
  | 'arrow-left'
  | 'menu'
  | 'close'
  | 'info'
  | 'check'
  | 'scale'
  | 'bar-chart'
  | 'users'
  | 'book-open'
  | 'globe'
  | 'edit'
  | 'upload';

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  className?: string;
  title?: string;
}

/**
 * Global VYASA Institutional Icon System
 * Standard: Lucide-style outline SVGs with consistent stroke-width (2px),
 * clean geometry, neutral colors, and strict accessibility.
 */
export const AppIcon: React.FC<IconProps> = ({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
  className = '',
  title,
  ...props
}) => {
  const commonProps = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: `vyasa-icon vyasa-icon--${name} ${className}`.trim(),
    'aria-hidden': !title ? true : undefined,
    role: title ? 'img' : undefined,
    ...props,
  };

  const renderPaths = () => {
    switch (name) {
      case 'user':
        return (
          <>
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </>
        );

      case 'building':
        return (
          <>
            <line x1="3" y1="21" x2="21" y2="21" />
            <line x1="6" y1="18" x2="6" y2="11" />
            <line x1="10" y1="18" x2="10" y2="11" />
            <line x1="14" y1="18" x2="14" y2="11" />
            <line x1="18" y1="18" x2="18" y2="11" />
            <polygon points="12 2 20 7 4 7 12 2" />
          </>
        );

      case 'shield':
        return (
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        );

      case 'graduation-cap':
        return (
          <>
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </>
        );

      case 'bell':
        return (
          <>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </>
        );

      case 'file-text':
        return (
          <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </>
        );

      case 'clipboard':
        return (
          <>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </>
        );

      case 'check-circle':
        return (
          <>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </>
        );

      case 'alert-circle':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </>
        );

      case 'clock':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </>
        );

      case 'search':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </>
        );

      case 'settings':
        return (
          <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </>
        );

      case 'log-out':
        return (
          <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </>
        );

      case 'layout-dashboard':
        return (
          <>
            <rect width="7" height="9" x="3" y="3" rx="1" />
            <rect width="7" height="5" x="14" y="3" rx="1" />
            <rect width="7" height="9" x="14" y="12" rx="1" />
            <rect width="7" height="5" x="3" y="16" rx="1" />
          </>
        );

      case 'grid':
      case 'layers':
        return (
          <>
            <rect width="7" height="7" x="3" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="3" rx="1" />
            <rect width="7" height="7" x="14" y="14" rx="1" />
            <rect width="7" height="7" x="3" y="14" rx="1" />
          </>
        );

      case 'chevron-down':
        return <polyline points="6 9 12 15 18 9" />;

      case 'chevron-up':
        return <polyline points="18 15 12 9 6 15" />;

      case 'chevron-right':
        return <polyline points="9 18 15 12 9 6" />;

      case 'chevron-left':
        return <polyline points="15 18 9 12 15 6" />;

      case 'arrow-right':
        return (
          <>
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </>
        );

      case 'arrow-left':
        return (
          <>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </>
        );

      case 'menu':
        return (
          <>
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </>
        );

      case 'close':
        return (
          <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </>
        );

      case 'info':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </>
        );

      case 'check':
        return <polyline points="20 6 9 17 4 12" />;

      case 'scale':
        return (
          <>
            <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" />
            <path d="M7 21h10" />
            <path d="M12 3v18" />
            <path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />
          </>
        );

      case 'bar-chart':
        return (
          <>
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="18" y1="20" x2="18" y2="4" />
            <line x1="6" y1="20" x2="6" y2="16" />
          </>
        );

      case 'users':
        return (
          <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </>
        );

      case 'book-open':
        return (
          <>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </>
        );

      case 'globe':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </>
        );

      case 'edit':
        return (
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        );

      case 'upload':
        return (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg {...commonProps}>
      {title && <title>{title}</title>}
      {renderPaths()}
    </svg>
  );
};

/**
 * Dropdown chevron icon with smooth CSS rotation
 */
export const DropdownChevron: React.FC<{
  isOpen: boolean;
  size?: number;
  className?: string;
  color?: string;
}> = ({ isOpen, size = 14, className = '', color = 'currentColor' }) => (
  <AppIcon
    name="chevron-down"
    size={size}
    color={color}
    className={`vyasa-chevron-icon ${isOpen ? 'is-open' : ''} ${className}`.trim()}
    style={{
      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
      display: 'inline-block',
      verticalAlign: 'middle',
    }}
  />
);

/**
 * Notification Bell icon with subtle unread indicator dot
 */
export const NotificationBell: React.FC<{
  hasUnread?: boolean;
  size?: number;
  color?: string;
  className?: string;
}> = ({ hasUnread = false, size = 18, color = 'currentColor', className = '' }) => (
  <span
    style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      verticalAlign: 'middle',
    }}
    className={className}
  >
    <AppIcon name="bell" size={size} color={color} />
    {hasUnread && (
      <span
        style={{
          position: 'absolute',
          top: '-1px',
          right: '-1px',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: 'var(--vyasa-saffron, #c85602)',
          boxShadow: '0 0 0 1.5px #ffffff',
        }}
        aria-hidden="true"
      />
    )}
  </span>
);

export default AppIcon;
