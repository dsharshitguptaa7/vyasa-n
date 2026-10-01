import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer, LoadingState } from '@vyasa/ui';

interface AuthorityScopedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  roleTitle?: string;
}

export const AuthorityScopedRoute: React.FC<AuthorityScopedRouteProps> = ({
  children,
  allowedRoles,
  roleTitle = 'Designated Authority',
}) => {
  const { isAuthenticated, isLoading, isAuthority, authorityRole, user, logout } = useAuth();
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

  if (!hasAllowedRole) {
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
              Permitted Roles: {allowedRoles.join(', ')}.
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
