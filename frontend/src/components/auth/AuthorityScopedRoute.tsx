import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer, LoadingState } from '@vyasa/ui';

interface AuthorityScopedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  roleTitle?: string;
  requiredDesignation?: string;
}

/**
 * Validates institutional jurisdiction and designation matching for scoped judicial routes.
 * Supports canonical institutional designations and legacy aliases.
 */
export const isDesignationJurisdictionMatch = (
  actualDesignation: string | null | undefined,
  requiredTitle: string
): boolean => {
  if (!requiredTitle || requiredTitle === 'Designated Authority') {
    return true;
  }
  if (!actualDesignation) {
    // If not specified on profile, only permit if role matches and title is a generic role label
    const genericRoleTitles = ['dean', 'associate dean', 'assistant dean', 'manager', 'designated authority'];
    return genericRoleTitles.includes(requiredTitle.trim().toLowerCase());
  }

  const normalize = (val: string) =>
    val
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/r\s*and\s*d/g, 'research and development')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normActual = normalize(actualDesignation);
  const normRequired = normalize(requiredTitle);

  if (normActual === normRequired || normActual.includes(normRequired) || normRequired.includes(normActual)) {
    return true;
  }

  // Cross-alias for Research & Development
  const isActualRD = normActual.includes('research') || normActual.includes('r and d');
  const isRequiredRD = normRequired.includes('research') || normRequired.includes('r and d');
  if (isActualRD && isRequiredRD) {
    return true;
  }

  return false;
};

export const AuthorityScopedRoute: React.FC<AuthorityScopedRouteProps> = ({
  children,
  allowedRoles,
  roleTitle = 'Designated Authority',
  requiredDesignation,
}) => {
  const { isAuthenticated, isLoading, isAuthority, authorityRole, authorityDesignation, user, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageContainer narrow style={{ padding: '100px 0', textAlign: 'center' }}>
        <LoadingState message={`Verifying institutional ${roleTitle.toLowerCase()} credentials...`} />
      </PageContainer>
    );
  }

  // Unauthenticated users redirected to /authority/login
  if (!isAuthenticated) {
    return <Navigate to="/authority/login" replace />;
  }

  // Check if authority has one of the allowed roles
  const hasAllowedRole =
    isAuthority &&
    Boolean(
      authorityRole &&
        allowedRoles.map((r) => r.toUpperCase()).includes(authorityRole.toUpperCase())
    );

  // Check institutional jurisdiction / designation
  const targetDesignation = requiredDesignation || roleTitle;
  const effectiveDesignation = authorityDesignation || user?.authority_designation;
  const hasAllowedJurisdiction = isDesignationJurisdictionMatch(effectiveDesignation, targetDesignation);

  const hasAccess = hasAllowedRole && hasAllowedJurisdiction;

  if (!hasAccess) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Institutional Jurisdiction Restricted"
          subtitle={`${roleTitle} Required`}
          headerAction={<Badge variant="saffron">Access Denied</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              The authenticated account (<strong>{user?.email}</strong>) is not assigned to the institutional{' '}
              <strong>{roleTitle}</strong> role required to access this judicial queue.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-muted)', marginBottom: '24px' }}>
              Current Authority Role: {authorityRole || 'None'}.<br />
              Permitted Roles: {allowedRoles.join(', ')}.<br />
              {effectiveDesignation && (
                <>
                  Jurisdictional Designation: {effectiveDesignation}.<br />
                </>
              )}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  navigate('/authority/login');
                }}
              >
                Sign Out
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/authority')}>
                Return to Authority Console
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
};
