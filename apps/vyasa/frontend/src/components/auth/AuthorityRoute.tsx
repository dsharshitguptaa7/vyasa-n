import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, Button, Card, PageContainer } from '@vyasa/ui';
import { LoadingState } from '@vyasa/ui';

interface AuthorityRouteProps {
  children: React.ReactNode;
}

export const AuthorityRoute: React.FC<AuthorityRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isAuthority, user, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <PageContainer narrow style={{ padding: '100px 0', textAlign: 'center' }}>
        <LoadingState message="Verifying institutional authority credentials..." />
      </PageContainer>
    );
  }

  // Requirement 7: Unauthenticated users redirected to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Requirement 4: If logged in but lacks generic 'authority' role, show access denied
  if (!isAuthority) {
    return (
      <PageContainer narrow style={{ padding: '80px 0' }}>
        <Card
          variant="scholarly"
          title="Institutional Access Restricted"
          subtitle="Authority Role Required"
          headerAction={<Badge variant="saffron">Access Denied</Badge>}
        >
          <div style={{ padding: '16px 0', color: 'var(--vyasa-text-secondary)', lineHeight: 1.6 }}>
            <p style={{ marginBottom: '16px' }}>
              The authenticated account (<strong>{user?.email}</strong>) does not possess the institutional{' '}
              <strong>authority</strong> platform role required to access the VYASA Authority Console.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--vyasa-text-muted)', marginBottom: '24px' }}>
              Active roles on your profile: {user?.roles && user.roles.length > 0 ? user.roles.join(', ') : 'None'}.<br />
              If your institutional duties require access, please contact the CSJMU VYASA Governance Administration.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Sign Out
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Return to Ecosystem Overview
              </Button>
            </div>
          </div>
        </Card>
      </PageContainer>
    );
  }

  return <>{children}</>;
};
