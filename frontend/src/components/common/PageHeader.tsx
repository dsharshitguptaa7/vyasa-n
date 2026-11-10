import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppIcon, IconName, Button, Badge } from '@vyasa/ui';
import { useAuth } from '../../context/AuthContext';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: IconName;
}

export interface HeaderAction {
  label: string;
  onClick: () => void;
  icon?: IconName;
  variant?: 'primary' | 'teal' | 'gold' | 'saffron' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  id?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  statusBadge?: {
    text?: string;
    label?: string;
    variant?: 'primary' | 'teal' | 'gold' | 'saffron' | 'danger' | 'neutral';
  } | React.ReactNode;
  primaryAction?: HeaderAction;
  secondaryActions?: HeaderAction[];
  backButton?: {
    label?: string;
    path?: string;
    onClick?: () => void;
  };
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Returns canonical role dashboard destination so breadcrumbs never link to a generic
 * unprivileged dashboard when an authoritative desk is expected.
 */
export function getRoleDashboardDestination(auth: any): string {
  const userRoles = ((auth?.user?.roles as string[]) || []).map((r) => r.toLowerCase());
  if (auth?.isSuperAdmin || auth?.isAdmin || userRoles.includes('super_admin') || userRoles.includes('administrator')) {
    return '/admin';
  }
  if (auth?.isDean || userRoles.includes('vice_chancellor') || userRoles.includes('vc')) {
    return '/atharva-veda/dean/dashboard';
  }
  if (auth?.isAssociateDean) {
    return '/atharva-veda/associate-dean/dashboard';
  }
  if (auth?.isAssistantDean) {
    return '/atharva-veda/assistant-dean/dashboard';
  }
  if (auth?.isManager) {
    return '/atharva-veda/manager/queue';
  }
  if (auth?.isApplicant) {
    return '/atharva-veda/my-grievances';
  }
  if (auth?.isAuthority) {
    return '/authority';
  }
  return '/dashboard';
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  statusBadge,
  primaryAction,
  secondaryActions = [],
  backButton,
  className = '',
  style,
}) => {
  const navigate = useNavigate();
  let auth: any = null;
  try {
    auth = useAuth();
  } catch {
    // safe fallback in test environments
  }

  const roleDashboardPath = getRoleDashboardDestination(auth);

  const handleBack = () => {
    if (backButton?.onClick) {
      backButton.onClick();
    } else if (backButton?.path) {
      navigate(backButton.path);
    } else {
      navigate(-1);
    }
  };

  return (
    <div
      className={`vyasa-page-header ${className}`}
      style={{
        marginBottom: '18px',
        ...style,
      }}
    >
      {/* 1. Stately Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#64748b',
            marginBottom: '10px',
            flexWrap: 'wrap',
          }}
        >
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const targetPath =
              crumb.path === '/dashboard' && auth?.isAuthenticated ? roleDashboardPath : crumb.path;

            return (
              <React.Fragment key={crumb.label + idx}>
                {idx > 0 && <span style={{ color: '#cbd5e1' }}>&rsaquo;</span>}
                {isLast || !targetPath ? (
                  <span style={{ color: isLast ? '#1e293b' : '#64748b', fontWeight: isLast ? 600 : 500 }}>
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(targetPath)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: 'var(--vyasa-navy, #0f2b48)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {crumb.icon && (
                      <AppIcon name={crumb.icon} size={13} color="var(--vyasa-navy, #0f2b48)" />
                    )}
                    <span>{crumb.label}</span>
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* 2. Optional Back Action Link */}
      {backButton && (
        <div style={{ marginBottom: '12px' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <AppIcon name="arrow-left" size={13} />
            <span>{backButton.label || 'Back'}</span>
          </Button>
        </div>
      )}

      {/* 3. Title Row with Badges and Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--vyasa-navy, #0f2b48)',
                letterSpacing: '-0.015em',
                lineHeight: 1.25,
              }}
            >
              {title}
            </h1>
            {statusBadge &&
              (React.isValidElement(statusBadge) ? (
                statusBadge
              ) : typeof statusBadge === 'object' && statusBadge !== null && ('text' in statusBadge || 'label' in statusBadge) ? (
                <Badge variant={(statusBadge as any).variant || 'neutral'}>
                  {(statusBadge as any).text || (statusBadge as any).label}
                </Badge>
              ) : null)}
          </div>

          {subtitle && (
            <div
              style={{
                marginTop: '6px',
                fontSize: '0.9rem',
                color: 'var(--vyasa-text-secondary, #475569)',
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {/* Action Controls */}
        {(primaryAction || secondaryActions.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {secondaryActions.map((sec) => (
              <Button
                key={sec.label}
                variant={sec.variant || 'outline'}
                size="sm"
                onClick={sec.onClick}
                disabled={sec.disabled}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {sec.icon && <AppIcon name={sec.icon} size={14} />}
                <span>{sec.label}</span>
              </Button>
            ))}

            {primaryAction && (
              <Button
                variant={primaryAction.variant || 'primary'}
                size="sm"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {primaryAction.icon && <AppIcon name={primaryAction.icon} size={14} />}
                <span>{primaryAction.loading ? 'Processing...' : primaryAction.label}</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
